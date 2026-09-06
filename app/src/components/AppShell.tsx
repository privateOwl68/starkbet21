import type { ReactNode } from "react";

export type AppScreen = "lobby" | "table" | "profile" | "war";

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
  const v = typeof n === "bigint" ? Number(n) : n;
  return `$${v.toLocaleString()}`;
}

export function AppShell({
  screen,
  onNavigate,
  chips = 0,
  pot = 0,
  roomCode = "V21-8841",
  children,
}: Props) {
  const nav: { id: AppScreen; label: string }[] = [
    { id: "table", label: "Table" },
    { id: "lobby", label: "Lobby & Create" },
    { id: "war", label: "Wager War" },
    { id: "profile", label: "Profile" },
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
            <strong className="suite-meter__value suite-meter__value--chips">{money(chips)}</strong>
          </div>
          <div className="suite-header__vip" title="VIP">
            <img src="/brand/dealer-avatar.jpg" alt="" width={32} height={32} />
            <span>VIP</span>
          </div>
        </div>
      </header>

      <div className="suite-body">{children}</div>
    </div>
  );
}
