import { badgeLabel, type WarReward } from "../lib/warRewards";
import { formatWarVolume } from "../lib/money";

type Props = {
  seasonId: number;
  reward: WarReward;
  volume: bigint | number;
  onContinue: () => void;
};

export function WarEndSplash({ seasonId, reward, volume, onContinue }: Props) {
  return (
    <div className="splash splash--bj war-end" role="dialog" aria-modal="true" aria-label="War results">
      <div className="splash__scrim" />
      <div className="splash__rays" aria-hidden />
      <div className="splash__card">
        <p className="splash__verified">Season closed · points only</p>
        <h2 className="splash__title">Wager War #{seasonId}</h2>
        <p className="splash__sub">
          {reward.rank != null
            ? `You placed #${reward.rank} · ${reward.label}`
            : "Thanks for playing — no volume recorded"}
        </p>
        <dl className="splash__ledger">
          <div>
            <dt>Volume wagered</dt>
            <dd>{formatWarVolume(volume)}</dd>
          </div>
          <div>
            <dt>XP earned</dt>
            <dd className="is-gain">+{reward.xp}</dd>
          </div>
        </dl>
        {reward.badges.length > 0 && (
          <ul className="war-badges">
            {reward.badges.map((b) => (
              <li key={b} className={`war-badge war-badge--${b}`}>
                {badgeLabel(b)}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn--deal splash__cta" onClick={onContinue}>
          Back to board
        </button>
      </div>
    </div>
  );
}
