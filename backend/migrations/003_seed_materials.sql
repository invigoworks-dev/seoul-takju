-- 기본 원자재 및 발효제 시드 데이터
INSERT INTO materials (code, name, unit, category) VALUES
  -- 원료 (raw_material)
  ('RM-RICE-01',   '백미',       'kg', 'raw_material'),
  ('RM-NURUK-01',  '전통누룩',   'kg', 'raw_material'),
  ('RM-WATER-01',  '물',         'L',  'raw_material'),
  -- 발효제 (fermentation_agent)
  ('FA-YEAST-01',  '건조효모',   'g',  'fermentation_agent'),
  ('FA-JONGKUK-01','종국',       'kg', 'fermentation_agent')
ON CONFLICT (code) DO NOTHING;
