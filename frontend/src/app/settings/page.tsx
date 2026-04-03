'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { settingsApi, personsApi, type CompanyInfo, type PrevBalance, type Person } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// 전병이월 카테고리 (기초재고 대상)
const PREV_BALANCE_CATEGORIES = [
  { key: '평화미',  label: '평화미',  unit: 'kg' },
  { key: '백미',    label: '백미',    unit: 'kg' },
  { key: '효모',    label: '효모',    unit: 'g'  },
  { key: '곡자',    label: '곡자',    unit: 'kg' },
  { key: '아스파탐',label: '아스파탐',unit: 'g'  },
  { key: '구연산',  label: '구연산',  unit: 'g'  },
  { key: '주류',    label: '주류',    unit: 'L'  },
  { key: '술지거미',label: '술지거미',unit: 'kg' },
  { key: '용기',    label: '용기',    unit: '개' },
  { key: '마개',    label: '마개',    unit: '개' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-lg border border-surface-secondary overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-surface-secondary/40 border-b border-surface-secondary">
        <h3 className="text-xs font-bold text-brand-wood tracking-wide uppercase">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-brand-wood/60 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, readOnly }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      className={cn(
        'border border-surface-secondary rounded px-2.5 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji transition-colors',
        readOnly && 'bg-surface-secondary/50 text-ink-muted cursor-default'
      )}
    />
  );
}

function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-surface-secondary rounded px-2.5 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji tabular-nums text-right w-full"
    />
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Company info state ──────────────────────────────
  const [company, setCompany] = useState<CompanyInfo>({ name: '', address: '', phone: '', license_no: '' });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState('');

  // ── Prev balance state ──────────────────────────────
  const [prevBalances, setPrevBalances] = useState<Record<string, string>>({});
  const [prevDate, setPrevDate] = useState('');
  const [prevSaving, setPrevSaving] = useState(false);
  const [prevMsg, setPrevMsg] = useState('');

  // ── Persons state ───────────────────────────────────
  const [persons, setPersons] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [personsSaving, setPersonsSaving] = useState(false);
  const [personsMsg, setPersonsMsg] = useState('');

  // ── Reset modal state ───────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [co, prevArr, personsArr] = await Promise.all([
        settingsApi.getCompany().catch(() => null),
        settingsApi.getPrevBalance().catch(() => [] as PrevBalance[]),
        personsApi.list().catch(() => [] as Person[]),
      ]);
      if (co) setCompany(co);
      const balMap: Record<string, string> = {};
      let sharedDate = '';
      for (const pb of prevArr) {
        balMap[pb.category] = String(pb.amount ?? 0);
        if (pb.balance_date && !sharedDate) sharedDate = pb.balance_date;
      }
      setPrevBalances(balMap);
      if (sharedDate) setPrevDate(sharedDate);
      setPersons(personsArr);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveCompany = async () => {
    setCompanySaving(true);
    setCompanyMsg('');
    try {
      await settingsApi.putCompany(company);
      setCompanyMsg('저장되었습니다.');
    } catch (err) {
      setCompanyMsg(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setCompanySaving(false);
      setTimeout(() => setCompanyMsg(''), 3000);
    }
  };

  const savePrevBalance = async () => {
    setPrevSaving(true);
    setPrevMsg('');
    try {
      await Promise.all(
        PREV_BALANCE_CATEGORIES.map(({ key }) =>
          settingsApi.putPrevBalance(key, parseFloat(prevBalances[key] || '0') || 0, prevDate || undefined)
        )
      );
      setPrevMsg('저장되었습니다.');
    } catch (err) {
      setPrevMsg(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setPrevSaving(false);
      setTimeout(() => setPrevMsg(''), 3000);
    }
  };

  const addPerson = async () => {
    const name = newPersonName.trim();
    if (!name) return;
    setPersonsSaving(true);
    setPersonsMsg('');
    try {
      const p = await personsApi.create(name);
      setPersons((prev) => [...prev, p]);
      setNewPersonName('');
    } catch (err) {
      setPersonsMsg(err instanceof Error ? err.message : '추가 실패');
    } finally {
      setPersonsSaving(false);
      if (personsMsg) setTimeout(() => setPersonsMsg(''), 3000);
    }
  };

  const deletePerson = async (id: number) => {
    try {
      await personsApi.delete(id);
      setPersons((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setPersonsMsg(err instanceof Error ? err.message : '삭제 실패');
      setTimeout(() => setPersonsMsg(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <Header title="설정" subtitle="업체 정보, 기초 재고, 사용자 관리" />

      <div className="p-4 max-w-2xl">

        {/* ① 업체 정보 */}
        <SectionCard title="업체 정보">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FieldGroup label="업체명">
              <TextInput
                value={company.name}
                onChange={(v) => setCompany({ ...company, name: v })}
                placeholder="서울탁주"
              />
            </FieldGroup>
            <FieldGroup label="면허번호">
              <TextInput
                value={company.license_no}
                onChange={(v) => setCompany({ ...company, license_no: v })}
                placeholder="주류 면허번호"
              />
            </FieldGroup>
            <FieldGroup label="주소">
              <TextInput
                value={company.address}
                onChange={(v) => setCompany({ ...company, address: v })}
                placeholder="사업장 주소"
              />
            </FieldGroup>
            <FieldGroup label="전화번호">
              <TextInput
                value={company.phone}
                onChange={(v) => setCompany({ ...company, phone: v })}
                placeholder="02-0000-0000"
              />
            </FieldGroup>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveCompany}
              disabled={companySaving}
              className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors"
            >
              {companySaving ? '저장 중…' : '저장'}
            </button>
            {companyMsg && (
              <span className={cn('text-xs', companyMsg.includes('실패') ? 'text-brand-clay' : 'text-accent-receipt')}>
                {companyMsg}
              </span>
            )}
          </div>
        </SectionCard>

        {/* ② 전병이월 (기초 재고) */}
        <SectionCard title="전병이월 (기초 재고)">
          <div className="mb-3 max-w-[220px]">
            <FieldGroup label="기초재고 기준일자">
              <input
                type="date"
                value={prevDate}
                onChange={(e) => setPrevDate(e.target.value)}
                className="border border-surface-secondary rounded px-2.5 py-1.5 text-sm text-ink-primary bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand-koji/20 focus:border-brand-koji"
              />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {PREV_BALANCE_CATEGORIES.map(({ key, label, unit }) => (
              <FieldGroup key={key} label={`${label} (${unit})`}>
                <NumInput
                  value={prevBalances[key] ?? '0'}
                  onChange={(v) => setPrevBalances((prev) => ({ ...prev, [key]: v }))}
                />
              </FieldGroup>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={savePrevBalance}
              disabled={prevSaving}
              className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors"
            >
              {prevSaving ? '저장 중…' : '저장'}
            </button>
            {prevMsg && (
              <span className={cn('text-xs', prevMsg.includes('실패') ? 'text-brand-clay' : 'text-accent-receipt')}>
                {prevMsg}
              </span>
            )}
          </div>
        </SectionCard>

        {/* ③ 담당자 관리 */}
        <SectionCard title="담당자 관리">
          <div className="flex items-center gap-2 mb-3">
            <TextInput
              value={newPersonName}
              onChange={(v) => setNewPersonName(v)}
              placeholder="담당자 이름"
            />
            <button
              onClick={addPerson}
              disabled={personsSaving || !newPersonName.trim()}
              className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {personsSaving ? '추가 중…' : '추가'}
            </button>
          </div>
          {personsMsg && (
            <p className={cn('text-xs mb-2', personsMsg.includes('실패') ? 'text-brand-clay' : 'text-accent-receipt')}>
              {personsMsg}
            </p>
          )}
          {persons.length === 0 ? (
            <p className="text-sm text-ink-muted">등록된 담당자가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-surface-secondary/50">
              {persons.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-ink-primary">{p.name}</span>
                  <button
                    onClick={() => deletePerson(p.id)}
                    className="text-[11px] text-ink-muted hover:text-brand-clay transition-colors"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ④ 사용자 관리 */}
        <SectionCard title="사용자 관리 (담당자)">
          {isAdmin ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-secondary">
                사용자 초대, 역할 변경, 계정 활성화/비활성화를 관리합니다.
              </p>
              <Link
                href="/admin/users"
                className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-wood rounded hover:bg-brand-wood-light transition-colors whitespace-nowrap ml-4"
              >
                사용자 관리 →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">관리자만 접근할 수 있습니다.</p>
          )}
        </SectionCard>

        {/* ⑤ 데이터 관리 */}
        {isAdmin && (
          <div className="bg-brand-clay/5 rounded-lg border border-brand-clay/20 overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-brand-clay/10 border-b border-brand-clay/20">
              <h3 className="text-xs font-bold text-brand-clay uppercase tracking-wide">데이터 관리</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-brand-clay mb-3">
                전체 초기화 시 모든 수불 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <button
                onClick={() => setShowResetModal(true)}
                className="px-4 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light transition-colors"
              >
                전체 초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 bg-brand-wood/60 flex items-center justify-center z-50"
        >
          <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-sm p-5 border border-brand-clay/20">
            <h3 id="reset-modal-title" className="text-sm font-bold text-brand-clay mb-2">전체 초기화 확인</h3>
            <p className="text-xs text-ink-secondary mb-3">
              모든 수불 데이터가 삭제됩니다. 계속하려면 아래에{' '}
              <strong className="text-ink-primary">초기화</strong>를 입력하세요.
            </p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="초기화"
              className="w-full border border-surface-secondary rounded px-3 py-1.5 text-sm text-ink-primary mb-3 focus:outline-none focus:ring-2 focus:ring-brand-clay/30"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
                className="px-3.5 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors"
              >
                취소
              </button>
              <button
                disabled={resetConfirmText !== '초기화'}
                onClick={() => {
                  alert('현재 API가 지원되지 않습니다. 데이터베이스를 직접 초기화해 주세요.');
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                className="px-3.5 py-1.5 text-sm font-semibold text-ink-inverse bg-brand-clay rounded hover:bg-brand-clay-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
