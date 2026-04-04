'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/layout/Header';
import PrintHeader from '@/components/ui/PrintHeader';
import { containerApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import type { ContainerEntry } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const iCls = 'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary placeholder:text-ink-muted/40 text-[12px]';
const nCls = iCls + ' text-right tabular-nums';

export default function ContainerPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<ContainerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ContainerEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContainerEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'container', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch (err) {
      console.warn('Failed to load approvals:', err);
    }
  }, []);

  const handleRequestApproval = async (entry: ContainerEntry) => {
    try { await approvalsApi.request('container', entry.id); setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' })); } catch (err) {
      showToast(err instanceof Error ? err.message : '승인 요청에 실패했습니다', 'error');
    }
  };

  const sortedEntries = useMemo(() => sortDir === 'none' ? entries : [...entries].sort((a, b) => sortDir === 'asc' ? a.ledger_date.localeCompare(b.ledger_date) : b.ledger_date.localeCompare(a.ledger_date)), [entries, sortDir]);
  const cycleSortDir = () => setSortDir((d) => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');

  const emptyInline = () => ({ container_type: '용기', ledger_date: getTodayString(), carry_over: 0, received: 0, used: 0, notes: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const handleInlineKeyDown = (e: React.KeyboardEvent, isLast = false) => {
    if (e.key === 'Escape') { e.preventDefault(); setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast && !e.shiftKey)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    setInlineSubmitting(true);
    try {
      await containerApi.create({ ...inlineForm });
      await loadData();
      setInlineForm(emptyInline());
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    } finally { setInlineSubmitting(false); }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { from?: string; to?: string; container_type?: string } = {};
      if (filterDate) { params.from = filterDate; params.to = filterDate; }
      if (filterType) { params.container_type = filterType; }
      const data = await containerApi.list(Object.keys(params).length ? params : undefined);
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다', 'error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterType, loadApprovals]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      container_type: fd.get('container_type') as string,
      ledger_date: fd.get('ledger_date') as string,
      carry_over: Number(fd.get('carry_over')) || 0,
      received: Number(fd.get('received')) || 0,
      used: Number(fd.get('used')) || 0,
      notes: fd.get('notes') as string || undefined,
    };
    try {
      if (editEntry) {
        await containerApi.update(editEntry.id, data);
      } else {
        await containerApi.create(data);
      }
      setShowForm(false);
      setEditEntry(null);
      loadData();
      showToast('저장되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    }
  };

  const handleDelete = async (entry: ContainerEntry) => {
    setDeleteConfirm(null);
    try {
      await containerApi.delete(entry.id);
      loadData();
      showToast('삭제되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <PrintHeader title="용기/마개 수불 원장" period={filterDate || undefined} />
      <Header title="용기/마개 수불" subtitle="용기 및 마개 수불 장부" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-secondary font-medium">날짜</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="border border-surface-secondary rounded px-2.5 py-1 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums" />
              {filterDate && (
                <button onClick={() => setFilterDate('')} className="text-[11px] text-ink-muted hover:text-ink-secondary transition-colors">초기화</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-secondary font-medium">구분</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="border border-surface-secondary rounded px-2.5 py-1 text-sm text-ink-primary bg-surface-card">
                <option value="">전체</option>
                <option value="용기">용기</option>
                <option value="마개">마개</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExcelToolbar ledgerType="container" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
            {canWrite && (
              <button onClick={() => { setEditEntry(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors">
                <span className="text-brand-koji">+</span><span>신규 등록</span>
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-lg p-5 border border-surface-secondary">
              <h3 className="text-sm font-bold text-ink-primary mb-3">
                {editEntry ? '용기/마개 수정' : '용기/마개 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">구분</label>
                    <select name="container_type" defaultValue={editEntry?.container_type ?? '용기'} required
                      className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm">
                      <option value="용기">용기</option>
                      <option value="마개">마개</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-ink-secondary mb-1">날짜</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required
                      className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">이월</label>
                    <input type="number" name="carry_over" step="1" defaultValue={editEntry?.carry_over ?? 0}
                      className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">입고</label>
                    <input type="number" name="received" step="1" defaultValue={editEntry?.received ?? 0}
                      className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">사용</label>
                    <input type="number" name="used" step="1" defaultValue={editEntry?.used ?? 0}
                      className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm tabular-nums" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">비고</label>
                  <input type="text" name="notes" defaultValue={editEntry?.notes ?? ''}
                    className="w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditEntry(null); }}
                    className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded">취소</button>
                  <button type="submit"
                    className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded">저장</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 text-center border border-surface-secondary">
              <p className="text-ink-primary mb-1 font-bold text-sm">정말 삭제하시겠습니까?</p>
              <p className="text-xs text-ink-muted mb-4">{deleteConfirm.container_type} — {deleteConfirm.ledger_date}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded">취소</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded">삭제</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface-card rounded border border-surface-secondary overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-ink-muted text-sm animate-pulse">불러오는 중...</div>
          ) : entries.length === 0 && !canWrite ? (
            <div className="text-center py-10 text-ink-muted text-sm">데이터가 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary/50 text-ink-secondary text-xs">
                  <th onClick={cycleSortDir} className="px-3 py-2 text-left font-medium border-r border-surface-secondary cursor-pointer select-none"><span className="inline-flex items-center gap-1">날짜<SortIcon direction={sortDir} /></span></th>
                  <th className="px-3 py-2 text-left font-medium border-r border-surface-secondary">구분</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-surface-secondary">이월</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-surface-secondary">입고</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-surface-secondary">사용</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-surface-secondary">잔량</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-surface-secondary">비고</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-surface-secondary whitespace-nowrap">승인</th>
                  <th className="px-3 py-2 text-center font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-secondary">
                {canWrite && (
                  <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <input type="date" value={inlineForm.ledger_date}
                        onChange={(e) => setInlineForm(p => ({ ...p, ledger_date: e.target.value }))}
                        onKeyDown={(e) => handleInlineKeyDown(e)}
                        className={iCls + ' tabular-nums text-[12px]'} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <select value={inlineForm.container_type}
                        onChange={(e) => setInlineForm(p => ({ ...p, container_type: e.target.value }))}
                        onKeyDown={(e) => handleInlineKeyDown(e)}
                        className={iCls + ' text-[12px]'}>
                        <option value="용기">용기</option>
                        <option value="마개">마개</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <input type="number" value={inlineForm.carry_over || ''}
                        onChange={(e) => setInlineForm(p => ({ ...p, carry_over: parseFloat(e.target.value) || 0 }))}
                        onKeyDown={(e) => handleInlineKeyDown(e)}
                        placeholder="0" className={nCls} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <input type="number" value={inlineForm.received || ''}
                        onChange={(e) => setInlineForm(p => ({ ...p, received: parseFloat(e.target.value) || 0 }))}
                        onKeyDown={(e) => handleInlineKeyDown(e)}
                        placeholder="0" className={nCls + ' text-accent-receipt'} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <input type="number" value={inlineForm.used || ''}
                        onChange={(e) => setInlineForm(p => ({ ...p, used: parseFloat(e.target.value) || 0 }))}
                        onKeyDown={(e) => handleInlineKeyDown(e)}
                        placeholder="0" className={nCls + ' text-accent-usage'} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary text-right tabular-nums font-bold text-[12px]">
                      {inlineForm.carry_over + inlineForm.received - inlineForm.used !== 0
                        ? <span className="text-ink-primary">{formatNumber(inlineForm.carry_over + inlineForm.received - inlineForm.used)}</span>
                        : <span className="text-ink-muted/40">—</span>}
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary">
                      <input type="text" value={inlineForm.notes}
                        onChange={(e) => setInlineForm(p => ({ ...p, notes: e.target.value }))}
                        onKeyDown={(e) => handleInlineKeyDown(e, true)}
                        placeholder="비고" className={iCls + ' text-[11px]'} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-surface-secondary"></td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1 justify-end items-center">
                        <button onClick={handleInlineSave} disabled={inlineSubmitting}
                          className="text-[11px] px-2 py-0.5 bg-brand-wood text-ink-inverse rounded hover:bg-brand-wood-light disabled:opacity-40">
                          {inlineSubmitting ? '저장중' : '저장'}
                        </button>
                        <button onClick={() => setInlineForm(emptyInline())} className="text-[11px] text-ink-muted hover:text-ink-secondary">취소</button>
                      </div>
                    </td>
                  </tr>
                )}
                {sortedEntries.map((e) => {
                  const balance = e.carry_over + e.received - e.used;
                  return (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary tabular-nums">{e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary">
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium',
                          e.container_type === '용기' ? 'bg-brand-koji/10 text-brand-koji' : 'bg-accent-usage/10 text-accent-usage')}>
                          {e.container_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{formatNumber(e.carry_over)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{formatNumber(e.received)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-usage">{formatNumber(e.used)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums font-semibold">{formatNumber(balance)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-ink-muted">{e.notes ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">
                        {approvalMap[e.id] ? <ApprovalBadge status={approvalMap[e.id]} /> : canWrite ? <button onClick={() => handleRequestApproval(e)} className="text-[11px] text-brand-koji hover:text-brand-koji-light transition-colors">승인 요청</button> : null}
                      </td>
                      {canWrite ? (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => { setEditEntry(e); setShowForm(true); }} className="text-xs text-brand-koji hover:underline mr-2">수정</button>
                          <button onClick={() => setDeleteConfirm(e)} className="text-xs text-brand-clay hover:underline">삭제</button>
                        </td>
                      ) : <td />}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
