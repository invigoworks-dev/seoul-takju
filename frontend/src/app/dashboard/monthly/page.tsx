'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { dashboardApi } from '@/lib/api';
import { formatNumber, toNum, cn } from '@/lib/utils';

interface SummaryRow {
  code?: string;
  name?: string;
  unit?: string;
  batch_code?: string;
  product_code?: string;
  product_name?: string;
  container_type?: string;
  total_received?: number;
  total_used?: number;
  total_produced?: number;
  total_shipped?: number;
}

interface MonthlySummary {
  year: string;
  month: string;
  from: string;
  to: string;
  raw_materials: SummaryRow[];
  fermentation_agents: SummaryRow[];
  koji: SummaryRow[];
  starter: SummaryRow[];
  mash: SummaryRow[];
  liquor: SummaryRow[];
  first_mash: SummaryRow[];
  lees: SummaryRow[];
  containers: SummaryRow[];
}

type SectionKey = keyof Omit<MonthlySummary, 'year' | 'month' | 'from' | 'to'>;

const SECTION_META: Record<SectionKey, { label: string; headerColor: string }> = {
  raw_materials:       { label: '원료수불',  headerColor: 'bg-brand-wood text-ink-inverse' },
  fermentation_agents: { label: '발효제',    headerColor: 'bg-brand-wood/90 text-ink-inverse' },
  koji:                { label: '입국',      headerColor: 'bg-brand-wood/80 text-ink-inverse' },
  starter:             { label: '밑술',      headerColor: 'bg-brand-koji/20 text-brand-wood' },
  first_mash:          { label: '1차 술덧', headerColor: 'bg-brand-koji/25 text-brand-wood' },
  mash:                { label: '술덧',      headerColor: 'bg-brand-koji/30 text-brand-wood' },
  liquor:              { label: '주류수불',  headerColor: 'bg-brand-koji text-brand-wood' },
  lees:                { label: '술지거미',  headerColor: 'bg-brand-wood/70 text-ink-inverse' },
  containers:          { label: '용기/마개', headerColor: 'bg-brand-wood/60 text-ink-inverse' },
};

const GROUPS: { name: string; barColor: string; sections: SectionKey[] }[] = [
  { name: '투입 자재', barColor: 'bg-brand-wood',       sections: ['raw_materials', 'fermentation_agents', 'koji'] },
  { name: '제조 과정', barColor: 'bg-brand-koji-muted', sections: ['starter', 'first_mash', 'mash'] },
  { name: '완제품·출하', barColor: 'bg-brand-koji',     sections: ['liquor', 'lees', 'containers'] },
];

function getDisplayName(row: SummaryRow): string {
  return row.name ?? row.product_name ?? row.container_type ?? row.batch_code ?? '';
}
function getDisplayCode(row: SummaryRow): string {
  return row.code ?? row.product_code ?? '';
}
function getIn(row: SummaryRow): number {
  return toNum(row.total_received ?? row.total_produced);
}
function getOut(row: SummaryRow): number {
  return toNum(row.total_used ?? row.total_shipped);
}

function SectionTable({ label, headerColor, items }: { label: string; headerColor: string; items: SummaryRow[] }) {
  if (items.length === 0) return null;

  const totalIn = items.reduce((sum, item) => sum + getIn(item), 0);
  const totalOut = items.reduce((sum, item) => sum + getOut(item), 0);
  const showSubtotal = items.length > 1;

  return (
    <div className="rounded border overflow-hidden bg-surface-card border-surface-secondary">
      <div className={cn('px-3 py-1.5 font-bold text-xs tracking-wide', headerColor)}>{label}</div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-secondary/50 border-b border-surface-secondary">
            <th className="text-left px-3 py-1.5 text-ink-secondary font-medium text-xs">품목</th>
            <th className="text-right px-3 py-1.5 text-ink-secondary font-medium text-xs">단위</th>
            <th className="text-right px-3 py-1.5 text-accent-receipt font-medium text-xs">월 입고/생산</th>
            <th className="text-right px-3 py-1.5 text-accent-usage font-medium text-xs">월 사용/출고</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={getDisplayCode(item) || getDisplayName(item) || idx} className={cn('border-b border-surface-secondary/50', idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/50')}>
              <td className="px-3 py-1.5 text-ink-primary font-medium">
                {getDisplayName(item)}
                {getDisplayCode(item) && <span className="ml-1.5 text-[11px] text-ink-muted">{getDisplayCode(item)}</span>}
              </td>
              <td className="px-3 py-1.5 text-right text-ink-muted text-xs">{item.unit ?? ''}</td>
              <td className="px-3 py-1.5 text-right text-accent-receipt font-medium tabular-nums">{formatNumber(getIn(item))}</td>
              <td className="px-3 py-1.5 text-right text-accent-usage font-medium tabular-nums">{formatNumber(getOut(item))}</td>
            </tr>
          ))}
          {showSubtotal && (
            <tr className="bg-surface-secondary/60 border-t border-surface-secondary">
              <td className="px-3 py-1.5 text-ink-secondary font-semibold text-xs" colSpan={2}>소계</td>
              <td className="px-3 py-1.5 text-right text-accent-receipt font-semibold tabular-nums text-xs">{formatNumber(totalIn)}</td>
              <td className="px-3 py-1.5 text-right text-accent-usage font-semibold tabular-nums text-xs">{formatNumber(totalOut)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export default function MonthlyReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.getMonthlySummary(year, month) as unknown as MonthlySummary;
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function goToPrev() {
    const p = prevMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  }

  function goToNext() {
    const n = nextMonth(year, month);
    setYear(n.year);
    setMonth(n.month);
  }

  const groupItemCounts = GROUPS.map((group) => {
    const count = group.sections.reduce((sum, key) => {
      return sum + ((data?.[key] as SummaryRow[])?.length ?? 0);
    }, 0);
    return { ...group, count };
  });

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="현황월보" subtitle="월별 재고 집계표" />
      <div className="p-4 space-y-3">
        {/* 월 내비게이션 */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="px-3 py-1.5 rounded border border-surface-secondary bg-surface-card text-sm text-ink-primary hover:bg-surface-secondary transition-colors"
          >
            ← 이전달
          </button>
          <span className="flex-1 text-center font-semibold text-ink-primary text-sm">
            {year}년 {month}월
          </span>
          <button
            onClick={goToNext}
            disabled={isFuture}
            className={cn(
              'px-3 py-1.5 rounded border border-surface-secondary text-sm transition-colors',
              isFuture
                ? 'bg-surface-secondary/40 text-ink-muted cursor-not-allowed'
                : 'bg-surface-card text-ink-primary hover:bg-surface-secondary'
            )}
          >
            다음달 →
          </button>
          {loading && <span className="text-xs text-brand-koji animate-pulse ml-1">불러오는 중...</span>}
        </div>

        {data && (
          <>
            {/* 집계 기간 */}
            <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 text-xs text-ink-secondary">
              <strong className="text-ink-primary">{year}년 {month}월 집계</strong> ({data.from} ~ {data.to})
            </div>

            {/* 그룹 요약 카드 */}
            <div className="grid grid-cols-3 gap-2">
              {groupItemCounts.map((group) => (
                <div key={group.name} className="rounded border border-surface-secondary bg-surface-card px-3 py-2">
                  <div className={cn('w-1 h-full rounded-full inline-block mr-2 align-middle', group.barColor)} style={{ width: 3, height: 14 }} />
                  <span className="text-xs font-semibold text-ink-primary align-middle">{group.name}</span>
                  <div className="mt-1 text-xs text-ink-muted">{group.count}개 품목</div>
                </div>
              ))}
            </div>
          </>
        )}

        {data ? (
          <div className="space-y-6">
            {GROUPS.map((group) => (
              <div key={group.name}>
                {/* 그룹 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-1 rounded-full', group.barColor)} style={{ height: 16 }} />
                  <span className="text-xs font-bold text-ink-secondary tracking-wide uppercase">{group.name}</span>
                </div>
                {/* 그룹 내 섹션들 */}
                <div className="space-y-2">
                  {group.sections.map((key) => {
                    const meta = SECTION_META[key];
                    return (
                      <SectionTable
                        key={key}
                        label={meta.label}
                        headerColor={meta.headerColor}
                        items={(data[key] as SummaryRow[]) ?? []}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <div className="text-center py-12 space-y-2">
              <p className="text-ink-muted text-sm">해당 월의 데이터가 없습니다.</p>
              <p className="text-xs text-ink-muted">
                원료 수불 장부에서 먼저 데이터를 입력해 주세요.{' '}
                <Link href="/ledger/raw-material" className="text-brand-koji underline hover:text-brand-koji/80">
                  원료 장부 바로가기
                </Link>
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
