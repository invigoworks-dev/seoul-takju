-- ============================================================
-- 설정 테이블 + 전병이월 + 재료 시드 수정 + 곡자 통합
-- INVA-44
-- ============================================================

-- -------------------------------------------------------
-- 1. materials 테이블에 is_active 컬럼 추가
-- -------------------------------------------------------
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN materials.is_active IS '활성화 여부 (false=비사용)';

-- -------------------------------------------------------
-- 2. 기존 시드 비활성화 (레퍼런스에 없는 항목)
-- -------------------------------------------------------
UPDATE materials
SET is_active = false
WHERE code IN ('RM-NURUK-01', 'RM-WATER-01', 'FA-YEAST-01', 'FA-JONGKUK-01');

-- -------------------------------------------------------
-- 3. 레퍼런스 기준 6개 재료 시드 추가/갱신
--    곡자 포함 모든 재료는 raw_material_ledger 사용
--    (raw_type: 평화미/백미 → 'rice', 나머지 → 'simple')
-- -------------------------------------------------------
INSERT INTO materials (code, name, unit, category, is_active) VALUES
  ('RM-HWAMI-01',    '평화미',   'kg', 'raw_material', true),
  ('RM-RICE-01',     '백미',     'kg', 'raw_material', true),
  ('RM-YEAST-01',    '효모',     'g',  'raw_material', true),
  ('RM-GOKJA-01',    '곡자',     'kg', 'raw_material', true),
  ('RM-ASPARTAM-01', '아스파탐', 'g',  'raw_material', true),
  ('RM-CITRIC-01',   '구연산',   'g',  'raw_material', true)
ON CONFLICT (code) DO UPDATE
  SET name      = EXCLUDED.name,
      unit      = EXCLUDED.unit,
      category  = EXCLUDED.category,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();

-- -------------------------------------------------------
-- 4. 전병이월(기초재고) 테이블 생성
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS prev_balance (
  id           SERIAL PRIMARY KEY,
  category     VARCHAR(50) NOT NULL UNIQUE,
  amount       DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance_date DATE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE prev_balance IS '전병이월(기초재고) — 각 카테고리 월초 이월 수량';
COMMENT ON COLUMN prev_balance.category     IS '재료/장부 카테고리';
COMMENT ON COLUMN prev_balance.amount       IS '이월 수량';
COMMENT ON COLUMN prev_balance.balance_date IS '기준일자';

-- 카테고리별 기본 행 삽입
INSERT INTO prev_balance (category, amount) VALUES
  ('평화미',   0),
  ('백미',     0),
  ('효모',     0),
  ('곡자',     0),
  ('아스파탐', 0),
  ('구연산',   0),
  ('주류',     0),
  ('술지거미', 0)
ON CONFLICT (category) DO NOTHING;

-- -------------------------------------------------------
-- 5. 업체정보 테이블 생성
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_info (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200),
  address    TEXT,
  phone      VARCHAR(50),
  license_no VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE company_info IS '업체(양조장) 기본 정보';

-- 기본 행 1개 삽입 (없을 때만)
INSERT INTO company_info (name, address, phone, license_no)
SELECT '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM company_info);
