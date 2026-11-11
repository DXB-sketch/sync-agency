// Inline icons for the Sync Rewards screens (from the sync-rewards mockups).
const base = { "aria-hidden": "true", viewBox: "0 0 24 24" };
const line = { ...base, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const ShieldIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z" /></svg>
);
export const CrateIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>
);
export const CreditIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h3" /><path d="M3 10h18" /></svg>
);
export const SlotIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><path d="M4 7h16l-1.5 12h-13z" /><path d="M9 7a3 3 0 0 1 6 0" /><path d="M12 11v5M9.5 13.5h5" /></svg>
);
export const BoltIcon = ({ size = 18, filled = false }) => (
  <svg {...(filled ? { ...base, fill: "currentColor" } : line)} width={size} height={size}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
);
export const TagIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor" /></svg>
);
export const CheckIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size} strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
);
export const PlusIcon = ({ size = 12 }) => (
  <svg {...line} width={size} height={size} strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
);
export const BackIcon = ({ size = 14 }) => (
  <svg {...line} width={size} height={size} strokeWidth="2.2"><path d="M15 5l-7 7 7 7" /></svg>
);
export const ArrowIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const CloseIcon = ({ size = 20 }) => (
  <svg {...line} width={size} height={size}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const StarIcon = ({ size = 18 }) => (
  <svg {...line} width={size} height={size}><path d="M12 3l2.5 5.5L20 9.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1z" /></svg>
);
export const SoundIcon = ({ on, size = 18 }) => (
  <svg {...line} width={size} height={size}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
  </svg>
);

// One icon per reward kind (crate rewards, milestones and the track)
export function RewardKindIcon({ kind, size = 18 }) {
  if (kind === "credit") return <CreditIcon size={size} />;
  if (kind === "slot") return <SlotIcon size={size} />;
  if (kind === "discount") return <TagIcon size={size} />;
  if (kind === "xp") return <BoltIcon size={size} filled />;
  if (kind === "rank") return <ShieldIcon size={size} />;
  return <CrateIcon size={size} />;
}
