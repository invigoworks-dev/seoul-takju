-- ============================================================
-- 감사 추적 (Audit Trail)
-- 모든 장부 데이터 변경 이력을 기록
-- ============================================================

CREATE TABLE IF NOT EXISTS change_log (
  id         BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id  INT NOT NULL,
  action     VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  field_name VARCHAR(100),
  old_value  TEXT,
  new_value  TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_change_log_table_record ON change_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON change_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_change_log_changed_by ON change_log(changed_by);

COMMENT ON TABLE change_log IS '감사 추적: 모든 장부 데이터 변경 이력';
