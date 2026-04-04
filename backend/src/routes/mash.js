/**
 * 술덧 장부 (본담금 제조 및 재고)
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { resolveCarryOver, propagateCarryOver } = require('../carryOver');
const { logInsert, logUpdate, logDelete } = require('../auditLog');
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
      `SELECT * FROM mash_ledger ${where} ORDER BY ledger_date DESC, batch_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mash_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      batch_code, ledger_date,
      produced = 0, used = 0,
      starter_used, koji_used, rice_used, water_used,
      filter_date, filtered_amount, alcohol_pct, notes,
      bno, rtype, rice, water, yeast, koji, fvol, fdate, filt, alc, acid
    } = req.body;
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });
    const carry_over = await resolveCarryOver(req.body.carry_over, 'mash_ledger', 'batch_code', batch_code, ledger_date);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO mash_ledger
           (batch_code, ledger_date, carry_over, produced, used,
            starter_used, koji_used, rice_used, water_used,
            filter_date, filtered_amount, alcohol_pct, notes,
            bno, rtype, rice, water, yeast, koji, fvol, fdate, filt, alc, acid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [batch_code, ledger_date, carry_over, produced, used,
         starter_used, koji_used, rice_used, water_used,
         filter_date, filtered_amount, alcohol_pct, notes,
         bno, rtype, rice, water, yeast, koji, fvol, fdate, filt, alc, acid]
      );
      await logInsert(client, 'mash_ledger', rows[0].id, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'mash_ledger', 'batch_code', batch_code, ledger_date);
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

router.put('/:id', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT * FROM mash_ledger WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!existing.rows.length) { client.release(); return res.status(404).json({ error: 'Not found' }); }
      const cur = existing.rows[0];
      const batch_code      = req.body.batch_code      ?? cur.batch_code;
      const carry_over      = req.body.carry_over      ?? cur.carry_over;
      const produced        = req.body.produced        ?? cur.produced;
      const used            = req.body.used            ?? cur.used;
      const starter_used    = req.body.starter_used    ?? cur.starter_used;
      const koji_used       = req.body.koji_used       ?? cur.koji_used;
      const rice_used       = req.body.rice_used       ?? cur.rice_used;
      const water_used      = req.body.water_used      ?? cur.water_used;
      const filter_date     = req.body.filter_date     ?? cur.filter_date;
      const filtered_amount = req.body.filtered_amount ?? cur.filtered_amount;
      const alcohol_pct     = req.body.alcohol_pct     ?? cur.alcohol_pct;
      const notes           = req.body.notes           ?? cur.notes;
      const bno             = req.body.bno             ?? cur.bno;
      const rtype           = req.body.rtype           ?? cur.rtype;
      const rice            = req.body.rice            ?? cur.rice;
      const water           = req.body.water           ?? cur.water;
      const yeast           = req.body.yeast           ?? cur.yeast;
      const koji            = req.body.koji            ?? cur.koji;
      const fvol            = req.body.fvol            ?? cur.fvol;
      const fdate           = req.body.fdate           ?? cur.fdate;
      const filt            = req.body.filt            ?? cur.filt;
      const alc             = req.body.alc             ?? cur.alc;
      const acid            = req.body.acid            ?? cur.acid;
      const { rows } = await client.query(
        `UPDATE mash_ledger
         SET batch_code=$1, carry_over=$2, produced=$3, used=$4,
             starter_used=$5, koji_used=$6, rice_used=$7, water_used=$8,
             filter_date=$9, filtered_amount=$10, alcohol_pct=$11, notes=$12,
             bno=$13, rtype=$14, rice=$15, water=$16, yeast=$17, koji=$18,
             fvol=$19, fdate=$20, filt=$21, alc=$22, acid=$23, updated_at=NOW()
         WHERE id=$24 RETURNING *`,
        [batch_code, carry_over, produced, used,
         starter_used, koji_used, rice_used, water_used,
         filter_date, filtered_amount, alcohol_pct, notes,
         bno, rtype, rice, water, yeast, koji, fvol, fdate, filt, alc, acid,
         req.params.id]
      );
      await logUpdate(client, 'mash_ledger', cur.id, cur, rows[0], req.user?.id);
      if (batch_code) {
        await propagateCarryOver(client, 'mash_ledger', 'batch_code', batch_code, cur.ledger_date);
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

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM mash_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const old = existing.rows[0];
    await pool.query('DELETE FROM mash_ledger WHERE id=$1', [req.params.id]);
    await logDelete(pool, 'mash_ledger', old.id, old, req.user?.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
