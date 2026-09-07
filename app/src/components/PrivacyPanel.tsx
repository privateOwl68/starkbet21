import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "../lib/WalletContext";
import {
  SEPOLIA_PRIVACY_POOL,
  SEPOLIA_STRK,
  describeTrustBoundary,
  explorerTxUrl,
  fetchPrivateBalances,
  formatWeiAsStrk,
  parseStrkToWei,
  privateBuyIn,
  privateCashOut,
  privateTransfer,
  shieldStrk,
  submitStrk20Actions,
  unshieldStrk,
  type PrivateBalance,
  type Strk20Action,
} from "../lib/strk20";
import { formatStack } from "../lib/money";

type Props = {
  /** Called after a successful private buy-in (refresh table stack). */
  onBuyInSuccess?: (txHash: string) => void;
  /** Compact mode for embedding under the table controls. */
  compact?: boolean;
  /** On-chain table stack (game chips) — not the same as shielded balance. */
  tableStack?: bigint;
  /** Optional DOM id for aria-controls from Buy chips. */
  id?: string;
  /** Optional close control (table drawer). */
  onClose?: () => void;
};

function previewActions(actions: Strk20Action[]) {
  return JSON.stringify(actions, null, 2);
}

export function PrivacyPanel({ onBuyInSuccess, compact = false, tableStack, id, onClose }: Props) {
  const {
    address,
    strk20Account,
    strk20Supported,
    deployment,
    connectWallet,
    connecting,
    isDemo,
    walletName,
  } = useWallet();

  const [amountStrk, setAmountStrk] = useState("1");
  const [recipient, setRecipient] = useState("");
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [privateBal, setPrivateBal] = useState<PrivateBalance | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const [balError, setBalError] = useState<string | null>(null);

  const anonymizer = deployment.anonymizer ?? "";
  const anonymizerReady = Boolean(anonymizer && !anonymizer.includes("REPLACE"));

  const cfg = useMemo(
    () => ({
      strkToken: SEPOLIA_STRK,
      anonymizer: anonymizer || "0xANONYMIZER",
      player: address ?? "0xPLAYER",
    }),
    [anonymizer, address],
  );

  const refreshPrivateBalance = useCallback(async () => {
    if (!strk20Account || !strk20Supported || isDemo) {
      setPrivateBal(null);
      return;
    }
    setBalLoading(true);
    setBalError(null);
    try {
      const rows = await fetchPrivateBalances(strk20Account, [SEPOLIA_STRK]);
      setPrivateBal(rows[0] ?? { token: SEPOLIA_STRK, balance: 0n, display: "0" });
    } catch (e) {
      setBalError(e instanceof Error ? e.message : String(e));
      setPrivateBal(null);
    } finally {
      setBalLoading(false);
    }
  }, [strk20Account, strk20Supported, isDemo]);

  useEffect(() => {
    if (strk20Account && strk20Supported && !isDemo) {
      void refreshPrivateBalance();
    } else {
      setPrivateBal(null);
      setBalError(null);
    }
  }, [strk20Account, strk20Supported, isDemo, refreshPrivateBalance]);

  const amtWei = () => parseStrkToWei(amountStrk);

  const runLive = async (label: string, build: () => Strk20Action[]) => {
    setError(null);
    setTxHash(null);
    setStatus(null);
    if (!address) {
      setError("Connect a privacy-enabled wallet first");
      return;
    }
    if (isDemo) {
      setError("Private buy-in needs a real wallet — disconnect Demo and Connect");
      return;
    }
    if (!strk20Account) {
      setError("Reconnect with the wallet picker (get-starknet v6). Prefer Ready.");
      return;
    }
    if (!strk20Supported) {
      setError(
        `${walletName ?? "This wallet"} does not expose Wallet API ≥ 0.10.3. Install Ready (ready.co), enable privacy, then reconnect.`,
      );
      return;
    }

    let actions: Strk20Action[];
    try {
      actions = build();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    setLastPayload(previewActions(actions));
    setBusy(true);
    setStatus(`${label}: proving & submitting via wallet…`);
    try {
      const { transaction_hash } = await submitStrk20Actions(strk20Account, actions);
      setTxHash(transaction_hash);
      setStatus(`${label} submitted`);
      if (label.toLowerCase().includes("buy-in")) {
        onBuyInSuccess?.(transaction_hash);
      }
      void refreshPrivateBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(`${label} failed — payload kept for debug`);
    } finally {
      setBusy(false);
    }
  };

  const balLabel = balLoading
    ? "…"
    : privateBal
      ? `${formatWeiAsStrk(privateBal.balance, 3)} STRK`
      : strk20Supported
        ? "—"
        : "n/a";

  return (
    <section id={id} className={`privacy-panel${compact ? " privacy-panel--compact" : ""}`}>
      <header className="privacy-panel__head">
        <div className="privacy-panel__title-row">
          <h2>{compact ? "Private buy-in" : "STRK20 privacy rail"}</h2>
          {onClose && (
            <button type="button" className="btn ghost privacy-panel__close" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <p>
          Live Wallet API submit · Pool <code>{SEPOLIA_PRIVACY_POOL.slice(0, 10)}…</code>
          {anonymizerReady ? (
            <>
              {" "}
              · Anonymizer <code>{anonymizer.slice(0, 10)}…</code>
            </>
          ) : (
            <span className="privacy-panel__warn"> · Anonymizer not in deployment yet</span>
          )}
        </p>
      </header>

      {!address && (
        <div className="privacy-panel__gate">
          <button
            type="button"
            className="btn btn--hit"
            disabled={connecting}
            onClick={() => void connectWallet()}
          >
            {connecting ? "Connecting…" : "Connect wallet for private buy-in"}
          </button>
        </div>
      )}

      {address && !isDemo && (
        <div className="privacy-balance" aria-live="polite">
          {strk20Supported && (
            <div className="privacy-balance__meta">
              <span className="privacy-balance__label">Shielded balance</span>
              <strong className="privacy-balance__value">{balLabel}</strong>
            </div>
          )}
          {tableStack != null && (
            <div className="privacy-balance__meta">
              <span className="privacy-balance__label">Table chips</span>
              <strong className="privacy-balance__value">{formatStack(tableStack)}</strong>
            </div>
          )}
          <button
            type="button"
            className="btn ghost privacy-balance__refresh"
            disabled={balLoading || busy}
            onClick={() => void refreshPrivateBalance()}
            title="Ask the wallet for your private STRK balance"
          >
            {balLoading ? "Reading…" : "Refresh"}
          </button>
        </div>
      )}
      {tableStack != null && (
        <p className="privacy-panel__trust">
          Table chips sit in the game contract — bet with them on Chain (min 1 · max 500). They will not appear as an ERC-20 in Ready.
        </p>
      )}
      {balError && (
        <p className="privacy-panel__error" role="alert">
          Balance: {balError}
        </p>
      )}

      <label className="privacy-panel__field">
        Amount (STRK)
        <input
          value={amountStrk}
          onChange={(e) => setAmountStrk(e.target.value)}
          inputMode="decimal"
          disabled={busy}
        />
      </label>

      <div className="privacy-panel__presets" role="group" aria-label="STRK presets">
        {["1", "10", "25"].map((p) => (
          <button
            key={p}
            type="button"
            className="chips__quick-btn"
            disabled={busy}
            onClick={() => setAmountStrk(p)}
          >
            {p} STRK
          </button>
        ))}
        {privateBal && privateBal.balance > 0n && (
          <button
            type="button"
            className="chips__quick-btn"
            disabled={busy}
            onClick={() => setAmountStrk(formatWeiAsStrk(privateBal.balance))}
            title="Use full shielded balance"
          >
            Max private
          </button>
        )}
      </div>

      {!compact && (
        <label className="privacy-panel__field">
          Transfer recipient (optional)
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
            disabled={busy}
          />
        </label>
      )}

      <div className="privacy-panel__actions">
        <button
          type="button"
          className="btn btn--hit"
          disabled={busy || !address}
          title="Shielded STRK → anonymizer → table chips"
          onClick={() => void runLive("Private buy-in", () => privateBuyIn(cfg, amtWei()))}
        >
          {busy ? "Submitting…" : "Private buy-in"}
        </button>

        {!compact && (
          <>
            <button
              type="button"
              className="btn btn--gold"
              disabled={busy || !address}
              onClick={() => void runLive("Shield", () => shieldStrk(amtWei()))}
            >
              Shield STRK
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || !address}
              onClick={() =>
                void runLive("Unshield", () => unshieldStrk(amtWei(), address!))
              }
            >
              Unshield
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || !address || !recipient}
              onClick={() =>
                void runLive("Private transfer", () => privateTransfer(amtWei(), recipient))
              }
            >
              Private transfer
            </button>
            <button
              type="button"
              className="btn btn--stand"
              disabled={busy || !address}
              onClick={() => void runLive("Private cash-out", () => privateCashOut(cfg, amtWei()))}
            >
              Private cash-out
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="privacy-panel__error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="privacy-panel__status">{status}</p>}
      {txHash && (
        <p className="privacy-panel__tx">
          Tx{" "}
          <a href={explorerTxUrl(deployment.network, txHash)} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </a>
        </p>
      )}
      {lastPayload && !compact && (
        <pre className="privacy-panel__payload" tabIndex={0}>
          {lastPayload}
        </pre>
      )}

      {compact ? (
        <p className="privacy-panel__trust">
          Shield STRK first (wait ~10 blocks), then Private buy-in.
        </p>
      ) : (
        <p className="privacy-panel__trust">
          Flow: Shield STRK → wait ~10 blocks → Private buy-in. {describeTrustBoundary()}
        </p>
      )}
    </section>
  );
}
