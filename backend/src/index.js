require('dotenv').config();
const express = require('express');
const cors = require('cors');

const auth              = require('./routes/auth');
const users             = require('./routes/users');
const dailyStatus       = require('./routes/dailyStatus');
const materials         = require('./routes/materials');
const rawMaterial       = require('./routes/rawMaterial');
const fermentationAgent = require('./routes/fermentationAgent');
const koji              = require('./routes/koji');
const starter           = require('./routes/starter');
const mash              = require('./routes/mash');
const liquor            = require('./routes/liquor');
const lees              = require('./routes/lees');
const firstMash         = require('./routes/firstMash');
const container         = require('./routes/container');
const approvals         = require('./routes/approvals');
const ledgerExcel       = require('./routes/ledgerExcel');
const settings          = require('./routes/settings');
const monthlyClose      = require('./routes/monthlyClose');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// 인증
app.use('/api/auth',               auth);

// 사용자 관리
app.use('/api/users',              users);

// 현황일보 (핵심 기능)
app.use('/api/daily-status',       dailyStatus);

// 기준 데이터
app.use('/api/materials',          materials);

// 6대 수불 장부
app.use('/api/raw-material',       rawMaterial);
app.use('/api/fermentation-agent', fermentationAgent);
app.use('/api/koji',               koji);
app.use('/api/starter',            starter);
app.use('/api/mash',               mash);
app.use('/api/liquor',             liquor);
app.use('/api/lees',               lees);
app.use('/api/first-mash',         firstMash);
app.use('/api/container',          container);

// 승인 워크플로우
app.use('/api/approvals',          approvals);

// 엑셀 업로드/다운로드
app.use('/api/ledgers',            ledgerExcel);

// 설정 (업체정보, 전병이월)
app.use('/api/settings',           settings);

// 월마감 관리
app.use('/api/monthly-close',      monthlyClose);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`서울탁주 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
