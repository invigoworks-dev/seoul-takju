'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { dashboardApi, settingsApi } from '@/lib/api';
import { cn, getTodayString } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

interface InventorySummaryItem {
  key: string;
  unit: string;
  prev_amount: number;
  prev_date: string;
  received: number;
  used: number;
  balance: number;
}

interface SummaryResponse {
  to: string;
  items: InventorySummaryItem[];
}

interface HistoryRow {
  ledger_date: string;
  received: number;
  u2?: number;
  u3?: number;
  u4?: number;
  used?: number;
  shipped?: number;
  balance: number;
}

interface HistoryResponse {
  item: string;
  unit: string;
  from: string;
  to: string;
  carry_balance: number;
  rows: HistoryRow[];
}

// ── Constants ─────────────────────────────────────────────

const ITEM_ORDER = ['평화미', '백미', '효모', '곡자', '아스파탐', '구연산', '주류', '용기', '마개'];

type ItemType = 'raw' | 'ferment' | 'liquor' | 'container';

function getItemType(key: string): ItemType {
  if (key === '평화미' || key === '백미') return 'raw';
  if (key === '주류') return 'liquor';
  if (key === '용기' || key === '마개') return 'container';
  return 'ferment';
}

// ── Helpers ───────────────────────────────────────────────

function getDaysAgoString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function fmt(value: number | string | null | undefined, unit: string): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(n)) return '0';
  if (unit === 'kg' || unit === 'L') {
    return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString('ko-KR');
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

// ── ItemChip ──────────────────────────────────────────────

function ItemChip({
  item,
  selected,
  onClick,
}: {
  item: InventorySummaryItem;
  selected: boolean;
  onClick: () => void;
}) {
  const hasReceipt = toNum(item.received) > 0;
  const hasUsage = toNum(item.used) > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start px-3.5 py-2.5 rounded-lg border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-koji focus-visible:ring-offset-1 flex-shrink-0 min-w-[90px] text-left',
        selected
          ? 'bg-brand-wood border-brand-wood shadow-md'
          : 'bg-surface-card border-surface-secondary hover:border-brand-koji/40 hover:shadow-sm'
      )}
    >
      <span className={cn('text-xs font-semibold tracking-wide leading-none mb-1.5', selected ? 'text-brand-koji' : 'text-ink-muted')}>
        {item.key}
      </span>
      <span className={cn('text-base font-bold tabular-nums leading-none', selected ? 'text-ink-inverse' : 'text-ink-primary')}>
        {fmt(item.balance, item.unit)}
      </span>
      <span className={cn('text-[10px] mt-0.5 leading-none', selected ? 'text-brand-rice/50' : 'text-ink-muted')}>
        {item.unit}
      </span>

      {/* Tiny receipt/usage indicators */}
      {(hasReceipt || hasUsage) && (
        <div className="flex gap-1 mt-1.5">
          {hasReceipt && (
            <span className={cn('text-[9px] leading-none font-medium', selected ? 'text-emerald-400' : 'text-accent-receipt')}>
              ↑
            </span>
          )}
          {hasUsage && (
            <span className={cn('text-[9px] leading-none font-medium', selected ? 'text-rose-400' : 'text-accent-usage')}>
              ↓
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// Skeleton chip for loading
function ItemChipSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-start px-3.5 py-2.5 rounded-lg border border-surface-secondary bg-surface-card flex-shrink-0 min-w-[90px] animate-pulse">
      <span className="text-xs font-semibold text-ink-muted leading-none mb-1.5">{label}</span>
      <div className="h-5 w-14 rounded bg-surface-secondary" />
      <div className="h-3 w-7 rounded bg-surface-secondary/70 mt-1" />
    </div>
  );
}

// ── HistoryTable ──────────────────────────────────────────

function HistoryTable({
  history,
  loading,
  selectedItem,
}: {
  history: HistoryResponse | null;
  loading: boolean;
  selectedItem: string;
}) {
  if (loading) {
    return (
      <div className="flex-1 rounded-lg border border-surface-secondary bg-surface-card">
        <div className="px-4 py-2.5 border-b border-surface-secondary bg-surface-secondary/30 flex items-center gap-2">
          <span className="font-bold text-sm text-ink-primary">{selectedItem}</span>
          <span className="text-xs text-ink-muted animate-pulse">불러오는 중...</span>
        </div>
        <div className="p-8 text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="h-3 w-48 rounded bg-surface-secondary animate-pulse" />
            <div className="h-3 w-36 rounded bg-surface-secondary animate-pulse" />
            <div className="h-3 w-52 rounded bg-surface-secondary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="flex-1 rounded-lg border border-surface-secondary bg-surface-card flex items-center justify-center">
        <p className="text-xs text-ink-muted">품목을 선택하면 이력이 표시됩니다</p>
      </div>
    );
  }

  const type = getItemType(history.item);
  const isRaw = type === 'raw';
  const isLiquor = type === 'liquor';
  const usedLabel = isLiquor ? '출하' : '출고';
  const colSpan = isRaw ? 6 : 4;

  return (
    <div className="flex-1 rounded-lg border border-surface-secondary bg-surface-card overflow-hidden flex flex-col min-h-0">
      {/* Table header bar */}
      <div className="px-4 py-2.5 border-b border-surface-secondary bg-surface-secondary/30 flex items-center gap-2 flex-shrink-0">
        <span className="font-bold text-sm text-ink-primary">{history.item}</span>
        <span className="text-xs text-ink-muted">재고 변동 이력</span>
        <span className="ml-auto text-xs text-ink-muted tabular-nums">
          {history.from} ~ {history.to}
        </span>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-secondary/60 border-b border-surface-secondary backdrop-blur-sm">
              <th className="text-left px-3 py-2 text-ink-secondary font-medium whitespace-nowrap">날짜</th>
              <th className="text-right px-3 py-2 text-accent-receipt font-medium whitespace-nowrap">입고</th>
              {isRaw ? (
                <>
                  <th className="text-right px-3 py-2 text-accent-usage font-medium whitespace-nowrap">2차담금</th>
                  <th className="text-right px-3 py-2 text-accent-usage font-medium whitespace-nowrap">3차담금</th>
                  <th className="text-right px-3 py-2 text-accent-usage font-medium whitespace-nowrap">4차담금</th>
                </>
              ) : (
                <th className="text-right px-3 py-2 text-accent-usage font-medium whitespace-nowrap">{usedLabel}</th>
              )}
              <th className="text-right px-3 py-2 text-ink-primary font-bold whitespace-nowrap">잔량</th>
            </tr>
          </thead>
          <tbody>
            {/* Carry balance row */}
            <tr className="bg-surface-secondary/40 border-b border-surface-secondary/60">
              <td className="px-3 py-1.5 text-ink-muted text-[11px] italic">기간 이전 잔량</td>
              <td className="px-3 py-1.5 text-right text-ink-muted">—</td>
              {isRaw ? (
                <>
                  <td className="px-3 py-1.5 text-right text-ink-muted">—</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">—</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">—</td>
                </>
              ) : (
                <td className="px-3 py-1.5 text-right text-ink-muted">—</td>
              )}
              <td className="px-3 py-1.5 text-right font-bold tabular-nums text-ink-secondary">
                {fmt(history.carry_balance, history.unit)}
              </td>
            </tr>

            {history.rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-12 text-center text-ink-muted text-xs">
                  해당 기간 데이터 없음
                </td>
              </tr>
            ) : (
              history.rows.map((row, idx) => {
                const outgoing = isLiquor ? toNum(row.shipped) : toNum(row.used);
                return (
                  <tr
                    key={row.ledger_date}
                    className={cn(
                      'border-b border-surface-secondary/40 last:border-b-0',
                      idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/20'
                    )}
                  >
                    <td className="px-3 py-1.5 tabular-nums text-ink-secondary whitespace-nowrap">{row.ledger_date}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-accent-receipt whitespace-nowrap">
                      {toNum(row.received) > 0 ? `+${fmt(row.received, history.unit)}` : '—'}
                    </td>
                    {isRaw ? (
                      <>
                        <td className="px-3 py-1.5 text-right tabular-nums text-accent-usage whitespace-nowrap">
                          {toNum(row.u2) > 0 ? fmt(row.u2, history.unit) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-accent-usage whitespace-nowrap">
                          {toNum(row.u3) > 0 ? fmt(row.u3, history.unit) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-accent-usage whitespace-nowrap">
                          {toNum(row.u4) > 0 ? fmt(row.u4, history.unit) : '—'}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-1.5 text-right tabular-nums text-accent-usage whitespace-nowrap">
                        {outgoing > 0 ? fmt(outgoing, history.unit) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-ink-primary whitespace-nowrap">
                      {fmt(row.balance, history.unit)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export default function InventoryPage() {
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('평화미');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>(getTodayString());
  const [prevDate, setPrevDate] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // On mount: load prev_balance to get baseline date
  useEffect(() => {
    settingsApi.getPrevBalance().then((balances) => {
      if (balances.length > 0) {
        const date = balances[0].balance_date || getDaysAgoString(30);
        setDateFrom(date);
        setPrevDate(balances[0].balance_date ?? '');
      }
    }).catch(() => {});
  }, []);

  // Load summary whenever dateTo changes
  const loadSummary = useCallback(async (to: string) => {
    setLoadingSummary(true);
    try {
      const result = await dashboardApi.inventorySummary(to) as unknown as SummaryResponse;
      setSummaryData(result);
    } catch {
      setSummaryData(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (dateTo) loadSummary(dateTo);
  }, [dateTo, loadSummary]);

  // Load history when selected item or dates change
  const loadHistory = useCallback(async (item: string, from: string, to: string) => {
    if (!from || !to) return;
    setLoadingHistory(true);
    try {
      const result = await dashboardApi.inventoryHistory(item, from, to) as unknown as HistoryResponse;
      setHistoryData(result);
    } catch {
      setHistoryData(null);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedItem && dateFrom && dateTo) {
      loadHistory(selectedItem, dateFrom, dateTo);
    }
  }, [selectedItem, dateFrom, dateTo, loadHistory]);

  const handleResetDates = useCallback(() => {
    setDateTo(getTodayString());
    settingsApi.getPrevBalance().then((b) => {
      if (b.length > 0) {
        setDateFrom(b[0].balance_date || getDaysAgoString(30));
        setPrevDate(b[0].balance_date ?? '');
      }
    }).catch(() => {});
  }, []);

  // Sort items by canonical order
  const sortedItems = summaryData
    ? ITEM_ORDER.map((key) => summaryData.items.find((i) => i.key === key)).filter(Boolean) as InventorySummaryItem[]
    : [];

  const subtitle = prevDate
    ? `기초재고 기준일: ${prevDate} · 조회일: ${dateTo}`
    : `조회일: ${dateTo}`;

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col">
      <Header title="재고현황" subtitle={subtitle} />

      <div className="flex flex-col flex-1 p-4 gap-3 min-h-0" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* ── Compact item selector strip ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-shrink-0 scrollbar-none">
          {sortedItems.length > 0
            ? sortedItems.map((item) => (
                <ItemChip
                  key={item.key}
                  item={item}
                  selected={selectedItem === item.key}
                  onClick={() => setSelectedItem(item.key)}
                />
              ))
            : ITEM_ORDER.map((key) => <ItemChipSkeleton key={key} label={key} />)
          }
          {loadingSummary && sortedItems.length > 0 && (
            <span className="self-center text-[10px] text-brand-koji animate-pulse flex-shrink-0">갱신 중</span>
          )}
        </div>

        {/* ── Date filter bar ── */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className="text-xs text-ink-muted">이력 기간</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs border border-surface-secondary rounded px-2 py-1 bg-surface-card text-ink-primary focus:outline-none focus:border-brand-koji"
          />
          <span className="text-xs text-ink-muted">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs border border-surface-secondary rounded px-2 py-1 bg-surface-card text-ink-primary focus:outline-none focus:border-brand-koji"
          />
          <button
            onClick={handleResetDates}
            className="text-xs px-2.5 py-1 rounded border border-surface-secondary bg-surface-secondary/50 text-ink-secondary hover:bg-surface-secondary transition-colors"
          >
            전체
          </button>
        </div>

        {/* ── History table (main content) ── */}
        <div className="flex flex-col flex-1 min-h-0" style={{ minHeight: '400px' }}>
          <HistoryTable
            history={historyData}
            loading={loadingHistory}
            selectedItem={selectedItem}
          />
        </div>

      </div>
    </div>
  );
}
