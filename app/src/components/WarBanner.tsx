import { useEffect, useState } from "react";

type Props = {
  live: boolean;
  endTs: number;
  volume: bigint | number;
  rank: number | null;
  seasonId: number;
  onOpenBoard?: () => void;
};

function formatRemaining(endTs: number, now: number) {
  const left = Math.max(0, endTs - now);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WarBanner({ live, endTs, volume, rank, seasonId, onOpenBoard }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const vol = typeof volume === "bigint" ? volume : BigInt(volume);
  const ended = !live && seasonId > 0;

  return (
    <div className={`war-banner${live ? " is-live" : ""}${ended ? " is-ended" : ""}`}>
      <div className="war-banner__main">
        <span className="war-banner__tag">{live ? "Live war" : ended ? "War ended" : "No war"}</span>
        <strong className="war-banner__title">Wager War #{seasonId || "—"}</strong>
        {live && (
          <span className="war-banner__timer" aria-live="polite">
            {formatRemaining(endTs, now)} left
          </span>
        )}
      </div>
      <div className="war-banner__stats">
        <span>
          Your volume <strong>${vol.toLocaleString()}</strong>
        </span>
        <span>
          Rank <strong>{rank != null ? `#${rank}` : "—"}</strong>
        </span>
        {onOpenBoard && (
          <button type="button" className="btn ghost war-banner__link" onClick={onOpenBoard}>
            Leaderboard
          </button>
        )}
      </div>
    </div>
  );
}
