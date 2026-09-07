# STRK20 integration — StarkBet21

> Draft anonymizer + Wallet API builders for private buy-in / cash-out.  
> **Audit before mainnet.** Contact STRK20 team if pool calldata shapes change.

## Trust boundary

| Actor | Holds | Sees |
|-------|-------|------|
| User wallet | Spending key, viewing key, notes | Full private state |
| StarkBet21 dapp | Nothing private | Builds `STRK20_ACTION[]` only |
| Privacy pool | Notes / nullifiers | Deposit/withdraw edges, open-note amounts |
| `blackjack_anonymizer` | Mid-tx STRK only | Called only by pinned pool |
| `BlackjackGame` vault | Parked STRK + chip stacks | Public stacks once credited |

**Hidden:** who funded a buy-in, private transfers, note graph.  
**Visible:** pool→anonymizer transfers, cash-out open-note amounts, `player` address in invoke calldata, timing.

Never ask the user for a viewing key.

## Contracts

| Contract | Role |
|----------|------|
| `blackjack_anonymizer` | `privacy_invoke(op, player, amount, note_id) → Span<OpenNoteDeposit>` |
| `BlackjackGame` | `credit_buy_in` / `release_cash_out` (anonymizer-only); `set_strk_vault` |
| `OpenNoteDeposit` | Same layout as `privacy::objects::OpenNoteDeposit` |

### Ops

| `op` | Flow | Return |
|------|------|--------|
| `0` BUY_IN | Pool withdrew STRK → transfer to game → credit chips | Empty span |
| `1` CASH_OUT | Burn chips → STRK to anonymizer → `approve(pool)` | One open-note deposit |

Pinned `privacy_pool` in constructor; non-pool callers revert `CALLER_NOT_PRIVACY`.

## Wallet API actions (`app/src/lib/strk20.ts`)

Requires **starknet.js ≥ 10.4.0** and Wallet API **≥ 0.10.3**.

```ts
import { privateBuyIn, privateCashOut, shieldStrk } from "./lib/strk20"

await account.strk20InvokeTransaction(shieldStrk(amount))
await account.strk20InvokeTransaction(privateBuyIn(cfg, amount))
await account.strk20InvokeTransaction(privateCashOut(cfg, amount))
```

Cash-out uses `amount: "OPEN"` + `${openNoteIds[0]}` placeholder per STRK20 private DeFi docs.

## Shadow accounts (stealth table seat)

Prerelease wallet path: `strk20ShadowAccountCommitment("StarkBet21", nonce)` then
`shadow_account_invoke` with table calls. Use a fresh nonce per unlinkable seat.
Credit buy-in `player` = shadow address so the main wallet never appears on the game contract.

## Tests

```bash
cd contracts && snforge test test_anonymizer
```

## Deploy order (Sepolia+)

1. Deploy `BlackjackGame` + `WagerWar`, link as today.  
2. Deploy `blackjack_anonymizer(game, STRK, privacy_pool)`.  
3. `set_strk_vault(STRK, anonymizer)` on the game.  
4. Point the Lobby Privacy panel at the anonymizer address.  
5. Dry-run with `strk20PrepareInvoke` before first live invoke.

## Scoring depth checklist

- [x] Anonymizer contract (`privacy_invoke` + open notes)
- [x] Shielded buy-in / cash-out path (chip vault ↔ STRK)
- [x] Wallet API action builders (shield, transfer, unshield, invoke)
- [x] Trust-boundary docs
- [ ] Live wallet submit on Sepolia/mainnet (`starknet@10.4+`)
- [ ] Shadow-account end-to-end play
- [ ] Optional SDK route for operator-held demo keys
