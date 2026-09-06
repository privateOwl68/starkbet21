#!/usr/bin/env bash
# Deploy BlackjackGame + WagerWar following the official localnet guide:
# https://docs.starknet.io/build/quickstart/devnet
#
# Terminal A:
#   starknet-devnet --seed=0 --port=5050
#
# Terminal B (recommended — fixes starknet.js "pending" vs Devnet 0.9):
#   python3 scripts/devnet_rpc_proxy.py
#
# Terminal C:
#   RPC_URL=http://127.0.0.1:5051 ./scripts/deploy_local.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
DEPLOYMENTS="$ROOT/app/src/lib/deployments.local.json"
ABI_OUT="$ROOT/app/src/lib/blackjack_abi.json"
WAR_ABI_OUT="$ROOT/app/src/lib/wager_war_abi.json"
# Prefer compatibility proxy (:5051); fall back to raw Devnet.
RPC="${RPC_URL:-}"
if [[ -z "$RPC" ]]; then
  if curl -sf http://127.0.0.1:5051/is_alive >/dev/null 2>&1; then
    RPC="http://127.0.0.1:5051"
  else
    RPC="http://127.0.0.1:5050"
  fi
fi
DEVNET_DIRECT="${DEVNET_URL:-http://127.0.0.1:5050}"
SHOE_SEED="${SHOE_SEED:-42}"
# Demo war length (seconds). Default 1 hour.
WAR_SECONDS="${WAR_SECONDS:-3600}"

ADDR="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
PK="0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"

export PATH="${HOME}/.asdf/shims:${PATH}"

if ! curl -sf "$DEVNET_DIRECT/is_alive" >/dev/null 2>&1; then
  echo "Devnet not reachable at $DEVNET_DIRECT"
  echo "Start: starknet-devnet --seed=0 --port=5050"
  exit 1
fi

if [[ "$RPC" == *":5051"* ]] && ! curl -sf "$RPC/is_alive" >/dev/null 2>&1; then
  echo "Proxy not running on $RPC — start: python3 scripts/devnet_rpc_proxy.py"
  echo "Falling back to $DEVNET_DIRECT"
  RPC="$DEVNET_DIRECT"
fi

echo "Using RPC: $RPC"

cd "$CONTRACTS"

echo "==> sncast account import…"
sncast account import \
  --name=devnet \
  --address="$ADDR" \
  --type=oz \
  --url="$RPC" \
  --private-key="$PK" \
  --add-profile=devnet \
  --silent 2>&1 || true

cat > snfoundry.toml <<EOF
# https://docs.starknet.io/build/quickstart/devnet
[sncast.devnet]
url = "$RPC"
account = "devnet"
EOF

scarb build

extract_class_hash() {
  python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'class hash[:\s]+(0x[0-9a-fA-F]+)', text, re.I)
if not m:
    m = re.search(r'(0x[0-9a-fA-F]{60,})', text)
print(m.group(1) if m else '')
"
}

extract_contract() {
  python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'Contract Address:\s+(0x[0-9a-fA-F]+)', text)
if m:
    print(m.group(1)); raise SystemExit
m = re.search(r'already deployed at address (0x[0-9a-fA-F]+)', text, re.I)
if m:
    print(m.group(1)); raise SystemExit
m = re.search(r'contract_address[:\s]+(0x[0-9a-fA-F]+)', text, re.I)
print(m.group(1) if m else '')
"
}

echo "==> declare blackjack_game…"
DECLARE_OUT=$(sncast --profile=devnet --wait declare --contract-name=blackjack_game 2>&1) || true
echo "$DECLARE_OUT"
CLASS_HASH=$(echo "$DECLARE_OUT" | extract_class_hash)
if [[ -z "$CLASS_HASH" ]]; then
  echo "ERROR: no blackjack class hash"
  exit 1
fi
echo "==> Blackjack class hash: $CLASS_HASH"

echo "==> declare wager_war…"
WAR_DECLARE=$(sncast --profile=devnet --wait declare --contract-name=wager_war 2>&1) || true
echo "$WAR_DECLARE"
WAR_CLASS=$(echo "$WAR_DECLARE" | extract_class_hash)
if [[ -z "$WAR_CLASS" ]]; then
  echo "ERROR: no wager_war class hash"
  exit 1
fi
echo "==> WagerWar class hash: $WAR_CLASS"

echo "==> deploy blackjack_game --salt=10…"
DEPLOY_OUT=$(sncast --profile=devnet --wait deploy \
  --class-hash="$CLASS_HASH" \
  --salt=10 \
  --constructor-calldata "$SHOE_SEED" "$ADDR" 2>&1) || true
echo "$DEPLOY_OUT"
CONTRACT=$(echo "$DEPLOY_OUT" | extract_contract)
if [[ -z "$CONTRACT" ]]; then
  echo "ERROR: no blackjack address"
  exit 1
fi

echo "==> deploy wager_war --salt=11…"
WAR_DEPLOY=$(sncast --profile=devnet --wait deploy \
  --class-hash="$WAR_CLASS" \
  --salt=11 \
  --constructor-calldata "$ADDR" 2>&1) || true
echo "$WAR_DEPLOY"
WAR_CONTRACT=$(echo "$WAR_DEPLOY" | extract_contract)
if [[ -z "$WAR_CONTRACT" ]]; then
  echo "ERROR: no wager_war address"
  exit 1
fi

echo "==> link game <-> war…"
sncast --profile=devnet --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=set_game \
  --calldata "$CONTRACT"

sncast --profile=devnet --wait invoke \
  --contract-address="$CONTRACT" \
  --function=set_wager_war \
  --calldata "$WAR_CONTRACT"

START_TS=$(date +%s)
END_TS=$((START_TS + WAR_SECONDS))
echo "==> open_season $START_TS → $END_TS (${WAR_SECONDS}s)…"
sncast --profile=devnet --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=open_season \
  --calldata "$START_TS" "$END_TS"

APP_RPC="/rpc"

python3 - <<PY
import json
from pathlib import Path
contracts = Path("$CONTRACTS")
bj = json.loads((contracts / "target/dev/shoe_blackjack_game.contract_class.json").read_text())
war = json.loads((contracts / "target/dev/shoe_wager_war.contract_class.json").read_text())
Path("$ABI_OUT").write_text(json.dumps(bj["abi"], indent=2) + "\n")
Path("$WAR_ABI_OUT").write_text(json.dumps(war["abi"], indent=2) + "\n")
data = {
  "network": "devnet",
  "rpcUrl": "$APP_RPC",
  "chainId": "SN_SEPOLIA",
  "blackjackGame": "$CONTRACT",
  "wagerWar": "$WAR_CONTRACT",
  "classHash": "$CLASS_HASH",
  "wagerWarClassHash": "$WAR_CLASS",
  "shoeSeed": "$SHOE_SEED",
  "warStartTs": $START_TS,
  "warEndTs": $END_TS,
  "accountAddress": "$ADDR",
  "accountPrivateKey": "$PK",
  "note": "Use scripts/devnet_rpc_proxy.py (rpcUrl :5051). Wager War season opened for ${WAR_SECONDS}s."
}
Path("$DEPLOYMENTS").write_text(json.dumps(data, indent=2) + "\n")
print("Wrote", "$DEPLOYMENTS")
print("Blackjack", "$CONTRACT")
print("WagerWar", "$WAR_CONTRACT")
print("App RPC", "$APP_RPC")
PY

echo "==> call shoe_commitment"
sncast --profile=devnet call \
  --contract-address="$CONTRACT" \
  --function=shoe_commitment

echo "==> call get_season"
sncast --profile=devnet call \
  --contract-address="$WAR_CONTRACT" \
  --function=get_season

echo "Done."
