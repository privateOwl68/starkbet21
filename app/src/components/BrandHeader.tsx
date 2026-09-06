type Props = {
  eyebrow?: string;
  tagline?: string;
};

export function BrandHeader({
  eyebrow = "Private multiplayer · Velvet & Onyx",
  tagline = "Provably fair blackjack · H17 · 3:2",
}: Props) {
  return (
    <header className="hero">
      <img
        className="brand-mark"
        src="/brand/logo.jpg"
        alt=""
        width={72}
        height={72}
        decoding="async"
      />
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="brand">
        <span className="brand__stark">Stark</span>
        <span className="brand__bet">Bet</span>
        <span className="brand__21">21</span>
      </h1>
      <p className="tagline">{tagline}</p>
    </header>
  );
}
