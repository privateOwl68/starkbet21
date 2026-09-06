type Props = {
  shoeLeft?: number;
  message?: string | null;
  roomLabel?: string;
};

export function Table({
  shoeLeft,
  message,
  roomLabel = "Velvet Shoe",
}: Props) {
  return (
    <section className="rail">
      <div className="dealer-pod">
        <img
          className="dealer-pod__avatar"
          src="/brand/dealer-avatar.jpg"
          alt=""
          width={56}
          height={56}
          decoding="async"
        />
        <div className="dealer-pod__meta">
          <span className="dealer-pod__role">House Dealer</span>
          <span className="dealer-pod__room">{roomLabel}</span>
        </div>
      </div>
      <p className="commitment">
        Live shoe ·{" "}
        <code>{shoeLeft != null ? `${shoeLeft} cards left` : "select chips to bet"}</code>
      </p>
      {message && (
        <p className="banner" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
