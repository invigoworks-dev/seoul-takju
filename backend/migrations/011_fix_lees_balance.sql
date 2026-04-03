-- ============================================================
-- lees_ledger.balance GENERATED 컬럼 수정
-- INVA-43: balance = carry_over + inc - out (레퍼런스 기준)
-- 기존: carry_over + produced - used (잘못된 참조)
-- ============================================================

-- GENERATED ALWAYS AS 컬럼은 ALTER 불가 → DROP 후 재추가
ALTER TABLE lees_ledger DROP COLUMN IF EXISTS balance;

ALTER TABLE lees_ledger
  ADD COLUMN balance DECIMAL(12,3)
    GENERATED ALWAYS AS (carry_over + COALESCE(inc, 0) - COALESCE("out", 0)) STORED;

COMMENT ON COLUMN lees_ledger.balance IS '수불 잔량 = 이월 + 발생량(inc) - 처리량(out)';
