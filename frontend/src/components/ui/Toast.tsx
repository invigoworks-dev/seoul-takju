'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-200',
              t.type === 'success' && 'bg-green-800 text-green-100',
              t.type === 'error' && 'bg-red-800 text-red-100',
              t.type === 'info' && 'bg-brand-wood text-ink-inverse',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
                aria-label="닫기"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
