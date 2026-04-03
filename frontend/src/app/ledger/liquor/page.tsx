'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/layout/Header';
import { liquorApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import UserSelect from '@/components/ui/UserSelect';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import type { LiquorEntry } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const iCls = 'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary placeholder:text-ink-muted/40 text-[12px]';
const nCls = iCls + ' text-right tabular-nums';

function FieldGroup({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`border border-surface-secondary rounded-lg p-3 bg-surface-card flex flex-col gap-2 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[10px] font-bold text-brand-koji uppercase tracking-wider pb-1.5 border-b border-surface-secondary">{label}</div>
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

export default function LiquorPage() {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<LiquorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<LiquorEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LiquorEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'liquor', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch {}
  }, []);

  const handleRequestApproval = async (entry: LiquorEntry) => {
    try { await approvalsApi.request('liquor', entry.id); setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' })); } catch {}
  };

  const sortedEntries = useMemo(() => {
    if (sortDir === 'none') return entries;
    return [...entries].sort((a, b) => sortDir === 'asc' ? a.ledger_date.localeCompare(b.ledger_date) : b.ledger_date.localeCompare(a.ledger_date));
  }, [entries, sortDir]);

  const cycleSortDir = () => setSortDir((d) => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDate ? { from: filterDate, to: filterDate } : undefined;
      const data = await liquorApi.list(params);
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => { const v = fd.get(k); return v !== '' && v !== null ? Number(v) : undefined; };
    const data: Partial<LiquorEntry> = {
      ledger_date: get('ledger_date'),
      person: get('person') || undefined,
      bno_b: get('bno_b') || undefined,
      bno_a: get('bno_a') || undefined,
      inc: getNum('inc'),
      out: getNum('out'),
      price: getNum('price'),
      driver: get('driver') || undefined,
      dest: get('dest') || undefined,
      remain: getNum('remain'),
      loss: getNum('loss'),
      loss_rate: getNum('loss_rate'),
      notes: get('notes') || undefined,
      // legacy fields for backward compat
      carry_over: 0,
      received: getNum('inc') ?? 0,
      shipped: getNum('out') ?? 0,
      balance: getNum('remain') ?? 0,
    };
    if (editEntry) {
      await liquorApi.update(editEntry.id, data);
    } else {
      await liquorApi.create(data);
    }
    setShowForm(false);
    setEditEntry(null);
    loadData();
  };

  const handleDelete = async (entry: LiquorEntry) => {
    setDeleteConfirm(null);
    await liquorApi.delete(entry.id);
    loadData();
  };

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  const emptyInline = () => ({ ledger_date: getTodayString(), person: '', bno_b: '', bno_a: '', inc: 0, out: 0, price: 0, driver: '', dest: '', remain: 0, loss: 0, loss_rate: 0, notes: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const handleInlineKeyDown = (e: React.KeyboardEvent, isLast = false) => {
    if (e.key === 'Escape') { e.preventDefault(); setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast && !e.shiftKey)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    setInlineSubmitting(true);
    try {
      const { person, bno_b, bno_a, driver, dest, notes, ...nums } = inlineForm;
      await liquorApi.create({ ledger_date: inlineForm.ledger_date, person: person || undefined, bno_b: bno_b || undefined, bno_a: bno_a || undefined, inc: nums.inc || undefined, out: nums.out || undefined, price: nums.price || undefined, driver: driver || undefined, dest: dest || undefined, remain: nums.remain || undefined, loss: nums.loss || undefined, loss_rate: nums.loss_rate || undefined, notes: notes || undefined, carry_over: 0, received: nums.inc || 0, shipped: nums.out || 0, balance: nums.remain || 0 });
      await loadData();
      setInlineForm(emptyInline());
    } catch {} finally { setInlineSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="주류 수불" subtitle="주류 수불 장부" />
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
            <ExcelToolbar ledgerType="liquor" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
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
                {editEntry ? '주류 수정' : '주류 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">검사 월일 *</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담당자</label>
                    <input type="text" name="person" defaultValue={editEntry?.person ?? ''} placeholder="담당자" className={inputCls} />
                  </div>
                </div>

                <FieldGroup label="걸름수량">
                  <SubField label="담금순호 사용전">
                    <input type="text" name="bno_b" defaultValue={editEntry?.bno_b ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="담금순호 사용후">
                    <input type="text" name="bno_a" defaultValue={editEntry?.bno_a ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="수량 (L)">
                    <input type="number" name="inc" step="0.001" defaultValue={editEntry?.inc ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="출고수량" wide>
                  <SubField label="수량 (L)">
                    <input type="number" name="out" step="0.001" defaultValue={editEntry?.out ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="가격 (원)">
                    <input type="number" name="price" step="1" defaultValue={editEntry?.price ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="배달자">
                    <input type="text" name="driver" defaultValue={editEntry?.driver ?? ''} placeholder="배달자" className={inputCls} />
                  </SubField>
                  <SubField label="매도처">
                    <input type="text" name="dest" defaultValue={editEntry?.dest ?? ''} placeholder="매도처" className={inputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="결감/잔량">
                  <SubField label="잔수량 (L)">
                    <input type="number" name="remain" step="0.001" defaultValue={editEntry?.remain ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="결감수량 (L)">
                    <input type="number" name="loss" step="0.001" defaultValue={editEntry?.loss ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="결감비율 (%)">
                    <input type="number" name="loss_rate" step="0.01" defaultValue={editEntry?.loss_rate ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <div>
                  <label className="block text-xs text-ink-secondary mb-1">적요</label>
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
                    <th rowSpan={2} onClick={cycleSortDir} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none group"><span className="inline-flex items-center gap-1">검사월일<SortIcon direction={sortDir} /></span></th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">담당자</th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">걸름수량</th>
                    <th colSpan={4} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">출고수량</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">잔수량(L)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">결감수량(L)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">결감비율(%)</th>
                    <th rowSpan={2} className="px-3 py-2 text-left font-semibold border-r border-brand-koji/20">적요</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                  <tr className="bg-brand-wood/80 text-ink-inverse/80">
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">순호사용전</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">순호사용후</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">수량(L)</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">수량(L)</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">가격(원)</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">배달자</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">매도처</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="date" value={inlineForm.ledger_date} onChange={(e) => setInlineForm(p => ({ ...p, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} className={iCls + ' tabular-nums'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.person} onChange={(e) => setInlineForm(p => ({ ...p, person: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="담당자" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.bno_b} onChange={(e) => setInlineForm(p => ({ ...p, bno_b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="순호전" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.bno_a} onChange={(e) => setInlineForm(p => ({ ...p, bno_a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="순호후" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.inc || ''} onChange={(e) => setInlineForm(p => ({ ...p, inc: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls + ' text-accent-receipt'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.out || ''} onChange={(e) => setInlineForm(p => ({ ...p, out: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls + ' text-accent-usage'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.price || ''} onChange={(e) => setInlineForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.driver} onChange={(e) => setInlineForm(p => ({ ...p, driver: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="배달자" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.dest} onChange={(e) => setInlineForm(p => ({ ...p, dest: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="매도처" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.remain || ''} onChange={(e) => setInlineForm(p => ({ ...p, remain: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.loss || ''} onChange={(e) => setInlineForm(p => ({ ...p, loss: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.loss_rate || ''} onChange={(e) => setInlineForm(p => ({ ...p, loss_rate: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.01" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.notes} onChange={(e) => setInlineForm(p => ({ ...p, notes: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} placeholder="적요" className={iCls + ' text-[11px]'} /></td>
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
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.bno_b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.bno_a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{e.inc != null ? formatNumber(e.inc) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-usage">{e.out != null ? formatNumber(e.out) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.price != null ? formatNumber(e.price) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.driver ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.dest ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums font-semibold text-brand-koji">{e.remain != null ? formatNumber(e.remain) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.loss != null ? formatNumber(e.loss) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.loss_rate != null ? formatNumber(e.loss_rate) : ''}</td>
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
            <span className="text-accent-receipt tabular-nums">걸름 <strong>{formatNumber(entries.reduce((s, e) => s + (e.inc ?? 0), 0))}</strong> L</span>
            <span className="text-accent-usage tabular-nums">출고 <strong>{formatNumber(entries.reduce((s, e) => s + (e.out ?? 0), 0))}</strong> L</span>
          </div>
        )}
      </div>
    </div>
  );
}
