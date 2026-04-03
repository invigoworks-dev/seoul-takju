-- ============================================================
-- 누락 장부 3종 추가
-- Gap Analysis (INVA-18)에서 식별된 누락 테이블
-- ============================================================

-- 1. 술지거미 수불 (여과 후 남은 찌꺼기 재활용)
CREATE TABLE IF NOT EXISTS lees_ledger (
  id           SERIAL PRIMARY KEY,
  batch_code   VARCHAR(50),
  ledger_date  DATE NOT NULL,
  carry_over   DECIMAL(12,3) NOT NULL DEFAULT 0,
  produced     DECIMAL(12,3) NOT NULL DEFAULT 0,   -- 당일 발생량
  used         DECIMAL(12,3) NOT NULL DEFAULT 0,   -- 당일 사용량
  balance      DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + produced - used) STORED,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lees_ledger IS '술지거미 수불 장부 (여과 후 찌꺼기)';

-- 2. 1차 술덧 담금 (첫 담금 공정)
CREATE TABLE IF NOT EXISTS first_mash_ledger (
  id              SERIAL PRIMARY KEY,
  batch_code      VARCHAR(50),
  ledger_date     DATE NOT NULL,
  carry_over      DECIMAL(12,3) NOT NULL DEFAULT 0,
  starter_used    DECIMAL(12,3),   -- 밑술 사용량 (L)
  koji_used       DECIMAL(12,3),   -- 입국 사용량 (kg)
  rice_used       DECIMAL(12,3),   -- 쌀 사용량 (kg)
  water_used      DECIMAL(12,3),   -- 물 사용량 (L)
  produced        DECIMAL(12,3) NOT NULL DEFAULT 0,
  used            DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance         DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + produced - used) STORED,
  filter_date     DATE,                              -- 거름 예정일/거름일
  filtered_amount DECIMAL(12,3),                     -- 거름량
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE first_mash_ledger IS '1차 술덧 담금 장부 (첫 담금 공정)';

-- 3. 용기/마개 수불
CREATE TABLE IF NOT EXISTS container_ledger (
  id              SERIAL PRIMARY KEY,
  container_type  VARCHAR(50) NOT NULL,              -- 예: '용기', '마개', '병', '캔' 등
  ledger_date     DATE NOT NULL,
  carry_over      DECIMAL(12,3) NOT NULL DEFAULT 0,
  received        DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 입고
  used            DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 사용
  balance         DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + received - used) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (container_type, ledger_date)
);

COMMENT ON TABLE container_ledger IS '용기/마개 수불 장부';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_lees_ledger_date       ON lees_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_first_mash_ledger_date ON first_mash_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_container_ledger_date  ON container_ledger(ledger_date);

-- approvals 및 upload_logs CHECK 제약조건 확장 (새 장부 유형 포함)
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_ledger_type_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_ledger_type_check
  CHECK (ledger_type IN ('raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor', 'lees', 'first_mash', 'container'));

ALTER TABLE upload_logs DROP CONSTRAINT IF EXISTS upload_logs_ledger_type_check;
ALTER TABLE upload_logs ADD CONSTRAINT upload_logs_ledger_type_check
  CHECK (ledger_type IN ('raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor', 'lees', 'first_mash', 'container'));
