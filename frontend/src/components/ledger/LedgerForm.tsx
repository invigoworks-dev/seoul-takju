'use client';

import { useState, useEffect } from 'react';
import type { LedgerEntry, LedgerEntryInput, Material } from '@/lib/types';
import { getTodayString, toNum } from '@/lib/utils';
import UserSelect from '@/components/ui/UserSelect';

interface LedgerFormProps {
  materials: Material[];
  entry?: LedgerEntry | null;
  onSubmit: (data: LedgerEntryInput) => Promise<void>;
  onCancel: () => void;
  showPerson?: boolean;
}

export default function LedgerForm({ materials, entry, onSubmit, onCancel, showPerson }: LedgerFormProps) {
  const [form, setForm] = useState<LedgerEntryInput>({
    ledger_date: entry?.ledger_date ?? getTodayString(),
    material_id: entry?.material_id ?? (materials[0]?.id ?? 0),
    carry_over: toNum(entry?.carry_over),
    received: toNum(entry?.received ?? entry?.produced),
    used: toNum(entry?.used ?? entry?.shipped),
    notes: entry?.notes ?? '',
    person: entry?.person ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setForm({
        ledger_date: entry.ledger_date,
        material_id: entry.material_id,
        carry_over: toNum(entry.carry_over),
        received: toNum(entry.received ?? entry.produced),
        used: toNum(entry.used ?? entry.shipped),
        notes: entry.notes ?? '',
        person: entry.person ?? '',
      });
    }
  }, [entry]);

  const balance = (form.carry_over || 0) + (form.received || 0) - (form.used || 0);

  const handleChange = (field: keyof LedgerEntryInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material_id) {
      setError('품목을 선택해주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">날짜 *</label>
          <input
            type="date"
            value={form.ledger_date}
            onChange={(e) => handleChange('ledger_date', e.target.value)}
            required
            className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">품목 *</label>
          <select
            value={form.material_id ?? ''}
            onChange={(e) => handleChange('material_id', Number(e.target.value))}
            required
            className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
          >
            <option value="">품목 선택</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code}) — {m.unit}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">이월</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.carry_over}
            onChange={(e) => handleChange('carry_over', Number(e.target.value))}
            className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-accent-receipt mb-1">입고</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.received}
            onChange={(e) => handleChange('received', Number(e.target.value))}
            className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-accent-usage mb-1">사용</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.used}
            onChange={(e) => handleChange('used', Number(e.target.value))}
            className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums"
          />
        </div>
      </div>

      {/* Calculated balance */}
      <div className="bg-brand-koji/10 border border-brand-koji/20 rounded px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-ink-secondary">
          잔량 = {form.carry_over} + {form.received} − {form.used}
        </span>
        <span className="text-base font-bold text-ink-primary tabular-nums">
          {balance.toLocaleString('ko-KR')}
        </span>
      </div>

      {showPerson && (
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">담당자</label>
          <UserSelect
            value={form.person ?? ''}
            onChange={(v) => handleChange('person', v)}
            placeholder="담당자 선택"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">비고</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="선택 사항"
          className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
        />
      </div>

      {error && (
        <p className="text-sm text-brand-clay bg-brand-clay/5 border border-brand-clay/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : entry ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
