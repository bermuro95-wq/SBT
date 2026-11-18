# SELAM BERTU TESFA — Complete Updated System (Debugged)

## Super Admin login
- Email: admin@selambertu.org
- Password: Admin@123456
- After SQL: role must be `super_admin`

## Apply in order

### A) Database (Supabase SQL Editor)
1. **FIX_SUPER_ADMIN_ROLE_CHECK.sql**  
   (allows role `super_admin`)
2. **MIGRATION_001_MASTER_INTEGRITY.sql**  
   (grand budget, duplicate refs, email uniqueness, RLS, triggers)
3. **SET_SUPER_ADMIN.sql** (optional verify)
4. Apply any other FIX_*.sql you have not yet run (see list in folder)

### B) Frontend
1. Unzip / replace the SBT folder with this package
2. Serve with: `npx --yes serve -l 3000` (from project folder)
3. Open http://localhost:3000
4. Hard refresh: Ctrl+F5 (or clear cache)

## What was fixed in this debug pass
- Removed invalid / unused files (syntax-broken sample data, orphan modules: income2.js, assets.js, i18nn.js, permistion.js, FileValidUtil.js)
- Fixed profiles.list filter to use `role` (text) instead of incorrect `role_id`
- Replaced virtually all browser `alert()` calls with the existing toast system (`showAppMessage` / `showToast`) for modern, non-blocking UX
- Hardened toast messages against XSS (escape user content, safe multi-line support)
- Improved toast styling (word-break, max-width, slightly longer display for errors)
- Consistent error / success feedback across Income, Expenses, Budget, Approvals, Receipts, Users, Settings, Reports, Transactions

## Included capabilities
- Roles: super_admin · administrator · accountant · viewer
- Login blocked for inactive / suspended (with reason)
- Duplicate income reference / expense reference+vendor prevention
- Grand Budget panel on Budget page
- Audit Logs: Who · When · What happened
- Settings visible for Super Admin / Administrator
- Faster UX (ux-fast.css + ux-polish.css)
- Approved-only totals in reports/dashboard

## Important
- Do not open as file:// — use a local server
- Confirm email OFF in Supabase Auth for admin-created users if needed
- Site URL / Redirect: http://localhost:3000 and reset-password.html
- Anon key is public (safe); never put service_role key in frontend
