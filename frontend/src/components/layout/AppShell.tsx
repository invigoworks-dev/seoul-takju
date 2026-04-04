'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Sidebar from './Sidebar';

const PUBLIC_PATHS = ['/login', '/register', '/invite/accept'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isPublicPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <p className="text-ink-muted">로딩 중...</p>
      </div>
    );
  }

  // Public pages: no sidebar
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Not authenticated on protected page: show nothing (redirect in progress)
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated: show top nav + sidebar + main content
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-[200px] pt-14 overflow-y-auto bg-surface-primary">
        {children}
      </main>
    </div>
  );
}
