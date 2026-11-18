# SELAM BERTU TESFA ORGANIZATION
## Annual Income & Expense Management System (Production)

Real system: HTML5 + CSS3 + Bootstrap 5 + vanilla JS + Supabase (PostgreSQL, Auth, Storage, RLS).

**No React. No mock data. No fake authentication.**

---

### Setup

1. Create Supabase project
2. SQL Editor → run in order:
   - `supabase/migrations/001_production_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/004_audit_enhancements.sql` (audit severity, integrity, failed-login RPC)
   - `SUPABASE_FIXES.sql` (if upgrading existing DB)
3. Storage → create buckets:
   - `avatars` (public)
   - `receipts` (private)
4. Auth → create users (Admin + Accountants), Auto Confirm ON
5. Table `profiles` → set `role`:
   - `administrator` for admin
   - `accountant` for accountants
6. Put Project URL + anon key in `supabase.js`
7. Deploy folder to Netlify (publish directory = project root)

---

### Roles

| Role | Capabilities |
|------|----------------|
| administrator | Full access including users, approvals, audit, settings |
| accountant | Income/expense/receipts/reports/budget; no admin menus |
| viewer | Read-only |

Enforced in UI (`permissions.js`) and database (RLS + triggers).

---

### Modules

Login, Dashboard, Income, Expenses, Transactions, Budget, Receipts, Reports, Analytics, Approvals, Users, Audit Logs, Settings, Profile.

All totals/charts/reports read from PostgreSQL. Empty data shows **ETB 0.00** / **No records found.**

---

### Security

- Supabase Auth only (no plaintext passwords)
- RLS on all sensitive tables
- Closed financial years blocked from non-admin edits
- Soft delete for financial records
- Audit via `write_audit_log` RPC
- Anon key only in browser (never service_role)

---

### Local run

Use Live Server or `npx serve` — do not rely on `file://`.

---

### Netlify

See `netlify.toml`. Set env only if you later inject config at build time; current client config is in `supabase.js` (public anon key only).
