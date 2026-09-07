#!/usr/bin/env bash
# Deploy BlackjackGame + WagerWar (+ optional anonymizer) to Starknet Sepolia.
#
# Prerequisites:
#   1. sncast account on Sepolia funded with STRK
#   2. Account reachable via sncast profile (see below)
#
# Usage:
#   cp .env.example .env   # set RPC_URL + OWNER_ADDRESS
#   # Optional overrides still work via the environment:
# export ACCOUNT_NAME="user"   # must exist in `sncast account list`
#   export SHOE_SEED=42
#   export WAR_SECONDS=604800
#   # Optional STRK20 vault:
#   export STRK_TOKEN=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
#   export PRIVACY_POOL=0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91
#   ./scripts/deploy_sepolia.sh
#
# Writes app/src/lib/deployments.sepolia.json (addresses only — no private keys).
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
DEPLOYMENTS="$ROOT/app/src/lib/deployments.sepolia.json"
ABI_OUT="$ROOT/app/src/lib/blackjack_abi.json"
WAR_ABI_OUT="$ROOT/app/src/lib/wager_war_abi.json"
ANON_ABI_OUT="$ROOT/app/src/lib/blackjack_anonymizer_abi.json"

# Load KEY=VALUE from .env into the environment only when unset
# (so `RPC_URL=... ./scripts/deploy_sepolia.sh` still wins).
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  echo "==> loading ${file#"$ROOT"/}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # strip CR, skip blanks / comments
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # strip optional surrounding quotes
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

# Accept camelCase aliases from some .env layouts.
RPC_URL="${RPC_URL:-${rpcUrl:-}}"
OWNER_ADDRESS="${OWNER_ADDRESS:-${ownerAddress:-${OWNER:-}}}"

RPC="${RPC_URL:?Set RPC_URL in .env (or export it)}"
# Must match a name from `sncast account list` that is deployed on real Sepolia
# (not the localnet seed-0 address 0x64b488…)
ACCOUNT_NAME="${ACCOUNT_NAME:-sepolia}"
PROFILE="${SNCAST_PROFILE:-sepolia}"
SHOE_SEED="${SHOE_SEED:-42}"
WAR_SECONDS="${WAR_SECONDS:-604800}"
STRK_TOKEN="${STRK_TOKEN:-}"
PRIVACY_POOL="${PRIVACY_POOL:-}"
OWNER="${OWNER_ADDRESS:?Set OWNER_ADDRESS in .env (or export it)}"

# Known starknet-devnet --seed=0 account — never exists on public Sepolia.
LOCALNET_SEED0="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
OWNER_NORM=$(python3 -c "print(hex(int('$OWNER',16)))")
SEED_NORM=$(python3 -c "print(hex(int('$LOCALNET_SEED0',16)))")
if [[ "$OWNER_NORM" == "$SEED_NORM" ]]; then
  echo "ERROR: OWNER_ADDRESS is the localnet seed-0 account — it is not on Sepolia."
  echo "Create + fund a real account:"
  echo "  sncast account create --name=sepolia --network=sepolia"
  echo "  # send ≥0.08 STRK (Sepolia faucet), then:"
  echo "  sncast account deploy --name=sepolia --network=sepolia"
  exit 1
fi

export PATH="${HOME}/.asdf/shims:${PATH}"

cd "$CONTRACTS"

ACCOUNTS_FILE="${SNCAST_ACCOUNTS_FILE:-$HOME/.starknet_accounts/starknet_open_zeppelin_accounts.json}"

# Keep [sncast.PROFILE] in sync with .env (url + account name).
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

# Fail fast if the sncast account name does not exist on alpha-sepolia.
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
  echo "ERROR: sncast account '${ACCOUNT_NAME}' not found under network alpha-sepolia."
  echo "Available accounts:"
  sncast account list 2>/dev/null | grep -E '^- |network:|deployed:|address:' || true
  echo
  echo "Fix: sncast account create --name=sepolia --network=sepolia"
  exit 1
fi

if echo "$ACCOUNT_BLOCK" | grep -qi 'deployed: false'; then
  ADDR_PENDING=$(echo "$ACCOUNT_BLOCK" | python3 -c "import sys,re; m=re.search(r'address:\s+(0x[0-9a-fA-F]+)', sys.stdin.read()); print(m.group(1) if m else '')")
  echo "ERROR: sncast account '${ACCOUNT_NAME}' exists locally but is NOT deployed on Sepolia."
  echo "  Address: ${ADDR_PENDING}"
  echo "1) Prefund with ≥0.08 Sepolia STRK (faucet)."
  echo "2) sncast account deploy --name=${ACCOUNT_NAME} --network=sepolia"
  echo "3) Re-run ./scripts/deploy_sepolia.sh"
  exit 1
fi

ACCOUNT_ADDR=$(echo "$ACCOUNT_BLOCK" | python3 -c "import sys,re; m=re.search(r'address:\s+(0x[0-9a-fA-F]+)', sys.stdin.read()); print(m.group(1) if m else '')")
if [[ -n "$ACCOUNT_ADDR" ]]; then
  OWNER_INT=$(python3 -c "print(int('${OWNER}', 16))")
  ADDR_INT=$(python3 -c "print(int('${ACCOUNT_ADDR}', 16))")
  if [[ "$OWNER_INT" != "$ADDR_INT" ]]; then
    echo "ERROR: OWNER_ADDRESS (${OWNER})"
    echo "  does not match sncast account '${ACCOUNT_NAME}' (${ACCOUNT_ADDR})."
    echo "  Set OWNER_ADDRESS in .env to the account address (not the public key)."
    exit 1
  fi
fi

echo "==> profile=$PROFILE rpc=$RPC account=$ACCOUNT_NAME owner=$OWNER"
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

echo "==> link game <-> war…"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=set_game \
  --calldata "$CONTRACT"

sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$CONTRACT" \
  --function=set_wager_war \
  --calldata "$WAR_CONTRACT"

START_TS=$(date +%s)
END_TS=$((START_TS + WAR_SECONDS))
echo "==> open_season $START_TS → $END_TS"
sncast --profile="$PROFILE" --wait invoke \
  --contract-address="$WAR_CONTRACT" \
  --function=open_season \
  --calldata "$START_TS" "$END_TS"

ANON_CONTRACT=""
ANON_CLASS=""
if [[ -n "$STRK_TOKEN" && -n "$PRIVACY_POOL" ]]; then
  echo "==> declare blackjack_anonymizer…"
  ANON_DECLARE=$(sncast --profile="$PROFILE" --wait declare --contract-name=blackjack_anonymizer 2>&1) || true
  echo "$ANON_DECLARE"
  ANON_CLASS=$(echo "$ANON_DECLARE" | extract_class_hash)
  if [[ -n "$ANON_CLASS" ]]; then
    echo "==> deploy blackjack_anonymizer…"
    ANON_DEPLOY=$(sncast --profile="$PROFILE" --wait deploy \
      --class-hash="$ANON_CLASS" \
      --salt="${DEPLOY_SALT_ANON:-23}" \
      --constructor-calldata "$CONTRACT" "$STRK_TOKEN" "$PRIVACY_POOL" 2>&1) || true
    echo "$ANON_DEPLOY"
    ANON_CONTRACT=$(echo "$ANON_DEPLOY" | extract_contract)
    if [[ -n "$ANON_CONTRACT" ]]; then
      sncast --profile="$PROFILE" --wait invoke \
        --contract-address="$CONTRACT" \
        --function=set_strk_vault \
        --calldata "$STRK_TOKEN" "$ANON_CONTRACT"
      # House account is the default table relayer (players authorize it once).
      sncast --profile="$PROFILE" --wait invoke \
        --contract-address="$CONTRACT" \
        --function=set_default_relayer \
        --calldata "$OWNER"
    fi
  fi
else
  echo "==> Skipping anonymizer (set STRK_TOKEN + PRIVACY_POOL to deploy)"
fi

python3 - <<PY
import json
from pathlib import Path
contracts = Path(r"$CONTRACTS")
bj = json.loads((contracts / "target/dev/shoe_blackjack_game.contract_class.json").read_text())
war = json.loads((contracts / "target/dev/shoe_wager_war.contract_class.json").read_text())
Path(r"$ABI_OUT").write_text(json.dumps(bj["abi"], indent=2) + "\n")
Path(r"$WAR_ABI_OUT").write_text(json.dumps(war["abi"], indent=2) + "\n")
anon_path = contracts / "target/dev/shoe_blackjack_anonymizer.contract_class.json"
if anon_path.exists():
    anon = json.loads(anon_path.read_text())
    Path(r"$ANON_ABI_OUT").write_text(json.dumps(anon["abi"], indent=2) + "\n")
data = {
  "network": "sepolia",
  "rpcUrl": r"$RPC",
  "chainId": "SN_SEPOLIA",
  "blackjackGame": r"$CONTRACT",
  "wagerWar": r"$WAR_CONTRACT",
  "shoeSeed": r"$SHOE_SEED",
  "warStartTs": $START_TS,
  "warEndTs": $END_TS,
  "classHash": r"$CLASS_HASH",
  "wagerWarClassHash": r"$WAR_CLASS",
  "note": "Sepolia deploy — no private keys. App: VITE_NETWORK=sepolia npm run dev",
}
anon = r"$ANON_CONTRACT"
anon_class = r"$ANON_CLASS"
if anon:
    data["anonymizer"] = anon
if anon_class:
    data["anonymizerClassHash"] = anon_class
# Default table relayer = deploy account (players authorize it once for relayed play).
data["tableRelayer"] = r"$OWNER"
Path(r"$DEPLOYMENTS").write_text(json.dumps(data, indent=2) + "\n")
print("Wrote", r"$DEPLOYMENTS")
print("Blackjack", r"$CONTRACT")
print("WagerWar", r"$WAR_CONTRACT")
print("Anonymizer", anon or "(skipped)")
print("Table relayer", r"$OWNER")
PY

echo "Done. Voyager: https://sepolia.voyager.online/contract/${CONTRACT}"
echo "UI: cd app && VITE_NETWORK=sepolia npm run dev"
