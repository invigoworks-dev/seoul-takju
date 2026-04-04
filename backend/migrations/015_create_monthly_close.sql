-- ============================================================
-- 월마감 (Monthly Close) 테이블
-- 마감된 월의 데이터 수정/삭제를 차단
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_close (
  id         SERIAL PRIMARY KEY,
  year_month VARCHAR(7) NOT NULL,           -- 'YYYY-MM' 형식
  closed_by  UUID REFERENCES users(id),
  closed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes      TEXT,
  UNIQUE (year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_close_ym ON monthly_close(year_month);

COMMENT ON TABLE monthly_close IS '월마감: 마감된 월의 장부 데이터 수정/삭제 차단';
