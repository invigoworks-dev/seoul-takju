/**
 * 술지거미 수불 장부 (여과 후 찌꺼기)
 * 수불 계산: 이월 + 발생 − 사용 = 잔량
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver, propagateCarryOver } = require('../carryOver');
const { logInsert, logUpdate, logDelete } = require('../auditLog');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/lees?from=&to=&batch_code=
router.get('/', async (req, res, next) => {
  try {
    const { from, to, batch_code } = req.query;
    const params = [];
    const conditions = [];
    if (from) { params.push(from); conditions.push(`ledger_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`ledger_date <= $${params.length}`); }
    if (batch_code) { params.push(batch_code); conditions.push(`batch_code = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT * FROM lees_ledger ${where} ORDER BY ledger_date DESC, batch_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/lees/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM lees_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/lees
router.post('/', async (req, res, next) => {
  try {
    const {
      batch_code, ledger_date, produced = 0, used = 0, notes,
      person, inc, method, out
    } = req.body;
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });
    const carry_over = await resolveCarryOver(req.body.carry_over, 'lees_ledger', 'batch_code', batch_code, ledger_date);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO lees_ledger
           (batch_code, ledger_date, carry_over, produced, used, notes,
            person, inc, method, "out")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [batch_code, ledger_date, carry_over, produced, used, notes,
         person, inc, method, out]
      );
      await logInsert(client, 'lees_ledger', rows[0].id, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'lees_ledger', 'batch_code', batch_code, ledger_date);
      }
      await client.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// PUT /api/lees/:id
router.put('/:id', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT * FROM lees_ledger WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!existing.rows.length) { client.release(); return res.status(404).json({ error: 'Not found' }); }
      const cur = existing.rows[0];
      const batch_code = req.body.batch_code ?? cur.batch_code;
      const carry_over = req.body.carry_over ?? cur.carry_over;
      const produced   = req.body.produced   ?? cur.produced;
      const used       = req.body.used       ?? cur.used;
      const notes      = req.body.notes      ?? cur.notes;
      const person     = req.body.person     ?? cur.person;
      const inc        = req.body.inc        ?? cur.inc;
      const method     = req.body.method     ?? cur.method;
      const out        = req.body.out        ?? cur.out;
      const { rows } = await client.query(
        `UPDATE lees_ledger
         SET batch_code=$1, carry_over=$2, produced=$3, used=$4, notes=$5,
             person=$6, inc=$7, method=$8, "out"=$9, updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        [batch_code, carry_over, produced, used, notes, person, inc, method, out, req.params.id]
      );
      await logUpdate(client, 'lees_ledger', cur.id, cur, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'lees_ledger', 'batch_code', batch_code, cur.ledger_date);
      }
      await client.query('COMMIT');
      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// DELETE /api/lees/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM lees_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const old = existing.rows[0];
    await pool.query('DELETE FROM lees_ledger WHERE id=$1', [req.params.id]);
    await logDelete(pool, 'lees_ledger', old.id, old, req.user?.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
