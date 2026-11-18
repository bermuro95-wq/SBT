// ============================================================
// SELAM BERTU TESFA - Permissions Module
// ============================================================

const PERMISSIONS = {
    // Dashboard
    DASHBOARD_VIEW: { resource: 'dashboard', action: 'view' },
    
    // Income
    INCOME_VIEW: { resource: 'income', action: 'view' },
    INCOME_CREATE: { resource: 'income', action: 'create' },
    INCOME_EDIT: { resource: 'income', action: 'edit' },
    INCOME_DELETE: { resource: 'income', action: 'delete' },
    
    // Expenses
    EXPENSE_VIEW: { resource: 'expense', action: 'view' },
    EXPENSE_CREATE: { resource: 'expense', action: 'create' },
    EXPENSE_EDIT: { resource: 'expense', action: 'edit' },
    EXPENSE_DELETE: { resource: 'expense', action: 'delete' },
    
    // Approvals
    TRANSACTION_APPROVE: { resource: 'transaction', action: 'approve' },
    TRANSACTION_REJECT: { resource: 'transaction', action: 'reject' },
    
    // Receipts
    RECEIPT_VIEW: { resource: 'receipt', action: 'view' },
    RECEIPT_UPLOAD: { resource: 'receipt', action: 'upload' },
    
    // Reports
    REPORT_GENERATE: { resource: 'report', action: 'generate' },
    REPORT_EXPORT: { resource: 'report', action: 'export' },
    
    // Budget
    BUDGET_VIEW: { resource: 'budget', action: 'view' },
    BUDGET_MANAGE: { resource: 'budget', action: 'manage' },
    
    // Users
    USERS_VIEW: { resource: 'users', action: 'view' },
    USERS_MANAGE: { resource: 'users', action: 'manage' },
    
    // Roles
    ROLES_MANAGE: { resource: 'roles', action: 'manage' },
    
    // Audit
    AUDIT_VIEW: { resource: 'audit', action: 'view' },
    
    // Financial Years
    FINANCIAL_YEAR_VIEW: { resource: 'financial_year', action: 'view' },
    FINANCIAL_YEAR_MANAGE: { resource: 'financial_year', action: 'manage' },
    
    // Settings
    SETTINGS_MANAGE: { resource: 'settings', action: 'manage' }
};

// ============================================================
// Permission Check Functions
// ============================================================


// ============================================================
// Role hierarchy: super_admin > administrator > accountant
// ============================================================
function isSuperAdmin() {
    if (typeof AUTH === 'undefined') return false;
    try {
        if (AUTH.isSuperAdmin && typeof AUTH.isSuperAdmin === 'function' && AUTH.isSuperAdmin()) return true;
    } catch (e) {}
    let role = String(
        AUTH.currentProfile?.role ||
        AUTH.currentProfile?.role_name ||
        AUTH.currentUser?.role ||
        AUTH.currentUser?.user_metadata?.role ||
        (AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role) ||
        ''
    );
    if (!role) { try { role = sessionStorage.getItem('sbt_role') || ''; } catch (e) {} }
    role = role.toLowerCase().trim().replace(/[\s-]+/g, '_');
    return role === 'super_admin' || role === 'superadmin' || role.includes('super_admin');
}

function isAdminOrAbove() {
    if (isSuperAdmin()) return true;
    try {
        if (typeof AUTH !== 'undefined' && AUTH.isAdmin && AUTH.isAdmin()) return true;
    } catch (e) {}
    const role = String(
        (typeof AUTH !== 'undefined' && (AUTH.currentProfile?.role || AUTH.currentProfile?.role_name || AUTH.currentUser?.user_metadata?.role)) || ''
    ).toLowerCase().trim();
    return role === 'administrator' || role === 'admin' || role === 'super_admin' || role === 'superadmin';
}

function hasPermission(resource, action) {
    const user = (typeof AUTH !== 'undefined' && AUTH.getCurrentUser) ? AUTH.getCurrentUser() : null;
    const profile = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
    const role = String((user && user.role) || (profile && profile.role) || '').toLowerCase().trim();
    
    if (!user && !profile) return false;
    
    // Super Admin has full access (was missing — blocked approvals & grand budget)
    if (role === 'super_admin' || role === 'superadmin') return true;
    
    // Administrator has full access
    if (role === 'administrator' || role === 'admin') return true;
    
    // Explicit permissions from role_permissions if loaded
    const permissions = (user && user.permissions) || (profile && profile.permissions) || [];
    if (permissions.length > 0) {
        return permissions.some(p => p && p.resource === resource && p.action === action);
    }
    
    // Default Accountant permissions (when permissions array not loaded)
    if (role === 'accountant') {
        const accountantAllowed = {
            dashboard: ['view'],
            income: ['view', 'create', 'edit', 'delete'],
            expense: ['view', 'create', 'edit', 'delete'],
            receipt: ['view', 'upload'],
            report: ['generate', 'export'],
            budget: ['view'],  // view only — create/manage is admin
            financial_year: ['view'],
            transaction: []  // no approve/reject by default
        };
        return (accountantAllowed[resource] || []).includes(action);
    }
    
    // Viewer - read only
    if (role === 'viewer') {
        const viewerAllowed = {
            dashboard: ['view'],
            income: ['view'],
            expense: ['view'],
            receipt: ['view'],
            report: ['generate'],
            budget: ['view'],
            financial_year: ['view']
        };
        return (viewerAllowed[resource] || []).includes(action);
    }
    
    return false;
}

function canViewDashboard() {
    return hasPermission('dashboard', 'view');
}

function canViewIncome() {
    return hasPermission('income', 'view');
}

function canCreateIncome() {
    if (typeof AUTH !== 'undefined') {
        if (AUTH.isAdmin && AUTH.isAdmin()) return true;
        const role = (AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role)
            || (AUTH.getCurrentUser && AUTH.getCurrentUser()?.role);
        if (role === 'administrator' || role === 'accountant') return true;
        // Authenticated active user (profile may still be loading)
        if (AUTH.isAuthenticated && AUTH.isAuthenticated() && role !== 'viewer') return true;
    }
    return hasPermission('income', 'create');
}

function canEditIncome() {
    if (typeof AUTH !== 'undefined') {
        if (AUTH.isAdmin && AUTH.isAdmin()) return true;
        const role = (AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role)
            || (AUTH.getCurrentUser && AUTH.getCurrentUser()?.role);
        if (role === 'administrator' || role === 'accountant') return true;
        if (AUTH.isAuthenticated && AUTH.isAuthenticated() && role !== 'viewer') return true;
    }
    return hasPermission('income', 'edit');
}

function canDeleteIncome() {
    return hasPermission('income', 'delete');
}

function canViewExpenses() {
    return hasPermission('expense', 'view');
}

function canCreateExpense() {
    if (typeof AUTH !== 'undefined') {
        if (AUTH.isAdmin && AUTH.isAdmin()) return true;
        const role = (AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role)
            || (AUTH.getCurrentUser && AUTH.getCurrentUser()?.role);
        if (role === 'administrator' || role === 'accountant') return true;
        if (AUTH.isAuthenticated && AUTH.isAuthenticated() && role !== 'viewer') return true;
    }
    return hasPermission('expense', 'create');
}

function canEditExpense() {
    if (typeof AUTH !== 'undefined') {
        if (AUTH.isAdmin && AUTH.isAdmin()) return true;
        const role = (AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role)
            || (AUTH.getCurrentUser && AUTH.getCurrentUser()?.role);
        if (role === 'administrator' || role === 'accountant') return true;
        if (AUTH.isAuthenticated && AUTH.isAuthenticated() && role !== 'viewer') return true;
    }
    return hasPermission('expense', 'edit');
}

function canDeleteExpense() {
    return hasPermission('expense', 'delete');
}

function canApproveTransactions() {
    // Super Admin + Administrator can approve income and expenses
    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return true;
    if (typeof isAdminOrAbove === 'function' && isAdminOrAbove()) return true;
    const role = String(
        (typeof AUTH !== 'undefined' && AUTH.currentProfile?.role) ||
        (typeof AUTH !== 'undefined' && AUTH.currentUser?.user_metadata?.role) || ''
    ).toLowerCase().trim();
    if (['super_admin','superadmin','administrator','admin'].includes(role)) return true;
    return hasPermission('transaction', 'approve');
}

/** Super Admin and Administrator can approve income (funds Grand Budget) */
function canApproveIncome() {
    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return true;
    if (typeof isAdminOrAbove === 'function' && isAdminOrAbove()) return true;
    const role = String(
        (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile && AUTH.getCurrentProfile()?.role) ||
        (typeof AUTH !== 'undefined' && AUTH.currentProfile?.role) ||
        (typeof AUTH !== 'undefined' && AUTH.currentUser?.user_metadata?.role) || ''
    ).toLowerCase().trim();
    return role === 'super_admin' || role === 'superadmin' || role === 'administrator' || role === 'admin';
}

function canRejectTransactions() {
    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return true;
    if (typeof isAdminOrAbove === 'function' && isAdminOrAbove()) return true;
    return hasPermission('transaction', 'reject');
}

function canViewReceipts() {
    return hasPermission('receipt', 'view');
}

function canUploadReceipts() {
    return hasPermission('receipt', 'upload');
}

function canGenerateReports() {
    if (typeof AUTH !== 'undefined') {
        if (AUTH.isAdmin && AUTH.isAdmin()) return true;
        if (AUTH.isAuthenticated && AUTH.isAuthenticated()) return true;
    }
    return hasPermission('report', 'generate');
}

function canExportReports() {
    return hasPermission('report', 'export');
}

function canViewBudget() {
    // All logged-in users (admin + accountant) can see category budget amounts
    if (typeof AUTH !== 'undefined' && AUTH.isAuthenticated && AUTH.isAuthenticated()) return true;
    return hasPermission('budget', 'view');
}

/** Only Super Admin may set organization budget and allocate to categories */
function canManageBudget() {
    if (isSuperAdmin()) return true;
    return hasPermission('budget', 'manage') && isSuperAdmin();
}

/** View budget page (admins and accountants can view) */
function canViewBudget() {
    if (isAdminOrAbove() || isSuperAdmin()) return true;
    return hasPermission('budget', 'view');
}

function canViewUsers() {
    return hasPermission('users', 'view');
}

function canManageUsers() {
    if (isAdminOrAbove()) return true;
    return hasPermission('users', 'manage');
}

function canManageRoles() {
    if (isSuperAdmin()) return true;
    return false;
}

function canViewAudit() {
    return hasPermission('audit', 'view');
}

function canViewFinancialYears() {
    return hasPermission('financial_year', 'view');
}

function canManageFinancialYears() {
    return hasPermission('financial_year', 'manage');
}

function canManageSettings() {
    // Settings page is Super Admin only
    if (isSuperAdmin()) return true;
    return false;
}

// ============================================================
// UI Permission Guards
// ============================================================

function guardElement(selector, permission, fallbackAction = 'remove') {
    const elements = document.querySelectorAll(selector);
    const hasPerm = permission();
    
    elements.forEach(el => {
        if (!hasPerm) {
            if (fallbackAction === 'remove') {
                el.remove();
            } else if (fallbackAction === 'hide') {
                el.classList.add('d-none');
            } else if (fallbackAction === 'disable') {
                el.disabled = true;
            }
        }
    });
}

function guardElements(permissionMap) {
    Object.keys(permissionMap).forEach(selector => {
        const config = permissionMap[selector];
        guardElement(selector, config.permission, config.action || 'remove');
    });
}

// ============================================================
// Apply Permissions to Page
// ============================================================

function applyPagePermissions() {
    // Resolve role once
    let role = '';
    try {
        role = String(
            (typeof AUTH !== 'undefined' && (AUTH.currentProfile?.role || AUTH.currentProfile?.role_name || AUTH.currentUser?.user_metadata?.role)) ||
            (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sbt_role')) ||
            ''
        ).toLowerCase().trim().replace(/[\s-]+/g, '_');
    } catch (e) { role = ''; }

    const sa = role.includes('super')
        || (typeof isSuperAdmin === 'function' && isSuperAdmin())
        || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
    const admin = sa
        || role === 'administrator' || role === 'admin'
        || role.includes('admin')
        || (typeof isAdminOrAbove === 'function' && isAdminOrAbove())
        || (typeof AUTH !== 'undefined' && AUTH.isAdmin && AUTH.isAdmin());

    const showEl = (el) => {
        if (!el) return;
        el.classList.remove('d-none');
        el.style.removeProperty('display');
        el.style.visibility = 'visible';
        if (el.tagName === 'LI') el.style.display = 'list-item';
    };
    const hideEl = (el) => {
        if (!el) return;
        el.classList.add('d-none');
    };

    // Admin menus: Approvals, Users, Audit Logs — Super Admin + Administrator only
    document.querySelectorAll('.admin-only').forEach(el => {
        if (admin || sa) showEl(el);
        else hideEl(el);
    });

    // Super Admin only: Settings, danger zone, org budget allocate, etc.
    document.querySelectorAll('.super-admin-only').forEach(el => {
        if (sa) showEl(el);
        else hideEl(el);
    });

    // Settings link explicitly
    document.querySelectorAll('a[href="settings.html"]').forEach(a => {
        const li = a.closest('li');
        if (!li) return;
        if (sa) showEl(li);
        else hideEl(li);
    });

    // Budget manage controls — Super Admin only
    document.querySelectorAll('.need-budget-manage').forEach(el => {
        if (sa) showEl(el);
        else hideEl(el);
    });

    // Super Admin: show every need-* control and stop
    if (sa) {
        document.querySelectorAll('[class*="need-"]').forEach(showEl);
        document.querySelectorAll('.admin-only, .super-admin-only').forEach(showEl);
        return;
    }

    // Non-SA: apply fine-grained guards
    const permissionMap = {
        '.need-income-view': { permission: canViewIncome, action: 'remove' },
        '.need-income-create': { permission: canCreateIncome, action: 'remove' },
        '.need-income-edit': { permission: canEditIncome, action: 'remove' },
        '.need-income-delete': { permission: canDeleteIncome, action: 'remove' },
        '.need-expense-view': { permission: canViewExpenses, action: 'remove' },
        '.need-expense-create': { permission: canCreateExpense, action: 'remove' },
        '.need-expense-edit': { permission: canEditExpense, action: 'remove' },
        '.need-expense-delete': { permission: canDeleteExpense, action: 'remove' },
        '.need-approve': { permission: canApproveTransactions, action: 'hide' },
        '.need-reject': { permission: canRejectTransactions, action: 'hide' },
        '.need-receipt-upload': { permission: canUploadReceipts, action: 'remove' },
        '.need-report-generate': { permission: canGenerateReports, action: 'remove' },
        '.need-report-export': { permission: canExportReports, action: 'remove' },
        '.need-budget-manage': { permission: canManageBudget, action: 'hide' },
        '.need-settings-manage': { permission: canManageSettings, action: 'hide' },
        '.need-users-view': { permission: canViewUsers, action: 'remove' },
        '.need-users-manage': { permission: canManageUsers, action: 'remove' },
        '.need-audit-view': { permission: canViewAudit, action: 'remove' },
        '.need-financial-year-manage': { permission: canManageFinancialYears, action: 'remove' }
    };
    guardElements(permissionMap);
}


// ============================================================
// Initialize Permissions
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (typeof AUTH !== 'undefined' && AUTH.init) {
            await AUTH.init();
        }
    } catch (e) {}
    applyPagePermissions();
    // Retry while profile/role loads (fixes hidden Approvals for Super Admin)
    [300, 800, 1500, 2500].forEach(function(ms) {
        setTimeout(function() { applyPagePermissions(); }, ms);
    });
});

// ============================================================
// Export for use in other modules
// ============================================================

window.PERMISSIONS = PERMISSIONS;
window.hasPermission = hasPermission;
window.applyPagePermissions = applyPagePermissions;
window.isSuperAdmin = isSuperAdmin;
window.isAdminOrAbove = isAdminOrAbove;
window.canApproveTransactions = canApproveTransactions;
window.canApproveIncome = canApproveIncome;
window.canRejectTransactions = canRejectTransactions;
window.canManageBudget = canManageBudget;
window.canViewBudget = canViewBudget;