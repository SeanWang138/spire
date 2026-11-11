// SpireFi NPC Merchant: deterministic pricing (spec §4.8). No AI involvement.
//
//   stock_pressure  = clamp((target_stock - stock) / target_stock, -100%..+100%) [bps]
//   demand_pressure = avg_buys_last_5_epochs / target_stock                      [bps]
//   mid = base_price * (10000^2 + k1_bps * stock_pressure + k2_bps * demand_pressure) / 10000^2
//   mid = clamp(mid, base_price * 0.5, base_price * 2.0)
//   player BUY price  (= merchant sells) = mid * (1 + spread)
//   player SELL price (= merchant buys)  = mid * (1 - spread)
//   shop closes while cash < minimum_cash
use crate::types::{
    MERCHANT_DEMAND_WEIGHT_BPS, MERCHANT_MIN_CASH, MERCHANT_SPREAD_BPS,
    MERCHANT_STOCK_PRESSURE_WEIGHT_BPS, MERCHANT_TARGET_STOCK,
};

/// The adjustment denominator: pressures and weights are both in bps units.
const BPS_SQ: i128 = 100_000_000; // 10000 * 10000

/// Clamp a value in the [min, max] range.
pub fn clamp(v: u128, min: u128, max: u128) -> u128 {
    if v < min {
        min
    } else if v > max {
        max
    } else {
        v
    }
}

/// Stock pressure in bps: positive when stock is scarce (price rises), negative when
/// abundant (price falls). Clamped to [-100%, +100%] of the target stock.
pub fn stock_pressure_bps(stock: u64) -> i128 {
    let target = MERCHANT_TARGET_STOCK as i128;
    let s = stock as i128;
    let diff = if s < target { target - s } else { s - target };
    let diff = diff.min(target); // clamp to ±100%
    let bps = diff * 10_000 / target;
    if s < target {
        bps
    } else {
        -bps
    }
}

/// Demand pressure in bps: 5-epoch average of player buys relative to target stock.
pub fn demand_pressure_bps(demand_avg_units: u64) -> i128 {
    (demand_avg_units as i128) * 10_000 / (MERCHANT_TARGET_STOCK as i128)
}

/// Mid price for one item. `demand_avg_units` is the 5-epoch average of player buys.
pub fn calculate_mid_price(stock: u64, base_price: u128, demand_avg_units: u64) -> u128 {
    let adjustment =
        (MERCHANT_STOCK_PRESSURE_WEIGHT_BPS as i128 * stock_pressure_bps(stock))
            + (MERCHANT_DEMAND_WEIGHT_BPS as i128 * demand_pressure_bps(demand_avg_units));
    // mid = P0 * (BPS_SQ + adjustment) / BPS_SQ — adjustment ∈ [-5000*10000, +8000*10000]
    // so the term never underflows below 0.5x and never exceeds 2.0x (still clamped).
    let raw = (base_price as i128)
        .saturating_mul(BPS_SQ + adjustment.clamp(-(9 * BPS_SQ), 3 * BPS_SQ))
        / BPS_SQ;
    clamp(raw.max(1) as u128, base_price / 2, base_price * 2)
}

/// Player BUY price (merchant sells): mid * (1 + spread).
pub fn calculate_buy_price(stock: u64, base_price: u128, demand_avg_units: u64) -> u128 {
    let mid = calculate_mid_price(stock, base_price, demand_avg_units);
    mid * (10_000 + MERCHANT_SPREAD_BPS) / 10_000
}

/// Player SELL price (merchant buys back): mid * (1 - spread).
pub fn calculate_sell_price(stock: u64, base_price: u128, demand_avg_units: u64) -> u128 {
    let mid = calculate_mid_price(stock, base_price, demand_avg_units);
    mid * (10_000 - MERCHANT_SPREAD_BPS) / 10_000
}

/// Merchant is open only while its own cash is at or above the minimum.
pub fn is_merchant_open(merchant_cash: u128) -> bool {
    merchant_cash >= MERCHANT_MIN_CASH
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::MERCHANT_BASE_PRICE;

    #[test]
    fn test_equilibrium() {
        // At target stock with no recent buys: mid == base price.
        assert_eq!(calculate_mid_price(100, MERCHANT_BASE_PRICE, 0), MERCHANT_BASE_PRICE);
        assert_eq!(
            calculate_buy_price(100, MERCHANT_BASE_PRICE, 0),
            MERCHANT_BASE_PRICE * 11000 / 10000
        );
        assert_eq!(
            calculate_sell_price(100, MERCHANT_BASE_PRICE, 0),
            MERCHANT_BASE_PRICE * 9000 / 10000
        );
    }

    #[test]
    fn test_scarce_stock_raises_price() {
        // Stock = 0 → +100% pressure * k1=0.5 → +50% → mid = 0.075 NEAR... capped at 2x? No:
        // raw mid = P0 * (100M + 5000*10000)/100M = P0 * 1.5 → clamp fine.
        let mid = calculate_mid_price(0, MERCHANT_BASE_PRICE, 0);
        assert_eq!(mid, MERCHANT_BASE_PRICE * 3 / 2);
        let buy = calculate_buy_price(0, MERCHANT_BASE_PRICE, 0);
        assert_eq!(buy, MERCHANT_BASE_PRICE * 3 / 2 * 11 / 10);
    }

    #[test]
    fn test_abundant_stock_lowers_price_clamped_at_half() {
        // Stock = 300 (3x target) → clamped to -100% pressure → k1=0.5 → mid = 0.5x.
        let mid = calculate_mid_price(300, MERCHANT_BASE_PRICE, 0);
        assert_eq!(mid, MERCHANT_BASE_PRICE / 2);
    }

    #[test]
    fn test_demand_pressure_raises_price() {
        // avg buys of 40 units/epoch over 5 epochs with stock at target: demand = 0.4
        // adjustment = k2=0.3 * 4000 bps = 1200 → mid = P0 * (100M + 1200*... )/100M
        //   = P0 * (100_000_000 + 3000*4000)/100_000_000 = P0 * 1.12
        let mid = calculate_mid_price(100, MERCHANT_BASE_PRICE, 40);
        let expected = MERCHANT_BASE_PRICE + MERCHANT_BASE_PRICE * 12 / 100;
        assert_eq!(mid, expected);
    }

    #[test]
    fn test_upper_clamp_two_x() {
        // Extreme demand pushes raw above 2x; clamp keeps mid ≤ 2x.
        let mid = calculate_mid_price(0, MERCHANT_BASE_PRICE, 300);
        assert_eq!(mid, MERCHANT_BASE_PRICE * 2);
    }

    #[test]
    fn test_merchant_openness() {
        assert!(!is_merchant_open(MERCHANT_MIN_CASH - 1));
        assert!(is_merchant_open(MERCHANT_MIN_CASH));
    }
}
