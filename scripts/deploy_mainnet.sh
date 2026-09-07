#!/usr/bin/env bash
# Deploy BlackjackGame + WagerWar + anonymizer to Starknet Mainnet.
#
# HARD REQUIREMENTS:
#   - ALLOW_MAINNET_DEPLOY=1
#   - STRK_TOKEN + PRIVACY_POOL (mainnet defaults applied if unset)
#   - Funded sncast mainnet account (not the localnet seed-0 key)
#   - Relayer PK must NOT go in the browser — set tableRelayer only; run a backend later
#
# Usage:
#   cp .env.example .env
#   # Set RPC_URL (mainnet), OWNER_ADDRESS, ACCOUNT_NAME=mainnet
#   ALLOW_MAINNET_DEPLOY=1 ./scripts/deploy_mainnet.sh
#
# Writes app/src/lib/deployments.mainnet.json (addresses only — no private keys).
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
DEPLOYMENTS="$ROOT/app/src/lib/deployments.mainnet.json"
ABI_OUT="$ROOT/app/src/lib/blackjack_abi.json"
WAR_ABI_OUT="$ROOT/app/src/lib/wager_war_abi.json"
ANON_ABI_OUT="$ROOT/app/src/lib/blackjack_anonymizer_abi.json"

# Official Starknet STRK + STRK20 privacy pool (mainnet).
DEFAULT_STRK_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
DEFAULT_PRIVACY_POOL="0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a"
# Known Sepolia-only pool — refuse if someone pastes it on mainnet.
SEPOLIA_PRIVACY_POOL="0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91"

if [[ "${ALLOW_MAINNET_DEPLOY:-}" != "1" ]]; then
  echo "ERROR: Refusing mainnet deploy without ALLOW_MAINNET_DEPLOY=1"
  echo "Example: ALLOW_MAINNET_DEPLOY=1 ./scripts/deploy_mainnet.sh"
  exit 1
fi

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  echo "==> loading ${file#"$ROOT"/}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    if [[ -z "${!key+x}" ]]; then
      export "$key=$value"
    fi
  done < "$file"
}

load_env_file "$ROOT/.env"
load_env_file "$ROOT/app/.env"

RPC_URL="${RPC_URL:-${rpcUrl:-}}"
OWNER_ADDRESS="${OWNER_ADDRESS:-${ownerAddress:-${OWNER:-}}}"

RPC="${RPC_URL:?Set RPC_URL to a Starknet mainnet RPC}"
ACCOUNT_NAME="${ACCOUNT_NAME:-mainnet}"
PROFILE="${SNCAST_PROFILE:-mainnet}"
SHOE_SEED="${SHOE_SEED:-42}"
WAR_SECONDS="${WAR_SECONDS:-604800}"
STRK_TOKEN="${STRK_TOKEN:-$DEFAULT_STRK_TOKEN}"
PRIVACY_POOL="${PRIVACY_POOL:-$DEFAULT_PRIVACY_POOL}"
OWNER="${OWNER_ADDRESS:?Set OWNER_ADDRESS to your deployed mainnet account}"
TABLE_RELAYER="${TABLE_RELAYER:-$OWNER}"

# Refuse localnet seed-0 / Sepolia RPC / Sepolia pool by mistake.
LOCALNET_SEED0="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
OWNER_NORM=$(python3 -c "print(hex(int('$OWNER',16)))")
SEED_NORM=$(python3 -c "print(hex(int('$LOCALNET_SEED0',16)))")
if [[ "$OWNER_NORM" == "$SEED_NORM" ]]; then
  echo "ERROR: OWNER_ADDRESS is the localnet seed-0 account — never use it on mainnet."
  exit 1
fi

if echo "$RPC" | grep -qi sepolia; then
  echo "ERROR: RPC_URL looks like Sepolia ($RPC). Use a mainnet RPC."
  exit 1
fi

POOL_NORM=$(python3 -c "print(hex(int('$PRIVACY_POOL',16)))")
SEPOLIA_POOL_NORM=$(python3 -c "print(hex(int('$SEPOLIA_PRIVACY_POOL',16)))")
if [[ "$POOL_NORM" == "$SEPOLIA_POOL_NORM" ]]; then
  echo "ERROR: PRIVACY_POOL is the Sepolia STRK20 pool. Mainnet pool is:"
  echo "  $DEFAULT_PRIVACY_POOL"
  exit 1
fi

export PATH="${HOME}/.asdf/shims:${PATH}"

cd "$CONTRACTS"

ACCOUNTS_FILE="${SNCAST_ACCOUNTS_FILE:-$HOME/.starknet_accounts/starknet_open_zeppelin_accounts.json}"

python3 - "$PROFILE" "$RPC" "$ACCOUNT_NAME" "$ACCOUNTS_FILE" <<'PY'
from pathlib import Path
import re
import sys
profile, rpc, account_name, accounts_file = sys.argv[1:5]
path = Path("snfoundry.toml")
text = path.read_text() if path.exists() else ""
block = (
    f"[sncast.{profile}]\n"
    f'url = "{rpc}"\n'
    f'account = "{account_name}"\n'
    f'accounts-file = "{accounts_file}"\n'
)
pat = re.compile(rf"\[sncast\.{re.escape(profile)}\][^\[]*", re.M)
if pat.search(text):
    text = pat.sub(block.rstrip() + "\n\n", text)
else:
    text = text.rstrip() + "\n\n" + block
path.write_text(text.rstrip() + "\n")
print(f"Wrote [sncast.{profile}] account={account_name}")
PY

ACCOUNT_BLOCK=$(sncast account list 2>/dev/null | python3 -c "
import sys, re
name = '''${ACCOUNT_NAME}'''
text = sys.stdin.read()
blocks = re.split(r'\n(?=- )', text)
for b in blocks:
    if re.match(rf'- {re.escape(name)}:', b):
        print(b)
        break
")
if [[ -z "$ACCOUNT_BLOCK" ]]; then
  echo "ERROR: sncast account '${ACCOUNT_NAME}' not found."
  echo "Create + fund a mainnet account, then:"
  echo "  sncast account create --name=mainnet --network=mainnet"
  echo "  sncast account deploy --name=mainnet --network=mainnet"
  exit 1
fi

if echo "$ACCOUNT_BLOCK" | grep -qi 'deployed: false'; then
  ADDR_PENDING=$(echo "$ACCOUNT_BLOCK" | python3 -c "import sys,re; m=re.search(r'address:\s+(0x[0-9a-fA-F]+)', sys.stdin.read()); print(m.group(1) if m else '')")
  echo "ERROR: sncast account '${ACCOUNT_NAME}' is not deployed on mainnet."
  echo "  Address: ${ADDR_PENDING}"
  echo "Fund with STRK, then: sncast account deploy --name=${ACCOUNT_NAME} --network=mainnet"
  exit 1
fi

ACCOUNT_ADDR=$(echo "$ACCOUNT_BLOCK" | python3 -c "import sys,re; m=re.search(r'address:\s+(0x[0-9a-fA-F]+)', sys.stdin.read()); print(m.group(1) if m else '')")
if [[ -n "$ACCOUNT_ADDR" ]]; then
  OWNER_INT=$(python3 -c "print(int('${OWNER}', 16))")
  ADDR_INT=$(python3 -c "print(int('${ACCOUNT_ADDR}', 16))")
  if [[ "$OWNER_INT" != "$ADDR_INT" ]]; then
    echo "ERROR: OWNER_ADDRESS (${OWNER})"
    echo "  does not match sncast account '${ACCOUNT_NAME}' (${ACCOUNT_ADDR})."
    exit 1
  fi
fi

echo "==> MAINNET deploy profile=$PROFILE rpc=$RPC account=$ACCOUNT_NAME owner=$OWNER"
echo "==> STRK_TOKEN=$STRK_TOKEN"
echo "==> PRIVACY_POOL=$PRIVACY_POOL"
echo "==> tableRelayer=$TABLE_RELAYER (backend only — do not put PK in VITE_*)"
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
DECLARE_OUT=$(sncast --profile="$PROFILE" --wait declare --contract-name=blackjack_game 2>&1) || true
echo "$DECLARE_OUT"
CLASS_HASH=$(echo "$DECLARE_OUT" | extract_class_hash)
[[ -n "$CLASS_HASH" ]] || { echo "ERROR: no blackjack class hash"; exit 1; }

echo "==> declare wager_war…"
WAR_DECLARE=$(sncast --profile="$PROFILE" --wait declare --contract-name=wager_war 2>&1) || true
echo "$WAR_DECLARE"
WAR_CLASS=$(echo "$WAR_DECLARE" | extract_class_hash)
[[ -n "$WAR_CLASS" ]] || { echo "ERROR: no wager_war class hash"; exit 1; }

echo "==> declare blackjack_anonymizer…"
ANON_DECLARE=$(sncast --profile="$PROFILE" --wait declare --contract-name=blackjack_anonymizer 2>&1) || true
echo "$ANON_DECLARE"
ANON_CLASS=$(echo "$ANON_DECLARE" | extract_class_hash)
[[ -n "$ANON_CLASS" ]] || { echo "ERROR: no anonymizer class hash"; exit 1; }

echo "==> deploy blackjack_game…"
DEPLOY_OUT=$(sncast --profile="$PROFILE" --wait deploy \
  --class-hash="$CLASS_HASH" \
  --salt="${DEPLOY_SALT_BJ:-21}" \
  --constructor-calldata "$SHOE_SEED" "$OWNER" 2>&1) || true
echo "$DEPLOY_OUT"
CONTRACT=$(echo "$DEPLOY_OUT" | extract_contract)
[[ -n "$CONTRACT" ]] || { echo "ERROR: no blackjack address"; exit 1; }

echo "==> deploy wager_war…"
WAR_DEPLOY=$(sncast --profile="$PROFILE" --wait deploy \
  --class-hash="$WAR_CLASS" \
  --salt="${DEPLOY_SALT_WAR:-22}" \
  --constructor-calldata "$OWNER" 2>&1) || true
echo "$WAR_DEPLOY"
WAR_CONTRACT=$(echo "$WAR_DEPLOY" | extract_contract)
[[ -n "$WAR_CONTRACT" ]] || { echo "ERROR: no wager_war address"; exit 1; }

echo "==> deploy blackjack_anonymizer…"
ANON_DEPLOY=$(sncast --profile="$PROFILE" --wait deploy \
  --class-hash="$ANON_CLASS" \
  --salt="${DEPLOY_SALT_ANON:-23}" \
  --constructor-calldata "$CONTRACT" "$STRK_TOKEN" "$PRIVACY_POOL" 2>&1) || true
echo "$ANON_DEPLOY"
ANON_CONTRACT=$(echo "$ANON_DEPLOY" | extract_contract)
[[ -n "$ANON_CONTRACT" ]] || { echo "ERROR: no anonymizer address"; exit 1; }

echo "==> link game <-> war…"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=set_game \
  --calldata "$CONTRACT"

sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$CONTRACT" \
  --function=set_wager_war \
  --calldata "$WAR_CONTRACT"

echo "==> set_strk_vault (gates free buy_in)…"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$CONTRACT" \
  --function=set_strk_vault \
  --calldata "$STRK_TOKEN" "$ANON_CONTRACT"

echo "==> set_default_relayer…"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$CONTRACT" \
  --function=set_default_relayer \
  --calldata "$TABLE_RELAYER"

START_TS=$(date +%s)
END_TS=$((START_TS + WAR_SECONDS))
echo "==> open_season $START_TS → $END_TS"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=open_season \
  --calldata "$START_TS" "$END_TS"

python3 - <<PY
import json
from pathlib import Path
contracts = Path(r"$CONTRACTS")
bj = json.loads((contracts / "target/dev/shoe_blackjack_game.contract_class.json").read_text())
war = json.loads((contracts / "target/dev/shoe_wager_war.contract_class.json").read_text())
anon = json.loads((contracts / "target/dev/shoe_blackjack_anonymizer.contract_class.json").read_text())
Path(r"$ABI_OUT").write_text(json.dumps(bj["abi"], indent=2) + "\n")
Path(r"$WAR_ABI_OUT").write_text(json.dumps(war["abi"], indent=2) + "\n")
Path(r"$ANON_ABI_OUT").write_text(json.dumps(anon["abi"], indent=2) + "\n")
data = {
  "network": "mainnet",
  "rpcUrl": r"$RPC",
  "chainId": "SN_MAIN",
  "blackjackGame": r"$CONTRACT",
  "wagerWar": r"$WAR_CONTRACT",
  "anonymizer": r"$ANON_CONTRACT",
  "shoeSeed": r"$SHOE_SEED",
  "warStartTs": $START_TS,
  "warEndTs": $END_TS,
  "classHash": r"$CLASS_HASH",
  "wagerWarClassHash": r"$WAR_CLASS",
  "anonymizerClassHash": r"$ANON_CLASS",
  "tableRelayer": r"$TABLE_RELAYER",
  "note": "Mainnet deploy — addresses only. Never put relayer PK in VITE_*. App: VITE_NETWORK=mainnet npm run dev",
}
Path(r"$DEPLOYMENTS").write_text(json.dumps(data, indent=2) + "\n")
print("Wrote", r"$DEPLOYMENTS")
print("Blackjack", r"$CONTRACT")
print("WagerWar", r"$WAR_CONTRACT")
print("Anonymizer", r"$ANON_CONTRACT")
print("Table relayer", r"$TABLE_RELAYER")
PY

echo "Done. Voyager: https://voyager.online/contract/${CONTRACT}"
echo "UI: cd app && VITE_NETWORK=mainnet npm run dev"
echo "NOTE: free buy_in is disabled after set_strk_vault — use deposit_strk / private buy-in."
echo "NOTE: do not set VITE_RELAYER_PRIVATE_KEY on mainnet — run a backend relayer."
