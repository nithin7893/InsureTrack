-- InsureTrack company catalogue migration - READ-ONLY preview / dry run
--
-- Run with:
--   psql "$DATABASE_URL" -P pager=off -f company_catalogue_preview.sql
--
-- This file contains SELECT statements only. It does not modify data.

\echo '=== 1. Current company counts ==='
SELECT insurance_type,
       count(*) FILTER (WHERE is_active) AS active,
       count(*) FILTER (WHERE NOT is_active) AS inactive,
       count(*) AS total
  FROM companies
 GROUP BY insurance_type
 ORDER BY insurance_type;
SELECT count(*) AS total,
       count(*) FILTER (WHERE is_active) AS active,
       count(*) FILTER (WHERE NOT is_active) AS inactive
  FROM companies;

\echo '=== 2. Planned in-place renames (11 rows) ==='
SELECT c.id,
       c.insurance_type,
       c.name AS old_name,
       v.new_name
  FROM (VALUES
        (3,  'ICICI Life Insurance Company Limited'),
        (7,  'Life Insurance Corporation of India'),
        (11, 'HDFC Life Insurance Company Limited'),
        (12, 'Axis Max Life Insurance Limited'),
        (13, 'TATA AIA Life Insurance Company Limited'),
        (14, 'Go Digit Life Insurance Limited.'),
        (15, 'Tata AIG General Insurance Company Limited'),
        (16, 'Star Health & Allied Insurance Co.Ltd.'),
        (17, 'Care Health Insurance Ltd.'),
        (18, 'Go Digit General Insurance Limited'),
        (19, 'The New India Assurance Company Limited')
       ) AS v(id, new_name)
  JOIN companies c ON c.id = v.id
 ORDER BY c.id;

\echo '=== 3. Care reconciliation: by current company string ==='
SELECT company,
       count(*) AS policies,
       coalesce(sum(total_premium), 0) AS premium,
       count(DISTINCT policy_number) AS policy_numbers,
       count(DISTINCT customer_name) AS customers
  FROM policies
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED')
 GROUP BY company
 ORDER BY company;

\echo '=== 4. Care reconciliation: by company and sub_category ==='
SELECT company,
       coalesce(nullif(sub_category, ''), '(blank)') AS sub_category,
       count(*) AS policies,
       coalesce(sum(total_premium), 0) AS premium
  FROM policies
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED')
 GROUP BY company, coalesce(nullif(sub_category, ''), '(blank)')
 ORDER BY company, sub_category;

\echo '=== 5. Care reconciliation: combined totals ==='
SELECT count(*) AS policies,
       coalesce(sum(total_premium), 0) AS premium,
       count(DISTINCT policy_number) AS policy_numbers,
       count(DISTINCT customer_name) AS customers
  FROM policies
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');

\echo '=== 6. Every policy row whose company string will change (266 rows) ==='
SELECT id,
       policy_number,
       company AS old_company,
       'Care Health Insurance Ltd.' AS new_company,
       insurance_type,
       sub_category,
       total_premium
  FROM policies
 WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED')
 ORDER BY id;

\echo '=== 7. Product master rows that will change (IDs 3-6) ==='
SELECT id,
       insurance_type,
       company_name AS old_company_name,
       'Care Health Insurance Ltd.' AS new_company_name,
       product_category,
       product_name,
       is_active
  FROM product_master
 WHERE id IN (3, 4, 5, 6)
 ORDER BY id;

\echo '=== 8. Product master rows that must remain unchanged (IDs 1, 2, 7) ==='
SELECT id, insurance_type, company_name, product_category, product_name, is_active
  FROM product_master
 WHERE id IN (1, 2, 7)
 ORDER BY id;

\echo '=== 9. Planned new canonical entries (should be 51) ==='
SELECT v.name, v.insurance_type,
       EXISTS (
           SELECT 1 FROM companies c
            WHERE c.insurance_type = v.insurance_type
              AND lower(c.name) = lower(v.name)
       ) AS already_exists
  FROM (VALUES
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
    ('Aditya Birla Health Insurance Co. Ltd.', 'Health'),
    ('Galaxy Health Insurance Company Limited', 'Health'),
    ('Narayana Health Insurance Ltd.', 'Health'),
    ('Manipal Cigna Health Insurance Company Limited', 'Health'),
    ('Niva Bupa Health Insurance Co Ltd.', 'Health'),
    ('Prudential HCL Health Insurance Limited', 'Health'),
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
 ORDER BY v.insurance_type, v.name;

\echo '=== 10. Planned insert count by insurance type ==='
SELECT v.insurance_type, count(*) AS to_insert
  FROM (VALUES
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
    ('Aditya Birla Health Insurance Co. Ltd.', 'Health'),
    ('Galaxy Health Insurance Company Limited', 'Health'),
    ('Narayana Health Insurance Ltd.', 'Health'),
    ('Manipal Cigna Health Insurance Company Limited', 'Health'),
    ('Niva Bupa Health Insurance Co Ltd.', 'Health'),
    ('Prudential HCL Health Insurance Limited', 'Health'),
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
 )
 GROUP BY v.insurance_type
 ORDER BY v.insurance_type;

\echo '=== 11. Unresolved references - leave unchanged ==='
SELECT id, policy_number, company, insurance_type, total_premium
  FROM policies
 WHERE company = 'DIGIT GLOW PLUS TERM LIFE INSURANCE'
 ORDER BY id;

\echo '=== 12. Unmatched policy company values (not in companies table) ==='
SELECT p.company, p.insurance_type, count(*) AS policies,
       coalesce(sum(p.total_premium), 0) AS premium
  FROM policies p
 WHERE NOT EXISTS (
     SELECT 1 FROM companies c
      WHERE c.name = p.company
        AND c.insurance_type = p.insurance_type
 )
 GROUP BY p.company, p.insurance_type
 ORDER BY policies DESC, p.company;

\echo '=== 13. policy_history company snapshots (must remain unchanged) ==='
SELECT details->>'company' AS company, count(*) AS snapshots
  FROM policy_history
 WHERE details->>'company' IS NOT NULL
 GROUP BY details->>'company'
 ORDER BY snapshots DESC;

\echo '=== 14. Before-state integrity totals ==='
SELECT count(*) AS policies,
       coalesce(sum(total_premium), 0) AS total_premium,
       coalesce(sum(base_premium), 0) AS base_premium,
       coalesce(sum(gst), 0) AS gst,
       count(DISTINCT customer_name) AS customers,
       count(DISTINCT policy_number) AS policy_numbers
  FROM policies;
SELECT count(*) AS product_master_rows FROM product_master;
SELECT count(*) AS policy_history_rows FROM policy_history;

\echo '=== 15. All active company rows before migration ==='
SELECT id, name, insurance_type, is_active
  FROM companies
 WHERE is_active
 ORDER BY insurance_type, name;

\echo '=== 16. All inactive legacy company rows (must remain unchanged) ==='
SELECT id, name, insurance_type, is_active
  FROM companies
 WHERE NOT is_active
 ORDER BY id;
