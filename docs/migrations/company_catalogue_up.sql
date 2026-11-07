-- InsureTrack company catalogue migration (UP)
-- Target: production PostgreSQL database used by https://insuretrack.online
--
-- This script is transactional and one-shot. It must be run with
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f company_catalogue_up.sql
--
-- It performs only the intended catalogue/company-reference updates:
--   1. Renames the 11 existing active companies in place (IDs preserved).
--   2. Normalizes all 266 Care policies to "Care Health Insurance Ltd.".
--   3. Updates Care product_master rows IDs 3-6.
--   4. Inserts the 51 missing canonical insurer entries.
--   5. Verifies policy/customer/premium/product/history integrity.
--
-- It does NOT touch:
--   - the 8 inactive legacy companies,
--   - the 2 "DIGIT GLOW PLUS TERM LIFE INSURANCE" policies,
--   - product_master IDs 1, 2 and 7,
--   - any of the 293 policy_history snapshots.

\set ON_ERROR_STOP on

BEGIN;

-- Serialize the tables involved so no concurrent application write can
-- invalidate the preconditions or the post-assertions.
LOCK TABLE companies IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE policies IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE product_master IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE policy_history IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------
-- 1. Preconditions (raise before changing anything)
-- ---------------------------------------------------------------------------
DO $preconditions$
DECLARE
    v_int integer;
    v_num numeric;
    v_renames integer;
BEGIN
    SELECT count(*) INTO v_int FROM companies;
    IF v_int <> 19 THEN
        RAISE EXCEPTION 'Precondition failed: expected 19 companies, found %', v_int;
    END IF;

    SELECT count(*) INTO v_int FROM companies WHERE is_active;
    IF v_int <> 11 THEN
        RAISE EXCEPTION 'Precondition failed: expected 11 active companies, found %', v_int;
    END IF;

    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active;
    IF v_int <> 8 THEN
        RAISE EXCEPTION 'Precondition failed: expected 8 inactive companies, found %', v_int;
    END IF;

    SELECT count(*) INTO v_int FROM companies WHERE id > 19;
    IF v_int <> 0 THEN
        RAISE EXCEPTION 'Precondition failed: companies.id > 19 already exists (found %)', v_int;
    END IF;

    SELECT count(*) INTO v_renames
    FROM (VALUES
        (3,  'ICICI PRUDENTIAL LIFE INSURANCE COMPANY',          'Life'),
        (7,  'LIFE INSURANCE CORPORATION OF INDIA',              'Life'),
        (11, 'HDFC LIFE INSURANCE COMPANY LIMITED',              'Life'),
        (12, 'AXIS MAX LIFE INSURANCE LIMITED',                  'Life'),
        (13, 'TATA AIA LIFE INSURANCE COMPANY LIMITED',          'Life'),
        (14, 'GO DIGIT LIFE INSURANCE COMPANY LIMITED',          'Life'),
        (15, 'TATA AIG GENERAL INSURANCE COMPANY LIMITED',       'General'),
        (16, 'STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED', 'Health'),
        (17, 'CARE HEALTH INSURANCE COMPANY LIMITED',            'Health'),
        (18, 'GO DIGIT GENERAL INSURANCE LIMITED',               'General'),
        (19, 'THE NEW INDIA ASSURANCE COMPANY LIMITED',          'General')
    ) AS expected(id, name, insurance_type)
    JOIN companies c
      ON c.id = expected.id
     AND c.name = expected.name
     AND c.insurance_type = expected.insurance_type
     AND c.is_active;
    IF v_renames <> 11 THEN
        RAISE EXCEPTION 'Precondition failed: expected 11 matching active company rows, found %', v_renames;
    END IF;

    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Life';
    IF v_int <> 6 THEN RAISE EXCEPTION 'Precondition failed: expected 6 active Life companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Health';
    IF v_int <> 2 THEN RAISE EXCEPTION 'Precondition failed: expected 2 active Health companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'General';
    IF v_int <> 3 THEN RAISE EXCEPTION 'Precondition failed: expected 3 active General companies, found %', v_int; END IF;

    -- Re-query each policy aggregate individually so every assertion has a
    -- clear message.
    SELECT count(*) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Precondition failed: expected 268 policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Precondition failed: expected total premium 6328242, found %', v_num; END IF;
    SELECT coalesce(sum(base_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Precondition failed: expected base premium 6328242, found %', v_num; END IF;
    SELECT coalesce(sum(gst), 0) INTO v_num FROM policies;
    IF v_num <> 0 THEN RAISE EXCEPTION 'Precondition failed: expected GST 0, found %', v_num; END IF;
    SELECT count(DISTINCT customer_name) INTO v_int FROM policies;
    IF v_int <> 253 THEN RAISE EXCEPTION 'Precondition failed: expected 253 customers, found %', v_int; END IF;
    SELECT count(DISTINCT policy_number) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Precondition failed: expected 268 distinct policy numbers, found %', v_int; END IF;

    SELECT count(*) INTO v_int
      FROM policies
     WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
    IF v_int <> 266 THEN RAISE EXCEPTION 'Precondition failed: expected 266 Care policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num
      FROM policies
     WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
    IF v_num <> 6280022 THEN RAISE EXCEPTION 'Precondition failed: expected Care premium 6280022, found %', v_num; END IF;

    SELECT count(*) INTO v_int
      FROM policies
     WHERE company IN ('DIGIT GLOW PLUS TERM LIFE INSURANCE');
    IF v_int <> 2 THEN RAISE EXCEPTION 'Precondition failed: expected 2 DIGIT GLOW policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num
      FROM policies
     WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE';
    IF v_num <> 48220 THEN RAISE EXCEPTION 'Precondition failed: expected DIGIT GLOW premium 48220, found %', v_num; END IF;

    SELECT count(*) INTO v_int FROM product_master;
    IF v_int <> 7 THEN RAISE EXCEPTION 'Precondition failed: expected 7 product_master rows, found %', v_int; END IF;
    SELECT count(*) INTO v_int
      FROM product_master
     WHERE id IN (3, 4, 5, 6)
       AND company_name = 'CARE HEALTH INSURANCE COMPANY LIMITED'
       AND is_active;
    IF v_int <> 4 THEN RAISE EXCEPTION 'Precondition failed: expected 4 active Care products, found %', v_int; END IF;

    -- Product rows 1, 2 and 7 are intentionally preserved verbatim, including
    -- the legacy uppercase Go Digit General company name.
    SELECT count(*) INTO v_int
      FROM product_master
     WHERE id = 1
       AND company_name = 'lic'
       AND product_name = 'nit'
       AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Precondition failed: product_master ID 1 does not match the expected legacy row'; END IF;
    SELECT count(*) INTO v_int
      FROM product_master
     WHERE id = 2
       AND company_name = 'LIC'
       AND product_name = 'Term Plan'
       AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Precondition failed: product_master ID 2 does not match the expected legacy row'; END IF;
    SELECT count(*) INTO v_int
      FROM product_master
     WHERE id = 7
       AND company_name = 'GO DIGIT GENERAL INSURANCE LIMITED'
       AND product_name = 'COMPREHENSIVE'
       AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Precondition failed: product_master ID 7 does not match the expected preserved row'; END IF;

    SELECT count(*) INTO v_int FROM policy_history;
    IF v_int <> 293 THEN RAISE EXCEPTION 'Precondition failed: expected 293 policy_history rows, found %', v_int; END IF;
END
$preconditions$;

-- ---------------------------------------------------------------------------
-- 2. Backup the exact rows that will be changed (used by the rollback script)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _company_catalogue_backup (
    entity    text    NOT NULL,
    row_id    integer NOT NULL,
    old_value text,
    PRIMARY KEY (entity, row_id)
);
TRUNCATE _company_catalogue_backup;

INSERT INTO _company_catalogue_backup (entity, row_id, old_value)
SELECT 'companies', id, name
  FROM companies
 WHERE id IN (3, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19);

INSERT INTO _company_catalogue_backup (entity, row_id, old_value)
SELECT 'policies', id, company
  FROM policies
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');

INSERT INTO _company_catalogue_backup (entity, row_id, old_value)
SELECT 'product_master', id, company_name
  FROM product_master
 WHERE id IN (3, 4, 5, 6);

-- ---------------------------------------------------------------------------
-- 3. Rename the 11 existing active companies in place
-- ---------------------------------------------------------------------------
UPDATE companies SET name = 'ICICI Life Insurance Company Limited'          WHERE id = 3;
UPDATE companies SET name = 'Life Insurance Corporation of India'           WHERE id = 7;
UPDATE companies SET name = 'HDFC Life Insurance Company Limited'           WHERE id = 11;
UPDATE companies SET name = 'Axis Max Life Insurance Limited'               WHERE id = 12;
UPDATE companies SET name = 'TATA AIA Life Insurance Company Limited'       WHERE id = 13;
UPDATE companies SET name = 'Go Digit Life Insurance Limited.'              WHERE id = 14;
UPDATE companies SET name = 'Tata AIG General Insurance Company Limited'    WHERE id = 15;
UPDATE companies SET name = 'Star Health & Allied Insurance Co.Ltd.'        WHERE id = 16;
UPDATE companies SET name = 'Care Health Insurance Ltd.'                    WHERE id = 17;
UPDATE companies SET name = 'Go Digit General Insurance Limited'            WHERE id = 18;
UPDATE companies SET name = 'The New India Assurance Company Limited'       WHERE id = 19;

-- ---------------------------------------------------------------------------
-- 4. Normalize Care references
-- ---------------------------------------------------------------------------
UPDATE policies
   SET company = 'Care Health Insurance Ltd.'
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');

UPDATE product_master
   SET company_name = 'Care Health Insurance Ltd.'
 WHERE id IN (3, 4, 5, 6)
   AND company_name = 'CARE HEALTH INSURANCE COMPANY LIMITED';

-- ---------------------------------------------------------------------------
-- 5. Insert the 51 missing canonical entries
-- ---------------------------------------------------------------------------
INSERT INTO companies (name, insurance_type, is_active, created_at)
SELECT v.name, v.insurance_type, TRUE, NOW()
  FROM (VALUES
    -- Life (20 new)
    ('Mahindra Life Insurance Company Limited', 'Life'),
    ('Aditya Birla SunLife Insurance Company Limited', 'Life'),
    ('SBI Life Insurance Company Limited', 'Life'),
    ('Bajaj Life Insurance Limited', 'Life'),
    ('MetLife India Insurance Company Limited', 'Life'),
    ('IndusInd Nippon Life Insurance Company Limited', 'Life'),
    ('Aviva Life Insurance Company India Limited', 'Life'),
    ('Sahara India Life Insurance Company Limited', 'Life'),
    ('Shriram Life Insurance Company Limited', 'Life'),
    ('Bharti Life Ins Co Ltd', 'Life'),
    ('Generali Central Life Insurance Company Limited', 'Life'),
    ('Federal Life Insurance Company Limited', 'Life'),
    ('Canara HSBC Life Insurance Company Limited', 'Life'),
    ('Bandhan Life Insurance Limited', 'Life'),
    ('Pramerica Life Insurance Company Limited', 'Life'),
    ('Star Union Dai-Ichi Life Insurance Company Limited', 'Life'),
    ('IndiaFirst Life Insurance Company Limited', 'Life'),
    ('Edelweiss Life Insurance Company Limited', 'Life'),
    ('CreditAccess Life Insurance Limited', 'Life'),
    ('Acko Life Insurance Limited', 'Life'),
    -- Health (6 new)
    ('Aditya Birla Health Insurance Co. Ltd.', 'Health'),
    ('Galaxy Health Insurance Company Limited', 'Health'),
    ('Narayana Health Insurance Ltd.', 'Health'),
    ('Manipal Cigna Health Insurance Company Limited', 'Health'),
    ('Niva Bupa Health Insurance Co Ltd.', 'Health'),
    ('Prudential HCL Health Insurance Limited', 'Health'),
    -- General (25 new)
    ('Acko General Insurance Limited', 'General'),
    ('Agriculture Insurance Company of India Limited', 'General'),
    ('Bajaj General Insurance Limited', 'General'),
    ('Cholamandalam MS General Insurance Company Limited', 'General'),
    ('ECGC Limited', 'General'),
    ('Generali Central Insurance Company Limited', 'General'),
    ('HDFC ERGO General Insurance Company Limited', 'General'),
    ('ICICI LOMBARD General Insurance Company Limited', 'General'),
    ('IFFCO TOKIO General Insurance Company Limited', 'General'),
    ('Zurich Kotak General Insurance Company (India) Limited', 'General'),
    ('Kshema General Insurance Limited', 'General'),
    ('Magma General Insurance Limited', 'General'),
    ('National Insurance Company Limited', 'General'),
    ('Liberty General Insurance Limited', 'General'),
    ('Navi General Insurance Limited', 'General'),
    ('Raheja QBE General Insurance Co. Ltd.', 'General'),
    ('IndusInd General Insurance Company Limited', 'General'),
    ('Royal Sundaram General Insurance Company Limited', 'General'),
    ('SBI General Insurance Company Limited', 'General'),
    ('Shriram General Insurance Company Limited', 'General'),
    ('The Oriental Insurance Company Limited', 'General'),
    ('United India Insurance Company Limited', 'General'),
    ('Universal Sompo General Insurance Company Limited', 'General'),
    ('Zuno General Insurance Ltd.', 'General'),
    ('Kiwi General Insurance Limited', 'General')
  ) AS v(name, insurance_type)
 WHERE NOT EXISTS (
     SELECT 1 FROM companies c
      WHERE c.insurance_type = v.insurance_type
        AND lower(c.name) = lower(v.name)
 );

-- Capture exactly the new IDs for rollback. All pre-existing IDs are <= 19
-- (asserted above), so this identifies only the rows just inserted.
INSERT INTO _company_catalogue_backup (entity, row_id, old_value)
SELECT 'inserted_company', id, name
  FROM companies
 WHERE id > 19
   AND is_active;

-- ---------------------------------------------------------------------------
-- 6. Post-assertions
-- ---------------------------------------------------------------------------
DO $postconditions$
DECLARE
    v_int integer;
    v_num numeric;
BEGIN
    SELECT count(*) INTO v_int FROM companies;
    IF v_int <> 70 THEN RAISE EXCEPTION 'Postcondition failed: expected 70 companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active;
    IF v_int <> 62 THEN RAISE EXCEPTION 'Postcondition failed: expected 62 active companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active;
    IF v_int <> 8 THEN RAISE EXCEPTION 'Postcondition failed: expected 8 inactive companies, found %', v_int; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Life';
    IF v_int <> 26 THEN RAISE EXCEPTION 'Postcondition failed: expected 26 active Life companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Health';
    IF v_int <> 8 THEN RAISE EXCEPTION 'Postcondition failed: expected 8 active Health companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'General';
    IF v_int <> 28 THEN RAISE EXCEPTION 'Postcondition failed: expected 28 active General companies, found %', v_int; END IF;

    SELECT count(*) INTO v_int
      FROM (
        SELECT lower(name), insurance_type
          FROM companies
         WHERE is_active
         GROUP BY lower(name), insurance_type
        HAVING count(*) > 1
      ) duplicates;
    IF v_int <> 0 THEN RAISE EXCEPTION 'Postcondition failed: % duplicate active company names', v_int; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE id = 17 AND name = 'Care Health Insurance Ltd.' AND insurance_type = 'Health' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: Care company ID 17 not normalized correctly'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 14 AND name = 'Go Digit Life Insurance Limited.' AND insurance_type = 'Life' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: Go Digit Life company ID 14 not normalized correctly'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 18 AND name = 'Go Digit General Insurance Limited' AND insurance_type = 'General' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: Go Digit General company ID 18 not normalized correctly'; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active AND id IN (1, 2, 4, 5, 6, 8, 9, 10);
    IF v_int <> 8 THEN RAISE EXCEPTION 'Postcondition failed: inactive legacy companies changed'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 1 AND name = 'lic' AND insurance_type = 'Life' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: inactive company 1 changed'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 9 AND name = 'CARE HEALTH INSURANCE' AND insurance_type = 'Health' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: inactive company 9 changed'; END IF;

    SELECT count(*) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Postcondition failed: expected 268 policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Postcondition failed: total premium changed to %', v_num; END IF;
    SELECT coalesce(sum(base_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Postcondition failed: base premium changed to %', v_num; END IF;
    SELECT coalesce(sum(gst), 0) INTO v_num FROM policies;
    IF v_num <> 0 THEN RAISE EXCEPTION 'Postcondition failed: GST changed to %', v_num; END IF;
    SELECT count(DISTINCT customer_name) INTO v_int FROM policies;
    IF v_int <> 253 THEN RAISE EXCEPTION 'Postcondition failed: customer count changed to %', v_int; END IF;
    SELECT count(DISTINCT policy_number) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Postcondition failed: policy number count changed to %', v_int; END IF;

    SELECT count(*) INTO v_int FROM policies WHERE company = 'Care Health Insurance Ltd.';
    IF v_int <> 266 THEN RAISE EXCEPTION 'Postcondition failed: expected 266 normalized Care policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies WHERE company = 'Care Health Insurance Ltd.';
    IF v_num <> 6280022 THEN RAISE EXCEPTION 'Postcondition failed: Care premium changed to %', v_num; END IF;
    SELECT count(*) INTO v_int FROM policies WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
    IF v_int <> 0 THEN RAISE EXCEPTION 'Postcondition failed: % Care policies still use a legacy name', v_int; END IF;

    SELECT count(*) INTO v_int FROM policies WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE';
    IF v_int <> 2 THEN RAISE EXCEPTION 'Postcondition failed: DIGIT GLOW policies changed'; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE';
    IF v_num <> 48220 THEN RAISE EXCEPTION 'Postcondition failed: DIGIT GLOW premium changed to %', v_num; END IF;

    SELECT count(*) INTO v_int FROM product_master;
    IF v_int <> 7 THEN RAISE EXCEPTION 'Postcondition failed: expected 7 product_master rows, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id IN (3, 4, 5, 6) AND company_name = 'Care Health Insurance Ltd.';
    IF v_int <> 4 THEN RAISE EXCEPTION 'Postcondition failed: Care product rows not normalized'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 1 AND company_name = 'lic' AND product_name = 'nit' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: product_master ID 1 changed'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 2 AND company_name = 'LIC' AND product_name = 'Term Plan' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: product_master ID 2 changed'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 7 AND company_name = 'GO DIGIT GENERAL INSURANCE LIMITED' AND product_name = 'COMPREHENSIVE' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Postcondition failed: product_master ID 7 changed'; END IF;

    SELECT count(*) INTO v_int FROM policy_history;
    IF v_int <> 293 THEN RAISE EXCEPTION 'Postcondition failed: policy_history row count changed to %', v_int; END IF;
END
$postconditions$;

COMMIT;

\echo 'Company catalogue migration completed successfully.'
\echo 'Rollback backup table: _company_catalogue_backup'
