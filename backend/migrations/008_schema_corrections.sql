-- ============================================================
-- 스키마 보정: 사용 분리, 걸름 필드, 출고 세분화, 월말잔량
-- Gap Analysis (INVA-20) 기반
-- ============================================================

-- 1. 원료수불: 밑술용/술덧용 사용 분리 + 판매/월말잔량
ALTER TABLE raw_material_ledger
  ADD COLUMN IF NOT EXISTS used_for_starter DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_for_mash    DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold             DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS month_end_balance DECIMAL(12,3);

COMMENT ON COLUMN raw_material_ledger.used_for_starter IS '밑술 제조용 사용량';
COMMENT ON COLUMN raw_material_ledger.used_for_mash    IS '술덧 제조용 사용량';
COMMENT ON COLUMN raw_material_ledger.sold             IS '판매 수량';
COMMENT ON COLUMN raw_material_ledger.month_end_balance IS '월말 재고';

-- 2. 발효제수불: 동일 사용 분리 + 판매/월말잔량
ALTER TABLE fermentation_agent_ledger
  ADD COLUMN IF NOT EXISTS used_for_starter DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_for_mash    DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold             DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS month_end_balance DECIMAL(12,3);

-- 3. 술덧(mash_ledger): 걸름 필드 + 알코올 도수
ALTER TABLE mash_ledger
  ADD COLUMN IF NOT EXISTS filter_date      DATE,
  ADD COLUMN IF NOT EXISTS filtered_amount  DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS alcohol_pct      DECIMAL(5,2);

COMMENT ON COLUMN mash_ledger.filter_date     IS '걸름일';
COMMENT ON COLUMN mash_ledger.filtered_amount IS '걸름량';
COMMENT ON COLUMN mash_ledger.alcohol_pct     IS '알코올 도수 (%)';

-- 4. 주류수불(liquor_ledger): 출고 세분화
ALTER TABLE liquor_ledger
  ADD COLUMN IF NOT EXISTS shipped_sales DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipped_self  DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipped_other DECIMAL(12,3) DEFAULT 0;

COMMENT ON COLUMN liquor_ledger.shipped_sales IS '판매 출고';
COMMENT ON COLUMN liquor_ledger.shipped_self  IS '자가소비 출고';
COMMENT ON COLUMN liquor_ledger.shipped_other IS '기타 출고';

-- 5. 밑술(starter_ledger): 판매/월말잔량
ALTER TABLE starter_ledger
  ADD COLUMN IF NOT EXISTS sold             DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS month_end_balance DECIMAL(12,3);
