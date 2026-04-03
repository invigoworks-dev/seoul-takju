/**
 * 용기/마개 수불 장부 — 레퍼런스 기준 미사용 (INVA-37)
 * 모든 엔드포인트 404 반환
 */
const express = require('express');
const router = express.Router();

router.all('*', (req, res) => {
  res.status(404).json({ error: '용기/마개 수불 장부는 현재 사용하지 않습니다.' });
});

module.exports = router;
