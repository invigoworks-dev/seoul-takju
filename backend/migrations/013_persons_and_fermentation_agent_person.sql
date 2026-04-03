-- 담당자 테이블
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 발효제수불 장부에 담당자 컬럼 추가
ALTER TABLE fermentation_agent_ledger
  ADD COLUMN IF NOT EXISTS person VARCHAR(100);
