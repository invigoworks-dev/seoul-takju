-- 승인 테이블
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_type VARCHAR(50) NOT NULL
    CHECK (ledger_type IN ('raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor')),
  record_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_ledger ON approvals(ledger_type, record_id);
CREATE INDEX idx_approvals_requested_by ON approvals(requested_by);

-- 업로드 이력 테이블
CREATE TABLE IF NOT EXISTS upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_type VARCHAR(50) NOT NULL
    CHECK (ledger_type IN ('raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor')),
  filename VARCHAR(255) NOT NULL,
  rows_total INT NOT NULL DEFAULT 0,
  rows_inserted INT NOT NULL DEFAULT 0,
  rows_skipped INT NOT NULL DEFAULT 0,
  rows_failed INT NOT NULL DEFAULT 0,
  errors JSONB,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_logs_type ON upload_logs(ledger_type);
CREATE INDEX idx_upload_logs_uploaded_by ON upload_logs(uploaded_by);
