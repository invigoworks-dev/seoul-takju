/**
 * 수불장부 엑셀 업로드/다운로드 API
 * POST /api/ledgers/:type/import — 엑셀 파일 업로드 → DB 저장
 * GET  /api/ledgers/:type/export — DB → 엑셀 파일 다운로드
 */
const { Router } = require('express');
const { Readable } = require('stream');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

const LEDGER_CONFIG = {
  raw_material: {
    table: 'raw_material_ledger',
    columns: ['material_id', 'ledger_date', 'carry_over', 'received', 'used', 'supplier', 'notes'],
    exportQuery: `SELECT r.id, m.code AS material_code, m.name AS material_name, m.unit,
                         r.ledger_date, r.carry_over, r.received, r.used, r.balance, r.supplier, r.notes
                  FROM raw_material_ledger r
                  JOIN materials m ON m.id = r.material_id`,
    exportHeaders: ['ID', '자재코드', '자재명', '단위', '날짜', '이월', '입고', '사용', '잔량', '공급업체', '비고'],
  },
  fermentation_agent: {
    table: 'fermentation_agent_ledger',
    columns: ['material_id', 'ledger_date', 'carry_over', 'received', 'used', 'notes'],
    exportQuery: `SELECT f.id, m.code AS material_code, m.name AS material_name, m.unit,
                         f.ledger_date, f.carry_over, f.received, f.used, f.balance, f.notes
                  FROM fermentation_agent_ledger f
                  JOIN materials m ON m.id = f.material_id`,
    exportHeaders: ['ID', '자재코드', '자재명', '단위', '날짜', '이월', '입고', '사용', '잔량', '비고'],
  },
  koji: {
    table: 'koji_ledger',
    columns: ['batch_code', 'ledger_date', 'carry_over', 'produced', 'used', 'rice_used', 'notes'],
    exportQuery: `SELECT id, batch_code, ledger_date, carry_over, produced, used, balance, rice_used, notes
                  FROM koji_ledger`,
    exportHeaders: ['ID', '배치코드', '날짜', '이월', '제조', '사용', '잔량', '사용쌀량(kg)', '비고'],
  },
  starter: {
    table: 'starter_ledger',
    columns: ['batch_code', 'ledger_date', 'carry_over', 'produced', 'used', 'koji_used', 'rice_used', 'water_used', 'notes'],
    exportQuery: `SELECT id, batch_code, ledger_date, carry_over, produced, used, balance, koji_used, rice_used, water_used, notes
                  FROM starter_ledger`,
    exportHeaders: ['ID', '배치코드', '날짜', '이월', '제조', '사용', '잔량', '입국사용(kg)', '쌀사용(kg)', '물사용(L)', '비고'],
  },
  mash: {
    table: 'mash_ledger',
    columns: ['batch_code', 'ledger_date', 'carry_over', 'produced', 'used', 'starter_used', 'koji_used', 'rice_used', 'water_used', 'notes'],
    exportQuery: `SELECT id, batch_code, ledger_date, carry_over, produced, used, balance,
                         starter_used, koji_used, rice_used, water_used, notes
                  FROM mash_ledger`,
    exportHeaders: ['ID', '배치코드', '날짜', '이월', '제조', '사용', '잔량', '밑술사용(L)', '입국사용(kg)', '쌀사용(kg)', '물사용(L)', '비고'],
  },
  liquor: {
    table: 'liquor_ledger',
    columns: ['product_code', 'product_name', 'ledger_date', 'carry_over', 'received', 'shipped', 'unit', 'notes'],
    exportQuery: `SELECT id, product_code, product_name, unit, ledger_date,
                         carry_over, received, shipped, balance, notes
                  FROM liquor_ledger`,
    exportHeaders: ['ID', '제품코드', '제품명', '단위', '날짜', '이월', '입고', '출고', '잔량', '비고'],
  },
  lees: {
    table: 'lees_ledger',
    columns: ['batch_code', 'ledger_date', 'carry_over', 'produced', 'used', 'notes'],
    exportQuery: `SELECT id, batch_code, ledger_date, carry_over, produced, used, balance, notes
                  FROM lees_ledger`,
    exportHeaders: ['ID', '배치코드', '날짜', '이월', '발생', '사용', '잔량', '비고'],
  },
  first_mash: {
    table: 'first_mash_ledger',
    columns: ['batch_code', 'ledger_date', 'carry_over', 'starter_used', 'koji_used', 'rice_used', 'water_used', 'produced', 'used', 'filter_date', 'filtered_amount', 'notes'],
    exportQuery: `SELECT id, batch_code, ledger_date, carry_over, starter_used, koji_used, rice_used, water_used,
                         produced, used, balance, filter_date, filtered_amount, notes
                  FROM first_mash_ledger`,
    exportHeaders: ['ID', '배치코드', '날짜', '이월', '밑술사용(L)', '입국사용(kg)', '쌀사용(kg)', '물사용(L)', '제조', '사용', '잔량', '거름일', '거름량', '비고'],
  },
  container: {
    table: 'container_ledger',
    columns: ['container_type', 'ledger_date', 'carry_over', 'received', 'used', 'notes'],
    exportQuery: `SELECT id, container_type, ledger_date, carry_over, received, used, balance, notes
                  FROM container_ledger`,
    exportHeaders: ['ID', '용기종류', '날짜', '이월', '입고', '사용', '잔량', '비고'],
  },
};

// POST /api/ledgers/:type/import — 엑셀 파일 업로드
router.post('/:type/import', authorize('admin', 'manager', 'operator'), upload.single('file'), async (req, res, next) => {
  try {
    const { type } = req.params;
    const config = LEDGER_CONFIG[type];
    if (!config) {
      return res.status(400).json({ error: `유효하지 않은 장부 유형: ${Object.keys(LEDGER_CONFIG).join(', ')}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: '파일이 필요합니다. (xlsx 또는 csv)' });
    }

    const workbook = new ExcelJS.Workbook();
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const stream = Readable.from(req.file.buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      return res.status(400).json({ error: '데이터가 없거나 헤더만 있는 파일입니다.' });
    }

    // Build reverse mapping: Korean name → column name
    const koreanToColumn = {};
    for (const [col, korean] of Object.entries(COLUMN_KOREAN_NAMES)) {
      koreanToColumn[korean.toLowerCase()] = col;
    }

    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
      // Strip " *" suffix from required field markers in template headers
      const raw = String(cell.value).trim().replace(/\s*\*$/, '').toLowerCase();
      // Map Korean header back to column name, or keep as-is for English headers
      headers.push(koreanToColumn[raw] || raw);
    });

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell) => { values.push(cell.value); });

      if (values.every(v => v === null || v === undefined || v === '')) continue;

      // Skip template guide/example rows (contain guide markers like "필수", "선택", "자동계산", "YYYY-MM-DD")
      const firstCellStr = String(values[0] || '');
      if (firstCellStr.includes('필수') || firstCellStr.includes('선택') || firstCellStr.includes('자동계산') || firstCellStr === 'YYYY-MM-DD') continue;

      const record = {};
      headers.forEach((h, idx) => { record[h] = values[idx]; });

      // Map columns to insert params
      const insertCols = config.columns.filter(c => record[c] !== undefined && record[c] !== null && record[c] !== '');
      if (insertCols.length === 0) {
        skipped++;
        continue;
      }

      const insertValues = insertCols.map(c => record[c]);
      const placeholders = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');

      try {
        await pool.query(
          `INSERT INTO ${config.table} (${insertCols.join(', ')}) VALUES (${placeholders})`,
          insertValues
        );
        inserted++;
      } catch (err) {
        if (err.code === '23505') {
          skipped++;
        } else {
          failed++;
          errors.push({ row: i, error: err.message });
        }
      }
    }

    // Log the upload
    await pool.query(
      `INSERT INTO upload_logs (ledger_type, filename, rows_total, rows_inserted, rows_skipped, rows_failed, errors, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [type, req.file.originalname, worksheet.rowCount - 1, inserted, skipped, failed, JSON.stringify(errors), req.user.id]
    );

    res.json({
      message: '업로드 완료',
      total: worksheet.rowCount - 1,
      inserted,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) { next(err); }
});

// GET /api/ledgers/upload-logs — 업로드 이력 조회 (must be before /:type routes)
router.get('/upload-logs', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { ledger_type } = req.query;
    const params = [];
    let where = '';
    if (ledger_type) {
      params.push(ledger_type);
      where = 'WHERE ul.ledger_type = $1';
    }
    const { rows } = await pool.query(
      `SELECT ul.*, u.name AS uploader_name
       FROM upload_logs ul
       JOIN users u ON u.id = ul.uploaded_by
       ${where}
       ORDER BY ul.created_at DESC
       LIMIT 100`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Template guide/example configuration per ledger type ---
const TEMPLATE_REQUIRED_FIELDS = {
  raw_material: ['material_id', 'ledger_date', 'received'],
  koji: ['ledger_date'],
  liquor: ['product_code', 'product_name', 'ledger_date'],
  mash: ['ledger_date'],
  starter: ['ledger_date'],
  lees: ['ledger_date'],
  first_mash: ['ledger_date'],
  fermentation_agent: ['material_id', 'ledger_date'],
  container: ['ledger_date'],
};

const TEMPLATE_GUIDE = {
  raw_material: {
    material_id: '필수 - 자재 ID (자재 목록 참조)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    received: '필수 - 숫자만 입력', used: '숫자만 입력', supplier: '선택 사항', notes: '선택 사항',
  },
  fermentation_agent: {
    material_id: '필수 - 자재 ID (자재 목록 참조)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    received: '숫자만 입력', used: '숫자만 입력', notes: '선택 사항',
  },
  koji: {
    batch_code: '선택 사항 (예: KJ-20260401)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    produced: '숫자만 입력', used: '숫자만 입력', rice_used: '숫자만 입력 (kg)', notes: '선택 사항',
  },
  starter: {
    batch_code: '선택 사항 (예: ST-20260401)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    produced: '숫자만 입력', used: '숫자만 입력', koji_used: '숫자만 입력 (kg)',
    rice_used: '숫자만 입력 (kg)', water_used: '숫자만 입력 (L)', notes: '선택 사항',
  },
  mash: {
    batch_code: '선택 사항 (예: MS-20260401)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    produced: '숫자만 입력', used: '숫자만 입력', starter_used: '숫자만 입력 (L)',
    koji_used: '숫자만 입력 (kg)', rice_used: '숫자만 입력 (kg)', water_used: '숫자만 입력 (L)', notes: '선택 사항',
  },
  liquor: {
    product_code: '필수 - 제품코드 (예: MK-001)', product_name: '필수 - 제품명', ledger_date: '필수 - YYYY-MM-DD 형식',
    carry_over: '숫자만 입력 (자동계산 가능)', received: '숫자만 입력', shipped: '숫자만 입력',
    unit: '선택 사항 (예: 병, L)', notes: '선택 사항',
  },
  lees: {
    batch_code: '선택 사항 (예: LE-20260401)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    produced: '숫자만 입력', used: '숫자만 입력', notes: '선택 사항',
  },
  first_mash: {
    batch_code: '선택 사항 (예: FM-20260401)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    starter_used: '숫자만 입력 (L)', koji_used: '숫자만 입력 (kg)', rice_used: '숫자만 입력 (kg)',
    water_used: '숫자만 입력 (L)', produced: '숫자만 입력', used: '숫자만 입력',
    filter_date: 'YYYY-MM-DD 형식 (거름 날짜)', filtered_amount: '숫자만 입력', notes: '선택 사항',
  },
  container: {
    container_type: '선택 사항 - 용기 종류 (예: 750ml 유리병)', ledger_date: '필수 - YYYY-MM-DD 형식', carry_over: '숫자만 입력 (자동계산 가능)',
    received: '숫자만 입력', used: '숫자만 입력', notes: '선택 사항',
  },
};

const TEMPLATE_EXAMPLE = {
  raw_material: {
    material_id: '1', ledger_date: '2026-04-01', carry_over: '100',
    received: '50', used: '30', supplier: '(주)곡물유통', notes: '4월 입고분',
  },
  fermentation_agent: {
    material_id: '1', ledger_date: '2026-04-01', carry_over: '20',
    received: '10', used: '5', notes: '4월분',
  },
  koji: {
    batch_code: 'KJ-20260401', ledger_date: '2026-04-01', carry_over: '50',
    produced: '30', used: '20', rice_used: '25', notes: '4월 1차',
  },
  starter: {
    batch_code: 'ST-20260401', ledger_date: '2026-04-01', carry_over: '100',
    produced: '50', used: '30', koji_used: '10', rice_used: '15', water_used: '40', notes: '4월 1차',
  },
  mash: {
    batch_code: 'MS-20260401', ledger_date: '2026-04-01', carry_over: '200',
    produced: '100', used: '80', starter_used: '30', koji_used: '15', rice_used: '25', water_used: '50', notes: '4월 1차',
  },
  liquor: {
    product_code: 'MK-001', product_name: '서울막걸리', ledger_date: '2026-04-01',
    carry_over: '500', received: '200', shipped: '150', unit: '병', notes: '4월 출고분',
  },
  lees: {
    batch_code: 'LE-20260401', ledger_date: '2026-04-01', carry_over: '30',
    produced: '15', used: '10', notes: '4월분',
  },
  first_mash: {
    batch_code: 'FM-20260401', ledger_date: '2026-04-01', carry_over: '150',
    starter_used: '30', koji_used: '10', rice_used: '20', water_used: '40',
    produced: '80', used: '60', filter_date: '2026-04-05', filtered_amount: '55', notes: '4월 1차',
  },
  container: {
    container_type: '750ml 유리병', ledger_date: '2026-04-01', carry_over: '1000',
    received: '500', used: '300', notes: '4월분',
  },
};

// 컬럼명 → 한글 헤더 매핑 (업로드 템플릿용)
const COLUMN_KOREAN_NAMES = {
  material_id: '자재ID',
  ledger_date: '날짜',
  carry_over: '이월',
  received: '입고',
  used: '사용',
  supplier: '공급업체',
  notes: '비고',
  batch_code: '배치코드',
  produced: '제조',
  rice_used: '쌀사용(kg)',
  koji_used: '입국사용(kg)',
  water_used: '물사용(L)',
  starter_used: '밑술사용(L)',
  product_code: '제품코드',
  product_name: '제품명',
  unit: '단위',
  shipped: '출고',
  filter_date: '거름일',
  filtered_amount: '거름량',
  container_type: '용기종류',
};

// GET /api/ledgers/:type/template — 가이드 행 포함 업로드용 xlsx 반환
router.get('/:type/template', async (req, res, next) => {
  try {
    const { type } = req.params;
    const config = LEDGER_CONFIG[type];
    if (!config) {
      return res.status(400).json({ error: `유효하지 않은 장부 유형: ${Object.keys(LEDGER_CONFIG).join(', ')}` });
    }

    const requiredFields = TEMPLATE_REQUIRED_FIELDS[type] || [];
    const guideMap = TEMPLATE_GUIDE[type] || {};
    const exampleMap = TEMPLATE_EXAMPLE[type] || {};

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type);

    // --- Row 1: Headers with asterisk for required fields (Korean names) ---
    const headerValues = config.columns.map(col => {
      const koreanName = COLUMN_KOREAN_NAMES[col] || col;
      return requiredFields.includes(col) ? `${koreanName} *` : koreanName;
    });
    worksheet.addRow(headerValues);

    // --- Row 2: Guide descriptions ---
    const guideValues = config.columns.map(col => {
      if (guideMap[col]) return guideMap[col];
      if (requiredFields.includes(col)) return '⬇ 필수 입력';
      return '선택 사항';
    });
    worksheet.addRow(guideValues);

    // --- Row 3: Example data ---
    const exampleValues = config.columns.map(col => exampleMap[col] || '');
    worksheet.addRow(exampleValues);

    // --- Styling ---
    const FILL_ORANGE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4C0' } };
    const FILL_GRAY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    const FILL_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };

    // Style header row (row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    config.columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.fill = requiredFields.includes(col) ? FILL_ORANGE : FILL_GRAY;
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
      };
    });

    // Style guide row (row 2)
    const guideRow = worksheet.getRow(2);
    guideRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    guideRow.alignment = { vertical: 'middle', horizontal: 'center' };
    config.columns.forEach((_, idx) => {
      guideRow.getCell(idx + 1).fill = FILL_YELLOW;
    });

    // Style example row (row 3)
    const exampleRow = worksheet.getRow(3);
    exampleRow.font = { size: 10, color: { argb: 'FFAAAAAA' } };
    exampleRow.alignment = { vertical: 'middle' };

    // Column widths
    worksheet.columns.forEach((col, idx) => {
      const headerLen = (headerValues[idx] || '').length;
      const guideLen = (guideValues[idx] || '').length;
      const exampleLen = (exampleValues[idx] || '').length;
      col.width = Math.max(14, headerLen + 4, guideLen + 2, exampleLen + 2);
    });

    const filename = `${type}_template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// GET /api/ledgers/:type/export — 엑셀 다운로드
router.get('/:type/export', async (req, res, next) => {
  try {
    const { type } = req.params;
    const config = LEDGER_CONFIG[type];
    if (!config) {
      return res.status(400).json({ error: `유효하지 않은 장부 유형: ${Object.keys(LEDGER_CONFIG).join(', ')}` });
    }

    const { from, to } = req.query;
    let query = config.exportQuery;
    const params = [];
    const conditions = [];

    if (from) { params.push(from); conditions.push(`ledger_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`ledger_date <= $${params.length}`); }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY ledger_date DESC';

    const { rows } = await pool.query(query, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type);

    worksheet.addRow(config.exportHeaders);

    // Style header row
    const headerRowObj = worksheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    for (const row of rows) {
      worksheet.addRow(Object.values(row));
    }

    // Auto-fit column widths
    worksheet.columns.forEach((col) => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 40);
      });
      col.width = maxLen + 2;
    });

    const filename = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

module.exports = router;
