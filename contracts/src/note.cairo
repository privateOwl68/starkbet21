//! Encrypted note schema — Phase 3.
//! Spec first: docs/note-schema.md. Reuse STRK20 note primitive when available.

#[derive(Copy, Drop, Serde)]
pub struct CardNotePlaintext {
    pub rank: u8,
    pub suit: u8,
    pub hand_index: u8,
    pub shoe_id: felt252,
    pub recipient_channel_key: felt252,
    pub nonce: felt252,
}

#[derive(Copy, Drop, Serde)]
pub struct StackNotePlaintext {
    pub balance: u256,
    pub owner_channel_key: felt252,
    pub nonce: felt252,
}

/// Ciphertext blob placeholder — replace with real note encryption in Phase 3.
#[derive(Drop, Serde)]
pub struct EncryptedNote {
    pub ciphertext: Array<felt252>,
}

pub fn pack_card_note(note: CardNotePlaintext) -> Array<felt252> {
    // TODO(Phase 3): canonical felt packing matching TypeScript.
    let mut out = array![];
    out.append(note.rank.into());
    out.append(note.suit.into());
    out.append(note.hand_index.into());
    out.append(note.shoe_id);
    out.append(note.recipient_channel_key);
    out.append(note.nonce);
    out
}

pub fn encrypt_card_note(note: CardNotePlaintext, _channel_secret: felt252) -> EncryptedNote {
    // TODO(Phase 3): real AEAD / STRK20 note encrypt.
    EncryptedNote { ciphertext: pack_card_note(note) }
}
