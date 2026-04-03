'use client';

interface ColumnDef {
  name: string;
  label: string;
  description: string;
  format: string;
  unit: string;
  required: boolean;
  example: string;
}

const COLUMN_GUIDES: Record<string, { title: string; columns: ColumnDef[] }> = {
  'raw_material': {
    title: '원료수불 업로드 컬럼 안내',
    columns: [
      { name: 'material_id', label: '자재 ID', description: '자재 관리 화면에서 확인 가능한 자재 고유 번호', format: '숫자(정수)', unit: '-', required: true, example: '3' },
      { name: 'ledger_date', label: '날짜', description: '수불이 발생한 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-15' },
      { name: 'carry_over', label: '이월', description: '전일에서 이월된 잔량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '100' },
      { name: 'received', label: '입고', description: '금일 입고된 수량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '50' },
      { name: 'used', label: '사용', description: '금일 사용한 수량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '30' },
      { name: 'supplier', label: '공급업체', description: '입고 공급업체 이름', format: '텍스트', unit: '-', required: false, example: '(주)서울물산' },
      { name: 'notes', label: '비고', description: '추가 메모 및 특이사항', format: '텍스트', unit: '-', required: false, example: '긴급 입고' },
    ],
  },
  'fermentation-agent': {
    title: '발효제 업로드 컬럼 안내',
    columns: [
      { name: 'material_id', label: '자재 ID', description: '자재 관리 화면에서 확인 가능한 발효제 고유 번호', format: '숫자(정수)', unit: '-', required: true, example: '7' },
      { name: 'ledger_date', label: '날짜', description: '수불이 발생한 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-15' },
      { name: 'carry_over', label: '이월', description: '전일에서 이월된 잔량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '5' },
      { name: 'received', label: '입고', description: '금일 입고량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '10' },
      { name: 'used', label: '사용', description: '금일 사용량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '8' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'koji': {
    title: '입국 업로드 컬럼 안내',
    columns: [
      { name: 'batch_code', label: '배치코드', description: '입국 제조 배치 식별자. 연도-순번 형식 권장', format: '텍스트', unit: '-', required: true, example: 'K2024-001' },
      { name: 'ledger_date', label: '날짜', description: '입국 제조 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-15' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '0' },
      { name: 'produced', label: '제조', description: '금일 제조량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '200' },
      { name: 'used', label: '사용', description: '금일 사용량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '150' },
      { name: 'rice_used', label: '쌀사용', description: '입국 제조 시 사용한 쌀 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '200' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'starter': {
    title: '밑술 업로드 컬럼 안내',
    columns: [
      { name: 'batch_code', label: '배치코드', description: '밑술 배치 식별자. 연도-순번 형식 권장', format: '텍스트', unit: '-', required: true, example: 'S2024-001' },
      { name: 'ledger_date', label: '날짜', description: '밑술 제조 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-15' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '0' },
      { name: 'produced', label: '제조', description: '금일 제조량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '100' },
      { name: 'used', label: '사용', description: '금일 사용량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '80' },
      { name: 'koji_used', label: '입국사용', description: '밑술 제조 시 사용한 입국 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '20' },
      { name: 'rice_used', label: '쌀사용', description: '밑술 제조 시 사용한 쌀 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '50' },
      { name: 'water_used', label: '물사용', description: '밑술 제조 시 사용한 물 량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '60' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'mash': {
    title: '술덧 업로드 컬럼 안내',
    columns: [
      { name: 'batch_code', label: '배치코드', description: '술덧 배치 식별자. 연도-순번 형식 권장', format: '텍스트', unit: '-', required: true, example: 'M2024-001' },
      { name: 'ledger_date', label: '날짜', description: '술덧 제조 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-20' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '0' },
      { name: 'produced', label: '제조', description: '금일 제조량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '500' },
      { name: 'used', label: '사용', description: '금일 사용량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '200' },
      { name: 'starter_used', label: '밑술사용', description: '술덧 담금 시 사용한 밑술 량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '80' },
      { name: 'koji_used', label: '입국사용', description: '술덧 담금 시 사용한 입국 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '30' },
      { name: 'rice_used', label: '쌀사용', description: '술덧 담금 시 사용한 쌀 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '100' },
      { name: 'water_used', label: '물사용', description: '술덧 담금 시 사용한 물 량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '200' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'liquor': {
    title: '주류수불 업로드 컬럼 안내',
    columns: [
      { name: 'product_code', label: '제품코드', description: '제품 고유 코드. 영문+숫자 조합 권장', format: '텍스트', unit: '-', required: true, example: 'SJ-001' },
      { name: 'product_name', label: '제품명', description: '주류 제품 이름', format: '텍스트', unit: '-', required: true, example: '서울 탁주 생막걸리' },
      { name: 'ledger_date', label: '날짜', description: '수불 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-20' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '100' },
      { name: 'received', label: '입고', description: '금일 입고량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '500' },
      { name: 'shipped', label: '출고', description: '금일 출고량', format: '숫자(소수 허용)', unit: '자재 단위', required: true, example: '300' },
      { name: 'unit', label: '단위', description: '수량 단위 (병/캔/박스 등)', format: '텍스트', unit: '-', required: false, example: '병' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'lees': {
    title: '술지거미 업로드 컬럼 안내',
    columns: [
      { name: 'batch_code', label: '배치코드', description: '술지거미 발생 배치 식별자', format: '텍스트', unit: '-', required: true, example: 'L2024-001' },
      { name: 'ledger_date', label: '날짜', description: '수불 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-25' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '0' },
      { name: 'produced', label: '발생', description: '금일 발생량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '50' },
      { name: 'used', label: '사용', description: '금일 처리/사용량', format: '숫자(소수 허용)', unit: 'kg', required: true, example: '30' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'first_mash': {
    title: '1차 술덧 업로드 컬럼 안내',
    columns: [
      { name: 'batch_code', label: '배치코드', description: '1차 술덧 배치 식별자', format: '텍스트', unit: '-', required: true, example: 'F2024-001' },
      { name: 'ledger_date', label: '날짜', description: '담금 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-20' },
      { name: 'carry_over', label: '이월', description: '전일 이월량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '0' },
      { name: 'starter_used', label: '밑술사용', description: '담금 시 사용한 밑술 량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '50' },
      { name: 'koji_used', label: '입국사용', description: '담금 시 사용한 입국 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '20' },
      { name: 'rice_used', label: '쌀사용', description: '담금 시 사용한 쌀 량', format: '숫자(소수 허용)', unit: 'kg', required: false, example: '80' },
      { name: 'water_used', label: '물사용', description: '담금 시 사용한 물 량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '120' },
      { name: 'produced', label: '제조', description: '금일 제조량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '300' },
      { name: 'used', label: '사용', description: '금일 사용량', format: '숫자(소수 허용)', unit: 'L', required: true, example: '100' },
      { name: 'filter_date', label: '거름일', description: '거르기 작업 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: false, example: '2024-02-05' },
      { name: 'filtered_amount', label: '거름량', description: '거르기 후 수득량', format: '숫자(소수 허용)', unit: 'L', required: false, example: '250' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
  'container': {
    title: '용기/마개 업로드 컬럼 안내',
    columns: [
      { name: 'container_type', label: '용기종류', description: '용기 또는 마개의 종류명', format: '텍스트', unit: '-', required: true, example: '750mL 유리병' },
      { name: 'ledger_date', label: '날짜', description: '수불 날짜', format: '날짜(YYYY-MM-DD)', unit: '-', required: true, example: '2024-01-15' },
      { name: 'carry_over', label: '이월', description: '전일 이월 수량', format: '숫자(정수)', unit: '개', required: true, example: '200' },
      { name: 'received', label: '입고', description: '금일 입고 수량', format: '숫자(정수)', unit: '개', required: true, example: '500' },
      { name: 'used', label: '사용', description: '금일 사용 수량', format: '숫자(정수)', unit: '개', required: true, example: '300' },
      { name: 'notes', label: '비고', description: '추가 메모', format: '텍스트', unit: '-', required: false, example: '-' },
    ],
  },
};

interface ExcelColumnGuideProps {
  ledgerType: string;
  onClose: () => void;
}

export default function ExcelColumnGuide({ ledgerType, onClose }: ExcelColumnGuideProps) {
  const guide = COLUMN_GUIDES[ledgerType];
  if (!guide) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="col-guide-title"
      className="fixed inset-0 bg-brand-wood/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-card rounded-lg shadow-2xl w-full max-w-2xl border border-surface-secondary flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-secondary flex-shrink-0">
          <div>
            <h3 id="col-guide-title" className="text-sm font-bold text-ink-primary">{guide.title}</h3>
            <p className="text-[11px] text-ink-muted mt-0.5">
              업로드 파일의 헤더 행에 아래 컬럼명을 사용하세요 (영문, 소문자).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-secondary transition-colors text-lg leading-none ml-4"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-surface-secondary/80 backdrop-blur-sm">
              <tr>
                <th className="text-left px-3 py-2 text-ink-secondary font-semibold text-[11px] w-[110px]">컬럼명</th>
                <th className="text-left px-3 py-2 text-ink-secondary font-semibold text-[11px]">설명</th>
                <th className="text-left px-3 py-2 text-ink-secondary font-semibold text-[11px] w-[120px]">형식</th>
                <th className="text-center px-3 py-2 text-ink-secondary font-semibold text-[11px] w-[50px]">단위</th>
                <th className="text-center px-3 py-2 text-ink-secondary font-semibold text-[11px] w-[50px]">필수</th>
                <th className="text-left px-3 py-2 text-ink-secondary font-semibold text-[11px] w-[90px]">예시</th>
              </tr>
            </thead>
            <tbody>
              {guide.columns.map((col, idx) => (
                <tr
                  key={col.name}
                  className={idx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-primary/40'}
                >
                  <td className="px-3 py-2 font-mono text-brand-koji text-[11px] align-top whitespace-nowrap">
                    {col.name}
                    <div className="font-sans text-ink-muted text-[10px] mt-0.5 font-normal">{col.label}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-primary align-top leading-relaxed">{col.description}</td>
                  <td className="px-3 py-2 text-ink-secondary align-top">{col.format}</td>
                  <td className="px-3 py-2 text-ink-muted text-center align-top">{col.unit}</td>
                  <td className="px-3 py-2 text-center align-top">
                    <span className={col.required
                      ? 'text-brand-clay font-semibold text-[11px]'
                      : 'text-ink-muted text-[11px]'
                    }>
                      {col.required ? '필수' : '선택'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-muted text-[11px] align-top">{col.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-surface-secondary flex-shrink-0">
          <p className="text-[11px] text-ink-muted">
            * 헤더 행은 반드시 영문 소문자 컬럼명 그대로 입력하세요. 양식 다운로드 후 작성 권장.
          </p>
        </div>
      </div>
    </div>
  );
}
