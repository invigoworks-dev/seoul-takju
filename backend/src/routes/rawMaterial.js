/**
 * 원료수불 장부 (쌀, 누룩 등)
 * 수불 계산: 이월 + 입고 − 사용 = 잔량
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver } = require('../carryOver');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/raw-material?from=&to=&material_id=
router.get('/', async (req, res, next) => {
  try {
    const { from, to, material_id } = req.query;
    const params = [];
    const conditions = [];

    if (from) { params.push(from); conditions.push(`r.ledger_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`r.ledger_date <= $${params.length}`); }
    if (material_id) { params.push(material_id); conditions.push(`r.material_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT r.*, m.code AS material_code, m.name AS material_name, m.unit
       FROM raw_material_ledger r
       JOIN materials m ON m.id = r.material_id
       ${where}
       ORDER BY r.ledger_date DESC, m.code`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/raw-material/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, m.code AS material_code, m.name AS material_name, m.unit
       FROM raw_material_ledger r
       JOIN materials m ON m.id = r.material_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/raw-material
router.post('/', async (req, res, next) => {
  try {
    const {
      material_id, ledger_date,
      received = 0, used = 0,
      used_for_starter = 0, used_for_mash = 0, sold = 0,
      supplier, notes,
      raw_type = 'simple', person, price, src,
      s2a, s2b, u2, s3a, s3b, u3, s4a, s4b, u4,
      type_name, ms, sd, red, mbal
    } = req.body;
    if (!material_id || !ledger_date) {
      return res.status(400).json({ error: 'material_id and ledger_date are required' });
    }
    const carry_over = await resolveCarryOver(req.body.carry_over, 'raw_material_ledger', 'material_id', material_id, ledger_date);
    const { rows } = await pool.query(
      `INSERT INTO raw_material_ledger
         (material_id, ledger_date, carry_over, received, used,
          used_for_starter, used_for_mash, sold, supplier, notes,
          raw_type, person, price, src,
          s2a, s2b, u2, s3a, s3b, u3, s4a, s4b, u4,
          type_name, ms, sd, red, mbal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
       RETURNING *`,
      [material_id, ledger_date, carry_over, received, used,
       used_for_starter, used_for_mash, sold, supplier, notes,
       raw_type, person, price, src,
       s2a, s2b, u2, s3a, s3b, u3, s4a, s4b, u4,
       type_name, ms, sd, red, mbal]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/raw-material/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM raw_material_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    const carry_over      = req.body.carry_over      ?? cur.carry_over;
    const received        = req.body.received        ?? cur.received;
    const used            = req.body.used            ?? cur.used;
    const used_for_starter= req.body.used_for_starter?? cur.used_for_starter;
    const used_for_mash   = req.body.used_for_mash   ?? cur.used_for_mash;
    const sold            = req.body.sold            ?? cur.sold;
    const supplier        = req.body.supplier        ?? cur.supplier;
    const notes           = req.body.notes           ?? cur.notes;
    const raw_type        = req.body.raw_type        ?? cur.raw_type;
    const person          = req.body.person          ?? cur.person;
    const price           = req.body.price           ?? cur.price;
    const src             = req.body.src             ?? cur.src;
    const s2a             = req.body.s2a             ?? cur.s2a;
    const s2b             = req.body.s2b             ?? cur.s2b;
    const u2              = req.body.u2              ?? cur.u2;
    const s3a             = req.body.s3a             ?? cur.s3a;
    const s3b             = req.body.s3b             ?? cur.s3b;
    const u3              = req.body.u3              ?? cur.u3;
    const s4a             = req.body.s4a             ?? cur.s4a;
    const s4b             = req.body.s4b             ?? cur.s4b;
    const u4              = req.body.u4              ?? cur.u4;
    const type_name       = req.body.type_name       ?? cur.type_name;
    const ms              = req.body.ms              ?? cur.ms;
    const sd              = req.body.sd              ?? cur.sd;
    const red             = req.body.red             ?? cur.red;
    const mbal            = req.body.mbal            ?? cur.mbal;
    const { rows } = await pool.query(
      `UPDATE raw_material_ledger
       SET carry_over=$1, received=$2, used=$3,
           used_for_starter=$4, used_for_mash=$5, sold=$6,
           supplier=$7, notes=$8,
           raw_type=$9, person=$10, price=$11, src=$12,
           s2a=$13, s2b=$14, u2=$15, s3a=$16, s3b=$17, u3=$18,
           s4a=$19, s4b=$20, u4=$21,
           type_name=$22, ms=$23, sd=$24, red=$25, mbal=$26,
           updated_at=NOW()
       WHERE id=$27
       RETURNING *`,
      [carry_over, received, used,
       used_for_starter, used_for_mash, sold,
       supplier, notes,
       raw_type, person, price, src,
       s2a, s2b, u2, s3a, s3b, u3, s4a, s4b, u4,
       type_name, ms, sd, red, mbal,
       req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/raw-material/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM raw_material_ledger WHERE id=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
