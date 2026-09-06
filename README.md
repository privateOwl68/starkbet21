# shoe — private blackjack on Starknet

Provably fair, private blackjack. Working title **shoe**.

## Localnet (official Starknet flow)

Follows [Deploying locally](https://docs.starknet.io/build/quickstart/devnet).

**Important (Devnet 0.9):** RPC no longer accepts block tag `pending` (use `pre_confirmed` / `latest`).
`starknet.js` v6 still sends `pending`, which produces:

`Invalid block ID. Expected ... ('pre_confirmed' or 'latest' or 'l1_accepted').`

Run the compatibility proxy so the UI and older clients keep working.

**Terminal A — Devnet:**

```bash
starknet-devnet --seed=0 --port=5050
```

**Terminal B — RPC proxy** (`pending` → `pre_confirmed`):

```bash
python3 scripts/devnet_rpc_proxy.py
# listens on http://127.0.0.1:5051
```

**Terminal C — declare / deploy:**

```bash
./scripts/deploy_local.sh
# auto-uses :5051 if the proxy is up
```

**UI:**

```bash
cd app && npm run dev
# Localnet tab → http://127.0.0.1:5173/
# Browser RPC uses same-origin /rpc (Vite → :5051) to avoid CORS
```

## Repo layout

| Path | Role |
|------|------|
| `contracts/` | Cairo + Scarb / snforge · `snfoundry.toml` profile `devnet` |
| `prover/` | Off-chain shuffle + reveal proofs |
| `app/` | Vite + React (Localnet / Off-chain) |
| `scripts/deploy_local.sh` | Docs-aligned declare/deploy |
| `PLAN.md` | Build phases |
| `skillsRequired.md` | STRK20 + domain skills |

## Tests

```bash
cd contracts && snforge test
```

Localnet V0 `BlackjackGame`: public cards, `buy_in` chip stack, deterministic shoe from constructor seed. Split/insurance/privacy notes come later.
