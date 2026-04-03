/**
 * 발효제수불 장부 (효모, 종국 등)
 * 수불 계산: 이월 + 입고 − 사용 = 잔량
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver } = require('../carryOver');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/fermentation-agent?from=&to=&material_id=
router.get('/', async (req, res, next) => {
  try {
    const { from, to, material_id } = req.query;
    const params = [];
    const conditions = [];
    if (from) { params.push(from); conditions.push(`l.ledger_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`l.ledger_date <= $${params.length}`); }
    if (material_id) { params.push(material_id); conditions.push(`l.material_id = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT l.*, m.name AS material_name, m.code AS material_code, m.unit
       FROM fermentation_agent_ledger l
       JOIN materials m ON l.material_id = m.id
       ${where}
       ORDER BY l.ledger_date DESC, m.name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/fermentation-agent/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, m.name AS material_name, m.code AS material_code, m.unit
       FROM fermentation_agent_ledger l
       JOIN materials m ON l.material_id = m.id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/fermentation-agent
router.post('/', async (req, res, next) => {
  try {
    const { material_id, ledger_date, received = 0, used = 0, notes, person } = req.body;
    if (!material_id) return res.status(400).json({ error: 'material_id is required' });
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });

    const carry_over = await resolveCarryOver(
      req.body.carry_over,
      'fermentation_agent_ledger',
      'material_id',
      material_id,
      ledger_date
    );

    const { rows } = await pool.query(
      `INSERT INTO fermentation_agent_ledger
         (material_id, ledger_date, carry_over, received, used, notes, person)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [material_id, ledger_date, carry_over, received, used, notes, person ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/fermentation-agent/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM fermentation_agent_ledger WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];

    const carry_over  = req.body.carry_over  ?? cur.carry_over;
    const received    = req.body.received    ?? cur.received;
    const used        = req.body.used        ?? cur.used;
    const notes       = req.body.notes       ?? cur.notes;
    const person      = req.body.person      !== undefined ? req.body.person : cur.person;

    const { rows } = await pool.query(
      `UPDATE fermentation_agent_ledger
       SET carry_over=$1, received=$2, used=$3, notes=$4, person=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [carry_over, received, used, notes, person, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/fermentation-agent/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM fermentation_agent_ledger WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
