const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user is still active in DB
    const { rows } = await pool.query('SELECT status FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0 || rows[0].status !== 'active') {
      return res.status(401).json({ error: '비활성화된 계정입니다.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = authMiddleware;
