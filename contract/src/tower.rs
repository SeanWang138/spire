// SpireFi tower mechanics: floor configuration, enrage healing, deterministic attack-turn
// randomness (pure + seedable for tests) and Boss Tribute predicates.
use crate::types::{
    ATTACK_BASE_POWER, ENRAGE_HEAL_BPS, ENRAGE_INTERVAL_NS, FLOOR_COUNT, FEINT_RANGE,
    PIERCE_RES_CUT_BPS, RAND_RANGE, STANCE_BPS, TRIBUTE_THRESHOLD_BPS,
};

pub fn valid_floor(floor: u8) -> bool {
    floor < FLOOR_COUNT
}

/// Max HP for a floor (index 0..=2).
pub fn get_max_hp_for_floor(floor: u8) -> u32 {
    crate::types::FLOOR_MAX_HP[floor as usize]
}

/// Floor deadline from the current config table (0 = no deadline).
pub fn default_floor_deadline(floor: u8) -> u64 {
    crate::types::DEFAULT_FLOOR_DEADLINE_NS[floor as usize]
}

/// One attack turn: damage = BASE * (10000 - res_eff) * stance * rand (all bps math).
/// `rand_bps` comes from `rand_bps_from_seed`; capped damage vs remaining HP is the
/// caller's job (overkill is never recorded).
pub fn turn_damage(res_eff_bps: u32, stance: u8, rand_bps: u32) -> u32 {
    let res = turn_resistance(res_eff_bps, stance).min(10000);
    let raw = (ATTACK_BASE_POWER as u64 * (10000 - res as u64)) / 10000;
    let st = STANCE_BPS[stance as usize] as u64;
    let dmg = (raw * st * rand_bps as u64) / 100_000_000;
    dmg as u32
}

/// Effective resistance for one turn: Pierce cuts the resistance by 1500 bps (min 0).
pub fn turn_resistance(res_eff_bps: u32, stance: u8) -> u32 {
    if stance == 2 {
        res_eff_bps.saturating_sub(PIERCE_RES_CUT_BPS)
    } else {
        res_eff_bps
    }
}

/// Random multiplier in bps for a turn, derived deterministically from a mixed seed.
/// Feint (stance 1) rolls in the tighter [10000, 11000] band; others roll [9000, 11000].
pub fn rand_bps_from_seed(seed: u64, stance: u8) -> u32 {
    let mut x = seed ^ 0x9E37_79B9_7F4A_7C15;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    let roll = (x & 0xFFFF_FFFF) as u32;
    let (lo, hi) = if stance == 1 { FEINT_RANGE } else { RAND_RANGE };
    lo + roll % (hi - lo + 1)
}

/// Floor 3 enrage: heal = floor((now - last_attack) / 5min) * 10% of max_hp, capped at max_hp.
/// Restored HP is never recorded as damage.
pub fn calculate_enrage_heal(
    current_hp: u32,
    max_hp: u32,
    last_attack_ns: u64,
    now: u64,
) -> (u32, u64, u64) {
    if now <= last_attack_ns {
        return (current_hp, last_attack_ns, 0);
    }
    let ticks = (now - last_attack_ns) / ENRAGE_INTERVAL_NS;
    if ticks == 0 {
        return (current_hp, last_attack_ns, 0);
    }
    let heal = ((max_hp as u128 * ENRAGE_HEAL_BPS * ticks as u128) / 10000) as u32;
    let new_hp = current_hp.saturating_add(heal).min(max_hp);
    (new_hp, last_attack_ns.saturating_add(ticks * ENRAGE_INTERVAL_NS), ticks)
}

/// Boss Tribute predicate: resists hard enough, has a non-starter weapon of that element
/// available, and is not about to lose their last weapon.
pub fn should_confiscate_tribute(
    effective_resistance_bps: u32,
    non_starter_balance: u64,
    total_weapons_owned: u64,
) -> bool {
    if effective_resistance_bps < TRIBUTE_THRESHOLD_BPS {
        return false;
    }
    if non_starter_balance == 0 {
        return false; // only starter-locked weapons of that element => never seized
    }
    if total_weapons_owned <= 1 {
        return false; // never seize a player's last weapon
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_turn_damage_basics() {
        // res 1800: raw = 140*8200/10000 = 114; aggressive *12000, rand 10000 -> 136.8 -> 136
        assert_eq!(turn_damage(1800, 0, 10000), 136);
        assert_eq!(turn_damage(1800, 0, 9000), 123);
        // res 0: 140 * 1.2 = 168
        assert_eq!(turn_damage(0, 0, 10000), 168);
        // Feint: 140 * 8000/10000 = 112
        assert_eq!(turn_damage(2000, 1, 10000), 112);
        // Pierce: res cut to 500 -> 140 * 9500/10000 = 133 * 9500/10000 -> 126
        assert_eq!(turn_damage(2000, 2, 10000), 126);
    }

    #[test]
    fn test_turn_resistance_pierce_cut() {
        assert_eq!(turn_resistance(1800, 2), 300);
        assert_eq!(turn_resistance(1000, 2), 0);
        assert_eq!(turn_resistance(1800, 0), 1800);
        assert_eq!(turn_resistance(1800, 1), 1800);
    }

    #[test]
    fn test_rand_bps_range_and_determinism() {
        for stance in 0..3u8 {
            let a = rand_bps_from_seed(1234567, stance);
            let b = rand_bps_from_seed(1234567, stance);
            assert_eq!(a, b, "same seed => same roll");
        }
        for i in 0..200u64 {
            let aggressive = rand_bps_from_seed(i, 0);
            assert!((9000..=11000).contains(&aggressive), "aggressive roll {aggressive}");
            let feint = rand_bps_from_seed(i, 1);
            assert!((10000..=11000).contains(&feint), "feint roll {feint}");
            let pierce = rand_bps_from_seed(i, 2);
            assert!((9000..=11000).contains(&pierce), "pierce roll {pierce}");
        }
        assert_ne!(rand_bps_from_seed(1, 0), rand_bps_from_seed(2, 0));
    }

    #[test]
    fn test_enrage_heal_10_percent_per_5_min() {
        let t0 = 1_000_000_000_000u64;
        // Under 5 min: no heal
        let (hp, t, ticks) = calculate_enrage_heal(2000, 2500, t0, t0);
        assert_eq!((hp, t, ticks), (2000, t0, 0));
        // 5 minutes elapsed: +10% of 2500 = 250
        let (hp, t, ticks) = calculate_enrage_heal(2000, 2500, t0, t0 + 300_000_000_000);
        assert_eq!((hp, ticks), (2250, 1));
        assert_eq!(t, t0 + 300_000_000_000);
        // 10 minutes: +500, capped at max
        let (hp, _, ticks) = calculate_enrage_heal(2200, 2500, t0, t0 + 600_000_000_000);
        assert_eq!((hp, ticks), (2500, 2));
        // healed HP is capped, never over max
        let (hp, _, _) = calculate_enrage_heal(2400, 2500, t0, t0 + 900_000_000_000);
        assert_eq!(hp, 2500);
    }

    #[test]
    fn test_tribute_protections() {
        assert!(!should_confiscate_tribute(6999, 5, 5));
        assert!(should_confiscate_tribute(7000, 5, 5));
        assert!(!should_confiscate_tribute(7000, 0, 5), "starter-locked only");
        assert!(!should_confiscate_tribute(7000, 5, 1), "last weapon");
        assert!(!should_confiscate_tribute(7000, 5, 0));
    }
}
