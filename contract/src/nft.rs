// SpireFi dynamic trophy NFT (NEP-171 / NEP-177 metadata). Minted when the Floor 3
// boss falls. Token & metadata structures follow the NEP-171 metadata example.
use near_sdk::AccountId;
use near_sdk::near;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<u64>,
    pub expires_at: Option<u64>,
    pub starts_at: Option<u64>,
    pub updated_at: Option<u64>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

pub fn generate_trophy_svg(
    round: u32,
    floor: u8,
    killer: &AccountId,
    jackpot_yocto: u128,
    resistance: [u32; 3],
    total_damage: u128,
) -> String {
    let jackpot_near = jackpot_yocto / 1_000_000_000_000_000_000_000_000;
    let jackpot_rem =
        (jackpot_yocto % 1_000_000_000_000_000_000_000_000) / 10_000_000_000_000_000_000;

    let svg = format!(
        r###"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="500" height="500" rx="20" fill="url(#bg)"/>
  <rect x="15" y="15" width="470" height="470" rx="14" fill="none" stroke="url(#neon)" stroke-width="2" opacity="0.6"/>
  <rect x="25" y="25" width="450" height="450" rx="10" fill="none" stroke="#334155" stroke-width="1"/>

  <!-- SpireFi Emblem -->
  <polygon points="250,60 290,140 210,140" fill="url(#gold)" filter="url(#glow)"/>
  <polygon points="250,75 280,135 220,135" fill="#090d16"/>
  <circle cx="250" cy="115" r="8" fill="url(#neon)"/>

  <!-- Header -->
  <text x="250" y="180" font-family="sans-serif" font-size="22" font-weight="bold" fill="url(#gold)" text-anchor="middle" letter-spacing="3">SPIREFI CONQUEROR</text>
  <text x="250" y="205" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle" letter-spacing="1.5">FLOOR {floor} CLEARED • ROUND {round}</text>

  <!-- Divider -->
  <line x1="80" y1="225" x2="420" y2="225" stroke="#334155" stroke-width="1.5"/>

  <!-- Conqueror Info -->
  <text x="90" y="260" font-family="sans-serif" font-size="12" fill="#64748b">CONQUEROR</text>
  <text x="90" y="285" font-family="monospace" font-size="15" font-weight="bold" fill="#f8fafc">{killer}</text>

  <!-- Stats Grid -->
  <text x="90" y="325" font-family="sans-serif" font-size="12" fill="#64748b">JACKPOT WON</text>
  <text x="90" y="348" font-family="monospace" font-size="16" font-weight="bold" fill="#38bdf8">{jackpot_near}.{jackpot_rem:02} NEAR</text>

  <text x="280" y="325" font-family="sans-serif" font-size="12" fill="#64748b">TOTAL RAID DAMAGE</text>
  <text x="280" y="348" font-family="monospace" font-size="16" font-weight="bold" fill="#f43f5e">{total_damage}</text>

  <!-- Resistance Radar Summary -->
  <text x="90" y="390" font-family="sans-serif" font-size="12" fill="#64748b">FINAL BOSS RESISTANCE</text>
  <rect x="90" y="405" width="95" height="28" rx="6" fill="#1e293b"/>
  <text x="137" y="424" font-family="sans-serif" font-size="11" font-weight="bold" fill="#f59e0b" text-anchor="middle">SOLAR {r0}</text>

  <rect x="202" y="405" width="95" height="28" rx="6" fill="#1e293b"/>
  <text x="249" y="424" font-family="sans-serif" font-size="11" font-weight="bold" fill="#38bdf8" text-anchor="middle">FROST {r1}</text>

  <rect x="315" y="405" width="95" height="28" rx="6" fill="#1e293b"/>
  <text x="362" y="424" font-family="sans-serif" font-size="11" font-weight="bold" fill="#c084fc" text-anchor="middle">VOID {r2}</text>

  <!-- Footer -->
  <text x="250" y="465" font-family="sans-serif" font-size="10" fill="#475569" text-anchor="middle">SPIREFI PROTOCOL • NEP-171/177</text>
</svg>"###,
        floor = floor,
        round = round,
        killer = killer,
        jackpot_near = jackpot_near,
        jackpot_rem = jackpot_rem,
        total_damage = total_damage,
        r0 = resistance[0],
        r1 = resistance[1],
        r2 = resistance[2],
    );

    format!("data:image/svg+xml;utf8,{}", svg)
}

pub fn create_trophy_token(
    round: u32,
    floor: u8,
    killer: &AccountId,
    jackpot_yocto: u128,
    resistance: [u32; 3],
    total_damage: u128,
    block_timestamp: u64,
) -> Token {
    let token_id = format!("spirefi-trophy-r{}-f{}", round, floor);
    let svg_data = generate_trophy_svg(round, floor, killer, jackpot_yocto, resistance, total_damage);

    let metadata = TokenMetadata {
        title: Some(format!("SpireFi Trophy - Floor {} Round {}", floor, round)),
        description: Some(format!(
            "Conquest trophy awarded to {} for conquering Floor {} of SpireFi in Round {}.",
            killer, floor, round
        )),
        media: Some(svg_data),
        media_hash: None,
        copies: Some(1),
        issued_at: Some(block_timestamp),
        expires_at: None,
        starts_at: None,
        updated_at: None,
        extra: None,
        reference: None,
        reference_hash: None,
    };

    Token {
        token_id,
        owner_id: killer.clone(),
        metadata: Some(metadata),
    }
}

pub fn get_default_contract_metadata() -> NFTContractMetadata {
    NFTContractMetadata {
        spec: "nft-1.0.0".to_string(),
        name: "SpireFi Trophy".to_string(),
        symbol: "SPIRE".to_string(),
        icon: None,
        base_uri: None,
        reference: None,
        reference_hash: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    #[test]
    fn test_svg_generation() {
        let svg = generate_trophy_svg(
            1,
            3,
            &acc("alice.testnet"),
            2_500_000_000_000_000_000_000_000,
            [8500, 3114, 1886],
            5000,
        );
        assert!(svg.starts_with("data:image/svg+xml;utf8,<svg"));
        assert!(svg.contains("alice.testnet"));
        assert!(svg.contains("FLOOR 3"));
        assert!(svg.contains("ROUND 1"));
        assert!(svg.contains("SOLAR 8500"));
        assert!(svg.contains("FROST 3114"));
        assert!(svg.contains("VOID 1886"));
        assert!(svg.contains("SPIREFI PROTOCOL • NEP-171/177"));
        assert!(!svg.contains("BOSSVAULT"));
    }

    #[test]
    fn test_token_creation() {
        let token = create_trophy_token(
            2,
            3,
            &acc("bob.testnet"),
            1_000_000_000_000_000_000_000_000,
            [4500, 4500, 4500],
            5000,
            123456789,
        );
        assert_eq!(token.token_id, "spirefi-trophy-r2-f3");
        assert_eq!(token.owner_id, acc("bob.testnet"));
        let meta = token.metadata.unwrap();
        assert_eq!(meta.issued_at, Some(123456789));
        assert!(meta.title.as_ref().unwrap().starts_with("SpireFi Trophy"));
        assert!(meta.media.unwrap().contains("bob.testnet"));
    }

    #[test]
    fn test_contract_metadata() {
        let meta = get_default_contract_metadata();
        assert_eq!(meta.name, "SpireFi Trophy");
        assert_eq!(meta.spec, "nft-1.0.0");
    }
}
