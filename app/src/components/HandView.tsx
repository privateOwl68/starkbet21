import { formatTotal, type Card } from "../lib/hand";
import { PlayingCard, type ThrowTarget } from "./PlayingCard";

type Props = {
  label: string;
  cards: Card[];
  hiddenIndices?: number[];
  flippingIndices?: number[];
  /** Hide every card face (backs only) while an on-chain tx is sealing. */
  concealAll?: boolean;
  /** Show N face-down placeholders when cards are empty but a deal is pending. */
  sealedSlots?: number;
  bet?: number;
  active?: boolean;
  result?: string | null;
  dealBase?: number;
  throwTo?: ThrowTarget;
  /** Cards only — meta shown by parent seat / dealer zone. */
  hideMeta?: boolean;
};

function resultClass(result: string) {
  const r = result.toLowerCase();
  if (r.includes("blackjack")) return "hand__result--bj";
  if (r.includes("win")) return "hand__result--win";
  if (r.includes("push")) return "hand__result--push";
  if (r.includes("bust") || r.includes("dealer") || r.includes("lose")) return "hand__result--bust";
  return "";
}

export function HandView({
  label,
  cards,
  hiddenIndices = [],
  flippingIndices = [],
  concealAll = false,
  sealedSlots = 0,
  bet,
  active = false,
  result,
  dealBase = 0,
  throwTo = "player",
  hideMeta = false,
}: Props) {
  const totalText =
    concealAll
      ? "…"
      : hiddenIndices.length > 0 && cards.length > 0
        ? formatTotal(cards.slice(0, 1))
        : cards.length
          ? formatTotal(cards)
          : "—";

  const showPlaceholders = cards.length === 0 && sealedSlots > 0;

  return (
    <div
      className={`hand hand--${throwTo}${active ? " is-active" : ""}${concealAll ? " is-sealed" : ""}${hideMeta ? " is-compact" : ""}`}
      aria-label={hideMeta ? `${label} ${totalText}` : undefined}
    >
      {!hideMeta && (
        <div className="hand__meta">
          <h2>{label}</h2>
          <span className="hand__total" aria-live="polite">
            {totalText}
          </span>
          {typeof bet === "number" && <span className="hand__bet">Bet ${bet}</span>}
          {result && !concealAll && (
            <span className={`hand__result ${resultClass(result)}`}>{result}</span>
          )}
        </div>
      )}
      <ul className="hand__cards">
        {cards.length === 0 && !showPlaceholders && (
          <li className="hand__slot">
            <div className="playing-card is-placeholder" aria-hidden />
          </li>
        )}
        {showPlaceholders &&
          Array.from({ length: sealedSlots }, (_, i) => (
            <li key={`sealed-${i}`} className="hand__slot">
              <PlayingCard faceDown dealIndex={dealBase + i} throwTo={throwTo} />
            </li>
          ))}
        {cards.map((c, i) => (
          <li key={c.id} className="hand__slot">
            <PlayingCard
              card={c}
              faceDown={concealAll || hiddenIndices.includes(i)}
              flipping={!concealAll && flippingIndices.includes(i)}
              dealIndex={dealBase + i}
              throwTo={throwTo}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
