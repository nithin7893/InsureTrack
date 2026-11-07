-- InsureTrack company catalogue migration - POST-MIGRATION VERIFICATION
-- Read-only assertions. Raises and exits non-zero if any expectation fails.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f company_catalogue_verify.sql

\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    v_int integer;
    v_num numeric;
BEGIN
    SELECT count(*) INTO v_int FROM companies;
    IF v_int <> 70 THEN RAISE EXCEPTION 'Verify failed: expected 70 companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active;
    IF v_int <> 62 THEN RAISE EXCEPTION 'Verify failed: expected 62 active companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active;
    IF v_int <> 8 THEN RAISE EXCEPTION 'Verify failed: expected 8 inactive companies, found %', v_int; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Life';
    IF v_int <> 26 THEN RAISE EXCEPTION 'Verify failed: expected 26 active Life companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'Health';
    IF v_int <> 8 THEN RAISE EXCEPTION 'Verify failed: expected 8 active Health companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active AND insurance_type = 'General';
    IF v_int <> 28 THEN RAISE EXCEPTION 'Verify failed: expected 28 active General companies, found %', v_int; END IF;

    SELECT count(*) INTO v_int
      FROM (SELECT lower(name), insurance_type FROM companies WHERE is_active
             GROUP BY lower(name), insurance_type HAVING count(*) > 1) d;
    IF v_int <> 0 THEN RAISE EXCEPTION 'Verify failed: % duplicate active companies', v_int; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE id = 17 AND name = 'Care Health Insurance Ltd.' AND insurance_type = 'Health' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: Care ID 17 not canonical'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 14 AND name = 'Go Digit Life Insurance Limited.' AND insurance_type = 'Life' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: Go Digit Life ID 14 not canonical'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 18 AND name = 'Go Digit General Insurance Limited' AND insurance_type = 'General' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: Go Digit General ID 18 not canonical'; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active AND id IN (1, 2, 4, 5, 6, 8, 9, 10);
    IF v_int <> 8 THEN RAISE EXCEPTION 'Verify failed: inactive legacy companies changed'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 9 AND name = 'CARE HEALTH INSURANCE' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: inactive CARE HEALTH INSURANCE changed'; END IF;

    SELECT count(*) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Verify failed: expected 268 policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Verify failed: total premium changed to %', v_num; END IF;
    SELECT coalesce(sum(base_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Verify failed: base premium changed to %', v_num; END IF;
    SELECT coalesce(sum(gst), 0) INTO v_num FROM policies;
    IF v_num <> 0 THEN RAISE EXCEPTION 'Verify failed: GST changed to %', v_num; END IF;
    SELECT count(DISTINCT customer_name) INTO v_int FROM policies;
    IF v_int <> 253 THEN RAISE EXCEPTION 'Verify failed: customers changed to %', v_int; END IF;
    SELECT count(DISTINCT policy_number) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Verify failed: policy numbers changed to %', v_int; END IF;

    SELECT count(*) INTO v_int FROM policies WHERE company = 'Care Health Insurance Ltd.';
    IF v_int <> 266 THEN RAISE EXCEPTION 'Verify failed: expected 266 Care policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies WHERE company = 'Care Health Insurance Ltd.';
    IF v_num <> 6280022 THEN RAISE EXCEPTION 'Verify failed: Care premium changed to %', v_num; END IF;
    SELECT count(*) INTO v_int FROM policies WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
    IF v_int <> 0 THEN RAISE EXCEPTION 'Verify failed: % Care policies still legacy', v_int; END IF;

    SELECT count(*) INTO v_int FROM policies WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE';
    IF v_int <> 2 THEN RAISE EXCEPTION 'Verify failed: DIGIT GLOW policies changed'; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE';
    IF v_num <> 48220 THEN RAISE EXCEPTION 'Verify failed: DIGIT GLOW premium changed to %', v_num; END IF;

    SELECT count(*) INTO v_int FROM product_master;
    IF v_int <> 7 THEN RAISE EXCEPTION 'Verify failed: expected 7 products, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id IN (3, 4, 5, 6) AND company_name = 'Care Health Insurance Ltd.';
    IF v_int <> 4 THEN RAISE EXCEPTION 'Verify failed: Care product rows not normalized'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 1 AND company_name = 'lic' AND product_name = 'nit' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: product ID 1 changed'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 2 AND company_name = 'LIC' AND product_name = 'Term Plan' AND NOT is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: product ID 2 changed'; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id = 7 AND company_name = 'GO DIGIT GENERAL INSURANCE LIMITED' AND product_name = 'COMPREHENSIVE' AND is_active;
    IF v_int <> 1 THEN RAISE EXCEPTION 'Verify failed: product ID 7 changed'; END IF;

    SELECT count(*) INTO v_int FROM policy_history;
    IF v_int <> 293 THEN RAISE EXCEPTION 'Verify failed: policy_history changed to %', v_int; END IF;
END
$verify$;

\echo '=== Verification assertions passed ==='

SELECT insurance_type,
       count(*) FILTER (WHERE is_active) AS active,
       count(*) FILTER (WHERE NOT is_active) AS inactive,
       count(*) AS total
  FROM companies
 GROUP BY insurance_type
 ORDER BY insurance_type;

SELECT count(*) AS policies,
       coalesce(sum(total_premium), 0) AS total_premium,
       coalesce(sum(base_premium), 0) AS base_premium,
       coalesce(sum(gst), 0) AS gst,
       count(DISTINCT customer_name) AS customers,
       count(DISTINCT policy_number) AS policy_numbers
  FROM policies;

SELECT count(*) AS care_policies,
       coalesce(sum(total_premium), 0) AS care_premium
  FROM policies
 WHERE company = 'Care Health Insurance Ltd.';

SELECT count(*) AS product_master_rows FROM product_master;
SELECT count(*) AS policy_history_rows FROM policy_history;

COMMIT;
