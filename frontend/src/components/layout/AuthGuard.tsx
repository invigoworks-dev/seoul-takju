'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/register', '/invite/accept'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isPublicPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6fa]">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  // Public pages: render without sidebar
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Protected pages: redirect handled by useEffect above
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
