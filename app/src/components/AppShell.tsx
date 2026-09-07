import type { ReactNode } from "react";
import { shortAddress, useWallet } from "../lib/WalletContext";
import { formatStack } from "../lib/money";

export type AppScreen = "lobby" | "table" | "war";

type Props = {
  screen: AppScreen;
  onNavigate: (s: AppScreen) => void;
  chips?: number | bigint;
  pot?: number | bigint;
  roomCode?: string;
  children: ReactNode;
};

function money(n: number | bigint | undefined) {
  if (n == null) return "—";
  if (typeof n === "bigint") return formatStack(n);
  return `$${n.toLocaleString()}`;
}

export function AppShell({
  screen,
  onNavigate,
  chips = 0,
  pot = 0,
  roomCode = "V21-8841",
  children,
}: Props) {
  const {
    address,
    connecting,
    connectWallet,
    disconnectWallet,
    networkLabel,
    isDemo,
    useLocalnetDemo,
    deployment,
    strk20Supported,
  } = useWallet();

  const nav: { id: AppScreen; label: string }[] = [
    { id: "table", label: "Table" },
    { id: "lobby", label: "Lobby" },
    { id: "war", label: "Wager War" },
  ];

  return (
    <div className="app-shell stitch-shell">
      <header className="suite-header">
        <div className="suite-header__brand">
          <img src="/brand/logo.jpg" alt="" className="suite-header__logo" width={32} height={32} />
          <span className="suite-header__wordmark">
            STARKBET <span>21</span>
          </span>
          <div className="suite-header__room" title="Private room">
            <span className="suite-header__lock" aria-hidden>
              ⌘
            </span>
            <span>Penthouse Suite #{roomCode.replace(/^V21-?/, "") || "8841"}</span>
            <span className="suite-header__net">{networkLabel}</span>
          </div>
        </div>

        <nav className="suite-nav" aria-label="Suite navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`suite-nav__btn${screen === item.id ? " is-active" : ""}`}
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="suite-header__meters">
          <div className="suite-meter">
            <span className="suite-meter__label">POT</span>
            <strong className="suite-meter__value suite-meter__value--pot">{money(pot)}</strong>
          </div>
          <div className="suite-meter">
            <span className="suite-meter__label">CHIPS</span>
            <strong className="suite-meter__value suite-meter__value--chips" title="Table chips in the game contract">
              {money(chips)}
            </strong>
          </div>

          {address ? (
            <div className="suite-wallet">
              <span className="suite-wallet__addr" title={address}>
                {isDemo ? "Demo · " : ""}
                {shortAddress(address)}
                {strk20Supported ? " · private" : ""}
              </span>
              <button type="button" className="btn ghost suite-wallet__btn" onClick={() => void disconnectWallet()}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="suite-wallet">
              <button
                type="button"
                className="btn btn--hit suite-wallet__btn"
                disabled={connecting}
                onClick={() => void connectWallet()}
              >
                {connecting ? "…" : "Connect"}
              </button>
              {deployment.network !== "sepolia" && deployment.network !== "mainnet" && (
                <button type="button" className="btn ghost suite-wallet__btn" onClick={useLocalnetDemo}>
                  Demo
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="suite-body">{children}</div>
    </div>
  );
}
