/**
 * 입국 장부 (코지/국 제조 및 재고)
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver } = require('../carryOver');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

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
      `SELECT * FROM koji_ledger ${where} ORDER BY ledger_date DESC, batch_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM koji_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      batch_code, ledger_date,
      produced = 0, used = 0, rice_used, notes,
      person, ms_cnt, sd_cnt, ms_raw, sd_raw, ms_b, ms_a, sd_b, sd_a
    } = req.body;
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });
    const carry_over = await resolveCarryOver(req.body.carry_over, 'koji_ledger', 'batch_code', batch_code, ledger_date);
    const { rows } = await pool.query(
      `INSERT INTO koji_ledger
         (batch_code, ledger_date, carry_over, produced, used, rice_used, notes,
          person, ms_cnt, sd_cnt, ms_raw, sd_raw, ms_b, ms_a, sd_b, sd_a)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [batch_code, ledger_date, carry_over, produced, used, rice_used, notes,
       person, ms_cnt, sd_cnt, ms_raw, sd_raw, ms_b, ms_a, sd_b, sd_a]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM koji_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    const batch_code = req.body.batch_code ?? cur.batch_code;
    const carry_over = req.body.carry_over ?? cur.carry_over;
    const produced   = req.body.produced   ?? cur.produced;
    const used       = req.body.used       ?? cur.used;
    const rice_used  = req.body.rice_used  ?? cur.rice_used;
    const notes      = req.body.notes      ?? cur.notes;
    const person     = req.body.person     ?? cur.person;
    const ms_cnt     = req.body.ms_cnt     ?? cur.ms_cnt;
    const sd_cnt     = req.body.sd_cnt     ?? cur.sd_cnt;
    const ms_raw     = req.body.ms_raw     ?? cur.ms_raw;
    const sd_raw     = req.body.sd_raw     ?? cur.sd_raw;
    const ms_b       = req.body.ms_b       ?? cur.ms_b;
    const ms_a       = req.body.ms_a       ?? cur.ms_a;
    const sd_b       = req.body.sd_b       ?? cur.sd_b;
    const sd_a       = req.body.sd_a       ?? cur.sd_a;
    const { rows } = await pool.query(
      `UPDATE koji_ledger
       SET batch_code=$1, carry_over=$2, produced=$3, used=$4, rice_used=$5, notes=$6,
           person=$7, ms_cnt=$8, sd_cnt=$9, ms_raw=$10, sd_raw=$11,
           ms_b=$12, ms_a=$13, sd_b=$14, sd_a=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [batch_code, carry_over, produced, used, rice_used, notes,
       person, ms_cnt, sd_cnt, ms_raw, sd_raw, ms_b, ms_a, sd_b, sd_a,
       req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM koji_ledger WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
