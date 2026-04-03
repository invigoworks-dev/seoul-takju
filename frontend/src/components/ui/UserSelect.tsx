'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { personsApi } from '@/lib/api';

interface UserSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function UserSelect({
  value,
  onChange,
  placeholder = '담당자 선택',
  className = '',
  inputClassName,
}: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [persons, setPersons] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultInputCls =
    'w-full border border-surface-secondary rounded px-2.5 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji transition-colors cursor-pointer text-left';

  useEffect(() => {
    personsApi.list().then((ps) => setPersons(ps.map((p) => p.name))).catch(() => {});
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const filtered = persons.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase())
  );

  const select = (name: string) => {
    onChange(name);
    close();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={inputClassName ?? defaultInputCls}
      >
        {value || <span className="text-ink-muted/60">{placeholder}</span>}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-card border border-surface-secondary rounded shadow-lg">
          <div className="p-1.5 border-b border-surface-secondary">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..."
              autoFocus
              className="w-full px-2 py-1 text-sm text-ink-primary bg-surface-primary border border-surface-secondary rounded focus:outline-none focus:ring-2 focus:ring-brand-koji/20"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">등록된 담당자가 없습니다.</li>
            ) : (
              filtered.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => select(name)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-brand-koji/10 cursor-pointer transition-colors ${
                      value === name
                        ? 'font-semibold text-brand-wood bg-brand-koji/5'
                        : 'text-ink-primary'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))
            )}
          </ul>
          {value && (
            <div className="border-t border-surface-secondary p-1.5">
              <button
                type="button"
                onClick={() => select('')}
                className="w-full text-left px-3 py-1 text-xs text-ink-muted hover:text-brand-clay transition-colors"
              >
                선택 해제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
