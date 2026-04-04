/**
 * 주류수불 장부 (완제품 입출고)
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
    const { from, to, product_code } = req.query;
    const params = [];
    const conditions = [];
    if (from) { params.push(from); conditions.push(`ledger_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`ledger_date <= $${params.length}`); }
    if (product_code) { params.push(product_code); conditions.push(`product_code = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT * FROM liquor_ledger ${where} ORDER BY ledger_date DESC, product_code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM liquor_ledger WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      product_code, product_name, ledger_date,
      received = 0, shipped = 0,
      shipped_sales = 0, shipped_self = 0, shipped_other = 0,
      unit = 'L', notes,
      person, bno_b, bno_a, inc, out, price, driver, dest, remain, loss, loss_rate
    } = req.body;
    if (!product_code || !product_name || !ledger_date) {
      return res.status(400).json({ error: 'product_code, product_name, ledger_date are required' });
    }
    const carry_over = await resolveCarryOver(req.body.carry_over, 'liquor_ledger', 'product_code', product_code, ledger_date);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO liquor_ledger
           (product_code, product_name, ledger_date, carry_over, received, shipped,
            shipped_sales, shipped_self, shipped_other, unit, notes,
            person, bno_b, bno_a, inc, "out", price, driver, dest, remain, loss, loss_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *`,
        [product_code, product_name, ledger_date, carry_over, received, shipped,
         shipped_sales, shipped_self, shipped_other, unit, notes,
         person, bno_b, bno_a, inc, out, price, driver, dest, remain, loss, loss_rate]
      );
      await logInsert(client, 'liquor_ledger', rows[0].id, rows[0], req.user?.id);
      if (product_code) {
        await propagateCarryOver(client, 'liquor_ledger', 'product_code', product_code, ledger_date);
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
      const existing = await client.query('SELECT * FROM liquor_ledger WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!existing.rows.length) { client.release(); return res.status(404).json({ error: 'Not found' }); }
      const cur = existing.rows[0];
      const product_name  = req.body.product_name  ?? cur.product_name;
      const carry_over    = req.body.carry_over    ?? cur.carry_over;
      const received      = req.body.received      ?? cur.received;
      const shipped       = req.body.shipped       ?? cur.shipped;
      const shipped_sales = req.body.shipped_sales ?? cur.shipped_sales;
      const shipped_self  = req.body.shipped_self  ?? cur.shipped_self;
      const shipped_other = req.body.shipped_other ?? cur.shipped_other;
      const unit          = req.body.unit          ?? cur.unit;
      const notes         = req.body.notes         ?? cur.notes;
      const person        = req.body.person        ?? cur.person;
      const bno_b         = req.body.bno_b         ?? cur.bno_b;
      const bno_a         = req.body.bno_a         ?? cur.bno_a;
      const inc           = req.body.inc           ?? cur.inc;
      const out           = req.body.out           ?? cur.out;
      const price         = req.body.price         ?? cur.price;
      const driver        = req.body.driver        ?? cur.driver;
      const dest          = req.body.dest          ?? cur.dest;
      const remain        = req.body.remain        ?? cur.remain;
      const loss          = req.body.loss          ?? cur.loss;
      const loss_rate     = req.body.loss_rate     ?? cur.loss_rate;
      const { rows } = await client.query(
        `UPDATE liquor_ledger
         SET product_name=$1, carry_over=$2, received=$3, shipped=$4,
             shipped_sales=$5, shipped_self=$6, shipped_other=$7,
             unit=$8, notes=$9,
             person=$10, bno_b=$11, bno_a=$12, inc=$13, "out"=$14,
             price=$15, driver=$16, dest=$17, remain=$18, loss=$19, loss_rate=$20,
             updated_at=NOW()
         WHERE id=$21 RETURNING *`,
        [product_name, carry_over, received, shipped,
         shipped_sales, shipped_self, shipped_other, unit, notes,
         person, bno_b, bno_a, inc, out, price, driver, dest, remain, loss, loss_rate,
         req.params.id]
      );
      await logUpdate(client, 'liquor_ledger', cur.id, cur, rows[0], req.user?.id);
      if (cur.product_code) {
        await propagateCarryOver(client, 'liquor_ledger', 'product_code', cur.product_code, cur.ledger_date);
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
    const existing = await pool.query('SELECT * FROM liquor_ledger WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const old = existing.rows[0];
    await pool.query('DELETE FROM liquor_ledger WHERE id=$1', [req.params.id]);
    await logDelete(pool, 'liquor_ledger', old.id, old, req.user?.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
