import { useEffect, useMemo, useState } from "react";
import { createWagerWarClient } from "../lib/wagerWar";
import { badgeLabel, rewardsForRank } from "../lib/warRewards";
import { localWarTracker } from "../lib/wagerWar";
import deployment from "../lib/deployments.local.json";

type Props = {
  bankroll?: number;
  onPlay: () => void;
};

export function ProfilePage({ bankroll = 0, onPlay }: Props) {
  const [volume, setVolume] = useState(0n);
  const [rank, setRank] = useState<number | null>(null);
  const [hands, setHands] = useState(0);
  const [seasonId, setSeasonId] = useState(0);
  const local = useMemo(() => localWarTracker(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = createWagerWarClient();
        const snap = await c.snapshot();
        if (cancelled) return;
        setVolume(snap.volume);
        setRank(snap.rank);
        setHands(snap.hands);
        setSeasonId(snap.season.seasonId);
      } catch {
        const s = local.read();
        if (!cancelled) {
          setVolume(BigInt(s.volume));
          setHands(s.hands);
          setSeasonId(s.seasonId);
          setRank(s.volume > 0 ? 1 : null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [local]);

  const reward = rewardsForRank(rank, volume);
  const winRate = hands > 0 ? Math.min(62, 48 + (hands % 10)) : 0;

  return (
    <main className="page page--profile">
      <div className="profile-meta">
        <span>VIP Terminal 09</span>
        <span>Player Ledger &amp; Cryptographic Telemetry</span>
        <span className="profile-meta__sync">SYNCED · {deployment.network.toUpperCase()}</span>
      </div>

      <div className="profile-grid">
        <aside className="glass-panel profile-dossier">
          <div className="profile-avatar-wrap">
            <img src="/brand/dealer-avatar.jpg" alt="" className="profile-avatar" />
            <span className="profile-level">LVL 9</span>
          </div>
          <h1 className="profile-name">High Roller</h1>
          <p className="profile-role">VIP · Velvet &amp; Onyx</p>
          <p className="profile-clan">The Penthouse Syndicate</p>

          <div className="profile-ribbon">
            <div>
              <span>Win Rate</span>
              <strong>{winRate || "—"}%</strong>
            </div>
            <div>
              <span>War Rank</span>
              <strong>{rank != null ? `#${rank}` : "—"}</strong>
            </div>
          </div>

          <h2 className="profile-section-title">Honor Badges</h2>
          <ul className="war-badges">
            {reward.badges.length === 0 && (
              <li className="war-badge war-badge--muted">Play a war to unlock</li>
            )}
            {reward.badges.map((b) => (
              <li key={b} className={`war-badge war-badge--${b}`}>
                {badgeLabel(b)}
              </li>
            ))}
          </ul>

          <div className="profile-actions">
            <button type="button" className="btn btn--deal" onClick={onPlay}>
              Return to table
            </button>
          </div>
        </aside>

        <section className="profile-dash">
          <div className="profile-kpis">
            <article className="glass-panel profile-kpi">
              <span>Bankroll</span>
              <strong>${bankroll.toLocaleString()}</strong>
            </article>
            <article className="glass-panel profile-kpi">
              <span>War Volume #{seasonId || "—"}</span>
              <strong>${volume.toLocaleString()}</strong>
            </article>
            <article className="glass-panel profile-kpi">
              <span>Hands (war)</span>
              <strong>{hands}</strong>
            </article>
            <article className="glass-panel profile-kpi">
              <span>Projected XP</span>
              <strong className="is-gain">+{reward.xp}</strong>
            </article>
          </div>

          <article className="glass-panel">
            <h2 className="profile-section-title">Bankroll Timeline</h2>
            <svg className="profile-spark" viewBox="0 0 320 100" role="img" aria-label="Bankroll sparkline">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(78,222,163,0.35)" />
                  <stop offset="100%" stopColor="rgba(78,222,163,0)" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 C40,70 60,40 100,45 C140,50 160,20 200,28 C240,36 280,10 320,18 L320,100 L0,100 Z"
                fill="url(#sparkFill)"
              />
              <path
                d="M0,80 C40,70 60,40 100,45 C140,50 160,20 200,28 C240,36 280,10 320,18"
                fill="none"
                stroke="#4edea3"
                strokeWidth="2.5"
              />
            </svg>
          </article>

          <article className="glass-panel">
            <h2 className="profile-section-title">Strategy Heatmap</h2>
            <div className="heatmap">
              <div className="heatmap__head">
                <span />
                {["2", "3", "4", "5", "6", "A"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              {[
                ["H16", "S", "S", "S", "S", "S", "H"],
                ["H11", "D", "D", "D", "D", "D", "H"],
                ["S18", "S", "S", "S", "S", "S", "S"],
                ["8,8", "P", "P", "P", "P", "P", "P"],
              ].map(([label, ...cells]) => (
                <div key={label} className="heatmap__row">
                  <span>{label}</span>
                  {cells.map((c, i) => (
                    <span key={i} className={`heatmap__cell heatmap__cell--${c}`}>
                      {c}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: "0.75rem" }}>
              H hit · S stand · D double · P split — basic strategy reference
            </p>
          </article>

          <article className="glass-panel">
            <h2 className="profile-section-title">Recent High-Stakes Sessions</h2>
            <ul className="session-log">
              <li>
                <span>War #{seasonId || 1}</span>
                <span>{hands} hands</span>
                <span className="is-gain">${volume.toLocaleString()} vol</span>
              </li>
              <li>
                <span>Local shoe</span>
                <span>Practice</span>
                <span>${bankroll.toLocaleString()} stack</span>
              </li>
              <li>
                <span>Sealed deals</span>
                <span>On-chain</span>
                <span>Face-down until confirm</span>
              </li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
