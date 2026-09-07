# StarkBet21 — Platform Architecture

> Provably fair games on Starknet, optional **privacy (STRK20)**, and a path from operator-run testnet to on-chain governance.

Working titles: **StarkBet21** (product) · **shoe** (fairness primitive).

**Hackathon score plan:** [`hackathon-scorecard.md`](./hackathon-scorecard.md)  
**Live mainnet:** game + war + anonymizer — see README / `deployments.mainnet.json`.

---

## 1. Design goals

| Goal | Approach |
|------|----------|
| Multi-game platform | Shared vault, fee policy, and WagerWar hooks; engines plug in |
| Provable fairness | Shoe commitments, hole-card opens, public verifier |
| Volume incentives | Time-boxed Wager War seasons (XP → prize pools) |
| Ownership / governance | **SBET** (working name) — votes + fee share after product is live |
| Wager asset | **STRK** + shielded STRK20 notes for buy-in/cash-out |
| Operator → DAO | Team-owned contracts → token distribution → Governor |

Starknet-native strengths: **shoe commitments**, **STARK proofs**, **account abstraction / session keys**, and **private balances** via STRK20.

---

## 2. System overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         STARKBET21 SURFACE                               │
│  Lobby · Live Table · Wager War · (Profile / Governance later)          │
│  Vite / React · Wallet connect · network-aware (localnet/Sepolia/Mainnet)│
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  RPC / Wallet API (STRK20)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                 STARKNET (Sepolia ✓ · Mainnet ✓)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ BlackjackGame│  │  WagerWar    │  │ STRK vault   │  │ SBET / Gov* │ │
│  │ shoe · hand  │◄─┤ volume/rank  │  │ deposit_strk │  │ votes ·     │ │
│  │ settlement   │  │ seasons      │  │ gated buy_in │  │ fee share*  │ │
│  │ operators    │  └──────────────┘  └──────▲───────┘  └─────────────┘ │
│  └──────┬───────┘                           │                            │
│         │ credit / release                  │                            │
│  ┌──────▼───────────┐  ┌──────────────┐                                 │
│  │ blackjack_       │  │ STRK20 pool  │  FutureGames*                    │
│  │ anonymizer       │──┤ (mainnet /   │  Roulette · Dice · Lottery       │
│  │ privacy_invoke   │  │  sepolia)    │                                  │
│  └──────────────────┘  └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
         │                                    ▲
         │ off-chain                          │ verify / reveal
┌────────▼────────┐                  ┌────────┴────────┐
│ Prover service* │  shuffle + hole  │ Public verifier*│
│ (Rust / STARK)  │  card openings   │ (anyone)        │
└─────────────────┘                  └─────────────────┘

* = not shipped yet; reserved in architecture
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
| Public verifier | Independent check of shoe id + reveals (trust story) — **next Innovation gap** |

**Invariant:** the house cannot swap a hole card after commitment without failing verification.

### L1 — Game engines (pluggable)
Each game is a contract (or module) that:

1. Takes stakes from the **player stack / vault**.
2. Emits **wager volume** into **WagerWar**.
3. Settles against house rules + shared fee policy.
4. Optionally uses **privacy_invoke** for private funding (cards later).

| Game | Status |
|------|--------|
| Blackjack | **Live Mainnet + Sepolia** (public cards; STRK vault; operator gasless) |
| Roulette-style | Planned |
| Dice range bet | Planned |
| Lottery | Planned |

**Multi-game rule:** new games register with Vault + WagerWar; they do not fork treasury logic.

### L2 — Economy & incentives
```text
Player stake (STRK / chips)
        │
        ▼
   GameEngine ──% house edge / rake──► vault (game contract)
        │                                    │
        ├── volume ──► WagerWar season       ├── ops / liquidity
        │                                    ├── Wager War prize pot (V2)
        └── stack updates                    └── DAO revenue share (V3)
```

| Mechanism | Localnet | Sepolia / Mainnet (now) | V2 | V3 DAO |
|-----------|----------|-------------------------|----|--------|
| Buy-in | Free mint (no vault) | `deposit_strk` / STRK20 private buy-in; free mint **gated** | — | — |
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
| Treasury | Vault holds protocol STRK; Governor proposes withdrawals / shares |

**Principle:** ship the game and war loop before the token. Token without product is empty-DAO risk.

### L4 — Client & UX
| Surface | Responsibility |
|---------|----------------|
| Lobby | Network-aware eyebrow, mint chips, private buy-in, gasless authorize, enter table |
| Live table | Solo seat; sealed deal; relayed play badge |
| Wager War | Season board, personal volume/rank |
| Profile / Governance UI | Deferred / later |

**Auth:** **Wallet connect** (get-starknet + `WalletAccount`) on all nets. Localnet may use an optional demo key. Never embed private keys for Sepolia/mainnet. Mainnet gasless = **backend** relayer.

### L5 — Privacy (STRK20 track)
| Mode | Visibility |
|------|------------|
| Table play | Cards + chip stacks public on-chain |
| **Anonymizer (shipped)** | Private STRK buy-in / cash-out ↔ chip vault; Wallet API in `app/src/lib/strk20.ts`; **mainnet + Sepolia deployed** |
| V1 private cards | Encrypted card notes; viewing keys for player |
| Shadow seat | Stealth account for unlinkable table txs (next depth win) |
| Compliance | Selective disclosure / auditor paths per STRK20 model |

See `docs/strk20-integration.md` for trust boundary, calldata, and deploy order.

Privacy is an **engine option**, not a separate casino.

---

## 4. Contract topology (target)

```text
Owner / Governor
      │
      ├── BlackjackGame ──────────── set_wager_war / report volume
      │     ├── deposit_strk / stacks
      │     ├── operators / default_relayer (*_for play)
      │     └── set_strk_vault → anonymizer
      ├── blackjack_anonymizer ──── privacy_invoke (pool-pinned)
      ├── WagerWar ──────────────── seasons, volume, ranks
      ├── RouletteGame* / DiceGame*
      └── SBET + Governor*          # ownership & votes

* future
```

**Today (implemented + deployed):**

- `BlackjackGame` ↔ `WagerWar` linked; season open  
- STRK vault + anonymizer; free `buy_in` disabled when vault set  
- Operator / default relayer for gasless table actions  
- Artifacts: `deployments.sepolia.json`, `deployments.mainnet.json`

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
| Front-running actions | Account abstraction / careful mempool assumptions; private notes hide funding |
| Key leakage in frontend | Wallet-only signing on public nets; no mainnet browser relayer PK |
| Infinite free chips | Free mint gated once vault set; STRK collateral on public nets |

---

## 6. Deployment environments

| Env | Chain | Account | RPC | Chips |
|-----|-------|---------|-----|-------|
| Localnet | Devnet | Predeployed demo key | Vite `/rpc` proxy | Free `buy_in` |
| Sepolia | Starknet Sepolia | Operator + user wallets | Alchemy / public | STRK deposit / private buy-in |
| Mainnet | Starknet | Operator (+ HW/multisig target) | Alchemy / production | STRK / STRK20 only |

Pipeline: `scarb build` → `sncast declare/deploy` → link war → vault → relayer → open season → write deployment JSON → `VITE_NETWORK=…`.

---

## 7. Roadmap alignment (architecture phases)

| Phase | Architecture milestone | Status |
|-------|------------------------|--------|
| **A — Playable casino core** | Blackjack + War XP + UI + localnet | Done |
| **A2 — STRK20 depth** | Anonymizer + Wallet API + tests | Done (live submit still demo-dependent) |
| **B — Public testnet** | Sepolia deploy, wallet connect | Done |
| **C — Real stakes** | Mainnet vault + gated free mint | **Done (deployed)** |
| **C+ — Judge polish** | Hosted UI, backend relayer, demo clip | In progress — see scorecard |
| **D — War with pot** | Vault skim → season prizes | Planned |
| **E — Verifier + VRF** | Public shoe verifier; VRF seed | **Top Innovation sprint** |
| **F — Private cards / shadow** | Card notes + shadow seat | Planned |
| **G — Multi-game / DAO** | Extra engines; SBET + Governor | Deferred |

---

## 8. Non-goals (keep the architecture honest)

- Not a full mental-poker multi-player card crypto stack in V1.
- Not a token launch before mainnet soak + anonymizer review.
- Tokenomics must fit STRK fee markets and Starknet accounts — no copy-paste of legacy L1 emission schedules.
- Multi-seat tables are UX-ready (open seats) but **protocol is single-player-vs-dealer** until a dedicated multiplayer design.

---

## 9. Repo map ↔ architecture

| Path | Layer |
|------|-------|
| `contracts/src/shoe|hand|settlement.cairo` | L0 fairness |
| `contracts/src/blackjack_game.cairo` | L1 blackjack + STRK vault + operators |
| `contracts/src/blackjack_anonymizer.cairo` | L5 STRK20 helper |
| `contracts/src/wager_war.cairo` | L2 incentives |
| `prover/` | L0 off-chain proofs |
| `app/` | L4 client |
| `app/src/lib/strk20.ts` | L5 Wallet API actions |
| `scripts/deploy_*.sh` | Environments |
| `docs/shoe-commitment-spec.md` | Fairness spec |
| `docs/note-schema.md` | Privacy notes |
| `docs/strk20-integration.md` | STRK20 depth |
| `docs/hackathon-scorecard.md` | Judging + score plan |
| `PLAN.md` | Build sequencing |

---

## 10. One-sentence thesis

**StarkBet21 is a Starknet games platform: provably fair engines (starting with blackjack), volume wars that graduate into real prize pools, and an ownership token that turns today’s operator knobs into on-chain votes — with STRK20 privacy for funding and a sealed, verifiable shoe as the fairness story.**
