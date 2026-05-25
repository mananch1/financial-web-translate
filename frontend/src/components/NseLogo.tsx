// Re-creation of the NSE wordmark used in the header. We avoid hot-linking
// the real asset; this SVG follows NSE's actual logo: large stacked "NSE"
// in navy with a red accent slash, full corporate name in small caps below.
export default function NseLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="NSE">
      <svg
        viewBox="0 0 220 56"
        height={44}
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="nse-red" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e02431" />
            <stop offset="100%" stopColor="#a30a18" />
          </linearGradient>
        </defs>
        {/* Red flag/bar accent (left of the wordmark) */}
        <rect x="0" y="6" width="6" height="34" fill="url(#nse-red)" />
        <rect x="0" y="42" width="6" height="6" fill="#1d2a5a" />

        {/* "NSE" wordmark */}
        <text
          x="14"
          y="32"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="30"
          fontWeight="800"
          fill="#1d2a5a"
          letterSpacing="-1"
        >
          NSE
        </text>
        <text
          x="14"
          y="46"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="6.6"
          fontWeight="700"
          fill="#1d2a5a"
          letterSpacing="0.4"
        >
          NATIONAL STOCK EXCHANGE OF INDIA LIMITED
        </text>
        {/* Subtle red underscore on the "E" to echo the brand */}
        <rect x="73" y="34" width="9" height="2.5" fill="#c8102e" />
      </svg>
    </div>
  );
}
