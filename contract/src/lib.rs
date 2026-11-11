// SpireFi core contract v3.1 — 3-floor parallel tower, adaptive resistance, signless
// ledger, NPC merchant bazaar, boss buyback, backer vault and the TEE-signed AI gate.
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, Gas, NearToken, Promise, PublicKey};
use std::collections::HashMap;

mod events;
mod ledger;
mod merchant;
mod nft;
mod resistance;
mod tee;
mod tower;
mod types;

use ledger::Ledger;
pub use merchant::*;
pub use nft::{create_trophy_token, generate_trophy_svg, get_default_contract_metadata, NFTContractMetadata, Token, TokenMetadata};
pub use resistance::*;
pub use tee::{build_ai_message, extract_ed25519_key_bytes, is_ed25519_key, validate_ai_proposal_values, verify_ai_signature, SIGNATURE_LEN};
pub use tower::*;
pub use types::*;

/// Gas attached to the internal withdraw callback.
const WITHDRAW_CALLBACK_GAS: Gas = Gas::from_tgas(10);

/// Maximum number of completed rounds scanned by `claim_jackpot` per call.
const CLAIM_JACKPOT_SCAN_LIMIT: u64 = 500;
/// Maximum payouts credited by a single `claim_jackpot` call.
const CLAIM_JACKPOT_MAX_CLAIMS: u64 = 20;

#[near(serializers = [borsh])]
#[derive(near_sdk::BorshStorageKey)]
pub enum StorageKey {
    TokenBalances,
    StarterClaimed,
    StarterWeapons,
    MerchantStock,
    MerchantDemandRing,
    MerchantEpochBuys,
    BuybackAccountEpoch,
    AiState,
    Damage,
    Results,
    ResultsIndex,
    LootResults,
    Claimed,
    Backers,
    GatherEpoch,
    LastGatherNs,
    NftTokens,
}

/// Per-account backer position on one floor.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
pub struct BackerPosition {
    pub shares: u128,
    pub join_cycle: u64,
    /// Dividend-per-share accumulator value (scaled by DIVIDEND_SCALE) at join time.
    pub dps_base: u128,
    pub claimed_amount: u128,
    pub last_claimed_cycle: u64,
}

/// Pure function: proportional payout + last-attacker bonus for one completed round.
pub fn compute_payout(r: &RoundResult, my_damage: u128, who: &AccountId) -> u128 {
    if r.total_damage == 0 {
        return 0;
    }
    let share = (r.proportional_pool * my_damage) / r.total_damage;
    if *who == r.last_attacker {
        share + r.last_bonus
    } else {
        share
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

#[near(contract_state)]
pub struct Spire {
    // Governance
    pub owner: AccountId,
    pub relayer: AccountId,
    pub tee_public_key: PublicKey,

    // 3-floor parallel tower (index 0 = Lantai 1; all public floor params are 0-based)
    pub floors: [FloorState; 3],
    pub floor_ticket_cost: [u128; 3],

    // Epoch / adaptive resistance
    pub resistance: [u32; 3],
    pub epoch: u64,
    pub epoch_start_ns: u64,
    pub shifted_by: u64,
    pub supply: [u64; 3],

    // NEP-245 style multi-token balances (materials + weapons)
    pub token_balances: LookupMap<(AccountId, String), u128>,
    pub starter_claimed: LookupMap<AccountId, bool>,
    pub starter_weapons: LookupMap<AccountId, [u64; 3]>,

    // Internal signless ledger
    pub ledger: Ledger,

    // NPC merchant bazaar (materials only)
    pub merchant_cash: u128,
    pub merchant_stock: LookupMap<String, u64>,
    pub merchant_demand_ring: LookupMap<String, [u64; 5]>,
    pub merchant_epoch_buys: LookupMap<(String, u64), u64>,

    // Boss buyback: per-floor per-element multipliers + per-epoch volume tracking
    pub buyback_multiplier_bps: [[u32; 3]; 3],
    pub buyback_account_epoch: LookupMap<(u8, u64, AccountId), u64>,

    // AI gate
    pub last_ai_nonce: u64,
    pub last_altar_recipe: Option<String>,
    pub ai_state: LookupMap<u8, AiState>,

    // Combat records, keyed (floor, round[, account])
    pub damage: LookupMap<(u8, u32, AccountId), u128>,
    pub results: LookupMap<(u8, u32), RoundResult>,
    pub results_index: Vector<(u8, u32)>,
    pub loot_results: LookupMap<(u8, u32), LootResult>,
    pub claimed: LookupMap<(u8, u32, AccountId), bool>,

    // Backer vault per floor
    pub backers: LookupMap<(u8, AccountId), BackerPosition>,

    // Gathering
    pub gather_epoch: LookupMap<AccountId, (u64, u64)>,
    pub last_gather_ns: LookupMap<AccountId, u64>,

    // Dynamic SVG trophy NFT (NEP-171 / NEP-177)
    pub nft_tokens: LookupMap<String, Token>,
    pub nft_total_supply: u64,
}

impl Default for Spire {
    fn default() -> Self {
        // Required by the bindgen state loader for non-init calls. Real deployments
        // must initialize through the `#[init] new()` constructor (no default init).
        let mut pk_bytes = vec![0u8];
        pk_bytes.extend_from_slice(&[0u8; 32]);
        Self::new(
            "spire-owner.testnet"
                .parse()
                .expect("E_INVALID_ARGS"),
            "spire-relayer.testnet"
                .parse()
                .expect("E_INVALID_ARGS"),
            PublicKey::try_from(pk_bytes).expect("E_INVALID_ARGS"),
        )
    }
}

impl Spire {
    // ---------- internal token helpers (single source of truth: token_balances) ----------
    fn add_token_balance(&mut self, who: &AccountId, token_id: &str, amount: u128) {
        let key = (who.clone(), token_id.to_string());
        let current = self.token_balances.get(&key).copied().unwrap_or(0);
        self.token_balances.insert(key, current + amount);
    }

    fn sub_token_balance(&mut self, who: &AccountId, token_id: &str, amount: u128) {
        let key = (who.clone(), token_id.to_string());
        let current = self.token_balances.get(&key).copied().unwrap_or(0);
        if current < amount {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }
        self.token_balances.insert(key, current - amount);
    }

    fn token_balance(&self, who: &AccountId, token_id: &str) -> u128 {
        self.token_balances
            .get(&(who.clone(), token_id.to_string()))
            .copied()
            .unwrap_or(0)
    }

    fn weapon_inventory(&self, who: &AccountId) -> [u64; 3] {
        let mut out = [0u64; 3];
        for e in 0..3u8 {
            out[e as usize] = self.token_balance(who, element_to_token_id(e)) as u64;
        }
        out
    }

    fn starter_of(&self, who: &AccountId) -> [u64; 3] {
        self.starter_weapons.get(who).copied().unwrap_or([0, 0, 0])
    }

    fn material_balance(&self, who: &AccountId, item_id: &str) -> u64 {
        self.token_balance(who, item_id) as u64
    }

    // ---------- guards ----------

    fn assert_owner(&self) {
        if env::predecessor_account_id() != self.owner {
            panic!("{}", E_UNAUTHORIZED);
        }
    }

    fn assert_relayer(&self) {
        if env::predecessor_account_id() != self.relayer {
            panic!("{}", E_UNAUTHORIZED);
        }
    }

    // ---------- merchant cash with open/close transition events ----------

    fn merchant_cash_add(&mut self, amount: u128) {
        let was_open = merchant::is_merchant_open(self.merchant_cash);
        self.merchant_cash += amount;
        if !was_open && merchant::is_merchant_open(self.merchant_cash) {
            events::log_merchant_opened(self.merchant_cash);
        }
    }

    fn merchant_cash_sub(&mut self, amount: u128) {
        let was_open = merchant::is_merchant_open(self.merchant_cash);
        self.merchant_cash -= amount;
        if was_open && !merchant::is_merchant_open(self.merchant_cash) {
            events::log_merchant_closed(self.merchant_cash);
        }
    }

    // ---------- merchant demand ring ----------

    fn demand_avg(&self, item_id: &str) -> u64 {
        let ring = self
            .merchant_demand_ring
            .get(&item_id.to_string())
            .copied()
            .unwrap_or([0u64; 5]);
        ring.iter().sum::<u64>() / 5
    }

    // ---------- lazy epoch: advance epoch, shift resistance, roll demand rings ----------

    /// Returns true when one or more epochs elapsed and the meta state was recomputed.
    fn lazy_epoch(&mut self) -> bool {
        let now = env::block_timestamp();
        if now < self.epoch_start_ns.saturating_add(EPOCH_DURATION_NS) {
            return false;
        }
        let elapsed = (now - self.epoch_start_ns) / EPOCH_DURATION_NS;
        let old_epoch = self.epoch;
        self.epoch += elapsed;
        self.epoch_start_ns += elapsed * EPOCH_DURATION_NS;

        // Reset per-floor buyback volume counters for the new epoch.
        for i in 0..3usize {
            self.floors[i].volume_buyback_epoch = 0;
        }

        // Roll the merchant 5-epoch demand rings with the completed epochs' buy counts.
        for item in MATERIAL_TOKENS {
            let item_s = item.to_string();
            let mut ring = self
                .merchant_demand_ring
                .get(&item_s)
                .copied()
                .unwrap_or([0u64; 5]);
            if elapsed >= 5 {
                ring = [0u64; 5];
            } else {
                let e = elapsed as usize;
                ring.rotate_left(e);
                for j in (5 - e)..5 {
                    ring[j] = 0;
                }
            }
            let first = if elapsed >= 5 { self.epoch - 5 } else { old_epoch };
            let offset = if elapsed >= 5 { 0 } else { 5 - elapsed as usize };
            for e in first..self.epoch {
                let count = self
                    .merchant_epoch_buys
                    .get(&(item_s.clone(), e))
                    .copied()
                    .unwrap_or(0);
                ring[offset + (e - first) as usize] = count;
            }
            self.merchant_demand_ring.insert(item_s, ring);
        }

        // Adaptive resistance: supply-derived target, capped shift, renormalized to 13500.
        let old_resistance = self.resistance;
        let target = resistance::compute_adaptive_resistance(self.supply);
        self.resistance = resistance::compute_shifted_resistance(old_resistance, target);
        self.shifted_by += 1;
        events::log_meta_updated(self.epoch, old_resistance, self.resistance, self.supply);
        true
    }

    // ---------- floor responses ----------

    fn floor_response(&self, floor: u8) -> FloorResponse {
        let fl = &self.floors[floor as usize];
        let now = env::block_timestamp();
        let (time_left_ns, expired) = if fl.deadline_ns == 0 {
            (0, false)
        } else if fl.first_attack_ns == 0 {
            (fl.deadline_ns, false)
        } else {
            let end = fl.first_attack_ns.saturating_add(fl.deadline_ns);
            (end.saturating_sub(now), now > end)
        };
        FloorResponse {
            floor,
            hp: fl.hp as u64,
            max_hp: fl.max_hp as u64,
            round: fl.round,
            first_attack_ns: fl.first_attack_ns,
            deadline_ns: fl.deadline_ns,
            time_left_ns,
            expired,
            jackpot: fl.jackpot,
            buyback_reserve: fl.buyback_reserve,
            dividend_pool: fl.dividend_pool,
            backer_total_shares: fl.backer_total_shares,
            backer_cycle: fl.backer_cycle,
            total_damage: fl.total_damage,
            loot: fl.loot,
            volume_buyback_epoch: fl.volume_buyback_epoch,
            unlocked: fl.unlocked,
            ward_element: if floor == FROST_WARD_FLOOR {
                Some(FROST_ELEMENT)
            } else {
                None
            },
            enrage: floor == ENRAGE_FLOOR,
        }
    }

    // ---------- round settlement ----------

    fn settle_defeat(&mut self, floor: u8, killer: AccountId) {
        let i = floor as usize;
        let round = self.floors[i].round;
        let pool = self.floors[i].jackpot;
        let total_damage = self.floors[i].total_damage;

        // 10% of the jackpot drips to the next floor (floors 1..2 only).
        let mut distributable = pool;
        if floor < FLOOR_COUNT - 1 {
            let drip = pool * FLOOR_DRIP_BPS / 10000;
            distributable -= drip;
            self.floors[i + 1].jackpot += drip;
        }
        // 10% of the post-drip pool to the last attacker.
        let last_bonus = distributable * LAST_BONUS_BPS / 10000;
        let proportional_pool = distributable - last_bonus;

        self.results.insert(
            (floor, round),
            RoundResult {
                proportional_pool,
                last_bonus,
                total_damage,
                last_attacker: killer.clone(),
                floor,
                paid: 0,
            },
        );
        self.results_index.push((floor, round));

        // Loot (seized tribute weapons): 90% proportional / 10% last attacker.
        let mut loot_pool = [0u64; 3];
        let mut loot_last = [0u64; 3];
        for e in 0..3usize {
            let prop = self.floors[i].loot[e] * 9 / 10;
            loot_pool[e] = prop;
            loot_last[e] = self.floors[i].loot[e] - prop;
        }
        self.loot_results.insert(
            (floor, round),
            LootResult {
                pool: loot_pool,
                last_bonus: loot_last,
                total_damage,
                last_attacker: killer.clone(),
            },
        );

        // Backer cycle advances; floor resets into a fresh round — no downward reset.
        self.floors[i].backer_cycle += 1;
        self.floors[i].jackpot = 0;
        self.floors[i].total_damage = 0;
        self.floors[i].loot = [0, 0, 0];
        self.floors[i].round += 1;
        self.floors[i].first_attack_ns = 0;
        self.floors[i].last_attack_ns = 0;
        self.floors[i].hp = self.floors[i].max_hp;

        if floor < FLOOR_COUNT - 1 {
            self.floors[i + 1].unlocked = true;
            events::log_floor_unlocked(floor + 1);
        }

        if floor == FLOOR_COUNT - 1 {
            // Floor 3 falls: mint the dynamic SpireFi trophy NFT.
            let trophy = nft::create_trophy_token(
                round,
                floor + 1,
                &killer,
                pool,
                self.resistance,
                total_damage,
                env::block_timestamp(),
            );
            let trophy_id = trophy.token_id.clone();
            self.nft_tokens.insert(trophy_id.clone(), trophy);
            self.nft_total_supply += 1;
            events::log_boss_defeated(floor, round, &killer, pool, total_damage, Some(&trophy_id));
        } else {
            events::log_boss_defeated(floor, round, &killer, pool, total_damage, None);
        }
    }

    // ---------- payout claiming (shared by claim_payout / claim_jackpot) ----------

    /// Returns 0 when there is nothing (or nothing left) to claim for (floor, round).
    fn try_claim(&mut self, who: &AccountId, floor: u8, round: u32) -> u128 {
        let key = (floor, round, who.clone());
        if self.claimed.get(&key).copied().unwrap_or(false) {
            return 0;
        }
        let Some(r) = self.results.get(&(floor, round)).cloned() else {
            return 0;
        };
        let my_damage = self
            .damage
            .get(&(floor, round, who.clone()))
            .copied()
            .unwrap_or(0);
        if my_damage == 0 || r.total_damage == 0 {
            return 0;
        }
        let remaining = r.proportional_pool + r.last_bonus - r.paid;
        let amount = compute_payout(&r, my_damage, who).min(remaining);
        if amount == 0 {
            return 0;
        }

        let mut settled = r.clone();
        settled.paid += amount;
        self.results.insert((floor, round), settled);
        self.claimed.insert(key, true);
        self.ledger.credit(who, amount);

        // Loot weapons ride on the same claim flag (never starter-locked).
        if let Some(l) = self.loot_results.get(&(floor, round)).cloned() {
            for e in 0..3u8 {
                let mut loot_amt = l.pool[e as usize] * my_damage as u64 / l.total_damage as u64;
                if *who == l.last_attacker {
                    loot_amt += l.last_bonus[e as usize];
                }
                if loot_amt > 0 {
                    self.add_token_balance(who, element_to_token_id(e), loot_amt as u128);
                }
            }
        }

        events::log_payout_claimed(who, floor, round, amount);
        amount
    }
}

#[near]
impl Spire {
    #[init]
    pub fn new(owner: AccountId, relayer: AccountId, tee_public_key: PublicKey) -> Self {
        if !tee::is_ed25519_key(&tee_public_key) {
            panic!("{}", E_INVALID_ARGS);
        }
        let mut floors = [FloorState::default(), FloorState::default(), FloorState::default()];
        for i in 0..3usize {
            floors[i].max_hp = FLOOR_MAX_HP[i];
            floors[i].hp = FLOOR_MAX_HP[i];
            floors[i].deadline_ns = DEFAULT_FLOOR_DEADLINE_NS[i];
            floors[i].unlocked = i == 0;
        }
        Self {
            owner,
            relayer,
            tee_public_key,
            floors,
            floor_ticket_cost: FLOOR_TICKET_COST,
            resistance: RESISTANCE_NEUTRAL,
            epoch: 0,
            epoch_start_ns: env::block_timestamp(),
            shifted_by: 0,
            supply: [0, 0, 0],
            token_balances: LookupMap::new(StorageKey::TokenBalances),
            starter_claimed: LookupMap::new(StorageKey::StarterClaimed),
            starter_weapons: LookupMap::new(StorageKey::StarterWeapons),
            ledger: Ledger::new(),
            merchant_cash: 0,
            merchant_stock: LookupMap::new(StorageKey::MerchantStock),
            merchant_demand_ring: LookupMap::new(StorageKey::MerchantDemandRing),
            merchant_epoch_buys: LookupMap::new(StorageKey::MerchantEpochBuys),
            buyback_multiplier_bps: [
                [10_000, 10_000, 10_000],
                [10_000, 10_000, 10_000],
                [10_000, 10_000, 10_000],
            ],
            buyback_account_epoch: LookupMap::new(StorageKey::BuybackAccountEpoch),
            last_ai_nonce: 0,
            last_altar_recipe: None,
            ai_state: LookupMap::new(StorageKey::AiState),
            damage: LookupMap::new(StorageKey::Damage),
            results: LookupMap::new(StorageKey::Results),
            results_index: Vector::new(StorageKey::ResultsIndex),
            loot_results: LookupMap::new(StorageKey::LootResults),
            claimed: LookupMap::new(StorageKey::Claimed),
            backers: LookupMap::new(StorageKey::Backers),
            gather_epoch: LookupMap::new(StorageKey::GatherEpoch),
            last_gather_ns: LookupMap::new(StorageKey::LastGatherNs),
            nft_tokens: LookupMap::new(StorageKey::NftTokens),
            nft_total_supply: 0,
        }
    }

    // ===================== owner administration =====================

    pub fn set_relayer(&mut self, relayer: AccountId) {
        self.assert_owner();
        self.relayer = relayer;
    }

    pub fn set_tee_signer_pubkey(&mut self, public_key: PublicKey) {
        self.assert_owner();
        if !tee::is_ed25519_key(&public_key) {
            panic!("{}", E_INVALID_ARGS);
        }
        self.tee_public_key = public_key;
    }

    pub fn set_floor_timing(&mut self, floor: u8, deadline_ns: u64, max_hp: u32, ticket: U128) {
        self.assert_owner();
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let fl = &mut self.floors[floor as usize];
        fl.deadline_ns = deadline_ns;
        fl.max_hp = max_hp;
        fl.hp = fl.hp.min(max_hp);
        self.floor_ticket_cost[floor as usize] = ticket.0;
    }

    #[payable]
    pub fn seed_merchant(&mut self, item_id: String, qty: u64) {
        self.assert_owner();
        if material_index(&item_id).is_none() || qty == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        let stock = self.merchant_stock.get(&item_id).copied().unwrap_or(0);
        self.merchant_stock.insert(item_id, stock + qty);
        self.merchant_cash_add(env::attached_deposit().as_yoctonear());
    }

    // ===================== signless ledger =====================

    #[payable]
    pub fn deposit(&mut self) {
        let who = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        self.ledger.credit(&who, amount);
        events::log_deposit(&who, amount);
    }

    /// Signless withdrawal. Debits first, transfers, then the private callback re-credits
    /// the ledger if the transfer failed (and logs `withdraw_failed`).
    pub fn withdraw(&mut self, amount: Option<U128>) -> Promise {
        let who = env::predecessor_account_id();
        let balance = self.ledger.balance(&who);
        let amount = amount.map(|a| a.0).unwrap_or(balance);
        if amount == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        if balance < amount {
            panic!("{}", E_INSUFFICIENT_BALANCE);
        }
        self.ledger.debit(&who, amount);
        Promise::new(who.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(WITHDRAW_CALLBACK_GAS)
                    .withdraw_callback(who, U128(amount)),
            )
    }

    #[private]
    pub fn withdraw_callback(&mut self, who: AccountId, amount: U128) {
        match env::promise_result_checked(0, usize::MAX) {
            Ok(_) => {
                events::log_withdraw(&who, amount.0);
            }
            _ => {
                self.ledger.credit(&who, amount.0);
                events::log_withdraw_failed(&who, amount.0);
            }
        }
    }

    #[payable]
    pub fn fund_jackpot(&mut self, floor: u8) {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let amount = env::attached_deposit().as_yoctonear();
        self.floors[floor as usize].jackpot += amount;
    }

    #[payable]
    pub fn fund_merchant(&mut self) {
        self.merchant_cash_add(env::attached_deposit().as_yoctonear());
    }

    // ===================== gameplay: starter / gather / craft / reforge =====================

    pub fn claim_starter(&mut self) {
        let who = env::predecessor_account_id();
        if self.starter_claimed.get(&who).copied().unwrap_or(false) {
            panic!("{}", E_ALREADY_CLAIMED);
        }
        self.starter_claimed.insert(who.clone(), true);
        self.starter_weapons.insert(who.clone(), STARTER_WEAPONS);
        // Starter weapons are starter-locked: they do NOT touch the global supply.
        for e in 0..3u8 {
            if STARTER_WEAPONS[e as usize] > 0 {
                self.add_token_balance(&who, element_to_token_id(e), STARTER_WEAPONS[e as usize] as u128);
            }
        }
        self.add_token_balance(&who, TOKEN_ORE_IRON, STARTER_ORE as u128);
        for item in [TOKEN_ESSENCE_SOLAR, TOKEN_ESSENCE_FROST, TOKEN_ESSENCE_VOID] {
            self.add_token_balance(&who, item, STARTER_ESSENCE as u128);
        }
        events::log_starter_claimed(&who, STARTER_WEAPONS, STARTER_ORE, STARTER_ESSENCE);
    }

    pub fn gather(&mut self, item_id: String) {
        let who = env::predecessor_account_id();
        if material_index(&item_id).is_none() {
            panic!("{}", E_INVALID_ARGS);
        }
        let now = env::block_timestamp();
        let last = self.last_gather_ns.get(&who).copied().unwrap_or(0);
        if last != 0 && now.saturating_sub(last) < GATHER_COOLDOWN_NS {
            panic!("{}", E_COOLDOWN);
        }
        let mut entry = self.gather_epoch.get(&who).copied().unwrap_or((self.epoch, 0));
        if entry.0 != self.epoch {
            entry = (self.epoch, 0);
        }
        if entry.1 + GATHER_AMOUNT > GATHER_EPOCH_CAP {
            panic!("{}", E_EPOCH_CAP);
        }
        entry.1 += GATHER_AMOUNT;
        self.gather_epoch.insert(who.clone(), entry);
        self.last_gather_ns.insert(who.clone(), now);
        self.add_token_balance(&who, &item_id, GATHER_AMOUNT as u128);
        events::log_gather(&who, &item_id, GATHER_AMOUNT);
    }

    pub fn craft_weapon(&mut self, element: u8) {
        let who = env::predecessor_account_id();
        if element > 2 {
            panic!("{}", E_INVALID_ARGS);
        }
        let essence = essence_for_element(element);
        if self.material_balance(&who, TOKEN_ORE_IRON) < 2 || self.material_balance(&who, essence) < 3 {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }
        self.sub_token_balance(&who, TOKEN_ORE_IRON, 2);
        self.sub_token_balance(&who, essence, 3);
        let weapon = element_to_token_id(element);
        self.add_token_balance(&who, weapon, 1);
        self.supply[element as usize] += 1;
        events::log_craft(
            &who,
            weapon,
            vec![(TOKEN_ORE_IRON, 2), (essence, 3)],
        );
    }

    pub fn reforge(&mut self, burn_element: u8, target_element: u8) {
        let who = env::predecessor_account_id();
        if burn_element > 2 || target_element > 2 || burn_element == target_element {
            panic!("{}", E_INVALID_ARGS);
        }
        // The 3→2 altar recipe only runs when the AI activated it and the source element
        // holds at least REFORGE_SHARE_MIN_BPS of the total weapon supply.
        let total_supply: u64 = self.supply.iter().sum();
        let mut burn_count: u64 = 2;
        let mut recipe = ALTAR_RECIPE_2_TO_1;
        if self.last_altar_recipe.as_deref() == Some(ALTAR_RECIPE_3_TO_2)
            && total_supply > 0
            && (self.supply[burn_element as usize] as u128 * 10_000) / total_supply as u128
                >= REFORGE_SHARE_MIN_BPS as u128
        {
            burn_count = 3;
            recipe = ALTAR_RECIPE_3_TO_2;
        }
        let mint_count: u64 = if recipe == ALTAR_RECIPE_3_TO_2 { 2 } else { 1 };

        // Starter-locked protection: only non-starter weapons may be burned.
        let weapons = self.weapon_inventory(&who);
        let starter = self.starter_of(&who);
        let non_starter = weapons[burn_element as usize].saturating_sub(starter[burn_element as usize]);
        if non_starter < burn_count {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }

        let burn_token = element_to_token_id(burn_element);
        let target_token = element_to_token_id(target_element);
        self.sub_token_balance(&who, burn_token, burn_count as u128);
        self.supply[burn_element as usize] = self.supply[burn_element as usize].saturating_sub(burn_count);
        self.supply[target_element as usize] += mint_count;
        self.add_token_balance(&who, target_token, mint_count as u128);
        events::log_reforge(&who, burn_token, target_token, burn_count, mint_count, recipe);
    }

    // ===================== combat =====================

    pub fn attack(&mut self, floor: u8, weapon_element: u8, stances: [u8; 3]) -> u32 {
        let who = env::predecessor_account_id();
        if !tower::valid_floor(floor) || weapon_element > 2 {
            panic!("{}", E_INVALID_ARGS);
        }
        for s in stances {
            if s > 2 {
                panic!("{}", E_INVALID_ARGS);
            }
        }
        if !self.floors[floor as usize].unlocked {
            panic!("{}", E_FLOOR_LOCKED);
        }
        let weapon = element_to_token_id(weapon_element);
        if self.token_balance(&who, weapon) == 0 {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }

        // Lazy epoch: shift resistance before the raid when the epoch changed.
        self.lazy_epoch();

        let now = env::block_timestamp();
        let i = floor as usize;

        // Floor deadline: on expiry the round is flushed — jackpot is carried into the
        // new round, damage is discarded, loot is carried.
        let fl = &mut self.floors[i];
        if fl.deadline_ns > 0 && fl.first_attack_ns != 0 && now > fl.first_attack_ns + fl.deadline_ns {
            let expired_round = fl.round;
            let carried = fl.jackpot;
            fl.round += 1;
            fl.total_damage = 0;
            fl.first_attack_ns = 0;
            fl.last_attack_ns = 0;
            fl.hp = fl.max_hp;
            events::log_round_expired(floor, expired_round, carried);
        }

        // Ticket: debited from the internal ledger and split 70/15/10/5.
        let ticket = self.floor_ticket_cost[i];
        self.ledger.debit(&who, ticket);
        let [to_jackpot, to_backer, to_buyback, to_merchant] = split_ticket(ticket);
        let fl = &mut self.floors[i];
        fl.buyback_reserve += to_buyback;
        if fl.backer_total_shares > 0 {
            let dpf = to_backer * DIVIDEND_SCALE / fl.backer_total_shares;
            fl.backer_acc_dividend_per_share += dpf;
            let credited = dpf * fl.backer_total_shares / DIVIDEND_SCALE;
            fl.dividend_pool += credited;
            fl.jackpot += to_jackpot + (to_backer - credited);
        } else {
            // No backers yet: the 15% backer slice flows into the jackpot.
            fl.jackpot += to_jackpot + to_backer;
        }
        self.merchant_cash_add(to_merchant);

        // Enrage (floor 3): heal before the raid, from the time since the last attack.
        let fl = &mut self.floors[i];
        if floor == ENRAGE_FLOOR && fl.last_attack_ns != 0 {
            let (hp, last_ns, _) = tower::calculate_enrage_heal(fl.hp, fl.max_hp, fl.last_attack_ns, now);
            fl.hp = hp;
            fl.last_attack_ns = last_ns;
        }

        // First attack of the round starts the deadline clock.
        let fl = &mut self.floors[i];
        if fl.first_attack_ns == 0 {
            fl.first_attack_ns = now;
            fl.last_attack_ns = now;
        }

        // Base effective resistance for this raid (with the Frost Ward bias on floor 2).
        let mut res_eff = self.resistance[weapon_element as usize];
        if floor == FROST_WARD_FLOOR && weapon_element == FROST_ELEMENT {
            res_eff = res_eff.saturating_add(FROST_WARD_BONUS_BPS);
        }

        // Three turns per attack; overkill is never recorded.
        let mut hp = self.floors[i].hp;
        let mut dealt: u32 = 0;
        // env::random_seed() returns bytes; fold the first 8 into a u64 raid seed.
        let rs = env::random_seed();
        let mut seed_bytes = [0u8; 8];
        seed_bytes.copy_from_slice(&rs[..8]);
        let raid_seed = u64::from_le_bytes(seed_bytes);
        for turn in 0..3u8 {
            let stance = stances[turn as usize];
            let seed = raid_seed ^ (turn as u64);
            let rand = tower::rand_bps_from_seed(seed, stance);
            // turn_damage applies the Pierce cut internally on the base resistance.
            let dmg = tower::turn_damage(res_eff, stance, rand);
            let recorded = dmg.min(hp);
            hp -= recorded;
            dealt += recorded;
        }

        let fl = &mut self.floors[i];
        fl.hp = hp;
        fl.total_damage += dealt as u128;
        fl.last_attack_ns = now;

        let key = (floor, fl.round, who.clone());
        let prev = self.damage.get(&key).copied().unwrap_or(0);
        self.damage.insert(key, prev + dealt as u128);

        // Boss Tribute: seize one non-starter weapon into the floor loot (supply keeps).
        let weapons = self.weapon_inventory(&who);
        let starter = self.starter_of(&who);
        let non_starter = weapons[weapon_element as usize].saturating_sub(starter[weapon_element as usize]);
        let total_weapons: u64 = weapons.iter().sum();
        let tribute_taken = tower::should_confiscate_tribute(res_eff, non_starter, total_weapons);
        if tribute_taken {
            self.sub_token_balance(&who, weapon, 1);
            self.floors[i].loot[weapon_element as usize] += 1;
            events::log_tribute_seized(&who, floor, self.floors[i].round, weapon_element);
        }

        events::log_raid(
            &who,
            floor,
            self.floors[i].round,
            weapon,
            dealt,
            self.floors[i].hp,
            ticket,
            tribute_taken,
        );

        if hp == 0 {
            self.settle_defeat(floor, who);
        }
        dealt
    }

    // ===================== claims =====================

    pub fn claim_payout(&mut self, floor: u8, round: u32) {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let who = env::predecessor_account_id();
        let key = (floor, round, who.clone());
        if self.claimed.get(&key).copied().unwrap_or(false) {
            panic!("{}", E_PAYOUT_CLAIMED);
        }
        let amount = self.try_claim(&who, floor, round);
        if amount == 0 {
            panic!("{}", E_NOTHING_TO_CLAIM);
        }
    }

    /// Claims every unclaimed completed round (with recorded damage) for the caller,
    /// most recent first, bounded to 20 payouts per call.
    pub fn claim_jackpot(&mut self) {
        let who = env::predecessor_account_id();
        let total_results = self.results_index.len() as u64;
        let start = total_results.saturating_sub(CLAIM_JACKPOT_SCAN_LIMIT);
        let mut claimed = 0;
        for idx in (start..total_results).rev() {
            if claimed >= CLAIM_JACKPOT_MAX_CLAIMS {
                break;
            }
            let Some((floor, round)) = self.results_index.get(idx as u32).copied() else {
                continue;
            };
            if self.try_claim(&who, floor, round) > 0 {
                claimed += 1;
            }
        }
        if claimed == 0 {
            panic!("{}", E_NOTHING_TO_CLAIM);
        }
    }

    // ===================== merchant bazaar =====================

    pub fn sell_to_merchant(&mut self, item: String, qty: u64) {
        let who = env::predecessor_account_id();
        if material_index(&item).is_none() || qty == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        if !merchant::is_merchant_open(self.merchant_cash) {
            panic!("{}", E_SHOP_CLOSED);
        }
        if self.material_balance(&who, &item) < qty {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }
        let stock = self.merchant_stock.get(&item).copied().unwrap_or(0);
        let unit_price = merchant::calculate_sell_price(stock, MERCHANT_BASE_PRICE, self.demand_avg(&item));
        let total = unit_price * qty as u128;
        if self.merchant_cash < total {
            panic!("{}", E_RESERVE_LOW);
        }
        self.sub_token_balance(&who, &item, qty as u128);
        self.merchant_stock.insert(item.clone(), stock + qty);
        self.merchant_cash_sub(total);
        self.ledger.credit(&who, total);
        events::log_merchant_trade(&who, "sell", &item, qty, total, stock + qty, self.merchant_cash);
    }

    pub fn buy_from_merchant(&mut self, item: String, qty: u64) {
        let who = env::predecessor_account_id();
        if material_index(&item).is_none() || qty == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        if !merchant::is_merchant_open(self.merchant_cash) {
            panic!("{}", E_SHOP_CLOSED);
        }
        let stock = self.merchant_stock.get(&item).copied().unwrap_or(0);
        if stock < qty {
            panic!("{}", E_OUT_OF_STOCK);
        }
        let used = self
            .merchant_epoch_buys
            .get(&(item.clone(), self.epoch))
            .copied()
            .unwrap_or(0);
        if used + qty > MERCHANT_CAP_PER_ITEM_EPOCH {
            panic!("{}", E_VOLUME_CAP);
        }
        let unit_price = merchant::calculate_buy_price(stock, MERCHANT_BASE_PRICE, self.demand_avg(&item));
        let total = unit_price * qty as u128;
        self.ledger.debit(&who, total);
        self.merchant_stock.insert(item.clone(), stock - qty);
        self.add_token_balance(&who, &item, qty as u128);
        self.merchant_cash_add(total);
        self.merchant_epoch_buys.insert((item.clone(), self.epoch), used + qty);
        events::log_merchant_trade(&who, "buy", &item, qty, total, stock - qty, self.merchant_cash);
    }

    // ===================== boss buyback =====================

    pub fn sell_to_boss_buyback(&mut self, floor: u8, element: u8, qty: u64) {
        let who = env::predecessor_account_id();
        if !tower::valid_floor(floor) || element > 2 || qty == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        if !self.floors[floor as usize].unlocked {
            panic!("{}", E_FLOOR_LOCKED);
        }
        // Only non-starter-locked weapons may be sold back to the boss.
        let weapons = self.weapon_inventory(&who);
        let starter = self.starter_of(&who);
        let non_starter = weapons[element as usize].saturating_sub(starter[element as usize]);
        if non_starter < qty {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }
        let i = floor as usize;
        let multiplier = self.buyback_multiplier_bps[i][element as usize];
        let unit_price = BUYBACK_BASE * multiplier as u128 / 10000;
        let total = unit_price * qty as u128;
        if self.floors[i].buyback_reserve < total {
            panic!("{}", E_RESERVE_LOW);
        }
        // Volume caps: 5 units per floor per epoch, 2 units per account per epoch.
        if self.floors[i].volume_buyback_epoch + qty > BUYBACK_MAX_PER_FLOOR_EPOCH {
            panic!("{}", E_VOLUME_CAP);
        }
        let used = self
            .buyback_account_epoch
            .get(&(floor, self.epoch, who.clone()))
            .copied()
            .unwrap_or(0);
        if used + qty > BUYBACK_MAX_PER_ACCOUNT_EPOCH {
            panic!("{}", E_VOLUME_CAP);
        }

        let weapon = element_to_token_id(element);
        self.sub_token_balance(&who, weapon, qty as u128);
        self.supply[element as usize] = self.supply[element as usize].saturating_sub(qty);
        self.floors[i].buyback_reserve -= total;
        self.floors[i].volume_buyback_epoch += qty;
        self.buyback_account_epoch.insert((floor, self.epoch, who.clone()), used + qty);
        self.ledger.credit(&who, total);
        // merchant_cash is intentionally untouched by buybacks.
        events::log_buyback(&who, floor, element, qty, unit_price, total);
    }

    // ===================== backer vault =====================

    #[payable]
    pub fn back_boss_vault(&mut self, floor: u8) {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let who = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        let shares = amount / BACKER_SHARE_UNIT;
        if shares == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        let i = floor as usize;
        let cycle = self.floors[i].backer_cycle;
        let acc = self.floors[i].backer_acc_dividend_per_share;
        let mut pos = self.backers.get(&(floor, who.clone())).cloned().unwrap_or_default();
        if pos.shares > 0 {
            // Weighted-average accumulator base so new shares only accrue new dividends.
            pos.dps_base = (pos.dps_base * pos.shares + acc * shares) / (pos.shares + shares);
        } else {
            pos.join_cycle = cycle;
            pos.dps_base = acc;
        }
        pos.shares += shares;
        self.backers.insert((floor, who.clone()), pos);
        self.floors[i].backer_total_shares += shares;
        self.floors[i].jackpot += amount;
        events::log_backer_staked(&who, floor, amount, shares, cycle);
    }

    pub fn claim_backer_dividend(&mut self, floor: u8, cycle: u64) {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let who = env::predecessor_account_id();
        let i = floor as usize;
        if cycle > self.floors[i].backer_cycle {
            panic!("{}", E_INVALID_ARGS);
        }
        let mut pos = self.backers.get(&(floor, who.clone())).cloned().unwrap_or_default();
        if pos.shares == 0 {
            panic!("{}", E_NOTHING_TO_CLAIM);
        }
        let acc = self.floors[i].backer_acc_dividend_per_share;
        let pending = pos.shares * (acc - pos.dps_base) / DIVIDEND_SCALE - pos.claimed_amount;
        if pending == 0 {
            panic!("{}", E_NOTHING_TO_CLAIM);
        }
        if self.floors[i].dividend_pool < pending {
            panic!("{}", E_RESERVE_LOW);
        }
        self.floors[i].dividend_pool -= pending;
        pos.claimed_amount += pending;
        pos.last_claimed_cycle = self.floors[i].backer_cycle;
        self.backers.insert((floor, who.clone()), pos);
        self.ledger.credit(&who, pending);
        events::log_dividend_claimed(&who, floor, pending, self.floors[i].backer_cycle);
    }

    // ===================== epoch / meta =====================

    pub fn update_meta(&mut self) {
        if !self.lazy_epoch() {
            panic!("{}", E_SAME_EPOCH);
        }
    }

    // ===================== AI gate =====================

    pub fn apply_ai_proposal(
        &mut self,
        floor: u8,
        proposal: AiProposal,
        chat_id: Option<String>,
        signature: Vec<u8>,
    ) {
        self.assert_relayer();
        let reject = |reason: &str| {
            events::log_ai_proposal_rejected(floor, reason);
            panic!("{}", reason);
        };

        // Values first (floor, multiplier bounds, altar whitelist, taunt length).
        if let Err(e) = tee::validate_ai_proposal_values(&proposal) {
            reject(e);
        }
        if proposal.floor != floor {
            reject(E_INVALID_PROPOSAL);
        }
        // Signature over the single canonical message with the pinned TEE key.
        if !tee::verify_ai_signature(&self.tee_public_key, &signature, &proposal) {
            reject(E_UNAUTHORIZED);
        }
        // Replay protection on the global nonce.
        if proposal.nonce <= self.last_ai_nonce {
            reject(E_REPLAY_DETECTED);
        }
        // Frequency: one applied proposal per floor per epoch.
        if let Some(prev) = self.ai_state.get(&floor).cloned() {
            if proposal.epoch <= prev.epoch {
                reject(E_SAME_EPOCH);
            }
        }
        // Per-epoch shift cap on the buyback multiplier change.
        let current = self.buyback_multiplier_bps[floor as usize];
        for e in 0..3usize {
            let delta = (proposal.buyback_multiplier_bps[e] as i64 - current[e] as i64).abs();
            if delta > MAX_SHIFT_BPS as i64 {
                reject(E_EXCEEDS_MAX_SHIFT);
            }
        }

        // Apply — the AI never touches resistance (supply-derived only).
        self.buyback_multiplier_bps[floor as usize] = proposal.buyback_multiplier_bps;
        self.last_altar_recipe = proposal.altar_recipe_id.clone();
        self.last_ai_nonce = proposal.nonce;
        self.ai_state.insert(
            floor,
            AiState {
                floor,
                epoch: proposal.epoch,
                nonce: proposal.nonce,
                buyback_multiplier_bps: proposal.buyback_multiplier_bps,
                altar_recipe_id: proposal.altar_recipe_id.clone().unwrap_or_default(),
                taunt: proposal.taunt.clone(),
                chat_id,
                signature_hex: hex_encode(&signature),
            },
        );
        events::log_ai_proposal_applied(
            floor,
            proposal.epoch,
            proposal.nonce,
            proposal.buyback_multiplier_bps,
            proposal.altar_recipe_id.as_deref().unwrap_or("none"),
        );
    }

    // ===================== views =====================

    pub fn get_meta(&self) -> MetaResponse {
        let now = env::block_timestamp();
        let next_epoch_in_ns = self
            .epoch_start_ns
            .saturating_add(EPOCH_DURATION_NS)
            .saturating_sub(now);
        let weak_element = (0..3usize)
            .min_by_key(|&i| self.supply[i])
            .unwrap_or(0) as u8;
        MetaResponse {
            epoch: self.epoch,
            resistance: self.resistance,
            next_epoch_in_ns,
            shifted_by: self.shifted_by,
            supply: self.supply,
            weak_element,
        }
    }

    pub fn get_floor(&self, floor: u8) -> FloorResponse {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        self.floor_response(floor)
    }

    pub fn get_tower(&self) -> TowerResponse {
        TowerResponse {
            floors: (0..FLOOR_COUNT).map(|f| self.floor_response(f)).collect(),
        }
    }

    pub fn get_balance(&self, account_id: AccountId) -> U128 {
        U128(self.ledger.balance(&account_id))
    }

    pub fn get_inventory(&self, account_id: AccountId) -> PlayerInventoryResponse {
        let weapons = self.weapon_inventory(&account_id);
        let starter_locked = self.starter_of(&account_id);
        let mut materials = HashMap::new();
        for item in MATERIAL_TOKENS {
            materials.insert(item.to_string(), self.material_balance(&account_id, item));
        }
        PlayerInventoryResponse {
            weapons,
            starter_locked,
            materials,
        }
    }

    pub fn get_supply(&self) -> [u64; 3] {
        self.supply
    }

    pub fn get_claimable(&self, account_id: AccountId, floor: u8, round: u32) -> U128 {
        if !tower::valid_floor(floor) {
            return U128(0);
        }
        if self
            .claimed
            .get(&(floor, round, account_id.clone()))
            .copied()
            .unwrap_or(false)
        {
            return U128(0);
        }
        let Some(r) = self.results.get(&(floor, round)) else {
            return U128(0);
        };
        let my_damage = self
            .damage
            .get(&(floor, round, account_id.clone()))
            .copied()
            .unwrap_or(0);
        if my_damage == 0 || r.total_damage == 0 {
            return U128(0);
        }
        let remaining = r.proportional_pool + r.last_bonus - r.paid;
        U128(compute_payout(r, my_damage, &account_id).min(remaining))
    }

    pub fn get_claimable_loot(&self, account_id: AccountId, floor: u8, round: u32) -> [u64; 3] {
        if !tower::valid_floor(floor) {
            return [0, 0, 0];
        }
        if self
            .claimed
            .get(&(floor, round, account_id.clone()))
            .copied()
            .unwrap_or(false)
        {
            return [0, 0, 0];
        }
        let Some(l) = self.loot_results.get(&(floor, round)) else {
            return [0, 0, 0];
        };
        let my_damage = self
            .damage
            .get(&(floor, round, account_id.clone()))
            .copied()
            .unwrap_or(0);
        if my_damage == 0 || l.total_damage == 0 {
            return [0, 0, 0];
        }
        let mut out = [0u64; 3];
        for e in 0..3usize {
            out[e] = l.pool[e] * my_damage as u64 / l.total_damage as u64;
            if account_id == l.last_attacker {
                out[e] += l.last_bonus[e];
            }
        }
        out
    }

    pub fn get_merchant(&self) -> MerchantResponse {
        let mut stock = HashMap::new();
        for item in MATERIAL_TOKENS {
            stock.insert(
                item.to_string(),
                self.merchant_stock.get(&item.to_string()).copied().unwrap_or(0),
            );
        }
        MerchantResponse {
            cash: self.merchant_cash,
            stock,
            is_open: merchant::is_merchant_open(self.merchant_cash),
        }
    }

    pub fn get_quote(&self, item: String, side: String, qty: u64) -> MerchantQuote {
        let mut quote = MerchantQuote {
            item_id: item.clone(),
            side: side.clone(),
            qty,
            unit_price: 0,
            total_price: 0,
            is_open: merchant::is_merchant_open(self.merchant_cash),
            reason: "ok".to_string(),
        };
        if material_index(&item).is_none() {
            quote.reason = "invalid_item".to_string();
            return quote;
        }
        if side != "buy" && side != "sell" {
            quote.reason = "invalid_side".to_string();
            return quote;
        }
        if !quote.is_open {
            quote.reason = "shop_closed".to_string();
            return quote;
        }
        let stock = self.merchant_stock.get(&item).copied().unwrap_or(0);
        let avg = self.demand_avg(&item);
        if side == "buy" {
            if stock < qty {
                quote.reason = "out_of_stock".to_string();
                return quote;
            }
            let used = self
                .merchant_epoch_buys
                .get(&(item.clone(), self.epoch))
                .copied()
                .unwrap_or(0);
            if used + qty > MERCHANT_CAP_PER_ITEM_EPOCH {
                quote.reason = "volume_cap".to_string();
                return quote;
            }
            let unit = merchant::calculate_buy_price(stock, MERCHANT_BASE_PRICE, avg);
            quote.unit_price = unit;
            quote.total_price = unit * qty as u128;
        } else {
            let unit = merchant::calculate_sell_price(stock, MERCHANT_BASE_PRICE, avg);
            quote.unit_price = unit;
            quote.total_price = unit * qty as u128;
            if self.merchant_cash < quote.total_price {
                quote.reason = "reserve_low".to_string();
                return quote;
            }
        }
        quote
    }

    pub fn get_buyback_quote(&self, floor: u8, element: u8) -> BuybackQuote {
        if !tower::valid_floor(floor) || element > 2 {
            panic!("{}", E_INVALID_ARGS);
        }
        let multiplier = self.buyback_multiplier_bps[floor as usize][element as usize];
        BuybackQuote {
            floor,
            element,
            unit_price: BUYBACK_BASE * multiplier as u128 / 10000,
            multiplier_bps: multiplier,
        }
    }

    pub fn get_ai_state(&self, floor: u8) -> Option<AiState> {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        self.ai_state.get(&floor).cloned()
    }

    pub fn get_backer(&self, floor: u8, account_id: AccountId) -> BackerResponse {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        let pos = self
            .backers
            .get(&(floor, account_id.clone()))
            .cloned()
            .unwrap_or_default();
        BackerResponse {
            floor,
            account_id,
            shares: pos.shares,
            current_cycle: self.floors[floor as usize].backer_cycle,
            join_cycle: pos.join_cycle,
            last_claimed_cycle: pos.last_claimed_cycle,
        }
    }

    pub fn get_damage(&self, account_id: AccountId, floor: u8, round: u32) -> U128 {
        if !tower::valid_floor(floor) {
            panic!("{}", E_INVALID_ARGS);
        }
        U128(
            self.damage
                .get(&(floor, round, account_id))
                .copied()
                .unwrap_or(0),
        )
    }

    // ===================== NEP-245-style multi-token =====================

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(self.token_balance(&account_id, &token_id))
    }

    /// Supply exists only for weapons; materials are never supplied.
    pub fn mt_supply(&self, token_id: String) -> U128 {
        match token_id_to_element(&token_id) {
            Some(e) => U128(self.supply[e as usize] as u128),
            None => U128(0),
        }
    }

    /// Weapons and materials are transferable; starter-locked weapons are not.
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, _memo: Option<String>) {
        let sender = env::predecessor_account_id();
        if sender == receiver_id || amount.0 == 0 {
            panic!("{}", E_INVALID_ARGS);
        }
        if let Some(e) = token_id_to_element(&token_id) {
            let starter = self.starter_of(&sender)[e as usize];
            let transferable =
                self.token_balance(&sender, &token_id).saturating_sub(starter as u128);
            if transferable < amount.0 {
                panic!("{}", E_INSUFFICIENT_ITEM);
            }
        } else if self.token_balance(&sender, &token_id) < amount.0 {
            panic!("{}", E_INSUFFICIENT_ITEM);
        }
        self.sub_token_balance(&sender, &token_id, amount.0);
        self.add_token_balance(&receiver_id, &token_id, amount.0);
    }

    // ===================== NEP-171 / NEP-177 trophy views =====================

    pub fn nft_token(&self, token_id: String) -> Option<Token> {
        self.nft_tokens.get(&token_id).cloned()
    }

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        nft::get_default_contract_metadata()
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.nft_total_supply as u128)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, NearToken};

    const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

    fn pk() -> PublicKey {
        let mut bytes = vec![0u8];
        bytes.extend_from_slice(&[7u8; 32]);
        PublicKey::try_from(bytes).unwrap()
    }

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    fn alice() -> AccountId {
        acc("alice.testnet")
    }

    fn bob() -> AccountId {
        acc("bob.testnet")
    }

    fn owner() -> AccountId {
        acc("owner.testnet")
    }

    fn relayer() -> AccountId {
        acc("relayer.testnet")
    }

    fn set_ctx(who: &AccountId, timestamp: u64, deposit: u128, seed: u64) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(acc("spire.testnet"))
            .predecessor_account_id(who.clone())
            .block_timestamp(timestamp)
            .random_seed([
                (seed & 0xff) as u8,
                ((seed >> 8) & 0xff) as u8,
                3,
                4,
                5,
                6,
                7,
                8,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
            ])
            .attached_deposit(NearToken::from_yoctonear(deposit));
        testing_env!(b.build());
    }

    fn fresh() -> Spire {
        set_ctx(&owner(), 1_000_000_000_000, 0, 1);
        Spire::new(owner(), relayer(), pk())
    }

    fn near_ts(base: u64, seconds: u64) -> u64 {
        base + seconds * 1_000_000_000
    }

    #[test]
    fn init_and_starter_kit() {
        let mut c = fresh();
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        c.claim_starter();
        let inv = c.get_inventory(alice());
        assert_eq!(inv.weapons, [4, 1, 0]);
        assert_eq!(inv.starter_locked, [4, 1, 0]);
        assert_eq!(inv.materials.get(TOKEN_ORE_IRON), Some(&4));
        assert_eq!(inv.materials.get(TOKEN_ESSENCE_SOLAR), Some(&3));
        assert_eq!(inv.materials.get(TOKEN_ESSENCE_FROST), Some(&3));
        assert_eq!(inv.materials.get(TOKEN_ESSENCE_VOID), Some(&3));
        // Starter weapons do not count toward supply.
        assert_eq!(c.get_supply(), [0, 0, 0]);
        // Floor 1 unlocked, floors 2 & 3 locked.
        assert!(c.get_floor(0).unlocked);
        assert!(!c.get_floor(1).unlocked);
        assert!(!c.get_floor(2).unlocked);
        assert_eq!(c.get_floor(0).max_hp as u32, FLOOR_MAX_HP[0]);
    }

    #[test]
    #[should_panic(expected = "E_ALREADY_CLAIMED")]
    fn starter_only_once() {
        let mut c = fresh();
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        c.claim_starter();
        c.claim_starter();
    }

    #[test]
    fn gather_cooldown_and_epoch_cap() {
        let mut c = fresh();
        let t0 = 1_000_000_000_000;
        set_ctx(&alice(), t0, 0, 1);
        c.claim_starter();
        c.gather(TOKEN_ORE_IRON.to_string());
        assert_eq!(c.material_balance(&alice(), TOKEN_ORE_IRON), 4 + 2);

        // Cooldown blocks an immediate second gather.
        set_ctx(&alice(), near_ts(t0, 10), 0, 1);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.gather(TOKEN_ORE_IRON.to_string())
        }));
        assert!(err.is_err());

        // After the cooldown it works, but the epoch cap (20 units) blocks further gathers.
        let mut t = near_ts(t0, 31);
        for _ in 0..9 {
            set_ctx(&alice(), t, 0, 1);
            c.gather(TOKEN_ORE_IRON.to_string());
            t = near_ts(t, 31);
        }
        assert_eq!(c.material_balance(&alice(), TOKEN_ORE_IRON), 6 + 18);
        set_ctx(&alice(), t, 0, 1);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.gather(TOKEN_ORE_IRON.to_string())
        }));
        assert!(err.is_err());
    }

    #[test]
    fn craft_weapon_recipe() {
        let mut c = fresh();
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        c.claim_starter();
        c.craft_weapon(0); // 2 ore + 3 essence:solar
        let inv = c.get_inventory(alice());
        assert_eq!(inv.weapons[0], 5); // 4 starter + 1 crafted
        assert_eq!(inv.materials.get(TOKEN_ORE_IRON), Some(&2));
        assert_eq!(inv.materials.get(TOKEN_ESSENCE_SOLAR), Some(&0));
        assert_eq!(c.get_supply(), [1, 0, 0]);
        assert_eq!(c.mt_supply(TOKEN_WEAPON_SOLAR.to_string()).0, 1);
        assert_eq!(c.mt_supply(TOKEN_ORE_IRON.to_string()).0, 0);
    }

    #[test]
    fn attack_defeats_floor_and_pays_out() {
        let mut c = fresh();
        let t0 = 1_000_000_000_000;
        set_ctx(&alice(), t0, 0, 1);
        c.claim_starter();
        // Fund the internal ledger for tickets.
        set_ctx(&alice(), t0, 10 * NEAR, 1);
        c.deposit();

        set_ctx(&alice(), t0, 0, 42);
        let mut attacks = 0;
        while c.results.get(&(0, 0)).is_none() {
            c.attack(0, 0, [0, 0, 0]);
            attacks += 1;
            assert!(attacks < 30, "floor 1 should fall within 30 attacks");
        }
        assert!(attacks > 0);

        // Floor reset into a new round; results recorded.
        let fl = c.get_floor(0);
        assert_eq!(fl.round, 1);
        assert_eq!(fl.hp as u32, FLOOR_MAX_HP[0]);
        // Sole attacker takes the whole payout pool.
        let claimable = c.get_claimable(alice(), 0, 0).0;
        assert!(claimable > 0);
        let before = c.get_balance(alice()).0;
        c.claim_payout(0, 0);
        let after = c.get_balance(alice()).0;
        assert_eq!(after - before, claimable);
        assert!(c.get_claimable(alice(), 0, 0).0 == 0);

        // Tickets split: 70% jackpot consumed at settlement; 10% hit the buyback reserve.
        assert!(c.get_floor(0).buyback_reserve > 0);
        assert_eq!(c.get_floor(0).total_damage, 0);

        // double claim is blocked
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.claim_payout(0, 0)));
        assert!(err.is_err());
    }

    #[test]
    fn floor_locking_and_unlocking() {
        let mut c = fresh();
        set_ctx(&alice(), 1_000_000_000_000, 10 * NEAR, 1);
        c.deposit();
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.attack(1, 0, [0, 0, 0])
        }));
        assert!(err.is_err(), "locked floor must reject attacks");

        // Owner can force-unlock for testing via direct state (only via defeat normally).
        set_ctx(&owner(), 1_000_000_000_000, 0, 1);
        c.floors[1].unlocked = true;
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        // no weapon of frost: E_INSUFFICIENT_ITEM
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.attack(1, 1, [0, 0, 0])
        }));
        assert!(err.is_err());
    }

    #[test]
    fn update_meta_lazy_epoch_shift() {
        let mut c = fresh();
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        c.claim_starter();
        c.craft_weapon(0); // supply [1,0,0]

        // Same epoch: E_SAME_EPOCH
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.update_meta()));
        assert!(err.is_err());

        // Two hours later the epoch rolled and resistance shifted toward the target.
        set_ctx(&alice(), 1_000_000_000_000 + 2 * EPOCH_DURATION_NS, 0, 1);
        c.update_meta();
        let meta = c.get_meta();
        assert_eq!(meta.epoch, 2);
        assert_eq!(meta.shifted_by, 1);
        assert_eq!(
            meta.resistance.iter().map(|&x| x as u32).sum::<u32>(),
            RESISTANCE_TOTAL_BPS
        );
        assert_ne!(meta.resistance, RESISTANCE_NEUTRAL);
        assert_eq!(meta.weak_element, 1); // frost & void tied at 0 → lowest index wins
    }

    #[test]
    fn merchant_buy_sell_flow() {
        let mut c = fresh();
        let t0 = 1_000_000_000_000;
        set_ctx(&owner(), t0, 2 * NEAR, 1);
        c.seed_merchant(TOKEN_ORE_IRON.to_string(), 100);
        assert!(c.get_merchant().is_open);
        assert_eq!(c.get_merchant().stock.get(TOKEN_ORE_IRON), Some(&100));

        set_ctx(&alice(), t0, 10 * NEAR, 1);
        c.deposit();
        let q = c.get_quote(TOKEN_ORE_IRON.to_string(), "buy".into(), 5);
        assert_eq!(q.reason, "ok");
        let before = c.get_balance(alice()).0;
        c.buy_from_merchant(TOKEN_ORE_IRON.to_string(), 5);
        assert_eq!(c.get_merchant().stock.get(TOKEN_ORE_IRON), Some(&95));
        assert!(c.get_balance(alice()).0 < before);
        assert_eq!(c.material_balance(&alice(), TOKEN_ORE_IRON), 5);

        // Sell back at the sell price (below mid).
        let q = c.get_quote(TOKEN_ORE_IRON.to_string(), "sell".into(), 5);
        assert_eq!(q.reason, "ok");
        let mid_before = c.get_balance(alice()).0;
        c.sell_to_merchant(TOKEN_ORE_IRON.to_string(), 5);
        assert!(c.get_balance(alice()).0 > mid_before);
        assert_eq!(c.get_merchant().stock.get(TOKEN_ORE_IRON), Some(&100));

        // Volume cap: 40 units per item per epoch.
        set_ctx(&alice(), t0, 0, 1);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.buy_from_merchant(TOKEN_ORE_IRON.to_string(), 41)
        }));
        assert!(err.is_err());
    }

    #[test]
    fn buyback_burns_weapons_and_pays_from_reserve() {
        let mut c = fresh();
        let t0 = 1_000_000_000_000;
        set_ctx(&alice(), t0, 0, 1);
        c.claim_starter();
        c.craft_weapon(0);
        set_ctx(&alice(), t0, 20 * NEAR, 7);
        c.deposit();

        set_ctx(&alice(), t0, 0, 7);
        // Raid repeatedly: each ticket puts 10% into the floor buyback reserve.
        for _ in 0..15 {
            if c.get_floor(0).buyback_reserve >= BUYBACK_BASE {
                break;
            }
            c.attack(0, 0, [0, 0, 0]);
        }
        assert!(c.get_floor(0).buyback_reserve >= BUYBACK_BASE);

        let supply_before = c.get_supply()[0];
        let bal_before = c.get_balance(alice()).0;
        c.sell_to_boss_buyback(0, 0, 1);
        assert_eq!(c.get_supply()[0], supply_before - 1);
        assert_eq!(c.get_balance(alice()).0 - bal_before, BUYBACK_BASE);
        // merchant cash untouched by buyback
        let inv = c.get_inventory(alice());
        assert_eq!(inv.weapons[0], 5 - 1);
    }

    #[test]
    fn backer_vault_dividends() {
        let mut c = fresh();
        let t0 = 1_000_000_000_000;
        // Bob backs floor 1 with 1 NEAR → 100 shares.
        set_ctx(&bob(), t0, NEAR, 1);
        c.back_boss_vault(0);
        let expected_shares = NEAR / BACKER_SHARE_UNIT;
        assert_eq!(c.get_backer(0, bob()).shares, expected_shares);
        assert_eq!(c.get_floor(0).jackpot, NEAR);

        // Alice raids; the 15% backer slice accrues to the dividend accumulator.
        set_ctx(&alice(), t0, 0, 1);
        c.claim_starter();
        set_ctx(&alice(), t0, 10 * NEAR, 3);
        c.deposit();
        set_ctx(&alice(), t0, 0, 3);
        c.attack(0, 0, [0, 0, 0]);

        let ticket = FLOOR_TICKET_COST[0];
        let to_backer = ticket * SPLIT_BACKER_BPS / 10000;
        let fl = &c.floors[0];
        assert_eq!(fl.dividend_pool, to_backer);

        set_ctx(&bob(), t0, 0, 1);
        let before = c.get_balance(bob()).0;
        c.claim_backer_dividend(0, 0);
        assert_eq!(c.get_balance(bob()).0 - before, to_backer);
        // capital is NOT returned
        assert_eq!(c.get_backer(0, bob()).shares, expected_shares);
    }

    #[test]
    fn ai_proposal_guards() {
        let mut c = fresh();
        let proposal = AiProposal {
            floor: 0,
            epoch: 5,
            buyback_multiplier_bps: [15000, 10000, 10000],
            altar_recipe_id: None,
            taunt: Some("the spire hungers".into()),
            nonce: 1,
        };

        // Non-relayer rejected.
        set_ctx(&alice(), 1_000_000_000_000, 0, 1);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.apply_ai_proposal(0, proposal.clone(), None, vec![0u8; 64])
        }));
        assert!(err.is_err());

        // Relayer, but invalid multiplier (< 10000) fails value validation before signing.
        set_ctx(&relayer(), 1_000_000_000_000, 0, 1);
        let mut bad = proposal.clone();
        bad.buyback_multiplier_bps = [9000, 10000, 10000];
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.apply_ai_proposal(0, bad, None, vec![0u8; 64])
        }));
        assert!(err.is_err());

        // Floor mismatch between argument and payload.
        let mut bad = proposal.clone();
        bad.floor = 1;
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.apply_ai_proposal(0, bad, None, vec![0u8; 64])
        }));
        assert!(err.is_err());
    }

    #[test]
    fn jackpot_split_invariants() {
        // split_ticket parts always sum to the ticket (dust assigned to the merchant slice).
        for &ticket in &[FLOOR_TICKET_COST[0], FLOOR_TICKET_COST[1], FLOOR_TICKET_COST[2], 12345u128] {
            let parts = split_ticket(ticket);
            assert_eq!(parts.iter().sum::<u128>(), ticket);
            assert_eq!(parts[0], ticket * SPLIT_JACKPOT_BPS / 10000);
            assert_eq!(parts[1], ticket * SPLIT_BACKER_BPS / 10000);
            assert_eq!(parts[2], ticket * SPLIT_BUYBACK_BPS / 10000);
            assert!(parts[3] >= ticket * SPLIT_MERCHANT_BPS / 10000);
        }
    }

    #[test]
    fn compute_payout_with_paid_tracking() {
        let r = RoundResult {
            proportional_pool: 9_000,
            last_bonus: 1_000,
            total_damage: 1_000,
            last_attacker: bob(),
            floor: 0,
            paid: 0,
        };
        assert_eq!(compute_payout(&r, 600, &alice()), 5_400);
        assert_eq!(compute_payout(&r, 400, &bob()), 4_600);
        assert_eq!(compute_payout(&r, 0, &acc("carol.testnet")), 0);
    }
}
