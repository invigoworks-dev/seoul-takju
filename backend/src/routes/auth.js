const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, name은 필수입니다.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Open registration defaults to 'operator' — admin/manager must be set via invite or admin panel
    const userRole = 'operator';

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, status, created_at`,
      [email, password_hash, name, userRole]
    );

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email, password는 필수입니다.' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: '비활성화된 계정입니다.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, company_id, status, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  // JWT는 서버 사이드에서 무효화할 수 없으므로 클라이언트에서 토큰 삭제 안내
  res.json({ message: '로그아웃 되었습니다. 클라이언트에서 토큰을 삭제하세요.' });
});

// GET /api/auth/verify-invite?token= — 초대 토큰 검증 (회원가입 전 정보 확인)
router.get('/verify-invite', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'token은 필수입니다.' });
    }

    const { rows } = await pool.query(
      `SELECT email, role FROM invitations
       WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 초대입니다.' });
    }

    res.json({ email: rows[0].email, role: rows[0].role });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/accept-invite — 초대 토큰 검증 후 회원가입
router.post('/accept-invite', async (req, res, next) => {
  try {
    const { token, password, name } = req.body;

    if (!token || !password || !name) {
      return res.status(400).json({ error: 'token, password, name은 필수입니다.' });
    }

    const { rows: invitations } = await pool.query(
      `SELECT * FROM invitations
       WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (invitations.length === 0) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 초대입니다.' });
    }

    const invitation = invitations[0];

    // Check if email already registered
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [invitation.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: users } = await client.query(
        `INSERT INTO users (email, password_hash, name, role, invited_by, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id, email, name, role, status, created_at`,
        [invitation.email, password_hash, name, invitation.role, invitation.invited_by]
      );

      await client.query(
        `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
        [invitation.id]
      );

      await client.query('COMMIT');

      const user = users[0];
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({ token: jwtToken, user });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
