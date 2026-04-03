'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/layout/Header';
import LedgerTable from './LedgerTable';
import LedgerForm from './LedgerForm';
import ExcelToolbar from './ExcelToolbar';
import { ledgerApi, materialsApi, approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { LedgerEntry, LedgerEntryInput, Material, MaterialCategory } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_PATHS } from '@/lib/types';
import { toNum, getTodayString } from '@/lib/utils';
import type { InlineRowState } from './LedgerTable';
import type { ApprovalStatus } from '@/components/ui/ApprovalBadge';

interface LedgerPageProps {
  category: MaterialCategory;
}

export default function LedgerPage({ category }: LedgerPageProps) {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<LedgerEntry | null>(null);
  const [approvalMap, setApprovalMap] = useState<Record<number, ApprovalStatus>>({});

  const emptyInlineForm = (): LedgerEntryInput => ({
    ledger_date: getTodayString(),
    material_id: undefined,
    carry_over: 0,
    received: 0,
    used: 0,
    notes: '',
  });

  const [inlineForm, setInlineForm] = useState<LedgerEntryInput>(emptyInlineForm);
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const loadApprovals = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    try {
      const data = await approvalsApi.list({
        ledger_type: category,
        record_ids: ids,
      });
      const map: Record<number, ApprovalStatus> = {};
      for (const a of data as Approval[]) {
        map[a.record_id] = a.status;
      }
      setApprovalMap(map);
    } catch {
      // non-critical
    }
  }, [category]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, materialsData] = await Promise.all([
        ledgerApi.list(category, filterDate ? { date: filterDate } : undefined),
        materialsApi.list(category),
      ]);
      setEntries(entriesData);
      setMaterials(materialsData);
      await loadApprovals(entriesData.map((e) => e.id));
    } catch {
      setEntries([]);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [category, filterDate, loadApprovals]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mapFieldsForBackend = (data: LedgerEntryInput): Record<string, unknown> => {
    const PRODUCED_CATEGORIES: MaterialCategory[] = ['koji', 'starter', 'mash'];
    const base: Record<string, unknown> = { ...data };
    if (PRODUCED_CATEGORIES.includes(category)) {
      base.produced = data.received;
      delete base.received;
    }
    return base;
  };

  const handleSubmit = async (data: LedgerEntryInput) => {
    const mapped = mapFieldsForBackend(data);
    if (editEntry) {
      await ledgerApi.update(category, editEntry.id, mapped as unknown as Partial<LedgerEntryInput>);
    } else {
      await ledgerApi.create(category, mapped as unknown as LedgerEntryInput);
    }
    await loadData();
    setShowForm(false);
    setEditEntry(null);
  };

  const handleInlineChange: InlineRowState['onChange'] = (field, value) => {
    setInlineForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInlineSubmit = async () => {
    if (!inlineForm.material_id) return;
    setInlineSubmitting(true);
    try {
      const mapped = mapFieldsForBackend(inlineForm);
      await ledgerApi.create(category, mapped as unknown as LedgerEntryInput);
      await loadData();
      setInlineForm(emptyInlineForm());
    } catch {
      // keep form data on error
    } finally {
      setInlineSubmitting(false);
    }
  };

  const handleInlineReset = () => {
    setInlineForm(emptyInlineForm());
  };

  const handleEdit = (entry: LedgerEntry) => {
    setEditEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (entry: LedgerEntry) => {
    setDeleteConfirm(null);
    await ledgerApi.delete(category, entry.id);
    await loadData();
  };

  const handleRequestApproval = async (entry: LedgerEntry) => {
    try {
      await approvalsApi.request(category, entry.id);
      setApprovalMap((prev) => ({ ...prev, [entry.id]: 'pending' }));
    } catch {
      // silently ignore
    }
  };

  const label = CATEGORY_LABELS[category];

  const filteredEntries = filterDate
    ? entries.filter((e) => e.ledger_date === filterDate)
    : entries;

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title={label} subtitle={`${label} 수불 장부 입력 및 조회`} />

      <div className="p-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-secondary font-medium">날짜</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-surface-secondary rounded px-2.5 py-1 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-[11px] text-ink-muted hover:text-ink-secondary transition-colors"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExcelToolbar
              ledgerType={CATEGORY_PATHS[category]}
              onUploadSuccess={loadData}
              filterDate={filterDate}
              canWrite={canWrite}
            />
            {canWrite && (
              <button
                onClick={() => {
                  setEditEntry(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors"
              >
                <span className="text-brand-koji">+</span>
                <span>신규 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* Form modal */}
        {showForm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-form-modal-title"
            className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-lg p-5 border border-surface-secondary">
              <h3 id="ledger-form-modal-title" className="text-sm font-bold text-ink-primary mb-3">
                {editEntry ? `${label} 수정` : `${label} 신규 등록`}
              </h3>
              <LedgerForm
                materials={materials}
                entry={editEntry}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditEntry(null);
                }}
                showPerson={category === 'fermentation_agent'}
              />
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-delete-modal-title"
            className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 text-center border border-surface-secondary">
              <p id="ledger-delete-modal-title" className="text-ink-primary mb-1 font-bold text-sm">정말 삭제하시겠습니까?</p>
              <p className="text-xs text-ink-muted mb-4">
                {deleteConfirm.material_name ?? deleteConfirm.product_name ?? deleteConfirm.batch_code} — {deleteConfirm.ledger_date}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-card rounded border border-surface-secondary overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-ink-muted text-sm animate-pulse">
              불러오는 중...
            </div>
          ) : (
            <LedgerTable
              entries={filteredEntries}
              onEdit={handleEdit}
              onDelete={(entry) => setDeleteConfirm(entry)}
              onRequestApproval={canWrite ? handleRequestApproval : undefined}
              canWrite={canWrite}
              materials={materials}
              approvalMap={approvalMap}
              inlineRow={canWrite ? {
                form: inlineForm,
                onChange: handleInlineChange,
                onSubmit: handleInlineSubmit,
                onReset: handleInlineReset,
                submitting: inlineSubmitting,
              } : undefined}
            />
          )}
        </div>

        {/* Summary row */}
        {filteredEntries.length > 0 && (
          <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 flex items-center gap-4 text-xs flex-wrap">
            <span className="text-ink-primary font-bold">총 {filteredEntries.length}건</span>
            <span className="text-ink-secondary tabular-nums">
              이월{' '}
              <strong>{filteredEntries.reduce((s, e) => s + toNum(e.carry_over), 0).toLocaleString('ko-KR')}</strong>
            </span>
            <span className="text-accent-receipt tabular-nums">
              입고{' '}
              <strong>{filteredEntries.reduce((s, e) => s + toNum(e.received ?? e.produced), 0).toLocaleString('ko-KR')}</strong>
            </span>
            <span className="text-accent-usage tabular-nums">
              사용{' '}
              <strong>{filteredEntries.reduce((s, e) => s + toNum(e.used ?? e.shipped), 0).toLocaleString('ko-KR')}</strong>
            </span>
            <span className="text-ink-primary font-bold tabular-nums">
              잔량{' '}
              <strong>{filteredEntries.reduce((s, e) => s + toNum(e.balance), 0).toLocaleString('ko-KR')}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
