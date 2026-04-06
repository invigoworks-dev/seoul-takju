'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/layout/Header';
import PrintHeader from '@/components/ui/PrintHeader';
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
  carry_over?: number;
  total_received?: number;
  total_used?: number;
  total_produced?: number;
  total_shipped?: number;
  balance?: number;
  // mash detail fields
  ledger_date?: string;
  rtype?: string;
  rice?: number;
  water?: number;
  yeast?: number;
  fvol?: number;
  filt?: number;
  bno?: string;
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

const n = (v: number | undefined | null) => v ? formatNumber(toNum(v)) : '-';
const nz = (v: number | undefined | null) => formatNumber(toNum(v));

function SectionHeader({ no, title }: { no: number; title: string }) {
  return (
    <div className="px-3 py-1.5 bg-[#1a3a5c] text-white text-xs font-bold tracking-wide">
      {no}. {title}
    </div>
  );
}

function Th({ children, colSpan, rowSpan, className }: { children: React.ReactNode; colSpan?: number; rowSpan?: number; className?: string }) {
  return (
    <th className={cn('px-2.5 py-1.5 text-center text-[11px] font-semibold text-[#444] border border-[#ccd] bg-[#eef1f7]', className)} colSpan={colSpan} rowSpan={rowSpan}>
      {children}
    </th>
  );
}

function Td({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={cn('px-2.5 py-1.5 text-[12px] border border-[#dde] text-right tabular-nums text-[#333]', className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

export default function MonthlyReportPage() {
  const { showToast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const monthStr = `${year}년 ${month}월`;
  const fromStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const periodStr = `${year}년 ${month}월 (${fromStr} ~ ${toStr})`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.getMonthlySummary(year, month) as unknown as MonthlySummary;
      setData(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Combine raw_materials + fermentation_agents for Section 1 & 4
  const allMaterials = [...(data?.raw_materials ?? []), ...(data?.fermentation_agents ?? [])];
  // Add 용수(물) row
  const materialsWithWater = [...allMaterials, { name: '용수 (물)', unit: 'L', carry_over: 0, total_received: undefined, total_used: undefined, balance: undefined } as SummaryRow];

  // Liquor summary for Section 2
  const liquorRows = data?.liquor ?? [];
  const liquorCarryOver = liquorRows.reduce((s, r) => s + toNum(r.carry_over), 0);
  const liquorProduced = liquorRows.reduce((s, r) => s + toNum(r.total_received ?? r.total_produced), 0);
  const liquorTotal = liquorCarryOver + liquorProduced;
  const liquorShipped = liquorRows.reduce((s, r) => s + toNum(r.total_shipped ?? r.total_used), 0);
  const liquorBalance = liquorTotal - liquorShipped;

  // Mash detail for Section 3
  const mashRows = data?.mash ?? [];

  // Container for Section 5
  const containerRows = data?.containers ?? [];

  return (
    <div className="min-h-screen bg-surface-primary">
      <PrintHeader title="주류 및 자재 현황월보" period={periodStr} />
      <Header title="현황월보" subtitle="월별 재고 집계표" />

      <div className="p-4 space-y-4 max-w-[1100px]">
        {/* Month picker */}
        <div className="flex items-center gap-3 no-print">
          <span className="text-sm font-semibold text-ink-secondary">기준월</span>
          <input
            type="month"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              if (y && m) { setYear(y); setMonth(m); }
            }}
            className="border border-surface-secondary rounded px-3 py-1.5 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20"
          />
          {loading && <span className="text-xs text-brand-koji animate-pulse">불러오는 중...</span>}
        </div>

        {/* Report body */}
        <div className="bg-white rounded-lg border border-[#ccd] p-6 space-y-6 print:border-0 print:p-0 print:rounded-none">
          {/* Title */}
          <div className="text-center space-y-1 print:mb-6">
            <p className="text-sm text-[#666]">서울 탁주</p>
            <h1 className="text-xl font-bold text-[#1a1a2e]">주류 및 자재 현황월보</h1>
            <p className="text-xs text-[#888]">{periodStr}</p>
          </div>

          {/* Section 1: 주류사입현황 (원료 이입) */}
          <div className="rounded overflow-hidden border border-[#ccd]">
            <SectionHeader no={1} title="주류사입현황 (원료 이입)" />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th rowSpan={2}>품목</Th>
                  <Th rowSpan={2}>단위</Th>
                  <Th rowSpan={2}>전월이월</Th>
                  <Th rowSpan={2}>당월이입</Th>
                  <Th colSpan={2}>당월 사용수량</Th>
                  <Th rowSpan={2}>합계사용</Th>
                  <Th rowSpan={2}>월말잔량</Th>
                </tr>
                <tr>
                  <Th>밑술담금</Th>
                  <Th>술덧담금</Th>
                </tr>
              </thead>
              <tbody>
                {materialsWithWater.map((row, i) => (
                  <tr key={row.name || i}>
                    <Td className="text-left font-medium">{row.name}</Td>
                    <Td className="text-center">{row.unit}</Td>
                    <Td>{nz(row.carry_over)}</Td>
                    <Td>{n(row.total_received)}</Td>
                    <Td>-</Td>
                    <Td>-</Td>
                    <Td>-</Td>
                    <Td className="font-bold">{nz(row.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: 주류제성 및 출고현황 */}
          <div className="rounded overflow-hidden border border-[#ccd]">
            <SectionHeader no={2} title="주류제성 및 출고현황" />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>전월이월 (ℓ)</Th>
                  <Th>당월제성 (ℓ)</Th>
                  <Th>합계 (ℓ)</Th>
                  <Th>당월출고 (ℓ)</Th>
                  <Th>월말잔량 (ℓ)</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>{nz(liquorCarryOver)}</Td>
                  <Td>{nz(liquorProduced)}</Td>
                  <Td className="font-bold">{nz(liquorTotal)}</Td>
                  <Td>{nz(liquorShipped)}</Td>
                  <Td className="font-bold">{nz(liquorBalance)}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: 주류담금현황 */}
          <div className="rounded overflow-hidden border border-[#ccd]">
            <SectionHeader no={3} title={`주류담금현황 (${month}월)`} />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>일</Th>
                  <Th>구분</Th>
                  <Th>담금번호</Th>
                  <Th>원료종류</Th>
                  <Th>원료량(kg)</Th>
                  <Th>물(L)</Th>
                  <Th>효모(g)</Th>
                  <Th>담금량(L)</Th>
                  <Th>걸른량(L)</Th>
                </tr>
              </thead>
              <tbody>
                {mashRows.length === 0 ? (
                  <tr>
                    <Td colSpan={9} className="text-center text-[#999] py-4">
                      당월 담금 데이터 없음<br />
                      <span className="text-[11px]">주류제조부에서 담금 데이터를 입력하세요</span>
                    </Td>
                  </tr>
                ) : (
                  mashRows.map((row, i) => (
                    <tr key={i}>
                      <Td className="text-center">{row.ledger_date?.split('-')[2] ?? '-'}</Td>
                      <Td className="text-center">담금</Td>
                      <Td className="text-center">{row.bno ?? row.batch_code ?? '-'}</Td>
                      <Td className="text-center">{row.rtype ?? '-'}</Td>
                      <Td>{n(row.rice)}</Td>
                      <Td>{n(row.water)}</Td>
                      <Td>{n(row.yeast)}</Td>
                      <Td>{n(row.fvol)}</Td>
                      <Td>{n(row.filt)}</Td>
                    </tr>
                  ))
                )}
                <tr className="bg-[#f5f5f5] font-bold">
                  <Td colSpan={4} className="text-left font-bold">합계</Td>
                  <Td>{nz(mashRows.reduce((s, r) => s + toNum(r.rice), 0))}</Td>
                  <Td>{nz(mashRows.reduce((s, r) => s + toNum(r.water), 0))}</Td>
                  <Td>{nz(mashRows.reduce((s, r) => s + toNum(r.yeast), 0))}</Td>
                  <Td>{nz(mashRows.reduce((s, r) => s + toNum(r.fvol), 0))}</Td>
                  <Td>{nz(mashRows.reduce((s, r) => s + toNum(r.filt), 0))}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: 원료 및 원료수불상황 */}
          <div className="rounded overflow-hidden border border-[#ccd]">
            <SectionHeader no={4} title="원료 및 원료수불상황" />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>원료명</Th>
                  <Th>단위</Th>
                  <Th>전월재고량</Th>
                  <Th>당월이입</Th>
                  <Th>사용(밑술)</Th>
                  <Th>사용(술덧)</Th>
                  <Th>합계사용</Th>
                  <Th>월말잔량</Th>
                </tr>
              </thead>
              <tbody>
                {allMaterials.map((row, i) => (
                  <tr key={row.name || i}>
                    <Td className="text-left font-medium">{row.name}</Td>
                    <Td className="text-center">{row.unit}</Td>
                    <Td>{nz(row.carry_over)}</Td>
                    <Td>{n(row.total_received)}</Td>
                    <Td>-</Td>
                    <Td>-</Td>
                    <Td>-</Td>
                    <Td className="font-bold">{nz(row.balance)}</Td>
                  </tr>
                ))}
                {/* 주류 재고 현황 row */}
                <tr className="bg-[#f5f5f5]">
                  <Td colSpan={2} className="text-left font-bold">주류 재고 현황</Td>
                  <Td className="font-bold italic">{nz(liquorCarryOver)} ℓ</Td>
                  <Td>{n(liquorProduced)}</Td>
                  <Td colSpan={2}>-</Td>
                  <Td>-</Td>
                  <Td className="font-bold italic">{nz(liquorBalance)} ℓ</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 5: 용기·마개 현황 */}
          <div className="rounded overflow-hidden border border-[#ccd]">
            <SectionHeader no={5} title="용기·마개 현황" />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>구분</Th>
                  <Th>전월재고</Th>
                  <Th>당월입고</Th>
                  <Th>당월출고</Th>
                  <Th>파손폐기</Th>
                  <Th>월말잔량</Th>
                </tr>
              </thead>
              <tbody>
                {containerRows.length === 0 ? (
                  <>
                    <tr>
                      <Td className="text-left font-medium">용기</Td>
                      <Td>{nz(0)}</Td>
                      <Td>-</Td>
                      <Td>-</Td>
                      <Td>-</Td>
                      <Td className="font-bold">{nz(0)}</Td>
                    </tr>
                    <tr>
                      <Td className="text-left font-medium">마개</Td>
                      <Td>{nz(0)}</Td>
                      <Td>-</Td>
                      <Td>-</Td>
                      <Td>-</Td>
                      <Td className="font-bold">{nz(0)}</Td>
                    </tr>
                  </>
                ) : (
                  containerRows.map((row, i) => (
                    <tr key={i}>
                      <Td className="text-left font-medium">{row.container_type ?? row.name}</Td>
                      <Td>{nz(row.carry_over)}</Td>
                      <Td>{n(row.total_received)}</Td>
                      <Td>{n(row.total_used ?? row.total_shipped)}</Td>
                      <Td>-</Td>
                      <Td className="font-bold">{nz(row.balance)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
