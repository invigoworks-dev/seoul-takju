/**
 * 현황일보 (Daily Status Report)
 * 수불 계산식: 이월 + 당일입고(생산) − 당일사용(출고) = 잔량
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

/**
 * GET /api/daily-status?date=YYYY-MM-DD
 * 특정 날짜의 전체 수불 현황을 집계하여 반환
 */
router.get('/', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [rawMaterials, fermentationAgents, koji, starter, mash, liquor, firstMash, lees, containers] = await Promise.all([
      // 원료수불
      pool.query(
        `SELECT m.code, m.name, m.unit,
                COALESCE(r.carry_over, 0) AS carry_over,
                COALESCE(r.received, 0)   AS received,
                COALESCE(r.used, 0)       AS used,
                COALESCE(r.balance, 0)    AS balance
         FROM materials m
         LEFT JOIN raw_material_ledger r
           ON r.material_id = m.id AND r.ledger_date = $1
         WHERE m.category = 'raw_material'
         ORDER BY m.code`,
        [date]
      ),

      // 발효제수불
      pool.query(
        `SELECT m.code, m.name, m.unit,
                COALESCE(f.carry_over, 0) AS carry_over,
                COALESCE(f.received, 0)   AS received,
                COALESCE(f.used, 0)       AS used,
                COALESCE(f.balance, 0)    AS balance
         FROM materials m
         LEFT JOIN fermentation_agent_ledger f
           ON f.material_id = m.id AND f.ledger_date = $1
         WHERE m.category = 'fermentation_agent'
         ORDER BY m.code`,
        [date]
      ),

      // 입국
      pool.query(
        `SELECT batch_code,
                COALESCE(SUM(carry_over), 0) AS carry_over,
                COALESCE(SUM(produced), 0)   AS produced,
                COALESCE(SUM(used), 0)       AS used,
                COALESCE(SUM(balance), 0)    AS balance
         FROM koji_ledger
         WHERE ledger_date = $1
         GROUP BY batch_code
         ORDER BY batch_code NULLS LAST`,
        [date]
      ),

      // 밑술
      pool.query(
        `SELECT batch_code,
                COALESCE(SUM(carry_over), 0) AS carry_over,
                COALESCE(SUM(produced), 0)   AS produced,
                COALESCE(SUM(used), 0)       AS used,
                COALESCE(SUM(balance), 0)    AS balance
         FROM starter_ledger
         WHERE ledger_date = $1
         GROUP BY batch_code
         ORDER BY batch_code NULLS LAST`,
        [date]
      ),

      // 술덧 (본담금)
      pool.query(
        `SELECT batch_code,
                COALESCE(SUM(carry_over), 0) AS carry_over,
                COALESCE(SUM(produced), 0)   AS produced,
                COALESCE(SUM(used), 0)       AS used,
                COALESCE(SUM(balance), 0)    AS balance
         FROM mash_ledger
         WHERE ledger_date = $1
         GROUP BY batch_code
         ORDER BY batch_code NULLS LAST`,
        [date]
      ),

      // 주류수불
      pool.query(
        `SELECT product_code, product_name, unit,
                COALESCE(carry_over, 0) AS carry_over,
                COALESCE(received, 0)   AS received,
                COALESCE(shipped, 0)    AS shipped,
                COALESCE(balance, 0)    AS balance
         FROM liquor_ledger
         WHERE ledger_date = $1
         ORDER BY product_code`,
        [date]
      ),

      // 1차 술덧 (첫 담금)
      pool.query(
        `SELECT batch_code,
                COALESCE(SUM(carry_over), 0) AS carry_over,
                COALESCE(SUM(produced), 0)   AS produced,
                COALESCE(SUM(used), 0)       AS used,
                COALESCE(SUM(balance), 0)    AS balance
         FROM first_mash_ledger
         WHERE ledger_date = $1
         GROUP BY batch_code
         ORDER BY batch_code NULLS LAST`,
        [date]
      ),

      // 술지거미
      pool.query(
        `SELECT batch_code,
                COALESCE(SUM(carry_over), 0) AS carry_over,
                COALESCE(SUM(produced), 0)   AS produced,
                COALESCE(SUM(used), 0)       AS used,
                COALESCE(SUM(balance), 0)    AS balance
         FROM lees_ledger
         WHERE ledger_date = $1
         GROUP BY batch_code
         ORDER BY batch_code NULLS LAST`,
        [date]
      ),

      // 용기/마개
      pool.query(
        `SELECT container_type,
                COALESCE(carry_over, 0) AS carry_over,
                COALESCE(received, 0)   AS received,
                COALESCE(used, 0)       AS used,
                COALESCE(balance, 0)    AS balance
         FROM container_ledger
         WHERE ledger_date = $1
         ORDER BY container_type`,
        [date]
      ),
    ]);

    res.json({
      date,
      raw_materials:       rawMaterials.rows,
      fermentation_agents: fermentationAgents.rows,
      koji:                koji.rows,
      starter:             starter.rows,
      mash:                mash.rows,
      liquor:              liquor.rows,
      first_mash:          firstMash.rows,
      lees:                lees.rows,
      containers:          containers.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/daily-status/range?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 날짜 범위 현황일보 (월별 집계 등에 활용) — 9대 장부 전체
 */
router.get('/range', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' });
    }

    const [rawMaterials, fermentationAgents, koji, starter, mash, liquor, firstMash, lees, containers] = await Promise.all([
      pool.query(
        `SELECT r.ledger_date, m.code, m.name, m.unit,
                r.carry_over, r.received, r.used, r.balance
         FROM raw_material_ledger r
         JOIN materials m ON m.id = r.material_id
         WHERE r.ledger_date BETWEEN $1 AND $2
         ORDER BY r.ledger_date, m.code`,
        [from, to]
      ),
      pool.query(
        `SELECT f.ledger_date, m.code, m.name, m.unit,
                f.carry_over, f.received, f.used, f.balance
         FROM fermentation_agent_ledger f
         JOIN materials m ON m.id = f.material_id
         WHERE f.ledger_date BETWEEN $1 AND $2
         ORDER BY f.ledger_date, m.code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, batch_code, carry_over, produced, used, balance
         FROM koji_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, batch_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, batch_code, carry_over, produced, used, balance
         FROM starter_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, batch_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, batch_code, carry_over, produced, used, balance
         FROM mash_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, batch_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, product_code, product_name, unit,
                carry_over, received, shipped, balance
         FROM liquor_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, product_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, batch_code, carry_over, produced, used, balance
         FROM first_mash_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, batch_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, batch_code, carry_over, produced, used, balance
         FROM lees_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, batch_code`,
        [from, to]
      ),
      pool.query(
        `SELECT ledger_date, container_type, carry_over, received, used, balance
         FROM container_ledger WHERE ledger_date BETWEEN $1 AND $2
         ORDER BY ledger_date, container_type`,
        [from, to]
      ),
    ]);

    res.json({
      from, to,
      raw_materials:       rawMaterials.rows,
      fermentation_agents: fermentationAgents.rows,
      koji:                koji.rows,
      starter:             starter.rows,
      mash:                mash.rows,
      liquor:              liquor.rows,
      first_mash:          firstMash.rows,
      lees:                lees.rows,
      containers:          containers.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/daily-status/monthly-summary?year=YYYY&month=MM
 * 현황월보: 9대 장부 월 합계 집계
 */
router.get('/monthly-summary', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month query params are required' });
    }
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [rawMat, fermAgent, kojiSum, starterSum, mashSum, liquorSum, firstMashSum, leesSum, containerSum] = await Promise.all([
      pool.query(
        `SELECT m.code, m.name, m.unit,
                SUM(r.received) AS total_received, SUM(r.used) AS total_used
         FROM raw_material_ledger r JOIN materials m ON m.id = r.material_id
         WHERE r.ledger_date BETWEEN $1 AND $2
         GROUP BY m.code, m.name, m.unit ORDER BY m.code`, [from, to]),
      pool.query(
        `SELECT m.code, m.name, m.unit,
                SUM(f.received) AS total_received, SUM(f.used) AS total_used
         FROM fermentation_agent_ledger f JOIN materials m ON m.id = f.material_id
         WHERE f.ledger_date BETWEEN $1 AND $2
         GROUP BY m.code, m.name, m.unit ORDER BY m.code`, [from, to]),
      pool.query(
        `SELECT COALESCE(batch_code,'전체') AS batch_code,
                SUM(produced) AS total_produced, SUM(used) AS total_used
         FROM koji_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY batch_code ORDER BY batch_code NULLS LAST`, [from, to]),
      pool.query(
        `SELECT COALESCE(batch_code,'전체') AS batch_code,
                SUM(produced) AS total_produced, SUM(used) AS total_used
         FROM starter_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY batch_code ORDER BY batch_code NULLS LAST`, [from, to]),
      pool.query(
        `SELECT COALESCE(batch_code,'전체') AS batch_code,
                SUM(produced) AS total_produced, SUM(used) AS total_used
         FROM mash_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY batch_code ORDER BY batch_code NULLS LAST`, [from, to]),
      pool.query(
        `SELECT product_code, product_name, unit,
                SUM(received) AS total_received, SUM(shipped) AS total_shipped
         FROM liquor_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY product_code, product_name, unit ORDER BY product_code`, [from, to]),
      pool.query(
        `SELECT COALESCE(batch_code,'전체') AS batch_code,
                SUM(produced) AS total_produced, SUM(used) AS total_used
         FROM first_mash_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY batch_code ORDER BY batch_code NULLS LAST`, [from, to]),
      pool.query(
        `SELECT COALESCE(batch_code,'전체') AS batch_code,
                SUM(produced) AS total_produced, SUM(used) AS total_used
         FROM lees_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY batch_code ORDER BY batch_code NULLS LAST`, [from, to]),
      pool.query(
        `SELECT container_type,
                SUM(received) AS total_received, SUM(used) AS total_used
         FROM container_ledger WHERE ledger_date BETWEEN $1 AND $2
         GROUP BY container_type ORDER BY container_type`, [from, to]),
    ]);

    res.json({
      year, month, from, to,
      raw_materials:       rawMat.rows,
      fermentation_agents: fermAgent.rows,
      koji:                kojiSum.rows,
      starter:             starterSum.rows,
      mash:                mashSum.rows,
      liquor:              liquorSum.rows,
      first_mash:          firstMashSum.rows,
      lees:                leesSum.rows,
      containers:          containerSum.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/daily-status/inventory
 * 재고현황 집계: 각 장부의 최신 잔량
 */
router.get('/inventory', async (req, res, next) => {
  try {
    const [rawMat, fermAgent, koji, starter, mash, liquor, firstMash, lees, containers] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ON (r.material_id) m.code, m.name, m.unit, r.ledger_date, r.balance
         FROM raw_material_ledger r JOIN materials m ON m.id = r.material_id
         ORDER BY r.material_id, r.ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (f.material_id) m.code, m.name, m.unit, f.ledger_date, f.balance
         FROM fermentation_agent_ledger f JOIN materials m ON m.id = f.material_id
         ORDER BY f.material_id, f.ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (batch_code) batch_code, ledger_date, balance
         FROM koji_ledger ORDER BY batch_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (batch_code) batch_code, ledger_date, balance
         FROM starter_ledger ORDER BY batch_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (batch_code) batch_code, ledger_date, balance
         FROM mash_ledger ORDER BY batch_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (product_code) product_code, product_name, unit, ledger_date, balance
         FROM liquor_ledger ORDER BY product_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (batch_code) batch_code, ledger_date, balance
         FROM first_mash_ledger ORDER BY batch_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (batch_code) batch_code, ledger_date, balance
         FROM lees_ledger ORDER BY batch_code, ledger_date DESC`),
      pool.query(
        `SELECT DISTINCT ON (container_type) container_type, ledger_date, balance
         FROM container_ledger ORDER BY container_type, ledger_date DESC`),
    ]);

    res.json({
      as_of: new Date().toISOString().slice(0, 10),
      raw_materials:       rawMat.rows,
      fermentation_agents: fermAgent.rows,
      koji:                koji.rows,
      starter:             starter.rows,
      mash:                mash.rows,
      liquor:              liquor.rows,
      first_mash:          firstMash.rows,
      lees:                lees.rows,
      containers:          containers.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ITEM CONFIG: maps item key → { unit, table, prevCategory, receivedExpr,
//   usedExpr, joinClause (optional), whereClause (optional), extraCols }
// ---------------------------------------------------------------------------
const ITEM_CONFIG = {
  '평화미': {
    unit: 'kg',
    table: 'raw_material_ledger r',
    joinClause: 'JOIN materials m ON m.id = r.material_id',
    whereClause: "m.name = '평화미'",
    dateCol: 'r.ledger_date',
    receivedExpr: 'COALESCE(SUM(r.received), 0)',
    usedExpr: 'COALESCE(SUM(COALESCE(r.u2,0) + COALESCE(r.u3,0) + COALESCE(r.u4,0)), 0)',
    historyExtraCols: 'COALESCE(r.received,0) AS received, COALESCE(r.u2,0) AS u2, COALESCE(r.u3,0) AS u3, COALESCE(r.u4,0) AS u4, r.person, COALESCE(r.price,0) AS price, r.src, r.notes, r.s2a, r.s2b, r.s3a, r.s3b, r.s4a, r.s4b',
    historyUsedExpr: 'COALESCE(r.u2,0) + COALESCE(r.u3,0) + COALESCE(r.u4,0)',
  },
  '백미': {
    unit: 'kg',
    table: 'raw_material_ledger r',
    joinClause: 'JOIN materials m ON m.id = r.material_id',
    whereClause: "m.name = '백미'",
    dateCol: 'r.ledger_date',
    receivedExpr: 'COALESCE(SUM(r.received), 0)',
    usedExpr: 'COALESCE(SUM(COALESCE(r.u2,0) + COALESCE(r.u3,0) + COALESCE(r.u4,0)), 0)',
    historyExtraCols: 'COALESCE(r.received,0) AS received, COALESCE(r.u2,0) AS u2, COALESCE(r.u3,0) AS u3, COALESCE(r.u4,0) AS u4, r.person, COALESCE(r.price,0) AS price, r.src, r.notes, r.s2a, r.s2b, r.s3a, r.s3b, r.s4a, r.s4b',
    historyUsedExpr: 'COALESCE(r.u2,0) + COALESCE(r.u3,0) + COALESCE(r.u4,0)',
  },
  '효모': {
    unit: 'g',
    table: 'fermentation_agent_ledger f',
    joinClause: 'JOIN materials m ON m.id = f.material_id',
    whereClause: "m.name = '효모'",
    dateCol: 'f.ledger_date',
    receivedExpr: 'COALESCE(SUM(f.received), 0)',
    usedExpr: 'COALESCE(SUM(f.used), 0)',
    historyExtraCols: 'COALESCE(f.received,0) AS received, COALESCE(f.used,0) AS used, f.person, f.notes',
    historyUsedExpr: 'COALESCE(f.used,0)',
  },
  '곡자': {
    unit: 'kg',
    table: 'fermentation_agent_ledger f',
    joinClause: 'JOIN materials m ON m.id = f.material_id',
    whereClause: "m.name = '곡자'",
    dateCol: 'f.ledger_date',
    receivedExpr: 'COALESCE(SUM(f.received), 0)',
    usedExpr: 'COALESCE(SUM(f.used), 0)',
    historyExtraCols: 'COALESCE(f.received,0) AS received, COALESCE(f.used,0) AS used, f.person, f.notes',
    historyUsedExpr: 'COALESCE(f.used,0)',
  },
  '아스파탐': {
    unit: 'g',
    table: 'fermentation_agent_ledger f',
    joinClause: 'JOIN materials m ON m.id = f.material_id',
    whereClause: "m.name = '아스파탐'",
    dateCol: 'f.ledger_date',
    receivedExpr: 'COALESCE(SUM(f.received), 0)',
    usedExpr: 'COALESCE(SUM(f.used), 0)',
    historyExtraCols: 'COALESCE(f.received,0) AS received, COALESCE(f.used,0) AS used, f.person, f.notes',
    historyUsedExpr: 'COALESCE(f.used,0)',
  },
  '구연산': {
    unit: 'g',
    table: 'fermentation_agent_ledger f',
    joinClause: 'JOIN materials m ON m.id = f.material_id',
    whereClause: "m.name = '구연산'",
    dateCol: 'f.ledger_date',
    receivedExpr: 'COALESCE(SUM(f.received), 0)',
    usedExpr: 'COALESCE(SUM(f.used), 0)',
    historyExtraCols: 'COALESCE(f.received,0) AS received, COALESCE(f.used,0) AS used, f.person, f.notes',
    historyUsedExpr: 'COALESCE(f.used,0)',
  },
  '주류': {
    unit: 'L',
    table: 'liquor_ledger l',
    joinClause: null,
    whereClause: null,
    dateCol: 'l.ledger_date',
    receivedExpr: 'COALESCE(SUM(l.received), 0)',
    usedExpr: 'COALESCE(SUM(l.shipped), 0)',
    historyExtraCols: 'COALESCE(SUM(l.received),0) AS received, COALESCE(SUM(l.shipped),0) AS shipped, COALESCE(SUM(l.price),0) AS price, string_agg(DISTINCT l.person, \', \') AS person, string_agg(DISTINCT l.driver, \', \') AS driver, string_agg(DISTINCT l.dest, \', \') AS dest, string_agg(DISTINCT l.notes, \'; \') AS notes',
    historyUsedExpr: 'COALESCE(SUM(l.shipped),0)',
  },
  '용기': {
    unit: '개',
    table: 'container_ledger c',
    joinClause: null,
    whereClause: "c.container_type = '용기'",
    dateCol: 'c.ledger_date',
    receivedExpr: 'COALESCE(SUM(c.received), 0)',
    usedExpr: 'COALESCE(SUM(c.used), 0)',
    historyExtraCols: 'COALESCE(c.received,0) AS received, COALESCE(c.used,0) AS used',
    historyUsedExpr: 'COALESCE(c.used,0)',
  },
  '마개': {
    unit: '개',
    table: 'container_ledger c',
    joinClause: null,
    whereClause: "c.container_type = '마개'",
    dateCol: 'c.ledger_date',
    receivedExpr: 'COALESCE(SUM(c.received), 0)',
    usedExpr: 'COALESCE(SUM(c.used), 0)',
    historyExtraCols: 'COALESCE(c.received,0) AS received, COALESCE(c.used,0) AS used',
    historyUsedExpr: 'COALESCE(c.used,0)',
  },
};

const ITEM_ORDER = ['평화미', '백미', '효모', '곡자', '아스파탐', '구연산', '주류', '용기', '마개'];

/**
 * Build a WHERE clause fragment for date range on the item's date column.
 * @param {object} cfg - item config
 * @param {string|null} fromDate - lower bound (inclusive)
 * @param {string} toDate - upper bound (inclusive)
 * @param {number} paramOffset - starting $N index
 * @returns {{ clause: string, params: string[] }}
 */
function buildDateWhere(cfg, fromDate, toDate, paramOffset) {
  const params = [];
  let idx = paramOffset;
  let clause = '';
  if (fromDate) {
    clause += ` AND ${cfg.dateCol} >= $${idx++}`;
    params.push(fromDate);
  }
  clause += ` AND ${cfg.dateCol} <= $${idx++}`;
  params.push(toDate);
  return { clause, params };
}

/**
 * Aggregate received/used for an item over a date range.
 */
async function aggregateItem(cfg, fromDate, toDate) {
  const whereParts = [];
  const params = [];
  let idx = 1;

  if (cfg.whereClause) {
    whereParts.push(cfg.whereClause);
  }
  if (fromDate) {
    whereParts.push(`${cfg.dateCol} >= $${idx++}`);
    params.push(fromDate);
  }
  whereParts.push(`${cfg.dateCol} <= $${idx++}`);
  params.push(toDate);

  const whereStr = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';
  const joinStr = cfg.joinClause || '';

  const sql = `
    SELECT ${cfg.receivedExpr} AS received, ${cfg.usedExpr} AS used
    FROM ${cfg.table}
    ${joinStr}
    ${whereStr}
  `;
  const { rows } = await pool.query(sql, params);
  return {
    received: rows[0] ? parseFloat(rows[0].received) || 0 : 0,
    used: rows[0] ? parseFloat(rows[0].used) || 0 : 0,
  };
}

/**
 * GET /api/daily-status/inventory/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 9개 품목 재고현황 요약 카드 데이터
 */
router.get('/inventory/summary', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const to = req.query.to || today;

    // 1. Fetch all prev_balance entries
    const { rows: prevRows } = await pool.query(
      'SELECT category, amount, balance_date FROM prev_balance'
    );
    const prevMap = {};
    for (const row of prevRows) {
      prevMap[row.category] = { amount: parseFloat(row.amount) || 0, balance_date: row.balance_date };
    }

    // 2. Aggregate each item
    const items = await Promise.all(
      ITEM_ORDER.map(async (key) => {
        const cfg = ITEM_CONFIG[key];
        const prev = prevMap[key] || { amount: 0, balance_date: null };
        const prevDate = prev.balance_date;

        const { received, used } = await aggregateItem(cfg, prevDate, to);
        const balance = prev.amount + received - used;

        return {
          key,
          unit: cfg.unit,
          prev_amount: prev.amount,
          prev_date: prevDate,
          received,
          used,
          balance,
        };
      })
    );

    res.json({ from: null, to, items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/daily-status/inventory/history/:item?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 품목별 일별 재고 이력
 */
router.get('/inventory/history/:item', async (req, res, next) => {
  try {
    const itemKey = decodeURIComponent(req.params.item);
    const cfg = ITEM_CONFIG[itemKey];
    if (!cfg) {
      return res.status(400).json({ error: `Unknown item: ${itemKey}` });
    }

    const today = new Date().toISOString().slice(0, 10);
    const to = req.query.to || today;

    // Fetch prev_balance for this item
    const { rows: prevRows } = await pool.query(
      'SELECT amount, balance_date FROM prev_balance WHERE category = $1',
      [itemKey]
    );
    const prev = prevRows[0] || { amount: 0, balance_date: null };
    const prevAmount = parseFloat(prev.amount) || 0;
    const prevDate = prev.balance_date;

    // Default from = prevDate (or today if null)
    const from = req.query.from || prevDate || today;

    // Compute carry_balance: prevAmount + aggregation from prevDate to (from - 1 day)
    let carry_balance = prevAmount;
    if (prevDate && from > prevDate) {
      // day before `from`
      const fromDt = new Date(from);
      fromDt.setDate(fromDt.getDate() - 1);
      const dayBefore = fromDt.toISOString().slice(0, 10);

      const { received: cRec, used: cUsed } = await aggregateItem(cfg, prevDate, dayBefore);
      carry_balance = prevAmount + cRec - cUsed;
    }

    // Fetch daily rows from `from` to `to`
    const whereParts = [];
    const params = [];
    let idx = 1;

    if (cfg.whereClause) {
      whereParts.push(cfg.whereClause);
    }
    whereParts.push(`${cfg.dateCol} >= $${idx++}`);
    params.push(from);
    whereParts.push(`${cfg.dateCol} <= $${idx++}`);
    params.push(to);

    const whereStr = 'WHERE ' + whereParts.join(' AND ');
    const joinStr = cfg.joinClause || '';

    // For items that need GROUP BY (주류 spans multiple product_codes per date)
    const needsGroupBy = ['주류'].includes(itemKey);
    const groupByClause = needsGroupBy ? `GROUP BY ${cfg.dateCol}` : '';

    const sql = `
      SELECT ${cfg.dateCol} AS ledger_date, ${cfg.historyExtraCols}
      FROM ${cfg.table}
      ${joinStr}
      ${whereStr}
      ${groupByClause}
      ORDER BY ${cfg.dateCol} ASC
    `;
    const { rows: dailyRows } = await pool.query(sql, params);

    // Compute running balance
    let running = carry_balance;
    const rows = dailyRows.map((row) => {
      const rec = parseFloat(row.received) || 0;
      let usedVal = 0;

      if (itemKey === '평화미' || itemKey === '백미') {
        usedVal = (parseFloat(row.u2) || 0) + (parseFloat(row.u3) || 0) + (parseFloat(row.u4) || 0);
      } else if (itemKey === '주류') {
        usedVal = parseFloat(row.shipped) || 0;
      } else {
        usedVal = parseFloat(row.used) || 0;
      }

      running = running + rec - usedVal;

      const base = { ledger_date: row.ledger_date, balance: running };
      if (itemKey === '평화미' || itemKey === '백미') {
        return { ...base, received: rec, u2: parseFloat(row.u2) || 0, u3: parseFloat(row.u3) || 0, u4: parseFloat(row.u4) || 0, person: row.person || null, price: parseFloat(row.price) || 0, src: row.src || null, notes: row.notes || null, s2a: row.s2a || null, s2b: row.s2b || null, s3a: row.s3a || null, s3b: row.s3b || null, s4a: row.s4a || null, s4b: row.s4b || null };
      } else if (itemKey === '주류') {
        return { ...base, received: rec, shipped: usedVal, person: row.person || null, price: parseFloat(row.price) || 0, driver: row.driver || null, dest: row.dest || null, notes: row.notes || null };
      } else if (itemKey === '효모' || itemKey === '곡자' || itemKey === '아스파탐' || itemKey === '구연산') {
        return { ...base, received: rec, used: usedVal, person: row.person || null, notes: row.notes || null };
      } else {
        return { ...base, received: rec, used: usedVal };
      }
    });

    res.json({
      item: itemKey,
      unit: cfg.unit,
      from,
      to,
      carry_balance,
      rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
