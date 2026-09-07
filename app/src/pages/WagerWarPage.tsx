import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandHeader } from "../components/BrandHeader";
import { WarBanner } from "../components/WarBanner";
import { WarEndSplash } from "../components/WarEndSplash";
import { createWagerWarClient, type LeaderRow, type SeasonInfo } from "../lib/wagerWar";
import { badgeLabel, rewardsForRank, type WarReward } from "../lib/warRewards";
import { formatWarVolume } from "../lib/money";

export function WagerWarPage() {
  const client = useMemo(() => {
    try {
      return createWagerWarClient();
    } catch {
      return null;
    }
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [volume, setVolume] = useState(0n);
  const [rank, setRank] = useState<number | null>(null);
  const [reward, setReward] = useState<WarReward | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!client) {
      setError("Deploy WagerWar first: ./scripts/deploy_local.sh");
      setLoading(false);
      return;
    }
    try {
      const snap = await client.snapshot();
      setSeason(snap.season);
      setBoard(snap.board);
      setVolume(snap.volume);
      setRank(snap.rank);
      setReward(snap.reward);
      setError(null);
      if (!snap.season.live && snap.season.open === false && snap.season.seasonId > 0) {
        setShowEnd(true);
      } else if (!snap.season.live && snap.season.seasonId > 0 && Date.now() / 1000 >= snap.season.endTs) {
        setShowEnd(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const youReward = reward ?? rewardsForRank(rank, volume);

  return (
    <main className="page page--war">
      <BrandHeader
        eyebrow="Competitive · volume race"
        tagline="Most chips wagered wins the war · XP & badges only (V1)"
      />

      {season && (
        <WarBanner
          live={season.live}
          endTs={season.endTs}
          volume={volume}
          rank={rank}
          seasonId={season.seasonId}
        />
      )}

      <section className="war-board glass-panel">
        <header className="war-board__head">
          <h2>Leaderboard</h2>
          <button type="button" className="btn ghost" disabled={loading} onClick={() => void refresh()}>
            Refresh
          </button>
        </header>

        {loading && <p className="tagline">Loading season…</p>}
        {error && (
          <p className="hint" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {!loading && !error && board.length === 0 && (
          <p className="hint">No wagers yet — deal hands on Localnet while the war is live.</p>
        )}

        {board.length > 0 && (
          <ol className="war-board__list">
            {board.map((row) => (
              <li key={row.player} className={`war-board__row${row.isYou ? " is-you" : ""}`}>
                <span className="war-board__rank">#{row.rank}</span>
                <span className="war-board__player">
                  {row.isYou ? "You" : `${row.player.slice(0, 6)}…${row.player.slice(-4)}`}
                </span>
                <span className="war-board__hands">{row.hands} hands</span>
                <span className="war-board__vol">{formatWarVolume(row.volume)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="war-rewards glass-panel">
        <h2>Your rewards</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          XP and badges unlock when the season ends. No token payout in V1.
        </p>
        <p className="war-rewards__xp">
          Projected <strong>+{youReward.xp} XP</strong>
          {youReward.rank != null ? ` · #${youReward.rank}` : ""}
        </p>
        <ul className="war-badges">
          {youReward.badges.length === 0 && <li className="war-badge war-badge--muted">Play to earn</li>}
          {youReward.badges.map((b) => (
            <li key={b} className={`war-badge war-badge--${b}`}>
              {badgeLabel(b)}
            </li>
          ))}
        </ul>
      </section>

      {showEnd && season && (
        <WarEndSplash
          seasonId={season.seasonId}
          reward={youReward}
          volume={volume}
          onContinue={() => setShowEnd(false)}
        />
      )}
    </main>
  );
}
