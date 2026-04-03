-- ============================================================
-- 레퍼런스 기준 장부 DB 스키마 재구축
-- INVA-37: 레퍼런스 파일 기준 도메인 특화 컬럼 추가
-- ============================================================

-- -------------------------------------------------------
-- 1. koji_ledger (입국 수불)
-- -------------------------------------------------------
ALTER TABLE koji_ledger
  ADD COLUMN IF NOT EXISTS person  VARCHAR(100),            -- 담당자
  ADD COLUMN IF NOT EXISTS ms_cnt  DECIMAL(8,1),            -- 담금예정개수-밑술(개)
  ADD COLUMN IF NOT EXISTS sd_cnt  DECIMAL(8,1),            -- 담금예정개수-술덧(개)
  ADD COLUMN IF NOT EXISTS ms_raw  DECIMAL(10,3),           -- 원료수량-밑술(kg)
  ADD COLUMN IF NOT EXISTS sd_raw  DECIMAL(10,3),           -- 원료수량-술덧(kg)
  ADD COLUMN IF NOT EXISTS ms_b    VARCHAR(50),             -- 담금용기순호-밑술 작업전
  ADD COLUMN IF NOT EXISTS ms_a    VARCHAR(50),             -- 담금용기순호-밑술 작업후
  ADD COLUMN IF NOT EXISTS sd_b    VARCHAR(50),             -- 담금용기순호-술덧 작업전
  ADD COLUMN IF NOT EXISTS sd_a    VARCHAR(50);             -- 담금용기순호-술덧 작업후

COMMENT ON COLUMN koji_ledger.person  IS '담당자';
COMMENT ON COLUMN koji_ledger.ms_cnt  IS '담금예정개수-밑술(개)';
COMMENT ON COLUMN koji_ledger.sd_cnt  IS '담금예정개수-술덧(개)';
COMMENT ON COLUMN koji_ledger.ms_raw  IS '원료수량-밑술(kg)';
COMMENT ON COLUMN koji_ledger.sd_raw  IS '원료수량-술덧(kg)';
COMMENT ON COLUMN koji_ledger.ms_b    IS '담금용기순호-밑술 작업전';
COMMENT ON COLUMN koji_ledger.ms_a    IS '담금용기순호-밑술 작업후';
COMMENT ON COLUMN koji_ledger.sd_b    IS '담금용기순호-술덧 작업전';
COMMENT ON COLUMN koji_ledger.sd_a    IS '담금용기순호-술덧 작업후';

-- -------------------------------------------------------
-- 2. mash_ledger (술덧담금 및 걸름)
-- 기존 carry_over NOT NULL DEFAULT 0 컬럼은 그대로 유지
-- -------------------------------------------------------
ALTER TABLE mash_ledger
  ADD COLUMN IF NOT EXISTS bno    VARCHAR(50),              -- 담금번호
  ADD COLUMN IF NOT EXISTS rtype  VARCHAR(100),             -- 원료종류
  ADD COLUMN IF NOT EXISTS rice   DECIMAL(10,3),            -- 원료-쌀(kg)
  ADD COLUMN IF NOT EXISTS water  DECIMAL(10,3),            -- 원료-물(L)
  ADD COLUMN IF NOT EXISTS yeast  DECIMAL(10,3),            -- 원료-효모(g)
  ADD COLUMN IF NOT EXISTS koji   DECIMAL(10,3),            -- 원료-입국(kg)
  ADD COLUMN IF NOT EXISTS fvol   DECIMAL(10,3),            -- 담금량(L)
  ADD COLUMN IF NOT EXISTS fdate  DATE,                     -- 걸름일자
  ADD COLUMN IF NOT EXISTS filt   DECIMAL(10,3),            -- 걸른량(L)
  ADD COLUMN IF NOT EXISTS alc    DECIMAL(5,2),             -- 주정분(%)
  ADD COLUMN IF NOT EXISTS acid   DECIMAL(5,2);             -- 산도

COMMENT ON COLUMN mash_ledger.bno   IS '담금번호';
COMMENT ON COLUMN mash_ledger.rtype IS '원료종류';
COMMENT ON COLUMN mash_ledger.rice  IS '원료-쌀(kg)';
COMMENT ON COLUMN mash_ledger.water IS '원료-물(L)';
COMMENT ON COLUMN mash_ledger.yeast IS '원료-효모(g)';
COMMENT ON COLUMN mash_ledger.koji  IS '원료-입국(kg)';
COMMENT ON COLUMN mash_ledger.fvol  IS '담금량(L)';
COMMENT ON COLUMN mash_ledger.fdate IS '걸름일자';
COMMENT ON COLUMN mash_ledger.filt  IS '걸른량(L)';
COMMENT ON COLUMN mash_ledger.alc   IS '주정분(%)';
COMMENT ON COLUMN mash_ledger.acid  IS '산도';

-- -------------------------------------------------------
-- 3. lees_ledger (술지거미 수불)
-- -------------------------------------------------------
ALTER TABLE lees_ledger
  ADD COLUMN IF NOT EXISTS person  VARCHAR(100),            -- 담당자
  ADD COLUMN IF NOT EXISTS inc     DECIMAL(10,3),           -- 발생량(kg)
  ADD COLUMN IF NOT EXISTS method  VARCHAR(200),            -- 처리방법
  ADD COLUMN IF NOT EXISTS out     DECIMAL(10,3);           -- 처리량(kg)

COMMENT ON COLUMN lees_ledger.person IS '담당자';
COMMENT ON COLUMN lees_ledger.inc    IS '발생량(kg)';
COMMENT ON COLUMN lees_ledger.method IS '처리방법';
COMMENT ON COLUMN lees_ledger.out    IS '처리량(kg)';

-- -------------------------------------------------------
-- 4. first_mash_ledger (1차 술덧 담금)
-- -------------------------------------------------------
ALTER TABLE first_mash_ledger
  ADD COLUMN IF NOT EXISTS bno_b      VARCHAR(50),          -- 담금순호 시작전
  ADD COLUMN IF NOT EXISTS bno_a      VARCHAR(50),          -- 담금순호 시작후
  ADD COLUMN IF NOT EXISTS ctnr_no    VARCHAR(50),          -- 용기번호
  ADD COLUMN IF NOT EXISTS inc_depth  VARCHAR(50),          -- 담금 입실심
  ADD COLUMN IF NOT EXISTS inc_vol    DECIMAL(10,3),        -- 담금 용량(L)
  ADD COLUMN IF NOT EXISTS chk_date   DATE,                 -- 숙성검사 일자
  ADD COLUMN IF NOT EXISTS chk_depth  VARCHAR(50),          -- 숙성검사 심도
  ADD COLUMN IF NOT EXISTS chk_vol    DECIMAL(10,3),        -- 숙성검사 용량(L)
  ADD COLUMN IF NOT EXISTS bno2_b     VARCHAR(50),          -- 2차담금순호 시작전
  ADD COLUMN IF NOT EXISTS bno2_a     VARCHAR(50);          -- 2차담금순호 시작후

COMMENT ON COLUMN first_mash_ledger.bno_b     IS '담금순호 시작전';
COMMENT ON COLUMN first_mash_ledger.bno_a     IS '담금순호 시작후';
COMMENT ON COLUMN first_mash_ledger.ctnr_no   IS '용기번호';
COMMENT ON COLUMN first_mash_ledger.inc_depth IS '담금 입실심';
COMMENT ON COLUMN first_mash_ledger.inc_vol   IS '담금 용량(L)';
COMMENT ON COLUMN first_mash_ledger.chk_date  IS '숙성검사 일자';
COMMENT ON COLUMN first_mash_ledger.chk_depth IS '숙성검사 심도';
COMMENT ON COLUMN first_mash_ledger.chk_vol   IS '숙성검사 용량(L)';
COMMENT ON COLUMN first_mash_ledger.bno2_b    IS '2차담금순호 시작전';
COMMENT ON COLUMN first_mash_ledger.bno2_a    IS '2차담금순호 시작후';

-- -------------------------------------------------------
-- 5. starter_ledger (밑술 제조)
-- -------------------------------------------------------
ALTER TABLE starter_ledger
  ADD COLUMN IF NOT EXISTS insp_date   DATE,                -- 검사 월일
  ADD COLUMN IF NOT EXISTS insp_person VARCHAR(100),        -- 검사인
  ADD COLUMN IF NOT EXISTS symbol      VARCHAR(50),         -- 기호
  ADD COLUMN IF NOT EXISTS bno_b       VARCHAR(50),         -- 담금순호 시작전
  ADD COLUMN IF NOT EXISTS bno_a       VARCHAR(50),         -- 담금순호 시작후
  ADD COLUMN IF NOT EXISTS ctnr_no     VARCHAR(50),         -- 용기번호
  ADD COLUMN IF NOT EXISTS inc_date    DATE,                -- 담금 일자
  ADD COLUMN IF NOT EXISTS inc_depth   VARCHAR(50),         -- 담금 심도
  ADD COLUMN IF NOT EXISTS inc_vol     DECIMAL(10,3),       -- 담금 용량(L)
  ADD COLUMN IF NOT EXISTS chk_date    DATE,                -- 숙성검사 일자
  ADD COLUMN IF NOT EXISTS chk_depth   VARCHAR(50),         -- 숙성검사 심도
  ADD COLUMN IF NOT EXISTS chk_vol     DECIMAL(10,3),       -- 숙성검사 용량(L)
  ADD COLUMN IF NOT EXISTS chk_rate    DECIMAL(5,2),        -- 숙성검사 비율
  ADD COLUMN IF NOT EXISTS mash_bno_b  VARCHAR(50),         -- 술덧순호 시작전
  ADD COLUMN IF NOT EXISTS mash_bno_a  VARCHAR(50);         -- 술덧순호 시작후

COMMENT ON COLUMN starter_ledger.insp_date   IS '검사 월일';
COMMENT ON COLUMN starter_ledger.insp_person IS '검사인';
COMMENT ON COLUMN starter_ledger.symbol      IS '기호';
COMMENT ON COLUMN starter_ledger.bno_b       IS '담금순호 시작전';
COMMENT ON COLUMN starter_ledger.bno_a       IS '담금순호 시작후';
COMMENT ON COLUMN starter_ledger.ctnr_no     IS '용기번호';
COMMENT ON COLUMN starter_ledger.inc_date    IS '담금 일자';
COMMENT ON COLUMN starter_ledger.inc_depth   IS '담금 심도';
COMMENT ON COLUMN starter_ledger.inc_vol     IS '담금 용량(L)';
COMMENT ON COLUMN starter_ledger.chk_date    IS '숙성검사 일자';
COMMENT ON COLUMN starter_ledger.chk_depth   IS '숙성검사 심도';
COMMENT ON COLUMN starter_ledger.chk_vol     IS '숙성검사 용량(L)';
COMMENT ON COLUMN starter_ledger.chk_rate    IS '숙성검사 비율';
COMMENT ON COLUMN starter_ledger.mash_bno_b  IS '술덧순호 시작전';
COMMENT ON COLUMN starter_ledger.mash_bno_a  IS '술덧순호 시작후';

-- -------------------------------------------------------
-- 6. liquor_ledger (주류 수불)
-- -------------------------------------------------------
ALTER TABLE liquor_ledger
  ADD COLUMN IF NOT EXISTS person    VARCHAR(100),          -- 담당자
  ADD COLUMN IF NOT EXISTS bno_b     VARCHAR(50),           -- 담금순호 사용전
  ADD COLUMN IF NOT EXISTS bno_a     VARCHAR(50),           -- 담금순호 사용후
  ADD COLUMN IF NOT EXISTS inc       DECIMAL(10,3),         -- 걸름수량(L)
  ADD COLUMN IF NOT EXISTS out       DECIMAL(10,3),         -- 출고수량(L)
  ADD COLUMN IF NOT EXISTS price     DECIMAL(12,0),         -- 가격(원)
  ADD COLUMN IF NOT EXISTS driver    VARCHAR(100),          -- 배달자
  ADD COLUMN IF NOT EXISTS dest      VARCHAR(200),          -- 매도처
  ADD COLUMN IF NOT EXISTS remain    DECIMAL(10,3),         -- 잔수량(L) 직접입력
  ADD COLUMN IF NOT EXISTS loss      DECIMAL(10,3),         -- 결감수량
  ADD COLUMN IF NOT EXISTS loss_rate DECIMAL(5,2);          -- 결감비율(%)

COMMENT ON COLUMN liquor_ledger.person    IS '담당자';
COMMENT ON COLUMN liquor_ledger.bno_b     IS '담금순호 사용전';
COMMENT ON COLUMN liquor_ledger.bno_a     IS '담금순호 사용후';
COMMENT ON COLUMN liquor_ledger.inc       IS '걸름수량(L)';
COMMENT ON COLUMN liquor_ledger.out       IS '출고수량(L)';
COMMENT ON COLUMN liquor_ledger.price     IS '가격(원)';
COMMENT ON COLUMN liquor_ledger.driver    IS '배달자';
COMMENT ON COLUMN liquor_ledger.dest      IS '매도처';
COMMENT ON COLUMN liquor_ledger.remain    IS '잔수량(L) 직접입력';
COMMENT ON COLUMN liquor_ledger.loss      IS '결감수량';
COMMENT ON COLUMN liquor_ledger.loss_rate IS '결감비율(%)';

-- -------------------------------------------------------
-- 7. raw_material_ledger (원료 수불)
-- rice 타입(평화미/백미) 및 simple 타입(효모/곡자 등) 공통 컬럼
-- -------------------------------------------------------
ALTER TABLE raw_material_ledger
  ADD COLUMN IF NOT EXISTS raw_type  VARCHAR(20) DEFAULT 'simple', -- 원료타입: 'rice' | 'simple'
  ADD COLUMN IF NOT EXISTS person    VARCHAR(100),          -- 담당자
  ADD COLUMN IF NOT EXISTS price     DECIMAL(12,0),         -- 단가(원)
  ADD COLUMN IF NOT EXISTS src       VARCHAR(200),          -- 공급처/출처
  -- rice 타입: 2차/3차/4차 담금 용기순호 및 사용량
  ADD COLUMN IF NOT EXISTS s2a       VARCHAR(50),           -- 2차담금 용기순호 작업전
  ADD COLUMN IF NOT EXISTS s2b       VARCHAR(50),           -- 2차담금 용기순호 작업후
  ADD COLUMN IF NOT EXISTS u2        DECIMAL(10,3),         -- 2차담금 사용량
  ADD COLUMN IF NOT EXISTS s3a       VARCHAR(50),           -- 3차담금 용기순호 작업전
  ADD COLUMN IF NOT EXISTS s3b       VARCHAR(50),           -- 3차담금 용기순호 작업후
  ADD COLUMN IF NOT EXISTS u3        DECIMAL(10,3),         -- 3차담금 사용량
  ADD COLUMN IF NOT EXISTS s4a       VARCHAR(50),           -- 4차담금 용기순호 작업전
  ADD COLUMN IF NOT EXISTS s4b       VARCHAR(50),           -- 4차담금 용기순호 작업후
  ADD COLUMN IF NOT EXISTS u4        DECIMAL(10,3),         -- 4차담금 사용량
  -- simple 타입 전용
  ADD COLUMN IF NOT EXISTS type_name VARCHAR(100),          -- 종별(효모/곡자/아스파탐/구연산)
  ADD COLUMN IF NOT EXISTS ms        DECIMAL(10,3),         -- 사용-밑술
  ADD COLUMN IF NOT EXISTS sd        DECIMAL(10,3),         -- 사용-술덧
  ADD COLUMN IF NOT EXISTS red       DECIMAL(10,3),         -- 결감수량
  ADD COLUMN IF NOT EXISTS mbal      DECIMAL(10,3);         -- 현재수량 직접입력(자동계산 덮어씀)

COMMENT ON COLUMN raw_material_ledger.raw_type  IS '원료타입: rice(평화미/백미) | simple(효모/곡자 등)';
COMMENT ON COLUMN raw_material_ledger.person    IS '담당자';
COMMENT ON COLUMN raw_material_ledger.price     IS '단가(원)';
COMMENT ON COLUMN raw_material_ledger.src       IS '공급처/출처';
COMMENT ON COLUMN raw_material_ledger.s2a       IS '2차담금 용기순호 작업전';
COMMENT ON COLUMN raw_material_ledger.s2b       IS '2차담금 용기순호 작업후';
COMMENT ON COLUMN raw_material_ledger.u2        IS '2차담금 사용량';
COMMENT ON COLUMN raw_material_ledger.s3a       IS '3차담금 용기순호 작업전';
COMMENT ON COLUMN raw_material_ledger.s3b       IS '3차담금 용기순호 작업후';
COMMENT ON COLUMN raw_material_ledger.u3        IS '3차담금 사용량';
COMMENT ON COLUMN raw_material_ledger.s4a       IS '4차담금 용기순호 작업전';
COMMENT ON COLUMN raw_material_ledger.s4b       IS '4차담금 용기순호 작업후';
COMMENT ON COLUMN raw_material_ledger.u4        IS '4차담금 사용량';
COMMENT ON COLUMN raw_material_ledger.type_name IS '종별(효모/곡자/아스파탐/구연산)';
COMMENT ON COLUMN raw_material_ledger.ms        IS '사용-밑술';
COMMENT ON COLUMN raw_material_ledger.sd        IS '사용-술덧';
COMMENT ON COLUMN raw_material_ledger.red       IS '결감수량';
COMMENT ON COLUMN raw_material_ledger.mbal      IS '현재수량 직접입력(자동계산 덮어씀)';
