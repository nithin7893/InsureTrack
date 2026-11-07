# Company Catalogue Migration — Production Runbook

Status: **READY TO EXECUTE — awaiting explicit approval. No production write has been performed.**

Target database: PostgreSQL `insuretrack` on `127.0.0.1:5432` behind `https://insuretrack.online`.

## 1. Outcome

| Item | Before | After |
|---|---:|---:|
| Companies (total) | 19 | 70 |
| Active companies | 11 | 62 |
| Inactive legacy companies | 8 | 8 |
| Active Life / Health / General | 6 / 2 / 3 | 26 / 8 / 28 |
| New catalogue inserts | — | 51 |
| Policies | 268 | 268 |
| Distinct policy numbers | 268 | 268 |
| Distinct customers | 253 | 253 |
| Total premium | 6,328,242 | 6,328,242 |
| Base premium | 6,328,242 | 6,328,242 |
| GST | 0 | 0 |
| Product master rows | 7 | 7 |
| Policy history snapshots | 293 | 293 |
| Care policies | 266 | 266 |
| Care premium | 6,280,022 | 6,280,022 |

Catalogue totals validated from the embedded authoritative list: **Life 26 + Health 8 + General 28 = 62**.

## 2. Stage A blocker resolution — Care reconciliation

The earlier report's "71 canonical + 194 old-name" was a reporting typo. The verified read-only production queries return:

| Company string | Individual | Floater | Blank | Total | Premium |
|---|---:|---:|---:|---:|---:|
| `CARE HEALTH INSURANCE COMPANY LIMITED` | 29 | 42 | 1 | 72 | 1,619,400 |
| `Care` | 52 | 136 | 6 | 194 | 4,660,622 |
| **Combined** | **81** | **178** | **7** | **266** | **6,280,022** |

Notes:

- `policies.category` is blank on all 266 rows; the Individual/Floater classification lives in `policies.sub_category`.
- No other Care-related policy rows exist outside these 266.
- 266 distinct policy numbers and 251 distinct customers.
- No whitespace/case anomalies among Care company strings.
- The corrected total is **72 + 194 = 266**, matching the overall count and premium.

## 3. Catalogue mapping

### 3.1 Existing active companies renamed in place (11)

| ID | Old name | New canonical name | Type |
|---:|---|---|---|
| 3 | `ICICI PRUDENTIAL LIFE INSURANCE COMPANY` | `ICICI Life Insurance Company Limited` | Life |
| 7 | `LIFE INSURANCE CORPORATION OF INDIA` | `Life Insurance Corporation of India` | Life |
| 11 | `HDFC LIFE INSURANCE COMPANY LIMITED` | `HDFC Life Insurance Company Limited` | Life |
| 12 | `AXIS MAX LIFE INSURANCE LIMITED` | `Axis Max Life Insurance Limited` | Life |
| 13 | `TATA AIA LIFE INSURANCE COMPANY LIMITED` | `TATA AIA Life Insurance Company Limited` | Life |
| 14 | `GO DIGIT LIFE INSURANCE COMPANY LIMITED` | `Go Digit Life Insurance Limited.` | Life |
| 15 | `TATA AIG GENERAL INSURANCE COMPANY LIMITED` | `Tata AIG General Insurance Company Limited` | General |
| 16 | `STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED` | `Star Health & Allied Insurance Co.Ltd.` | Health |
| 17 | `CARE HEALTH INSURANCE COMPANY LIMITED` | `Care Health Insurance Ltd.` | Health |
| 18 | `GO DIGIT GENERAL INSURANCE LIMITED` | `Go Digit General Insurance Limited` | General |
| 19 | `THE NEW INDIA ASSURANCE COMPANY LIMITED` | `The New India Assurance Company Limited` | General |

### 3.2 New insertions (51)

- Life: 20
- Health: 6
- General: 25

The exact names are in `company-catalogue.json` and in the `VALUES` block of `company_catalogue_up.sql`.

### 3.3 Inactive legacy companies left untouched (8)

IDs `1, 2, 4, 5, 6, 8, 9, 10` keep their names, types and `is_active = false`. They do not appear in default active lookups/dropdowns.

## 4. Care policy/product changes

- All 266 policies with `company IN ('Care', 'CARE HEALTH INSURANCE COMPANY LIMITED')` become `Care Health Insurance Ltd.`. No other policy column changes.
- Product master IDs `3, 4, 5, 6` change `company_name` to `Care Health Insurance Ltd.`. IDs, names, types, categories and active flags are preserved.
- Product master IDs `1, 2, 7` are asserted unchanged. In particular, product ID `7` keeps its legacy uppercase company value `GO DIGIT GENERAL INSURANCE LIMITED`; the product read API now matches company names case-insensitively, so it still appears for the renamed `Go Digit General Insurance Limited`.
- All 293 `policy_history` snapshots are asserted unchanged.

## 5. Unresolved references (deliberately not changed)

| Policy ID | Policy number | Company value | Type | Premium |
|---:|---|---|---|---:|
| 3 | `L021093793` | `DIGIT GLOW PLUS TERM LIFE INSURANCE` | Life | 22,688 |
| 4 | `L018436333` | `DIGIT GLOW PLUS TERM LIFE INSURANCE` | Life | 25,532 |
| | | **Total** | | **48,220** |

Reason: the value appears to be a product name, not an insurer name. It is **not** mapped to `Go Digit Life Insurance Limited.`. Both rows remain editable; the application preserves the existing value unless a user explicitly selects a company of the correct insurance type. Analytics marks this value as `matched: false`.

## 6. Migration artifacts

| File | Purpose |
|---|---|
| `docs/migrations/company-catalogue.json` | Authoritative 62-entry catalogue with existing-ID mapping |
| `docs/migrations/company_catalogue_preview.sql` | Read-only dry run / full change preview |
| `docs/migrations/company_catalogue_up.sql` | Transactional forward migration with backup, pre/post assertions |
| `docs/migrations/company_catalogue_rollback.sql` | Reverses the exact changes using `_company_catalogue_backup` |
| `docs/migrations/company_catalogue_verify.sql` | Read-only post-migration integrity assertions |
| `docs/migrations/company-catalogue-preview.md` | Earlier detailed Stage A inspection report |
| `docs/migrations/company-catalogue.provisional.json` | Superseded provisional catalogue (kept for audit only) |

The up script creates a persistent backup table `_company_catalogue_backup` containing only the rows it changes. The rollback script consumes and drops it.

## 7. Pre-migration backup and verification

Run on the production host, before any write:

```bash
mkdir -p /var/backups/insuretrack
cd /var/www/insuretrack/backend
DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP=/var/backups/insuretrack/insuretrack_before_company_catalogue_${STAMP}.dump
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$BACKUP"
test -s "$BACKUP"
pg_restore --list "$BACKUP" > "${BACKUP}.list"
wc -l "${BACKUP}.list"
sha256sum "$BACKUP" | tee "${BACKUP}.sha256"
```

Required evidence before continuing:

- `test -s` passes (non-empty dump).
- `pg_restore --list` exits 0 and lists the `companies`, `policies`, `product_master` and `policy_history` tables.
- The checksum file exists.

Optional stronger check: restore the dump into a scratch database and run `company_catalogue_preview.sql` there. Do not restore over production.

## 8. Production execution sequence

1. Upload the scripts (the repo may not yet be deployed with these new docs):

```bash
scp docs/migrations/company_catalogue_*.sql docs/migrations/company-catalogue.json \
    deploy@103.127.31.222:/tmp/company-catalogue/
```

2. Open the server shell and load the database URL:

```bash
ssh -i ~/.ssh/Insre2 deploy@103.127.31.222
cd /var/www/insuretrack/backend
DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
```

3. Capture the read-only preview:

```bash
psql "$DATABASE_URL" -P pager=off -v ON_ERROR_STOP=1 \
  -f /tmp/company-catalogue/company_catalogue_preview.sql \
  | tee /var/backups/insuretrack/company_catalogue_preview_$(date +%Y%m%d_%H%M%S).out
```

Confirm from the preview: 19 companies (11 active), 266 Care policies split 72/194, 51 inserts, 2 unresolved DIGIT GLOW rows, 7 products, 293 history rows.

4. Apply the migration:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f /tmp/company-catalogue/company_catalogue_up.sql \
  | tee /var/backups/insuretrack/company_catalogue_up_$(date +%Y%m%d_%H%M%S).log
```

The script runs in one transaction. Any failed precondition or post-assertion rolls the whole transaction back.

5. Verify:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f /tmp/company-catalogue/company_catalogue_verify.sql \
  | tee /var/backups/insuretrack/company_catalogue_verify_$(date +%Y%m%d_%H%M%S).log
```

6. Confirm the application still responds, then review the Dashboard/Analytics company charts.

No `flask db upgrade`, service restart or deployment is required for this data-only migration. Application deployment is a separate, separately approved step.

## 9. Rollback

Preferred recovery: restore the verified `pg_dump` backup. For a surgical rollback that preserves any unrelated data written after the migration:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f /tmp/company-catalogue/company_catalogue_rollback.sql
```

The rollback script:

- deletes only the 51 companies recorded in `_company_catalogue_backup`,
- restores the 266 original Care policy company strings,
- restores product master IDs 3–6,
- restores the 11 original active company names,
- re-asserts 19 companies (11 active / 8 inactive), 268 policies, ₹6,328,242 premium, 194 + 72 Care split, 7 products, 293 history rows,
- drops `_company_catalogue_backup` on success.

Because the rollback table is dropped after success, a second run requires the `pg_dump` restore path.

Rollback is exact, not merge-based: it restores the recorded pre-migration values for those records. If the 266 Care policies or 4 Care products were edited after the migration, or if any new company row was added (company count is asserted at 70), use the verified `pg_dump` restore instead of the surgical rollback.

## 10. Application changes included in this stage (not deployed)

Backend:

- `backend/routes/companies.py` — active/inactive listing, case-insensitive active duplicate prevention, name validation on update.
- `backend/routes/policies.py` — company/type validation on create and explicit change; unchanged legacy values preserved on edit.
- `backend/routes/products.py` — product company/type validation; unchanged legacy product company preserved.
- `backend/routes/analytics.py` — company analytics with `matched`/`is_active`/type fields; new `/api/analytics/premium-by-branch`.

Frontend:

- `frontend/src/pages/EditPolicy.tsx` — hardcoded company arrays removed; active companies loaded from the API; legacy current value kept visible.
- `frontend/src/pages/Policies.tsx` — company filter is now DB-driven.
- `frontend/src/pages/AddPolicy.tsx` — verified existing DB-driven, type-filtered company selector.
- `frontend/src/pages/Products.tsx` — type-filtered company list plus legacy current company preservation; "All Companies" can clear a product company.
- `backend/routes/products.py` — product company lookup is case-insensitive so preserved legacy names still resolve.
- `frontend/src/pages/Dashboard.tsx` — premium-by-company chart and company performance table.
- `frontend/src/pages/Analytics.tsx` — company type/legacy indicators and premium-by-branch chart.
- `frontend/src/services/api.ts` — `include_inactive` company option and branch analytics service.
- `frontend/src/types/index.ts` — company/branch analytics types.

Tests:

- `backend/tests/conftest.py` — seeds canonical companies.
- `backend/tests/test_companies.py` — catalogue listing/filtering, duplicate prevention, policy/product type validation, legacy preservation, Care/Go Digit analytics, branch analytics.
- Existing policy/alert/custom-field tests updated to use canonical company names.

## 11. Test results

- `backend/venv/Scripts/python.exe -m pytest tests -q` → **58 passed**.
- `npm run build` → **passed**.
- `npm run lint` → **0 errors** (existing warnings only).

## 12. Remaining risks / approval checklist

- [ ] Explicit approval to write to production is still required.
- [ ] Confirm the verified `pg_dump` exists and `pg_restore --list` succeeds.
- [ ] Confirm no other migration/deployment is running concurrently.
- [ ] Confirm the 62-entry catalogue in `company-catalogue.json` matches the approved business list.
- [ ] Decide whether to deploy the application changes before or after the data migration. The data migration is safe independently, but new validation/dropdown behavior only exists after deployment.
- [ ] The two `DIGIT GLOW PLUS TERM LIFE INSURANCE` policies remain unresolved by design.
