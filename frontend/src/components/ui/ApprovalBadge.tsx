'use client';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-brand-koji/15 text-brand-koji' },
  approved: { label: '승인', className: 'bg-accent-receipt/15 text-accent-receipt' },
  rejected: { label: '반려', className: 'bg-brand-clay/15 text-brand-clay' },
};

export default function ApprovalBadge({ status, size = 'sm' }: ApprovalBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-block rounded-full font-semibold ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}

export type { ApprovalStatus };
