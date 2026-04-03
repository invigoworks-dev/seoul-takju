'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { inviteApi } from '@/lib/api';
import type { UserRole } from '@/lib/auth';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  manager: '매니저',
  operator: '작업자',
  viewer: '열람자',
};

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: UserRole } | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyError('유효하지 않은 초대 링크입니다.');
      setVerifying(false);
      return;
    }
    (async () => {
      try {
        const info = await inviteApi.verify(token);
        setInviteInfo(info);
      } catch (err) {
        setVerifyError(
          err instanceof Error ? err.message : '초대 링크가 만료되었거나 유효하지 않습니다.'
        );
      } finally {
        setVerifying(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password !== passwordConfirm) {
      setSubmitError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      await inviteApi.accept(token, name, password);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-brand-koji tracking-tight">서울탁주</h1>
          <p className="text-xs text-ink-muted mt-1">강동연합제조장 주류 제조 관리</p>
        </div>

        <div className="bg-surface-card rounded-lg border border-surface-secondary p-5">
          {verifying ? (
            <p className="text-center text-ink-muted py-8 text-sm animate-pulse">초대 정보 확인 중...</p>
          ) : verifyError ? (
            <div className="text-center py-8">
              <p className="text-brand-clay text-sm mb-4">{verifyError}</p>
              <button
                onClick={() => router.push('/login')}
                className="text-xs text-brand-koji-muted hover:underline"
              >
                로그인 페이지로 이동
              </button>
            </div>
          ) : done ? (
            <div className="text-center py-8">
              <p className="text-accent-receipt font-bold text-sm mb-2">가입이 완료되었습니다!</p>
              <p className="text-xs text-ink-muted mb-4">
                이제 로그인하여 시스템을 사용할 수 있습니다.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-1.5 bg-brand-wood text-ink-inverse text-sm font-semibold rounded hover:bg-brand-wood-light transition-colors"
              >
                로그인
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold text-ink-primary mb-1">초대 수락</h2>
              <p className="text-xs text-ink-muted mb-4">
                <span className="font-medium text-ink-primary">{inviteInfo?.email}</span> 계정으로
                <span className="font-medium text-ink-primary">
                  {' '}{inviteInfo ? ROLE_LABELS[inviteInfo.role] : ''}
                </span>{' '}
                역할로 초대되었습니다.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">이름</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="홍길동"
                    className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="6자 이상"
                    className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">비밀번호 확인</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    placeholder="비밀번호 재입력"
                    className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-brand-clay">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name || !password}
                  className="w-full py-2 bg-brand-wood text-ink-inverse text-sm font-semibold rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors mt-1"
                >
                  {submitting ? '가입 처리 중...' : '가입 완료'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
