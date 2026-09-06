import { type ReactNode, useMemo, useState } from "react";
import { formatTotal, handValue, type Card } from "../lib/hand";
import { HandView } from "./HandView";
import { RoomLoungeDrawer } from "./RoomLoungeDrawer";

/** Reserved arc capacity for future multiplayer — only seat 0 is live today. */
export const MAX_TABLE_SEATS = 5;

export type LiveHandProps = {
  cards: Card[];
  concealAll?: boolean;
  sealedSlots?: number;
  hiddenIndices?: number[];
  flippingIndices?: number[];
  bet?: number;
  active?: boolean;
  result?: string | null;
  dealBase?: number;
};

type Props = {
  shoeLeft: number;
  shoeLabel?: string;
  rulesLabel?: string;
  roomCode?: string;
  sealing?: boolean;
  sealMessage?: string | null;
  tableMessage?: string | null;
  bankroll: number;
  dealer: LiveHandProps;
  player: LiveHandProps;
  playerPhase?: "betting" | "player" | "dealer" | "done" | "dealing" | "insurance";
  /** How many seats are playable today (default 1). Extra slots render as open. */
  occupiedSeats?: number;
  maxSeats?: number;
  banner?: ReactNode;
  controls: ReactNode;
  footer?: ReactNode;
};

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function betChipStack(bet: number) {
  if (bet <= 0) return [] as { label: string; tone: string }[];
  if (bet >= 1000) return [{ label: "$1K", tone: "gold" }];
  if (bet >= 500) return [{ label: `$${bet}`, tone: "amethyst" }];
  if (bet >= 100) return [{ label: `$${bet}`, tone: "obsidian" }];
  if (bet >= 25) return [{ label: `$${bet}`, tone: "emerald" }];
  return [{ label: `$${bet}`, tone: "pearl" }];
}

function OpenSeat({ index }: { index: number }) {
  return (
    <div className="seat seat--open" data-seat={index}>
      <div className="open-seat-spot" role="presentation">
        <span className="material-symbols-outlined">person_add</span>
        <span>Seat {index + 1}</span>
      </div>
      <button
        type="button"
        className="open-seat-invite"
        disabled
        title="Extra seats unlock when multiplayer tables ship"
      >
        <span className="material-symbols-outlined">lock</span>
        Coming later
      </button>
    </div>
  );
}

function PlayerSeat({
  player,
  bankroll,
  playerBadge,
  playerStatus,
  playerPhase,
  sealing,
}: {
  player: LiveHandProps;
  bankroll: number;
  playerBadge: string;
  playerStatus: string;
  playerPhase: string;
  sealing: boolean;
}) {
  const yourChips = betChipStack(player.bet ?? 0);

  return (
    <div
      className={`seat seat--you${player.active ? " is-active" : ""}${sealing ? " is-sealed" : ""}`}
      data-seat={0}
    >
      {player.active && <div className="seat__aura" aria-hidden />}
      <HandView
        label={`You · ${playerBadge}`}
        cards={player.cards}
        concealAll={player.concealAll}
        sealedSlots={player.sealedSlots}
        flippingIndices={player.flippingIndices}
        bet={player.bet}
        active={player.active}
        result={player.result}
        dealBase={player.dealBase ?? 0}
        throwTo="player"
        hideMeta
      />
      {(player.bet ?? 0) > 0 && (
        <div className="seat__wager seat__wager--you">
          <div className="seat__chip-stack">
            {yourChips.map((ch, i) => (
              <span key={`${ch.label}-${i}`} className={`mini-chip mini-chip--${ch.tone}`}>
                {ch.label}
              </span>
            ))}
          </div>
          <span className="seat__wager-total is-gold">{money(player.bet ?? 0)}</span>
        </div>
      )}
      {player.active && !sealing && (
        <div className="seat__badges">
          <span className="seat-badge seat-badge--soft">{playerBadge}</span>
          <span className="seat-badge seat-badge--timer">
            <span className="material-symbols-outlined">progress_activity</span>
            Your action
          </span>
        </div>
      )}
      <div className="seat-pod seat-pod--you">
        <div className="avatar-initials is-you is-ring">
          Y
          <span className="mic-badge mic-badge--on">
            <span className="material-symbols-outlined">mic</span>
          </span>
        </div>
        <div className="seat-pod__body">
          <div className="seat-pod__row">
            <span className="seat-pod__name is-you">You</span>
            <span className="seat-pod__turn">{playerStatus}</span>
          </div>
          <div className="seat-pod__row">
            <span className="seat-pod__stack">{money(bankroll)}</span>
            <span className="seat-pod__status is-active-label">
              {player.active ? "Active" : playerPhase}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveRoundArena({
  shoeLeft,
  shoeLabel = "Live Shoe · Solo",
  rulesLabel = "BJ 3:2 / Dealer Stands on 17",
  roomCode = "V21-9942",
  sealing = false,
  sealMessage = null,
  tableMessage = null,
  bankroll,
  dealer,
  player,
  playerPhase = "betting",
  occupiedSeats = 1,
  maxSeats = MAX_TABLE_SEATS,
  banner,
  controls,
  footer,
}: Props) {
  const [loungeOpen, setLoungeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const seatCount = Math.max(1, Math.min(maxSeats, occupiedSeats));
  const openCount = Math.max(0, maxSeats - seatCount);
  /** Place open seats evenly around the solo player (left, then right). */
  const leftOpen = Math.floor(openCount / 2);
  const rightOpen = openCount - leftOpen;

  const dealerShow = useMemo(() => {
    if (dealer.concealAll) return { text: "…", soft: false };
    if (!dealer.cards.length) return { text: "—", soft: false };
    const visible =
      dealer.hiddenIndices?.length && dealer.cards.length
        ? dealer.cards.slice(0, 1)
        : dealer.cards;
    const v = handValue(visible);
    return { text: String(v.total), soft: v.soft };
  }, [dealer]);

  const playerBadge = useMemo(() => {
    if (player.concealAll) return "Sealed";
    if (!player.cards.length) return playerPhase === "betting" ? "Place bet" : "—";
    return formatTotal(player.cards);
  }, [player, playerPhase]);

  const playerStatus =
    sealing
      ? "Sealing"
      : playerPhase === "player"
        ? "Your turn"
        : playerPhase === "dealer"
          ? "Dealer"
          : playerPhase === "done"
            ? player.result ?? "Settled"
            : playerPhase === "dealing"
              ? "Dealing"
              : "Ready";

  return (
    <div className={`live-round live-round--solo${sealing ? " is-sealing" : ""}`}>
      <div className="live-round__glow live-round__glow--a" aria-hidden />
      <div className="live-round__glow live-round__glow--b" aria-hidden />

      <div className="live-ribbon">
        <div className="live-ribbon__left">
          <div className="live-pill live-pill--live">
            <span className="live-pill__ping" />
            <span>{shoeLabel}</span>
          </div>
          <div className="live-pill live-pill--rules">
            <span>Rules:</span>
            <strong>{rulesLabel}</strong>
          </div>
          <div className="live-pill live-pill--seats">
            <span className="material-symbols-outlined">event_seat</span>
            <span>
              {seatCount}/{maxSeats} seats
            </span>
          </div>
        </div>
        <div className="live-ribbon__right">
          <button
            type="button"
            className="live-pill-btn"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span className="material-symbols-outlined">history</span>
            Shoe history
          </button>
          <button
            type="button"
            className="live-pill-btn live-pill-btn--lounge"
            onClick={() => setLoungeOpen(true)}
          >
            <span className="material-symbols-outlined">forum</span>
            Room lounge
          </button>
        </div>
      </div>

      {historyOpen && (
        <p className="live-history" role="status">
          {tableMessage ?? `Shoe telemetry · ${shoeLeft} cards remaining · commit sealed on deal`}
        </p>
      )}

      {banner}

      <div className="arena-shell">
        <div className="arena-rail">
          <div className={`arena-felt${sealing ? " is-sealing" : ""}`}>
            {sealing && (
              <div className="seal-banner" role="status" aria-live="polite">
                <span className="seal-banner__dot" />
                {sealMessage ?? "Waiting for chain confirmation…"}
              </div>
            )}

            <div className="felt-print" aria-hidden>
              <svg className="felt-print__arcs" viewBox="0 0 940 180" fill="none">
                <path
                  d="M 40 160 C 260 20, 680 20, 900 160"
                  stroke="#ffb95f"
                  strokeDasharray="6 6"
                  strokeOpacity="0.35"
                  strokeWidth="1.25"
                />
                <path
                  d="M 120 170 C 310 50, 630 50, 820 170"
                  stroke="#ffb95f"
                  strokeOpacity="0.25"
                  strokeWidth="0.75"
                />
              </svg>
              <p className="felt-print__title">Blackjack Pays 3 to 2</p>
              <p className="felt-print__sub">
                Dealer Must Draw to 16 and Stand on All 17s · Insurance Pays 2 to 1
              </p>
            </div>

            <div className="dealer-zone">
              <div className="dealer-equip">
                <div className="dealer-box">
                  <span>Shoe #1</span>
                  <div className="dealer-box__stack">
                    <div className="dealer-box__card dealer-box__card--shoe" />
                    <em>{shoeLeft} cds</em>
                  </div>
                </div>

                <div className="vault-float">
                  <div className="vault-float__chips" aria-hidden>
                    {["$1", "$5", "$25", "$100", "$500", "$1K"].map((l) => (
                      <span key={l} className="mini-chip">
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="vault-float__meta">
                    <span>Vault float</span>
                    <strong>$450,000</strong>
                  </div>
                </div>

                <div className="dealer-box">
                  <span>Discard</span>
                  <div className="dealer-box__stack">
                    <div className="dealer-box__card dealer-box__card--discard" />
                    <em>{Math.max(0, 312 - shoeLeft)} cds</em>
                  </div>
                </div>
              </div>

              <div className="dealer-shows">
                <span>Dealer shows</span>
                <strong>{dealerShow.text}</strong>
                {dealerShow.soft && <em>(Soft)</em>}
              </div>

              <HandView
                label="Dealer"
                cards={dealer.cards}
                concealAll={dealer.concealAll}
                sealedSlots={dealer.sealedSlots}
                hiddenIndices={dealer.hiddenIndices}
                flippingIndices={dealer.flippingIndices}
                dealBase={dealer.dealBase ?? 1}
                throwTo="dealer"
                hideMeta
              />
            </div>

            <div
              className="seats-arc seats-arc--solo"
              style={{ ["--seat-cols" as string]: maxSeats }}
              aria-label={`Table seats ${seatCount} of ${maxSeats} occupied`}
            >
              {Array.from({ length: leftOpen }, (_, i) => (
                <OpenSeat key={`open-l-${i}`} index={i} />
              ))}

              <PlayerSeat
                player={player}
                bankroll={bankroll}
                playerBadge={playerBadge}
                playerStatus={playerStatus}
                playerPhase={playerPhase}
                sealing={sealing}
              />

              {Array.from({ length: rightOpen }, (_, i) => (
                <OpenSeat key={`open-r-${i}`} index={leftOpen + i + seatCount} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="control-console">{controls}</div>

      {footer}

      <RoomLoungeDrawer
        open={loungeOpen}
        onClose={() => setLoungeOpen(false)}
        roomCode={roomCode}
        occupiedSeats={seatCount}
        maxSeats={maxSeats}
      />
    </div>
  );
}
