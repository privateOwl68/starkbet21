# Sepolia deploy checklist

## 1. Account + `.env`

```bash
# Create a REAL Sepolia account (not the localnet 0x64b488… address)
sncast account create --name=sepolia --network=sepolia
# Prefund that address with Sepolia STRK (≥ ~0.08 for deploy), then:
sncast account deploy --name=sepolia --network=sepolia

cp .env.example .env
# Edit .env:
#   RPC_URL=…your Sepolia RPC…
#   OWNER_ADDRESS=<address printed by account create>
#   ACCOUNT_NAME=sepolia
```

Confirm:

```bash
sncast account list   # sepolia → deployed: true
sncast --profile=sepolia account balance --name=sepolia
```

Faucets: [Starknet faucet](https://starknet-faucet.vercel.app/) / Alchemy Sepolia STRK.

## 2. Deploy

```bash
./scripts/deploy_sepolia.sh
```

The script loads `RPC_URL` and `OWNER_ADDRESS` from the repo-root `.env` (or `app/.env`). Shell exports still override.

Optional anonymizer (STRK20):

```bash
export STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
export PRIVACY_POOL=0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91
./scripts/deploy_sepolia.sh
```

Script writes `app/src/lib/deployments.sepolia.json` (no keys) and refreshes ABIs.

## 3. App

```bash
cd app
VITE_NETWORK=sepolia npm run dev
```

1. Click **Connect** (Argent / Braavos / Ready).  
2. Open **Table** → wallet signs `buy_in` / deal / hit / stand.  
3. Confirm contracts on [Voyager Sepolia](https://sepolia.voyager.online).

## 4. Verify

- [ ] `shoe_commitment` call succeeds  
- [ ] `get_season` shows open window  
- [ ] Second wallet can buy-in independently  
- [ ] No `accountPrivateKey` in sepolia JSON or bundle  

## Troubleshooting

| Issue | Fix |
|-------|-----|
| sncast profile missing | Script appends `[sncast.sepolia]`; ensure account name matches |
| Fee errors | Fund account with Sepolia STRK |
| App still hits localnet | Set `VITE_NETWORK=sepolia` and restart Vite |
| REPLACE addresses | Re-run deploy script; check `deployments.sepolia.json` |
