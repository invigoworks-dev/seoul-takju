/**
 * 감사 추적 (Audit Trail) 유틸리티
 * 모든 장부 데이터 변경을 change_log 테이블에 기록
 */
const pool = require('./db');

/**
 * INSERT 작업 로깅
 */
async function logInsert(client, tableName, recordId, newData, userId) {
  const conn = client || pool;
  await conn.query(
    `INSERT INTO change_log (table_name, record_id, action, field_name, new_value, changed_by)
     VALUES ($1, $2, 'INSERT', NULL, $3, $4)`,
    [tableName, recordId, JSON.stringify(newData), userId || null]
  );
}

/**
 * UPDATE 작업 로깅 -- 변경된 필드만 기록
 */
async function logUpdate(client, tableName, recordId, oldData, newData, userId) {
  const conn = client || pool;
  const changes = [];
  for (const key of Object.keys(newData)) {
    if (key === 'updated_at' || key === 'id') continue;
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (String(oldVal) !== String(newVal)) {
      changes.push({ field: key, old: oldVal, new: newVal });
    }
  }

  for (const change of changes) {
    await conn.query(
      `INSERT INTO change_log (table_name, record_id, action, field_name, old_value, new_value, changed_by)
       VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6)`,
      [tableName, recordId, change.field, String(change.old ?? ''), String(change.new ?? ''), userId || null]
    );
  }
}

/**
 * DELETE 작업 로깅
 */
async function logDelete(client, tableName, recordId, oldData, userId) {
  const conn = client || pool;
  await conn.query(
    `INSERT INTO change_log (table_name, record_id, action, field_name, old_value, changed_by)
     VALUES ($1, $2, 'DELETE', NULL, $3, $4)`,
    [tableName, recordId, JSON.stringify(oldData), userId || null]
  );
}

module.exports = { logInsert, logUpdate, logDelete };
