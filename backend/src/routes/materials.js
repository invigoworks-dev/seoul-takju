const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/materials?category=raw_material
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const params = [];
    const conditions = ['is_active = true'];
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    const where = 'WHERE ' + conditions.join(' AND ');
    const { rows } = await pool.query(
      `SELECT * FROM materials ${where} ORDER BY category, code`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/materials
router.post('/', async (req, res, next) => {
  try {
    const { code, name, unit, category } = req.body;
    if (!code || !name || !unit || !category) {
      return res.status(400).json({ error: 'code, name, unit, category are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO materials (code, name, unit, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [code, name, unit, category]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/materials/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM materials WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    const name = req.body.name ?? cur.name;
    const unit = req.body.unit ?? cur.unit;
    const category = req.body.category ?? cur.category;
    const { rows } = await pool.query(
      `UPDATE materials SET name=$1, unit=$2, category=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, unit, category, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/materials/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM materials WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
