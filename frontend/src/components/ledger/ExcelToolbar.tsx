'use client';

import { useState, useRef } from 'react';
import { excelApi } from '@/lib/api';
import { authHeaders } from '@/lib/auth';

interface ToastState {
  message: string;
  type: 'success' | 'partial' | 'error';
}

interface ExcelToolbarProps {
  ledgerType: string;
  onUploadSuccess: () => void;
  filterDate?: string;
  canWrite?: boolean;
}

export default function ExcelToolbar({
  ledgerType,
  onUploadSuccess,
  filterDate,
  canWrite = false,
}: ExcelToolbarProps) {
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (t: ToastState) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await excelApi.import(ledgerType, file);
      if (result.failed > 0 && result.inserted === 0) {
        showToast({ message: result.message || `${result.failed}건 실패`, type: 'error' });
      } else if (result.failed > 0) {
        showToast({ message: `${result.inserted}건 등록, ${result.failed}건 실패`, type: 'partial' });
      } else {
        showToast({ message: `${result.inserted}건 등록됨`, type: 'success' });
      }
      onUploadSuccess();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : '업로드 실패', type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    const url = excelApi.exportUrl(ledgerType, filterDate || undefined, filterDate || undefined);
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ledgerType}_${filterDate || new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleTemplate = async () => {
    const url = `/api/ledgers/${ledgerType}/template`;
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ledgerType}_양식.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const btnCls =
    'flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors';

  return (
    <>
      {canWrite && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`${btnCls} disabled:opacity-50`}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 10V3M5 6l3-3 3 3M3 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
            </svg>
            {uploading ? '업로드 중...' : '엑셀 업로드'}
          </button>
        </>
      )}

      <button onClick={handleExport} className={btnCls}>
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3v7M5 8l3 3 3-3M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
        </svg>
        엑셀 다운로드
      </button>

      <button onClick={handleTemplate} className={`${btnCls} text-ink-muted`}>
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="2" width="10" height="12" rx="1" />
          <path d="M6 6h4M6 9h4M6 12h2" />
        </svg>
        양식 다운로드
      </button>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-[100] max-w-sm px-4 py-3 rounded shadow-lg border flex items-center justify-between gap-3 text-sm ${
            toast.type === 'success'
              ? 'bg-accent-receipt/10 border-accent-receipt/20 text-accent-receipt'
              : 'bg-brand-clay/10 border-brand-clay/20 text-brand-clay'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-ink-muted hover:text-ink-secondary transition-colors flex-shrink-0">✕</button>
        </div>
      )}
    </>
  );
}
