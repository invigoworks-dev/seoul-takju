/**
 * 월마감 관리 API
 * GET /api/monthly-close - 마감 목록 조회
 * POST /api/monthly-close - 월마감 실행
 * DELETE /api/monthly-close/:yearMonth - 월마감 해제 (admin only)
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authMiddleware);

// GET: 마감 목록
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT mc.*, u.name AS closed_by_name
       FROM monthly_close mc
       LEFT JOIN users u ON mc.closed_by = u.id
       ORDER BY mc.year_month DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET: 특정 월 마감 여부
router.get('/:yearMonth', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM monthly_close WHERE year_month = $1',
      [req.params.yearMonth]
    );
    res.json({ closed: rows.length > 0, data: rows[0] || null });
  } catch (err) { next(err); }
});

// POST: 월마감 실행
router.post('/', authorize(['admin', 'manager']), async (req, res, next) => {
  try {
    const { year_month, notes } = req.body;
    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
      return res.status(400).json({ error: 'year_month 형식: YYYY-MM' });
    }
    const { rows } = await pool.query(
      `INSERT INTO monthly_close (year_month, closed_by, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (year_month) DO NOTHING
       RETURNING *`,
      [year_month, req.user?.id, notes]
    );
    if (!rows.length) {
      return res.status(409).json({ error: `${year_month} 월은 이미 마감되었습니다.` });
    }
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE: 월마감 해제 (admin only)
router.delete('/:yearMonth', authorize(['admin']), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM monthly_close WHERE year_month = $1',
      [req.params.yearMonth]
    );
    if (!rowCount) return res.status(404).json({ error: '해당 월 마감 기록이 없습니다.' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
