/**
 * 월마감 체크 미들웨어
 * 마감된 월의 데이터에 대한 POST/PUT/DELETE를 차단
 */
const pool = require('../db');

async function isMonthClosed(yearMonth) {
  const { rows } = await pool.query(
    'SELECT id FROM monthly_close WHERE year_month = $1',
    [yearMonth]
  );
  return rows.length > 0;
}

/**
 * 요청 body의 ledger_date 또는 기존 레코드의 날짜를 기준으로 월마감 여부 확인
 * POST: req.body.ledger_date
 * PUT/DELETE: 기존 레코드의 ledger_date (미들웨어 호출 전에 조회 필요)
 */
function checkMonthlyClose(getDateFn) {
  return async (req, res, next) => {
    try {
      const date = typeof getDateFn === 'function' ? await getDateFn(req) : req.body.ledger_date;
      if (!date) return next();

      const yearMonth = date.substring(0, 7); // 'YYYY-MM'
      const closed = await isMonthClosed(yearMonth);
      if (closed) {
        return res.status(403).json({
          error: `${yearMonth} 월은 마감되었습니다. 데이터를 수정할 수 없습니다.`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { isMonthClosed, checkMonthlyClose };
