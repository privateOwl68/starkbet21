# StarkBet21 — Platform Architecture

> Provably fair games on Starknet, optional **privacy (STRK20)**, and a path from operator-run testnet to on-chain governance.

Working titles: **StarkBet21** (product) · **shoe** (fairness primitive).

---

## 1. Design goals

| Goal | Approach |
|------|----------|
| Multi-game platform | Shared vault, fee policy, and WagerWar hooks; engines plug in |
| Provable fairness | Shoe commitments, hole-card opens, public verifier |
| Volume incentives | Time-boxed Wager War seasons (XP → prize pools) |
| Ownership / governance | **SBET** (working name) — votes + fee share after product is live |
| Wager asset | **STRK**, later shielded STRK20 notes |
| Operator → DAO | Team-owned contracts → token distribution → Governor |

Starknet-native strengths: **shoe commitments**, **STARK proofs**, **account abstraction / session keys**, and **private balances** via STRK20.

---

## 2. System overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         STARKBET21 SURFACE                               │
│  Lobby · Live Table · Profile · Wager War · (Governance later)          │
│  Vite / React · Velvet & Onyx · Wallet connect (Sepolia+)               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  RPC / Wallet API
┌───────────────────────────────▼─────────────────────────────────────────┐
│                      STARKNET (Sepolia → Mainnet)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ BlackjackGame│  │  WagerWar    │  │ GameVault*   │  │ SBET / Gov* │ │
│  │ shoe · hand  │◄─┤ volume/rank  │  │ fees · pot   │  │ votes ·     │ │
│  │ settlement   │  │ seasons      │  │ buy-in path  │  │ fee share*  │ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│         │ privacy_invoke (V1+)                                           │
│  ┌──────▼───────┐  ┌──────────────┐                                     │
│  │ STRK20 pool* │  │ FutureGames* │  Roulette · Dice · Lottery          │
│  └──────────────┘  └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘
         │                                    ▲
         │ off-chain                          │ verify / reveal
┌────────▼────────┐                  ┌────────┴────────┐
│ Prover service  │  shuffle + hole  │ Public verifier │
│ (Rust / STARK)  │  card openings   │ (anyone)        │
└─────────────────┘                  └─────────────────┘

* = not shipped in V0; reserved in architecture
```

---

## 3. Layered architecture

### L0 — Settlement & fairness core
| Module | Role |
|--------|------|
| `shoe.cairo` | Deterministic shuffle from seed; commitment hash; draw-by-index |
| `hand.cairo` | Soft/hard totals, BJ detection, H17 dealer policy |
| `settlement.cairo` | 3:2 BJ, even money, push, loss, double |
| Prover | Shuffle / hole-card consistency proofs (V0 may use commitment open; V1 full proof) |
| Public verifier | Independent check of shoe id + reveals (trust story) |

**Invariant:** the house cannot swap a hole card after commitment without failing verification.

### L1 — Game engines (pluggable)
Each game is a contract (or module) that:

1. Takes stakes from the **player stack / vault**.
2. Emits **wager volume** into **WagerWar**.
3. Settles against house rules + shared fee policy.
4. Optionally uses **privacy_invoke** for private cards/stacks.

| Game | Status |
|------|--------|
| Blackjack | **V0 live** (public cards, mint `buy_in`) |
| Roulette-style | Planned |
| Dice range bet | Planned |
| Lottery | Planned |

**Multi-game rule:** new games register with Vault + WagerWar; they do not fork treasury logic.

### L2 — Economy & incentives
```text
Player stake (STRK / chips)
        │
        ▼
   GameEngine ──% house edge / rake──► GameVault
        │                                    │
        ├── volume ──► WagerWar season       ├── ops / liquidity
        │                                    ├── Wager War prize pot (V2)
        └── stack updates                    └── DAO revenue share (V3)
```

| Mechanism | V0 (now) | V1 Sepolia | V2 | V3 DAO |
|-----------|----------|------------|----|--------|
| Buy-in | Free mint stack | Wallet + optional faucet / capped mint | STRK deposit | STRK / private notes |
| Wager War | Volume → XP/badges | Same + public board | % vault → prize pool | DAO sets % + seasons |
| Ownership token | — | — | SBET design lock | Volume-weighted emissions + votes |
| Revenue share | — | — | — | SBET holders + team split (votable) |

**Wager War:** time-boxed seasons; rank by **total wagered** (deal + double today). V1 rewards are non-transferable XP/badges. V2 allocates a share of vault profit into a season prize pool (STRK or SBET), claimed by ranked players.

### L3 — Governance (DAO path)

| Concept | Design |
|---------|--------|
| **SBET** | Starknet token (SNIP / SRC-compatible) = ownership + vote weight |
| Bootstrap | Operator-owned contracts; progressive transfer of `owner` to Governor |
| Votes | Season length, rake %, war prize %, new game listing, fee recipient |
| Emissions | Optional volume-weighted SBET — **deferred until tokenomics audit** |
| Treasury | `GameVault` holds protocol STRK; Governor proposes withdrawals / shares |

**Principle:** ship the game and war loop before the token. Token without product is empty-DAO risk.

### L4 — Client & UX
| Surface | Responsibility |
|---------|----------------|
| Lobby & Create | Network (localnet / Sepolia), table rules, enter suite |
| Live table | Solo seat now; arc reserved for N seats later |
| Profile | High-roller stats, war badges |
| Victory | Settlement splash / ledger |
| Wager War | Season board, personal volume/rank |
| Governance UI | Later — proposals + voting |

**Auth:** **Wallet connect** (get-starknet + `WalletAccount`) on all nets. Localnet may use an optional demo key. Never embed private keys for Sepolia/mainnet.

### L5 — Privacy (STRK20 track)
| Mode | Visibility |
|------|------------|
| V0 public | Cards + stacks on-chain (current table play) |
| **V0.5 anonymizer (in tree)** | `blackjack_anonymizer` private STRK buy-in / cash-out ↔ chip vault; Wallet API action builders in `app/src/lib/strk20.ts` |
| V1 private cards | Encrypted card notes; viewing keys for player |
| Compliance | Selective disclosure / auditor paths per STRK20 model |

See `docs/strk20-integration.md` for trust boundary, calldata, and deploy order.

Privacy is an **engine option**, not a separate casino.

---

## 4. Contract topology (target)

```text
Owner / Governor
      │
      ├── GameVault                 # STRK in/out, rake, war pot funding
      ├── WagerWar                  # seasons, volume, ranks, (later) claims
      ├── BlackjackGame ────────────┼── set_wager_war / report volume
      ├── RouletteGame* ────────────┤
      ├── DiceGame* ────────────────┤
      └── SBET + Governor*          # ownership & votes

* future
```

**Today (implemented):**

- `BlackjackGame(shoe_seed, owner)` ↔ `WagerWar(owner)` linked via `set_game` / `set_wager_war`
- Per-address stacks, public cards, sealed UX until tx confirm
- Season `open_season(start, end)`

**Sepolia deploy artifacts:** `deployments.sepolia.json` (addresses + RPC only; no keys).

---

## 5. Trust & fairness model

```text
1. Open shoe     → publish commitment (and later VRF proof of seed)
2. Play round    → draws consume committed order
3. Settle        → hole card opens against commitment (+ proof)
4. Anyone        → re-verify via public verifier page/script
```

| Threat | Mitigation |
|--------|------------|
| House grinds favorable shoe | VRF (or joint commit–reveal V2); never raw public seed in production |
| Hole-card swap | Commitment + reveal proof |
| Front-running actions | Account abstraction / careful mempool assumptions; private notes hide bets |
| Key leakage in frontend | Wallet-only signing on public nets |
| Infinite free chips | Cap mint on testnet; STRK collateral on mainnet |

---

## 6. Deployment environments

| Env | Chain | Account | RPC | Chips |
|-----|-------|---------|-----|-------|
| Localnet | Devnet (`SN_SEPOLIA` id quirk) | Predeployed demo key | Vite `/rpc` proxy | Free `buy_in` |
| Sepolia | Starknet Sepolia | Operator + user wallets | Public/private Sepolia RPC | Capped mint → STRK |
| Mainnet | Starknet | Multisig / Governor | Production RPC | STRK / STRK20 only |

Pipeline: `scarb build` → `sncast declare/deploy` → link war → open season → write deployment JSON → app network switch.

---

## 7. Roadmap alignment (architecture phases)

| Phase | Architecture milestone |
|-------|------------------------|
| **A — Playable casino core** | Blackjack + War XP + Velvet UI + localnet |
| **A2 — STRK20 depth** | Anonymizer buy-in/cash-out + Wallet API builders + tests |
| **B — Public testnet** | Sepolia deploy, wallet connect, verifier |
| **C — Real stakes** | GameVault + STRK buy-in/cash-out live |
| **D — War with pot** | Vault skim → season prizes |
| **E — Private cards** | Card notes + session keys/paymaster |
| **F — Multi-game** | Roulette / dice / lottery modules |
| **G — DAO** | SBET + Governor + votable params |

---

## 8. Non-goals (keep the architecture honest)

- Not a full mental-poker multi-player card crypto stack in V1.
- Not mainnet token launch before Sepolia soak + audit of vault/war.
- Tokenomics must fit STRK fee markets and Starknet accounts — no copy-paste of legacy L1 emission schedules.
- Multi-seat tables are UX-ready (open seats) but **protocol is single-player-vs-dealer** until a dedicated multiplayer design.

---

## 9. Repo map ↔ architecture

| Path | Layer |
|------|-------|
| `contracts/src/shoe|hand|settlement.cairo` | L0 fairness |
| `contracts/src/blackjack_game.cairo` | L1 blackjack + STRK vault hooks |
| `contracts/src/blackjack_anonymizer.cairo` | L5 STRK20 helper |
| `contracts/src/wager_war.cairo` | L2 incentives |
| `prover/` | L0 off-chain proofs |
| `app/` | L4 client |
| `app/src/lib/strk20.ts` | L5 Wallet API actions |
| `scripts/deploy_*.sh` | Environments |
| `docs/shoe-commitment-spec.md` | Fairness spec |
| `docs/note-schema.md` | Privacy notes |
| `docs/strk20-integration.md` | STRK20 depth |
| `PLAN.md` | Build sequencing |

---

## 10. One-sentence thesis

**StarkBet21 is a Starknet games platform: provably fair engines (starting with blackjack), volume wars that graduate into real prize pools, and an ownership token that turns today’s operator knobs into on-chain votes — with privacy as a first-class upgrade path, not a bolt-on.**
