/**
 * 1차 술덧 담금 장부 (첫 담금 공정)
 * 수불 계산: 이월 + 생산 − 사용 = 잔량
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver, propagateCarryOver } = require('../carryOver');
const { logInsert, logUpdate, logDelete } = require('../auditLog');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/first-mash?from=&to=&batch_code=
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
      `SELECT * FROM first_mash_ledger ${where} ORDER BY ledger_date DESC, batch_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/first-mash/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM first_mash_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/first-mash
router.post('/', async (req, res, next) => {
  try {
    const {
      batch_code, ledger_date,
      produced = 0, used = 0,
      starter_used, koji_used, rice_used, water_used,
      filter_date, filtered_amount, notes,
      bno_b, bno_a, ctnr_no,
      inc_depth, inc_vol,
      chk_date, chk_depth, chk_vol,
      bno2_b, bno2_a
    } = req.body;
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });
    const carry_over = await resolveCarryOver(req.body.carry_over, 'first_mash_ledger', 'batch_code', batch_code, ledger_date);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO first_mash_ledger
           (batch_code, ledger_date, carry_over, starter_used, koji_used, rice_used, water_used,
            produced, used, filter_date, filtered_amount, notes,
            bno_b, bno_a, ctnr_no, inc_depth, inc_vol,
            chk_date, chk_depth, chk_vol, bno2_b, bno2_a)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *`,
        [batch_code, ledger_date, carry_over, starter_used, koji_used, rice_used, water_used,
         produced, used, filter_date, filtered_amount, notes,
         bno_b, bno_a, ctnr_no, inc_depth, inc_vol,
         chk_date, chk_depth, chk_vol, bno2_b, bno2_a]
      );
      await logInsert(client, 'first_mash_ledger', rows[0].id, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'first_mash_ledger', 'batch_code', batch_code, ledger_date);
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

// PUT /api/first-mash/:id
router.put('/:id', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT * FROM first_mash_ledger WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!existing.rows.length) { client.release(); return res.status(404).json({ error: 'Not found' }); }
      const cur = existing.rows[0];
      const batch_code      = req.body.batch_code      ?? cur.batch_code;
      const carry_over      = req.body.carry_over      ?? cur.carry_over;
      const starter_used    = req.body.starter_used    ?? cur.starter_used;
      const koji_used       = req.body.koji_used       ?? cur.koji_used;
      const rice_used       = req.body.rice_used       ?? cur.rice_used;
      const water_used      = req.body.water_used      ?? cur.water_used;
      const produced        = req.body.produced        ?? cur.produced;
      const used            = req.body.used            ?? cur.used;
      const filter_date     = req.body.filter_date     ?? cur.filter_date;
      const filtered_amount = req.body.filtered_amount ?? cur.filtered_amount;
      const notes           = req.body.notes           ?? cur.notes;
      const bno_b           = req.body.bno_b           ?? cur.bno_b;
      const bno_a           = req.body.bno_a           ?? cur.bno_a;
      const ctnr_no         = req.body.ctnr_no         ?? cur.ctnr_no;
      const inc_depth       = req.body.inc_depth       ?? cur.inc_depth;
      const inc_vol         = req.body.inc_vol         ?? cur.inc_vol;
      const chk_date        = req.body.chk_date        ?? cur.chk_date;
      const chk_depth       = req.body.chk_depth       ?? cur.chk_depth;
      const chk_vol         = req.body.chk_vol         ?? cur.chk_vol;
      const bno2_b          = req.body.bno2_b          ?? cur.bno2_b;
      const bno2_a          = req.body.bno2_a          ?? cur.bno2_a;
      const { rows } = await client.query(
        `UPDATE first_mash_ledger
         SET batch_code=$1, carry_over=$2, starter_used=$3, koji_used=$4, rice_used=$5,
             water_used=$6, produced=$7, used=$8, filter_date=$9, filtered_amount=$10,
             notes=$11, bno_b=$12, bno_a=$13, ctnr_no=$14, inc_depth=$15, inc_vol=$16,
             chk_date=$17, chk_depth=$18, chk_vol=$19, bno2_b=$20, bno2_a=$21, updated_at=NOW()
         WHERE id=$22 RETURNING *`,
        [batch_code, carry_over, starter_used, koji_used, rice_used, water_used,
         produced, used, filter_date, filtered_amount, notes,
         bno_b, bno_a, ctnr_no, inc_depth, inc_vol,
         chk_date, chk_depth, chk_vol, bno2_b, bno2_a,
         req.params.id]
      );
      await logUpdate(client, 'first_mash_ledger', cur.id, cur, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'first_mash_ledger', 'batch_code', batch_code, cur.ledger_date);
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

// DELETE /api/first-mash/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM first_mash_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const old = existing.rows[0];
    await pool.query('DELETE FROM first_mash_ledger WHERE id=$1', [req.params.id]);
    await logDelete(pool, 'first_mash_ledger', old.id, old, req.user?.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
