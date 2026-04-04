'use client';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  companyName?: string;
}

export default function PrintHeader({ title, subtitle, period, companyName = '서울탁주 강동연합제조장' }: PrintHeaderProps) {
  return (
    <>
      {/* Print-only header */}
      <div className="print-only print-header">
        <div className="doc-info">
          <div className="company-name">{companyName}</div>
          {subtitle && <div>{subtitle}</div>}
        </div>
        <div className="doc-title">{title}</div>
        <div className="doc-info">
          {period && <div>기간: {period}</div>}
          <div>출력일: {new Date().toLocaleDateString('ko-KR')}</div>
        </div>
      </div>

      {/* Print-only footer with signature boxes */}
      <div className="print-only print-footer" style={{ position: 'fixed', bottom: '12mm', right: '10mm' }}>
        <div className="sign-box">
          <div className="sign-label">작성</div>
        </div>
        <div className="sign-box">
          <div className="sign-label">확인</div>
        </div>
        <div className="sign-box">
          <div className="sign-label">승인</div>
        </div>
      </div>
    </>
  );
}

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={className || 'no-print flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-secondary border border-surface-secondary rounded hover:bg-surface-secondary/50 transition-colors'}
      title="인쇄"
    >
      <span>🖨</span>
      <span>인쇄</span>
    </button>
  );
}
