const GRADIENTS = [
  ['#34E5A4', '#7C6BFF'],
  ['#7C6BFF', '#FF6B9D'],
  ['#F6A24A', '#FF6B6B'],
  ['#4AC8FF', '#34E5A4'],
  ['#FFD24A', '#F6A24A'],
  ['#A18AFF', '#4AC8FF'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  seed,
  label,
  size = 40,
}: {
  seed: string;
  label: string;
  size?: number;
}): JSX.Element {
  const [a, b] = GRADIENTS[hash(seed) % GRADIENTS.length]!;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
    >
      {label.replace(/^\$/, '').charAt(0).toUpperCase()}
    </span>
  );
}
