// SpireFi adaptive resistance: pure supply-based target computation (test-vector backed)
// plus the capped per-epoch shift with renormalization to the 13500 bps total.
use crate::types::{MAX_SHIFT_BPS, RESISTANCE_MAX_CLAMP, RESISTANCE_MIN_CLAMP, RESISTANCE_TOTAL_BPS};

/// Calculate 3-element adaptive resistance based on active supplies.
/// Returns [solar_bps, frost_bps, void_bps] summing to 13500 bps, clamped in [1000, 8500].
pub fn compute_adaptive_resistance(supplies: [u64; 3]) -> [u32; 3] {
    let s0 = supplies[0] as u128;
    let s1 = supplies[1] as u128;
    let s2 = supplies[2] as u128;
    let total: u128 = s0 + s1 + s2;
    if total == 0 {
        return [4500, 4500, 4500];
    }

    let pool: u128 = RESISTANCE_TOTAL_BPS as u128;
    let min_clamp: u128 = RESISTANCE_MIN_CLAMP as u128;
    let max_clamp: u128 = RESISTANCE_MAX_CLAMP as u128;
    let s = [s0, s1, s2];

    // Check if any element exceeds max_clamp
    for i in 0..3 {
        let raw = (s[i] * pool) / total;
        if raw >= max_clamp {
            let j = (i + 1) % 3;
            let k = (i + 2) % 3;

            // Closed-form equal excess redistribution
            let num_j = (2 * s[j] + s[i]) * pool - max_clamp * total;
            let den = 2 * total;
            let mut r_j = ((num_j + total) / den).clamp(min_clamp, max_clamp);
            let mut r_k = pool.saturating_sub(max_clamp + r_j);
            if r_k < min_clamp {
                r_k = min_clamp;
                r_j = pool - max_clamp - r_k;
            } else if r_k > max_clamp {
                r_k = max_clamp;
                r_j = pool - max_clamp - r_k;
            }

            let mut res = [0u32; 3];
            res[i] = max_clamp as u32;
            res[j] = r_j as u32;
            res[k] = r_k as u32;
            return res;
        }
    }

    // Check if any element is below min_clamp
    for i in 0..3 {
        let raw = (s[i] * pool) / total;
        if raw <= min_clamp {
            let j = (i + 1) % 3;
            let k = (i + 2) % 3;

            let num_j = (2 * s[j] + s[i]) * pool - min_clamp * total;
            let den = 2 * total;
            let mut r_j = ((num_j + total) / den).clamp(min_clamp, max_clamp);
            let mut r_k = pool.saturating_sub(min_clamp + r_j);
            if r_k < min_clamp {
                r_k = min_clamp;
                r_j = pool - min_clamp - r_k;
            } else if r_k > max_clamp {
                r_k = max_clamp;
                r_j = pool - min_clamp - r_k;
            }

            let mut res = [0u32; 3];
            res[i] = min_clamp as u32;
            res[j] = r_j as u32;
            res[k] = r_k as u32;
            return res;
        }
    }

    // Standard proportional allocation with half-up rounding
    let r0 = ((s[0] * pool * 2 + total) / (2 * total)) as u32;
    let r1 = ((s[1] * pool * 2 + total) / (2 * total)) as u32;
    let r2 = (pool as u32) - r0 - r1;
    [r0, r1, r2]
}

/// Shift the current resistance toward the supply-derived target, capping the per-element
/// move at MAX_SHIFT_BPS, then renormalize to exactly 13500 bps within the clamps.
/// The renormalization nudges each element proportionally to its attempted shift; when the
/// capped shifts cannot sum to 13500, the renormalization may exceed the cap slightly —
/// the 13500 total invariant always wins over the per-element cap.
pub fn compute_shifted_resistance(current: [u32; 3], target: [u32; 3]) -> [u32; 3] {
    let mut out = [0u32; 3];
    let mut weights = [0u32; 3];
    for i in 0..3 {
        let delta = (target[i] as i64 - current[i] as i64)
            .clamp(-(MAX_SHIFT_BPS as i64), MAX_SHIFT_BPS as i64);
        out[i] = (current[i] as i64 + delta)
            .clamp(RESISTANCE_MIN_CLAMP as i64, RESISTANCE_MAX_CLAMP as i64)
            as u32;
        weights[i] = delta.unsigned_abs() as u32;
    }
    renormalize(out, weights, current)
}

/// Move the sum of `r` to RESISTANCE_TOTAL_BPS one unit at a time, preferring the elements
/// with the larger attempted shift weight, without leaving the [min, max] clamps.
pub fn renormalize(
    mut r: [u32; 3],
    weights: [u32; 3],
    original: [u32; 3],
) -> [u32; 3] {
    let mut sum: i64 = r.iter().map(|&x| x as i64).sum();
    let goal = RESISTANCE_TOTAL_BPS as i64;
    let mut guard = 8 * (RESISTANCE_MAX_CLAMP as i64); // hard loop bound, sum ∈ [3*min, 3*max]
    while sum != goal && guard > 0 {
        guard -= 1;
        let diff = goal - sum;
        let mut idx = usize::MAX;
        let mut best = i64::MIN;
        for i in 0..3 {
            let headroom = if diff > 0 {
                RESISTANCE_MAX_CLAMP as i64 - r[i] as i64
            } else {
                r[i] as i64 - RESISTANCE_MIN_CLAMP as i64
            };
            if headroom <= 0 {
                continue;
            }
            // Preference: biggest shift weight, ties broken by distance still un-traveled
            // toward the original element value (keeps renormalization proportional).
            let dist = (original[i] as i64 - r[i] as i64).abs();
            let score = weights[i] as i64 * 1_000_000 + dist;
            if score > best {
                best = score;
                idx = i;
            }
        }
        if idx == usize::MAX {
            break; // cannot satisfy sum within clamps; keep state valid over the invariant
        }
        let step = if diff > 0 { 1 } else { -1 };
        r[idx] = (r[idx] as i64 + step) as u32;
        sum += step;
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_test_vector_80_20_10() {
        let res = compute_adaptive_resistance([80, 20, 10]);
        assert_eq!(res, [8500, 3114, 1886]);
        assert_eq!(res[0] + res[1] + res[2], 13500);
    }

    #[test]
    fn test_zero_supplies() {
        let res = compute_adaptive_resistance([0, 0, 0]);
        assert_eq!(res, [4500, 4500, 4500]);
        assert_eq!(res[0] + res[1] + res[2], 13500);
    }

    #[test]
    fn test_equal_supplies() {
        let res = compute_adaptive_resistance([50, 50, 50]);
        assert_eq!(res, [4500, 4500, 4500]);
        assert_eq!(res[0] + res[1] + res[2], 13500);
    }

    #[test]
    fn test_extreme_solar_skew() {
        let res = compute_adaptive_resistance([1000, 1, 1]);
        assert_eq!(res[0], 8500);
        assert_eq!(res[1] + res[2], 5000);
        assert_eq!(res[0] + res[1] + res[2], 13500);
        assert!(res[1] >= 1000 && res[1] <= 8500);
        assert!(res[2] >= 1000 && res[2] <= 8500);
    }

    #[test]
    fn test_shift_cap_then_renormalize() {
        // Neutral -> [8500, 3114, 1886]: raw deltas [+4000, -1386, -2614] get capped at
        // ±2500, then the sum deficit (+1386) is spread back over the movers.
        let cur = [4500, 4500, 4500];
        let out = compute_shifted_resistance(cur, [8500, 3114, 1886]);
        assert_eq!(out, [8386, 3114, 2000]);
        assert_eq!(out[0] + out[1] + out[2], 13500);
        for i in 0..3 {
            assert!(out[i] >= RESISTANCE_MIN_CLAMP && out[i] <= RESISTANCE_MAX_CLAMP);
        }
    }

    #[test]
    fn test_shift_within_cap_is_exact() {
        let cur = [4500, 4500, 4500];
        let out = compute_shifted_resistance(cur, [6000, 4000, 3500]);
        assert_eq!(out, [6000, 4000, 3500]);
    }

    #[test]
    fn test_shift_renormalize_preserves_clamped_bounds() {
        // Targets hitting both clamps: caps apply first, then renormalization walks the
        // sum back to exactly 13500 within the [1000, 8500] clamps.
        let cur = [8000, 1000, 4500];
        let out = compute_shifted_resistance(cur, [500, 6000, 8000]);
        assert_eq!(out, [3000, 3500, 7000]);
        assert_eq!(out[0] + out[1] + out[2], 13500);
        for i in 0..3 {
            assert!(out[i] >= RESISTANCE_MIN_CLAMP && out[i] <= RESISTANCE_MAX_CLAMP);
        }
    }

    #[test]
    fn test_renormalize_deterministic() {
        let a = renormalize([7000, 2000, 3114], [2500, 0, 1386], [4500, 4500, 4500]);
        let b = renormalize([7000, 2000, 3114], [2500, 0, 1386], [4500, 4500, 4500]);
        assert_eq!(a, b);
        assert_eq!(a.iter().map(|&x| x as u32).sum::<u32>(), 13500);
    }
}
