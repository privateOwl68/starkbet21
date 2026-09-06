import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  roomCode?: string;
  occupiedSeats?: number;
  maxSeats?: number;
};

type FeedMsg =
  | { kind: "system"; text: string }
  | { kind: "them" | "you"; name: string; when: string; text: string };

export function RoomLoungeDrawer({
  open,
  onClose,
  roomCode = "V21-9942",
  occupiedSeats = 1,
  maxSeats = 5,
}: Props) {
  const titleId = useId();
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<FeedMsg[]>(() => [
    {
      kind: "system",
      text: `Solo table · ${occupiedSeats}/${maxSeats} seats · Extra seats unlock later`,
    },
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { kind: "you", name: "You", when: "Just now", text },
    ]);
    setDraft("");
  };

  const openSlots = Math.max(0, maxSeats - occupiedSeats);

  return (
    <>
      <button
        type="button"
        className={`lounge-scrim${open ? " is-open" : ""}`}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        className={`lounge-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
        aria-labelledby={titleId}
        role="dialog"
      >
        <header className="lounge-drawer__head">
          <div>
            <div className="lounge-drawer__title-row">
              <span className="lounge-drawer__live-dot" />
              <h2 id={titleId}>Penthouse Suite</h2>
            </div>
            <div className="lounge-drawer__code">
              <span>Room</span>
              <strong>{roomCode}</strong>
              <button type="button" className="icon-btn" onClick={() => void copyCode()} title="Copy room code">
                <span className="material-symbols-outlined">content_copy</span>
              </button>
              {copied && <span className="lounge-drawer__copied">Copied!</span>}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close lounge">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <section className="lounge-companions">
          <div className="lounge-companions__meta">
            <span>
              Table ({occupiedSeats}/{maxSeats})
            </span>
            <span className="is-voice">Solo · voice later</span>
          </div>
          <div className="lounge-companions__grid lounge-companions__grid--solo">
            <div className="lounge-companion is-you">
              <div className="avatar-initials avatar-initials--sm is-you">
                Y
                <span className="mic-badge mic-badge--on">
                  <span className="material-symbols-outlined">mic</span>
                </span>
              </div>
              <span>You</span>
            </div>
            {Array.from({ length: openSlots }, (_, i) => (
              <div key={i} className="lounge-companion lounge-companion--open">
                <div className="avatar-initials avatar-initials--sm avatar-initials--locked">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <span>Open</span>
              </div>
            ))}
          </div>
        </section>

        <div className="lounge-feed">
          {messages.map((m, i) =>
            m.kind === "system" ? (
              <p key={i} className="lounge-feed__system">
                {m.text}
              </p>
            ) : (
              <div key={i} className={`lounge-bubble${m.kind === "you" ? " is-you" : ""}`}>
                <div className="lounge-bubble__meta">
                  <span className="lounge-bubble__name">{m.name}</span>
                  <span className="lounge-bubble__when">{m.when}</span>
                </div>
                <p>{m.text}</p>
              </div>
            ),
          )}
        </div>

        <footer className="lounge-compose">
          <div className="lounge-reacts" aria-label="Quick reactions">
            {["🔥", "💎", "✋", "😱", "👏"].map((e) => (
              <button
                key={e}
                type="button"
                className="lounge-react"
                onClick={() =>
                  setMessages((m) => [
                    ...m,
                    { kind: "you", name: "You", when: "Just now", text: e },
                  ])
                }
              >
                {e}
              </button>
            ))}
          </div>
          <form
            className="lounge-input-row"
            onSubmit={(ev) => {
              ev.preventDefault();
              send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Notes for later multiplayer…"
              aria-label="Lounge message"
            />
            <button type="submit" className="btn btn--hit lounge-send" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </footer>
      </aside>
    </>
  );
}
