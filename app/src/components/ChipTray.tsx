import { CHIP_DENOMS, MAX_BET } from "../lib/hand";
import {
  CHIP_DENOMS_WEI,
  MAX_BET_WEI,
  chipLabelWei,
  formatBet,
  formatStack,
  isVaultStack,
} from "../lib/money";

type Props = {
  bankroll: bigint;
  bet: bigint;
  locked: boolean;
  onAdd: (amount: bigint) => void;
  onClear: () => void;
  onMax?: () => void;
  onDoubleBet?: () => void;
  /** Force vault (STRK) chip tray even if stack is still 0. */
  vaultMode?: boolean;
};

const CHIP_TONES = ["chip--1", "chip--10", "chip--25", "chip--50", "chip--100"] as const;

function chipClass(amount: bigint, vault: boolean): string {
  const denoms = vault ? CHIP_DENOMS_WEI : CHIP_DENOMS.map((d) => BigInt(d));
  const idx = denoms.findIndex((d) => d === amount);
  return idx >= 0 ? CHIP_TONES[idx] : "chip--1";
}

export function ChipTray({
  bankroll,
  bet,
  locked,
  onAdd,
  onClear,
  onMax,
  onDoubleBet,
  vaultMode,
}: Props) {
  const vault = vaultMode || isVaultStack(bankroll) || isVaultStack(bet);
  const denoms = vault ? CHIP_DENOMS_WEI : CHIP_DENOMS.map((d) => BigInt(d));
  const maxBet = vault ? MAX_BET_WEI : BigInt(MAX_BET);
  const betCap = bankroll < maxBet ? bankroll : maxBet;

  return (
    <div className="chips chips--console">
      <div className="chips__stats">
        <div className="chips__stat">
          <span className="chips__label">{vault ? "Stack (STRK)" : "Stack"}</span>
          <strong>{formatStack(bankroll)}</strong>
        </div>
        <div className={`chips__stat chips__bet-spot${bet > 0n ? " is-active" : ""}`}>
          <span className="chips__label">Bet</span>
          <strong className={bet > 0n ? "is-lit" : ""}>{formatBet(bet, vault)}</strong>
        </div>
      </div>
      <div className="chips__tray" role="group" aria-label={vault ? "STRK chip denominations" : "Chip denominations"}>
        {denoms.map((d) => (
          <button
            key={d.toString()}
            type="button"
            className={`chip ${chipClass(d, vault)}`}
            disabled={locked || bankroll < d || bet + d > betCap}
            onClick={() => onAdd(d)}
          >
            {vault ? chipLabelWei(d) : d.toString()}
          </button>
        ))}
      </div>
      <div className="chips__quick">
        <button type="button" className="chips__quick-btn" disabled={locked || bet === 0n} onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="chips__quick-btn"
          disabled={locked || bet === 0n || bet * 2n > betCap}
          onClick={onDoubleBet}
        >
          ×2
        </button>
        <button type="button" className="chips__quick-btn" disabled={locked || bankroll <= 0n} onClick={onMax}>
          Max
        </button>
      </div>
    </div>
  );
}
