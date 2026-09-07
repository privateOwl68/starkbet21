import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "../components/ActionBar";
import { BrandHeader } from "../components/BrandHeader";
import { ChipTray } from "../components/ChipTray";
import { LiveRoundArena } from "../components/LiveRoundArena";
import { PrivacyPanel } from "../components/PrivacyPanel";
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
  createGameClient,
  createRelayerAccount,
  type GameClient,
} from "../lib/gameContract";
import { ApprovalPanel } from "../components/ApprovalPanel";
import { useWallet } from "../lib/WalletContext";
import { isPublicNetwork, networkDisplayName } from "../lib/deployment";
import { MIN_BET_WEI, MAX_BET_WEI } from "../lib/money";
import {
  MIN_BET,
  MAX_BET,
  isBust,
  settleHand,
  resultLabel,
  type Card,
  type HandResult,
} from "../lib/hand";
import { createWagerWarClient } from "../lib/wagerWar";
import { RpcProvider } from "starknet";
import { resolveRpcUrl } from "../lib/deployment";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function dealMs() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  return 560;
}

/** Victory splash still uses a number; map wei bets to 0.01-STRK units. */
function splashWager(onChainBet: bigint, fallback: bigint) {
  const b = onChainBet > 0n ? onChainBet : fallback;
  if (b >= MIN_BET_WEI) {
    const units = Number(b / MIN_BET_WEI);
    return Number.isFinite(units) && units > 0 ? units : 1;
  }
  const n = Number(b);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sameAddr(a: string, b: string) {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

type UiPhase = "betting" | "dealing" | "player" | "dealer" | "done";

type Props = {
  onOpenWar?: () => void;
  onStackChange?: (stack: bigint, bet: bigint) => void;
  compactChrome?: boolean;
};

export function ChainTablePage({ onOpenWar, onStackChange, compactChrome }: Props) {
  const { account, address, deployment, connectWallet, useLocalnetDemo, connecting } = useWallet();
  const [relayPlay, setRelayPlay] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [relayTick, setRelayTick] = useState(0);

  const onStackChangeRef = useRef(onStackChange);
  onStackChangeRef.current = onStackChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!account || !address) {
        if (!cancelled) setRelayPlay(false);
        return;
      }
      const relayer = createRelayerAccount(deployment);
      if (!relayer) {
        if (!cancelled) setRelayPlay(false);
        return;
      }
      try {
        const probe = createGameClient({ account, playerAddress: address, deployment });
        const op = await probe.getOperator();
        if (!cancelled) {
          setRelayPlay(op !== "0x0" && sameAddr(op, relayer.address));
        }
      } catch {
        if (!cancelled) setRelayPlay(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, address, deployment, relayTick]);

  const client = useMemo((): GameClient | null => {
    if (!account || !address) return null;
    try {
      const relayer = relayPlay ? createRelayerAccount(deployment) : null;
      return createGameClient({
        account: relayer ?? account,
        playerAddress: address,
        deployment,
        relayPlay: Boolean(relayer),
      });
    } catch {
      return null;
    }
  }, [account, address, deployment, relayPlay]);
  const vaultMode = Boolean(deployment.anonymizer && !deployment.anonymizer.includes("REPLACE"));
  const minBet = vaultMode ? MIN_BET_WEI : BigInt(MIN_BET);
  const maxBet = vaultMode ? MAX_BET_WEI : BigInt(MAX_BET);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** True while waiting for an on-chain tx — card faces stay sealed. */
  const [sealing, setSealing] = useState(false);
  const [bankroll, setBankroll] = useState(0n);
  const [bet, setBet] = useState(0n);
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
      return createWagerWarClient(address ?? undefined);
    } catch {
      return null;
    }
  }, [address]);

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
    async (c: GameClient, animateDeal: boolean, wagerForSplash?: number) => {
      const snap = await c.snapshot();
      const { round } = snap;
      setBankroll(round.stack);
      onStackChangeRef.current?.(round.stack, round.bet);
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
        const wager = wagerForSplash ?? splashWager(round.bet, 0n);
        if (wager > 0) openSplash(result, wager, snap.player, snap.dealer);
      } else {
        setPhase("betting");
        setPlayer([]);
        setDealer([]);
        setMessage(null);
      }
    },
    [openSplash],
  );

  useEffect(() => {
    let cancelled = false;
    if (!client) {
      setReady(false);
      return;
    }
    (async () => {
      try {
        setBusy(true);
        setError(null);
        // Vault / Sepolia: chips come from private buy-in, not free demo mint.
        if (!vaultMode) {
          await client.ensureBuyIn(5000n);
        }
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
    // Only re-init when the client identity / vault mode changes — not on every parent render.
  }, [client, applySnapshot, vaultMode]);

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
    if (!client || busy || bet < minBet || bet > bankroll || bet > maxBet) return;
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
      await client.deal(wager);
      setSealing(false);
      await applySnapshot(client, true, splashWager(wager, 0n));
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
    if (!client || busy) return;
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
      setBankroll(snap.round.stack);
      setOnChainPhase(snap.round.phase);
      setHoleHidden(snap.round.holeHidden);
      setDrawIndex(snap.round.drawIndex);
      await sleep(dealMs());
      if (snap.round.phase === PHASE_DONE) {
        setPhase("done");
        setHoleHidden(false);
        const result = settleHand(snap.player, snap.dealer, false);
        setMessage(resultLabel(result));
        openSplash(result, splashWager(snap.round.bet, bet), snap.player, snap.dealer);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endSeal();
    }
  };

  const onStand = async () => {
    if (!client || busy) return;
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
      setBankroll(snap.round.stack);
      setOnChainPhase(snap.round.phase);
      setDrawIndex(snap.round.drawIndex);
      setPhase("done");
      const result = settleHand(snap.player, snap.dealer, false);
      setMessage(resultLabel(result));
      openSplash(result, splashWager(snap.round.bet, bet), snap.player, snap.dealer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("player");
      setMessage(null);
    } finally {
      endSeal();
    }
  };

  const onDouble = async () => {
    if (!client || busy || bankroll < bet) return;
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
      setBankroll(snap.round.stack);
      setOnChainPhase(snap.round.phase);
      const wager = snap.round.bet > 0n ? snap.round.bet : bet * 2n;
      setBet(wager);
      setPhase("done");
      const result = settleHand(snap.player, snap.dealer, false);
      setMessage(resultLabel(result));
      openSplash(result, splashWager(wager, bet), snap.player, snap.dealer);
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
    if (!client || busy) return;
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
      setBet(0n);
      setMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSealing(false);
      setBusy(false);
    }
  };

  const onBuyIn = async () => {
    if (!client || busy) return;
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

  if (!client || !address) {
    return (
      <main className={`page page--table${compactChrome ? " is-compact" : ""}`}>
        <div className="wallet-gate glass-panel">
          <h2>Connect to play on-chain</h2>
          <p>
            Sign deals with your Starknet wallet
            {isPublicNetwork(deployment)
              ? ` on ${networkDisplayName(deployment.network)}`
              : " (or use the localnet demo key)"}
            .
          </p>
          <div className="wallet-gate__actions">
            <button
              type="button"
              className="btn btn--hit"
              disabled={connecting}
              onClick={() => void connectWallet()}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
            {!isPublicNetwork(deployment) && (
              <button type="button" className="btn ghost" onClick={useLocalnetDemo}>
                Use localnet demo account
              </button>
            )}
          </div>
          {error && (
            <p className="hint" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!ready && !error) {
    return (
      <main className="page">
        <p className="tagline">Syncing table state…</p>
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
          bet: bet > 0n ? bet : undefined,
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
              vaultMode={vaultMode || bankroll >= MIN_BET_WEI}
              locked={busy || sealing || phase !== "betting"}
              onAdd={(a) =>
                setBet((b) => {
                  const next = b + a;
                  const cap = bankroll < maxBet ? bankroll : maxBet;
                  return next > cap ? cap : next;
                })
              }
              onClear={() => setBet(0n)}
              onMax={() => setBet(bankroll < maxBet ? bankroll : maxBet)}
              onDoubleBet={() =>
                setBet((b) => {
                  const next = b === 0n ? minBet : b * 2n;
                  const cap = bankroll < maxBet ? bankroll : maxBet;
                  return next > cap ? cap : next;
                })
              }
            />
            <ActionBar
              busy={busy || sealing}
              phase={splash ? "dealing" : actionPhase}
              canDeal={bet >= minBet && bet <= bankroll && bet <= maxBet && !sealing}
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
              {vaultMode ? (
                <>
                  <button
                    type="button"
                    className={`btn btn--gold buy-chips-btn${approvalOpen ? " is-open" : ""}`}
                    disabled={busy || sealing}
                    aria-expanded={approvalOpen}
                    aria-controls="approval-panel"
                    onClick={() => {
                      setApprovalOpen((o) => !o);
                      if (!approvalOpen) setPrivacyOpen(false);
                    }}
                  >
                    {approvalOpen ? "Hide approval" : "Pre-approve"}
                  </button>
                  <button
                    type="button"
                    className={`btn ghost buy-chips-btn${privacyOpen ? " is-open" : ""}`}
                    disabled={busy || sealing}
                    aria-expanded={privacyOpen}
                    aria-controls="private-buyin-panel"
                    onClick={() => {
                      setPrivacyOpen((o) => !o);
                      if (!privacyOpen) setApprovalOpen(false);
                    }}
                  >
                    {privacyOpen ? "Hide buy-in" : "Buy chips"}
                  </button>
                  {relayPlay && (
                    <span className="relay-badge" title="Table actions signed by the house relayer">
                      Relayed play
                    </span>
                  )}
                </>
              ) : (
                <button type="button" className="btn ghost" disabled={busy || sealing} onClick={onBuyIn}>
                  Buy in +1000 (demo)
                </button>
              )}
            </div>
            {approvalOpen && vaultMode && (
              <div id="approval-panel">
                <ApprovalPanel
                  compact
                  onChanged={() => {
                    setRelayTick((n) => n + 1);
                    if (client) void applySnapshot(client, false);
                  }}
                />
              </div>
            )}
            {privacyOpen && vaultMode && (
              <PrivacyPanel
                compact
                id="private-buyin-panel"
                tableStack={bankroll}
                onClose={() => setPrivacyOpen(false)}
                onBuyInSuccess={async (txHash) => {
                  if (!client) return;
                  setBusy(true);
                  setError(null);
                  setMessage("Confirming private buy-in…");
                  try {
                    const provider = new RpcProvider({
                      nodeUrl: resolveRpcUrl(deployment),
                      blockIdentifier: "latest",
                    });
                    try {
                      await provider.waitForTransaction(txHash);
                    } catch {
                      /* paymaster / wallet hash may not resolve — poll stack instead */
                    }
                    let credited = 0n;
                    for (let i = 0; i < 12; i++) {
                      const round = await client.getRound();
                      if (round.stack > 0n) {
                        credited = round.stack;
                        setBankroll(round.stack);
                        onStackChange?.(round.stack, round.bet);
                        setOnChainPhase(round.phase);
                        break;
                      }
                      await sleep(2500);
                    }
                    if (credited > 0n) {
                      setMessage("Table chips credited — place a bet to deal");
                      await applySnapshot(client, false);
                    } else {
                      setMessage("Buy-in submitted — Refresh if stack is still empty");
                      await applySnapshot(client, false);
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
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
