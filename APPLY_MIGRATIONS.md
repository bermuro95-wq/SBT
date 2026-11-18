# SELAM BERTU TESFA — Apply Master Integrity Updates

## 1. Supabase SQL (required)

Project: `dfaxwzsiwrpwgambutro`

SQL Editor → run **in order**:

1. `MIGRATION_001_MASTER_INTEGRITY.sql` (this package)

This creates:
- Normalized unique reference indexes (income / expense+vendor)
- Case-insensitive unique emails on profiles
- `grand_budgets` + `budget_ledger`
- Triggers: approved income → grand budget credit; approved expense → budget debit
- Role helpers: `is_super_admin()`, `is_admin_or_above()`
- Tighter RLS on profiles, budgets, audit_logs
- Promotes `admin@selambertu.org` → `super_admin`

## 2. Frontend

Replace app files with this zip. Hard refresh (Ctrl+F5).

## 3. Roles

| Role | Login email (example) |
|------|------------------------|
| Super Admin | admin@selambertu.org (after SQL) |
| Administrator | any profile with role `administrator` |
| Accountant | role `accountant` |

Only Super Admin can assign Super Admin or delete other admins.

## 4. Duplicate references

Income: unique `reference_number` (case-insensitive, trimmed).
Expense: unique pair (`reference_number` + `vendor`).

## 5. Grand Budget

Budget page shows Grand Budget panel. Approved income increases total_income. Category allocations still managed as before; available = opening + income − allocated + released.
