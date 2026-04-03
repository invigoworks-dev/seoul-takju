function errorHandler(err, req, res, next) {
  console.error(err.stack);
  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: '중복된 레코드입니다. (날짜/품목 조합이 이미 존재합니다.)' });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: '참조된 데이터가 존재하지 않습니다.' });
  }
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
}

module.exports = errorHandler;
