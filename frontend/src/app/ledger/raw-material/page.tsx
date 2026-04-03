'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { rawMaterialExtApi, materialsApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import ExcelToolbar from '@/components/ledger/ExcelToolbar';
import ApprovalBadge from '@/components/ui/ApprovalBadge';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';
import SortIcon from '@/components/ui/SortIcon';
import type { SortDirection } from '@/components/ui/SortIcon';
import type { RawMaterialEntryExtended, Material } from '@/lib/types';
import { formatNumber, getTodayString } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const RICE_TYPES = ['평화미', '백미'];

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-surface-secondary rounded-lg p-3 bg-surface-card flex flex-col gap-2">
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

function RawMaterialPageInner() {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const searchParams = useSearchParams();
  const typeName = searchParams.get('type') ?? '';
  const isRice = RICE_TYPES.includes(typeName);

  const [material, setMaterial] = useState<Material | null>(null);
  const [entries, setEntries] = useState<RawMaterialEntryExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<RawMaterialEntryExtended | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RawMaterialEntryExtended | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const data = await approvalsApi.list({ ledger_type: 'raw_material', record_ids: ids });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) map[a.record_id] = a.status;
      setApprovalMap(map);
    } catch {}
  }, []);

  const handleRequestApproval = async (entry: RawMaterialEntryExtended) => {
    try { await approvalsApi.request('raw_material', entry.id); setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' })); } catch {}
  };

  const sortedEntries = useMemo(() => sortDir === 'none' ? entries : [...entries].sort((a, b) => sortDir === 'asc' ? a.ledger_date.localeCompare(b.ledger_date) : b.ledger_date.localeCompare(a.ledger_date)), [entries, sortDir]);
  const cycleSortDir = () => setSortDir((d) => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none');

  const emptyInline = () => ({ ledger_date: getTodayString(), person: '', price: '', src: '', notes: '', type_name: '', ms: '', sd: '', red: '', mbal: '', s2a: '', s2b: '', u2: '', s3a: '', s3b: '', u3: '', s4a: '', s4b: '', u4: '' });
  const [inlineForm, setInlineForm] = useState(emptyInline());
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  useEffect(() => {
    materialsApi.list('raw_material').then((mats) => {
      const found = mats.find((m) => m.name === typeName) ?? null;
      setMaterial(found);
    }).catch(() => setMaterial(null));
  }, [typeName]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { from?: string; to?: string; material_id?: number } = {};
      if (filterDate) { params.from = filterDate; params.to = filterDate; }
      if (material) params.material_id = material.id;
      const data = await rawMaterialExtApi.list(params);
      setEntries(data);
      await loadApprovals(data.map((e) => e.id));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, material, loadApprovals]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;
    const getNum = (k: string) => { const v = fd.get(k); return v !== '' && v !== null ? Number(v) : undefined; };

    const base = {
      ledger_date: get('ledger_date'),
      material_id: material?.id,
      raw_type: (isRice ? 'rice' : 'simple') as 'rice' | 'simple',
      person: get('person') || undefined,
      price: getNum('price'),
      src: get('src') || undefined,
      notes: get('notes') || undefined,
      carry_over: 0,
      received: 0,
      used: 0,
      balance: 0,
    };

    let data: Partial<RawMaterialEntryExtended>;
    if (isRice) {
      data = {
        ...base,
        s2a: get('s2a') || undefined,
        s2b: get('s2b') || undefined,
        u2: getNum('u2'),
        s3a: get('s3a') || undefined,
        s3b: get('s3b') || undefined,
        u3: getNum('u3'),
        s4a: get('s4a') || undefined,
        s4b: get('s4b') || undefined,
        u4: getNum('u4'),
      };
    } else {
      data = {
        ...base,
        type_name: get('type_name') || undefined,
        ms: getNum('ms'),
        sd: getNum('sd'),
        red: getNum('red'),
        mbal: getNum('mbal'),
      };
    }

    if (editEntry) {
      await rawMaterialExtApi.update(editEntry.id, data);
    } else {
      await rawMaterialExtApi.create(data);
    }
    setShowForm(false);
    setEditEntry(null);
    loadData();
  };

  const handleDelete = async (entry: RawMaterialEntryExtended) => {
    setDeleteConfirm(null);
    await rawMaterialExtApi.delete(entry.id);
    loadData();
  };

  const closeForm = () => { setShowForm(false); setEditEntry(null); };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isLast = false) => {
    if (e.key === 'Escape') { setInlineForm(emptyInline()); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && isLast)) { e.preventDefault(); handleInlineSave(); }
  };

  const handleInlineSave = async () => {
    if (!inlineForm.ledger_date || inlineSubmitting) return;
    setInlineSubmitting(true);
    try {
      const base = {
        ledger_date: inlineForm.ledger_date,
        material_id: material?.id,
        raw_type: (isRice ? 'rice' : 'simple') as 'rice' | 'simple',
        person: inlineForm.person || undefined,
        price: inlineForm.price !== '' ? Number(inlineForm.price) : undefined,
        src: inlineForm.src || undefined,
        notes: inlineForm.notes || undefined,
        carry_over: 0, received: 0, used: 0, balance: 0,
      };
      if (isRice) {
        await rawMaterialExtApi.create({ ...base, s2a: inlineForm.s2a || undefined, s2b: inlineForm.s2b || undefined, u2: inlineForm.u2 !== '' ? Number(inlineForm.u2) : undefined, s3a: inlineForm.s3a || undefined, s3b: inlineForm.s3b || undefined, u3: inlineForm.u3 !== '' ? Number(inlineForm.u3) : undefined, s4a: inlineForm.s4a || undefined, s4b: inlineForm.s4b || undefined, u4: inlineForm.u4 !== '' ? Number(inlineForm.u4) : undefined });
      } else {
        await rawMaterialExtApi.create({ ...base, type_name: inlineForm.type_name || typeName || undefined, ms: inlineForm.ms !== '' ? Number(inlineForm.ms) : undefined, sd: inlineForm.sd !== '' ? Number(inlineForm.sd) : undefined, red: inlineForm.red !== '' ? Number(inlineForm.red) : undefined, mbal: inlineForm.mbal !== '' ? Number(inlineForm.mbal) : undefined });
      }
      setInlineForm(emptyInline());
      loadData();
    } finally {
      setInlineSubmitting(false);
    }
  };

  const pageTitle = typeName ? `${typeName} 원료 수불` : '원료 수불';
  const subtitle = isRice ? '쌀 원료 수불 장부' : '발효제/기타 원료 수불 장부';

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title={pageTitle} subtitle={subtitle} />
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
            <ExcelToolbar ledgerType="raw_material" onUploadSuccess={loadData} filterDate={filterDate} canWrite={canWrite} />
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
                {editEntry ? `${typeName} 수정` : `${typeName} 신규 등록`}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">월일 *</label>
                    <input type="date" name="ledger_date" defaultValue={editEntry?.ledger_date ?? getTodayString()} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">담당자</label>
                    <input type="text" name="person" defaultValue={editEntry?.person ?? ''} placeholder="담당자" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">단가 (원)</label>
                    <input type="number" name="price" step="1" defaultValue={editEntry?.price ?? ''} placeholder="0" className={numInputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">출처</label>
                  <input type="text" name="src" defaultValue={editEntry?.src ?? ''} placeholder="출처" className={inputCls} />
                </div>

                {isRice ? (
                  <>
                    <FieldGroup label="입고 (1번 창고)">
                      <SubField label="시작 순호">
                        <input type="text" name="s2a" defaultValue={editEntry?.s2a ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="종료 순호">
                        <input type="text" name="s2b" defaultValue={editEntry?.s2b ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="수량 (kg)">
                        <input type="number" name="u2" step="0.001" defaultValue={editEntry?.u2 ?? ''} placeholder="0" className={numInputCls} />
                      </SubField>
                    </FieldGroup>
                    <FieldGroup label="입고 (2번 창고)">
                      <SubField label="시작 순호">
                        <input type="text" name="s3a" defaultValue={editEntry?.s3a ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="종료 순호">
                        <input type="text" name="s3b" defaultValue={editEntry?.s3b ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="수량 (kg)">
                        <input type="number" name="u3" step="0.001" defaultValue={editEntry?.u3 ?? ''} placeholder="0" className={numInputCls} />
                      </SubField>
                    </FieldGroup>
                    <FieldGroup label="사용">
                      <SubField label="시작 순호">
                        <input type="text" name="s4a" defaultValue={editEntry?.s4a ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="종료 순호">
                        <input type="text" name="s4b" defaultValue={editEntry?.s4b ?? ''} placeholder="순호" className={inputCls} />
                      </SubField>
                      <SubField label="수량 (kg)">
                        <input type="number" name="u4" step="0.001" defaultValue={editEntry?.u4 ?? ''} placeholder="0" className={numInputCls} />
                      </SubField>
                    </FieldGroup>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1">원료명</label>
                      <input type="text" name="type_name" defaultValue={editEntry?.type_name ?? typeName} placeholder={typeName} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-ink-secondary mb-1">밑술용 (kg)</label>
                        <input type="number" name="ms" step="0.001" defaultValue={editEntry?.ms ?? ''} placeholder="0" className={numInputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-secondary mb-1">술덧용 (kg)</label>
                        <input type="number" name="sd" step="0.001" defaultValue={editEntry?.sd ?? ''} placeholder="0" className={numInputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-secondary mb-1">결감 (kg)</label>
                        <input type="number" name="red" step="0.001" defaultValue={editEntry?.red ?? ''} placeholder="0" className={numInputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-secondary mb-1">잔량 (kg)</label>
                        <input type="number" name="mbal" step="0.001" defaultValue={editEntry?.mbal ?? ''} placeholder="0" className={numInputCls} />
                      </div>
                    </div>
                  </>
                )}

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
          ) : isRice ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-wood text-ink-inverse">
                    <th rowSpan={2} onClick={cycleSortDir} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none"><span className="inline-flex items-center gap-1">월일<SortIcon direction={sortDir} /></span></th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">담당자</th>
                    <th rowSpan={2} className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">단가(원)</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">출처</th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">입고 (1번창고)</th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">입고 (2번창고)</th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">사용</th>
                    <th rowSpan={2} className="px-3 py-2 text-left font-semibold border-r border-brand-koji/20">비고</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                  <tr className="bg-brand-wood/80 text-ink-inverse/80">
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">종료</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">수량(kg)</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">종료</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">수량(kg)</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">시작</th>
                    <th className="px-2 py-1 text-center border-r border-brand-koji/20">종료</th>
                    <th className="px-2 py-1 text-right border-r border-brand-koji/20">수량(kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-t-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="date" className={iCls + ' tabular-nums'} value={inlineForm.ledger_date} onChange={(e) => setInlineForm((f) => ({ ...f, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="담당자" className={iCls} value={inlineForm.person} onChange={(e) => setInlineForm((f) => ({ ...f, person: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="1" placeholder="0" className={nCls} value={inlineForm.price} onChange={(e) => setInlineForm((f) => ({ ...f, price: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="출처" className={iCls} value={inlineForm.src} onChange={(e) => setInlineForm((f) => ({ ...f, src: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="시작" className={iCls} value={inlineForm.s2a} onChange={(e) => setInlineForm((f) => ({ ...f, s2a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="종료" className={iCls} value={inlineForm.s2b} onChange={(e) => setInlineForm((f) => ({ ...f, s2b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.u2} onChange={(e) => setInlineForm((f) => ({ ...f, u2: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="시작" className={iCls} value={inlineForm.s3a} onChange={(e) => setInlineForm((f) => ({ ...f, s3a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="종료" className={iCls} value={inlineForm.s3b} onChange={(e) => setInlineForm((f) => ({ ...f, s3b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.u3} onChange={(e) => setInlineForm((f) => ({ ...f, u3: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="시작" className={iCls} value={inlineForm.s4a} onChange={(e) => setInlineForm((f) => ({ ...f, s4a: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="종료" className={iCls} value={inlineForm.s4b} onChange={(e) => setInlineForm((f) => ({ ...f, s4b: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.u4} onChange={(e) => setInlineForm((f) => ({ ...f, u4: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="비고" className={iCls} value={inlineForm.notes} onChange={(e) => setInlineForm((f) => ({ ...f, notes: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"></td>
                      <td className="px-1 py-1 text-center whitespace-nowrap">
                        <button onClick={handleInlineSave} disabled={inlineSubmitting} className="text-xs text-brand-koji hover:underline mr-1 disabled:opacity-50">저장</button>
                        <button onClick={() => setInlineForm(emptyInline())} className="text-xs text-ink-muted hover:underline">취소</button>
                      </td>
                    </tr>
                  )}
                  {sortedEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary text-center tabular-nums whitespace-nowrap">{e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.person ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.price != null ? formatNumber(e.price) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.src ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s2a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s2b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{e.u2 != null ? formatNumber(e.u2) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s3a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s3b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{e.u3 != null ? formatNumber(e.u3) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s4a ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.s4b ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-usage">{e.u4 != null ? formatNumber(e.u4) : ''}</td>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-wood text-ink-inverse">
                    <th onClick={cycleSortDir} className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap cursor-pointer select-none"><span className="inline-flex items-center gap-1">월일<SortIcon direction={sortDir} /></span></th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">담당자</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">원료명</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">단가(원)</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20">출처</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">밑술용(kg)</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">술덧용(kg)</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">결감(kg)</th>
                    <th className="px-3 py-2 text-right font-semibold border-r border-brand-koji/20 whitespace-nowrap">잔량(kg)</th>
                    <th className="px-3 py-2 text-left font-semibold border-r border-brand-koji/20">비고</th>
                    <th className="px-3 py-2 text-center font-semibold border-r border-brand-koji/20 whitespace-nowrap">승인</th>
                    {canWrite && <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-secondary">
                  {canWrite && (
                    <tr className="border-t-2 border-brand-koji/20 bg-brand-koji/5">
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="date" className={iCls + ' tabular-nums'} value={inlineForm.ledger_date} onChange={(e) => setInlineForm((f) => ({ ...f, ledger_date: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="담당자" className={iCls} value={inlineForm.person} onChange={(e) => setInlineForm((f) => ({ ...f, person: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder={typeName} className={iCls} value={inlineForm.type_name} onChange={(e) => setInlineForm((f) => ({ ...f, type_name: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="1" placeholder="0" className={nCls} value={inlineForm.price} onChange={(e) => setInlineForm((f) => ({ ...f, price: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="출처" className={iCls} value={inlineForm.src} onChange={(e) => setInlineForm((f) => ({ ...f, src: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.ms} onChange={(e) => setInlineForm((f) => ({ ...f, ms: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.sd} onChange={(e) => setInlineForm((f) => ({ ...f, sd: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.red} onChange={(e) => setInlineForm((f) => ({ ...f, red: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="number" step="0.001" placeholder="0" className={nCls} value={inlineForm.mbal} onChange={(e) => setInlineForm((f) => ({ ...f, mbal: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"><input type="text" placeholder="비고" className={iCls} value={inlineForm.notes} onChange={(e) => setInlineForm((f) => ({ ...f, notes: e.target.value }))} onKeyDown={(e) => handleInlineKeyDown(e, true)} /></td>
                      <td className="px-1 py-1 border-r border-surface-secondary"></td>
                      <td className="px-1 py-1 text-center whitespace-nowrap">
                        <button onClick={handleInlineSave} disabled={inlineSubmitting} className="text-xs text-brand-koji hover:underline mr-1 disabled:opacity-50">저장</button>
                        <button onClick={() => setInlineForm(emptyInline())} className="text-xs text-ink-muted hover:underline">취소</button>
                      </td>
                    </tr>
                  )}
                  {sortedEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-secondary/30">
                      <td className="px-3 py-2 border-r border-surface-secondary text-center tabular-nums whitespace-nowrap">{e.ledger_date}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.person ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.type_name ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums">{e.price != null ? formatNumber(e.price) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-center">{e.src ?? ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{e.ms != null ? formatNumber(e.ms) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-receipt">{e.sd != null ? formatNumber(e.sd) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums text-accent-usage">{e.red != null ? formatNumber(e.red) : ''}</td>
                      <td className="px-3 py-2 border-r border-surface-secondary text-right tabular-nums font-semibold text-brand-koji">{e.mbal != null ? formatNumber(e.mbal) : ''}</td>
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

export default function RawMaterialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-primary flex items-center justify-center text-ink-muted text-sm">불러오는 중...</div>}>
      <RawMaterialPageInner />
    </Suspense>
  );
}
