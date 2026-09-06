import { isRedSuit, cardPip, suitGlyph, type Card } from "../lib/hand";

export type ThrowTarget = "player" | "dealer";

type Props = {
  card?: Card;
  faceDown?: boolean;
  dealIndex?: number;
  flipping?: boolean;
  throwTo?: ThrowTarget;
  className?: string;
  /** Skip deal-throw CSS vars/animation for static displays (e.g. splash). */
  static?: boolean;
  /** Hide the inverted bottom index (splash readability). */
  hideBottom?: boolean;
};

/** Per-card variance so consecutive throws don't look identical. */
function throwVars(dealIndex: number, throwTo: ThrowTarget) {
  const n = dealIndex % 5;
  const side = throwTo === "dealer" ? -1 : 1;
  return {
    ["--deal-i" as string]: dealIndex,
    ["--throw-x" as string]: `${(-8 + n * 3) * side}rem`,
    ["--throw-y" as string]: throwTo === "dealer" ? "-9rem" : "-14rem",
    ["--throw-z" as string]: `${180 + n * 24}px`,
    ["--spin-y" as string]: `${(throwTo === "dealer" ? -1 : 1) * (420 + n * 35)}deg`,
    ["--spin-z" as string]: `${side * (-28 + n * 6)}deg`,
    ["--tilt-x" as string]: `${55 + n * 4}deg`,
  };
}

export function PlayingCard({
  card,
  faceDown = false,
  dealIndex = 0,
  flipping = false,
  throwTo = "player",
  className = "",
  static: isStatic = false,
  hideBottom = false,
}: Props) {
  const red = card ? isRedSuit(card.suit) : false;
  const showBack = faceDown || !card;

  return (
    <div
      className={`playing-card playing-card--${throwTo}${flipping ? " is-flipping" : ""}${isStatic ? " is-static" : ""} ${className}`}
      style={isStatic ? undefined : throwVars(dealIndex, throwTo)}
      aria-hidden={showBack}
    >
      <div className="playing-card__shadow" />
      <div className="playing-card__flight">
        <div className={`playing-card__inner ${showBack ? "is-back" : "is-face"}`}>
          <div className="playing-card__face playing-card__back" />
          <div className={`playing-card__face playing-card__front${red ? " is-red" : ""}`}>
            {card && (
              <>
                <span className="corner top">
                  <span>{cardPip(card.rank)}</span>
                  <span>{suitGlyph(card.suit)}</span>
                </span>
                <span className="pip">{suitGlyph(card.suit)}</span>
                {!hideBottom && (
                  <span className="corner bottom">
                    <span>{cardPip(card.rank)}</span>
                    <span>{suitGlyph(card.suit)}</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
