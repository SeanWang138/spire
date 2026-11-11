use near_sdk::store::LookupMap;
use near_sdk::{near, AccountId};

#[near(serializers = [borsh])]
pub struct Ledger {
    balances: LookupMap<AccountId, u128>,
}

impl Ledger {
    pub fn new() -> Self {
        Self { balances: LookupMap::new(b"b") }
    }
    pub fn balance(&self, who: &AccountId) -> u128 {
        self.balances.get(who).copied().unwrap_or(0)
    }
    pub fn credit(&mut self, who: &AccountId, amount: u128) {
        let b = self.balance(who);
        self.balances.insert(who.clone(), b + amount);
    }
    pub fn debit(&mut self, who: &AccountId, amount: u128) {
        let b = self.balance(who);
        assert!(b >= amount, "E_INSUFFICIENT_BALANCE");
        self.balances.insert(who.clone(), b - amount);
    }
}