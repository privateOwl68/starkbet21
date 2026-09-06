import { useCallback, useEffect, useMemo, useState } from "react";
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
  PHASE_DONE,
  PHASE_IDLE,
  PHASE_PLAYER,
  createLocalnetClient,
  type LocalnetClient,
} from "../lib/gameContract";
import {
  MIN_BET,
  isBust,
  settleHand,
  resultLabel,
  type Card,
  type HandResult,
} from "../lib/hand";
import { createWagerWarClient } from "../lib/wagerWar";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function dealMs() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  return 560;
}

type UiPhase = "betting" | "dealing" | "player" | "dealer" | "done";

type Props = {
  onOpenWar?: () => void;
  onStackChange?: (stack: number, bet: number) => void;
  compactChrome?: boolean;
};

export function ChainTablePage({ onOpenWar, onStackChange, compactChrome }: Props) {
  const client = useMemo(() => createLocalnetClient(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** True while waiting for an on-chain tx — card faces stay sealed. */
  const [sealing, setSealing] = useState(false);
  const [bankroll, setBankroll] = useState(0);
  const [bet, setBet] = useState(0);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [holeHidden, setHoleHidden] = useState(true);
  const [flipping, setFlipping] = useState<number[]>([]);
  const [phase, setPhase] = useState<UiPhase>("betting");
  const [message, setMessage] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string>("");
  const [drawIndex, setDrawIndex] = useState(0);
  const [onChainPhase, setOnChainPhase] = useState(PHASE_IDLE);
  const [splash, setSplash] = useState<SplashPayload | null>(null);
  const [sealedSlots, setSealedSlots] = useState({ player: 0, dealer: 0 });
  const [warLive, setWarLive] = useState(false);
  const [warEnd, setWarEnd] = useState(0);
  const [warSeason, setWarSeason] = useState(0);
  const [warVolume, setWarVolume] = useState(0n);
  const [warRank, setWarRank] = useState<number | null>(null);

  const warClient = useMemo(() => {
    try {
      return createWagerWarClient();
    } catch {
      return null;
    }
  }, []);

  const refreshWar = useCallback(async () => {
    if (!warClient) return;
    try {
      const snap = await warClient.snapshot();
      setWarLive(snap.season.live);
      setWarEnd(snap.season.endTs);
      setWarSeason(snap.season.seasonId);
      setWarVolume(snap.volume);
      setWarRank(snap.rank);
    } catch {
      /* war optional */
    }
  }, [warClient]);

  useEffect(() => {
    void refreshWar();
    const id = window.setInterval(() => void refreshWar(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshWar]);

  const openSplash = useCallback((result: HandResult, wager: number, playerCards: Card[], dealerCards: Card[]) => {
    setSplash(splashFromResult(result, wager, playerCards, dealerCards));
  }, []);

  const applySnapshot = useCallback(
    async (c: LocalnetClient, animateDeal: boolean, wagerForSplash?: number) => {
      const snap = await c.snapshot();
      const { round } = snap;
      setBankroll(Number(round.stack));
      onStackChange?.(Number(round.stack), Number(round.bet));
      setCommitment(round.shoeCommitment);
      setDrawIndex(round.drawIndex);
      setOnChainPhase(round.phase);
      setHoleHidden(round.holeHidden);
      setSealedSlots({ player: 0, dealer: 0 });

      if (animateDeal && snap.player.length >= 2 && snap.dealer.length >= 2) {
        setPhase("dealing");
        setPlayer([]);
        setDealer([]);
        setMessage("Revealing sealed deal…");
        const seq: Array<{ p?: Card; d?: Card }> = [
          { p: snap.player[0] },
          { d: snap.dealer[0] },
          { p: snap.player[1] },
          { d: snap.dealer[1] },
        ];
        let pAcc: Card[] = [];
        let dAcc: Card[] = [];
        for (const step of seq) {
          if (step.p) pAcc = [...pAcc, step.p];
          if (step.d) dAcc = [...dAcc, step.d];
          setPlayer([...pAcc]);
          setDealer([...dAcc]);
          await sleep(dealMs());
        }
        setPlayer(snap.player);
        setDealer(snap.dealer);
      } else {
        setPlayer(snap.player);
        setDealer(snap.dealer);
      }

      if (round.phase === PHASE_PLAYER) {
        setPhase("player");
        setMessage(null);
      } else if (round.phase === PHASE_DONE) {
        setPhase("done");
        setHoleHidden(false);
        const result = settleHand(snap.player, snap.dealer, false);
        setMessage(resultLabel(result));
        const wager = wagerForSplash ?? (Number(round.bet) || 0);
        if (wager > 0) openSplash(result, wager, snap.player, snap.dealer);
      } else {
        setPhase("betting");
        setPlayer([]);
        setDealer([]);
        setMessage(null);
      }
    },
    [openSplash, onStackChange],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        await client.ensureBuyIn(5000n);
        if (cancelled) return;
        await applySnapshot(client, false);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, applySnapshot]);

  const beginSeal = (msg: string, slots?: { player: number; dealer: number }) => {
    setSealing(true);
    setBusy(true);
    setError(null);
    setSplash(null);
    setMessage(msg);
    if (slots) setSealedSlots(slots);
  };

  const endSeal = () => {
    setSealing(false);
    setSealedSlots({ player: 0, dealer: 0 });
    setBusy(false);
  };

  const onDeal = async () => {
    if (busy || bet < MIN_BET || bet > bankroll) return;
    const wager = bet;
    beginSeal("Sealing deal on-chain…", { player: 2, dealer: 2 });
    setPhase("dealing");
    setPlayer([]);
    setDealer([]);
    setHoleHidden(true);
    try {
      if (onChainPhase === PHASE_DONE) {
        await client.settle();
      }
      await client.deal(BigInt(wager));
      setSealing(false);
      await applySnapshot(client, true, wager);
      void refreshWar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("betting");
      setPlayer([]);
      setDealer([]);
      setMessage(null);
    } finally {
      endSeal();
    }
  };

  const onHit = async () => {
    if (busy) return;
    const before = player.length;
    beginSeal("Sealing hit on-chain…");
    // Keep existing cards face-down until the tx confirms.
    try {
      await client.hit();
      const snap = await client.snapshot();
      setSealing(false);
      setPlayer(snap.player.slice(0, before));
      await sleep(40);
      setPlayer(snap.player);
      setDealer(snap.dealer);
      setBankroll(Number(snap.round.stack));
      setOnChainPhase(snap.round.phase);
      setHoleHidden(snap.round.holeHidden);
      setDrawIndex(snap.round.drawIndex);
      await sleep(dealMs());
      if (snap.round.phase === PHASE_DONE) {
        setPhase("done");
        setHoleHidden(false);
        const result = settleHand(snap.player, snap.dealer, false);
        setMessage(resultLabel(result));
        openSplash(result, Number(snap.round.bet) || bet, snap.player, snap.dealer);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endSeal();
    }
  };

  const onStand = async () => {
    if (busy) return;
    beginSeal("Sealing stand on-chain…");
    setPhase("dealer");
    // Do NOT flip the hole or show dealer draws until the tx lands.
    try {
      await client.stand();
      setSealing(false);
      setMessage("Revealing dealer…");
      setFlipping([1]);
      await sleep(dealMs());
      setFlipping([]);
      const snap = await client.snapshot();
      setHoleHidden(false);
      setDealer(snap.dealer.slice(0, Math.min(2, snap.dealer.length)));
      for (let i = 2; i < snap.dealer.length; i++) {
        await sleep(dealMs());
        setDealer(snap.dealer.slice(0, i + 1));
      }
      setPlayer(snap.player);
      setDealer(snap.dealer);
      setBankroll(Number(snap.round.stack));
      setOnChainPhase(snap.round.phase);
      setDrawIndex(snap.round.drawIndex);
      setPhase("done");
      const result = settleHand(snap.player, snap.dealer, false);
      setMessage(resultLabel(result));
      openSplash(result, Number(snap.round.bet) || bet, snap.player, snap.dealer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("player");
      setMessage(null);
    } finally {
      endSeal();
    }
  };

  const onDouble = async () => {
    if (busy || bankroll < bet) return;
    beginSeal("Sealing double on-chain…");
    setPhase("dealer");
    try {
      await client.double();
      setSealing(false);
      setMessage("Revealing…");
      setFlipping([1]);
      await sleep(dealMs());
      setFlipping([]);
      const snap = await client.snapshot();
      setPlayer(snap.player);
      setHoleHidden(false);
      setDealer(snap.dealer.slice(0, Math.min(2, snap.dealer.length)));
      for (let i = 2; i < snap.dealer.length; i++) {
        await sleep(dealMs());
        setDealer(snap.dealer.slice(0, i + 1));
      }
      setDealer(snap.dealer);
      setBankroll(Number(snap.round.stack));
      setOnChainPhase(snap.round.phase);
      const wager = Number(snap.round.bet) || bet * 2;
      setBet(wager);
      setPhase("done");
      const result = settleHand(snap.player, snap.dealer, false);
      setMessage(resultLabel(result));
      openSplash(result, wager, snap.player, snap.dealer);
      void refreshWar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("player");
      setMessage(null);
    } finally {
      endSeal();
    }
  };

  const onNewRound = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSplash(null);
    try {
      if (onChainPhase === PHASE_DONE) {
        setMessage("Settling round…");
        setSealing(true);
        await client.settle();
        setSealing(false);
      }
      await applySnapshot(client, false);
      setBet(0);
      setMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSealing(false);
      setBusy(false);
    }
  };

  const onBuyIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await client.buyIn(1000n);
      await applySnapshot(client, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canDouble =
    phase === "player" && !sealing && player.length === 2 && bankroll >= bet && !isBust(player);

  const actionPhase =
    sealing && (phase === "player" || phase === "betting")
      ? "dealing"
      : phase === "dealing" || phase === "dealer"
        ? phase
        : phase === "betting" || phase === "player" || phase === "done"
          ? phase
          : "betting";

  const tableMessage = sealing
    ? message
    : (message ?? (commitment ? `commit ${commitment.slice(0, 10)}…` : null));

  if (!ready && !error) {
    return (
      <main className="page">
        <p className="tagline">Connecting to localnet…</p>
      </main>
    );
  }

  return (
    <main className={`page page--table page--live${compactChrome ? " is-compact" : ""}${sealing ? " is-sealing" : ""}`}>
      {!compactChrome && (
        <BrandHeader
          eyebrow={`Localnet · ${client.deployment.blackjackGame.slice(0, 10)}…`}
          tagline="On-chain blackjack · H17 · sealed until confirmed"
        />
      )}

      <LiveRoundArena
        shoeLeft={Math.max(0, 52 - drawIndex)}
        shoeLabel="Live Shoe · Solo Localnet"
        sealing={sealing}
        sealMessage={message}
        tableMessage={tableMessage}
        bankroll={bankroll}
        playerPhase={actionPhase}
        dealer={{
          cards: dealer,
          concealAll: sealing,
          sealedSlots: dealer.length === 0 ? sealedSlots.dealer : 0,
          hiddenIndices: !sealing && holeHidden && dealer.length > 1 ? [1] : [],
          flippingIndices: sealing ? [] : flipping,
          dealBase: 1,
        }}
        player={{
          cards: player,
          concealAll: sealing,
          sealedSlots: player.length === 0 ? sealedSlots.player : 0,
          bet: bet > 0 ? bet : undefined,
          active: phase === "player" && !sealing,
          result:
            !sealing && phase === "done" && player.length
              ? resultLabel(settleHand(player, dealer, false))
              : null,
        }}
        banner={
          warSeason > 0 ? (
            <WarBanner
              live={warLive}
              endTs={warEnd}
              volume={warVolume}
              rank={warRank}
              seasonId={warSeason}
              onOpenBoard={onOpenWar}
            />
          ) : null
        }
        controls={
          <>
            <ChipTray
              bankroll={bankroll}
              bet={bet}
              locked={busy || sealing || phase !== "betting"}
              onAdd={(a) => setBet((b) => Math.min(bankroll, b + a))}
              onClear={() => setBet(0)}
              onMax={() => setBet(bankroll)}
              onDoubleBet={() => setBet((b) => Math.min(bankroll, b * 2 || MIN_BET))}
            />
            <ActionBar
              busy={busy || sealing}
              phase={splash ? "dealing" : actionPhase}
              canDeal={bet >= MIN_BET && bet <= bankroll && !sealing}
              canHit={phase === "player" && !sealing}
              canStand={phase === "player" && !sealing}
              canDouble={canDouble}
              canSplit={false}
              onDeal={onDeal}
              onHit={onHit}
              onStand={onStand}
              onDouble={onDouble}
              onSplit={() => undefined}
              onInsurance={() => undefined}
              onNewRound={onNewRound}
            />
            <div className="actions actions--secondary">
              <button type="button" className="btn ghost" disabled={busy || sealing} onClick={onBuyIn}>
                Buy in +1000
              </button>
            </div>
          </>
        }
        footer={
          <>
            {error && (
              <p className="hint" role="alert" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <p className="hint">
              Cards stay face-down until the Starknet tx confirms — no early peek, no mid-loss exit.
            </p>
          </>
        }
      />

      {splash && (
        <VictorySplash splash={splash} busy={busy} onContinue={onNewRound} />
      )}
    </main>
  );
}
