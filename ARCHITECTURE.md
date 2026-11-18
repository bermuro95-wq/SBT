# System Architecture — SELAM BERTU TESFA ORGANIZATION

## Stack
- Frontend: HTML5, CSS3, Bootstrap 5, Chart.js, vanilla JS modules
- Backend: Supabase Auth + PostgreSQL + RLS + Storage
- Deploy: Netlify (static hosting)

## Principles
- Real data only from Supabase
- No mock APIs, no hardcoded financial totals
- Empty states when no rows exist
- RBAC in UI + RLS in database
- Soft delete for financial records
- Audit trail for sensitive actions

## Auth
- Supabase email/password
- Profile row linked via `profiles.auth_id`
- Session in browser; protected pages redirect to login

## RBAC
- Roles: administrator, accountant, viewer
- `permissions` + `role_permissions` tables
- Frontend: `permissions.js` / `AUTH.isAdmin()`
- Backend: RLS policies + `is_admin()` SQL function

## Financial workflow
1. Accountant creates income/expense (draft/submitted)
2. Appears in Approvals when submitted
3. Admin approves/rejects → status updated + audit
4. Dashboard/reports use approved records
5. Closed financial years block non-admin modifications (trigger)

## Modules
login, dashboard, income, expenses, transactions, budget, receipts,
reports, analytics, approvals, users, audit-logs, settings, profile

## Storage
- avatars (public read)
- receipts (authenticated)

## Migrations
1. `supabase/migrations/001_production_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. Optional storage notes in `003_storage.sql`
