type Props = {
  busy: boolean;
  phase: "betting" | "insurance" | "player" | "dealer" | "done" | "dealing";
  canDeal?: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsurance: (take: boolean) => void;
  onNewRound: () => void;
};

export function ActionBar({
  busy,
  phase,
  canDeal = true,
  canHit,
  canStand,
  canDouble,
  canSplit,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsurance,
  onNewRound,
}: Props) {
  return (
    <div className="actions actions--console" role="group" aria-label="Table actions">
      {phase === "betting" && (
        <button
          type="button"
          className="btn btn--deal"
          disabled={busy || !canDeal}
          onClick={onDeal}
          title={canDeal ? "Deal" : "Select chips to place a bet"}
        >
          <span className="material-symbols-outlined">playing_cards</span>
          Deal
        </button>
      )}

      {phase === "insurance" && (
        <>
          <p className="actions__prompt">Insurance?</p>
          <button
            type="button"
            className="btn btn--gold"
            disabled={busy}
            onClick={() => onInsurance(true)}
          >
            Yes · ½ bet
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => onInsurance(false)}>
            No
          </button>
        </>
      )}

      {phase === "player" && (
        <>
          <button
            type="button"
            className="btn btn--stand"
            disabled={busy || !canStand}
            onClick={onStand}
          >
            <span className="material-symbols-outlined">pan_tool</span>
            Stand
          </button>
          <button
            type="button"
            className="btn btn--hit"
            disabled={busy || !canHit}
            onClick={onHit}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Hit
          </button>
          <button
            type="button"
            className="btn btn--gold"
            disabled={busy || !canDouble}
            onClick={onDouble}
            title="Double down"
          >
            <span className="material-symbols-outlined">exposure_plus_2</span>
            Double
          </button>
          <button
            type="button"
            className="btn btn--gold btn--split"
            disabled={busy || !canSplit}
            onClick={onSplit}
            title="Requires matching rank cards to split"
          >
            <span className="material-symbols-outlined">call_split</span>
            Split
          </button>
        </>
      )}

      {phase === "done" && (
        <button type="button" className="btn btn--deal" disabled={busy} onClick={onNewRound}>
          <span className="material-symbols-outlined">replay</span>
          Next hand
        </button>
      )}

      {(phase === "dealer" || phase === "dealing") && (
        <p className="actions__prompt" aria-live="polite">
          {phase === "dealing" ? "Dealing…" : "Dealer drawing…"}
        </p>
      )}
    </div>
  );
}
