'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';

type Tab = 'mfg' | 'status' | 'inv' | 'settings';

interface NavItem {
  label: string;
  href: string;
  code: string;
  exact?: boolean;
  roles?: UserRole[];
}

// 원장 관리 (주류제조부)
const ledgerItems: NavItem[] = [
  { label: '입국 수불', href: '/ledger/koji', code: '입국' },
  { label: '술덧담금 및 걸름', href: '/ledger/mash', code: '술덧' },
  { label: '술지거미 수불', href: '/ledger/lees', code: '지거' },
  { label: '1차 술덧 담금', href: '/ledger/first-mash', code: '1차' },
  { label: '밑술 제조', href: '/ledger/starter', code: '밑술' },
  { label: '주류 수불', href: '/ledger/liquor', code: '주류' },
];

// 원료 수불 (접이식)
const rawItems: NavItem[] = [
  { label: '평화미', href: '/ledger/raw-material?type=평화미', code: '평화' },
  { label: '백미', href: '/ledger/raw-material?type=백미', code: '백미' },
  { label: '효모', href: '/ledger/raw-material?type=효모', code: '효모' },
  { label: '곡자 (발효제)', href: '/ledger/raw-material?type=곡자', code: '곡자' },
  { label: '아스파탐 (첨가물)', href: '/ledger/raw-material?type=아스파탐', code: '아스' },
  { label: '구연산 (첨가물)', href: '/ledger/raw-material?type=구연산', code: '구연' },
];

// 업무 (주류제조부 탭)
const workflowItems: NavItem[] = [
  { label: '승인 관리', href: '/approvals', code: '승인' },
];

// 현황 보고 (주류현황 탭)
const statusItems: NavItem[] = [
  { label: '현황일보', href: '/dashboard', code: '일보', exact: true },
  { label: '현황월보', href: '/dashboard/monthly', code: '월보' },
];

// 재고 관리 (재고관리 탭)
const inventoryItems: NavItem[] = [
  { label: '재고현황', href: '/dashboard/inventory', code: '재고' },
];

// 시스템 (설정 탭)
const settingsItems: NavItem[] = [
  { label: '설정', href: '/settings', code: '설정' },
];

// 관리 (설정 탭 — admin only)
const adminItems: NavItem[] = [
  { label: '사용자 관리', href: '/admin/users', code: '관리', roles: ['admin'] },
];

// Pathname → active tab detection
function getActiveTab(pathname: string): Tab {
  if (pathname === '/dashboard/inventory') return 'inv';
  if (pathname.startsWith('/dashboard')) return 'status';
  if (pathname.startsWith('/settings') || pathname.startsWith('/admin')) return 'settings';
  return 'mfg'; // /ledger/*, /approvals, fallback
}

const TAB_DEFAULT_ROUTES: Record<Tab, string> = {
  mfg: '/ledger/koji',
  status: '/dashboard',
  inv: '/dashboard/inventory',
  settings: '/settings',
};

const TOP_TABS: { id: Tab; label: string }[] = [
  { id: 'mfg', label: '주류제조부' },
  { id: 'status', label: '주류현황' },
  { id: 'inv', label: '재고관리' },
  { id: 'settings', label: '설정' },
];

function NavLink({
  item,
  pathname,
  searchParams,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  onNavigate?: () => void;
}) {
  const [hrefPath, hrefQuery] = item.href.split('?');
  let isActive: boolean;
  if (hrefQuery) {
    const hrefParams = new URLSearchParams(hrefQuery);
    isActive =
      pathname === hrefPath &&
      Array.from(hrefParams.entries()).every(([k, v]) => searchParams.get(k) === v);
  } else {
    isActive = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded text-[13px] transition-colors',
          isActive
            ? 'bg-brand-koji/15 text-brand-koji font-semibold'
            : 'text-ink-inverse/50 hover:bg-brand-koji/8 hover:text-ink-inverse/80'
        )}
      >
        <span
          className={cn(
            'w-6 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm tracking-tighter shrink-0',
            isActive
              ? 'bg-brand-koji/25 text-brand-koji'
              : 'bg-ink-inverse/8 text-ink-inverse/40'
          )}
        >
          {item.code}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

function NavSection({
  title,
  items,
  pathname,
  searchParams,
  userRole,
  collapsible = false,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  userRole?: UserRole;
  collapsible?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const filtered = items.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );
  if (filtered.length === 0) return null;

  return (
    <div className="mb-3">
      {collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-medium tracking-widest text-brand-koji/30 uppercase hover:text-brand-koji/50 transition-colors"
        >
          <span>{title}</span>
          <span className="text-[9px]" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      ) : (
        <p className="px-2 mb-1.5 text-[10px] font-medium tracking-widest text-brand-koji/30 uppercase">
          {title}
        </p>
      )}
      {(!collapsible || open) && (
        <ul className="space-y-px">
          {filtered.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              searchParams={searchParams}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userRole = user?.role;
  const activeTab = getActiveTab(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on navigation
  const prevPathname = pathname;

  return (
    <>
      {/* ── Top navigation bar ── */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-brand-wood z-50 flex items-center px-4 gap-1 border-b border-brand-koji/15">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-ink-inverse/70 hover:text-ink-inverse mr-2 text-lg"
          aria-label="메뉴"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
        <span className="text-brand-koji font-bold text-sm tracking-tight mr-3 shrink-0">
          서울탁주
        </span>
        <span className="w-px h-5 bg-brand-koji/20 mr-1 shrink-0 hidden md:block" aria-hidden />
        {TOP_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={TAB_DEFAULT_ROUTES[tab.id]}
            className={cn(
              'hidden md:inline-flex px-3 py-1.5 rounded text-[13px] font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-brand-koji/20 text-brand-koji'
                : 'text-ink-inverse/50 hover:bg-brand-koji/8 hover:text-ink-inverse/70'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Context sidebar ── */}
      <aside className={cn(
        'fixed left-0 top-14 bottom-0 w-[200px] bg-brand-wood text-ink-inverse flex flex-col z-40 border-r border-brand-koji/10 transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {activeTab === 'mfg' && (
            <>
              <NavSection
                title="원장 관리"
                items={ledgerItems}
                pathname={pathname}
                searchParams={searchParams}
                userRole={userRole}
                onNavigate={() => setMobileOpen(false)}
              />
              <NavSection
                title="원료 수불"
                items={rawItems}
                pathname={pathname}
                searchParams={searchParams}
                userRole={userRole}
                collapsible
              />
              <NavSection
                title="업무"
                items={workflowItems}
                pathname={pathname}
                searchParams={searchParams}
                userRole={userRole}
                onNavigate={() => setMobileOpen(false)}
              />
            </>
          )}
          {activeTab === 'status' && (
            <NavSection
              title="현황 보고"
              items={statusItems}
              pathname={pathname}
              searchParams={searchParams}
              userRole={userRole}
            />
          )}
          {activeTab === 'inv' && (
            <NavSection
              title="재고 관리"
              items={inventoryItems}
              pathname={pathname}
              searchParams={searchParams}
              userRole={userRole}
            />
          )}
          {activeTab === 'settings' && (
            <>
              <NavSection
                title="시스템"
                items={settingsItems}
                pathname={pathname}
                searchParams={searchParams}
                userRole={userRole}
                onNavigate={() => setMobileOpen(false)}
              />
              <NavSection
                title="관리"
                items={adminItems}
                pathname={pathname}
                searchParams={searchParams}
                userRole={userRole}
                onNavigate={() => setMobileOpen(false)}
              />
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
