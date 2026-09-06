import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "../components/ActionBar";
import { BrandHeader } from "../components/BrandHeader";
import { ChipTray } from "../components/ChipTray";
import { LiveRoundArena } from "../components/LiveRoundArena";
import { WarBanner } from "../components/WarBanner";
import {
  VictorySplash,
  splashFromResult,
  type SplashPayload,
} from "../components/VictorySplash";
import {
  type Card,
  type HandResult,
  MIN_BET,
  STARTING_BANKROLL,
  canDouble,
  canSplit,
  dealerShouldHit,
  dealerShowsAce,
  draw,
  freshDeck,
  handValue,
  isBlackjack,
  isBust,
  payoutForResult,
  resultLabel,
  settleHand,
} from "../lib/hand";
import { localWarTracker } from "../lib/wagerWar";

type Phase = "betting" | "dealing" | "insurance" | "player" | "dealer" | "done";

type PlayerHand = {
  cards: Card[];
  bet: number;
  stood: boolean;
  doubled: boolean;
  fromSplit: boolean;
  result: HandResult | null;
};

type Round = {
  deck: Card[];
  dealer: Card[];
  hands: PlayerHand[];
  activeHand: number;
  phase: Phase;
  holeHidden: boolean;
  flippingDealer: number[];
  insuranceBet: number;
  message: string | null;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function dealMs() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  return 560;
}

function emptyRound(): Round {
  return {
    deck: [],
    dealer: [],
    hands: [],
    activeHand: 0,
    phase: "betting",
    holeHidden: true,
    flippingDealer: [],
    insuranceBet: 0,
    message: null,
  };
}

export function TablePage({
  onOpenWar,
  onStackChange,
  compactChrome,
}: {
  onOpenWar?: () => void;
  onStackChange?: (stack: number, bet: number) => void;
  compactChrome?: boolean;
}) {
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const [bet, setBet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round>(emptyRound);
  const [splash, setSplash] = useState<SplashPayload | null>(null);
  const war = useMemo(() => localWarTracker(), []);
  const [localWar, setLocalWar] = useState(() => war.read());
  const roundRef = useRef(round);
  const bankrollRef = useRef(bankroll);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    bankrollRef.current = bankroll;
    onStackChange?.(bankroll, bet);
  }, [bankroll, bet, onStackChange]);

  const chipsLocked = round.phase !== "betting" || busy;

  const onAddChip = (amount: number) => {
    setBet((b) => Math.min(bankroll, b + amount));
  };

  const onClearBet = () => setBet(0);

  const finishRound = useCallback((next: Round, stack: number) => {
    let payout = 0;
    for (const h of next.hands) {
      if (!h.result) continue;
      payout += payoutForResult(h.bet, h.result);
    }
    if (next.insuranceBet > 0) {
      const dealerBj = isBlackjack(next.dealer);
      payout += dealerBj ? next.insuranceBet * 3 : 0;
    }
    const labels = next.hands.map((h) => (h.result ? resultLabel(h.result) : "")).filter(Boolean);
    const msg =
      next.insuranceBet > 0 && isBlackjack(next.dealer)
        ? `Insurance pays · ${labels.join(" · ")}`
        : labels.join(" · ") || "Round over";
    setBankroll(stack + payout);
    setRound({ ...next, phase: "done", holeHidden: false, message: msg });
    setBusy(false);
    const primary = next.hands[0];
    if (primary?.result) {
      setSplash(splashFromResult(primary.result, primary.bet, primary.cards, next.dealer));
    }
  }, []);

  const playDealerThenSettle = useCallback(
    async (start: Round, stack: number) => {
      setBusy(true);
      let deck = start.deck;
      let dealer = [...start.dealer];
      let holeHidden = start.holeHidden;

      if (holeHidden) {
        setRound({ ...start, phase: "dealer", flippingDealer: [1], message: "Hole card…" });
        await sleep(dealMs());
        holeHidden = false;
        setRound({
          ...start,
          dealer,
          deck,
          phase: "dealer",
          holeHidden: false,
          flippingDealer: [],
          message: "Dealer plays",
        });
        await sleep(dealMs() * 0.5);
      }

      const anyAlive = start.hands.some((h) => h.result !== "bust" && !isBust(h.cards));
      if (anyAlive) {
        while (dealerShouldHit(dealer, true)) {
          const pulled = draw(deck);
          deck = pulled.deck;
          dealer = [...dealer, pulled.card];
          setRound({
            ...start,
            hands: start.hands,
            dealer,
            deck,
            phase: "dealer",
            holeHidden: false,
            flippingDealer: [],
            insuranceBet: start.insuranceBet,
            message: "Dealer hits",
            activeHand: start.activeHand,
          });
          await sleep(dealMs());
        }
      }

      const settledHands = start.hands.map((h) => {
        if (h.result) return h;
        return {
          ...h,
          result: settleHand(h.cards, dealer, h.fromSplit),
        };
      });

      finishRound(
        {
          ...start,
          deck,
          dealer,
          hands: settledHands,
          holeHidden: false,
          flippingDealer: [],
          phase: "done",
          message: null,
        },
        stack,
      );
    },
    [finishRound],
  );

  const advanceAfterHand = useCallback(
    async (next: Round, stack: number) => {
      const hands = [...next.hands];
      let idx = next.activeHand;

      if (isBust(hands[idx]!.cards)) {
        hands[idx] = { ...hands[idx]!, result: "bust", stood: true };
      }

      const nextIdx = hands.findIndex((h, i) => i > idx && !h.stood && !h.result);
      if (nextIdx >= 0) {
        setRound({
          ...next,
          hands,
          activeHand: nextIdx,
          phase: "player",
          message: `Hand ${nextIdx + 1}`,
        });
        setBusy(false);
        return;
      }

      const allBust = hands.every((h) => h.result === "bust" || isBust(h.cards));
      if (allBust) {
        const settled = hands.map((h) => ({
          ...h,
          result: h.result ?? ("bust" as HandResult),
          stood: true,
        }));
        // Still flip hole for drama
        setRound({ ...next, hands: settled, phase: "dealer", message: "Revealing…" });
        await playDealerThenSettle({ ...next, hands: settled }, stack);
        return;
      }

      await playDealerThenSettle({ ...next, hands }, stack);
    },
    [playDealerThenSettle],
  );

  const onDeal = async () => {
    const wager = bet;
    if (wager < MIN_BET || wager > bankroll || busy || bankroll < MIN_BET) return;

    setBusy(true);
    const stack = bankroll - wager;
    setBankroll(stack);
    setLocalWar(war.recordWager(wager, true));

    let deck = freshDeck();
    const order: Array<"p" | "d"> = ["p", "d", "p", "d"];
    let player: Card[] = [];
    let dealer: Card[] = [];

    setRound({
      ...emptyRound(),
      deck,
      phase: "dealing",
      hands: [{ cards: [], bet: wager, stood: false, doubled: false, fromSplit: false, result: null }],
      message: "Dealing…",
    });

    for (let i = 0; i < order.length; i++) {
      const pulled = draw(deck);
      deck = pulled.deck;
      if (order[i] === "p") player = [...player, pulled.card];
      else dealer = [...dealer, pulled.card];

      setRound({
        deck,
        dealer,
        hands: [
          {
            cards: player,
            bet: wager,
            stood: false,
            doubled: false,
            fromSplit: false,
            result: null,
          },
        ],
        activeHand: 0,
        phase: "dealing",
        holeHidden: true,
        flippingDealer: [],
        insuranceBet: 0,
        message: "Dealing…",
      });
      await sleep(dealMs());
    }

    const hand: PlayerHand = {
      cards: player,
      bet: wager,
      stood: false,
      doubled: false,
      fromSplit: false,
      result: null,
    };

    const playerBj = isBlackjack(player);
    const dealerBj = isBlackjack(dealer);

    if (playerBj || dealerBj) {
      const revealed: Round = {
        deck,
        dealer,
        hands: [
          {
            ...hand,
            result: settleHand(player, dealer, false),
            stood: true,
          },
        ],
        activeHand: 0,
        phase: "dealer",
        holeHidden: false,
        flippingDealer: dealerBj || playerBj ? [1] : [],
        insuranceBet: 0,
        message: playerBj ? "Blackjack!" : "Dealer blackjack",
      };
      setRound(revealed);
      await sleep(dealMs());
      finishRound({ ...revealed, flippingDealer: [] }, stack);
      return;
    }

    if (dealerShowsAce(dealer) && stack >= Math.floor(wager / 2)) {
      setRound({
        deck,
        dealer,
        hands: [hand],
        activeHand: 0,
        phase: "insurance",
        holeHidden: true,
        flippingDealer: [],
        insuranceBet: 0,
        message: "Dealer shows Ace",
      });
      setBusy(false);
      return;
    }

    setRound({
      deck,
      dealer,
      hands: [hand],
      activeHand: 0,
      phase: "player",
      holeHidden: true,
      flippingDealer: [],
      insuranceBet: 0,
      message: null,
    });
    setBusy(false);
  };

  const onInsurance = async (take: boolean) => {
    const cur = roundRef.current;
    if (cur.phase !== "insurance" || busy) return;
    setBusy(true);

    let stack = bankroll;
    let insuranceBet = 0;
    if (take) {
      insuranceBet = Math.floor(cur.hands[0]!.bet / 2);
      if (insuranceBet > stack) {
        setBusy(false);
        return;
      }
      stack -= insuranceBet;
      setBankroll(stack);
    }

    // Peek: if dealer has BJ, round ends
    if (isBlackjack(cur.dealer)) {
      const hands = cur.hands.map((h) => ({
        ...h,
        result: settleHand(h.cards, cur.dealer, h.fromSplit),
        stood: true,
      }));
      const next: Round = {
        ...cur,
        hands,
        insuranceBet,
        holeHidden: false,
        flippingDealer: [1],
        phase: "dealer",
        message: "Dealer has blackjack",
      };
      setRound(next);
      await sleep(dealMs());
      finishRound({ ...next, flippingDealer: [] }, stack);
      return;
    }

    setRound({
      ...cur,
      insuranceBet,
      phase: "player",
      message: take ? "Insurance taken · no BJ" : null,
    });
    setBusy(false);
  };

  const onHit = async () => {
    const cur = roundRef.current;
    if (cur.phase !== "player" || busy) return;
    setBusy(true);

    const idx = cur.activeHand;
    const hand = cur.hands[idx]!;
    const pulled = draw(cur.deck);
    const cards = [...hand.cards, pulled.card];
    const hands = cur.hands.map((h, i) => (i === idx ? { ...h, cards } : h));
    const next: Round = { ...cur, deck: pulled.deck, hands, message: null };
    setRound(next);
    await sleep(dealMs());

    if (isBust(cards) || handValue(cards).total === 21) {
      const stoodHands = next.hands.map((h, i) =>
        i === idx ? { ...h, stood: true, result: isBust(cards) ? ("bust" as const) : h.result } : h,
      );
      await advanceAfterHand({ ...next, hands: stoodHands }, bankrollRef.current);
      return;
    }

    setRound(next);
    setBusy(false);
  };

  const onStand = async () => {
    const cur = roundRef.current;
    if (cur.phase !== "player" || busy) return;
    setBusy(true);
    const idx = cur.activeHand;
    const hands = cur.hands.map((h, i) => (i === idx ? { ...h, stood: true } : h));
    await advanceAfterHand({ ...cur, hands }, bankrollRef.current);
  };

  const onDouble = async () => {
    const cur = roundRef.current;
    if (cur.phase !== "player" || busy) return;
    const idx = cur.activeHand;
    const hand = cur.hands[idx]!;
    if (!canDouble(hand.cards, hand.stood || hand.doubled)) return;
    if (bankroll < hand.bet) return;

    setBusy(true);
    const stack = bankroll - hand.bet;
    setBankroll(stack);
    setLocalWar(war.recordWager(hand.bet, false));

    const pulled = draw(cur.deck);
    const cards = [...hand.cards, pulled.card];
    const hands = cur.hands.map((h, i) =>
      i === idx
        ? {
            ...h,
            cards,
            bet: h.bet * 2,
            doubled: true,
            stood: true,
            result: isBust(cards) ? ("bust" as const) : null,
          }
        : h,
    );
    const next: Round = { ...cur, deck: pulled.deck, hands, message: "Double down" };
    setRound(next);
    await sleep(dealMs());
    await advanceAfterHand(next, stack);
  };

  const onSplit = async () => {
    const cur = roundRef.current;
    if (cur.phase !== "player" || busy) return;
    const idx = cur.activeHand;
    const hand = cur.hands[idx]!;
    if (!canSplit(hand.cards) || cur.hands.length > 1) return;
    if (bankroll < hand.bet) return;

    setBusy(true);
    const stack = bankroll - hand.bet;
    setBankroll(stack);

    let deck = cur.deck;
    const leftCard = hand.cards[0]!;
    const rightCard = hand.cards[1]!;

    const d1 = draw(deck);
    deck = d1.deck;
    const d2 = draw(deck);
    deck = d2.deck;

    const hands: PlayerHand[] = [
      {
        cards: [leftCard, d1.card],
        bet: hand.bet,
        stood: false,
        doubled: false,
        fromSplit: true,
        result: null,
      },
      {
        cards: [rightCard, d2.card],
        bet: hand.bet,
        stood: false,
        doubled: false,
        fromSplit: true,
        result: null,
      },
    ];

    // Split aces: one card each, auto-stand (common rule)
    const splitAces = leftCard.rank === 1;
    if (splitAces) {
      hands[0]!.stood = true;
      hands[1]!.stood = true;
    }

    const next: Round = {
      ...cur,
      deck,
      hands,
      activeHand: 0,
      phase: splitAces ? "dealer" : "player",
      message: splitAces ? "Split aces" : "Split",
    };
    setRound(next);
    await sleep(dealMs());

    if (splitAces) {
      await playDealerThenSettle(next, stack);
      return;
    }
    setBusy(false);
  };

  const onNewRound = () => {
    if (busy) return;
    setSplash(null);
    setBet(0);
    setRound(emptyRound());
    if (bankroll < MIN_BET) {
      setBankroll(STARTING_BANKROLL);
      setRound({ ...emptyRound(), message: "Stack refilled — select chips to bet" });
    }
  };

  const active = round.hands[round.activeHand];
  const canHitNow =
    round.phase === "player" && !!active && !active.stood && !isBust(active.cards);
  const canStandNow = canHitNow;
  const canDoubleNow =
    !!active &&
    canDouble(active.cards, active.stood || active.doubled) &&
    bankroll >= active.bet &&
    round.phase === "player";
  const canSplitNow =
    !!active &&
    canSplit(active.cards) &&
    round.hands.length === 1 &&
    bankroll >= active.bet &&
    round.phase === "player";

  const actionPhase =
    round.phase === "betting" ||
    round.phase === "insurance" ||
    round.phase === "player" ||
    round.phase === "dealer" ||
    round.phase === "done" ||
    round.phase === "dealing"
      ? round.phase
      : "betting";

  const displayHand =
    round.hands[round.activeHand] ??
    round.hands[0] ?? {
      cards: [] as Card[],
      bet,
      stood: false,
      doubled: false,
      fromSplit: false,
      result: null as HandResult | null,
    };

  return (
    <main className={`page page--table page--live${compactChrome ? " is-compact" : ""}`}>
      {!compactChrome && (
        <BrandHeader
          eyebrow="Off-chain demo · local shoe"
          tagline="Animated blackjack · H17 · 3:2"
        />
      )}

      <LiveRoundArena
        shoeLeft={round.deck.length || 52}
        shoeLabel="Live Shoe · Solo Local"
        tableMessage={round.message}
        bankroll={bankroll}
        playerPhase={actionPhase}
        dealer={{
          cards: round.dealer,
          hiddenIndices: round.holeHidden && round.dealer.length > 1 ? [1] : [],
          flippingIndices: round.flippingDealer,
          dealBase: 1,
        }}
        player={{
          cards: displayHand.cards,
          bet: displayHand.cards.length || bet > 0 ? (displayHand.cards.length ? displayHand.bet : bet) : undefined,
          active: round.phase === "player",
          result: displayHand.result ? resultLabel(displayHand.result) : null,
          dealBase: round.activeHand * 4,
        }}
        banner={
          <WarBanner
            live={war.live(localWar)}
            endTs={localWar.endTs}
            volume={localWar.volume}
            rank={localWar.volume > 0 ? 1 : null}
            seasonId={localWar.seasonId}
            onOpenBoard={onOpenWar}
          />
        }
        controls={
          <>
            <ChipTray
              bankroll={bankroll}
              bet={bet}
              locked={chipsLocked}
              onAdd={onAddChip}
              onClear={onClearBet}
              onMax={() => setBet(bankroll)}
              onDoubleBet={() => setBet((b) => Math.min(bankroll, b * 2 || MIN_BET))}
            />
            <ActionBar
              busy={busy || round.phase === "dealing"}
              phase={splash ? "dealing" : actionPhase}
              canDeal={bet >= MIN_BET && bet <= bankroll}
              canHit={canHitNow}
              canStand={canStandNow}
              canDouble={canDoubleNow}
              canSplit={canSplitNow}
              onDeal={onDeal}
              onHit={onHit}
              onStand={onStand}
              onDouble={onDouble}
              onSplit={onSplit}
              onInsurance={onInsurance}
              onNewRound={onNewRound}
            />
          </>
        }
        footer={
          <p className="hint">
            Scoring mirrors <code>hand.cairo</code>. Velvet &amp; Onyx live table from Stitch.
            {round.hands.length > 1 ? ` · Showing hand ${round.activeHand + 1} of ${round.hands.length}` : ""}
          </p>
        }
      />

      {splash && <VictorySplash splash={splash} busy={busy} onContinue={onNewRound} />}
    </main>
  );
}
