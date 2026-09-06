//! Prove hole-card reveal matches shoe commitment at index.

/// Placeholder: reveal proof for card at `index`.
pub fn prove_reveal(commitment: &[u8], index: u32, card: u8) -> Vec<u8> {
    let _ = (commitment, index, card);
    // TODO(Phase 5): STARK or commitment-opening proof
    vec![]
}

/// Local check used by tests before on-chain verifier exists.
pub fn verify_reveal_local(commitment: &[u8], index: u32, card: u8, proof: &[u8]) -> bool {
    let _ = (commitment, index, card, proof);
    // TODO(Phase 5)
    false
}
