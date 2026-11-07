"""LOCAL DEVELOPMENT ONLY - seeds the SQLite dev database with the catalogue.

This lets you exercise the new 62-company catalogue in the local UI before the
production migration is approved. It only ever touches backend/insurance.db
(the SQLite file used when DATABASE_URL is empty). It must never be pointed at
the production PostgreSQL database.

Usage (from the repository root):

    python backend/scripts/seed_local_catalogue.py            # dry run
    python backend/scripts/seed_local_catalogue.py --apply    # write + backup
    python backend/scripts/seed_local_catalogue.py --restore  # undo latest apply

What --apply does:
  * backs up insurance.db to insurance.db.bak-<timestamp>,
  * deactivates local companies that are not in the canonical catalogue,
  * inserts/activates the 62 canonical companies (26 Life / 8 Health / 28 General),
  * maps local Care policies and Care products to "Care Health Insurance Ltd.".
It does not touch customers, policy numbers, premiums or policy history.
"""

import argparse
import json
import shutil
import sqlite3
import time
from collections import Counter
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
DB_PATH = BACKEND_DIR / "insurance.db"
CATALOGUE_PATH = REPO_ROOT / "docs" / "migrations" / "company-catalogue.json"

CARE_TARGET = "Care Health Insurance Ltd."


def load_catalogue():
    data = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
    entries = data["entries"]
    if len(entries) != 62:
        raise SystemExit(f"Refusing to run: catalogue has {len(entries)} entries, expected 62")
    return entries


def backup_db():
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = DB_PATH.with_name(f"{DB_PATH.name}.bak-{stamp}")
    shutil.copy2(DB_PATH, target)
    return target


def latest_backup():
    backups = sorted(DB_PATH.parent.glob(f"{DB_PATH.name}.bak-*"))
    return backups[-1] if backups else None


def snapshot(conn):
    active = conn.execute("SELECT count(*) FROM companies WHERE is_active = 1").fetchone()[0]
    total = conn.execute("SELECT count(*) FROM companies").fetchone()[0]
    by_type = dict(
        conn.execute(
            "SELECT insurance_type, count(*) FROM companies WHERE is_active = 1 "
            "GROUP BY insurance_type"
        ).fetchall()
    )
    policies = conn.execute("SELECT count(*) FROM policies").fetchone()[0]
    care = conn.execute(
        "SELECT count(*) FROM policies WHERE company IN ('Care', ?)", (CARE_TARGET,)
    ).fetchone()[0]
    return {
        "total_companies": total,
        "active_companies": active,
        "active_by_type": by_type,
        "policies": policies,
        "care_policies": care,
    }


def apply(conn, entries):
    canonical = {(e["official_name"].lower(), e["insurance_type"]): e["official_name"] for e in entries}

    existing = conn.execute("SELECT id, name, insurance_type, is_active FROM companies").fetchall()
    deactivate = [
        row[0]
        for row in existing
        if (row[1].lower(), row[2]) not in canonical and row[3]
    ]
    if deactivate:
        conn.executemany(
            "UPDATE companies SET is_active = 0 WHERE id = ?", [(i,) for i in deactivate]
        )

    existing_keys = {(row[1].lower(), row[2]): row[0] for row in existing}
    inserted = renamed = activated = 0
    for (name_lower, ins_type), official_name in canonical.items():
        row_id = existing_keys.get((name_lower, ins_type))
        if row_id is None:
            conn.execute(
                "INSERT INTO companies (name, insurance_type, is_active, created_at) "
                "VALUES (?, ?, 1, CURRENT_TIMESTAMP)",
                (official_name, ins_type),
            )
            inserted += 1
        else:
            current = conn.execute(
                "SELECT name, is_active FROM companies WHERE id = ?", (row_id,)
            ).fetchone()
            if current[0] != official_name:
                conn.execute("UPDATE companies SET name = ? WHERE id = ?", (official_name, row_id))
                renamed += 1
            if not current[1]:
                conn.execute("UPDATE companies SET is_active = 1 WHERE id = ?", (row_id,))
                activated += 1

    care_policies = conn.execute(
        "UPDATE policies SET company = ? WHERE company = 'Care'", (CARE_TARGET,)
    ).rowcount
    care_products = conn.execute(
        "UPDATE product_master SET company_name = ? WHERE lower(company_name) = 'care'",
        (CARE_TARGET,),
    ).rowcount

    conn.commit()
    return {
        "deactivated_local": len(deactivate),
        "inserted": inserted,
        "renamed": renamed,
        "reactivated": activated,
        "care_policies_normalized": care_policies,
        "care_products_normalized": care_products,
    }


def print_unmatched(conn):
    rows = conn.execute(
        """
        SELECT p.company, p.insurance_type, count(*), coalesce(sum(p.total_premium), 0)
          FROM policies p
         WHERE NOT EXISTS (
               SELECT 1 FROM companies c
                WHERE lower(c.name) = lower(p.company)
                  AND c.insurance_type = p.insurance_type
         )
         GROUP BY p.company, p.insurance_type
         ORDER BY 3 DESC
        """
    ).fetchall()
    if not rows:
        print("Unmatched policy companies: none")
        return
    print("Unmatched policy companies (legacy values preserved, not errors):")
    for company, ins_type, count, premium in rows:
        print(f"  - {company!r} / {ins_type}: {count} policies, premium {premium:,.0f}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--apply", action="store_true", help="write changes (creates a backup first)")
    group.add_argument("--restore", action="store_true", help="restore the most recent backup")
    args = parser.parse_args()

    if not DB_PATH.exists():
        raise SystemExit(f"Local database not found: {DB_PATH}")

    if args.restore:
        backup = latest_backup()
        if backup is None:
            raise SystemExit("No backup found to restore")
        shutil.copy2(backup, DB_PATH)
        print(f"Restored {DB_PATH.name} from {backup.name}")
        return

    entries = load_catalogue()
    conn = sqlite3.connect(DB_PATH)
    try:
        before = snapshot(conn)
        print("Before:", before)

        if not args.apply:
            canonical = {(e["official_name"].lower(), e["insurance_type"]) for e in entries}
            existing = conn.execute(
                "SELECT name, insurance_type, is_active FROM companies"
            ).fetchall()
            missing = sum(1 for key in canonical if key not in {(n.lower(), t) for n, t, _ in existing})
            to_deactivate = sum(
                1 for n, t, active in existing if active and (n.lower(), t) not in canonical
            )
            print(
                f"Dry run: would deactivate {to_deactivate} local companies, "
                f"insert {missing} canonical companies, "
                f"and normalize Care policies/products."
            )
            print("Run again with --apply to write (a backup is created automatically).")
            return

        backup = backup_db()
        print(f"Backup written: {backup}")
        result = apply(conn, entries)
        print("Applied:", result)
        print("After:", snapshot(conn))
        print_unmatched(conn)
        print("Restore with: python backend/scripts/seed_local_catalogue.py --restore")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
