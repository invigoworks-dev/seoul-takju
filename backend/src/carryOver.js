/**
 * 이월(carry_over) 자동계산 유틸리티
 * 전일 잔량(balance)을 당일 이월로 자동 반영
 */
const pool = require('./db');

// Whitelist of allowed table and column names to prevent SQL injection
const ALLOWED_TABLES = new Set([
  'raw_material_ledger',
  'fermentation_agent_ledger',
  'koji_ledger',
  'starter_ledger',
  'mash_ledger',
  'liquor_ledger',
  'lees_ledger',
  'first_mash_ledger',
  'container_ledger',
]);

const ALLOWED_FILTER_COLS = new Set([
  'material_id',
  'batch_code',
  'product_code',
  'container_type',
]);

function validateIdentifier(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

/**
 * 특정 장부 테이블에서 해당 날짜 이전 최신 잔량을 조회
 * @param {string} table - 테이블 이름
 * @param {string} filterCol - 필터 컬럼명 (material_id, batch_code, product_code, container_type)
 * @param {*} filterVal - 필터 값
 * @param {string} date - 조회 기준 날짜 (YYYY-MM-DD)
 * @returns {number} 전일 잔량 (없으면 0)
 */
async function getLastBalance(table, filterCol, filterVal, date) {
  if (!filterVal || !date) return 0;
  validateIdentifier(table, ALLOWED_TABLES, 'table');
  validateIdentifier(filterCol, ALLOWED_FILTER_COLS, 'column');
  const { rows } = await pool.query(
    `SELECT balance FROM ${table}
     WHERE ${filterCol} = $1 AND ledger_date < $2
     ORDER BY ledger_date DESC LIMIT 1`,
    [filterVal, date]
  );
  return rows.length ? parseFloat(rows[0].balance) : 0;
}

/**
 * carry_over 값을 결정: 명시적 입력이 있으면 그 값, 없으면 전일 잔량 자동 조회
 * @param {number|undefined|null} inputCarryOver - 요청에서 넘어온 carry_over
 * @param {string} table - 테이블 이름
 * @param {string} filterCol - 필터 컬럼명
 * @param {*} filterVal - 필터 값
 * @param {string} date - 날짜
 * @returns {number}
 */
async function resolveCarryOver(inputCarryOver, table, filterCol, filterVal, date) {
  // 명시적으로 값이 넘어오면 그 값 사용 (0도 유효한 입력)
  if (inputCarryOver !== undefined && inputCarryOver !== null) {
    return parseFloat(inputCarryOver);
  }
  return getLastBalance(table, filterCol, filterVal, date);
}

/**
 * 특정 레코드 이후의 모든 carry_over를 전파 갱신
 * 과거 데이터 수정 시 후속 행의 carry_over가 전일 balance로 자동 갱신됨
 */
async function propagateCarryOver(client, table, filterCol, filterVal, fromDate) {
  validateIdentifier(table, ALLOWED_TABLES, 'table');
  validateIdentifier(filterCol, ALLOWED_FILTER_COLS, 'column');

  // balance 계산 공식이 테이블마다 다름
  const usesProduced = ['koji_ledger', 'starter_ledger', 'mash_ledger', 'lees_ledger', 'first_mash_ledger'].includes(table);
  const usesShipped = table === 'liquor_ledger';

  let inCol = usesProduced ? 'produced' : 'received';
  let outCol = usesShipped ? 'shipped' : 'used';

  // forward-walking: 이전 행의 balance를 다음 행의 carry_over로 세팅
  const { rows } = await client.query(
    `SELECT id, ledger_date, carry_over FROM ${table}
     WHERE ${filterCol} = $1 AND ledger_date >= $2
     ORDER BY ledger_date ASC, id ASC`,
    [filterVal, fromDate]
  );

  if (rows.length === 0) return;

  // 첫 행의 이전 balance 조회
  const { rows: prevRows } = await client.query(
    `SELECT balance FROM ${table}
     WHERE ${filterCol} = $1 AND ledger_date < $2
     ORDER BY ledger_date DESC, id DESC LIMIT 1`,
    [filterVal, fromDate]
  );
  let prevBalance = prevRows.length ? parseFloat(prevRows[0].balance) : 0;

  for (const row of rows) {
    const currentCarryOver = parseFloat(row.carry_over);
    if (Math.abs(currentCarryOver - prevBalance) > 0.001) {
      await client.query(
        `UPDATE ${table} SET carry_over = $1, updated_at = NOW() WHERE id = $2`,
        [prevBalance, row.id]
      );
    }
    // 갱신 후 balance 다시 조회 (GENERATED ALWAYS AS 컬럼이므로)
    const { rows: updated } = await client.query(
      `SELECT balance FROM ${table} WHERE id = $1`,
      [row.id]
    );
    prevBalance = updated.length ? parseFloat(updated[0].balance) : prevBalance;
  }
}

module.exports = { getLastBalance, resolveCarryOver, propagateCarryOver, ALLOWED_TABLES, ALLOWED_FILTER_COLS };
