/**
 * 밑술 장부 (주모/스타터 제조 및 재고)
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
      `SELECT * FROM starter_ledger ${where} ORDER BY ledger_date DESC, batch_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM starter_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      batch_code, ledger_date,
      produced = 0, used = 0,
      koji_used, rice_used, water_used, notes,
      insp_date, insp_person, symbol,
      bno_b, bno_a, ctnr_no,
      inc_date, inc_depth, inc_vol,
      chk_date, chk_depth, chk_vol, chk_rate,
      mash_bno_b, mash_bno_a
    } = req.body;
    if (!ledger_date) return res.status(400).json({ error: 'ledger_date is required' });
    const carry_over = await resolveCarryOver(req.body.carry_over, 'starter_ledger', 'batch_code', batch_code, ledger_date);
    const { rows } = await pool.query(
      `INSERT INTO starter_ledger
         (batch_code, ledger_date, carry_over, produced, used,
          koji_used, rice_used, water_used, notes,
          insp_date, insp_person, symbol,
          bno_b, bno_a, ctnr_no,
          inc_date, inc_depth, inc_vol,
          chk_date, chk_depth, chk_vol, chk_rate,
          mash_bno_b, mash_bno_a)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [batch_code, ledger_date, carry_over, produced, used,
       koji_used, rice_used, water_used, notes,
       insp_date, insp_person, symbol,
       bno_b, bno_a, ctnr_no,
       inc_date, inc_depth, inc_vol,
       chk_date, chk_depth, chk_vol, chk_rate,
       mash_bno_b, mash_bno_a]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM starter_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    const batch_code  = req.body.batch_code  ?? cur.batch_code;
    const carry_over  = req.body.carry_over  ?? cur.carry_over;
    const produced    = req.body.produced    ?? cur.produced;
    const used        = req.body.used        ?? cur.used;
    const koji_used   = req.body.koji_used   ?? cur.koji_used;
    const rice_used   = req.body.rice_used   ?? cur.rice_used;
    const water_used  = req.body.water_used  ?? cur.water_used;
    const notes       = req.body.notes       ?? cur.notes;
    const insp_date   = req.body.insp_date   ?? cur.insp_date;
    const insp_person = req.body.insp_person ?? cur.insp_person;
    const symbol      = req.body.symbol      ?? cur.symbol;
    const bno_b       = req.body.bno_b       ?? cur.bno_b;
    const bno_a       = req.body.bno_a       ?? cur.bno_a;
    const ctnr_no     = req.body.ctnr_no     ?? cur.ctnr_no;
    const inc_date    = req.body.inc_date    ?? cur.inc_date;
    const inc_depth   = req.body.inc_depth   ?? cur.inc_depth;
    const inc_vol     = req.body.inc_vol     ?? cur.inc_vol;
    const chk_date    = req.body.chk_date    ?? cur.chk_date;
    const chk_depth   = req.body.chk_depth   ?? cur.chk_depth;
    const chk_vol     = req.body.chk_vol     ?? cur.chk_vol;
    const chk_rate    = req.body.chk_rate    ?? cur.chk_rate;
    const mash_bno_b  = req.body.mash_bno_b  ?? cur.mash_bno_b;
    const mash_bno_a  = req.body.mash_bno_a  ?? cur.mash_bno_a;
    const { rows } = await pool.query(
      `UPDATE starter_ledger
       SET batch_code=$1, carry_over=$2, produced=$3, used=$4,
           koji_used=$5, rice_used=$6, water_used=$7, notes=$8,
           insp_date=$9, insp_person=$10, symbol=$11,
           bno_b=$12, bno_a=$13, ctnr_no=$14,
           inc_date=$15, inc_depth=$16, inc_vol=$17,
           chk_date=$18, chk_depth=$19, chk_vol=$20, chk_rate=$21,
           mash_bno_b=$22, mash_bno_a=$23, updated_at=NOW()
       WHERE id=$24 RETURNING *`,
      [batch_code, carry_over, produced, used,
       koji_used, rice_used, water_used, notes,
       insp_date, insp_person, symbol,
       bno_b, bno_a, ctnr_no,
       inc_date, inc_depth, inc_vol,
       chk_date, chk_depth, chk_vol, chk_rate,
       mash_bno_b, mash_bno_a,
       req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM starter_ledger WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
