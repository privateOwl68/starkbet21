import type { Card, HandResult } from "../lib/hand";
import { formatTotal, payoutForResult, resultLabel } from "../lib/hand";
import { PlayingCard } from "./PlayingCard";

export type SplashPayload = {
  result: HandResult;
  bet: number;
  /** Net chips returned to stack for this hand (includes stake on win/push). */
  returned: number;
  player: Card[];
  dealer: Card[];
};

type Props = {
  splash: SplashPayload;
  onContinue: () => void;
  busy?: boolean;
};

function headline(result: HandResult) {
  switch (result) {
    case "blackjack":
      return "Natural Blackjack!";
    case "win":
      return "You Win!";
    case "push":
      return "Push";
    case "bust":
      return "Bust";
    case "lose":
      return "Dealer Wins";
  }
}

function subline(result: HandResult) {
  switch (result) {
    case "blackjack":
      return "The vault pays 3:2";
    case "win":
      return "Even money · stake returned + win";
    case "push":
      return "Stake returned";
    case "bust":
    case "lose":
      return "Better luck next shoe";
  }
}

function SplashHand({
  label,
  cards,
  winning,
}: {
  label: string;
  cards: Card[];
  winning?: boolean;
}) {
  return (
    <div className={`splash__hand${winning ? " is-winning" : ""}`}>
      <div className="splash__hand-header">
        <span className="splash__hand-label">{label}</span>
        <span className="splash__hand-total">{formatTotal(cards)}</span>
      </div>
      <ul className="splash__hand-cards">
        {cards.map((c) => (
          <li key={c.id} className="splash__hand-slot">
            <PlayingCard
              card={c}
              static
              hideBottom
              throwTo="player"
              className="splash__playing-card"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VictorySplash({ splash, onContinue, busy }: Props) {
  const { result, bet, returned, player, dealer } = splash;
  const profit = returned - bet;
  const winLike = result === "blackjack" || result === "win";
  const tone =
    result === "blackjack" ? "bj" : result === "win" ? "win" : result === "push" ? "push" : "lose";

  return (
    <div className={`splash splash--${tone}`} role="dialog" aria-modal="true" aria-label={headline(result)}>
      <div className="splash__scrim" />
      <div className="splash__rays" aria-hidden />
      <div className="splash__particles" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="splash__card">
        <p className="splash__verified">Blockchain verified round · Penthouse vault</p>
        <h2 className="splash__title">{headline(result)}</h2>
        <p className="splash__sub">
          {result === "blackjack" ? "THE PENTHOUSE VAULT PAYS 3:2" : subline(result)}
        </p>

        <div className="splash__hands">
          {dealer.length > 0 && <SplashHand label="Dealer" cards={dealer} />}
          {player.length > 0 && (
            <SplashHand
              label={winLike ? "Your winning hand" : "You"}
              cards={player}
              winning={winLike}
            />
          )}
        </div>

        {result === "blackjack" && (
          <div className="splash__bj-badge" aria-hidden>
            <span>21</span>
            <em>BLACK JACK</em>
          </div>
        )}
        <dl className="splash__ledger">
          <div>
            <dt>Standard wager</dt>
            <dd>${bet.toLocaleString()}</dd>
          </div>
          <div>
            <dt>{resultLabel(result)}</dt>
            <dd className={winLike || result === "push" ? "is-gain" : "is-loss"}>
              {profit > 0 ? "+" : ""}${profit.toLocaleString()}
            </dd>
          </div>
          <div className="splash__ledger-total">
            <dt>Net return</dt>
            <dd>${returned.toLocaleString()}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--deal splash__cta" disabled={busy} onClick={onContinue}>
          {winLike ? "Collect & deal next" : "Next hand"}
        </button>
      </div>
    </div>
  );
}

export function splashFromResult(
  result: HandResult,
  bet: number,
  player: Card[],
  dealer: Card[],
): SplashPayload {
  return {
    result,
    bet,
    returned: payoutForResult(bet, result),
    player,
    dealer,
  };
}
