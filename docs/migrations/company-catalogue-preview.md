# InsureTrack — Centralized Insurance Company Catalogue
## Stage 1 + Stage 2 Preview Report (READ-ONLY, HISTORICAL)

> **SUPERSEDED — do not use this document as the execution plan.** This is the historical Stage A inspection report. The authoritative execution package is `company_catalogue_runbook.md` plus `company-catalogue.json`, `company_catalogue_preview.sql`, `company_catalogue_up.sql`, `company_catalogue_rollback.sql` and `company_catalogue_verify.sql`. The workbook blocker was resolved: the user-supplied embedded 62-entry list is authoritative, and no workbook lookup is required.

**Status:** Inspection complete. **No production rows have been modified.** No migration, deployment, git push, or backup has been run.
**Production target:** PostgreSQL `insuretrack` on the live server behind `https://insuretrack.online`.
**Alembic head:** `d4f8b2c61a97`
**Report date:** 2026-11-07

---

## 1. Environment verification (read-only)

| Check | Result |
|---|---|
| Backend DB driver | `DATABASE_URL` set, scheme `postgresql` |
| Target | `127.0.0.1:5432/insuretrack` |
| `FLASK_ENV` | `production` |
| systemd EnvironmentFile | `/var/www/insuretrack/backend/.env` |
| Gunicorn | `app:create_app()` as `www-data` |
| SQLite `insurance.db` on server | **Does not exist** |
| Local SQLite files | Not production; not used for this migration |

All inspection used `SELECT` / `information_schema` queries. No writes were made.

---

## 2. Current schema and dependency findings

### 2.1 `companies` table

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | integer | NO | PK, sequence `companies_id_seq`, last value `19` |
| `name` | varchar(100) | NO | No unique constraint |
| `insurance_type` | varchar(50) | NO | Life / Health / General |
| `is_active` | boolean | YES | Default true |
| `created_at` | timestamp | YES | Default current timestamp |

Indexes: `companies_pkey (id)`, `ix_company_type_active (insurance_type, is_active)`.

### 2.2 Company references are denormalized strings — there is **no foreign key**

| Table | Column | Constraint |
|---|---|---|
| `policies` | `company` varchar(100) NOT NULL | Index `ix_policy_company`; **no FK to `companies`** |
| `product_master` | `company_name` varchar(100) | Index `ix_pm_type_company`; **no FK** |
| `policy_history` | `details` JSON | Contains a `company` snapshot; **no FK** |
| `custom_fields` | `label` | One label happens to equal a company name; not a company reference |

This means renames must update **both** the `companies` row and every denormalized copy. Nothing will cascade automatically.

### 2.3 Current row counts

| Table | Rows |
|---|---:|
| `companies` | 19 |
| `policies` | 268 |
| `product_master` | 7 |
| `users` | 1 |
| `policy_history` | 293 |
| `custom_fields` | 2 |
| `general_riders` | 0 |

### 2.4 Design decision

**Keep the existing single-table design.** One row per `(official_name, insurance_type)` is sufficient:

- The workbook has 62 insurer-type entries, not necessarily 62 legal entities.
- The apparent multi-type groups are distinct legal entities with distinct names:
  - `Go Digit Life Insurance Limited.` vs `Go Digit General Insurance Limited`
  - `Bajaj Life Insurance Limited` vs `Bajaj General Insurance Limited`
  - `Generali Central Life Insurance Company Limited` vs `Generali Central Insurance Company Limited`
  - `Aditya Birla SunLife...` vs `Aditya Birla Health...`
  - `Shriram Life...` vs `Shriram General...`
  - `ICICI Life...` vs `ICICI LOMBARD General...`
- No verified case exists in the reference data of one legal entity needing two types under the same canonical name.
- Adding an association table would add schema and application complexity without changing the 62-entry outcome.
- Renaming rows in place preserves existing IDs (especially Care ID 17).

**Optional hardening (not required for the data migration):** after the data migration, add a partial unique index only for active rows, e.g. `UNIQUE (lower(name), insurance_type) WHERE is_active`. This accommodates the existing inactive legacy duplicates `lic` / `LIC`. Also make the API duplicate check case-insensitive and type-scoped.

No `updated_at`, `normalized_name`, or association table is needed. No schema reset/drop is planned.

---

## 3. Catalogue extraction status

| List | Expected | Provisional entries | Existing active rows | New inserts |
|---|---:|---:|---:|---:|
| Life | 26 | 26 | 6 | 20 |
| Health | 8 | 8 | 2 | 6 |
| General | 28 | 28 | 3 | 25 |
| **Total** | **62** | **62** | **11** | **51** |

Provisional machine-readable file: `docs/migrations/company-catalogue.provisional.json`

Validation performed locally:

- 62 total, 26/8/28 by type.
- 11 existing IDs referenced, all unique: `3, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19`.
- 51 new rows: 20 Life + 6 Health + 25 General.
- No duplicate `(lower(name), insurance_type)` among active entries.
- Longest name 54 characters, within `varchar(100)`.
- No leading/trailing spaces or NBSP in the provisional strings.

### 3.1 Names requiring workbook verification

These are transcribed exactly as supplied. Several are unusual and must be checked against the workbook before insert:

| Name | Why it needs checking |
|---|---|
| `Go Digit Life Insurance Limited.` | Trailing period |
| `ICICI Life Insurance Company Limited` | Replaces current `ICICI PRUDENTIAL LIFE INSURANCE COMPANY`; unusual legal name |
| `Star Health & Allied Insurance Co.Ltd.` | No space after `Co.` |
| `Bharti Life Ins Co Ltd` | Abbreviated, no periods |
| `Niva Bupa Health Insurance Co Ltd.` | Trailing period |
| `Raheja QBE General Insurance Co. Ltd.` | Space after `Co.` |
| `Zuno General Insurance Ltd.` / `Care Health Insurance Ltd.` / `Narayana Health Insurance Ltd.` | Trailing periods |
| `ICICI LOMBARD General Insurance Company Limited` | Uppercase `LOMBARD` |
| `TATA AIA ...` vs `Tata AIG ...` | Different capitalization and spelling by design |

Normalization rule for the migration: strip leading/trailing whitespace, replace NBSP with a normal space, collapse repeated spaces. **Do not change case, punctuation, suffixes, or spelling.** The final strings must come from the workbook, not this provisional list.

---

## 4. Existing production companies → canonical mapping

### 4.1 Active records (renamed in place, IDs preserved)

| ID | Current name | Type | Policies | Products | Proposed canonical name | Workbook list |
|---:|---|---|---:|---:|---|---|
| 3 | `ICICI PRUDENTIAL LIFE INSURANCE COMPANY` | Life | 0 | 0 | `ICICI Life Insurance Company Limited` | Life #4 |
| 7 | `LIFE INSURANCE CORPORATION OF INDIA` | Life | 0 | 0 | `Life Insurance Corporation of India` | Life #1 |
| 11 | `HDFC LIFE INSURANCE COMPANY LIMITED` | Life | 0 | 0 | `HDFC Life Insurance Company Limited` | Life #3 |
| 12 | `AXIS MAX LIFE INSURANCE LIMITED` | Life | 0 | 0 | `Axis Max Life Insurance Limited` | Life #2 |
| 13 | `TATA AIA LIFE INSURANCE COMPANY LIMITED` | Life | 0 | 0 | `TATA AIA Life Insurance Company Limited` | Life #7 |
| 14 | `GO DIGIT LIFE INSURANCE COMPANY LIMITED` | Life | 0 | 0 | `Go Digit Life Insurance Limited.` | Life #26 |
| 16 | `STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED` | Health | 0 | 0 | `Star Health & Allied Insurance Co.Ltd.` | Health #8 |
| **17** | `CARE HEALTH INSURANCE COMPANY LIMITED` | Health | **266** | **4** | `Care Health Insurance Ltd.` | Health #1 |
| 15 | `TATA AIG GENERAL INSURANCE COMPANY LIMITED` | General | 0 | 0 | `Tata AIG General Insurance Company Limited` | General #22 |
| 18 | `GO DIGIT GENERAL INSURANCE LIMITED` | General | 0 | 1 | `Go Digit General Insurance Limited` | General #7 |
| 19 | `THE NEW INDIA ASSURANCE COMPANY LIMITED` | General | 0 | 0 | `The New India Assurance Company Limited` | General #23 |

**Important:** only Care currently has policies. All 266 Care policies are on canonical ID 17 when the 194 historical `Care` policies are consolidated. All other active company rows have zero associated policies; their renames are catalogue-only.

### 4.2 Inactive records preserved as-is (never reactivated, never offered for new policies)

| ID | Name | Type | Policies | Products |
|---:|---|---|---:|---:|
| 1 | `lic` | Life | 0 | 1 (`nit`) |
| 2 | `LIC` | Life | 0 | 1 (`Term Plan`) |
| 4 | `TATA AIA LIFE` | Life | 0 | 0 |
| 5 | `AXIS MAX LIFE` | Life | 0 | 0 |
| 6 | `GODIGIT LIFE` | Life | 0 | 0 |
| 8 | `HDFC LIFE` | Life | 0 | 0 |
| 9 | `CARE HEALTH INSURANCE` | Health | 0 | 0 |
| 10 | `STAR HEALTH INSURANCE` | Health | 0 | 0 |

The inactive `lic` / `LIC` pair is an existing case-insensitive duplicate. It is excluded from active selection and is intentionally not merged, because ID 7 is the active canonical LIC row and both legacy rows must remain for traceability.

---

## 5. New catalogue entries to insert (51)

### Life — 20 new

1. Mahindra Life Insurance Company Limited
2. Aditya Birla SunLife Insurance Company Limited
3. SBI Life Insurance Company Limited
4. Bajaj Life Insurance Limited
5. MetLife India Insurance Company Limited
6. IndusInd Nippon Life Insurance Company Limited
7. Aviva Life Insurance Company India Limited
8. Sahara India Life Insurance Company Limited
9. Shriram Life Insurance Company Limited
10. Bharti Life Ins Co Ltd
11. Generali Central Life Insurance Company Limited
12. Federal Life Insurance Company Limited
13. Canara HSBC Life Insurance Company Limited
14. Bandhan Life Insurance Limited
15. Pramerica Life Insurance Company Limited
16. Star Union Dai-Ichi Life Insurance Company Limited
17. IndiaFirst Life Insurance Company Limited
18. Edelweiss Life Insurance Company Limited
19. CreditAccess Life Insurance Limited
20. Acko Life Insurance Limited

### Health — 6 new

1. Aditya Birla Health Insurance Co. Ltd.
2. Galaxy Health Insurance Company Limited
3. Narayana Health Insurance Ltd.
4. Manipal Cigna Health Insurance Company Limited
5. Niva Bupa Health Insurance Co Ltd.
6. Prudential HCL Health Insurance Limited

### General — 25 new

1. Acko General Insurance Limited
2. Agriculture Insurance Company of India Limited
3. Bajaj General Insurance Limited
4. Cholamandalam MS General Insurance Company Limited
5. ECGC Limited
6. Generali Central Insurance Company Limited
7. HDFC ERGO General Insurance Company Limited
8. ICICI LOMBARD General Insurance Company Limited
9. IFFCO TOKIO General Insurance Company Limited
10. Zurich Kotak General Insurance Company (India) Limited
11. Kshema General Insurance Limited
12. Magma General Insurance Limited
13. National Insurance Company Limited
14. Liberty General Insurance Limited
15. Navi General Insurance Limited
16. Raheja QBE General Insurance Co. Ltd.
17. IndusInd General Insurance Company Limited
18. Royal Sundaram General Insurance Company Limited
19. SBI General Insurance Company Limited
20. Shriram General Insurance Company Limited
21. The Oriental Insurance Company Limited
22. United India Insurance Company Limited
23. Universal Sompo General Insurance Company Limited
24. Zuno General Insurance Ltd.
25. Kiwi General Insurance Limited

New rows: `insurance_type` = list type, `is_active = true`, `created_at = now()`.
Expected IDs are 20–70 via the sequence, but the migration must capture `RETURNING id` rather than hardcode them.

---

## 6. Care consolidation preview

### 6.1 Reconciliation — 266 policies, not 265

The previous breakdown omitted one canonical blank-category policy. Actual production:

| Current company value | Sub-category | Policies | Premium (₹) |
|---|---|---:|---:|
| `CARE HEALTH INSURANCE COMPANY LIMITED` | Individual | 29 | 566,137 |
| `CARE HEALTH INSURANCE COMPANY LIMITED` | Floater | 42 | 1,034,840 |
| `CARE HEALTH INSURANCE COMPANY LIMITED` | *(blank)* | 1 | 18,423 |
| `Care` | Individual | 52 | 879,354 |
| `Care` | Floater | 136 | 3,597,189 |
| `Care` | *(blank)* | 6 | 184,079 |
| **Total** | | **266** | **6,280,022** |

After consolidation:

| Sub-category | Policies | Premium (₹) |
|---|---:|---:|
| Individual | 81 | 1,445,491 |
| Floater | 178 | 4,632,029 |
| *(blank)* | 7 | 202,502 |
| **Total** | **266** | **6,280,022** |

The dashboard screenshot count of **266 is correct**. The 265 figure in the brief was incomplete.

### 6.2 Identity and preservation

- Canonical company row: **ID 17**, renamed to `Care Health Insurance Ltd.`
- Historical `Care` policies: 194 → same canonical identity.
- Canonical-name policies: 72 → unchanged identity.
- Policy IDs, policy numbers, customer details, agent, branch/location, payment mode, dates, sum insured, premiums, GST, and `sub_category` (Individual/Floater/blank) are **not modified**.
- Inactive ID 9 `CARE HEALTH INSURANCE` stays inactive; it is a separate historical placeholder, not a policy holder.

### 6.3 Rows affected

| Object | Rows | Action |
|---|---:|---|
| `companies` | 1 | Rename ID 17 |
| `policies.company` | 266 | Set to canonical |
| `product_master.company_name` | 4 | Set to canonical |
| `policy_history.details->>'company'` | 293 | **Optional** — see §6.4 |

### 6.4 `policy_history` decision

All 293 history rows belong to Care policies and carry a company snapshot:

| Snapshot value | Rows |
|---|---:|
| `CARE HEALTH INSURANCE COMPANY LIMITED` | 203 |
| `Care` | 90 |

There are no orphaned history rows. History is an audit snapshot. **Recommended default: leave it unchanged**, so history remains an accurate record of what was stored at renewal time. If the owner wants the history modal to display only the canonical name, all 293 can be rewritten with `jsonb_set(details::jsonb, '{company}', '"Care Health Insurance Ltd."')::json`; no other history field would change. This is not required for dashboard consolidation.

### 6.5 SQL preview (not executed)

```sql
BEGIN;

-- 1. Rename canonical Care row
UPDATE companies
SET name = 'Care Health Insurance Ltd.'
WHERE id = 17
  AND name = 'CARE HEALTH INSURANCE COMPANY LIMITED';

-- 2. Consolidate all policy references
UPDATE policies
SET company = 'Care Health Insurance Ltd.'
WHERE company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
-- expected: 266

-- 3. Update product-master company references
UPDATE product_master
SET company_name = 'Care Health Insurance Ltd.'
WHERE company_name IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
-- expected: 4

-- 4. Optional history snapshot rewrite (decision required)
-- UPDATE policy_history
-- SET details = jsonb_set(details::jsonb, '{company}', '"Care Health Insurance Ltd."')::json
-- WHERE details->>'company' IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED');
-- expected: 293

COMMIT;
```

The final production migration normalizes policy references only for Care (266 rows). The other ten renamed companies have zero policy references, so no defensive policy rewrites are needed or performed. Product references are updated only for Care IDs 3–6; product IDs 1, 2 and 7 are preserved verbatim.

---

## 7. Product master preview (7 rows, IDs and names preserved)

| ID | Type | Current company_name | Category / Sub / Product category | Product name | Active | Policies using today |
|---:|---|---|---|---|---|---:|
| 1 | Life | `lic` | Non Linked / — / Term Plan | `nit` | false | 0 |
| 2 | Life | `LIC` | — / — / Term Plan | `Term Plan` | false | 0 |
| 3 | Health | `CARE HEALTH INSURANCE COMPANY LIMITED` | — / — / Personal Health | `CARE SUPREME` | true | 66 |
| 4 | Health | `CARE HEALTH INSURANCE COMPANY LIMITED` | — / — / Personal Health | `ULTIMATE CARE` | true | 5 |
| 5 | Health | `CARE HEALTH INSURANCE COMPANY LIMITED` | — / — / Personal Health | `ENHANCE -1` | true | 0 |
| 6 | Health | `CARE HEALTH INSURANCE COMPANY LIMITED` | — / — / Personal Health | `SUPEREME ENHANCE` | true | 0 |
| 7 | General | `GO DIGIT GENERAL INSURANCE LIMITED` | Motor / Two-Wheelers / — | `COMPREHENSIVE` | true | 0 |

Final updates (see `company_catalogue_up.sql`):

- IDs 3–6: `company_name` → `Care Health Insurance Ltd.`
- ID 7: **preserved verbatim** as `GO DIGIT GENERAL INSURANCE LIMITED` (legacy uppercase) along with its product name and active flag. The product read API matches company names case-insensitively so it still resolves to the renamed `Go Digit General Insurance Limited`.
- IDs 1–2: **preserved verbatim** (`lic` / `nit` and `LIC` / `Term Plan`, both inactive).
- Product IDs, names, categories, sub-categories, product categories, and active flags are unchanged.
- No products are created for new insurers.

Side effect of Care consolidation: product matching by `(company_name, product_name)` improves because policies currently under `Care` will now match existing Care product rows. Counts move from 72 exact matches today to about 262 of 266. The remaining four product strings (`ENHANCE 1`, `CARE ADVANTAGE`, `CARE FREEDOM PLAN 2`, `CARE HEART 20 PERCENT COPAY`) have no product-master row; they will not be invented.

---

## 8. Unmatched and manual-review records

### 8.1 `DIGIT GLOW PLUS TERM LIFE INSURANCE` — 2 Life policies

| Field | Policy ID 3 | Policy ID 4 |
|---|---|---|
| Policy number | `L021093793` | `L018436333` |
| Customer | VENKATA BHAVANI NIHARIKA ALLURI | HARDIK KUMAR AGARWAL |
| Company | `DIGIT GLOW PLUS TERM LIFE INSURANCE` | `DIGIT GLOW PLUS TERM LIFE INSURANCE` |
| Product | `DIGIT GLOW PLUS TERM LIFE INSURANCE` | `DIGIT GLOW PLUS TERM LIFE INSURANCE` |
| Type / category | Life / Non Linked | Life / Non Linked |
| Sum assured | ₹10,00,000 | ₹1,00,00,000 |
| Policy term | 60 years | 52 years |
| Premium payment | Limited, PPT 10 | Limited, PPT 27 |
| Base / total premium | ₹22,688 | ₹25,532 |
| Start / end | 2026-06-21 / 2086-06-21 | 2026-01-01 / 2078-01-01 |
| Agent / location | DEVESWAR / VIJAYAWADA | DEVESWAR / VIJAYAWADA |
| History rows | 0 | 0 |

**Finding:** the `company` field contains a **product name**, not an insurer. The product is a Go Digit Life term product, but the database contains no FK, insurer code, or history row that proves the insurer identity. `policies.custom_values` is empty.

**Recommendation:** leave both policies unchanged pending owner confirmation. If the owner confirms Go Digit Life, the only change would be `policies.company = 'Go Digit Life Insurance Limited.'` for IDs 3 and 4; product, premiums, policy numbers, and all other fields stay untouched. Do not auto-map.

Current dashboard effect if left unmatched: these 2 policies (₹48,220) appear as a separate pseudo-company named `DIGIT GLOW PLUS TERM LIFE INSURANCE`. If mapped, they roll into Go Digit Life.

### 8.2 `Reliance` / `Reliance General` / `ICICI Lombard` under Health

Production queries returned **zero** occurrences:

- No company row or policy contains `Reliance`.
- No company row or policy contains `ICICI Lombard`.
- The existing Health rows are only Care (17, 9) and Star (16, 10).

The workbook's `ICICI LOMBARD General Insurance Company Limited` will be inserted as a **new General** row. It will not convert or merge with any Health record. No Reliance mapping is needed because no such production record exists.

### 8.3 Other items

| Item | Finding | Action |
|---|---|---|
| Inactive `CARE HEALTH INSURANCE` ID 9 | 0 policies/products | Keep inactive |
| Inactive `STAR HEALTH INSURANCE` ID 10 | 0 policies/products | Keep inactive |
| `custom_fields` ID 2, label `CARE HEALTH INSURANCE COMPANY LIMITED` | Inactive Health text field; no `custom_values` data | Not a company reference; leave unchanged |
| `policies.custom_values` | No keys populated | No impact |
| Orphaned `policy_history` | 0 | No action |
| Policy/company type mismatch | 0 | No action |
| Company name > 100 chars | None (max 54 provisional) | No conflict |

---

## 9. Before/after totals

### 9.1 Company catalogue

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Total company rows | 19 | 70 | +51 |
| Active | 11 | 62 | +51 |
| Inactive | 8 | 8 | 0 |
| Life rows | 12 (6 active / 6 inactive) | 32 (26 / 6) | +20 active |
| Health rows | 4 (2 / 2) | 10 (8 / 2) | +6 active |
| General rows | 3 (3 / 0) | 28 (28 / 0) | +25 active |

### 9.2 Policies and financials (must be identical after migration)

| Metric | Before | After |
|---|---:|---:|
| Policies | 268 | **268** |
| Total premium | ₹6,328,242 | **₹6,328,242** |
| Base premium | ₹6,328,242 | **₹6,328,242** |
| GST | ₹0 | **₹0** |
| Distinct customers | 253 | **253** |
| Distinct policy numbers | 268 | **268** |
| Life policies | 2 | **2** |
| Health policies | 266 | **266** |
| General policies | 0 | **0** |
| Care policies | 266 (72 + 194) | **266** consolidated |
| Care premium | ₹6,280,022 | **₹6,280,022** |
| Policies matched to a company row | 266 | **266** (or 268 if DIGIT GLOW is manually confirmed) |
| Product master rows | 7 | **7** |

---

## 10. Constraint and risk analysis

| Risk | Assessment / mitigation |
|---|---|
| No FK cascade | Script must update `policies.company`, `product_master.company_name`, and optionally history explicitly. |
| Duplicate names | After rename, 62 active names are unique by `(lower(name), type)`. Existing inactive `lic`/`LIC` duplicate remains and is excluded from active selection. |
| `varchar(100)` | All canonical names ≤ 54 chars. |
| Sequence | Last value 19; new inserts use `RETURNING id`; no hardcoded IDs. |
| Concurrent writes | Run in a short maintenance window, or lock the affected tables in the transaction. Re-count immediately before commit. |
| UI editing historical company | `EditPolicy` currently hardcodes short names; without the planned fix, editing a canonical policy can blank its company. Must fix before/with deployment. |
| Product matching | Product lookup requires exact `company_name`; Care consolidation improves matching. No products invented. |
| History audit | Leave snapshots unchanged by default; 90 rows would still display `Care` in the history modal. |
| Unmatched DIGIT GLOW | Leave as-is pending proof; dashboard will show a pseudo-company until resolved. |
| Rollback after new writes | Full backup restore is the reliable rollback once users create new policies; immediate inverse SQL is safe only before new writes. |

---

## 11. Application changes required (planned, not yet implemented)

### Backend

1. **`backend/routes/companies.py`**
   - `GET /api/companies`: keep active-only default; add `include_inactive=true` for admin/history filters; order by `name`; validate type.
   - `POST` / `PUT`: trim; duplicate check case-insensitive and scoped to `insurance_type`; preserve current role checks.
   - Keep `DELETE` as soft deactivate.
2. **`backend/routes/policies.py`**
   - On create: require `company` to exist, be active, and match `insurance_type`.
   - On update: if `company` is changed, require an active matching company; allow an unchanged legacy value (so DIGIT GLOW and historical edits remain possible).
   - Export already emits `policy.company`; after migration it emits canonical names automatically.
3. **`backend/routes/products.py`**
   - When `company_name` is supplied, validate it exists, is active, and matches `insurance_type`; keep blank = "all companies".
   - Preserve existing product IDs/names/categories.
4. **`backend/routes/analytics.py`**
   - `GET /premium-by-company`: left-join `companies` on name, return `insurance_type`, `is_active`, and `matched` in addition to `company`, `premium`, `count`. Group by company and type.
   - Add `GET /premium-by-location` for branch-level analytics, respecting `branch_filter`.
   - Keep all existing response fields for backward compatibility.
5. **Tests** as listed in §14.

### Frontend

1. **`frontend/src/pages/EditPolicy.tsx`** — critical
   - Remove `LIFE_COMPANIES`, `HEALTH_COMPANIES`, `GENERAL_COMPANIES`.
   - Load active companies from the API by selected insurance type.
   - If the policy's current company is not in the active list (legacy/unmatched), retain it as a selectable current value rather than blanking it.
2. **`frontend/src/pages/Policies.tsx`**
   - Replace hardcoded filter options (`LIC`, `Care`, `HDFC Life`, etc.) with a DB-driven list.
   - Use `include_inactive=true` for historical filtering, or group active options by type; keep inactive out of new-policy selection.
   - Reset/revalidate the company filter when insurance type changes.
3. **`frontend/src/pages/AddPolicy.tsx`**
   - Already DB-driven; switch to `getCompanies(insuranceType)` and keep the empty-state message. No hardcoded catalogue.
4. **`frontend/src/pages/Products.tsx`**
   - Already DB-driven; use type-filtered active companies; optionally show inactive products for legacy editing.
5. **`frontend/src/pages/Dashboard.tsx`**
   - Add a Company Performance card using `getPremiumByCompany`: policy counts, premium totals, comparison chart.
   - Care appears once; Go Digit Life and Go Digit General remain separate.
   - Add branch-level analytics card after the new endpoint exists.
6. **`frontend/src/pages/Analytics.tsx`**
   - Company chart stays DB-driven; show canonical names and optionally insurance type.
   - Add branch-level chart; agent-level chart already exists.
7. **`frontend/src/services/api.ts` / `types/index.ts`**
   - Extend `companyService.getCompanies` with `includeInactive`.
   - Add `getPremiumByLocation`.
   - Extend `PremiumByCompany` with `insurance_type`, `is_active`, `matched`.
8. **`frontend/src/constants/insurance.ts`**
   - Verified: contains product categories only, no company catalogue. No change needed.

No hardcoded company list should remain in the frontend after these changes.

---

## 12. Migration execution plan (Stage 3–5)

### Stage 3 — Backup (after workbook verification and approval)

Run on the server, never echoing the URL:

```bash
set -a
. /var/www/insuretrack/backend/.env
set +a

umask 077
mkdir -p /var/backups/insuretrack
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/var/backups/insuretrack/insuretrack_pre_company_catalogue_$STAMP.dump

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$BACKUP"
pg_restore --list "$BACKUP" > "$BACKUP.list"
sha256sum "$BACKUP" > "$BACKUP.sha256"
ls -l "$BACKUP" "$BACKUP.list" "$BACKUP.sha256"
```

Verify the backup by restoring it into a **separate staging database** and running the row-count queries. Keep the dump outside the application build directory. Record Alembic head `d4f8b2c61a97`.

### Stage 4 — Apply

Planned migration artifact: `backend/scripts/company_catalogue_migrate.py`

- Default mode is **dry-run** (read-only).
- `--apply` performs one transaction, with `--catalogue docs/migrations/company-catalogue.provisional.json`.
- Preconditions: 62 validated entries; 19 existing companies; 268 policies; 7 products; Care reconciliation 266; sequence last value 19; no active duplicate names.
- Updates 11 existing rows in place; synchronizes denormalized strings for every rename; inserts 51 active rows with `RETURNING id`.
- Before/after snapshot of policy counts, premium sums, customer count, policy-number count, and Care split.
- Aborts and rolls back on any validation failure.
- Does not modify `policy_history` unless `--update-history` is explicitly passed.
- Does not map DIGIT GLOW unless `--map-digit-glow-to-godigit-life` is explicitly passed after owner confirmation.

### Stage 5 — Verify

```sql
-- 70 rows, 62 active
SELECT count(*) AS total, count(*) FILTER (WHERE is_active) AS active FROM companies;

-- Life 26/6, Health 8/2, General 28/0
SELECT insurance_type, count(*) FILTER (WHERE is_active) AS active,
       count(*) FILTER (WHERE NOT is_active) AS inactive
FROM companies GROUP BY insurance_type ORDER BY insurance_type;

-- No active duplicate identity
SELECT lower(name), insurance_type, count(*)
FROM companies WHERE is_active
GROUP BY 1, 2 HAVING count(*) > 1;

-- Financial totals unchanged
SELECT count(*), sum(total_premium), sum(base_premium), sum(gst),
       count(DISTINCT customer_name), count(DISTINCT policy_number)
FROM policies;

-- Care consolidated
SELECT company, count(*), sum(total_premium)
FROM policies WHERE company ILIKE '%care%'
GROUP BY company;

-- Products preserved
SELECT count(*) FROM product_master;

-- Unmatched report (expected 2 if DIGIT GLOW left unchanged)
SELECT p.company, p.insurance_type, count(*), sum(p.total_premium)
FROM policies p
LEFT JOIN companies c ON c.name = p.company
WHERE c.id IS NULL
GROUP BY p.company, p.insurance_type;

-- No orphaned history
SELECT count(*) FROM policy_history h
LEFT JOIN policies p ON p.id = h.policy_id WHERE p.id IS NULL;
```

Also compare all non-company policy columns against a pre-migration snapshot and verify 266 Care `sub_category` values and premiums are unchanged.

---

## 13. Rollback plan

1. **Preferred:** restore the verified custom-format dump.
   ```bash
   systemctl stop insuretrack
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="$DATABASE_URL" /var/backups/insuretrack/<backup>.dump
   systemctl start insuretrack
   ```
   Use only after confirming the backup restores cleanly into staging. This restores all tables, including any new writes after the migration.
2. **Immediate inverse data SQL** (only before new policies/products are created):
   - Delete the 51 inserted rows by recorded IDs.
   - Rename the 11 rows back to their exact old names.
   - Restore `policies.company` and `product_master.company_name` to the old values.
   - Leave history unchanged if it was not updated.
3. **Application rollback:** redeploy the previous frontend/backend build. No automatic git push or deploy is part of this task.

---

## 14. Test plan

Backend (pytest, existing `backend/tests`):

- Catalogue validation: 26/8/28/62; 51 inserts; unique active names; length limits; whitespace/NBSP normalization.
- Migration dry-run reports exact counts, no writes.
- Rename-in-place preserves IDs and is idempotent where safe.
- Care consolidation: 266 policies, 266 distinct numbers, 81 Individual / 178 Floater / 7 blank, ₹6,280,022 premium; all policy IDs and numbers unchanged.
- Product master: 7 rows preserved; only the 4 Care references (IDs 3–6) updated; IDs 1, 2 and 7 asserted unchanged; no duplicates/inventions.
- Inactive companies excluded from `GET /api/companies`; included only with `include_inactive=true`; never selectable for new policies.
- Policy create rejects unknown/inactive/type-mismatched company; update allows unchanged legacy value.
- Duplicate prevention case-insensitive and type-scoped.
- Analytics: Care one row; Go Digit Life and General separate; total counts/premiums equal policy totals; branch filter and agent filter.
- Transaction rollback on injected validation failure.
- History/orphan checks.

Staging: restore the production dump into a separate PostgreSQL database, run `--apply`, run the test suite and API smoke tests, compare before/after totals. Frontend: `npm run build` and `npm run lint` (no frontend test runner is configured); manual smoke for Add/Edit/Filter/Products/Analytics/Dashboard.

---

## 15. Decisions required before Stage 3/4

1. **Workbook:** **RESOLVED.** The user-supplied embedded 62-entry list is authoritative; the workbook is not required. See `company-catalogue.json`.
2. **DIGIT GLOW:** leave the 2 policies unmatched (recommended) or confirm mapping to `Go Digit Life Insurance Limited.`?
3. **History snapshots:** leave 293 `policy_history` company snapshots unchanged (recommended for audit) or rewrite all to `Care Health Insurance Ltd.`?
4. **Legacy LIC products:** update the inactive `lic` / `LIC` product rows to canonical `Life Insurance Corporation of India` (recommended), or leave them untouched?
5. **Hardening:** approve the case-insensitive duplicate check and optional partial unique active index?
6. **Maintenance window:** confirm a short read-only/maintenance window for the apply step.
7. **Explicit production approval:** after the above, approve Stage 3 backup and Stage 4 apply. Until then, nothing will be changed.

---

## Appendix — Read-only evidence summary

- `companies`: 19 rows; active IDs `3, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19`; inactive IDs `1, 2, 4, 5, 6, 8, 9, 10`.
- Only company with policy usage: ID 17, 72 policies, ₹1,619,400; unmatched `Care` 194 policies, ₹4,660,622.
- Other active rows: 0 policies. Product usage: ID 17 has 4 products; ID 18 has 1; IDs 1 and 2 each have 1.
- `policies`: 268 rows; ₹6,328,242 total/base; GST ₹0; 253 customers; 268 distinct policy numbers.
- `policy_history`: 293 rows; 203 canonical Care, 90 `Care`; 0 orphans.
- `product_master`: 7 rows, IDs 1–7, as listed in §7.
- `custom_fields`: 2 rows; ID 2 label equals old Care name, inactive, unused.
- No `Reliance`, `Reliance General`, or `ICICI Lombard` company/policy rows exist in production.
- No writes, DDL, backup, deploy, or git push were performed.
