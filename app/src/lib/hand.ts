/** Mirrors contracts/src/hand.cairo — keep scoring in sync for local UI play. */

export type Card = { rank: number; suit: number; id: string };

export type HandValue = { total: number; soft: boolean };

let cardSeq = 0;

export function makeCard(rank: number, suit: number): Card {
  cardSeq += 1;
  return { rank, suit, id: `c-${cardSeq}-${rank}-${suit}` };
}

export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces += 1;
      total += 1;
    } else if (c.rank >= 10) {
      total += 10;
    } else {
      total += c.rank;
    }
  }
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  return { total, soft };
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** V1 default: H17 */
export function dealerShouldHit(cards: Card[], hitSoft17 = true): boolean {
  const v = handValue(cards);
  if (v.total < 17) return true;
  if (hitSoft17 && v.soft && v.total === 17) return true;
  return false;
}

export function formatTotal(cards: Card[]): string {
  if (cards.length === 0) return "—";
  const v = handValue(cards);
  if (isBlackjack(cards)) return "Blackjack";
  if (isBust(cards)) return `Bust (${v.total})`;
  return v.soft ? `Soft ${v.total}` : String(v.total);
}

export function cardPip(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

export function suitGlyph(suit: number): string {
  return ["♣", "♦", "♥", "♠"][suit] ?? "?";
}

export function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2;
}

export function freshDeck(seed = Date.now()): Card[] {
  const cards: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push(makeCard(rank, suit));
    }
  }
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

export function draw(deck: Card[]): { card: Card; deck: Card[] } {
  const [card, ...rest] = deck;
  if (!card) throw new Error("shoe empty");
  return { card, deck: rest };
}

export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const a = cards[0]!;
  const b = cards[1]!;
  const rankValue = (r: number) => (r >= 10 ? 10 : r);
  return rankValue(a.rank) === rankValue(b.rank);
}

export function canDouble(cards: Card[], alreadyActed: boolean): boolean {
  return cards.length === 2 && !alreadyActed;
}

export function dealerShowsAce(dealer: Card[]): boolean {
  return dealer[0]?.rank === 1;
}

export type HandResult =
  | "blackjack"
  | "win"
  | "lose"
  | "push"
  | "bust";

export function settleHand(
  player: Card[],
  dealer: Card[],
  fromSplit: boolean,
): HandResult {
  if (isBust(player)) return "bust";
  const playerBj = isBlackjack(player) && !fromSplit;
  const dealerBj = isBlackjack(dealer);
  if (playerBj && !dealerBj) return "blackjack";
  if (dealerBj && !playerBj) return "lose";
  if (playerBj && dealerBj) return "push";
  if (isBust(dealer)) return "win";
  const pt = handValue(player).total;
  const dt = handValue(dealer).total;
  if (pt > dt) return "win";
  if (pt < dt) return "lose";
  return "push";
}

/** Net chip delta for one hand given bet (insurance settled separately). */
export function payoutForResult(bet: number, result: HandResult): number {
  switch (result) {
    case "blackjack":
      return Math.floor(bet * 2.5);
    case "win":
      return bet * 2;
    case "push":
      return bet;
    case "lose":
    case "bust":
      return 0;
  }
}

export function resultLabel(r: HandResult): string {
  switch (r) {
    case "blackjack":
      return "Blackjack · 3:2";
    case "win":
      return "You win";
    case "lose":
      return "Dealer wins";
    case "push":
      return "Push";
    case "bust":
      return "Bust";
  }
}

export const CHIP_DENOMS = [1, 10, 25, 50, 100] as const;
export const STARTING_BANKROLL = 5000;
/** Lowest chip; Deal stays disabled until the player builds a bet ≥ this. */
export const MIN_BET = 1;
/** Table maximum wager (chips). */
export const MAX_BET = 500;
