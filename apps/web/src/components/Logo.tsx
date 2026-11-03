export function Logo({ size = 28 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="floatg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6E45FF" />
          <stop offset="1" stopColor="#F54B00" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#floatg)" />
      <path
        d="M9 19c2.2-3.4 4.4-3.4 6.6 0 2.2 3.4 4.4 3.4 6.6 0"
        stroke="#0D0D13"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9 13c2.2-3.4 4.4-3.4 6.6 0 2.2 3.4 4.4 3.4 6.6 0"
        stroke="#0D0D13"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}
