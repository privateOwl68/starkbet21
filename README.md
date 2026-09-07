# StarkBet21 (shoe)

Provably fair **on-chain blackjack** on Starknet — Cairo contracts, sealed-deal UI, Wager War seasons, STRK20 private buy-in / cash-out, and optional **gasless table play** via a house relayer.

**License:** MIT (see [`LICENSE`](./LICENSE))  
**Hackathon rubric / score plan:** [`docs/hackathon-scorecard.md`](./docs/hackathon-scorecard.md)

## What you can do today

| Feature | Status |
|---------|--------|
| Sealed on-chain deal / hit / stand / double | **Live on Mainnet + Sepolia** |
| Table chips from STRK (`deposit_strk`) | Live (free `buy_in` disabled when vault set) |
| Pre-approve + **Enable gasless play** (operator `*_for`) | Live (Sepolia demo relayer OK; mainnet → backend relayer) |
| STRK20 private buy-in / cash-out (Ready Wallet API ≥ 0.10.3) | Live (anonymizer deployed both nets) |
| Wager War volume leaderboard | Live |
| Velvet / local off-chain table | Removed from UI |

**Chip rules (vault mode):** denominations `1 · 10 · 25 · 50 · 100` STRK · min bet **1** · max bet **500**.

### Mainnet contracts (Voyager)

| Contract | Address |
|----------|---------|
| BlackjackGame | [`0x073e…22db`](https://voyager.online/contract/0x073ecbf4d1b6ba5ebf6525d90b6efaf33d7a8daf35769232d4d1066614e722db) |
| WagerWar | [`0x07f0…7fb7`](https://voyager.online/contract/0x07f0ac89868b779a2611e78e7ad99765d192002cc3dafb97a045705962947fb7) |
| Anonymizer | [`0x051b…abf0`](https://voyager.online/contract/0x051b53e4e95c5643507ed07b5d5736486f8e7810b147813ab374c394ffe8abf0) |

```bash
cd app && VITE_NETWORK=mainnet npm run dev
```

Connect a wallet → Lobby mint / private buy-in → Enter table. **Do not** put `VITE_RELAYER_PRIVATE_KEY` in the browser on mainnet.

## Quick start (localnet)

```bash
# A — Devnet
starknet-devnet --seed=0 --port=5050

# B — RPC proxy (Devnet 0.9: pending → pre_confirmed)
python3 scripts/devnet_rpc_proxy.py

# C — Deploy
./scripts/deploy_local.sh

# D — App
cd app && npm install && npm run dev
```

Open http://127.0.0.1:5173 → **Connect** or **Demo** → Lobby → mint chips / enter table.

## Sepolia

### 1. Deployer account + `.env`

```bash
sncast account create --name=sepolia --network=sepolia
# Prefund with Sepolia STRK, then:
sncast account deploy --name=sepolia --network=sepolia

cp .env.example .env
# RPC_URL, OWNER_ADDRESS, ACCOUNT_NAME=sepolia
# Recommended vault:
# STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
# PRIVACY_POOL=0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91
```

Do **not** use the localnet seed-0 address (`0x64b488…`) as `OWNER_ADDRESS`.

### 2. Deploy

```bash
./scripts/deploy_sepolia.sh
```

Writes `app/src/lib/deployments.sepolia.json` (addresses only) and refreshes ABIs. Sets vault + default relayer when `STRK_TOKEN` / `PRIVACY_POOL` are set.

### 3. App + gasless demo relayer

```bash
cd app
cp .env.example .env.local
# VITE_NETWORK=sepolia
# VITE_RELAYER_ADDRESS=<same as OWNER / deployments.tableRelayer>
# VITE_RELAYER_PRIVATE_KEY=<deployer sncast key — demo only>
VITE_NETWORK=sepolia npm run dev
```

**Vite only loads `.env` / `.env.local`** — a file named `.env ` (trailing space) is ignored.

1. **Connect** Ready (private rail) or Argent / Braavos (public play).  
2. Lobby: **Approve + mint chips** and/or **Private buy-in**.  
3. **Enable gasless play** once (authorizes the house relayer).  
4. **Enter table** — Deal / Hit / Stand should show a **Relayed play** badge and not prompt the wallet each time.  
5. Confirm on [Voyager Sepolia](https://sepolia.voyager.online).

Player wallet is still required for mint / authorize / private STRK20. Relayer only submits table actions (`deal_for`, `hit_for`, …) and **cannot** cash out.

## Mainnet redeploy / ops

```bash
# .env: RPC_URL=mainnet Alchemy (or other) RPC, OWNER_ADDRESS, ACCOUNT_NAME=mainnet
# STRK_TOKEN / PRIVACY_POOL default to official mainnet addresses
ALLOW_MAINNET_DEPLOY=1 ./scripts/deploy_mainnet.sh
```

| Piece | Status |
|-------|--------|
| `scripts/deploy_mainnet.sh` → `deployments.mainnet.json` | **Deployed** |
| `getDeployment()` loads mainnet JSON only | Done |
| Free `buy_in` gated when vault set | Done |
| Relayer | Prefer backend — no browser PK |

### Post-deploy soak (raise “working mainnet” marks)

- [ ] Public hosted UI (`VITE_NETWORK=mainnet`)  
- [ ] Tiny STRK: deposit → authorize → one hand → cash-out path  
- [ ] Backend relayer (optional gasless)  
- [ ] Record demo + Voyager links for judges  

### Explicitly defer

- Browser-held owner/relayer keys  
- Free chip mint on mainnet  
- Governance / SBET before vault soak  

## Docs

| Doc | Topic |
|-----|--------|
| [`docs/hackathon-scorecard.md`](./docs/hackathon-scorecard.md) | Judging weights + score plan |
| [`docs/starkbet21-architecture.md`](./docs/starkbet21-architecture.md) | Platform architecture |
| [`docs/strk20-integration.md`](./docs/strk20-integration.md) | STRK20 anonymizer + Wallet API |
| [`docs/sepolia-deploy.md`](./docs/sepolia-deploy.md) | Sepolia checklist |
| [`docs/innovation-ideas.md`](./docs/innovation-ideas.md) | Innovation upsides |
| [`docs/shoe-commitment-spec.md`](./docs/shoe-commitment-spec.md) | Fairness primitive |
| [`PLAN.md`](./PLAN.md) | Build phases + judge sprint |

## Repo layout

| Path | Role |
|------|------|
| `contracts/` | Cairo + snforge (`blackjack_game`, `wager_war`, `blackjack_anonymizer`) |
| `app/` | Vite + React + wallet connect (Lobby · Table · Wager War) |
| `prover/` | Off-chain shuffle / reveal stubs |
| `scripts/deploy_local.sh` | Devnet deploy |
| `scripts/deploy_sepolia.sh` | Sepolia deploy |
| `scripts/deploy_mainnet.sh` | Mainnet deploy (`ALLOW_MAINNET_DEPLOY=1`) |

## Tests

```bash
cd contracts && snforge test
cd app && npm run build
```

## Security notes

- Localnet demo keys are **devnet-only**; never reuse on public nets.  
- `deployments.*.json` must hold **addresses only** — no private keys. Prefer env for RPC API keys.  
- Sepolia gasless demo may use `VITE_RELAYER_PRIVATE_KEY` in `.env.local` (gitignored). **Mainnet must use a backend relayer.**  
- Anonymizer + STRK vault: treat as custody-sensitive; review before large TVL.  
- Table chips live in the game contract stack — they do **not** appear as ERC-20 in the wallet.
