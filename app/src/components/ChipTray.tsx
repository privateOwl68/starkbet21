import { CHIP_DENOMS } from "../lib/hand";

type Props = {
  bankroll: number;
  bet: number;
  locked: boolean;
  onAdd: (amount: number) => void;
  onClear: () => void;
  onMax?: () => void;
  onDoubleBet?: () => void;
};

function dollars(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

function chipLabel(n: number) {
  if (n >= 1000) return `$${n / 1000}k`;
  return `$${n}`;
}

export function ChipTray({
  bankroll,
  bet,
  locked,
  onAdd,
  onClear,
  onMax,
  onDoubleBet,
}: Props) {
  return (
    <div className="chips chips--console">
      <div className="chips__stats">
        <div className="chips__stat">
          <span className="chips__label">Stack</span>
          <strong>{dollars(bankroll)}</strong>
        </div>
        <div className={`chips__stat chips__bet-spot${bet > 0 ? " is-active" : ""}`}>
          <span className="chips__label">Bet</span>
          <strong className={bet > 0 ? "is-lit" : ""}>{dollars(bet)}</strong>
        </div>
      </div>
      <span className="chips__tray-label">Select chip</span>
      <div className="chips__row" role="group" aria-label="Chip denominations">
        {CHIP_DENOMS.map((d) => (
          <button
            key={d}
            type="button"
            className={`chip chip--${d}`}
            disabled={locked || bankroll < d || bet + d > bankroll}
            onClick={() => onAdd(d)}
            aria-label={`Add ${chipLabel(d)} chip`}
          >
            {chipLabel(d)}
          </button>
        ))}
      </div>
      <div className="chips__quick" role="group" aria-label="Quick bet">
        <button
          type="button"
          className="chips__quick-btn"
          disabled={locked || bet === 0 || bet * 2 > bankroll}
          onClick={() => (onDoubleBet ? onDoubleBet() : onAdd(bet))}
        >
          2×
        </button>
        <button
          type="button"
          className="chips__quick-btn"
          disabled={locked || bankroll <= 0}
          onClick={() => onMax?.()}
        >
          Max
        </button>
        <button
          type="button"
          className="chips__quick-btn"
          disabled={locked || bet === 0}
          onClick={onClear}
        >
          Clr
        </button>
      </div>
    </div>
  );
}
