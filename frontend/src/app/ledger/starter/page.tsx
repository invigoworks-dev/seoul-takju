'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/layout/Header';
import { starterApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import type { StarterEntry } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

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
const iCls = 'w-full bg-transparent border-0 outline-none focus:ring-0 text-ink-primary text-xs';
const nCls = iCls + ' text-right tabular-nums';

export default function StarterPage() {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<StarterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<StarterEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StarterEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'starter', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch {}
  }, []);

  const handleRequestApproval = async (entry: StarterEntry) => {
    try { await approvalsApi.request('starter', entry.id); setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' })); } catch {}
  };

  const sortedEntries = useMemo(() => sortDir === 'none' ? entries : [...entries].sort((a, b) => {
    const da = a.insp_date ?? a.ledger_date; const db = b.insp_date ?? b.ledger_date;
    return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
  }), [entries, sortDir]);
  const cycleSortDir = () => setSortDir((d) => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');

  const emptyInline = () => ({ insp_date: getTodayString(), insp_person: '', symbol: '', bno_b: '', bno_a: '', ctnr_no: '', inc_date: '', inc_depth: '', inc_vol: '', chk_date: '', chk_depth: '', chk_vol: '', chk_rate: '', mash_bno_b: '', mash_bno_a: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDate ? { from: filterDate, to: filterDate } : undefined;
      const data = await starterApi.list(params);
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
    const data: Partial<StarterEntry> = {
      ledger_date: get('insp_date') || getTodayString(),
      insp_date: get('insp_date') || undefined,
      insp_person: get('insp_person') || undefined,
      symbol: get('symbol') || undefined,
      bno_b: get('bno_b') || undefined,
      bno_a: get('bno_a') || undefined,
      ctnr_no: get('ctnr_no') || undefined,
      inc_date: get('inc_date') || undefined,
      inc_depth: get('inc_depth') || undefined,
      inc_vol: getNum('inc_vol'),
      chk_date: get('chk_date') || undefined,
      chk_depth: get('chk_depth') || undefined,
      chk_vol: getNum('chk_vol'),
      chk_rate: getNum('chk_rate'),
      mash_bno_b: get('mash_bno_b') || undefined,
      mash_bno_a: get('mash_bno_a') || undefined,
      notes: get('notes') || undefined,
    };
    if (editEntry) {
      await starterApi.update(editEntry.id, data);
    } else {
      await starterApi.create(data);
    }
    setShowForm(false);
    setEditEntry(null);
    loadData();
  };

  const handleDelete = async (entry: StarterEntry) => {
    setDeleteConfirm(null);
    await starterApi.delete(entry.id);
    loadData();
  };

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isLast = false) => {
    if (e.key === 'Escape') { setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    if (!inlineForm.insp_date || inlineSubmitting) return;
    setInlineSubmitting(true);
    try {
      await starterApi.create({
        ledger_date: inlineForm.insp_date,
        insp_date: inlineForm.insp_date || undefined,
        insp_person: inlineForm.insp_person || undefined,
        symbol: inlineForm.symbol || undefined,
        bno_b: inlineForm.bno_b || undefined,
        bno_a: inlineForm.bno_a || undefined,
        ctnr_no: inlineForm.ctnr_no || undefined,
        inc_date: inlineForm.inc_date || undefined,
        inc_depth: inlineForm.inc_depth || undefined,
        inc_vol: inlineForm.inc_vol !== '' ? Number(inlineForm.inc_vol) : undefined,
        chk_date: inlineForm.chk_date || undefined,
        chk_depth: inlineForm.chk_depth || undefined,
        chk_vol: inlineForm.chk_vol !== '' ? Number(inlineForm.chk_vol) : undefined,
        chk_rate: inlineForm.chk_rate !== '' ? Number(inlineForm.chk_rate) : undefined,
        mash_bno_b: inlineForm.mash_bno_b || undefined,
        mash_bno_a: inlineForm.mash_bno_a || undefined,
      });
      setInlineForm(emptyInline());
      loadData();
    } finally {
      setInlineSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="밑술 제조" subtitle="밑술(주모) 제조 수불 장부" />
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
            <ExcelToolbar ledgerType="starter" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
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
                {editEntry ? '밑술 제조 수정' : '밑술 제조 신규 등록'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="검사">
                    <SubField label="월일">
                      <input type="date" name="insp_date" defaultValue={editEntry?.insp_date ?? editEntry?.ledger_date ?? getTodayString()} className={inputCls} />
                    </SubField>
                    <SubField label="인">
                      <input type="text" name="insp_person" defaultValue={editEntry?.insp_person ?? ''} placeholder="담당자" className={inputCls} />
                    </SubField>
                  </FieldGroup>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">기호</label>
                      <input type="text" name="symbol" defaultValue={editEntry?.symbol ?? ''} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">용기 번호</label>
                      <input type="text" name="ctnr_no" defaultValue={editEntry?.ctnr_no ?? ''} className={inputCls} />
                    </div>
                  </div>
                </div>

                <FieldGroup label="담금 순호">
                  <SubField label="시작 전">
                    <input type="text" name="bno_b" defaultValue={editEntry?.bno_b ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="시작 후">
                    <input type="text" name="bno_a" defaultValue={editEntry?.bno_a ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="담금" wide>
                  <SubField label="월일">
                    <input type="date" name="inc_date" defaultValue={editEntry?.inc_date ?? ''} className={inputCls} />
                  </SubField>
                  <SubField label="입실심">
                    <input type="text" name="inc_depth" defaultValue={editEntry?.inc_depth ?? ''} placeholder="0" className={inputCls} />
                  </SubField>
                  <SubField label="용량 (L)">
                    <input type="number" name="inc_vol" step="0.001" defaultValue={editEntry?.inc_vol ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="숙성검사" wide>
                  <SubField label="월일">
                    <input type="date" name="chk_date" defaultValue={editEntry?.chk_date ?? ''} className={inputCls} />
                  </SubField>
                  <SubField label="입실심">
                    <input type="text" name="chk_depth" defaultValue={editEntry?.chk_depth ?? ''} placeholder="0" className={inputCls} />
                  </SubField>
                  <SubField label="용량 (L)">
                    <input type="number" name="chk_vol" step="0.001" defaultValue={editEntry?.chk_vol ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                  <SubField label="비율 (%)">
                    <input type="number" name="chk_rate" step="0.01" defaultValue={editEntry?.chk_rate ?? ''} placeholder="0" className={numInputCls} />
                  </SubField>
                </FieldGroup>

                <FieldGroup label="술덧 순호">
                  <SubField label="시작 전">
                    <input type="text" name="mash_bno_b" defaultValue={editEntry?.mash_bno_b ?? ''} placeholder="순호" className={inputCls} />
                  </SubField>
                  <SubField label="시작 후">
                    <input type="text" name="mash_bno_a" defaultValue={editEntry?.mash_bno_a ?? ''} placeholder="순호" className={inputCls} />
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
              <p className="text-xs text-ink-muted mb-4">{deleteConfirm.insp_date ?? deleteConfirm.ledger_date}</p>
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
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">검사</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">기호</th>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">담금 순호</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">용기</th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">담금</th>
                    <th colSpan={4} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">숙성검사</th>
                    <th colSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">술덧 순호</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                  <tr className="bg-brand-wood/80 text-ink-inverse/80">
                    <th onClick={cycleSortDir} className="px-2 py-1 text-center border-r border-brand-koji/20 cursor-pointer select-none"><span className="inline-flex items-center gap-1">월일<SortIcon direction={sortDir} /></span></th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">인</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작 전</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작 후</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">월일</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">입실심</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">용량(L)</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">월일</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">입실심</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">용량(L)</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">비율(%)</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작 전</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작 후</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-t-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="date" className={iCls + ' tabular-nums'} value={inlineForm.insp_date} onChange={(e) => setInlineForm((f) => ({ ...f, insp_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="인" className={iCls} value={inlineForm.insp_person} onChange={(e) => setInlineForm((f) => ({ ...f, insp_person: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="기호" className={iCls} value={inlineForm.symbol} onChange={(e) => setInlineForm((f) => ({ ...f, symbol: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="순호" className={iCls} value={inlineForm.bno_b} onChange={(e) => setInlineForm((f) => ({ ...f, bno_b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="순호" className={iCls} value={inlineForm.bno_a} onChange={(e) => setInlineForm((f) => ({ ...f, bno_a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="용기" className={iCls} value={inlineForm.ctnr_no} onChange={(e) => setInlineForm((f) => ({ ...f, ctnr_no: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="date" className={iCls + ' tabular-nums'} value={inlineForm.inc_date} onChange={(e) => setInlineForm((f) => ({ ...f, inc_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="입실심" className={iCls} value={inlineForm.inc_depth} onChange={(e) => setInlineForm((f) => ({ ...f, inc_depth: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.inc_vol} onChange={(e) => setInlineForm((f) => ({ ...f, inc_vol: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="date" className={iCls + ' tabular-nums'} value={inlineForm.chk_date} onChange={(e) => setInlineForm((f) => ({ ...f, chk_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="입실심" className={iCls} value={inlineForm.chk_depth} onChange={(e) => setInlineForm((f) => ({ ...f, chk_depth: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.chk_vol} onChange={(e) => setInlineForm((f) => ({ ...f, chk_vol: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.01" placeholder="0" className={nCls} value={inlineForm.chk_rate} onChange={(e) => setInlineForm((f) => ({ ...f, chk_rate: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="순호" className={iCls} value={inlineForm.mash_bno_b} onChange={(e) => setInlineForm((f) => ({ ...f, mash_bno_b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="순호" className={iCls} value={inlineForm.mash_bno_a} onChange={(e) => setInlineForm((f) => ({ ...f, mash_bno_a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"></td>
                      <td className="px-1 py-1 text-center whitespace-nowrap">
                        <button onClick={handleInlineSave} disabled={inlineSubmitting} className="text-xs text-brand-koji hover:underline mr-1 disabled:opacity-50">저장</button>
                        <button onClick={() => setInlineForm(emptyInline())} className="text-xs text-ink-muted hover:underline">취소</button>
                      </td>
                    </tr>
                  )}
                  {sortedEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary text-center tabular-nums whitespace-nowrap">{e.insp_date ?? e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.insp_person ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.symbol ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.bno_b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.bno_a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.ctnr_no ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center whitespace-nowrap">{e.inc_date ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.inc_depth ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.inc_vol != null ? formatNumber(e.inc_vol) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center whitespace-nowrap">{e.chk_date ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.chk_depth ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.chk_vol != null ? formatNumber(e.chk_vol) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.chk_rate != null ? formatNumber(e.chk_rate) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.mash_bno_b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.mash_bno_a ?? ''}</td>
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
