'use client';

type SortDirection = 'none' | 'asc' | 'desc';

interface SortIconProps {
  direction: SortDirection;
  className?: string;
}

export default function SortIcon({ direction, className = '' }: SortIconProps) {
  if (direction === 'asc') {
    return (
      <svg
        className={`w-3 h-3 text-brand-koji inline-block ${className}`}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9V3M3 6l3-3 3 3" />
      </svg>
    );
  }
  if (direction === 'desc') {
    return (
      <svg
        className={`w-3 h-3 text-brand-koji inline-block ${className}`}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 3v6M3 6l3 3 3-3" />
      </svg>
    );
  }
  // none
  return (
    <svg
      className={`w-3 h-3 text-ink-muted/40 inline-block group-hover:text-ink-muted/60 transition-colors ${className}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9V3M3 5l3-3 3 3M3 7l3 3 3-3" />
    </svg>
  );
}

export type { SortDirection };
