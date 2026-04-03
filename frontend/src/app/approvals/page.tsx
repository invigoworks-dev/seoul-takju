'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { approvalsApi } from '@/lib/api';
import type { Approval } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, cn } from '@/lib/utils';

const LEDGER_LABELS: Record<string, string> = {
  raw_material: '원료수불',
  fermentation_agent: '발효제',
  koji: '입국',
  starter: '밑술',
  mash: '술덧',
  liquor: '주류수불',
  lees: '술지거미',
  first_mash: '1차 술덧',
  container: '용기/마개',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-brand-koji/15 text-brand-koji' },
  approved: { label: '승인', color: 'bg-accent-receipt/15 text-accent-receipt' },
  rejected: { label: '반려', color: 'bg-brand-clay/15 text-brand-clay' },
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 일괄선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await approvalsApi.list(statusFilter ? { status: statusFilter } : undefined);
      setApprovals(data);
      setSelectedIds(new Set());
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleApprove = async (id: number) => {
    await approvalsApi.approve(id);
    await loadApprovals();
  };

  const handleReject = async () => {
    if (rejectId === null) return;
    await approvalsApi.reject(rejectId, rejectReason);
    setRejectId(null);
    setRejectReason('');
    await loadApprovals();
  };

  // 일괄 처리
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const selectedPendingIds = Array.from(selectedIds).filter((id) =>
    pendingApprovals.some((a) => a.id === id)
  );

  const allPendingSelected =
    pendingApprovals.length > 0 &&
    pendingApprovals.every((a) => selectedIds.has(a.id));

  const toggleAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApprovals.map((a) => a.id)));
    }
  };

  const toggleItem = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedPendingIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(selectedPendingIds.map((id) => approvalsApi.approve(id)));
      await loadApprovals();
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedPendingIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(
        selectedPendingIds.map((id) => approvalsApi.reject(id, bulkRejectReason))
      );
      setShowBulkRejectModal(false);
      setBulkRejectReason('');
      await loadApprovals();
    } finally {
      setBulkProcessing(false);
    }
  };

  const canApprove = user?.role === 'admin' || user?.role === 'manager';
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header
        title="승인 관리"
        subtitle={pendingCount > 0 ? `대기 ${pendingCount}건` : '승인 요청 관리'}
      />

      <div className="p-4 space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-secondary font-medium">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-surface-secondary rounded px-2.5 py-1 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20"
            >
              <option value="">전체</option>
              <option value="pending">대기</option>
              <option value="approved">승인</option>
              <option value="rejected">반려</option>
            </select>
          </div>
        </div>

        {/* Bulk action bar */}
        {canApprove && selectedPendingIds.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 bg-brand-koji/8 border border-brand-koji/20 rounded text-sm">
            <span className="text-ink-secondary text-xs font-medium">
              {selectedPendingIds.length}건 선택됨
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="px-3 py-1 text-xs font-semibold text-accent-receipt border border-accent-receipt/30 rounded hover:bg-accent-receipt/10 transition-colors disabled:opacity-50"
              >
                일괄 승인
              </button>
              <button
                onClick={() => setShowBulkRejectModal(true)}
                disabled={bulkProcessing}
                className="px-3 py-1 text-xs font-semibold text-brand-clay border border-brand-clay/30 rounded hover:bg-brand-clay/10 transition-colors disabled:opacity-50"
              >
                일괄 반려
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-card rounded border border-surface-secondary overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-ink-muted text-sm animate-pulse">
              불러오는 중...
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-10 text-ink-muted text-sm">
              승인 요청이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-surface-secondary/50 border-b border-surface-secondary">
                    {canApprove && (
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleAll}
                          disabled={pendingApprovals.length === 0}
                          className="w-3.5 h-3.5 accent-brand-koji cursor-pointer disabled:cursor-default"
                          title="대기 항목 전체 선택"
                        />
                      </th>
                    )}
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">상태</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">장부</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">레코드 ID</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">요청자</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">요청일</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">승인자</th>
                    <th className="text-left px-3 py-2 text-ink-secondary font-medium text-xs">사유</th>
                    {canApprove && (
                      <th className="text-center px-3 py-2 text-ink-secondary font-medium text-xs">작업</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a, idx) => {
                    const statusInfo = STATUS_LABELS[a.status] ?? { label: a.status, color: '' };
                    const isPending = a.status === 'pending';
                    const isSelected = selectedIds.has(a.id);
                    return (
                      <tr
                        key={a.id}
                        className={cn(
                          'border-b border-surface-secondary/50 last:border-b-0',
                          isSelected
                            ? 'bg-brand-koji/5'
                            : idx % 2 === 0
                            ? 'bg-surface-card'
                            : 'bg-surface-primary/50'
                        )}
                      >
                        {canApprove && (
                          <td className="px-3 py-2 w-8">
                            {isPending ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(a.id)}
                                className="w-3.5 h-3.5 accent-brand-koji cursor-pointer"
                              />
                            ) : (
                              <span className="block w-3.5 h-3.5" />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink-primary">{LEDGER_LABELS[a.ledger_type] ?? a.ledger_type}</td>
                        <td className="px-3 py-2 text-ink-muted tabular-nums">#{a.record_id}</td>
                        <td className="px-3 py-2 text-ink-primary">{a.requester_name}</td>
                        <td className="px-3 py-2 text-ink-muted tabular-nums">{formatDate(a.created_at)}</td>
                        <td className="px-3 py-2 text-ink-muted">{a.approver_name ?? '-'}</td>
                        <td className="px-3 py-2 text-ink-muted text-xs max-w-[200px] truncate">{a.reason ?? '-'}</td>
                        {canApprove && (
                          <td className="px-3 py-2 text-center">
                            {isPending && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleApprove(a.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-accent-receipt border border-accent-receipt/30 rounded hover:bg-accent-receipt/10 transition-colors"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => setRejectId(a.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-brand-clay border border-brand-clay/30 rounded hover:bg-brand-clay/10 transition-colors"
                                >
                                  반려
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Single reject modal */}
        {rejectId !== null && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 border border-surface-secondary">
              <h3 className="text-sm font-bold text-ink-primary mb-3">반려 사유 입력</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요..."
                className="w-full border border-surface-secondary rounded px-3 py-2 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20 mb-3 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setRejectId(null); setRejectReason(''); }}
                  className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light transition-colors"
                >
                  반려
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk reject modal */}
        {showBulkRejectModal && (
          <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 border border-surface-secondary">
              <h3 className="text-sm font-bold text-ink-primary mb-1">일괄 반려</h3>
              <p className="text-xs text-ink-muted mb-3">
                선택된 {selectedPendingIds.length}건을 반려합니다.
              </p>
              <textarea
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요..."
                className="w-full border border-surface-secondary rounded px-3 py-2 text-sm text-ink-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-koji/20 mb-3 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowBulkRejectModal(false); setBulkRejectReason(''); }}
                  disabled={bulkProcessing}
                  className="px-4 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={bulkProcessing}
                  className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light transition-colors disabled:opacity-50"
                >
                  {bulkProcessing ? '처리 중...' : '반려'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
