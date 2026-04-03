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

    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => { headers.push(String(cell.value).trim().toLowerCase()); });

    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell) => { values.push(cell.value); });

      if (values.every(v => v === null || v === undefined || v === '')) continue;

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

// GET /api/ledgers/:type/template — 헤더만 있는 빈 xlsx 반환
router.get('/:type/template', async (req, res, next) => {
  try {
    const { type } = req.params;
    const config = LEDGER_CONFIG[type];
    if (!config) {
      return res.status(400).json({ error: `유효하지 않은 장부 유형: ${Object.keys(LEDGER_CONFIG).join(', ')}` });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type);

    worksheet.addRow(config.exportHeaders);

    const headerRowObj = worksheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    worksheet.columns.forEach((col) => { col.width = 14; });

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
