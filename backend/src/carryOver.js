/**
 * 이월(carry_over) 자동계산 유틸리티
 * 전일 잔량(balance)을 당일 이월로 자동 반영
 */
const pool = require('./db');

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

module.exports = { getLastBalance, resolveCarryOver };
