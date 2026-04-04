'use client';

import { getTodayString, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { PrintButton } from '@/components/ui/PrintHeader';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const today = formatDate(getTodayString());
  const { user, logout } = useAuth();

  return (
    <header className="bg-surface-card border-b border-surface-secondary px-5 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-base font-bold text-ink-primary">{title}</h2>
        {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <PrintButton />
        <span className="text-xs text-ink-muted tabular-nums">{today}</span>
        {user && (
          <div className="flex items-center gap-3 border-l border-surface-secondary pl-4">
            <span className="text-xs text-ink-secondary font-medium">{user.name}</span>
            <button
              onClick={logout}
              aria-label="로그아웃"
              className="text-[11px] text-ink-muted hover:text-brand-clay transition-colors"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
