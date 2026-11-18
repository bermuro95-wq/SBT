# SELAM BERTU TESFA — Organization Budget Model

## How the budget works now

1. **Super Admin sets Organization Budget** (example: 5,000,000 ETB)
   - This is the master pool (ceiling + opening).
   - Button: **Set Organization Budget** on the Budget page.

2. **Approved income adds to the pool**
   - Only Super Admin can approve income.
   - When income is approved → total_income increases → Available increases.

3. **Super Admin allocates to categories**
   - Example: Office 200,000 → reduces Available by 200,000.
   - Transport 150,000 → reduces Available further.
   - You cannot allocate more than Available (stops at zero).

4. **Formula**
   Total Pool  = Org Budget + Opening + Approved Income
   Available   = Total Pool − Allocated to categories

5. **History**
   - Every set-org-budget, income approval, and category allocation is written to budget_ledger
     and shown under Budget History on the Budget page.

## Who can do what

| Action | Who |
|--------|-----|
| Set organization budget (e.g. 5M) | Super Admin only |
| Allocate to categories | Super Admin only |
| Approve income | Super Admin only |
| Create income / expenses | Accountant / Admin |
| View budget and history | Admin / Accountant (view) |

## Login

- Email: admin@selambertu.org
- Password: Admin@123456
- Role: super_admin (after SQL)

## Supabase SQL (if not already run)

Run FIX_GRAND_BUDGET_RLS.sql once so grand_budgets and budget_ledger exist.

## Steps to use

1. Login as Super Admin.
2. Open Budget.
3. Click Set Organization Budget → enter e.g. 5000000 → Save.
4. Click Add Budget / Allocate → choose category (Office) → amount → Save.
5. Available decreases.
6. Approve income on Approvals page → Available increases.
7. Check Budget History for the register of all movements.
