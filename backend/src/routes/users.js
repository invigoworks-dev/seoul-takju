/**
 * 사용자 관리 API (admin/manager 전용)
 */
const { Router } = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();
const SALT_ROUNDS = 10;

// All routes require authentication
router.use(authMiddleware);

// GET /api/users — 사용자 목록 조회 (admin, manager만)
router.get('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { status, role } = req.query;
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (role)   { params.push(role);   conditions.push(`role = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT id, email, name, role, company_id, status, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/role — 역할 변경 (admin만)
router.patch('/:id/role', authorize('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'manager', 'operator', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: '유효한 역할을 지정하세요: admin, manager, operator, viewer' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name, role, status, updated_at`,
      [role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id — 사용자 비활성화 (admin만, 실제 삭제가 아닌 soft-delete)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: '자기 자신은 비활성화할 수 없습니다.' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET status = 'disabled', updated_at = NOW()
       WHERE id = $1 AND status != 'disabled'
       RETURNING id, email, name, role, status`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없거나 이미 비활성화되었습니다.' });
    res.json({ message: '사용자가 비활성화되었습니다.', user: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/activate — 사용자 활성화 (admin만)
router.patch('/:id/activate', authorize('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND status = 'disabled'
       RETURNING id, email, name, role, status`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없거나 이미 활성화되었습니다.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/users/invite — 사용자 초대 (admin, manager만)
router.post('/invite', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email은 필수입니다.' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
    }

    const validRoles = ['admin', 'manager', 'operator', 'viewer'];
    const inviteRole = validRoles.includes(role) ? role : 'operator';

    // Manager cannot invite admin
    if (req.user.role === 'manager' && inviteRole === 'admin') {
      return res.status(403).json({ error: 'manager는 admin 역할을 초대할 수 없습니다.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { rows } = await pool.query(
      `INSERT INTO invitations (email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, token, expires_at, created_at`,
      [email, inviteRole, token, req.user.id, expiresAt]
    );

    res.status(201).json({
      invitation: rows[0],
      invite_link: `/invite/accept?token=${token}`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
