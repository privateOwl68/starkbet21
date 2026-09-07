/**
 * STRK20 Wallet API action builders + live submit for StarkBet21.
 *
 * Requires a privacy-enabled wallet (Wallet API >= 0.10.3) and
 * `WalletAccountV6.strk20InvokeTransaction`.
 *
 * Felts/addresses must match Wallet API schemas or Ready returns
 * INVALID_REQUEST_PAYLOAD (code 114):
 *   FELT = ^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$
 */

import { validateAndParseAddress, type WalletAccountV6 } from "starknet";

export const OP_BUY_IN = 0;
export const OP_CASH_OUT = 1;

export const SEPOLIA_STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const SEPOLIA_PRIVACY_POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";

export type Strk20Config = {
  strkToken: string;
  anonymizer: string;
  /** Player address that receives chip credit (main or shadow account). */
  player: string;
};

/** Wire shape compatible with STRK20_ACTION (all amounts/addresses as 0x-felts). */
export type Strk20Action =
  | { type: "deposit"; token: string; amount: string }
  | { type: "withdraw"; token: string; amount: string; recipient: string }
  | { type: "transfer"; token: string; amount: string | "OPEN"; recipient: string }
  | { type: "invoke"; contract: string; calldata: string[] };

/** Encode a bigint/number/hex string as a Wallet API FELT (0x-hex, no leading zeros). */
export function toFelt(value: bigint | number | string): string {
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "OPEN") return t;
    if (t.startsWith("${")) return t; // wallet placeholders
    if (t.startsWith("0x") || t.startsWith("0X")) {
      const hex = t.slice(2).replace(/^0+/, "") || "0";
      return `0x${hex}`;
    }
    return toFelt(BigInt(t));
  }
  const n = typeof value === "bigint" ? value : BigInt(value);
  if (n < 0n) throw new Error("felt must be non-negative");
  return `0x${n.toString(16)}`;
}

/**
 * Normalize a Starknet address for Wallet API ADDRESS fields.
 * Must satisfy FELT pattern (no 0x00… padding).
 */
export function toAddress(value: string): string {
  return toFelt(validateAndParseAddress(value));
}

export function parseStrkToWei(human: string): bigint {
  const t = human.trim();
  if (!t || Number.isNaN(Number(t))) throw new Error("Invalid STRK amount");
  const [whole, frac = ""] = t.split(".");
  const fracPad = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPad || "0");
}

export function formatWeiAsStrk(wei: bigint, fractionDigits?: number): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / 10n ** 18n;
  const rem = v % 10n ** 18n;

  if (fractionDigits != null) {
    const digits = Math.max(0, Math.min(18, Math.floor(fractionDigits)));
    const scale = 10n ** BigInt(18 - digits);
    // Round half-up to the requested precision.
    const rounded = (rem + scale / 2n) / scale;
    const carry = rounded / 10n ** BigInt(digits);
    const fracPart = rounded % 10n ** BigInt(digits);
    const wholeOut = whole + carry;
    const frac = fracPart.toString().padStart(digits, "0");
    const s = digits === 0 ? wholeOut.toString() : `${wholeOut}.${frac}`;
    return neg ? `-${s}` : s;
  }

  const frac = rem.toString().padStart(18, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${s}` : s;
}

export function shieldStrk(amount: bigint, token = SEPOLIA_STRK): Strk20Action[] {
  return [{ type: "deposit", token: toAddress(token), amount: toFelt(amount) }];
}

export function unshieldStrk(
  amount: bigint,
  recipient: string,
  token = SEPOLIA_STRK,
): Strk20Action[] {
  return [
    {
      type: "withdraw",
      token: toAddress(token),
      amount: toFelt(amount),
      recipient: toAddress(recipient),
    },
  ];
}

export function privateTransfer(
  amount: bigint,
  recipient: string,
  token = SEPOLIA_STRK,
): Strk20Action[] {
  return [
    {
      type: "transfer",
      token: toAddress(token),
      amount: toFelt(amount),
      recipient: toAddress(recipient),
    },
  ];
}

/**
 * Private buy-in: withdraw shielded STRK to the anonymizer, then privacy_invoke.
 *
 * Matches the SDK sandwich (withdraw → invoke). Calldata order MUST match
 * `blackjack_anonymizer::privacy_invoke(op, player, amount, note_id)`.
 */
export function privateBuyIn(cfg: Strk20Config, amount: bigint): Strk20Action[] {
  if (!cfg.anonymizer || cfg.anonymizer.includes("REPLACE") || cfg.anonymizer === "0xANONYMIZER") {
    throw new Error(
      "Anonymizer not deployed — set anonymizer in deployments or run deploy_sepolia.sh with STRK_TOKEN + PRIVACY_POOL",
    );
  }
  if (amount <= 0n) throw new Error("Buy-in amount must be > 0");

  const token = toAddress(cfg.strkToken);
  const anonymizer = toAddress(cfg.anonymizer);
  const player = toAddress(cfg.player);
  const amt = toFelt(amount);

  return [
    {
      type: "withdraw",
      token,
      amount: amt,
      recipient: anonymizer,
    },
    {
      type: "invoke",
      contract: anonymizer,
      calldata: [toFelt(OP_BUY_IN), player, amt, "0x0"],
    },
  ];
}

/**
 * Private cash-out: open note + invoke (pool pulls STRK via approve).
 */
export function privateCashOut(cfg: Strk20Config, amount: bigint): Strk20Action[] {
  if (!cfg.anonymizer || cfg.anonymizer.includes("REPLACE")) {
    throw new Error("Anonymizer not deployed");
  }
  if (amount <= 0n) throw new Error("Cash-out amount must be > 0");

  const token = toAddress(cfg.strkToken);
  const anonymizer = toAddress(cfg.anonymizer);
  const player = toAddress(cfg.player);
  const amt = toFelt(amount);

  return [
    {
      type: "transfer",
      token,
      amount: "OPEN",
      recipient: player,
    },
    {
      type: "invoke",
      contract: anonymizer,
      calldata: [toFelt(OP_CASH_OUT), player, amt, "${openNoteIds[0]}"],
    },
  ];
}

export type Strk20SubmitResult = {
  transaction_hash: string;
};

function explainWalletError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("INVALID_REQUEST_PAYLOAD") || msg.includes("(114)")) {
    return `${msg} — STRK20 felts must be 0x-hex (not decimal); addresses must be valid Starknet addresses. Shield STRK first if the note set is empty.`;
  }
  if (msg.includes("INSUFFICIENT_PRIVATE_BALANCE") || msg.includes("(119)")) {
    return `${msg} — Shield STRK into the privacy pool first, wait for note maturity (~10 blocks), then retry private buy-in.`;
  }
  if (msg.includes("NOT_REGISTERED") || msg.includes("(118)")) {
    return `${msg} — Register / enable privacy in Ready before private actions.`;
  }
  return msg;
}

/** Live submit via privacy-enabled WalletAccountV6. */
export async function submitStrk20Actions(
  account: WalletAccountV6,
  actions: Strk20Action[],
): Promise<Strk20SubmitResult> {
  if (typeof account.strk20InvokeTransaction !== "function") {
    throw new Error(
      "Connected wallet has no strk20InvokeTransaction — need Wallet API ≥ 0.10.3 (Ready / privacy-enabled)",
    );
  }
  try {
    const res = await account.strk20InvokeTransaction(actions as never);
    const hash =
      (res as { transaction_hash?: string }).transaction_hash ??
      (res as { transactionHash?: string }).transactionHash ??
      String(res);
    return { transaction_hash: hash };
  } catch (e) {
    throw new Error(explainWalletError(e));
  }
}

/** Optional dry-run (simulate) before live submit. */
export async function prepareStrk20Actions(
  account: WalletAccountV6,
  actions: Strk20Action[],
  simulate = true,
) {
  if (typeof account.strk20PrepareInvoke !== "function") {
    throw new Error("Wallet has no strk20PrepareInvoke");
  }
  try {
    return await account.strk20PrepareInvoke(actions as never, simulate);
  } catch (e) {
    throw new Error(explainWalletError(e));
  }
}

export function explorerTxUrl(network: string, hash: string): string {
  if (network === "mainnet") return `https://voyager.online/tx/${hash}`;
  return `https://sepolia.voyager.online/tx/${hash}`;
}

export type PrivateBalance = {
  token: string;
  /** Smallest units (wei). */
  balance: bigint;
  /** Human STRK string when token is STRK. */
  display: string;
};

/**
 * Read shielded balances via Wallet API.
 * Triggers a wallet consent prompt — call only when the user asks / after connect.
 */
export async function fetchPrivateBalances(
  account: WalletAccountV6,
  tokens: string[] = [SEPOLIA_STRK],
): Promise<PrivateBalance[]> {
  if (typeof account.strk20Balances !== "function") {
    throw new Error("Wallet has no strk20Balances");
  }
  const addrs = tokens.map((t) => toAddress(t));
  const entries = await account.strk20Balances(addrs as never);
  return entries.map((e) => {
    const bal = BigInt(e.balance);
    const tokenNorm = toAddress(e.token);
    const isStrk = BigInt(tokenNorm) === BigInt(toAddress(SEPOLIA_STRK));
    return {
      token: tokenNorm,
      balance: bal,
      display: isStrk ? formatWeiAsStrk(bal) : bal.toString(),
    };
  });
}

export function shadowAccountNotes(): string {
  return "Use wallet strk20ShadowAccountCommitment('StarkBet21', nonce) then shadow_account_invoke with collect_policy diff for unlinked table play.";
}

export function describeTrustBoundary(): string {
  return [
    "Hidden: note owners, private transfer graph, which notes funded the buy-in.",
    "Visible: pool→anonymizer STRK transfer, open-note cash-out amounts, credited player address in invoke calldata, timing.",
    "Keys: wallet holds viewing + spending keys; StarkBet21 never requests a viewing key.",
  ].join(" ");
}
