/**
 * 설정 API
 * - 업체정보: GET/PUT /api/settings/company
 * - 전병이월: GET /api/settings/prev-balance, PUT /api/settings/prev-balance/:category
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// -------------------------------------------------------
// 업체정보
// -------------------------------------------------------

// GET /api/settings/company
router.get('/company', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM company_info ORDER BY id LIMIT 1');
    if (!rows.length) return res.status(404).json({ error: '업체정보가 없습니다.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/company
router.put('/company', async (req, res, next) => {
  try {
    const { name, address, phone, license_no } = req.body;

    const existing = await pool.query('SELECT id FROM company_info ORDER BY id LIMIT 1');
    if (!existing.rows.length) {
      const { rows } = await pool.query(
        `INSERT INTO company_info (name, address, phone, license_no)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name ?? '', address ?? '', phone ?? '', license_no ?? '']
      );
      return res.json(rows[0]);
    }

    const id = existing.rows[0].id;
    const cur = (await pool.query('SELECT * FROM company_info WHERE id=$1', [id])).rows[0];
    const { rows } = await pool.query(
      `UPDATE company_info
       SET name=$1, address=$2, phone=$3, license_no=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [
        name       ?? cur.name,
        address    ?? cur.address,
        phone      ?? cur.phone,
        license_no ?? cur.license_no,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// 전병이월(기초재고)
// -------------------------------------------------------

// GET /api/settings/prev-balance
router.get('/prev-balance', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM prev_balance ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/prev-balance/:category
router.put('/prev-balance/:category', async (req, res, next) => {
  try {
    const { category } = req.params;
    const { amount, balance_date } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const existing = await pool.query(
      'SELECT id FROM prev_balance WHERE category=$1',
      [category]
    );

    if (!existing.rows.length) {
      const { rows } = await pool.query(
        `INSERT INTO prev_balance (category, amount, balance_date)
         VALUES ($1, $2, $3) RETURNING *`,
        [category, amount, balance_date ?? null]
      );
      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `UPDATE prev_balance
       SET amount=$1, balance_date=$2, updated_at=NOW()
       WHERE category=$3 RETURNING *`,
      [amount, balance_date ?? null, category]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// 담당자 관리
// -------------------------------------------------------

// GET /api/settings/persons
router.get('/persons', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM persons ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/persons
router.post('/persons', async (req, res, next) => {
  try {
    const { name, role } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `INSERT INTO persons (name, role) VALUES ($1, $2) RETURNING *`,
      [name, role ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/persons/:id
router.delete('/persons/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM persons WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// 데이터 관리
// -------------------------------------------------------

const LEDGER_TABLES = [
  'raw_material_ledger',
  'fermentation_agent_ledger',
  'koji_ledger',
  'starter_ledger',
  'mash_ledger',
  'liquor_ledger',
  'lees_ledger',
  'first_mash_ledger',
  'container_ledger',
];

// GET /api/settings/data/export — 전체 데이터 JSON 내보내기
router.get('/data/export', async (req, res, next) => {
  try {
    const data = {};
    for (const table of LEDGER_TABLES) {
      const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ledger_date, id`);
      data[table] = rows;
    }
    // 기초재고, 업체정보도 포함
    const { rows: prevBalance } = await pool.query('SELECT * FROM prev_balance ORDER BY id');
    data.prev_balance = prevBalance;
    const { rows: company } = await pool.query('SELECT * FROM company_info ORDER BY id LIMIT 1');
    data.company_info = company;
    const { rows: persons } = await pool.query('SELECT * FROM persons ORDER BY id');
    data.persons = persons;

    res.setHeader('Content-Disposition', `attachment; filename=seoultak-data-${new Date().toISOString().slice(0,10)}.json`);
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/settings/data/reset — 전체 데이터 초기화 (admin only)
const authorize = require('../middleware/authorize');
router.delete('/data/reset', authorize(['admin']), async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 감사 로그에 기록
      await client.query(
        `INSERT INTO change_log (table_name, record_id, action, field_name, new_value, changed_by)
         VALUES ('_system', 0, 'DELETE', 'full_reset', 'all ledger data cleared', $1)`,
        [req.user?.id || null]
      );
      // 승인, 업로드 로그 삭제
      await client.query('DELETE FROM approvals');
      await client.query('DELETE FROM upload_logs');
      // 모든 장부 데이터 삭제
      for (const table of LEDGER_TABLES) {
        await client.query(`DELETE FROM ${table}`);
      }
      await client.query('COMMIT');
      res.json({ message: '모든 장부 데이터가 초기화되었습니다.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

module.exports = router;
