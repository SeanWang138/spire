// SpireFi NEP-297 event log helpers. Every event uses the EVENT_JSON standard
// "spire" version "3.1.0". All u128 amounts are serialized as strings.
use near_sdk::serde_json::{json, Value};
use near_sdk::{env, AccountId};

pub const EVENT_STANDARD: &str = "spire";
pub const EVENT_VERSION: &str = "3.1.0";

fn emit_event(event_name: &str, data: Value) {
    let event = json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event_name,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{}", event));
}

pub fn log_deposit(account_id: &AccountId, amount: u128) {
    emit_event(
        "deposit",
        json!({
            "account_id": account_id.to_string(),
            "amount": amount.to_string(),
        }),
    );
}

pub fn log_withdraw(account_id: &AccountId, amount: u128) {
    emit_event(
        "withdraw",
        json!({
            "account_id": account_id.to_string(),
            "amount": amount.to_string(),
        }),
    );
}

pub fn log_withdraw_failed(account_id: &AccountId, amount: u128) {
    emit_event(
        "withdraw_failed",
        json!({
            "account_id": account_id.to_string(),
            "amount": amount.to_string(),
        }),
    );
}

pub fn log_starter_claimed(account_id: &AccountId, weapons: [u64; 3], ore: u64, essence: u64) {
    emit_event(
        "starter_claimed",
        json!({
            "account_id": account_id.to_string(),
            "weapons": weapons,
            "ore": ore,
            "essence": essence,
        }),
    );
}

pub fn log_gather(account_id: &AccountId, item_id: &str, amount: u64) {
    emit_event(
        "gather",
        json!({
            "account_id": account_id.to_string(),
            "item_id": item_id,
            "amount": amount,
        }),
    );
}

pub fn log_craft(account_id: &AccountId, output_token: &str, materials: Vec<(&str, u64)>) {
    let mats: Vec<Value> = materials
        .into_iter()
        .map(|(token_id, amt)| json!({"token_id": token_id, "amount": amt}))
        .collect();
    emit_event(
        "craft",
        json!({
            "account_id": account_id.to_string(),
            "recipe": "craft_weapon",
            "output_token": output_token,
            "materials_consumed": mats,
        }),
    );
}

pub fn log_reforge(
    account_id: &AccountId,
    burn_token: &str,
    target_token: &str,
    burned: u64,
    minted: u64,
    recipe: &str,
) {
    emit_event(
        "reforge",
        json!({
            "account_id": account_id.to_string(),
            "burn_element": burn_token,
            "received_element": target_token,
            "burned_count": burned,
            "minted_count": minted,
            "recipe": recipe,
        }),
    );
}

pub fn log_raid(
    account_id: &AccountId,
    floor: u8,
    round: u32,
    weapon: &str,
    damage: u32,
    boss_remaining_hp: u32,
    ticket_paid: u128,
    tribute_taken: bool,
) {
    emit_event(
        "raid",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "round": round,
            "weapon": weapon,
            "damage": damage,
            "boss_remaining_hp": boss_remaining_hp,
            "ticket_paid": ticket_paid.to_string(),
            "tribute_taken": tribute_taken,
        }),
    );
}

pub fn log_boss_defeated(
    floor: u8,
    round: u32,
    killer: &AccountId,
    total_jackpot: u128,
    total_damage: u128,
    trophy_token_id: Option<&str>,
) {
    emit_event(
        "boss_defeated",
        json!({
            "floor": floor,
            "round": round,
            "killer": killer.to_string(),
            "total_jackpot": total_jackpot.to_string(),
            "total_damage": total_damage,
            "trophy_token_id": trophy_token_id,
        }),
    );
}

pub fn log_round_expired(floor: u8, expired_round: u32, carried_jackpot: u128) {
    emit_event(
        "round_expired",
        json!({
            "floor": floor,
            "round": expired_round,
            "carried_jackpot": carried_jackpot.to_string(),
        }),
    );
}

pub fn log_floor_unlocked(floor: u8) {
    emit_event(
        "floor_unlocked",
        json!({
            "floor": floor,
        }),
    );
}

pub fn log_payout_claimed(account_id: &AccountId, floor: u8, round: u32, amount: u128) {
    emit_event(
        "payout_claimed",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "round": round,
            "amount": amount.to_string(),
        }),
    );
}

pub fn log_meta_updated(epoch: u64, old_resistance: [u32; 3], new_resistance: [u32; 3], supply: [u64; 3]) {
    emit_event(
        "meta_updated",
        json!({
            "epoch": epoch,
            "old_resistance": old_resistance,
            "new_resistance": new_resistance,
            "supply": supply,
        }),
    );
}

pub fn log_merchant_trade(
    account_id: &AccountId,
    side: &str,
    item_id: &str,
    qty: u64,
    total_price: u128,
    current_stock: u64,
    merchant_cash: u128,
) {
    emit_event(
        "merchant_trade",
        json!({
            "account_id": account_id.to_string(),
            "side": side,
            "item_id": item_id,
            "qty": qty,
            "total_price": total_price.to_string(),
            "current_stock": current_stock,
            "merchant_cash": merchant_cash.to_string(),
        }),
    );
}

pub fn log_merchant_closed(merchant_cash: u128) {
    emit_event(
        "merchant_closed",
        json!({
            "merchant_cash": merchant_cash.to_string(),
        }),
    );
}

pub fn log_merchant_opened(merchant_cash: u128) {
    emit_event(
        "merchant_opened",
        json!({
            "merchant_cash": merchant_cash.to_string(),
        }),
    );
}

pub fn log_buyback(
    account_id: &AccountId,
    floor: u8,
    element: u8,
    qty: u64,
    unit_price: u128,
    total_price: u128,
) {
    emit_event(
        "buyback",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "element": element,
            "qty": qty,
            "unit_price": unit_price.to_string(),
            "total_price": total_price.to_string(),
        }),
    );
}

pub fn log_backer_staked(account_id: &AccountId, floor: u8, amount: u128, shares: u128, cycle: u64) {
    emit_event(
        "backer_staked",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "amount": amount.to_string(),
            "shares": shares.to_string(),
            "cycle": cycle,
        }),
    );
}

pub fn log_dividend_claimed(account_id: &AccountId, floor: u8, amount: u128, cycle: u64) {
    emit_event(
        "dividend_claimed",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "amount": amount.to_string(),
            "cycle": cycle,
        }),
    );
}

pub fn log_ai_proposal_applied(
    floor: u8,
    epoch: u64,
    nonce: u64,
    buyback_multiplier_bps: [u32; 3],
    altar_recipe_id: &str,
) {
    emit_event(
        "ai_proposal_applied",
        json!({
            "floor": floor,
            "epoch": epoch,
            "nonce": nonce,
            "buyback_multiplier_bps": buyback_multiplier_bps,
            "altar_recipe_id": altar_recipe_id,
        }),
    );
}

pub fn log_ai_proposal_rejected(floor: u8, reason: &str) {
    emit_event(
        "ai_proposal_rejected",
        json!({
            "floor": floor,
            "reason": reason,
        }),
    );
}

pub fn log_tribute_seized(account_id: &AccountId, floor: u8, round: u32, element: u8) {
    emit_event(
        "tribute_seized",
        json!({
            "account_id": account_id.to_string(),
            "floor": floor,
            "round": round,
            "element": element,
        }),
    );
}
