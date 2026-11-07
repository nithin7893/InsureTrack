-- InsureTrack company catalogue migration (ROLLBACK)
--
-- Restores the exact pre-migration company names, Care policy references and
-- Care product references, and removes the 51 canonical entries inserted by
-- company_catalogue_up.sql. Uses the backup table created by the up script.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f company_catalogue_rollback.sql
--
-- The script drops _company_catalogue_backup on success, so it can only be
-- used once. The verified pg_dump backup remains the ultimate recovery path.

\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE companies IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE policies IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE product_master IN SHARE ROW EXCLUSIVE MODE;

DO $rollback_preconditions$
DECLARE
    v_int integer;
BEGIN
    IF to_regclass('_company_catalogue_backup') IS NULL THEN
        RAISE EXCEPTION 'Rollback failed: _company_catalogue_backup does not exist';
    END IF;

    SELECT count(*) INTO v_int FROM _company_catalogue_backup;
    IF v_int = 0 THEN
        RAISE EXCEPTION 'Rollback failed: _company_catalogue_backup is empty';
    END IF;

    SELECT count(*) INTO v_int FROM companies;
    IF v_int <> 70 THEN
        RAISE EXCEPTION 'Rollback precondition failed: expected 70 companies, found %', v_int;
    END IF;

    SELECT count(*) INTO v_int FROM _company_catalogue_backup WHERE entity = 'inserted_company';
    IF v_int <> 51 THEN
        RAISE EXCEPTION 'Rollback precondition failed: expected 51 inserted companies in backup, found %', v_int;
    END IF;
END
$rollback_preconditions$;

-- 1. Remove the 51 canonical entries inserted by the migration.
DELETE FROM companies
 WHERE id IN (SELECT row_id FROM _company_catalogue_backup WHERE entity = 'inserted_company');

-- 2. Restore the original Care policy company strings.
UPDATE policies p
   SET company = b.old_value
  FROM _company_catalogue_backup b
 WHERE b.entity = 'policies'
   AND p.id = b.row_id;

-- 3. Restore the original Care product company names.
UPDATE product_master m
   SET company_name = b.old_value
  FROM _company_catalogue_backup b
 WHERE b.entity = 'product_master'
   AND m.id = b.row_id;

-- 4. Restore the original 11 active company names.
UPDATE companies c
   SET name = b.old_value
  FROM _company_catalogue_backup b
 WHERE b.entity = 'companies'
   AND c.id = b.row_id;

DO $rollback_postconditions$
DECLARE
    v_int integer;
    v_num numeric;
BEGIN
    SELECT count(*) INTO v_int FROM companies;
    IF v_int <> 19 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 19 companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE is_active;
    IF v_int <> 11 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 11 active companies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE NOT is_active;
    IF v_int <> 8 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 8 inactive companies, found %', v_int; END IF;

    SELECT count(*) INTO v_int FROM companies WHERE id = 3 AND name = 'ICICI PRUDENTIAL LIFE INSURANCE COMPANY';
    IF v_int <> 1 THEN RAISE EXCEPTION 'Rollback postcondition failed: company 3 not restored'; END IF;
    SELECT count(*) INTO v_int FROM companies WHERE id = 17 AND name = 'CARE HEALTH INSURANCE COMPANY LIMITED';
    IF v_int <> 1 THEN RAISE EXCEPTION 'Rollback postcondition failed: company 17 not restored'; END IF;

    SELECT count(*) INTO v_int FROM policies;
    IF v_int <> 268 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 268 policies, found %', v_int; END IF;
    SELECT coalesce(sum(total_premium), 0) INTO v_num FROM policies;
    IF v_num <> 6328242 THEN RAISE EXCEPTION 'Rollback postcondition failed: total premium changed to %', v_num; END IF;
    SELECT count(*) INTO v_int FROM policies WHERE company = 'Care';
    IF v_int <> 194 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 194 Care policies, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM policies WHERE company = 'CARE HEALTH INSURANCE COMPANY LIMITED';
    IF v_int <> 72 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 72 canonical Care policies, found %', v_int; END IF;

    SELECT count(*) INTO v_int FROM product_master;
    IF v_int <> 7 THEN RAISE EXCEPTION 'Rollback postcondition failed: expected 7 product_master rows, found %', v_int; END IF;
    SELECT count(*) INTO v_int FROM product_master WHERE id IN (3, 4, 5, 6) AND company_name = 'CARE HEALTH INSURANCE COMPANY LIMITED';
    IF v_int <> 4 THEN RAISE EXCEPTION 'Rollback postcondition failed: Care product names not restored'; END IF;

    SELECT count(*) INTO v_int FROM policy_history;
    IF v_int <> 293 THEN RAISE EXCEPTION 'Rollback postcondition failed: policy_history rows changed to %', v_int; END IF;
END
$rollback_postconditions$;

DROP TABLE _company_catalogue_backup;

COMMIT;

\echo 'Company catalogue rollback completed successfully.'
