# Note schema

> Write this **before** coding `note.cairo` (Phase 3). Keep Cairo and TypeScript encodings identical.

## Card note

| Field | Type (logical) | Notes |
|-------|----------------|-------|
| `value` | rank 1–13 | Ace=1 … King=13 (or chosen enum) |
| `suit` | 0–3 | clubs/diamonds/hearts/spades |
| `hand_index` | u8 | Split bookkeeping (0 = primary) |
| `round_id` / `shoe_id` | felt | Ties card to committed shoe |
| `recipient_channel_key` | felt / pubkey | Intended decryptor |
| `nonce` | felt | Freshness / uniqueness |

## Stack note

| Field | Type (logical) | Notes |
|-------|----------------|-------|
| `balance` | u256 / felt | Shielded chips |
| `owner_channel_key` | felt / pubkey | Owner decryptor |
| `nonce` | felt | Freshness / uniqueness |

## Encryption

- Prefer reusing the STRK20 (or chosen privacy stack) note primitive — do not invent a new scheme.
- Document: KDF, AEAD/cipher, associated data, felt packing order, endianness.
- Round-trip tests: Cairo commitment/verify side + TypeScript client decrypt; wrong wallet must fail.

## Encoding checklist

- [ ] Field order frozen
- [ ] Felt packing specified (bit widths)
- [ ] Shared fixture vectors (hex) for Cairo + TS
- [ ] Wrong-key decrypt fails in app tests
