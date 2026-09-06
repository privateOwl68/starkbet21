# Shoe commitment specification

> Lock the V1 seed model here before Phase 4 prover work. Recommendation: **VRF-sourced**.

## Model (V1)

1. House requests / observes a VRF output `seed`.
2. Deterministic shuffle (Fisher–Yates) over `N` decks × 52 cards from `seed`.
3. Publish `commitment = H(ordered_cards || domain_separator)`.
4. Draws are `ordered_cards[draw_index]` — pure index into the committed order.
5. Hole-card reveal at settle opens the committed card at that index (Phase 5 proof).

## Properties to test (Phase 2)

- Same seed → identical order and commitment.
- Distinct seeds → distinct commitments (no trivial collisions in test corpus).
- Draw sequence stable across callers.
- Single-card opening verifies against commitment cheaply (Merkle or positional hash — choose and document).

## Opening a card

Document the exact opening proof format:

- Index `i`, card `c`, proof π such that Verify(commitment, i, c, π) = true.
- Settlement rejects substituted `c'` for the same `i`.

## Out of scope (V2)

- Joint commit–reveal seed with the player.
- Multi-table / shared shoes across tables.
