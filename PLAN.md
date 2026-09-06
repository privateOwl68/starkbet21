# Private Blackjack on Starknet — Build Plan

Working title: `shoe` (shoe commitment is the core primitive — rename freely).

## 0. Repo shape

```
shoe/
├── contracts/                 # Cairo, Scarb workspace
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── blackjack_game.cairo      # BlackjackGame contract, privacy_invoke entrypoints
│   │   ├── shoe.cairo                 # shoe commitment, seed derivation, card draw logic
│   │   ├── note.cairo                 # encrypted note schema (card notes, stack notes)
│   │   ├── hand.cairo                 # hand value scoring, split-hand bookkeeping
│   │   ├── settlement.cairo           # payout math (3:2 blackjack, insurance, splits, doubles)
│   │   └── interfaces.cairo
│   ├── tests/
│   │   ├── test_shoe.cairo            # shuffle commitment + reveal proofs
│   │   ├── test_hand.cairo            # scoring edge cases (soft 17, aces, splits)
│   │   └── test_settlement.cairo
│   ├── Scarb.toml
│   └── snfoundry.toml
├── prover/                    # off-chain proof generation for shoe/hole-card consistency
│   ├── src/
│   │   ├── shuffle_prove.rs           # or Cairo0/Stwo, per V1 seed model decision
│   │   └── reveal_prove.rs
│   └── Cargo.toml
├── app/                        # frontend
│   ├── src/
│   │   ├── lib/starknet.ts           # provider, account, session key setup
│   │   ├── lib/notes.ts              # note decryption, channel key handling
│   │   ├── lib/paymaster.ts
│   │   ├── components/Table.tsx
│   │   ├── components/HandView.tsx
│   │   └── pages/
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── deploy.ts
│   └── open_shoe.ts
├── docs/
│   ├── blackjack-starknet-rfp.md      # the spec we already wrote
│   ├── note-schema.md
│   └── shoe-commitment-spec.md
├── skillsRequired.md
└── PLAN.md
```

Open this whole tree as the Cursor workspace root so it can see contracts,
prover, and app together — most of the hard bugs in this project are at the
boundaries between them (note encoding mismatches, felt252 packing, ABI
drift), and Cursor is much more useful with full cross-package visibility.

## 1. Build order (do not build front-to-back — build bottom-up)

### Phase 1 — Hand logic, no privacy, no chain (1–2 days)
Get blackjack *rules* correct first, in isolation, before touching Cairo or
crypto. Write `hand.cairo`'s scoring logic as pure functions and test them
hard: soft/hard totals, ace re-valuation, blackjack vs. 21-after-split,
double-after-split rules, dealer hit-on-soft-17 vs stand-on-soft-17
(pick one and document it), bust detection, push conditions. This is the
part most teams get subtly wrong and it's cheap to get right early with
plain unit tests.

**Exit criteria:** `test_hand.cairo` passes ~30+ cases including all the
weird ones (A-A split into two blackjacks, 5-card charlie if you're
supporting it, etc).

### Phase 2 — Shoe commitment + card draw, no encryption yet (2–3 days)
Implement `shoe.cairo`: given a seed, deterministically produce a shuffled
52-card (or N-deck) order; commit to it with a hash; support "draw next
card" as a pure index-into-committed-order operation. Prove to yourself the
commitment scheme is sound before adding encryption on top — test that two
different seeds never produce the same commitment, that draw order is
stable, that you can open any single card against the commitment cheaply.

Decide the V1 seed model now (see RFP "open design questions"): house-only
seed with published commitment, vs. VRF-sourced, vs. commit-reveal joint
seed with the player. This decision changes the prover work in Phase 4, so
lock it before moving on. Recommendation: VRF-sourced for V1 — closes the
"house grinds for a favorable shoe" gap without the joint-commit-reveal
round-trip complexity of full V2.

**Exit criteria:** can open a shoe, draw a deterministic sequence, and
verify any single draw against the commitment.

### Phase 3 — Note encoding for cards and stacks (2–3 days)
Define the encrypted note schema (`note.cairo`, write it up in
`docs/note-schema.md` before coding). A card note needs: card value, suit,
hand index (for splits), round/shoe id, recipient channel key, nonce. A
stack note needs: balance, owner channel key, nonce. Decide encryption
scheme (likely whatever STRK20's existing note primitive uses — reuse it,
don't reinvent). Get encrypt/decrypt round-tripping correctly in both
Cairo (on-chain commitment/verification side) and TypeScript (client
decrypt side) before wiring them into the game contract.

**Exit criteria:** a card dealt on a local devnet can be decrypted
client-side by the intended recipient and by no one else; a second wallet
cannot decrypt it.

### Phase 4 — `BlackjackGame` contract + `privacy_invoke` entrypoints (3–5 days)
Now assemble `blackjack_game.cairo`: `deal`, `hit`, `stand`, `double`,
`split`, `insurance`, `settle`, calling into `shoe.cairo`, `note.cairo`,
`hand.cairo`, `settlement.cairo`. This is the integration phase — most of
the design work is already done, this is wiring plus getting Cairo's
storage/access-control right (who can call `hit` on which hand, replay
protection, round state machine).

**Exit criteria:** a full round playable via raw contract calls (no
frontend, no paymaster yet) from a test script — buy in, deal, hit to
bust, settle, payout.

### Phase 5 — Hole-card reveal proof (2–4 days)
Implement the STARK proof (or, for a fast V0, a simpler cryptographic
commitment-opening check if full proving is too slow to iterate on early)
that the revealed hole card matches the shoe commitment from Phase 2. Wire
this into `settle`. This is the "cheating is mathematically impossible"
claim made real — don't skip it or fake it even for a demo, since it's the
whole point of the project.

**Exit criteria:** an attempted hole-card substitution (mutate the note
before reveal in a test) is rejected by settlement.

### Phase 6 — Session keys + paymaster (2–3 days)
Wire session-key signing so a player approves once and plays a whole shoe
without re-signing every action, scoped so the session key can only call
game actions (not withdraw the shielded stack). Wire paymaster submission
for gasless hit/stand.

**Exit criteria:** play a full shoe from the frontend with one wallet
signature at buy-in and zero further signature prompts.

### Phase 7 — Frontend (parallel-izable with Phases 4–6 once Phase 3 is done)
Table view, hand view, bet controls, action buttons, note decrypt/display,
shoe commitment display (so the "provably fair" claim is visible and
checkable in the UI, not just true in the contract).

### Phase 8 — Testnet deploy, audit pass, public shoe verifier
Deploy to Starknet Sepolia. Ship a small standalone page/script that lets
anyone paste a shoe id and independently re-verify the shuffle commitment
and every hole-card reveal for that shoe from public data — this is the
actual deliverable of "provably fair," not the game itself.

## 2. Sequencing note for Cursor sessions

Work one phase at a time in separate focused sessions/branches — the
crypto and Cairo pieces (Phases 2, 3, 5) benefit from tight edit-test loops
with `snforge test` running constantly, while the frontend (Phase 7)
benefits from a running local devnet + deployed contracts to point at.
Don't mix "writing Cairo" sessions with "writing React" sessions; the
context switch costs more than it saves.

## 3. What to defer to V2 (don't build now)

- Joint/commit-reveal seed generation (V1 ships VRF-only).
- Multi-table / tournament structure.
- Full mental-poker-style Noir+Garaga proving (that's the poker roadmap,
  not blackjack's — blackjack's single-dealer model doesn't need it).
- Leaderboards / selective-disclosure proof-of-result UI polish.

**Update:** Wager War V1 (volume leaderboard + XP/badges) is implemented —
see `contracts/src/wager_war.cairo` and the app **Wager War** tab. Token prize
pools remain deferred.

See `skillsRequired.md` for what you (or collaborators) need to know to
execute each phase — including the STRK20 agent skills from
[odinfree/strk20-skills](https://github.com/odinfree/strk20-skills)
(`strk20-privacy`, `strk20-wallet-api`, `strk20-anonymizer-contracts`,
`strk20-privacy-sdk`).
