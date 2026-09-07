import { ApprovalPanel } from "../components/ApprovalPanel";
import { PrivacyPanel } from "../components/PrivacyPanel";
import { networkDisplayName } from "../lib/deployment";
import { formatStack } from "../lib/money";
import { useWallet } from "../lib/WalletContext";

type Props = {
  onEnterTable: () => void;
  tableStack?: bigint;
  onStackRefresh?: () => void;
};

export function LobbyPage({ onEnterTable, tableStack = 0n, onStackRefresh }: Props) {
  const { address, connectWallet, connecting, deployment } = useWallet();
  const netLabel = networkDisplayName(deployment.network);

  return (
    <main className="page page--lobby">
      <section className="lobby-hero">
        <p className="lobby-hero__eyebrow">Starknet · {netLabel}</p>
        <h1 className="lobby-hero__title">StarkBet 21</h1>
        <p className="lobby-hero__sub">
          Seal the deal on-chain. Mint chips, authorize gasless play, then hit the table.
        </p>
      </section>

      <section className="lobby-chips glass-panel" aria-live="polite">
        <div className="lobby-chips__meta">
          <span className="lobby-chips__label">Table chips</span>
          <strong className="lobby-chips__value">
            {address ? formatStack(tableStack) : "Connect wallet"}
          </strong>
          <p className="lobby-chips__hint">
            Game-contract stack — not your Ready ERC-20 balance. Mint below, then play.
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
              <button type="button" className="btn btn--deal" onClick={onEnterTable}>
                Enter table
              </button>
            </>
          )}
        </div>
      </section>

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
