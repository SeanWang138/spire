// SpireFi contract types & configuration constants.
use near_sdk::{near, AccountId};
use std::collections::HashMap;

// ===================== Error codes (panic strings, machine-readable) =====================
pub const E_INSUFFICIENT_BALANCE: &str = "E_INSUFFICIENT_BALANCE";
pub const E_INSUFFICIENT_ITEM: &str = "E_INSUFFICIENT_ITEM";
pub const E_ALREADY_CLAIMED: &str = "E_ALREADY_CLAIMED";
pub const E_COOLDOWN: &str = "E_COOLDOWN";
pub const E_EPOCH_CAP: &str = "E_EPOCH_CAP";
pub const E_SHOP_CLOSED: &str = "E_SHOP_CLOSED";
pub const E_OUT_OF_STOCK: &str = "E_OUT_OF_STOCK";
pub const E_FLOOR_LOCKED: &str = "E_FLOOR_LOCKED";
pub const E_PAYOUT_CLAIMED: &str = "E_PAYOUT_CLAIMED";
pub const E_NOTHING_TO_CLAIM: &str = "E_NOTHING_TO_CLAIM";
pub const E_SAME_EPOCH: &str = "E_SAME_EPOCH";
pub const E_RESERVE_LOW: &str = "E_RESERVE_LOW";
pub const E_VOLUME_CAP: &str = "E_VOLUME_CAP";
pub const E_REPLAY_DETECTED: &str = "E_REPLAY_DETECTED";
pub const E_INVALID_PROPOSAL: &str = "E_INVALID_PROPOSAL";
pub const E_EXCEEDS_MAX_SHIFT: &str = "E_EXCEEDS_MAX_SHIFT";
pub const E_UNAUTHORIZED: &str = "E_UNAUTHORIZED";
pub const E_INVALID_ARGS: &str = "E_INVALID_ARGS";

// ===================== Epoch / adaptive resistance =====================
pub const EPOCH_DURATION_NS: u64 = 3_600_000_000_000; // 1 hour per epoch

pub const RESISTANCE_TOTAL_BPS: u32 = 13500;
pub const RESISTANCE_MIN_CLAMP: u32 = 1000;
pub const RESISTANCE_MAX_CLAMP: u32 = 8500;
pub const MAX_SHIFT_BPS: u32 = 2500;
pub const RESISTANCE_NEUTRAL: [u32; 3] = [4500, 4500, 4500];

// ===================== Combat =====================
pub const FLOOR_COUNT: u8 = 3;
pub const ATTACK_BASE_POWER: u32 = 140;
pub const STANCE_BPS: [u32; 3] = [12000, 10000, 9500]; // Aggressive / Feint / Pierce
pub const RAND_RANGE: (u32, u32) = (9000, 11000);
pub const FEINT_RANGE: (u32, u32) = (10000, 11000);
pub const PIERCE_RES_CUT_BPS: u32 = 1500;

// ===================== Tower floors (index 0 = Lantai 1) =====================
pub const FLOOR_MAX_HP: [u32; 3] = [1000, 1600, 2500];
pub const FLOOR_TICKET_COST: [u128; 3] = [
    100_000_000_000_000_000_000_000,  // 0.10 NEAR
    150_000_000_000_000_000_000_000,  // 0.15 NEAR
    250_000_000_000_000_000_000_000,  // 0.25 NEAR
];
pub const DEFAULT_FLOOR_DEADLINE_NS: [u64; 3] = [0, 1_800_000_000_000, 1_200_000_000_000];

// Floor 2 (idx 1): Frost Ward — frost resistance read with a fixed +1500 bps bias.
pub const FROST_WARD_FLOOR: u8 = 1;
pub const FROST_ELEMENT: u8 = 1;
pub const FROST_WARD_BONUS_BPS: u32 = 1500;

// Floor 3 (idx 2): Enrage — heals 10% of max HP per 5 minutes between attacks.
pub const ENRAGE_FLOOR: u8 = 2;
pub const ENRAGE_INTERVAL_NS: u64 = 300_000_000_000;
pub const ENRAGE_HEAL_BPS: u128 = 1000;

// ===================== Payout splits =====================
pub const FLOOR_DRIP_BPS: u128 = 1000; // 10% of jackpot drips to the next floor on defeat
pub const LAST_BONUS_BPS: u128 = 1000; // 10% of the post-drip pool to the last attacker

// Ticket split: jackpot / backer dividend / buyback reserve / merchant cash.
pub const SPLIT_JACKPOT_BPS: u128 = 7000;
pub const SPLIT_BACKER_BPS: u128 = 1500;
pub const SPLIT_BUYBACK_BPS: u128 = 1000;
pub const SPLIT_MERCHANT_BPS: u128 = 500;

// Boss tribute: seized when effective resistance >= 7000 bps.
pub const TRIBUTE_THRESHOLD_BPS: u32 = 7000;

// ===================== Backer vault =====================
pub const BACKER_SHARE_UNIT: u128 = 10_000_000_000_000_000; // 0.01 NEAR per share
pub const DIVIDEND_SCALE: u128 = 1_000_000; // fixed-point scale for dividend-per-share accumulator

// ===================== Buyback =====================
pub const BUYBACK_BASE: u128 = 100_000_000_000_000_000_000_000; // 0.10 NEAR
pub const BUYBACK_MIN_BPS: u32 = 10000;
pub const BUYBACK_MAX_BPS: u32 = 40000;
pub const BUYBACK_MAX_PER_FLOOR_EPOCH: u64 = 5;
pub const BUYBACK_MAX_PER_ACCOUNT_EPOCH: u64 = 2;

// ===================== Gathering =====================
pub const GATHER_AMOUNT: u64 = 2;
pub const GATHER_COOLDOWN_NS: u64 = 30_000_000_000; // 30 seconds
pub const GATHER_EPOCH_CAP: u64 = 20; // units per account per epoch

// ===================== Starter kit =====================
pub const STARTER_WEAPONS: [u64; 3] = [4, 1, 0]; // solar / frost / void
pub const STARTER_ORE: u64 = 4;
pub const STARTER_ESSENCE: u64 = 3;

// ===================== Altar / reforge =====================
pub const ALTAR_RECIPE_2_TO_1: &str = "reforge_2_to_1";
pub const ALTAR_RECIPE_3_TO_2: &str = "reforge_3_to_2";
pub const REFORGE_SHARE_MIN_BPS: u64 = 5000; // source element must hold >= 50% of supply

// ===================== Merchant bazaar =====================
pub const MERCHANT_BASE_PRICE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
pub const MERCHANT_TARGET_STOCK: u64 = 100;
pub const MERCHANT_SPREAD_BPS: u128 = 1000; // 10% two-way spread
pub const MERCHANT_STOCK_PRESSURE_WEIGHT_BPS: u128 = 5000;
pub const MERCHANT_DEMAND_WEIGHT_BPS: u128 = 3000;
pub const MERCHANT_MIN_CASH: u128 = 1_000_000_000_000_000_000_000_000; // 1.0 NEAR
pub const MERCHANT_CAP_PER_ITEM_EPOCH: u64 = 40;

pub const TOKEN_ORE_IRON: &str = "ore:iron";
pub const TOKEN_ESSENCE_SOLAR: &str = "essence:solar";
pub const TOKEN_ESSENCE_FROST: &str = "essence:frost";
pub const TOKEN_ESSENCE_VOID: &str = "essence:void";
pub const MATERIAL_TOKENS: [&str; 4] = [
    TOKEN_ORE_IRON,
    TOKEN_ESSENCE_SOLAR,
    TOKEN_ESSENCE_FROST,
    TOKEN_ESSENCE_VOID,
];

pub const TOKEN_WEAPON_SOLAR: &str = "weapon:solar";
pub const TOKEN_WEAPON_FROST: &str = "weapon:frost";
pub const TOKEN_WEAPON_VOID: &str = "weapon:void";

pub fn element_to_token_id(element: u8) -> &'static str {
    match element {
        0 => TOKEN_WEAPON_SOLAR,
        1 => TOKEN_WEAPON_FROST,
        2 => TOKEN_WEAPON_VOID,
        _ => panic!("{}", E_INVALID_ARGS),
    }
}

pub fn token_id_to_element(token_id: &str) -> Option<u8> {
    match token_id {
        TOKEN_WEAPON_SOLAR | "solar" => Some(0),
        TOKEN_WEAPON_FROST | "frost" => Some(1),
        TOKEN_WEAPON_VOID | "void" => Some(2),
        _ => None,
    }
}

pub fn essence_for_element(element: u8) -> &'static str {
    match element {
        0 => TOKEN_ESSENCE_SOLAR,
        1 => TOKEN_ESSENCE_FROST,
        2 => TOKEN_ESSENCE_VOID,
        _ => panic!("{}", E_INVALID_ARGS),
    }
}

pub fn material_index(item_id: &str) -> Option<usize> {
    MATERIAL_TOKENS.iter().position(|t| *t == item_id)
}

/// Split a floor ticket into [jackpot, backer dividend, buyback reserve, merchant cash].
/// Any rounding dust is assigned to the merchant slice so the parts always sum to the ticket.
pub fn split_ticket(ticket: u128) -> [u128; 4] {
    let jackpot = ticket * SPLIT_JACKPOT_BPS / 10000;
    let backer = ticket * SPLIT_BACKER_BPS / 10000;
    let buyback = ticket * SPLIT_BUYBACK_BPS / 10000;
    let merchant = ticket - jackpot - backer - buyback;
    [jackpot, backer, buyback, merchant]
}

// ===================== State structs =====================

/// Per-floor live state. Each of the 3 floors runs its own parallel raid cycle.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
pub struct FloorState {
    pub hp: u32,
    pub max_hp: u32,
    pub round: u32,
    pub first_attack_ns: u64, // 0 = round not started yet
    pub deadline_ns: u64,     // 0 = no deadline (floor 1)
    pub jackpot: u128,
    pub buyback_reserve: u128,
    pub dividend_pool: u128, // unclaimed backer dividends
    pub backer_acc_dividend_per_share: u128,
    pub backer_total_shares: u128,
    pub backer_cycle: u64,
    pub last_attack_ns: u64,
    pub total_damage: u128,
    pub loot: [u64; 3],
    pub volume_buyback_epoch: u64,
    pub unlocked: bool,
}

/// Jackpot payout for one completed (floor, round). `paid` tracks credited amounts so the
/// pending-claim money invariant stays exact.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct RoundResult {
    pub proportional_pool: u128,
    pub last_bonus: u128,
    pub total_damage: u128,
    pub last_attacker: AccountId,
    pub floor: u8,
    pub paid: u128,
}

/// Loot (seized tribute weapons) for one completed (floor, round), split 90/10
/// proportional / last attacker at distribution time.
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct LootResult {
    pub pool: [u64; 3],
    pub last_bonus: [u64; 3],
    pub total_damage: u128,
    pub last_attacker: AccountId,
}

/// AI proposal persisted for `get_ai_state(floor)`.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct AiState {
    pub floor: u8,
    pub epoch: u64,
    pub nonce: u64,
    pub buyback_multiplier_bps: [u32; 3],
    pub altar_recipe_id: String,
    pub taunt: Option<String>,
    pub chat_id: Option<String>,
    pub signature_hex: String,
}

/// Signed AI proposal payload (exact JSON the relayer sends).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct AiProposal {
    #[serde(default)]
    pub floor: u8,
    #[serde(default)]
    pub epoch: u64,
    #[serde(default)]
    pub buyback_multiplier_bps: [u32; 3],
    #[serde(default)]
    pub altar_recipe_id: Option<String>,
    #[serde(default)]
    pub taunt: Option<String>,
    #[serde(default)]
    pub nonce: u64,
}

// ===================== View responses =====================

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct FloorResponse {
    pub floor: u8,
    pub hp: u64,
    pub max_hp: u64,
    pub round: u32,
    pub first_attack_ns: u64,
    pub deadline_ns: u64,
    pub time_left_ns: u64,
    pub expired: bool,
    pub jackpot: u128,
    pub buyback_reserve: u128,
    pub dividend_pool: u128,
    pub backer_total_shares: u128,
    pub backer_cycle: u64,
    pub total_damage: u128,
    pub loot: [u64; 3],
    pub volume_buyback_epoch: u64,
    pub unlocked: bool,
    pub ward_element: Option<u8>,
    pub enrage: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct TowerResponse {
    pub floors: Vec<FloorResponse>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MetaResponse {
    pub epoch: u64,
    pub resistance: [u32; 3],
    pub next_epoch_in_ns: u64,
    pub shifted_by: u64,
    pub supply: [u64; 3],
    pub weak_element: u8,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, Default)]
pub struct PlayerInventoryResponse {
    pub weapons: [u64; 3],
    pub starter_locked: [u64; 3],
    pub materials: HashMap<String, u64>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MerchantResponse {
    pub cash: u128,
    pub stock: HashMap<String, u64>,
    pub is_open: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MerchantQuote {
    pub item_id: String,
    pub side: String,
    pub qty: u64,
    pub unit_price: u128,
    pub total_price: u128,
    pub is_open: bool,
    pub reason: String,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BuybackQuote {
    pub floor: u8,
    pub element: u8,
    pub unit_price: u128,
    pub multiplier_bps: u32,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BackerResponse {
    pub floor: u8,
    pub account_id: AccountId,
    pub shares: u128,
    pub current_cycle: u64,
    pub join_cycle: u64,
    pub last_claimed_cycle: u64,
}
