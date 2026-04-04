'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/layout/Header';
import PrintHeader from '@/components/ui/PrintHeader';
import { leesApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import type { LeesEntry } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import UserSelect from '@/components/ui/UserSelect';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';

const iCls = 'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary placeholder:text-ink-muted/40 text-[12px]';
const nCls = iCls + ' text-right tabular-nums';

interface LeesEntryExt extends LeesEntry {
  person?: string;
  inc?: number;
  method?: string;
  out?: number;
}

const inputCls = 'w-full border border-surface-secondary rounded px-2 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji';
const numInputCls = inputCls + ' tabular-nums';

type SortDirection2 = SortDirection;
type SortKey = 'ledger_date' | 'person';
type SortState = { key: SortKey; dir: SortDirection2 };
function nextDir(d: SortDirection2): SortDirection2 { return d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none'; }

export default function LeesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<LeesEntryExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<LeesEntryExt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LeesEntryExt | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'ledger_date', dir: 'none' });
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'lees', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch (err) {
      console.warn('Failed to load approvals:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDate ? { from: filterDate, to: filterDate } : undefined;
      const data = await leesApi.list(params) as LeesEntryExt[];
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다', 'error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, loadApprovals]);

  const handleRequestApproval = async (entry: LeesEntryExt) => {
    try {
      await approvalsApi.request('lees', entry.id);
      setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '승인 요청에 실패했습니다', 'error');
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => { const v = fd.get(k); return v !== '' && v !== null ? Number(v) : undefined; };
    const data = {
      ledger_date: get('ledger_date'),
      batch_code: get('batch_code') || undefined,
      person: get('person') || undefined,
      inc: getNum('inc'),
      method: get('method') || undefined,
      out: getNum('out'),
      // legacy fields mapped from inc/out for backward compat
      produced: getNum('inc') ?? 0,
      used: getNum('out') ?? 0,
      notes: get('notes') || undefined,
    };
    try {
      if (editEntry) {
        await leesApi.update(editEntry.id, data);
      } else {
        await leesApi.create(data);
      }
      setShowForm(false);
      setEditEntry(null);
      loadData();
      showToast('저장되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    }
  };

  const handleDelete = async (entry: LeesEntryExt) => {
    setDeleteConfirm(null);
    try {
      await leesApi.delete(entry.id);
      loadData();
      showToast('삭제되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error');
    }
  };

  const emptyInline = () => ({ ledger_date: getTodayString(), person: '', inc: 0, method: '', out: 0, notes: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const handleInlineKeyDown = (e: React.KeyboardEvent, isLast = false) => {
    if (e.key === 'Escape') { e.preventDefault(); setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast && !e.shiftKey)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    setInlineSubmitting(true);
    try {
      const d = { ledger_date: inlineForm.ledger_date, person: inlineForm.person || undefined, inc: inlineForm.inc, method: inlineForm.method || undefined, out: inlineForm.out, produced: inlineForm.inc, used: inlineForm.out, notes: inlineForm.notes || undefined };
      await leesApi.create(d);
      await loadData();
      setInlineForm(emptyInline());
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    } finally { setInlineSubmitting(false); }
  };

  const sortedEntries = useMemo(() => {
    if (sort.dir === 'none') return entries;
    return [...entries].sort((a, b) => {
      const aVal = sort.key === 'ledger_date' ? a.ledger_date : (a.person ?? '');
      const bVal = sort.key === 'ledger_date' ? b.ledger_date : (b.person ?? '');
      return sort.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [entries, sort]);

  const handleSort = (key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key ? nextDir(prev.dir) : 'asc' }));
  };

  // running balance
  const withBalance = sortedEntries.map((e, i) => {
    const prev = i === 0 ? 0 : sortedEntries.slice(0, i).reduce((s, r) => s + (r.inc ?? r.produced ?? 0) - (r.out ?? r.used ?? 0), 0);
    const inc = e.inc ?? e.produced ?? 0;
    const out = e.out ?? e.used ?? 0;
    return { ...e, _bal: prev + inc - out };
  });

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  return (
    <div className="min-h-screen bg-surface-primary">
      <PrintHeader title="술지거미 수불 원장" period={filterDate || undefined} />
      <Header title="술지거미 수불" subtitle="술지거미(여과 찌꺼기) 수불 장부" />
      <div className="p-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-secondary font-medium">날짜</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              className="border border-surface-secondary rounded px-2.5 py-1 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums" />
            {filterDate && (
              <button onClick={() => setFilterDate('')} className="text-[11px] text-ink-muted hover:text-ink-secondary transition-colors">초기화</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExcelToolbar ledgerType="lees" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
            {canWrite && (
              <button onClick={() => { setEditEntry(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors">
                <span className="text-brand-koji">+</span><span>신규 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-lg p-5 border border-surface-secondary">
              <h3 className="text-sm font-bold text-ink-primary mb-4">
                {editEntry ? '술지거미 수정' : '술지거미 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">월일 *</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담당자</label>
                    <input type="hidden" name="person" defaultValue={editEntry?.person ?? ''} id="lees-person-hidden" />
                    <UserSelect value={editEntry?.person ?? ''} onChange={(v) => { const el = document.getElementById('lees-person-hidden') as HTMLInputElement; if (el) el.value = v; }} placeholder="담당자 선택" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">발생량 (kg)</label>
                    <input type="number" name="inc" step="0.001" defaultValue={editEntry?.inc ?? editEntry?.produced ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">처리방법</label>
                    <input type="text" name="method" defaultValue={editEntry?.method ?? ''} placeholder="처리 방법" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">처리량 (kg)</label>
                    <input type="number" name="out" step="0.001" defaultValue={editEntry?.out ?? editEntry?.used ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">비고</label>
                  <input type="text" name="notes" defaultValue={editEntry?.notes ?? ''} placeholder="선택 사항" className={inputCls} />
                </div>
                <input type="hidden" name="batch_code" defaultValue={editEntry?.batch_code ?? ''} />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeForm} className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50">취소</button>
                  <button type="submit" className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light">
                    {editEntry ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 text-center border border-surface-secondary">
              <p className="text-ink-primary mb-1 font-bold text-sm">정말 삭제하시겠습니까?</p>
              <p className="text-xs text-ink-muted mb-4">{deleteConfirm.ledger_date}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded">취소</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded">삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-card rounded border border-surface-secondary overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-ink-muted text-sm animate-pulse">불러오는 중...</div>
          ) : entries.length === 0 && !canWrite ? (
            <div className="text-center py-10 text-ink-muted text-sm">데이터가 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-wood text-ink-inverse">
                    <th onClick={() => handleSort('ledger_date')} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none group"><span className="inline-flex items-center gap-1">월일<SortIcon direction={sort.key === 'ledger_date' ? sort.dir : 'none'} /></span></th>
                    <th onClick={() => handleSort('person')} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none group"><span className="inline-flex items-center gap-1">담당자<SortIcon direction={sort.key === 'person' ? sort.dir : 'none'} /></span></th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">발생량(kg)</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">처리방법</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">처리량(kg)</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">현재고(kg)</th>
                    <th className="px-3 py-2 text-left font-semibold border-r border-brand-koji/20">비고</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <input type="date" value={inlineForm.ledger_date} onChange={(e) => setInlineForm(p => ({ ...p, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} className={iCls + ' tabular-nums'} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <UserSelect value={inlineForm.person} onChange={(v) => setInlineForm(p => ({ ...p, person: v }))} placeholder="담당자" inputClassName={iCls} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <input type="number" value={inlineForm.inc || ''} onChange={(e) => setInlineForm(p => ({ ...p, inc: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls + ' text-accent-receipt'} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <input type="text" value={inlineForm.method} onChange={(e) => setInlineForm(p => ({ ...p, method: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="처리방법" className={iCls} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <input type="number" value={inlineForm.out || ''} onChange={(e) => setInlineForm(p => ({ ...p, out: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls + ' text-accent-usage'} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary text-right tabular-nums font-bold text-[12px]">
                        <span className="text-ink-muted/40">—</span>
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <input type="text" value={inlineForm.notes} onChange={(e) => setInlineForm(p => ({ ...p, notes: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} placeholder="비고" className={iCls + ' text-[11px]'} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"></td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-end items-center">
                          <button onClick={handleInlineSave} disabled={inlineSubmitting} className="text-[11px] px-2 py-0.5 bg-brand-wood text-ink-inverse rounded hover:bg-brand-wood-light disabled:opacity-40">{inlineSubmitting ? '저장중' : '저장'}</button>
                          <button onClick={() => setInlineForm(emptyInline())} className="text-[11px] text-ink-muted hover:text-ink-secondary">취소</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {withBalance.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary text-center tabular-nums whitespace-nowrap">{e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.person ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{formatNumber(e.inc ?? e.produced ?? 0)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.method ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-usage">{formatNumber(e.out ?? e.used ?? 0)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums font-semibold text-brand-koji">{formatNumber(e._bal)}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-ink-muted">{e.notes ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">
                        {approvalMap[e.id] ? <ApprovalBadge status={approvalMap[e.id]} /> : canWrite ? <button onClick={() => handleRequestApproval(e)} className="text-[11px] text-brand-koji hover:text-brand-koji-light transition-colors">승인 요청</button> : null}
                      </td>
                      {canWrite && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <button onClick={() => { setEditEntry(e); setShowForm(true); }} className="text-xs text-brand-koji hover:underline mr-2">수정</button>
                          <button onClick={() => setDeleteConfirm(e)} className="text-xs text-brand-clay hover:underline">삭제</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 flex items-center gap-4 text-xs flex-wrap">
            <span className="text-ink-primary font-bold">총 {entries.length}건</span>
            <span className="text-accent-receipt tabular-nums">발생 <strong>{formatNumber(entries.reduce((s, e) => s + (e.inc ?? e.produced ?? 0), 0))}</strong></span>
            <span className="text-accent-usage tabular-nums">처리 <strong>{formatNumber(entries.reduce((s, e) => s + (e.out ?? e.used ?? 0), 0))}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
