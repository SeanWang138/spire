use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId};

const BASE_POWER: u32 = 400;

#[near(contract_state)]
pub struct Spire {
    boss_hp: u32,
    boss_max_hp: u32,
    supply: [u64; 2], // [Solar, Frost]
    inventory: LookupMap<AccountId, [u64; 2]>,
}

impl Default for Spire {
    fn default() -> Self {
        Self {
            boss_hp: 1000,
            boss_max_hp: 1000,
            supply: [0, 0],
            inventory: LookupMap::new(b"i"),
        }
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

    pub fn get_inventory(&self, account_id: AccountId) -> [u64; 2] {
        self.inventory.get(&account_id).copied().unwrap_or([0, 0])
    }

    // Resistensi Boss (basis points: 10000 = 100%). Total selalu 9000.
    pub fn get_resistance(&self) -> [u32; 2] {
        let total = self.supply[0] + self.supply[1];
        let share0 = if total == 0 { 5000 } else { self.supply[0] * 10000 / total };
        let r0 = (share0 * 9000 / 10000).clamp(1000, 8000) as u32;
        [r0, 9000 - r0]
    }

    // ---------- TULIS ----------
    pub fn claim_starter(&mut self) {
        let who = env::predecessor_account_id();
        assert!(self.inventory.get(&who).is_none(), "Starter sudah diklaim");
        self.inventory.insert(who, [4, 1]);
        self.supply[0] += 4;
        self.supply[1] += 1;
    }

    // Bakar 2 senjata yang banjir, dapat 1 senjata elemen lain
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

        let res = self.get_resistance()[w];
        let damage = BASE_POWER * (10000 - res) / 10000;

        self.boss_hp = self.boss_hp.saturating_sub(damage);
        if self.boss_hp == 0 {
            self.boss_hp = self.boss_max_hp;
        }
        self.boss_hp
    }
}
