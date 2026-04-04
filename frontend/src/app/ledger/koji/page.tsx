'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/layout/Header';
import PrintHeader from '@/components/ui/PrintHeader';
import { kojiApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import type { KojiEntry } from '@/lib/types';
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

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-surface-secondary rounded-lg p-3 bg-surface-card flex flex-col gap-2">
      <div className="text-[10px] font-bold text-brand-koji uppercase tracking-wider pb-1.5 border-b border-surface-secondary">
        {label}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function SubField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-[10px] text-ink-muted font-semibold uppercase">{label}</span>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-surface-secondary rounded px-2 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji';
const numInputCls = inputCls + ' tabular-nums';

type SortKey = 'ledger_date' | 'person';
type SortState = { key: SortKey; dir: SortDirection };
function nextDir(d: SortDirection): SortDirection { return d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none'; }

export default function KojiPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<KojiEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<KojiEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<KojiEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'ledger_date', dir: 'none' });
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'koji', record_ids: ids });
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
      const data = await kojiApi.list(params);
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다', 'error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, loadApprovals]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => { const v = fd.get(k); return v !== '' && v !== null ? Number(v) : undefined; };
    const data: Partial<KojiEntry> = {
      ledger_date: get('ledger_date'),
      person: get('person') || undefined,
      ms_cnt: getNum('ms_cnt'),
      sd_cnt: getNum('sd_cnt'),
      ms_raw: getNum('ms_raw'),
      sd_raw: getNum('sd_raw'),
      ms_b: get('ms_b') || undefined,
      ms_a: get('ms_a') || undefined,
      sd_b: get('sd_b') || undefined,
      sd_a: get('sd_a') || undefined,
      notes: get('notes') || undefined,
    };
    try {
      if (editEntry) {
        await kojiApi.update(editEntry.id, data);
      } else {
        await kojiApi.create(data);
      }
      setShowForm(false);
      setEditEntry(null);
      loadData();
      showToast('저장되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    }
  };

  const handleDelete = async (entry: KojiEntry) => {
    setDeleteConfirm(null);
    try {
      await kojiApi.delete(entry.id);
      loadData();
      showToast('삭제되었습니다', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error');
    }
  };

  const handleRequestApproval = async (entry: KojiEntry) => {
    try {
      await approvalsApi.request('koji', entry.id);
      setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '승인 요청에 실패했습니다', 'error');
    }
  };

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  const emptyInline = () => ({ ledger_date: getTodayString(), person: '', ms_cnt: 0, sd_cnt: 0, ms_raw: 0, sd_raw: 0, ms_b: '', ms_a: '', sd_b: '', sd_a: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const handleInlineKeyDown = (e: React.KeyboardEvent, isLast = false) => {
    if (e.key === 'Escape') { e.preventDefault(); setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast && !e.shiftKey)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    setInlineSubmitting(true);
    try {
      const { person, ms_b, ms_a, sd_b, sd_a, ...nums } = inlineForm;
      await kojiApi.create({ ledger_date: inlineForm.ledger_date, person: person || undefined, ms_cnt: nums.ms_cnt || undefined, sd_cnt: nums.sd_cnt || undefined, ms_raw: nums.ms_raw || undefined, sd_raw: nums.sd_raw || undefined, ms_b: ms_b || undefined, ms_a: ms_a || undefined, sd_b: sd_b || undefined, sd_a: sd_a || undefined });
      await loadData();
      setInlineForm(emptyInline());
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다', 'error');
    } finally { setInlineSubmitting(false); }
  };

  const SortTh = ({ sortKey, children, align = 'center' }: { sortKey: SortKey; children: React.ReactNode; align?: string }) => (
    <th
      className={`px-3 py-2 text-${align} font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none group`}
      onClick={() => handleSort(sortKey)}
      rowSpan={3}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <SortIcon direction={sort.key === sortKey ? sort.dir : 'none'} />
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-surface-primary">
      <PrintHeader title="입국 수불 원장" period={filterDate || undefined} />
      <Header title="입국 수불" subtitle="입국(코지) 수불 장부" />
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
            <ExcelToolbar ledgerType="koji" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
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
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-2xl p-5 border border-surface-secondary max-h-[90vh] overflow-y-auto">
              <h3 className="text-sm font-bold text-ink-primary mb-4">
                {editEntry ? '입국 수불 수정' : '입국 수불 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">검사 월일 *</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담당자</label>
                    <UserSelect
                      value={editEntry?.person ?? ''}
                      onChange={(v) => {
                        // handled via hidden input trick — use controlled form approach
                        const form = document.querySelector('form');
                        const input = form?.querySelector<HTMLInputElement>('input[name="person"]');
                        if (input) { input.value = v; }
                      }}
                      placeholder="담당자 선택"
                    />
                    <input type="hidden" name="person" defaultValue={editEntry?.person ?? ''} />
                  </div>
                </div>

                <FieldGroup label="담금예정개수">
                  <SubField label="밑술 (개)">
                    <input type="number" name="ms_cnt" step="0.1" defaultValue={editEntry?.ms_cnt ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="술덧 (개)">
                    <input type="number" name="sd_cnt" step="0.1" defaultValue={editEntry?.sd_cnt ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="원료수량 (kg)">
                  <SubField label="밑술">
                    <input type="number" name="ms_raw" step="0.001" defaultValue={editEntry?.ms_raw ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="술덧">
                    <input type="number" name="sd_raw" step="0.001" defaultValue={editEntry?.sd_raw ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="담금용기순호 — 밑술">
                  <SubField label="작업전">
                    <input type="text" name="ms_b" defaultValue={editEntry?.ms_b ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="작업후">
                    <input type="text" name="ms_a" defaultValue={editEntry?.ms_a ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="담금용기순호 — 술덧">
                  <SubField label="작업전">
                    <input type="text" name="sd_b" defaultValue={editEntry?.sd_b ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="작업후">
                    <input type="text" name="sd_a" defaultValue={editEntry?.sd_a ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                </FieldGroup>

                <div>
                  <label className="block text-xs text-ink-secondary mb-1">비고</label>
                  <input type="text" name="notes" defaultValue={editEntry?.notes ?? ''} placeholder="선택 사항" className={inputCls} />
                </div>

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
                    <SortTh sortKey="ledger_date">검사월일</SortTh>
                    <SortTh sortKey="person">담당자</SortTh>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">담금예정개수</th>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">원료수량 (kg)</th>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">담금용기순호 — 밑술</th>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">담금용기순호 — 술덧</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th rowSpan={3} className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                  <tr className="bg-brand-wood/80 text-ink-inverse/80">
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">밑술</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">술덧</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">밑술</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">술덧</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">작업전</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">작업후</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">작업전</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">작업후</th>
                    <th className="px-2 py-1 border-r border-brand-koji/20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="date" value={inlineForm.ledger_date} onChange={(e) => setInlineForm(p => ({ ...p, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} className={iCls + ' tabular-nums'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary">
                        <UserSelect value={inlineForm.person} onChange={(v) => setInlineForm(p => ({ ...p, person: v }))} placeholder="담당자" inputClassName={iCls} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.ms_cnt || ''} onChange={(e) => setInlineForm(p => ({ ...p, ms_cnt: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.1" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.sd_cnt || ''} onChange={(e) => setInlineForm(p => ({ ...p, sd_cnt: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.1" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.ms_raw || ''} onChange={(e) => setInlineForm(p => ({ ...p, ms_raw: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.sd_raw || ''} onChange={(e) => setInlineForm(p => ({ ...p, sd_raw: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.ms_b} onChange={(e) => setInlineForm(p => ({ ...p, ms_b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="순호" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.ms_a} onChange={(e) => setInlineForm(p => ({ ...p, ms_a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="순호" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.sd_b} onChange={(e) => setInlineForm(p => ({ ...p, sd_b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="순호" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.sd_a} onChange={(e) => setInlineForm(p => ({ ...p, sd_a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} placeholder="순호" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"></td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-end items-center">
                          <button onClick={handleInlineSave} disabled={inlineSubmitting} className="text-[11px] px-2 py-0.5 bg-brand-wood text-ink-inverse rounded hover:bg-brand-wood-light disabled:opacity-40">{inlineSubmitting ? '저장중' : '저장'}</button>
                          <button onClick={() => setInlineForm(emptyInline())} className="text-[11px] text-ink-muted hover:text-ink-secondary">취소</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary text-center tabular-nums whitespace-nowrap">{e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.person ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.ms_cnt != null ? formatNumber(e.ms_cnt) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.sd_cnt != null ? formatNumber(e.sd_cnt) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.ms_raw != null ? formatNumber(e.ms_raw) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.sd_raw != null ? formatNumber(e.sd_raw) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.ms_b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.ms_a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.sd_b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.sd_a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">
                        {approvalMap[e.id] ? (
                          <Link href="/approvals"><ApprovalBadge status={approvalMap[e.id]} /></Link>
                        ) : canWrite ? (
                          <button onClick={() => handleRequestApproval(e)} className="text-[11px] text-brand-koji hover:text-brand-koji-light transition-colors">승인 요청</button>
                        ) : null}
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
          <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 text-xs text-ink-secondary">
            총 {entries.length}건
          </div>
        )}
      </div>
    </div>
  );
}
