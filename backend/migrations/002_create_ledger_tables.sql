-- ============================================================
-- 6대 수불 장부 테이블
-- 공통 수불 계산식: 이월 + 당일입고(생산) − 당일사용(출고) = 잔량
-- ============================================================

-- 1. 원료수불 (쌀, 누룩 등 원자재 입출고)
CREATE TABLE IF NOT EXISTS raw_material_ledger (
  id SERIAL PRIMARY KEY,
  material_id INT NOT NULL REFERENCES materials(id),
  ledger_date DATE NOT NULL,
  carry_over DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 이월 (전일 잔량)
  received   DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 당일입고
  used       DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 당일사용
  balance    DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + received - used) STORED, -- 잔량
  supplier   VARCHAR(100),                       -- 공급업체
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, ledger_date)
);

COMMENT ON TABLE raw_material_ledger IS '원료수불 장부 (쌀, 누룩 등)';

-- 2. 발효제수불 (효모, 종국 등)
CREATE TABLE IF NOT EXISTS fermentation_agent_ledger (
  id SERIAL PRIMARY KEY,
  material_id INT NOT NULL REFERENCES materials(id),
  ledger_date DATE NOT NULL,
  carry_over  DECIMAL(12,3) NOT NULL DEFAULT 0,
  received    DECIMAL(12,3) NOT NULL DEFAULT 0,
  used        DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance     DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + received - used) STORED,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, ledger_date)
);

COMMENT ON TABLE fermentation_agent_ledger IS '발효제수불 장부 (효모, 종국 등)';

-- 3. 입국 (국/코지 제조 및 재고)
CREATE TABLE IF NOT EXISTS koji_ledger (
  id           SERIAL PRIMARY KEY,
  batch_code   VARCHAR(50),                         -- 배치 코드
  ledger_date  DATE NOT NULL,
  carry_over   DECIMAL(12,3) NOT NULL DEFAULT 0,
  produced     DECIMAL(12,3) NOT NULL DEFAULT 0,   -- 당일제조량
  used         DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance      DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + produced - used) STORED,
  rice_used    DECIMAL(12,3),                       -- 사용 쌀량 (kg)
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE koji_ledger IS '입국 장부 (국/코지 제조 및 재고)';

-- 4. 밑술 (주모/스타터 제조 및 재고)
CREATE TABLE IF NOT EXISTS starter_ledger (
  id           SERIAL PRIMARY KEY,
  batch_code   VARCHAR(50),
  ledger_date  DATE NOT NULL,
  carry_over   DECIMAL(12,3) NOT NULL DEFAULT 0,
  produced     DECIMAL(12,3) NOT NULL DEFAULT 0,
  used         DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance      DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + produced - used) STORED,
  koji_used    DECIMAL(12,3),   -- 사용 입국량 (kg)
  rice_used    DECIMAL(12,3),   -- 사용 쌀량 (kg)
  water_used   DECIMAL(12,3),   -- 사용 물량 (L)
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE starter_ledger IS '밑술 장부 (주모/스타터 제조 및 재고)';

-- 5. 술덧 (본담금 제조 및 재고)
CREATE TABLE IF NOT EXISTS mash_ledger (
  id            SERIAL PRIMARY KEY,
  batch_code    VARCHAR(50),
  ledger_date   DATE NOT NULL,
  carry_over    DECIMAL(12,3) NOT NULL DEFAULT 0,
  produced      DECIMAL(12,3) NOT NULL DEFAULT 0,
  used          DECIMAL(12,3) NOT NULL DEFAULT 0,
  balance       DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + produced - used) STORED,
  starter_used  DECIMAL(12,3),  -- 사용 밑술량 (L)
  koji_used     DECIMAL(12,3),  -- 사용 입국량 (kg)
  rice_used     DECIMAL(12,3),  -- 사용 쌀량 (kg)
  water_used    DECIMAL(12,3),  -- 사용 물량 (L)
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mash_ledger IS '술덧 장부 (본담금 제조 및 재고)';

-- 6. 주류수불 (완제품 입출고)
CREATE TABLE IF NOT EXISTS liquor_ledger (
  id           SERIAL PRIMARY KEY,
  product_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  ledger_date  DATE NOT NULL,
  carry_over   DECIMAL(12,3) NOT NULL DEFAULT 0,
  received     DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 생산/입고
  shipped      DECIMAL(12,3) NOT NULL DEFAULT 0,  -- 출고/판매
  balance      DECIMAL(12,3) GENERATED ALWAYS AS (carry_over + received - shipped) STORED,
  unit         VARCHAR(20) NOT NULL DEFAULT 'L',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_code, ledger_date)
);

COMMENT ON TABLE liquor_ledger IS '주류수불 장부 (완제품 입출고)';

-- 인덱스 (날짜 기반 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_raw_material_ledger_date   ON raw_material_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_fermentation_agent_ledger_date ON fermentation_agent_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_koji_ledger_date           ON koji_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_starter_ledger_date        ON starter_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_mash_ledger_date           ON mash_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_liquor_ledger_date         ON liquor_ledger(ledger_date);
