import { useState } from "react";
import { ApprovalPanel } from "../components/ApprovalPanel";
import { PrivacyPanel } from "../components/PrivacyPanel";
import { formatStack } from "../lib/money";
import { useWallet } from "../lib/WalletContext";

type Props = {
  onEnterTable: () => void;
  tableStack?: bigint;
  onStackRefresh?: () => void;
};

export function LobbyPage({ onEnterTable, tableStack = 0n, onStackRefresh }: Props) {
  const { address, connectWallet, connecting } = useWallet();
  const [pass, setPass] = useState("");
  const [stake, setStake] = useState<"prive" | "social">("social");
  const [name, setName] = useState("StarkBet Suite");
  const [error, setError] = useState<string | null>(null);

  const enter = () => {
    if (pass && pass.toUpperCase() !== "V21-8841" && pass.length < 4) {
      setError("Enter a valid suite pass (try V21-8841)");
      return;
    }
    setError(null);
    onEnterTable();
  };

  return (
    <main className="page page--lobby">
      <section className="lobby-hero">
        <p className="lobby-hero__eyebrow">Private Salon Series</p>
        <h1 className="lobby-hero__title">Your Table</h1>
        <p className="lobby-hero__sub">Sealed on-chain blackjack with wallet buy-in and optional gasless play</p>
      </section>

      <section className="lobby-chips glass-panel" aria-live="polite">
        <div className="lobby-chips__meta">
          <span className="lobby-chips__label">Table chips</span>
          <strong className="lobby-chips__value">
            {address ? formatStack(tableStack) : "Connect wallet"}
          </strong>
          <p className="lobby-chips__hint">
            On-chain stack in the game contract (not your Ready ERC-20 balance). Mint via Pre-approve or Private buy-in.
          </p>
        </div>
        <div className="lobby-chips__actions">
          {!address ? (
            <button
              type="button"
              className="btn btn--hit"
              disabled={connecting}
              onClick={() => void connectWallet()}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => onStackRefresh?.()}>
                Refresh
              </button>
              <button type="button" className="btn btn--deal" onClick={enter}>
                Play
              </button>
            </>
          )}
        </div>
      </section>

      <div className="lobby-grid">
        <section className="glass-panel lobby-card">
          <h2>
            <span aria-hidden>♠</span> Suite Entry
          </h2>
          <label className="lobby-field">
            <span>Enter VIP Room Pass</span>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="e.g. V21-8841"
              autoComplete="off"
            />
          </label>
          {error && (
            <p className="lobby-error" role="alert">
              {error}
            </p>
          )}
          <div className="lobby-actions">
            <button type="button" className="btn btn--deal" onClick={enter}>
              Enter on-chain table
            </button>
          </div>
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Connect a wallet, mint table chips, then deal sealed hands on Starknet.
          </p>
        </section>

        <section className="glass-panel lobby-card">
          <h2>Table Architect</h2>
          <p className="lobby-card__lead">Private Salon Rules &amp; Stakes</p>

          <div className="lobby-stake" role="group" aria-label="Stake tier">
            <button
              type="button"
              className={`lobby-stake__opt${stake === "prive" ? " is-active" : ""}`}
              onClick={() => setStake("prive")}
            >
              Privé ($500+)
            </button>
            <button
              type="button"
              className={`lobby-stake__opt${stake === "social" ? " is-active" : ""}`}
              onClick={() => setStake("social")}
            >
              Social ($25)
            </button>
          </div>

          <label className="lobby-field">
            <span>Lounge Designation Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <ul className="lobby-rules">
            <li>
              <strong>Shoe</strong>
              <span>On-chain sealed shoe</span>
            </li>
            <li>
              <strong>Penetration</strong>
              <span>Shuffle after shoe empty</span>
            </li>
            <li>
              <strong>Dealer Soft 17</strong>
              <span>Hits (H17)</span>
            </li>
            <li>
              <strong>Blackjack</strong>
              <span>Pays 3:2</span>
            </li>
            <li>
              <strong>Access</strong>
              <span>{stake === "prive" ? "Invite / pass" : "Open social table"}</span>
            </li>
          </ul>

          <button type="button" className="btn btn--hit" onClick={enter}>
            Open {name || "Suite"} →
          </button>
          <p className="hint" style={{ marginTop: "0.65rem" }}>
            Opens the on-chain table with your connected wallet.
          </p>
        </section>
      </div>

      <ApprovalPanel compact onChanged={() => onStackRefresh?.()} />
      <PrivacyPanel
        tableStack={tableStack}
        onBuyInSuccess={() => {
          onStackRefresh?.();
        }}
      />
    </main>
  );
}
