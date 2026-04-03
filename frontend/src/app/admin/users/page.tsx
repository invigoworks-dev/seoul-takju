'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import type { User, UserRole } from '@/lib/auth';
import { usersApi } from '@/lib/api';
import Header from '@/components/layout/Header';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  manager: '매니저',
  operator: '작업자',
  viewer: '열람자',
};

const STATUS_LABELS: Record<string, string> = {
  active: '활성',
  pending: '대기',
  disabled: '비활성',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('operator');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-surface-primary">
        <Header title="사용자 관리" />
        <div className="p-4">
          <p className="text-brand-clay text-sm">관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteError('');
    setInviteUrl('');
    try {
      const result = await usersApi.invite(inviteEmail, inviteRole);
      // Backend returns { invitation, invite_link }
      const fullUrl = `${window.location.origin}${result.invite_link}`;
      setInviteUrl(fullUrl);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : '초대에 실패했습니다.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await usersApi.updateRole(userId, newRole);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 변경에 실패했습니다.');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'active') {
        await usersApi.deactivate(userId);
      } else {
        await usersApi.activate(userId);
      }
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    alert('초대 링크가 복사되었습니다.');
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('operator');
    setInviteUrl('');
    setInviteError('');
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="사용자 관리" subtitle="사용자 초대, 역할 변경, 계정 관리" />

      <div className="p-4">
        {/* Actions */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-ink-primary">
            전체 사용자 ({users.length}명)
          </h3>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors"
          >
            <span className="text-brand-koji">+</span> 사용자 초대
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 p-2.5 bg-brand-clay/5 border border-brand-clay/20 text-brand-clay text-sm rounded">{error}</div>
        )}

        {/* Users Table */}
        <div className="bg-surface-card rounded border border-surface-secondary overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-secondary/50 border-b border-surface-secondary">
                <th className="text-left px-3 py-2 font-medium text-ink-secondary text-xs">이름</th>
                <th className="text-left px-3 py-2 font-medium text-ink-secondary text-xs">이메일</th>
                <th className="text-left px-3 py-2 font-medium text-ink-secondary text-xs">역할</th>
                <th className="text-left px-3 py-2 font-medium text-ink-secondary text-xs">상태</th>
                <th className="text-right px-3 py-2 font-medium text-ink-secondary text-xs">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-muted text-sm animate-pulse">
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-muted text-sm">
                    등록된 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => (
                  <tr key={u.id} className={`border-b border-surface-secondary/50 hover:bg-brand-koji/5 transition-colors ${idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/50'}`}>
                    <td className="px-3 py-2 text-ink-primary font-medium">{u.name}</td>
                    <td className="px-3 py-2 text-ink-secondary">{u.email}</td>
                    <td className="px-3 py-2">
                      {u.id === currentUser?.id ? (
                        <span className="text-ink-secondary">{ROLE_LABELS[u.role]}</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="border border-surface-secondary rounded px-2 py-0.5 text-xs bg-surface-primary text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20"
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          u.status === 'active'
                            ? 'bg-accent-receipt/10 text-accent-receipt'
                            : u.status === 'pending'
                            ? 'bg-brand-koji/15 text-brand-koji-muted'
                            : 'bg-surface-secondary text-ink-muted'
                        }`}
                      >
                        {STATUS_LABELS[u.status || 'active']}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status || 'active')}
                          className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                            u.status === 'active'
                              ? 'text-brand-clay hover:bg-brand-clay/5'
                              : 'text-accent-receipt hover:bg-accent-receipt/5'
                          }`}
                        >
                          {u.status === 'active' ? '비활성화' : '활성화'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-md p-5 border border-surface-secondary">
            <h3 className="text-sm font-bold text-ink-primary mb-3">사용자 초대</h3>

            {!inviteUrl ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">이메일</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">역할</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {inviteError && (
                  <p className="mt-2 text-sm text-brand-clay">{inviteError}</p>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={closeInviteModal}
                    className="px-3.5 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={inviteLoading || !inviteEmail}
                    className="px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors"
                  >
                    {inviteLoading ? '초대 중...' : '초대하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-secondary mb-2">
                  초대 링크가 생성되었습니다. 아래 링크를 복사하여 전달하세요.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 border border-surface-secondary rounded px-3 py-1.5 text-xs bg-surface-primary text-ink-secondary"
                  />
                  <button
                    onClick={copyInviteUrl}
                    className="px-3 py-1.5 text-xs font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors"
                  >
                    복사
                  </button>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={closeInviteModal}
                    className="px-3.5 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
