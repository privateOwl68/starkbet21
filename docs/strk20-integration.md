# STRK20 integration — StarkBet21

> Anonymizer + Wallet API builders for private buy-in / cash-out.  
> **Mainnet + Sepolia anonymizers are deployed.** Treat vault as custody-sensitive.  
> Contact STRK20 team if pool calldata shapes change.

**Scoring context:** this track is **30%** of the hackathon rubric — see `[hackathon-scorecard.md](./hackathon-scorecard.md)`.

## Trust boundary


| Actor                  | Holds                            | Sees                                      |
| ---------------------- | -------------------------------- | ----------------------------------------- |
| User wallet            | Spending key, viewing key, notes | Full private state                        |
| StarkBet21 dapp        | Nothing private                  | Builds `STRK20_ACTION[]` only             |
| Privacy pool           | Notes / nullifiers               | Deposit/withdraw edges, open-note amounts |
| `blackjack_anonymizer` | Mid-tx STRK only                 | Called only by pinned pool                |
| `BlackjackGame` vault  | Parked STRK + chip stacks        | Public stacks once credited               |


**Hidden:** who funded a buy-in, private transfers, note graph.  
**Visible:** pool→anonymizer transfers, cash-out open-note amounts, `player` address in invoke calldata, timing.

Never ask the user for a viewing key.

## Deployed anonymizers


| Network | Anonymizer                                                                                                          | Pool              |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Mainnet | `[0x051b…abf0](https://voyager.online/contract/0x051b53e4e95c5643507ed07b5d5736486f8e7810b147813ab374c394ffe8abf0)` | `0x040337b1…812a` |
| Sepolia | See `deployments.sepolia.json`                                                                                      | `0x0254a6b2…0d91` |


Game vault is set via `set_strk_vault(STRK, anonymizer)` — free `buy_in` is disabled afterward.

## Contracts


| Contract               | Role                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `blackjack_anonymizer` | `privacy_invoke(op, player, amount, note_id) → Span<OpenNoteDeposit>`    |
| `BlackjackGame`        | `credit_buy_in` / `release_cash_out` (anonymizer-only); `set_strk_vault` |
| `OpenNoteDeposit`      | Same layout as `privacy::objects::OpenNoteDeposit`                       |




### Ops


| `op`         | Flow                                                 | Return                |
| ------------ | ---------------------------------------------------- | --------------------- |
| `0` BUY_IN   | Pool withdrew STRK → transfer to game → credit chips | Empty span            |
| `1` CASH_OUT | Burn chips → STRK to anonymizer → `approve(pool)`    | One open-note deposit |


Pinned `privacy_pool` in constructor; non-pool callers revert `CALLER_NOT_PRIVACY`.

## Wallet API actions (`app/src/lib/strk20.ts`)

Requires **starknet.js ≥ 10.4.0** and Wallet API **≥ 0.10.3** (Ready).

```ts
import { privateBuyIn, privateCashOut, shieldStrk } from "./lib/strk20"

await account.strk20InvokeTransaction(shieldStrk(amount))
await account.strk20InvokeTransaction(privateBuyIn(cfg, amount))
await account.strk20InvokeTransaction(privateCashOut(cfg, amount))
```

Cash-out uses `amount: "OPEN"` + `${openNoteIds[0]}` placeholder per STRK20 private DeFi docs.

Lobby **Privacy** panel submits live when the connected wallet supports STRK20.

## Shadow accounts (stealth table seat)

Prerelease wallet path: `strk20ShadowAccountCommitment("StarkBet21", nonce)` then
`shadow_account_invoke` with table calls. Use a fresh nonce per unlinkable seat.
Credit buy-in `player` = shadow address so the main wallet never appears on the game contract.

**Status:** designed + documented; **E2E seat not shipped** — highest remaining STRK20 depth win.

## Tests

```bash
cd contracts && snforge test test_anonymizer
```



## Deploy order

1. Deploy `BlackjackGame` + `WagerWar`, link as today.
2. Deploy `blackjack_anonymizer(game, STRK, privacy_pool)` — use **mainnet** pool on mainnet.
3. `set_strk_vault(STRK, anonymizer)` on the game.
4. `set_default_relayer` (optional gasless).
5. Point the Lobby Privacy panel at the anonymizer (from `getDeployment()`).
6. Dry-run with `strk20PrepareInvoke` before first live invoke.

Scripts: `./scripts/deploy_sepolia.sh`, `ALLOW_MAINNET_DEPLOY=1 ./scripts/deploy_mainnet.sh`.

## Scoring depth checklist

- [x] Anonymizer contract (`privacy_invoke` + open notes)
- [x] Shielded buy-in / cash-out path (chip vault ↔ STRK)
- [x] Wallet API action builders (shield, transfer, unshield, invoke)
- [x] Trust-boundary docs
- [x] Anonymizer deployed on Sepolia
- [x] Anonymizer deployed on **Mainnet**
- [x] Live wallet submit path in UI (`strk20InvokeTransaction` when Ready supports it)
- [x] Recorded mainnet private round-trip (shield → buy-in → play → cash-out) for judges
- [x] Shadow-account end-to-end play
- [x] Optional SDK route for operator-held demo keys