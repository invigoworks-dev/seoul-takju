// 원자재/제품 카탈로그
export type MaterialCategory =
  | 'raw_material'      // 원료
  | 'fermentation_agent' // 발효제
  | 'koji'              // 입국
  | 'starter'           // 밑술
  | 'mash'              // 술덧
  | 'liquor';           // 주류

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  raw_material: '원료수불',
  fermentation_agent: '발효제',
  koji: '입국',
  starter: '밑술',
  mash: '술덧',
  liquor: '주류수불',
};

export const CATEGORY_PATHS: Record<MaterialCategory, string> = {
  raw_material: 'raw-material',
  fermentation_agent: 'fermentation-agent',
  koji: 'koji',
  starter: 'starter',
  mash: 'mash',
  liquor: 'liquor',
};

export const PATH_TO_CATEGORY: Record<string, MaterialCategory> = {
  'raw-material': 'raw_material',
  'fermentation-agent': 'fermentation_agent',
  'koji': 'koji',
  'starter': 'starter',
  'mash': 'mash',
  'liquor': 'liquor',
};

export interface Material {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: MaterialCategory;
  created_at: string;
  updated_at: string;
}

// 수불 장부 항목 (모든 카테고리 공통 구조)
// Backend field names: ledger_date, received, used, notes
// Some ledgers use batch_code/produced instead of material_id/received
export interface LedgerEntry {
  id: number;
  ledger_date: string;    // YYYY-MM-DD
  material_id?: number;
  material_name?: string;
  material_code?: string;
  batch_code?: string;
  product_code?: string;
  product_name?: string;
  unit?: string;
  carry_over: number;     // 이월
  received?: number;      // 입고 (raw_material, fermentation_agent, liquor)
  produced?: number;      // 제조 (koji, starter, mash)
  used?: number;          // 사용
  shipped?: number;       // 출고 (liquor)
  balance: number;        // 잔량
  supplier?: string;
  notes?: string;
  person?: string;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryInput {
  ledger_date: string;
  material_id?: number;
  batch_code?: string;
  carry_over: number;
  received: number;
  used: number;
  supplier?: string;
  notes?: string;
  person?: string;
}

// 현황일보 (일일 재고 현황)
// Backend returns separate arrays per category, not a single items array
export interface DailyReportRow {
  code?: string;
  name?: string;
  unit?: string;
  batch_code?: string;
  product_code?: string;
  product_name?: string;
  container_type?: string; // container ledger
  carry_over: number;
  received?: number;      // raw_material, fermentation_agent, container
  produced?: number;      // koji, starter, mash, first_mash, lees
  used?: number;          // raw_material, fermentation_agent, koji, starter, mash, first_mash, lees, container
  shipped?: number;       // liquor
  balance: number;
}

export interface DailyReport {
  date: string;
  raw_materials: DailyReportRow[];
  fermentation_agents: DailyReportRow[];
  koji: DailyReportRow[];
  starter: DailyReportRow[];
  mash: DailyReportRow[];
  liquor: DailyReportRow[];
  first_mash: DailyReportRow[];
  lees: DailyReportRow[];
  containers: DailyReportRow[];
}

// 술지거미 수불 (lees)
export interface LeesEntry {
  id: number;
  batch_code?: string;
  ledger_date: string;
  carry_over: number;
  produced: number;
  used: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 1차 술덧 담금 (first mash)
export interface FirstMashEntry {
  id: number;
  batch_code?: string;
  ledger_date: string;
  carry_over: number;
  starter_used?: number;
  koji_used?: number;
  rice_used?: number;
  water_used?: number;
  produced: number;
  used: number;
  filter_date?: string;
  filtered_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 용기/마개 수불 (container)
export interface ContainerEntry {
  id: number;
  container_type: string; // '용기' | '마개'
  ledger_date: string;
  carry_over: number;
  received: number;
  used: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── 도메인 특화 장부 엔트리 ──────────────────────────────

// 입국 수불 (koji_ledger)
export interface KojiEntry {
  id: number;
  batch_code?: string;
  ledger_date: string;
  carry_over: number;
  produced: number;
  used: number;
  rice_used?: number;
  notes?: string;
  // 레퍼런스 추가 컬럼
  person?: string;
  ms_cnt?: number;
  sd_cnt?: number;
  ms_raw?: number;
  sd_raw?: number;
  ms_b?: string;
  ms_a?: string;
  sd_b?: string;
  sd_a?: string;
  created_at: string;
  updated_at: string;
}

// 술덧담금 및 걸름 (mash_ledger)
export interface MashEntry {
  id: number;
  batch_code?: string;
  ledger_date: string;
  carry_over: number;
  produced: number;
  used: number;
  notes?: string;
  // 레퍼런스 추가 컬럼
  bno?: string;
  rtype?: string;
  rice?: number;
  water?: number;
  yeast?: number;
  koji?: number;
  fvol?: number;
  fdate?: string;
  filt?: number;
  alc?: number;
  acid?: number;
  created_at: string;
  updated_at: string;
}

// 술지거미 수불 - 레퍼런스 추가 컬럼 포함
export interface LeesEntryExtended extends LeesEntry {
  person?: string;
  inc?: number;
  method?: string;
  out?: number;
}

// 1차 술덧 담금 - 레퍼런스 추가 컬럼 포함
export interface FirstMashEntryExtended extends FirstMashEntry {
  bno_b?: string;
  bno_a?: string;
  ctnr_no?: string;
  inc_depth?: string;
  inc_vol?: number;
  chk_date?: string;
  chk_depth?: string;
  chk_vol?: number;
  bno2_b?: string;
  bno2_a?: string;
}

// 밑술 제조 (starter_ledger)
export interface StarterEntry {
  id: number;
  batch_code?: string;
  ledger_date: string;
  carry_over: number;
  produced: number;
  used: number;
  koji_used?: number;
  rice_used?: number;
  water_used?: number;
  notes?: string;
  // 레퍼런스 추가 컬럼
  insp_date?: string;
  insp_person?: string;
  symbol?: string;
  bno_b?: string;
  bno_a?: string;
  ctnr_no?: string;
  inc_date?: string;
  inc_depth?: string;
  inc_vol?: number;
  chk_date?: string;
  chk_depth?: string;
  chk_vol?: number;
  chk_rate?: number;
  mash_bno_b?: string;
  mash_bno_a?: string;
  created_at: string;
  updated_at: string;
}

// 주류 수불 (liquor_ledger)
export interface LiquorEntry {
  id: number;
  product_code?: string;
  product_name?: string;
  ledger_date: string;
  carry_over: number;
  received: number;
  shipped: number;
  unit?: string;
  notes?: string;
  balance: number;
  // 레퍼런스 추가 컬럼
  person?: string;
  bno_b?: string;
  bno_a?: string;
  inc?: number;
  out?: number;
  price?: number;
  driver?: string;
  dest?: string;
  remain?: number;
  loss?: number;
  loss_rate?: number;
  created_at: string;
  updated_at: string;
}

// 원료 수불 (raw_material_ledger) - rice/simple 공통
export interface RawMaterialEntryExtended extends LedgerEntry {
  raw_type?: 'rice' | 'simple';
  person?: string;
  price?: number;
  src?: string;
  // rice 타입 전용
  s2a?: string;
  s2b?: string;
  u2?: number;
  s3a?: string;
  s3b?: string;
  u3?: number;
  s4a?: string;
  s4b?: string;
  u4?: number;
  // simple 타입 전용
  type_name?: string;
  ms?: number;
  sd?: number;
  red?: number;
  mbal?: number;
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
