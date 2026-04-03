-- 원자재 및 제품 카탈로그
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (
    category IN ('raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE materials IS '원자재/제품 카탈로그 (쌀, 누룩, 효모 등)';
COMMENT ON COLUMN materials.category IS 'raw_material=원료, fermentation_agent=발효제, koji=입국, starter=밑술, mash=술덧, liquor=주류';
