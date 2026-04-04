'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import PrintHeader from '@/components/ui/PrintHeader';
import { dashboardApi } from '@/lib/api';
import type { DailyReport, DailyReportRow } from '@/lib/types';
import { formatNumber, toNum, getTodayString, cn } from '@/lib/utils';

// ── Calendar helpers ──────────────────────────────────────────────────────────

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

function MonthCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (d: string) => void;
}) {
  const today = getTodayString();
  const [year, month] = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month - 1);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const cells = buildCalendarDays(viewYear, viewMonth);

  return (
    <div className="bg-surface-card rounded-lg border border-surface-secondary overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-secondary">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-secondary rounded transition-colors text-xs"
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="text-xs font-bold text-ink-primary">
          {viewYear}년 {MONTHS[viewMonth]}
        </span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-surface-secondary rounded transition-colors text-xs"
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-surface-secondary/50">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'text-center text-[10px] font-bold py-1',
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-ink-muted'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {cells.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const dow = (cells.indexOf(dateStr) + 0) % 7;
          const col = idx % 7;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={cn(
                'aspect-square flex items-center justify-center text-[11px] transition-colors rounded-sm m-0.5',
                isSelected
                  ? 'bg-brand-wood text-brand-koji font-bold'
                  : isToday
                  ? 'bg-brand-koji/15 text-brand-wood font-semibold'
                  : 'hover:bg-surface-secondary/60 text-ink-primary',
                col === 0 && !isSelected ? 'text-red-500' : '',
                col === 6 && !isSelected ? 'text-blue-500' : '',
              )}
            >
              {Number(dateStr.split('-')[2])}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Report section display helpers ───────────────────────────────────────────

function ReportSectionHeader({ no, title }: { no: number; title: string }) {
  return (
    <div className="px-3 py-1.5 bg-brand-wood text-ink-inverse text-xs font-bold tracking-wide print:bg-gray-800">
      {no}. {title}
    </div>
  );
}

function ReportTable({ headers, rows, emptyMsg }: {
  headers: string[];
  rows: (string | number)[][];
  emptyMsg?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-surface-secondary/60 border-b border-surface-secondary">
            {headers.map((h) => (
              <th key={h} className="px-2.5 py-1.5 text-center font-medium text-ink-secondary text-[11px] border-r border-surface-secondary/50 last:border-r-0 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-center text-ink-muted text-xs">
                {emptyMsg || '데이터 없음'}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} className={cn('border-b border-surface-secondary/40 last:border-b-0', ri % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/40')}>
                {row.map((cell, ci) => (
                  <td key={ci} className={cn(
                    'px-2.5 py-1.5 border-r border-surface-secondary/30 last:border-r-0',
                    ci === 0 ? 'text-left text-ink-primary font-medium' : 'text-right tabular-nums text-ink-secondary',
                    ci === row.length - 1 && 'font-bold text-ink-primary',
                  )}>
                    {typeof cell === 'number' ? (cell === 0 ? '—' : formatNumber(cell)) : cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Data extraction from DailyReport ─────────────────────────────────────────

function getLiquorRows(report: DailyReport): (string | number)[][] {
  return report.liquor.map((r: DailyReportRow) => [
    r.product_name ?? r.product_code ?? '—',
    r.unit ?? 'ℓ',
    r.carry_over,
    toNum(r.received),
    r.carry_over + toNum(r.received),
    toNum(r.shipped),
    r.balance,
  ]);
}

function getFermentationRows(report: DailyReport): (string | number)[][] {
  const combined = [
    ...report.mash.map((r: DailyReportRow) => ({ ...r, _type: '술덧' })),
    ...report.first_mash.map((r: DailyReportRow) => ({ ...r, _type: '1차술덧' })),
    ...report.starter.map((r: DailyReportRow) => ({ ...r, _type: '밑술' })),
  ];
  return combined.map((r) => [
    r._type,
    r.batch_code ?? '—',
    toNum(r.produced),
    toNum(r.used),
    r.balance,
  ]);
}

function getRawMaterialRows(report: DailyReport): (string | number)[][] {
  return report.raw_materials.map((r: DailyReportRow) => [
    r.name ?? '—',
    r.unit ?? '',
    r.carry_over,
    toNum(r.received),
    toNum(r.used),
    r.balance,
  ]);
}

function getContainerRows(report: DailyReport): (string | number)[][] {
  return report.containers.map((r: DailyReportRow) => [
    r.container_type ?? r.name ?? '—',
    r.carry_over,
    toNum(r.received),
    toNum(r.used),
    r.balance,
  ]);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { showToast } = useToast();
  const [date, setDate] = useState(getTodayString());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const loadReport = useCallback(async (d: string) => {
    setLoading(true);
    try {
      setReport(await dashboardApi.getDailyReport(d));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다', 'error');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReport(date); }, [date, loadReport]);

  const [y, m, d] = date.split('-').map(Number);
  const dow = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const dateLabel = `${y}년 ${m}월 ${d}일 (${dow})`;

  const liquorRows = report ? getLiquorRows(report) : [];
  const fermentRows = report ? getFermentationRows(report) : [];
  const rawRows = report ? getRawMaterialRows(report) : [];
  const containerRows = report ? getContainerRows(report) : [];

  return (
    <div className="min-h-screen bg-surface-primary">
      <PrintHeader title="주류 및 자재 현황일보" period={dateLabel} />
      {/* Top bar — hidden on print */}
      <div className="px-4 py-3 border-b border-surface-secondary bg-surface-card flex items-center gap-3 print:hidden">
        <div>
          <h1 className="text-sm font-bold text-ink-primary">현황일보</h1>
          <p className="text-[11px] text-ink-muted">주류 및 자재 일일 현황</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {loading && <span className="text-[11px] text-brand-koji animate-pulse">불러오는 중…</span>}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-medium border border-surface-secondary rounded text-ink-secondary hover:bg-surface-secondary/50 transition-colors"
          >
            🖨 인쇄
          </button>
        </div>
      </div>

      <div className="flex gap-0 print:block">

        {/* ── Left: Calendar (no-print) ── */}
        <div className="w-[190px] shrink-0 p-3 print:hidden">
          <MonthCalendar selectedDate={date} onSelect={setDate} />
        </div>

        {/* ── Right: Report ── */}
        <div className="flex-1 p-3 print:p-0 min-w-0" ref={printRef}>
          {/* Report paper */}
          <div className="bg-surface-card rounded-lg border border-surface-secondary overflow-hidden print:rounded-none print:border-none print:shadow-none">

            {/* Report header */}
            <div className="px-4 pt-4 pb-3 border-b border-surface-secondary text-center print:pt-2">
              <div className="text-[11px] text-ink-muted mb-0.5">서울탁주 강동연합제조장</div>
              <div className="text-base font-bold text-brand-wood tracking-tight">주류 및 자재 현황일보</div>
              <div className="text-xs text-ink-secondary mt-0.5">{dateLabel} 현재</div>
            </div>

            {report ? (
              <div>
                {/* 1. 주류사입현황 */}
                <div className="border-b border-surface-secondary">
                  <ReportSectionHeader no={1} title="주류사입현황" />
                  <ReportTable
                    headers={['품목', '단위', '이월수량', '당일사입', '합계', '제성/출고', '잔량']}
                    rows={liquorRows}
                    emptyMsg="주류 데이터 없음"
                  />
                </div>

                {/* 2. 주류제성 및 출고현황 */}
                <div className="border-b border-surface-secondary">
                  <ReportSectionHeader no={2} title="주류제성 및 출고현황" />
                  <ReportTable
                    headers={['품목', '단위', '전일재고', '당일제성', '합계', '당일출고', '잔량']}
                    rows={liquorRows}
                    emptyMsg="주류 데이터 없음"
                  />
                </div>

                {/* 3. 주류담금현황 */}
                <div className="border-b border-surface-secondary">
                  <ReportSectionHeader no={3} title="주류담금현황 (당일)" />
                  <ReportTable
                    headers={['구분', '담금번호', '담금량(L)', '걸른량(L)', '잔량']}
                    rows={fermentRows}
                    emptyMsg="당일 담금 데이터 없음 — 좌측 메뉴에서 술덧/밑술 데이터를 입력하세요"
                  />
                </div>

                {/* 4. 원료 및 원료수불상황 */}
                <div className="border-b border-surface-secondary">
                  <ReportSectionHeader no={4} title="원료 및 원료수불상황" />
                  <ReportTable
                    headers={['원료명', '단위', '전일재고', '당일이입', '합계사용', '잔량']}
                    rows={rawRows}
                    emptyMsg="원료 데이터 없음"
                  />
                </div>

                {/* 5. 용기·마개 현황 */}
                <div>
                  <ReportSectionHeader no={5} title="용기·마개 현황" />
                  <ReportTable
                    headers={['구분', '전일재고', '당일입고', '당일출고', '잔량']}
                    rows={containerRows}
                    emptyMsg="용기·마개 데이터 없음"
                  />
                </div>
              </div>
            ) : (
              !loading && (
                <div className="px-4 py-12 text-center text-ink-muted text-sm">
                  데이터가 없습니다. 수불 장부에서 기록을 등록하세요.
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { font-size: 11px; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
