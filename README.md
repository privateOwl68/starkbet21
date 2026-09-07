# StarkBet21 (shoe)

Provably fair blackjack on Starknet — Cairo contracts, Velvet & Onyx UI, Wager War seasons, and a STRK20 anonymizer path for private buy-in / cash-out.

**License:** MIT (see [`LICENSE`](./LICENSE))

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

Open http://127.0.0.1:5173 → **Connect** wallet or **Demo** (localnet key) → Table.

## Sepolia

```bash
export RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_8"
export OWNER_ADDRESS="0xYOUR_ACCOUNT"
export ACCOUNT_NAME="sepolia"          # sncast account name
# optional STRK20 vault:
# export STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
# export PRIVACY_POOL=0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91

./scripts/deploy_sepolia.sh

cd app && VITE_NETWORK=sepolia npm run dev
```

Connect Argent / Braavos / Ready (or any SNIP wallet). **No private keys in the app** on Sepolia.

## Docs

| Doc | Topic |
|-----|--------|
| [`docs/starkbet21-architecture.md`](./docs/starkbet21-architecture.md) | Platform architecture |
| [`docs/strk20-integration.md`](./docs/strk20-integration.md) | STRK20 anonymizer + Wallet API |
| [`docs/sepolia-deploy.md`](./docs/sepolia-deploy.md) | Sepolia checklist |
| [`docs/innovation-ideas.md`](./docs/innovation-ideas.md) | Hackathon innovation upsides |
| [`docs/shoe-commitment-spec.md`](./docs/shoe-commitment-spec.md) | Fairness primitive |
| [`PLAN.md`](./PLAN.md) | Build phases |

## Repo layout

| Path | Role |
|------|------|
| `contracts/` | Cairo + snforge (`blackjack_game`, `wager_war`, `blackjack_anonymizer`) |
| `app/` | Vite + React + wallet connect |
| `prover/` | Off-chain shuffle / reveal stubs |
| `scripts/deploy_local.sh` | Devnet deploy |
| `scripts/deploy_sepolia.sh` | Sepolia deploy |

## Tests

```bash
cd contracts && snforge test
cd app && npm run build
```

## Security notes

- Localnet demo account keys are **devnet-only**; never reuse on public nets.
- `deployments.local.json` is gitignored; `deployments.sepolia.json` holds **addresses only**.
- Anonymizer is a **draft** — review/audit before mainnet STRK custody.
