// SpireFi AI gate: canonical Ed25519 message format for AI proposals plus pure value
// validation. The contract stores the TEE public key from #[init]; there is no default key.
use crate::types::{
    AiProposal, ALTAR_RECIPE_2_TO_1, ALTAR_RECIPE_3_TO_2, BUYBACK_MAX_BPS, BUYBACK_MIN_BPS,
    E_INVALID_PROPOSAL, FLOOR_COUNT,
};
use near_sdk::{env, PublicKey};

pub const SIGNATURE_LEN: usize = 64;

pub fn extract_ed25519_key_bytes(pk: &PublicKey) -> [u8; 32] {
    let bytes = pk.as_bytes();
    if bytes[0] == 0 && bytes.len() == 33 {
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes[1..33]);
        key
    } else {
        panic!("E_NOT_ED25519_KEY");
    }
}

pub fn is_ed25519_key(pk: &PublicKey) -> bool {
    let bytes = pk.as_bytes();
    bytes[0] == 0 && bytes.len() == 33
}

/// The single canonical signed message (UTF-8):
/// "spire/floor={floor}/epoch={epoch}/buyback={m0}-{m1}-{m2}/recipe={recipe|none}/nonce={nonce}"
pub fn build_ai_message(p: &AiProposal) -> Vec<u8> {
    let recipe = p.altar_recipe_id.clone().unwrap_or_else(|| "none".to_string());
    format!(
        "spire/floor={}/epoch={}/buyback={}-{}-{}/recipe={}/nonce={}",
        p.floor, p.epoch, p.buyback_multiplier_bps[0], p.buyback_multiplier_bps[1],
        p.buyback_multiplier_bps[2], recipe, p.nonce
    )
    .into_bytes()
}

/// Verify an Ed25519 signature over the canonical message with the pinned TEE key.
pub fn verify_ai_signature(public_key: &PublicKey, signature: &[u8], proposal: &AiProposal) -> bool {
    if signature.len() != SIGNATURE_LEN {
        return false;
    }
    let mut sig = [0u8; 64];
    sig.copy_from_slice(signature);
    let pubkey = extract_ed25519_key_bytes(public_key);
    let msg = build_ai_message(proposal);
    env::ed25519_verify(&sig, &msg, &pubkey)
}

/// Pure value validation of a proposal (signature and epoch/nonce checks are the caller's).
pub fn validate_ai_proposal_values(proposal: &AiProposal) -> Result<(), &'static str> {
    if !valid_floor(proposal.floor) {
        return Err(E_INVALID_PROPOSAL);
    }
    for m in proposal.buyback_multiplier_bps {
        if !(BUYBACK_MIN_BPS..=BUYBACK_MAX_BPS).contains(&m) {
            return Err(E_INVALID_PROPOSAL);
        }
    }
    if let Some(recipe) = &proposal.altar_recipe_id {
        if recipe != ALTAR_RECIPE_2_TO_1 && recipe != ALTAR_RECIPE_3_TO_2 {
            return Err(E_INVALID_PROPOSAL);
        }
    }
    if let Some(taunt) = &proposal.taunt {
        if taunt.len() > 200 {
            return Err(E_INVALID_PROPOSAL);
        }
    }
    Ok(())
}

pub fn valid_floor(floor: u8) -> bool {
    floor < FLOOR_COUNT
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::E_INVALID_ARGS;
    use near_sdk::PublicKey;

    fn proposal() -> AiProposal {
        AiProposal {
            floor: 1,
            epoch: 7,
            buyback_multiplier_bps: [12000, 10000, 15000],
            altar_recipe_id: Some("reforge_3_to_2".to_string()),
            taunt: Some("hi".to_string()),
            nonce: 42,
        }
    }

    #[test]
    fn test_canonical_message_format() {
        let msg = String::from_utf8(build_ai_message(&proposal())).unwrap();
        assert_eq!(
            msg,
            "spire/floor=1/epoch=7/buyback=12000-10000-15000/recipe=reforge_3_to_2/nonce=42"
        );
    }

    #[test]
    fn test_canonical_message_recipe_none() {
        let mut p = proposal();
        p.altar_recipe_id = None;
        let msg = String::from_utf8(build_ai_message(&p)).unwrap();
        assert_eq!(
            msg,
            "spire/floor=1/epoch=7/buyback=12000-10000-15000/recipe=none/nonce=42"
        );
    }

    #[test]
    fn test_proposal_value_validation() {
        assert_eq!(validate_ai_proposal_values(&proposal()), Ok(()));

        let mut bad = proposal();
        bad.buyback_multiplier_bps[1] = 9999;
        assert_eq!(validate_ai_proposal_values(&bad), Err(E_INVALID_PROPOSAL));

        let mut bad = proposal();
        bad.buyback_multiplier_bps[2] = 40001;
        assert_eq!(validate_ai_proposal_values(&bad), Err(E_INVALID_PROPOSAL));

        let mut bad = proposal();
        bad.floor = 3;
        assert_eq!(validate_ai_proposal_values(&bad), Err(E_INVALID_PROPOSAL));

        let mut bad = proposal();
        bad.altar_recipe_id = Some("reforge_1_to_5".to_string());
        assert_eq!(validate_ai_proposal_values(&bad), Err(E_INVALID_PROPOSAL));

        let mut bad = proposal();
        bad.taunt = Some("x".repeat(201));
        assert_eq!(validate_ai_proposal_values(&bad), Err(E_INVALID_PROPOSAL));

        let mut ok = proposal();
        ok.taunt = Some("x".repeat(200));
        assert_eq!(validate_ai_proposal_values(&ok), Ok(()));
    }

    #[test]
    fn test_ed25519_key_checks() {
        let mut full = vec![0u8]; // 0 = Ed25519 curve id
        full.extend_from_slice(&[7u8; 32]);
        let pk = PublicKey::try_from(full).unwrap();
        assert!(is_ed25519_key(&pk));
        let sig = vec![0u8; 63]; // wrong length
        assert!(!verify_ai_signature(&pk, &sig, &proposal()));
        assert!(!verify_ai_signature(&pk, &[0u8; 64], &proposal()));
    }

    #[test]
    fn key_constants_present() {
        // Keep the whitelist names stable — the relayer builds payloads against them.
        assert_eq!(ALTAR_RECIPE_2_TO_1, "reforge_2_to_1");
        assert_eq!(ALTAR_RECIPE_3_TO_2, "reforge_3_to_2");
        assert_eq!(E_INVALID_ARGS, "E_INVALID_ARGS");
    }
}
