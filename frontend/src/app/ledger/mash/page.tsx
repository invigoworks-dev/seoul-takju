'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/layout/Header';
import { mashApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import type { MashEntry } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const iCls = 'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary placeholder:text-ink-muted/40 text-[12px]';
const nCls = iCls + ' text-right tabular-nums';

const inputCls = 'w-full border border-surface-secondary rounded px-2 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji';
const numInputCls = inputCls + ' tabular-nums';

export default function MashPage() {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<MashEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<MashEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MashEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'mash', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch {}
  }, []);

  const handleRequestApproval = async (entry: MashEntry) => {
    try { await approvalsApi.request('mash', entry.id); setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' })); } catch {}
  };

  const sortedEntries = useMemo(() => sortDir === 'none' ? entries : [...entries].sort((a, b) => sortDir === 'asc' ? a.ledger_date.localeCompare(b.ledger_date) : b.ledger_date.localeCompare(a.ledger_date)), [entries, sortDir]);
  const cycleSortDir = () => setSortDir((d) => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDate ? { from: filterDate, to: filterDate } : undefined;
      const data = await mashApi.list(params);
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, loadApprovals]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => { const v = fd.get(k); return v !== '' && v !== null ? Number(v) : undefined; };
    const data: Partial<MashEntry> = {
      ledger_date: get('ledger_date'),
      bno: get('bno') || undefined,
      rtype: get('rtype') || undefined,
      rice: getNum('rice'),
      water: getNum('water'),
      yeast: getNum('yeast'),
      koji: getNum('koji'),
      fvol: getNum('fvol'),
      fdate: get('fdate') || undefined,
      filt: getNum('filt'),
      alc: getNum('alc'),
      acid: getNum('acid'),
      notes: get('notes') || undefined,
    };
    if (editEntry) {
      await mashApi.update(editEntry.id, data);
    } else {
      await mashApi.create(data);
    }
    setShowForm(false);
    setEditEntry(null);
    loadData();
  };

  const handleDelete = async (entry: MashEntry) => {
    setDeleteConfirm(null);
    await mashApi.delete(entry.id);
    loadData();
  };

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  const emptyInline = () => ({ ledger_date: getTodayString(), bno: '', rtype: '', rice: 0, water: 0, yeast: 0, koji: 0, fvol: 0, fdate: '', filt: 0, alc: 0, acid: 0, notes: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const handleInlineKeyDown = (e: React.KeyboardEvent, isLast = false) => {
    if (e.key === 'Escape') { e.preventDefault(); setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast && !e.shiftKey)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    setInlineSubmitting(true);
    try {
      const { bno, rtype, fdate, notes, ...nums } = inlineForm;
      await mashApi.create({ ledger_date: inlineForm.ledger_date, bno: bno || undefined, rtype: rtype || undefined, rice: nums.rice || undefined, water: nums.water || undefined, yeast: nums.yeast || undefined, koji: nums.koji || undefined, fvol: nums.fvol || undefined, fdate: fdate || undefined, filt: nums.filt || undefined, alc: nums.alc || undefined, acid: nums.acid || undefined, notes: notes || undefined });
      await loadData();
      setInlineForm(emptyInline());
    } catch {} finally { setInlineSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="술덧담금 및 걸름" subtitle="술덧담금 및 술덧걸름 수불 장부" />
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
            <ExcelToolbar ledgerType="mash" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
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
                {editEntry ? '술덧담금 수정' : '술덧담금 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담금 일자 *</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담금 번호</label>
                    <input type="text" name="bno" defaultValue={editEntry?.bno ?? ''} placeholder="번호" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">원료 종류</label>
                    <input type="text" name="rtype" defaultValue={editEntry?.rtype ?? ''} placeholder="평화미/백미" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">쌀 (kg)</label>
                    <input type="number" name="rice" step="0.001" defaultValue={editEntry?.rice ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">물 (L)</label>
                    <input type="number" name="water" step="0.001" defaultValue={editEntry?.water ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">효모 (g)</label>
                    <input type="number" name="yeast" step="0.001" defaultValue={editEntry?.yeast ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">곡자 (kg)</label>
                    <input type="number" name="koji" step="0.001" defaultValue={editEntry?.koji ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-ink-secondary mb-1">담금량 (L)</label>
                  <input type="number" name="fvol" step="0.001" defaultValue={editEntry?.fvol ?? ''} placeholder="0" className={numInputCls} />
                </div>

                <div className="border-t border-surface-secondary pt-3">
                  <p className="text-[10px] text-ink-muted font-bold uppercase tracking-wider mb-2">걸름</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">걸름 일자</label>
                      <input type="date" name="fdate" defaultValue={editEntry?.fdate ?? ''} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">걸른량 (L)</label>
                      <input type="number" name="filt" step="0.001" defaultValue={editEntry?.filt ?? ''} placeholder="0" className={numInputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">주정분 (%)</label>
                      <input type="number" name="alc" step="0.01" defaultValue={editEntry?.alc ?? ''} placeholder="0" className={numInputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">산도</label>
                      <input type="number" name="acid" step="0.01" defaultValue={editEntry?.acid ?? ''} placeholder="0" className={numInputCls} />
                    </div>
                  </div>
                </div>

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
              <p className="text-xs text-ink-muted mb-4">{deleteConfirm.ledger_date} {deleteConfirm.bno ?? ''}</p>
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
                    <th rowSpan={2} onClick={cycleSortDir} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none group"><span className="inline-flex items-center gap-1">담금일<SortIcon direction={sortDir} /></span></th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">담금번호</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">원료종류</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">쌀(kg)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">물(L)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">효모(g)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">곡자(kg)</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">담금량(L)</th>
                    <th colSpan={4} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">걸름</th>
                    <th rowSpan={2} className="px-3 py-2 text-left font-semibold border-r border-brand-koji/20">비고</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                  <tr className="bg-brand-wood/80 text-ink-inverse/80">
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">걸름일</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">걸른량(L)</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">주정분(%)</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">산도</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-b-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="date" value={inlineForm.ledger_date} onChange={(e) => setInlineForm(p => ({ ...p, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} className={iCls + ' tabular-nums'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.bno} onChange={(e) => setInlineForm(p => ({ ...p, bno: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="번호" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.rtype} onChange={(e) => setInlineForm(p => ({ ...p, rtype: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="원료종류" className={iCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.rice || ''} onChange={(e) => setInlineForm(p => ({ ...p, rice: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.water || ''} onChange={(e) => setInlineForm(p => ({ ...p, water: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.yeast || ''} onChange={(e) => setInlineForm(p => ({ ...p, yeast: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.koji || ''} onChange={(e) => setInlineForm(p => ({ ...p, koji: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.fvol || ''} onChange={(e) => setInlineForm(p => ({ ...p, fvol: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="date" value={inlineForm.fdate} onChange={(e) => setInlineForm(p => ({ ...p, fdate: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} className={iCls + ' tabular-nums'} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.filt || ''} onChange={(e) => setInlineForm(p => ({ ...p, filt: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.001" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.alc || ''} onChange={(e) => setInlineForm(p => ({ ...p, alc: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.01" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="number" value={inlineForm.acid || ''} onChange={(e) => setInlineForm(p => ({ ...p, acid: parseFloat(e.target.value) || 0 }))} onKeyDown={(e) => handleInlineKeyDown(e)} placeholder="0" step="0.01" className={nCls} /></td>
                      <td className="px-2 py-1.5 border-r border-surface-secondary"><input type="text" value={inlineForm.notes} onChange={(e) => setInlineForm(p => ({ ...p, notes: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} placeholder="비고" className={iCls + ' text-[11px]'} /></td>
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
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.bno ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary">{e.rtype ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.rice != null ? formatNumber(e.rice) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.water != null ? formatNumber(e.water) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.yeast != null ? formatNumber(e.yeast) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.koji != null ? formatNumber(e.koji) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.fvol != null ? formatNumber(e.fvol) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center whitespace-nowrap">{e.fdate ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.filt != null ? formatNumber(e.filt) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.alc != null ? formatNumber(e.alc) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.acid != null ? formatNumber(e.acid) : ''}</td>
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
          <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 text-xs text-ink-secondary">
            총 {entries.length}건
          </div>
        )}
      </div>
    </div>
  );
}
