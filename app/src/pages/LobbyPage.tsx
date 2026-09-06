import { useState } from "react";

type Props = {
  onEnterTable: (mode: "localnet" | "local") => void;
};

export function LobbyPage({ onEnterTable }: Props) {
  const [pass, setPass] = useState("");
  const [stake, setStake] = useState<"prive" | "social">("social");
  const [name, setName] = useState("Velvet Shoe");
  const [error, setError] = useState<string | null>(null);

  const enter = (mode: "localnet" | "local") => {
    if (pass && pass.toUpperCase() !== "V21-8841" && pass.length < 4) {
      setError("Enter a valid suite pass (try V21-8841)");
      return;
    }
    setError(null);
    onEnterTable(mode);
  };

  return (
    <main className="page page--lobby">
      <section className="lobby-hero">
        <p className="lobby-hero__eyebrow">Private Salon Series</p>
        <h1 className="lobby-hero__title">Your Table</h1>
        <p className="lobby-hero__sub">
          Instant entry to a sealed shoe · H17 · BJ 3:2 · Wager War seasons on Localnet
        </p>
      </section>

      <div className="lobby-grid">
        <section className="glass-panel lobby-card">
          <h2>
            <span aria-hidden>🎰</span> Instant Entry
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
            <button type="button" className="btn btn--deal" onClick={() => enter("localnet")}>
              Enter Suite · Localnet
            </button>
            <button type="button" className="btn btn--gold" onClick={() => enter("local")}>
              Practice · Off-chain
            </button>
          </div>
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Latency: local · Shoe sealed until tx confirms
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
              <strong>Shoe Deck Density</strong>
              <span>1 deck local · 6-deck UI label</span>
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

          <button type="button" className="btn btn--hit" onClick={() => enter("localnet")}>
            Open {name || "table"} →
          </button>
        </section>
      </div>
    </main>
  );
}
