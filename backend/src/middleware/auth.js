const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

// In-memory cache for user active status (30s TTL)
const userStatusCache = new Map();
const CACHE_TTL_MS = 30_000;

function getCachedStatus(userId) {
  const entry = userStatusCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    userStatusCache.delete(userId);
    return null;
  }
  return entry.status;
}

function setCachedStatus(userId, status) {
  userStatusCache.set(userId, { status, ts: Date.now() });
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check cache first, then DB
    let status = getCachedStatus(decoded.id);
    if (status === null) {
      const { rows } = await pool.query('SELECT status FROM users WHERE id = $1', [decoded.id]);
      status = rows.length ? rows[0].status : null;
      if (status) setCachedStatus(decoded.id, status);
    }

    if (status !== 'active') {
      return res.status(401).json({ error: '비활성화된 계정입니다.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = authMiddleware;
