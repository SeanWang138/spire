use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, AccountId, NearToken, Promise};

const BASE_POWER: u32 = 400;
const TICKET: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR

#[near(contract_state)]
pub struct Spire {
    boss_hp: u32,
    boss_max_hp: u32,
    supply: [u64; 2],
    inventory: LookupMap<AccountId, [u64; 2]>,
    balances: LookupMap<AccountId, u128>,
    damage: IterableMap<AccountId, u32>,
    jackpot: u128,
    reserve: u128,
}

impl Default for Spire {
    fn default() -> Self {
        Self {
            boss_hp: 1000,
            boss_max_hp: 1000,
            supply: [0, 0],
            inventory: LookupMap::new(b"i"),
            balances: LookupMap::new(b"b"),
            damage: IterableMap::new(b"d"),
            jackpot: 0,
            reserve: 0,
        }
    }
}

// Fungsi internal (tidak bisa dipanggil dari luar)
impl Spire {
    fn settle(&mut self, killer: AccountId) {
        let pool = self.jackpot;
        let bonus = pool / 10;
        let shared = pool - bonus;
        let entries: Vec<(AccountId, u32)> =
            self.damage.iter().map(|(k, v)| (k.clone(), *v)).collect();
        let total: u128 = entries.iter().map(|(_, d)| *d as u128).sum();
        let mut paid: u128 = 0;
        for (acc, d) in entries {
            let part = shared * (d as u128) / total;
            paid += part;
            let b = self.balances.get(&acc).copied().unwrap_or(0);
            self.balances.insert(acc, b + part);
        }
        let kb = self.balances.get(&killer).copied().unwrap_or(0);
        self.balances.insert(killer, kb + bonus);
        self.jackpot = pool - bonus - paid; // sisa pembulatan
        self.damage.clear();
        self.boss_hp = self.boss_max_hp;
    }
}

#[near]
impl Spire {
    // ---------- BACA (gratis) ----------
    pub fn get_boss_hp(&self) -> u32 {
        self.boss_hp
    }

    pub fn get_supply(&self) -> [u64; 2] {
        self.supply
    }

    pub fn get_jackpot(&self) -> U128 {
        U128(self.jackpot)
    }

    pub fn get_balance(&self, account_id: AccountId) -> U128 {
        U128(self.balances.get(&account_id).copied().unwrap_or(0))
    }

    pub fn get_damage(&self, account_id: AccountId) -> u32 {
        self.damage.get(&account_id).copied().unwrap_or(0)
    }

    pub fn get_inventory(&self, account_id: AccountId) -> [u64; 2] {
        self.inventory.get(&account_id).copied().unwrap_or([0, 0])
    }

    pub fn get_resistance(&self) -> [u32; 2] {
        let total = self.supply[0] + self.supply[1];
        let share0 = if total == 0 { 5000 } else { self.supply[0] * 10000 / total };
        let r0 = (share0 * 9000 / 10000).clamp(1000, 8000) as u32;
        [r0, 9000 - r0]
    }

    // ---------- UANG ----------
    #[payable]
    pub fn deposit(&mut self) {
        let who = env::predecessor_account_id();
        let amt = env::attached_deposit().as_yoctonear();
        assert!(amt > 0, "Kirim deposit");
        let b = self.balances.get(&who).copied().unwrap_or(0);
        self.balances.insert(who, b + amt);
    }

    #[payable]
    pub fn fund_jackpot(&mut self) {
        self.jackpot += env::attached_deposit().as_yoctonear();
    }

    pub fn withdraw(&mut self) -> Promise {
        let who = env::predecessor_account_id();
        let amt = self.balances.get(&who).copied().unwrap_or(0);
        assert!(amt > 0, "Saldo kosong");
        self.balances.insert(who.clone(), 0); // ubah data DULU, baru kirim uang
        Promise::new(who).transfer(NearToken::from_yoctonear(amt))
    }

    // ---------- GAME ----------
    pub fn claim_starter(&mut self) {
        let who = env::predecessor_account_id();
        assert!(self.inventory.get(&who).is_none(), "Starter sudah diklaim");
        self.inventory.insert(who, [4, 1]);
        self.supply[0] += 4;
        self.supply[1] += 1;
    }

    pub fn reforge(&mut self, burn_element: u8) {
        assert!(burn_element < 2, "Elemen tidak valid");
        let who = env::predecessor_account_id();
        let mut inv = *self.inventory.get(&who).expect("Klaim starter dulu");
        let b = burn_element as usize;
        let m = 1 - b;
        assert!(inv[b] >= 2, "Butuh minimal 2 senjata untuk reforge");
        inv[b] -= 2;
        inv[m] += 1;
        self.supply[b] -= 2;
        self.supply[m] += 1;
        self.inventory.insert(who, inv);
    }

    pub fn attack(&mut self, weapon: u8) -> u32 {
        assert!(weapon < 2, "Senjata tidak valid");
        let who = env::predecessor_account_id();
        let w = weapon as usize;
        let owned = self.inventory.get(&who).expect("Klaim starter dulu")[w];
        assert!(owned > 0, "Kamu tidak punya senjata ini");

        // bayar tiket
        let bal = self.balances.get(&who).copied().unwrap_or(0);
        assert!(bal >= TICKET, "Saldo kurang, deposit dulu");
        self.balances.insert(who.clone(), bal - TICKET);
        let to_jackpot = TICKET * 90 / 100;
        self.jackpot += to_jackpot;
        self.reserve += TICKET - to_jackpot;

        // hitung damage
        let res = self.get_resistance()[w];
        let dmg = (BASE_POWER * (10000 - res) / 10000).min(self.boss_hp);
        self.boss_hp -= dmg;
        let prev = self.damage.get(&who).copied().unwrap_or(0);
        self.damage.insert(who.clone(), prev + dmg);

        if self.boss_hp == 0 {
            self.settle(who);
        }
        self.boss_hp
    }
}
