'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!isLoading && isAuthenticated) {
    router.replace('/dashboard');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <p className="text-ink-muted">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-brand-koji tracking-tight">서울탁주</h1>
          <p className="text-xs text-ink-muted mt-1">강동연합제조장 주류 제조 관리</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-card rounded-lg border border-surface-secondary p-5 space-y-4"
        >
          <h2 className="text-base font-bold text-ink-primary text-center">로그인</h2>

          {error && (
            <div className="bg-brand-clay/5 border border-brand-clay/20 text-brand-clay text-sm rounded px-3 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-ink-secondary mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-surface-secondary rounded text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
              placeholder="example@seoultak.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-ink-secondary mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-surface-secondary rounded text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
              placeholder="비밀번호 입력"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-brand-wood text-ink-inverse text-sm font-semibold rounded hover:bg-brand-wood-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>

          <p className="text-center text-xs text-ink-muted">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-brand-koji-muted font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
