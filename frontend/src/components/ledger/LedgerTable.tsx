'use client';

import { useState, useMemo, useCallback } from 'react';
import type { LedgerEntry, LedgerEntryInput, Material } from '@/lib/types';
import { formatDate, formatNumber, toNum } from '@/lib/utils';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';

export interface InlineRowState {
  form: LedgerEntryInput;
  onChange: (field: keyof LedgerEntryInput, value: string | number | undefined) => void;
  onSubmit: () => void;
  onReset: () => void;
  submitting: boolean;
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onRequestApproval?: (entry: LedgerEntry) => void;
  onBulkDelete?: (ids: number[]) => void;
  onBulkApproval?: (ids: number[]) => void;
  canWrite?: boolean;
  materials?: Material[];
  inlineRow?: InlineRowState;
  approvalMap?: Record<number, ApprovalStatus>;
}

type SortKey = 'ledger_date' | 'material_name' | 'carry_over' | 'received' | 'used' | 'balance';

interface SortState {
  key: SortKey;
  dir: SortDirection;
}

function nextDir(current: SortDirection): SortDirection {
  if (current === 'none') return 'asc';
  if (current === 'asc') return 'desc';
  return 'none';
}

export default function LedgerTable({
  entries,
  onEdit,
  onDelete,
  onRequestApproval,
  onBulkDelete,
  onBulkApproval,
  canWrite = true,
  materials = [],
  inlineRow,
  approvalMap = {},
}: LedgerTableProps) {
  const [sort, setSort] = useState<SortState>({ key: 'ledger_date', dir: 'none' });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === entries.length && entries.length > 0) return new Set();
      return new Set(entries.map((e) => e.id));
    });
  }, [entries]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const showInline = canWrite && !!inlineRow;
  const showApproval = Object.keys(approvalMap).length > 0 || !!onRequestApproval;

  const sortedEntries = useMemo(() => {
    if (sort.dir === 'none') return entries;
    return [...entries].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sort.key) {
        case 'ledger_date':
          aVal = a.ledger_date;
          bVal = b.ledger_date;
          break;
        case 'material_name':
          aVal = a.material_name ?? a.product_name ?? '';
          bVal = b.material_name ?? b.product_name ?? '';
          break;
        case 'carry_over':
          aVal = toNum(a.carry_over);
          bVal = toNum(b.carry_over);
          break;
        case 'received':
          aVal = toNum(a.received ?? a.produced);
          bVal = toNum(b.received ?? b.produced);
          break;
        case 'used':
          aVal = toNum(a.used ?? a.shipped);
          bVal = toNum(b.used ?? b.shipped);
          break;
        case 'balance':
          aVal = toNum(a.balance);
          bVal = toNum(b.balance);
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entries, sort]);

  const handleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key ? nextDir(prev.dir) : 'asc',
    }));
  };

  const sortDir = (key: SortKey): SortDirection =>
    sort.key === key ? sort.dir : 'none';

  if (entries.length === 0 && !showInline) {
    return (
      <div className="text-center py-10">
        <p className="text-ink-muted text-sm">등록된 항목이 없습니다.</p>
        <p className="text-ink-muted/60 text-xs mt-1">위의 &ldquo;신규 등록&rdquo; 버튼으로 오늘의 첫 기록을 추가하세요.</p>
      </div>
    );
  }

  const inlineBalance = inlineRow
    ? toNum(inlineRow.form.carry_over) + toNum(inlineRow.form.received) - toNum(inlineRow.form.used)
    : 0;

  const handleKeyDown = (e: React.KeyboardEvent, isLastField = false) => {
    if (!inlineRow) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      inlineRow.onReset();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      inlineRow.onSubmit();
    } else if (e.key === 'Tab' && isLastField && !e.shiftKey) {
      e.preventDefault();
      inlineRow.onSubmit();
    }
  };

  const inputClass =
    'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary placeholder:text-ink-muted/40 text-[13px]';
  const numInputClass = `${inputClass} text-right tabular-nums`;

  const SortTh = ({
    sortKey,
    children,
    className = '',
  }: {
    sortKey: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`text-left px-3 py-2 text-ink-secondary font-medium text-xs border-r border-surface-secondary cursor-pointer select-none group ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {children}
        <SortIcon direction={sortDir(sortKey)} />
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto relative">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-brand-koji/10 border border-brand-koji/20 px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
          <span className="text-ink-primary font-semibold">&#10003; {selectedIds.size}건 선택</span>
          {onBulkApproval && (
            <button
              onClick={() => onBulkApproval(Array.from(selectedIds))}
              className="px-3 py-1 bg-brand-koji text-ink-inverse rounded hover:bg-brand-koji-light transition-colors font-medium"
            >
              일괄 승인 요청
            </button>
          )}
          {onBulkDelete && (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="px-3 py-1 bg-brand-clay text-ink-inverse rounded hover:bg-brand-clay-light transition-colors font-medium"
            >
              일괄 삭제
            </button>
          )}
          <button
            onClick={clearSelection}
            className="px-3 py-1 text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 text-center border border-surface-secondary">
            <p className="text-ink-primary mb-1 font-bold text-sm">{selectedIds.size}건을 삭제하시겠습니까?</p>
            <p className="text-xs text-ink-muted mb-4">선택된 항목이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setBulkDeleteConfirm(false);
                  onBulkDelete?.(Array.from(selectedIds));
                  clearSelection();
                }}
                className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b-2 border-brand-wood/10 bg-surface-secondary/50">
            {canWrite && (
              <th className="px-2 py-2 w-10 border-r border-surface-secondary">
                <input
                  type="checkbox"
                  checked={entries.length > 0 && selectedIds.size === entries.length}
                  onChange={toggleSelectAll}
                  className="accent-[var(--color-brand-koji,#8B6914)] cursor-pointer"
                />
              </th>
            )}
            <SortTh sortKey="ledger_date">날짜</SortTh>
            <SortTh sortKey="material_name">품목</SortTh>
            <th className="text-left px-3 py-2 text-ink-muted font-medium text-xs border-r border-surface-secondary">코드</th>
            <th className="text-right px-3 py-2 text-ink-muted font-medium text-xs border-r border-surface-secondary">단위</th>
            <SortTh sortKey="carry_over" className="text-right">이월</SortTh>
            <SortTh sortKey="received" className="text-right !text-accent-receipt font-semibold">입고</SortTh>
            <SortTh sortKey="used" className="text-right !text-accent-usage font-semibold">사용</SortTh>
            <SortTh sortKey="balance" className="text-right !text-ink-primary font-bold">잔량</SortTh>
            <th className="text-left px-3 py-2 text-ink-muted font-medium text-xs border-r border-surface-secondary">비고</th>
            {showApproval && (
              <th className="text-left px-3 py-2 text-ink-muted font-medium text-xs border-r border-surface-secondary">승인</th>
            )}
            {canWrite && <th className="px-3 py-2 w-16" />}
          </tr>
        </thead>
        <tbody>
          {showInline && (
            <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
              {/* 체크박스 (빈 셀) */}
              <td className="px-2 py-1.5 border-r border-surface-secondary" />
              {/* 날짜 */}
              <td className="px-2 py-1.5 border-r border-surface-secondary">
                <input
                  type="date"
                  value={inlineRow.form.ledger_date}
                  onChange={(e) => inlineRow.onChange('ledger_date', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e)}
                  className={`${inputClass} tabular-nums text-[12px]`}
                />
              </td>
              {/* 품목 + 코드 + 단위 merged */}
              <td className="px-2 py-1.5 border-r border-surface-secondary" colSpan={3}>
                <select
                  value={inlineRow.form.material_id ?? ''}
                  onChange={(e) =>
                    inlineRow.onChange('material_id', e.target.value ? Number(e.target.value) : undefined)
                  }
                  onKeyDown={(e) => handleKeyDown(e)}
                  className={`${inputClass} text-[12px]`}
                >
                  <option value="">— 품목 선택 —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </td>
              {/* 이월 */}
              <td className="px-2 py-1.5 border-r border-surface-secondary">
                <input
                  type="number"
                  value={inlineRow.form.carry_over === 0 ? '' : inlineRow.form.carry_over}
                  onChange={(e) =>
                    inlineRow.onChange('carry_over', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  onKeyDown={(e) => handleKeyDown(e)}
                  placeholder="0"
                  className={numInputClass}
                />
              </td>
              {/* 입고 */}
              <td className="px-2 py-1.5 border-r border-surface-secondary">
                <input
                  type="number"
                  value={inlineRow.form.received === 0 ? '' : inlineRow.form.received}
                  onChange={(e) =>
                    inlineRow.onChange('received', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  onKeyDown={(e) => handleKeyDown(e)}
                  placeholder="0"
                  className={`${numInputClass} text-accent-receipt`}
                />
              </td>
              {/* 사용 */}
              <td className="px-2 py-1.5 border-r border-surface-secondary">
                <input
                  type="number"
                  value={inlineRow.form.used === 0 ? '' : inlineRow.form.used}
                  onChange={(e) =>
                    inlineRow.onChange('used', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  onKeyDown={(e) => handleKeyDown(e)}
                  placeholder="0"
                  className={`${numInputClass} text-accent-usage`}
                />
              </td>
              {/* 잔량 (auto-calculated, read-only) */}
              <td className="px-2 py-1.5 text-right font-bold tabular-nums border-r border-surface-secondary">
                {inlineBalance !== 0 ? (
                  <span className="text-ink-primary">{formatNumber(inlineBalance)}</span>
                ) : (
                  <span className="text-ink-muted/40">—</span>
                )}
              </td>
              {/* 비고 */}
              <td className="px-2 py-1.5 border-r border-surface-secondary" colSpan={showApproval ? 2 : 1}>
                <input
                  type="text"
                  value={inlineRow.form.notes ?? ''}
                  onChange={(e) => inlineRow.onChange('notes', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  placeholder="비고"
                  className={`${inputClass} text-[11px]`}
                />
              </td>
              {/* 저장/취소 */}
              <td className="px-2 py-1.5">
                <div className="flex gap-1 justify-end items-center">
                  <button
                    onClick={inlineRow.onSubmit}
                    disabled={inlineRow.submitting || !inlineRow.form.material_id}
                    className="text-[11px] px-2 py-0.5 bg-brand-wood text-ink-inverse rounded hover:bg-brand-wood-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {inlineRow.submitting ? '저장 중' : '저장'}
                  </button>
                  <button
                    onClick={inlineRow.onReset}
                    className="text-[11px] text-ink-muted hover:text-ink-secondary transition-colors"
                  >
                    취소
                  </button>
                </div>
              </td>
            </tr>
          )}

          {sortedEntries.map((entry, idx) => {
            const approvalStatus = approvalMap[entry.id];
            const isSelected = selectedIds.has(entry.id);
            return (
              <tr
                key={entry.id}
                className={`border-b border-surface-secondary/50 hover:bg-brand-koji/5 transition-colors ${
                  isSelected ? 'bg-brand-koji/5' : idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/50'
                }`}
              >
                {canWrite && (
                  <td className="px-2 py-2 border-r border-surface-secondary text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(entry.id)}
                      className="accent-[var(--color-brand-koji,#8B6914)] cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-ink-secondary whitespace-nowrap tabular-nums border-r border-surface-secondary">
                  {formatDate(entry.ledger_date)}
                </td>
                <td className="px-3 py-2 font-medium text-ink-primary border-r border-surface-secondary">
                  {entry.material_name ?? entry.product_name ?? entry.batch_code ?? `#${entry.material_id}`}
                </td>
                <td className="px-3 py-2 text-ink-muted text-[11px] border-r border-surface-secondary">{entry.material_code ?? entry.product_code ?? ''}</td>
                <td className="px-3 py-2 text-right text-ink-muted text-xs border-r border-surface-secondary">{entry.unit ?? ''}</td>
                <td className="px-3 py-2 text-right text-ink-secondary tabular-nums border-r border-surface-secondary">{formatNumber(entry.carry_over)}</td>
                <td className="px-3 py-2 text-right text-accent-receipt font-medium tabular-nums border-r border-surface-secondary">{formatNumber(entry.received ?? entry.produced)}</td>
                <td className="px-3 py-2 text-right text-accent-usage font-medium tabular-nums border-r border-surface-secondary">{formatNumber(entry.used ?? entry.shipped)}</td>
                <td className="px-3 py-2 text-right font-bold text-ink-primary tabular-nums border-r border-surface-secondary">
                  {formatNumber(entry.balance)}
                </td>
                <td className="px-3 py-2 text-ink-muted text-[11px] max-w-[100px] truncate border-r border-surface-secondary">
                  {entry.notes ?? ''}
                </td>
                {showApproval && (
                  <td className="px-3 py-2 border-r border-surface-secondary">
                    {approvalStatus ? (
                      <ApprovalBadge status={approvalStatus} />
                    ) : canWrite && onRequestApproval ? (
                      <button
                        onClick={() => onRequestApproval(entry)}
                        className="text-[11px] text-brand-koji hover:text-brand-koji-light transition-colors"
                      >
                        승인 요청
                      </button>
                    ) : null}
                  </td>
                )}
                {canWrite && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => onEdit(entry)}
                        className="text-[11px] text-brand-koji-muted hover:text-brand-koji transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onDelete(entry)}
                        className="text-[11px] text-ink-muted hover:text-brand-clay transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
