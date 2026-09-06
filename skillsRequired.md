# Skills required by phase

What you (or collaborators / the coding agent) need to know to execute each
phase of `PLAN.md`. Depth matters more than breadth — each phase has a primary
skill bottleneck.

## Install STRK20 agent skills first

Privacy work (Phases 3–4, 6–8) must reuse STRK20’s note / `privacy_invoke` /
Wallet API stack — do not invent a parallel crypto layer.

**Installed in this repo** under `.agents/skills/` (from
[odinfree/strk20-skills](https://github.com/odinfree/strk20-skills)):

- `.agents/skills/strk20-privacy/`
- `.agents/skills/strk20-wallet-api/`
- `.agents/skills/strk20-anonymizer-contracts/`
- `.agents/skills/strk20-privacy-sdk/`

Refresh from upstream when facts move:

```sh
git clone --depth 1 https://github.com/odinfree/strk20-skills /tmp/strk20-skills
cp -R /tmp/strk20-skills/skills/* .agents/skills/
rm -rf /tmp/strk20-skills
# or: npx skills add odinfree/strk20-skills
```

Optional but complementary — official integration planner (scans repo, writes
`STRK20_INTEGRATION_PLAN.md`; does not write Cairo or touch keys):

```sh
npx skills add starkience/strk20-agent-skills
```

Live docs: [strk20-by-example.org](https://strk20-by-example.org) (append `.md`
to any page for raw Markdown; full dump at `/llms-full.txt`).

### STRK20 skill map (use these by name)

| Skill | Use for |
| --- | --- |
| `strk20-privacy` | Route choice, notes/nullifiers/channels/viewing keys, hidden vs public, compliance |
| `strk20-wallet-api` | Player-facing TS/React: shield, transfers, `strk20InvokeTransaction`, open notes, paymaster UX |
| `strk20-anonymizer-contracts` | Cairo `privacy_invoke` helper for `BlackjackGame` (balance-delta idiom, open-note credit) |
| `strk20-privacy-sdk` | House/backend that holds keys, proving submission (`provingBlockId`, `proofFacts`, tip), shadow accounts |

**Route for this project (default):** Wallet API for the player dapp + an
anonymizer-style `privacy_invoke` contract for game actions. House/oracle/
prover backends that hold viewing keys take the Privacy SDK skill. Read
`strk20-privacy` before coding Phase 3+.

---

## Phase 1 — Hand logic

**Agent skills:** none STRK20 (pure rules).

- Blackjack rules fluency (soft/hard totals, splits, doubles, insurance, dealer S17/H17)
- Pure-function design: no storage, no privacy — score hands as data in / value out
- Cairo basics: `felt252`, arrays/spans, enums, unit tests with `snforge`
- Edge-case test design (A-A splits, blackjack vs 21-after-split, bust, push)

## Phase 2 — Shoe commitment

**Agent skills:** none STRK20 (fairness primitive is ours). Keep commitment
math separate from pool notes.

- Deterministic PRNG / Fisher–Yates from a seed (Cairo or shared reference impl)
- Commitment schemes: hash ordered shoe, open single positions cheaply
- Collision / grinding threat models (why VRF-sourced seed for V1)
- Starknet VRF (or chosen oracle) integration surface for seed sourcing
- Property tests: same seed → same order; different seeds → different commitments

## Phase 3 — Note encoding

**Agent skills:** `strk20-privacy` (required), then `strk20-wallet-api` and/or
`strk20-privacy-sdk` for encrypt/decrypt round-trips on the client or house side.

- STRK20 note mental model: encrypted notes, open notes, nullifiers, channels,
  viewing keys, ECDH channel secrets — **reuse the pool primitive, do not reinvent**
- Map card notes / stack notes in `docs/note-schema.md` onto STRK20 note fields
  (owner, token/amount or app payload, salt ≥ 2 for encrypted; open notes where
  settlement needs a public credit slot)
- Felt packing / ABI layout that matches Cairo and TypeScript bit-for-bit
- Wrong-key / wrong-wallet decrypt must fail; never ask a normal player for
  their viewing key (Wallet API route)
- Fixture vectors shared across Cairo + TS before wiring the game contract

## Phase 4 — BlackjackGame + privacy_invoke

**Agent skills:** `strk20-anonymizer-contracts` (required), `strk20-privacy`
(route + visibility), `strk20-wallet-api` (two-action open-note + invoke pattern).

- Cairo anonymizer / helper anatomy: `privacy_invoke`, approve-not-transfer,
  balance-delta idiom, open-note deposits returned to the pool
- Calldata order must match `privacy_invoke` parameters exactly (pool
  deserializes straight into them)
- Round state machine, access control, replay protection, who-may-act-on-which-hand
- Compose `shoe`, `note`, `hand`, `settlement` without leaking private state
  beyond what STRK20 already makes public (deposits, withdrawals, open-note
  amounts, timing)
- snforge / Sepolia integration tests for a full round via raw + private calls

## Phase 5 — Hole-card reveal proof

**Agent skills:** none STRK20 for the *shoe* reveal STARK (that is our
prover/). Use `strk20-privacy` / `strk20-privacy-sdk` only where settlement
touches pool proofs or open-note credits.

- STARK proving stack for shoe/hole-card consistency (Stwo / Cairo0 /
  commitment-opening V0)
- Prove-and-verify pipeline: off-chain prove → on-chain verify in `settle`
- Soundness: mutated hole-card note must be rejected
- Do not confuse STRK20 pool transaction proofs with shoe reveal proofs —
  different programs, different verifiers

## Phase 6 — Session keys + paymaster

**Agent skills:** `strk20-wallet-api` (paymaster + shield/approve UX),
`strk20-privacy` (what stays public), optionally `strk20-privacy-sdk` if the
house sponsors via a key-holding backend.

- Session key scoping: game actions only — never withdraw / unshield the
  shielded stack
- Paymaster: gas sponsorship for hit/stand; pool fee is separate (read
  `get_fee_amount`, do not hardcode)
- Shield/approve: ERC-20 approve as token owner; under paymaster, approve can
  ride outside execution in the same tx as deposit
- UX: one wallet signature at buy-in, silent subsequent hits/stands
- starknet.js **≥ 10.4.0** for STRK20 Wallet API (`WalletAccountV6`,
  `strk20InvokeTransaction`) — bare `latest` may still lack these APIs

## Phase 7 — Frontend

**Agent skills:** `strk20-wallet-api` (required), `strk20-privacy` (UX copy on
hidden vs public).

- React + Vite + Wallet API (`useStrk20` and/or `WalletAccountV6` + get-starknet v6)
- Capability-detect via `supportedWalletApi()` — never probe balances to feature-detect
- Note decrypt / hand display only through wallet-mediated private state
- Show shoe commitment + link to public verifier (provably fair is visible, not
  only true on-chain)
- Prefer Ready (or another privacy-enabled wallet) for E2E; pure localdevnet
  is insufficient for full Wallet API flows
- Keep connection stack versions aligned (starknet.js, get-starknet, types-js)

## Phase 8 — Deploy + public verifier

**Agent skills:** `strk20-privacy` (addresses, compliance framing),
`strk20-wallet-api` / `strk20-privacy-sdk` as needed for Sepolia pool wiring.
Run the bundled freshness checker in the privacy skill before quoting versions
or pool addresses.

- Starknet Sepolia deploy / declare; verify against live STRK20 pool address
- Public shoe verifier (read-only): recompute shuffle commitment + check reveals
  from public data — independent of trusting the house UI
- Light audit against RFP threat model + STRK20 visibility table
- Attribute user activity from pool `Deposit` events, never from relayed tx sender

---

## Cross-cutting

- Felt252 / packing / endianness mismatches at Cairo ↔ TS ↔ prover boundaries
- Branch-per-phase discipline from `PLAN.md` §2
- **Reuse STRK20 notes and `privacy_invoke`; never hand-roll note encryption**
- Map trust boundary early (who holds viewing key, who proves, who submits) —
  see `strk20-privacy` “Pick the route first”
- Escalate to the STRK20 team rather than inventing APIs when blocked
  (contacts listed in each skill / [Private Sprint](https://strk20.starknet.io/hackathon))

## Domain skills still owned by this repo (not in strk20-skills)

| Area | Why |
| --- | --- |
| Blackjack hand / settlement rules | Game logic, not pool |
| Shoe commitment + VRF seed | Provable fairness primitive |
| Hole-card reveal STARK | Separate from STRK20 tx proofs |
| Session-key policy for game actions | App-specific scoping on top of AA / paymaster |
