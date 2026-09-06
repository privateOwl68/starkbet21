# Blackjack on Starknet — RFP / product spec

> Placeholder for the full RFP already written for this project.
> Paste or link the canonical spec here so Phases 2–8 stay aligned.

## Working title

`shoe` — shoe commitment is the core privacy / fairness primitive.

## Goals (summary)

- Private blackjack play on Starknet (encrypted card and stack notes).
- Provably fair shoe: commitment to shuffle, verifiable hole-card reveals.
- Gasless play via session keys + paymaster after buy-in.

## Open design questions (lock in Phase 2)

| Option | Pros | Cons | V1 recommendation |
|--------|------|------|-------------------|
| House-only seed + published commitment | Simple | House can grind favorable shoes | No |
| VRF-sourced seed | Closes grinding without player round-trip | Depends on VRF availability | **Yes — V1** |
| Commit–reveal joint seed (player + house) | Strongest fairness story | Extra round-trip; V2 complexity | Defer to V2 |

## Rules baseline (document decisions in Phase 1)

- Dealer: hit soft 17 (H17) vs stand soft 17 (S17) — **pick one and freeze**.
- Blackjack pays 3:2.
- Double after split: TBD in Phase 1 tests.
- Resplit aces / blackjack-after-split: TBD in Phase 1 tests.
- 5-card charlie: optional; only if Phase 1 tests include it.

## Deferred to V2

See `PLAN.md` §3.
