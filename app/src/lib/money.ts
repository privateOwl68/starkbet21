/** Chip / STRK display helpers for demo stacks vs vault (wei) stacks. */

import { formatWeiAsStrk } from "./strk20";

/** Stacks at or above this are treated as STRK wei (private buy-in / vault). */
export const VAULT_STACK_THRESHOLD = 10n ** 12n;

export const STRK_WEI = 10n ** 18n;
/** 1 chip = 1 STRK on the vault table. */
export const CHIP_WEI = STRK_WEI;
/** Minimum table bet when playing with vault chips. */
export const MIN_BET_WEI = CHIP_WEI; // 1 STRK
/** Maximum table bet when playing with vault chips. */
export const MAX_BET_WEI = 500n * CHIP_WEI; // 500 STRK
/** Display precision for table chip / stack amounts. */
export const CHIP_DECIMALS = 3;
/** Chip tray denoms in wei for vault mode: 1, 10, 25, 50, 100. */
export const CHIP_DENOMS_WEI = [
  1n * CHIP_WEI,
  10n * CHIP_WEI,
  25n * CHIP_WEI,
  50n * CHIP_WEI,
  100n * CHIP_WEI,
] as const;

export function isVaultStack(stack: bigint): boolean {
  return stack >= VAULT_STACK_THRESHOLD;
}

function strkChip(amount: bigint): string {
  return formatWeiAsStrk(amount, CHIP_DECIMALS);
}

export function formatStack(stack: bigint): string {
  if (isVaultStack(stack)) {
    return `${strkChip(stack)} STRK`;
  }
  const n = Number(stack);
  if (!Number.isFinite(n)) return stack.toString();
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

export function formatBet(amount: bigint, vault: boolean): string {
  if (vault || isVaultStack(amount)) {
    return `${strkChip(amount)} STRK`;
  }
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount.toString();
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

export function chipLabelWei(amount: bigint): string {
  if (amount % CHIP_WEI === 0n) {
    return (amount / CHIP_WEI).toString();
  }
  return strkChip(amount);
}

/** Safe Number for UI meters that still expect number (caps huge wei). */
export function stackToMeterNumber(stack: bigint): number {
  if (!isVaultStack(stack)) {
    const n = Number(stack);
    return Number.isFinite(n) ? n : 0;
  }
  // Show milli-STRK as integer so the header meter stays readable.
  const milli = stack / 10n ** 15n;
  const n = Number(milli);
  return Number.isFinite(n) ? n : 0;
}

/** Wager War volume — wei stacks shown as STRK (÷ 10^18); demo chips as $. */
export function formatWarVolume(volume: bigint | number): string {
  const v = typeof volume === "bigint" ? volume : BigInt(Math.trunc(volume));
  if (isVaultStack(v)) {
    return `${formatWeiAsStrk(v, CHIP_DECIMALS)} STRK`;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return v.toString();
  return `$${n.toLocaleString()}`;
}
