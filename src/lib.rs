use near_sdk::json_types::U128;
use near_sdk::near;

#[near(contract_state)]
pub struct Spire {
    boss_hp: u32,
    boss_max_hp: u32,
    jackpot: u128,
}

impl Default for Spire {
    fn default() -> Self {
        Self { boss_hp: 1000, boss_max_hp: 1000, jackpot: 0 }
    }
}

#[near]
impl Spire {
    pub fn get_boss_hp(&self) -> u32 {
        self.boss_hp
    }

    pub fn get_jackpot(&self) -> U128 {
        U128(self.jackpot)
    }

    pub fn attack(&mut self, damage: u32) -> u32 {
        self.boss_hp = self.boss_hp.saturating_sub(damage);
        if self.boss_hp == 0 {
            self.boss_hp = self.boss_max_hp;
        }
        self.boss_hp
    }
}
