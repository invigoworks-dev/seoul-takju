/**
 * 승인 워크플로우 API
 * operator가 입력 → manager/admin이 승인/반려
 */
const { Router } = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();
router.use(authMiddleware);

const VALID_LEDGER_TYPES = ['raw_material', 'fermentation_agent', 'koji', 'starter', 'mash', 'liquor', 'lees', 'first_mash', 'container'];
const LEDGER_TABLE_MAP = {
  raw_material: 'raw_material_ledger',
  fermentation_agent: 'fermentation_agent_ledger',
  koji: 'koji_ledger',
  starter: 'starter_ledger',
  mash: 'mash_ledger',
  liquor: 'liquor_ledger',
  lees: 'lees_ledger',
  first_mash: 'first_mash_ledger',
  container: 'container_ledger',
};

// POST /api/approvals/request — 승인 요청
router.post('/request', async (req, res, next) => {
  try {
    const { ledger_type, record_id } = req.body;

    if (!ledger_type || !record_id) {
      return res.status(400).json({ error: 'ledger_type과 record_id는 필수입니다.' });
    }
    if (!VALID_LEDGER_TYPES.includes(ledger_type)) {
      return res.status(400).json({ error: `유효하지 않은 장부 유형입니다: ${VALID_LEDGER_TYPES.join(', ')}` });
    }

    // Verify the record exists
    const table = LEDGER_TABLE_MAP[ledger_type];
    const record = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [record_id]);
    if (record.rows.length === 0) {
      return res.status(404).json({ error: '해당 장부 레코드를 찾을 수 없습니다.' });
    }

    // Check for existing pending approval
    const existing = await pool.query(
      `SELECT id FROM approvals WHERE ledger_type = $1 AND record_id = $2 AND status = 'pending'`,
      [ledger_type, record_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 대기 중인 승인 요청이 있습니다.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO approvals (ledger_type, record_id, requested_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ledger_type, record_id, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/approvals — 승인 목록 조회
router.get('/', async (req, res, next) => {
  try {
    const { status, ledger_type, record_ids } = req.query;
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`); }
    if (ledger_type) { params.push(ledger_type); conditions.push(`a.ledger_type = $${params.length}`); }
    if (record_ids) {
      const ids = record_ids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (ids.length) { params.push(ids); conditions.push(`a.record_id = ANY($${params.length})`); }
    }

    // Operators only see their own requests
    if (req.user.role === 'operator' || req.user.role === 'viewer') {
      params.push(req.user.id);
      conditions.push(`a.requested_by = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT a.*,
              req.name AS requester_name, req.email AS requester_email,
              apr.name AS approver_name
       FROM approvals a
       JOIN users req ON req.id = a.requested_by
       LEFT JOIN users apr ON apr.id = a.approved_by
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /api/approvals/:id — 승인/반려 (manager/admin만)
// body: { action: "approve" } 또는 { action: "reject", reason: "..." }
router.patch('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { action, reason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action은 "approve" 또는 "reject"이어야 합니다.' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const { rows } = await pool.query(
      `UPDATE approvals
       SET status = $1, approved_by = $2, reason = $3, approved_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, req.user.id, action === 'reject' ? (reason || null) : null, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: '대기 중인 승인 요청을 찾을 수 없습니다.' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
