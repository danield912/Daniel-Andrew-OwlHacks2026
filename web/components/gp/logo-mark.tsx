// Philly GamePlan logo: the Liberty Bell on a game ticket.
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 180 180" className={className} aria-hidden="true">
    <rect width="180" height="180" rx="40" fill="#0e1f2b" />
    <rect x="1.5" y="1.5" width="177" height="177" rx="38.5" fill="none" stroke="#5eead4" strokeOpacity="0.35" strokeWidth="3" />
    <rect x="26" y="46" width="128" height="88" rx="12" fill="#5eead4" />
    <circle cx="26" cy="90" r="11" fill="#0e1f2b" />
    <circle cx="154" cy="90" r="11" fill="#0e1f2b" />
    <line x1="120" y1="52" x2="120" y2="128" stroke="#0e1f2b" strokeWidth="3" strokeDasharray="5 5" />
    <rect x="64" y="56" width="28" height="7" rx="2" fill="#07121a" />
    <path d="M78 62 L78 68" stroke="#07121a" strokeWidth="4" />
    <path d="M58 113 Q58 74 78 67 Q98 74 98 113 Z" fill="#07121a" />
    <rect x="54" y="110" width="48" height="7" rx="3.5" fill="#07121a" />
    <path d="M80 76 L74 87 L81 95 L75 106" fill="none" stroke="#5eead4" strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx="78" cy="122" r="4.5" fill="#07121a" />
  </svg>;
}
