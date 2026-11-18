// ============================================================
// SELAM BERTU TESFA - Settings Module (Admin Only)
// ============================================================

class SettingsModule {
    constructor() {
        this.settings = {};
        this.incomeCategories = [];
        this.expenseCategories = [];
        this.paymentMethods = [];
        
        this.init();
    }
    
    async init() {
        try {
            // Check admin permission
            // Wait for profile/role
            for (let i = 0; i < 10; i++) {
                if (AUTH.currentProfile || (AUTH.isAdmin && AUTH.isAdmin())) break;
                await new Promise(r => setTimeout(r, 120));
                try { if (AUTH.init) await AUTH.init(); } catch (e) {}
            }
            // Gate moved below — only Super Admin continues; this early exit is for logged-out / unknown
            const hasProfile = !!(AUTH.currentProfile || AUTH.currentUser);
            if (!hasProfile && !(AUTH.isAuthenticated && AUTH.isAuthenticated())) {
                const pc = document.querySelector('.page-content');
                if (pc) {
                    pc.innerHTML = `
                    <div class="alert alert-danger">
                        You do not have permission to access settings. Please log in as Super Admin.
                    </div>`;
                }
                return;
            }
            // Settings is Super Admin only (not regular administrator)
            const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
                || (AUTH.isSuperAdmin && AUTH.isSuperAdmin())
                || ['super_admin', 'superadmin'].includes(String(AUTH.currentProfile?.role || '').toLowerCase().trim());
            if (!isSA) {
                const pc = document.querySelector('.page-content');
                if (pc) {
                    pc.innerHTML = `
                    <div class="alert alert-warning">
                        <h5 class="alert-heading">Super Admin only</h5>
                        <p class="mb-0">System Settings are restricted to <strong>Super Admin</strong>. Regular administrators cannot open this page.</p>
                        <p class="small text-muted mt-2 mb-0">Your role: ${String(AUTH.currentProfile?.role || 'unknown')}</p>
                    </div>`;
                }
                return;
            }
            // Show all settings sections for Super Admin
            document.querySelectorAll('.admin-only, .super-admin-only').forEach(el => {
                el.classList.remove('d-none');
                el.style.display = '';
            });
            // Prevent layout jump: ensure page content is fully visible
            const pc = document.querySelector('.page-content');
            if (pc) {
                pc.style.minHeight = 'auto';
                pc.style.overflow = 'visible';
            }
            
            await this.loadSettings();
            await this.loadCategories();
            await this.loadPaymentMethods();
            
            this.setupUI();
            this.setupEventListeners();
            this.renderCategories();
            this.renderPaymentMethods();
            this.loadExtraSettingsUI();

            const dz = document.querySelector('.card.border-danger .card-header h5');
            if (dz) dz.textContent = 'Danger Zone — Permanent Data Removal (Super Admin only)';
            
        } catch (error) {
            console.error('Settings init error:', error);
            this.showError('Failed to load settings.');
        }
    }
    
    async loadSettings() {
        const { data, error } = await supabase
            .from('system_settings')
            .select('*');
        
        if (!error && data) {
            data.forEach(item => {
                this.settings[item.key] = item.value;
            });
        }
    }
    
    async loadCategories() {
        // Income categories
        const { data: income, error: iError } = await supabase
            .from('income_categories')
            .select('*')
            .order('name');
        
        if (!iError) this.incomeCategories = income || [];
        
        // Expense categories
        const { data: expense, error: eError } = await supabase
            .from('expense_categories')
            .select('*')
            .order('name');
        
        if (!eError) this.expenseCategories = expense || [];
    }
    
    async loadPaymentMethods() {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .order('name');
        
        if (!error) this.paymentMethods = data || [];
    }
    
    setupUI() {
        // Populate organization settings
        const orgName = this.settings['organization_name']?.value || 'SELAM BERTU TESFA ORGANIZATION';
        document.getElementById('org-name').value = orgName;
        
        const currency = this.settings['default_currency']?.value || 'ETB';
        document.getElementById('org-currency').value = currency;
        
        const language = this.settings['language']?.value || 'en';
        document.getElementById('org-language').value = language;
        
        const theme = this.settings['theme']?.value || 'light';
        document.getElementById('org-theme').value = theme;
    }
    
    setupEventListeners() {
        // Organization settings form
        document.getElementById('org-settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveOrganizationSettings();
        });
        
        // Add income category
        document.getElementById('add-income-category')?.addEventListener('click', () => {
            const input = document.getElementById('new-income-category');
            const name = input.value.trim();
            if (name) {
                this.addCategory('income', name);
                input.value = '';
            }
        });
        
        // Add expense category
        document.getElementById('add-expense-category')?.addEventListener('click', () => {
            const input = document.getElementById('new-expense-category');
            const name = input.value.trim();
            if (name) {
                this.addCategory('expense', name);
                input.value = '';
            }
        });
        
        // Add payment method
        document.getElementById('add-payment-method')?.addEventListener('click', () => {
            const input = document.getElementById('new-payment-method');
            const name = input.value.trim();
            if (name) {
                this.addPaymentMethod(name);
                input.value = '';
            }
        });
        
        // Enter key support
        document.getElementById('new-income-category')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('add-income-category').click();
        });
        document.getElementById('new-expense-category')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('add-expense-category').click();
        });
        document.getElementById('new-payment-method')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('add-payment-method').click();
        });
    }
    
    async saveOrganizationSettings() {
        const settings = {
            organization_name: document.getElementById('org-name').value.trim(),
            default_currency: document.getElementById('org-currency').value,
            language: document.getElementById('org-language').value,
            theme: document.getElementById('org-theme').value
        };
        if (!settings.organization_name) {
            this.showMessage('Organization name is required.', 'danger', 'org-settings-message');
            return;
        }
        let hasError = false;
        const errors = [];
        const profileId = AUTH.getCurrentProfile()?.id || null;
        for (const [key, val] of Object.entries(settings)) {
            const payload = {
                key: key,
                value: String(val ?? ''),
                updated_at: new Date().toISOString()
            };
            if (profileId) payload.updated_by = profileId;
            // Try update by key first, then insert
            let error = null;
            const existing = await supabase.from('system_settings').select('id').eq('key', key).maybeSingle();
            if (existing.data?.id) {
                const up = await supabase.from('system_settings').update(payload).eq('id', existing.data.id);
                error = up.error;
            } else {
                const ins = await supabase.from('system_settings').insert(payload);
                error = ins.error;
                if (error) {
                    const ups = await supabase.from('system_settings').upsert(payload, { onConflict: 'key' });
                    error = ups.error;
                }
            }
            if (error) {
                hasError = true;
                errors.push(key + ': ' + error.message);
                console.error('Error saving setting:', key, error);
            } else {
                this.settings[key] = val;
            }
        }
        // Always persist locally so UI keeps working
        try {
            const local = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
            Object.assign(local, settings);
            localStorage.setItem('sbt_system_settings', JSON.stringify(local));
        } catch (e) {}
        if (hasError) {
            this.showMessage('Some settings could not be saved to the database: ' + errors.join('; ') + '. Local copy was updated.', 'warning', 'org-settings-message');
        } else {
            this.showMessage('Settings saved successfully!', 'success', 'org-settings-message');
            if (typeof i18n !== 'undefined' && i18n.setLanguage) i18n.setLanguage(settings.language);
            document.documentElement.setAttribute('data-theme', settings.theme);
            localStorage.setItem('sbt_theme', settings.theme);
            if (typeof logAudit === 'function') {
                try { await logAudit('SETTINGS_UPDATE', 'system_settings', null, null, settings); } catch (e) {}
            }
        }
    }
    
    async addCategory(type, name) {
        const table = type === 'income' ? 'income_categories' : 'expense_categories';
        const { data, error } = await supabase
            .from(table)
            .insert({ name: name })
            .select()
            .single();
        
        if (error) {
            this.showToast(error.message || 'Failed to add category.', 'error');
            return;
        }
        
        this.showToast('Category added successfully!', 'success');
        
        if (type === 'income') {
            this.incomeCategories.push(data);
            this.renderIncomeCategories();
        } else {
            this.expenseCategories.push(data);
            this.renderExpenseCategories();
        }
    }
    
    async deleteCategory(type, id) {
        if (!confirm('Are you sure you want to delete this category?')) return;
        
        const table = type === 'income' ? 'income_categories' : 'expense_categories';
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
        
        if (error) {
            this.showToast(error.message || 'Failed to delete category.', 'error');
            return;
        }
        
        this.showToast('Category deleted successfully!', 'success');
        
        if (type === 'income') {
            this.incomeCategories = this.incomeCategories.filter(c => c.id !== id);
            this.renderIncomeCategories();
        } else {
            this.expenseCategories = this.expenseCategories.filter(c => c.id !== id);
            this.renderExpenseCategories();
        }
    }
    
    async addPaymentMethod(name) {
        const { data, error } = await supabase
            .from('payment_methods')
            .insert({ name: name })
            .select()
            .single();
        
        if (error) {
            this.showToast(error.message || 'Failed to add payment method.', 'error');
            return;
        }
        
        this.showToast('Payment method added successfully!', 'success');
        this.paymentMethods.push(data);
        this.renderPaymentMethods();
    }
    
    async deletePaymentMethod(id) {
        if (!confirm('Are you sure you want to delete this payment method?')) return;
        
        const { error } = await supabase
            .from('payment_methods')
            .delete()
            .eq('id', id);
        
        if (error) {
            this.showToast(error.message || 'Failed to delete payment method.', 'error');
            return;
        }
        
        this.showToast('Payment method deleted successfully!', 'success');
        this.paymentMethods = this.paymentMethods.filter(p => p.id !== id);
        this.renderPaymentMethods();
    }
    
    renderCategories() {
        this.renderIncomeCategories();
        this.renderExpenseCategories();
    }
    
    renderIncomeCategories() {
        const container = document.getElementById('income-categories-list');
        if (!container) return;
        
        if (this.incomeCategories.length === 0) {
            container.innerHTML = '<p class="text-muted small">No income categories defined.</p>';
            return;
        }
        
        container.innerHTML = this.incomeCategories.map(c => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span>${this.escapeHtml(c.name)}</span>
                <button class="btn btn-sm btn-outline-danger delete-category-btn" 
                        data-type="income" data-id="${c.id}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
        
        container.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteCategory(btn.dataset.type, btn.dataset.id);
            });
        });
    }
    
    renderExpenseCategories() {
        const container = document.getElementById('expense-categories-list');
        if (!container) return;
        
        if (this.expenseCategories.length === 0) {
            container.innerHTML = '<p class="text-muted small">No expense categories defined.</p>';
            return;
        }
        
        container.innerHTML = this.expenseCategories.map(c => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span>${this.escapeHtml(c.name)}</span>
                <button class="btn btn-sm btn-outline-danger delete-category-btn" 
                        data-type="expense" data-id="${c.id}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
        
        container.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteCategory(btn.dataset.type, btn.dataset.id);
            });
        });
    }
    
    renderPaymentMethods() {
        const container = document.getElementById('payment-methods-list');
        if (!container) return;
        
        if (this.paymentMethods.length === 0) {
            container.innerHTML = '<p class="text-muted small">No payment methods defined.</p>';
            return;
        }
        
        container.innerHTML = this.paymentMethods.map(p => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span>${this.escapeHtml(p.name)}</span>
                <button class="btn btn-sm btn-outline-danger delete-payment-btn" data-id="${p.id}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
        
        container.querySelectorAll('.delete-payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deletePaymentMethod(btn.dataset.id);
            });
        });
    }
    
    showMessage(message, type, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        el.className = `alert alert-${type} mt-3`;
        el.textContent = message;
        el.classList.remove('d-none');
        
        setTimeout(() => {
            el.classList.add('d-none');
        }, 5000);
    }
    
    showToast(message, type = 'info') {
        if (window.app) {
            app.showToast(type === 'success' ? 'Success' : 'Error', message);
        } else {
            if (typeof showAppMessage === "function") showAppMessage("Notice", message, "info"); else console.log(message);
        }
    }
    
    showError(message) {
        if (window.app) {
            app.showError(message);
        } else {
            if (typeof showAppMessage === "function") showAppMessage("Error", message, "error"); else console.error(message);
        }
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- Extra settings (Security + Financial Preferences) ----------
    loadExtraSettingsUI() {
        // Merge DB settings with localStorage (local wins for security toggles when cloud failed)
        let s = Object.assign({}, this.settings || {});
        try {
            const local = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
            s = Object.assign(s, local);
            this.settings = s;
        } catch (e) {}
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = val === true || val === 'true' || val === '1';
            else el.value = val != null ? val : el.value;
        };
        setVal('setting-session-timeout', s.session_timeout_minutes || 60);
        setVal('setting-max-login-attempts', s.max_login_attempts || 5);
        setVal('setting-lockout-minutes', s.lockout_minutes || 15);
        setVal('setting-password-lock-enabled', s.password_lock_enabled !== 'false');
        setVal('setting-allow-password-reset', s.allow_password_reset !== 'false');
        setVal('setting-require-approval', s.require_approval !== 'false');
        setVal('setting-block-inactive', s.block_inactive !== 'false');
        setVal('setting-maintenance-mode', s.maintenance_mode === 'true' || s.maintenance_mode === true);
        setVal('setting-approval-threshold', s.approval_threshold || 0);
        setVal('setting-fy-label', s.default_fy_label || '');
        setVal('setting-require-income-before-expense', s.require_income_before_expense !== 'false');
        setVal('setting-allow-negative-budget', s.allow_negative_budget === 'true' || s.allow_negative_budget === true);
        setVal('setting-notify-approvals', s.notify_approvals !== 'false');
        setVal('setting-show-grand-budget', s.show_grand_budget !== 'false');

        const secBtn = document.getElementById('save-security-settings');
        if (secBtn && !secBtn._bound) {
            secBtn._bound = true;
            secBtn.addEventListener('click', () => this.saveExtraSettings('security'));
        }
        const finBtn = document.getElementById('save-finance-settings');
        if (finBtn && !finBtn._bound) {
            finBtn._bound = true;
            finBtn.addEventListener('click', () => this.saveExtraSettings('finance'));
        }
    }

    async saveExtraSettings(which) {
        const pairs = which === 'security' ? [
            ['session_timeout_minutes', document.getElementById('setting-session-timeout')?.value || '60'],
            ['max_login_attempts', document.getElementById('setting-max-login-attempts')?.value || '5'],
            ['lockout_minutes', document.getElementById('setting-lockout-minutes')?.value || '15'],
            ['password_lock_enabled', document.getElementById('setting-password-lock-enabled')?.checked ? 'true' : 'false'],
            ['allow_password_reset', document.getElementById('setting-allow-password-reset')?.checked ? 'true' : 'false'],
            ['require_approval', document.getElementById('setting-require-approval')?.checked ? 'true' : 'false'],
            ['block_inactive', document.getElementById('setting-block-inactive')?.checked ? 'true' : 'false'],
            ['maintenance_mode', document.getElementById('setting-maintenance-mode')?.checked ? 'true' : 'false']
        ] : [
            ['approval_threshold', document.getElementById('setting-approval-threshold')?.value || '0'],
            ['default_fy_label', document.getElementById('setting-fy-label')?.value || ''],
            ['require_income_before_expense', document.getElementById('setting-require-income-before-expense')?.checked ? 'true' : 'false'],
            ['allow_expense_without_income', document.getElementById('setting-require-income-before-expense')?.checked ? 'false' : 'true'],
            ['allow_negative_budget', document.getElementById('setting-allow-negative-budget')?.checked ? 'true' : 'false'],
            ['notify_approvals', document.getElementById('setting-notify-approvals')?.checked ? 'true' : 'false'],
            ['show_grand_budget', document.getElementById('setting-show-grand-budget')?.checked ? 'true' : 'false']
        ];

        const msgId = which === 'security' ? 'security-settings-msg' : 'finance-settings-msg';
        const msgEl = document.getElementById(msgId);
        const errors = [];
        try {
            for (const [key, value] of pairs) {
                this.settings[key] = value;
            }
            // Always save locally so Security settings work even if DB RLS blocks
            try {
                localStorage.setItem('sbt_system_settings', JSON.stringify(this.settings));
                // Login lockout timer reads these keys
                if (this.settings.max_login_attempts != null) {
                    localStorage.setItem('sbt_max_login_attempts', String(this.settings.max_login_attempts));
                }
                if (this.settings.lockout_minutes != null) {
                    localStorage.setItem('sbt_lockout_minutes', String(this.settings.lockout_minutes));
                }
            } catch (e) {}

            for (const [key, value] of pairs) {
                const strVal = String(value);
                // Try update existing key first
                let { data: existing, error: selErr } = await supabase
                    .from('system_settings')
                    .select('id, key')
                    .eq('key', key)
                    .maybeSingle();
                if (existing && existing.id) {
                    const up = await supabase.from('system_settings')
                        .update({ value: strVal, updated_at: new Date().toISOString() })
                        .eq('id', existing.id);
                    if (up.error) errors.push(key + ': ' + up.error.message);
                } else {
                    const ins = await supabase.from('system_settings').insert({
                        key,
                        value: strVal,
                        updated_at: new Date().toISOString()
                    });
                    if (ins.error) {
                        // Last try: upsert on key
                        const ups = await supabase.from('system_settings').upsert(
                            { key, value: strVal, updated_at: new Date().toISOString() },
                            { onConflict: 'key' }
                        );
                        if (ups.error) errors.push(key + ': ' + ups.error.message);
                    }
                }
            }

            if (errors.length) {
                console.warn('settings DB save partial', errors);
                if (msgEl) {
                    msgEl.innerHTML = '<span class="text-success">Saved on this device.</span> <span class="text-warning">Cloud sync issue — run FIX_GRAND_BUDGET_RLS.sql in Supabase.</span>';
                }
                if (typeof showAppMessage === 'function') {
                    showAppMessage('Saved locally', 'Settings apply on this browser. Run FIX_GRAND_BUDGET_RLS.sql so Super Admin can save to the database.', 'warning');
                }
            } else {
                if (msgEl) msgEl.innerHTML = '<span class="text-success">Saved successfully (device + cloud).</span>';
                if (typeof showAppMessage === 'function') {
                    showAppMessage('Saved', (which === 'security' ? 'Security' : 'Financial') + ' preferences updated.', 'success');
                }
            }
        } catch (e) {
            console.error(e);
            // Local save still done above
            if (msgEl) msgEl.innerHTML = '<span class="text-success">Saved on this device.</span> <span class="text-danger">Cloud: ' + (e.message || e) + '</span>';
            if (typeof showAppMessage === 'function') {
                showAppMessage('Saved locally', 'Settings work on this browser. Cloud save failed: ' + (e.message || e), 'warning');
            }
        }
    }
}

// ============================================================
// Initialize Settings Module
// ============================================================

if (document.getElementById('org-settings-form')) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Settings module ready');
    });
}

// Admin purge binder (settings page)
(function bindPurgeWhenReady() {
    function run() {
        const btn = document.getElementById('admin-purge-all-btn');
        if (!btn || btn._purgeBound) return;
        btn._purgeBound = true;
        btn.addEventListener('click', async () => {
            const isSA = (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin())
                || (typeof isSuperAdmin === 'function' && isSuperAdmin());
            if (!isSA) {
                if (typeof showAppMessage === "function") showAppMessage("Denied", 'Only Super Admin can delete all financial data.', "error");
                else console.log('Only Super Admin can purge.');
                return;
            }
            if (!confirm('SUPER ADMIN ONLY: Permanently delete ALL data including:\n• Income & Expenses\n• Budgets & Organization Budget\n• Budget History\n• Receipts, Approvals, Memos\n• Notifications & Audit Logs\n\nUser accounts will remain.\nThis cannot be undone.')) return;
            if (!(await confirmPermanentDelete('Final confirmation: purge ALL financial and audit data permanently.'))) return;
            const msg = document.getElementById('purge-message');
            if (msg) msg.innerHTML = '<div class="alert alert-info">Creating mandatory backup before deletion...</div>';
            btn.disabled = true;
            // MANDATORY BACKUP before purge (DB table OR downloadable JSON fallback)
            try {
                const tables = ['income','expenses','budgets','grand_budgets','budget_ledger','approvals','receipts','memos','audit_logs','notifications'];
                const payload = {};
                const row_counts = {};
                for (const tb of tables) {
                    try {
                        const res = await supabase.from(tb).select('*').limit(3000);
                        payload[tb] = res.data || [];
                        row_counts[tb] = (res.data || []).length;
                    } catch (e) {
                        payload[tb] = [];
                        row_counts[tb] = 0;
                    }
                }
                const profile = AUTH.getCurrentProfile?.() || {};
                const sizeEst = JSON.stringify(payload).length;
                const hash = String(sizeEst) + '-' + Date.now();
                const label = 'Pre-purge backup ' + new Date().toISOString();
                let backupOk = false;
                let backupNote = '';

                // 1) Try database table (if migration was applied)
                try {
                    const bak = await supabase.from('data_backups').insert({
                        label: label,
                        backup_type: 'pre_purge',
                        payload: payload,
                        tables_included: tables,
                        row_counts: row_counts,
                        file_size_estimate: sizeEst,
                        integrity_hash: hash,
                        created_by: profile.id || null,
                        created_by_name: profile.full_name || profile.email || 'Super Admin',
                        status: 'ready'
                    }).select().maybeSingle();
                    if (!bak.error) {
                        backupOk = true;
                        backupNote = 'Saved to database.';
                        try {
                            await supabase.from('backup_access_logs').insert({
                                backup_id: bak.data?.id,
                                action: 'create',
                                performed_by: profile.id,
                                performed_by_name: profile.full_name || profile.email,
                                details: 'Mandatory pre-purge backup'
                            });
                        } catch (e) {}
                    } else {
                        console.warn('data_backups insert failed (table may be missing):', bak.error.message);
                        backupNote = bak.error.message;
                    }
                } catch (e) {
                    console.warn('data_backups unavailable', e);
                    backupNote = String(e.message || e);
                }

                // 2) Always download a JSON backup file + keep local copy (works without migration)
                try {
                    const blob = new Blob([JSON.stringify({ label, created_at: new Date().toISOString(), row_counts, data: payload }, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'sbt_backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 2000);
                    localStorage.setItem('sbt_last_purge_backup', JSON.stringify({ label, row_counts, at: new Date().toISOString(), size: sizeEst }));
                    try { localStorage.setItem('sbt_last_purge_backup_full', JSON.stringify({ label, created_at: new Date().toISOString(), row_counts, data: payload })); } catch (e2) { console.warn('full backup too large for localStorage', e2); }
                    backupOk = true;
                    backupNote = (backupNote ? backupNote + ' | ' : '') + 'JSON backup downloaded to your computer.';
                } catch (e) {
                    console.error('Client backup download failed', e);
                }

                if (!backupOk) {
                    if (msg) msg.innerHTML = '<div class="alert alert-danger">Backup failed: ' + (backupNote || 'unknown') + '. Deletion aborted.</div>';
                    btn.disabled = false;
                    if (typeof showAppMessage === 'function') showAppMessage('Backup failed', 'Could not create backup. Deletion blocked.', 'error');
                    return;
                }
                if (typeof logAudit === 'function') {
                    try { await logAudit('BACKUP_CREATE', 'data_backups', null, null, { type: 'pre_purge', size: sizeEst, note: backupNote }); } catch (e) {}
                }
                if (msg) msg.innerHTML = '<div class="alert alert-success">Backup ready (' + backupNote + '). Deleting data...</div>';
            } catch (e) {
                console.error(e);
                if (msg) msg.innerHTML = '<div class="alert alert-danger">Backup failed: ' + (e.message || e) + '. Deletion aborted.</div>';
                btn.disabled = false;
                return;
            }
            // Delete ALL operational data — including Budget History & Grand Budget
            // Order: children first, then parents
            const tables = [
                'budget_ledger',      // Budget History
                'grand_budgets',      // Organization / Grand Budget pool
                'receipts',
                'approvals',
                'audit_evidence',
                'notifications',
                'memos',
                'income',
                'expenses',
                'budgets',
                'budget_lines',
                'transactions',
                'files',
                'audit_logs'
            ];
            const errors = [];
            async function wipeTable(t) {
                let res = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (res.error) res = await supabase.from(t).delete().gte('created_at', '1970-01-01');
                if (res.error) res = await supabase.from(t).delete().gte('created_at', '2000-01-01T00:00:00Z');
                if (res.error) {
                    res = await supabase.from(t).delete().gte('timestamp', '1970-01-01');
                }
                if (res.error) {
                    const all = await supabase.from(t).select('id').limit(8000);
                    const ids = (all.data || []).map(r => r.id).filter(Boolean);
                    for (const id of ids) {
                        const d = await supabase.from(t).delete().eq('id', id);
                        if (d.error) { res = d; break; }
                        res = { error: null };
                    }
                    if (!ids.length) res = { error: null };
                }
                // Verify empty
                try {
                    const left = await supabase.from(t).select('id', { count: 'exact', head: true });
                    if (left.count && left.count > 0) {
                        const again = await supabase.from(t).select('id').limit(8000);
                        for (const row of (again.data || [])) {
                            await supabase.from(t).delete().eq('id', row.id);
                        }
                    }
                } catch (e) {}
                return res;
            }
            for (const t of tables) {
                try {
                    const res = await wipeTable(t);
                    if (res && res.error) errors.push(t + ': ' + res.error.message);
                } catch (e) { errors.push(t + ': ' + (e.message || e)); }
            }
            // Extra passes for history + grand budget + audit (must wipe activity feed)
            for (const t of ['budget_ledger', 'grand_budgets', 'audit_logs', 'income', 'expenses', 'budgets', 'approvals', 'notifications', 'memos', 'receipts']) {
                try { await wipeTable(t); } catch (e) {}
            }
            // Force-delete every audit_logs row (activity list)
            try {
                let guard = 0;
                while (guard < 20) {
                    guard++;
                    const { data: rows } = await supabase.from('audit_logs').select('id').limit(500);
                    if (!rows || !rows.length) break;
                    for (const row of rows) {
                        await supabase.from('audit_logs').delete().eq('id', row.id);
                    }
                }
                // Alternate delete filters if id-based fails
                await supabase.from('audit_logs').delete().neq('action', '___never___');
                await supabase.from('audit_logs').delete().gte('timestamp', '1970-01-01');
                await supabase.from('audit_logs').delete().gte('created_at', '1970-01-01');
            } catch (e) { console.warn('audit_logs force wipe', e); }
            // Clear activity UI immediately
            try {
                const ab = document.getElementById('admin-activity-body');
                if (ab) ab.innerHTML = '<tr><td colspan="5" class="text-muted">No activity recorded yet.</td></tr>';
            } catch (e) {}
            // Reset financial year balances
            try {
                const fy = await supabase.from('financial_years').update({
                    opening_balance: 0,
                    annual_budget: 0
                }).neq('id', '00000000-0000-0000-0000-000000000000');
                if (fy.error) {
                    await supabase.from('financial_years').update({ opening_balance: 0 }).gte('created_at', '1970-01-01');
                }
            } catch (e) { errors.push('financial_years balance reset: ' + (e.message || e)); }

            // Clear local caches so UI shows zeros immediately
            try {
                localStorage.removeItem('sbt_system_settings');
            } catch (e) {}

            btn.disabled = false;
            if (msg) {
                msg.innerHTML = errors.length
                    ? ('<div class="alert alert-warning">Done with errors:<br>' + errors.join('<br>') + '<br><small>If Budget History remains, run FIX_PURGE_COMPLETE.sql in Supabase.</small></div>')
                    : '<div class="alert alert-success">All data permanently deleted — including Budget History, Grand Budget, income, expenses, budgets, and audit logs. Balances reset to 0.</div>';
            }
            if (typeof showAppMessage === 'function') {
                showAppMessage(errors.length ? 'Completed with errors' : 'Purge complete',
                    errors.length
                        ? 'Purge finished with some errors. Run FIX_PURGE_COMPLETE.sql if history remains.'
                        : 'Everything deleted: Budget History, Grand Budget, income, expenses, budgets, audit logs. Balances are 0.',
                    errors.length ? 'warning' : 'success');
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();


// ============================================================
// Backup Recovery (Super Admin) — restore by year or JSON file
// ============================================================
(function bindRestoreWhenReady() {
    function isSA() {
        return (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin())
            || (typeof isSuperAdmin === 'function' && isSuperAdmin());
    }
    function msg(html, type) {
        const el = document.getElementById('restore-message');
        if (el) el.innerHTML = '<div class="alert alert-' + (type || 'info') + '">' + html + '</div>';
        if (typeof showAppMessage === 'function') {
            const plain = html.replace(/<[^>]+>/g, ' ');
            showAppMessage(type === 'success' ? 'Restored' : (type === 'danger' ? 'Error' : 'Recovery'), plain, type === 'danger' ? 'error' : (type === 'success' ? 'success' : 'info'));
        }
    }
    async function insertRows(table, rows) {
        if (!rows || !rows.length) return { ok: 0, fail: 0 };
        let ok = 0, fail = 0;
        // Insert in chunks of 50
        for (let i = 0; i < rows.length; i += 50) {
            const chunk = rows.slice(i, i + 50).map(r => {
                const copy = { ...r };
                // keep ids for FK consistency when possible
                return copy;
            });
            const { error } = await supabase.from(table).insert(chunk);
            if (error) {
                // try one by one
                for (const row of chunk) {
                    const r2 = await supabase.from(table).insert(row);
                    if (r2.error) fail++;
                    else ok++;
                }
            } else ok += chunk.length;
        }
        return { ok, fail };
    }
    function filterByYear(payload, year) {
        const y = String(year);
        const out = {};
        const dateFields = ['date', 'created_at', 'transaction_date'];
        for (const [table, rows] of Object.entries(payload || {})) {
            if (!Array.isArray(rows)) { out[table] = []; continue; }
            out[table] = rows.filter(r => {
                for (const f of dateFields) {
                    if (r[f] && String(r[f]).startsWith(y)) return true;
                }
                if (r.financial_year && String(r.financial_year).includes(y)) return true;
                return false;
            });
        }
        return out;
    }
    async function restorePayload(payload, yearLabel) {
        const order = ['grand_budgets', 'budgets', 'income', 'expenses', 'approvals', 'receipts', 'budget_ledger', 'memos', 'notifications', 'audit_logs'];
        let summary = [];
        let any = false;
        for (const table of order) {
            const rows = payload[table] || [];
            if (!rows.length) {
                summary.push(table + ': none');
                continue;
            }
            any = true;
            const res = await insertRows(table, rows);
            summary.push(table + ': restored ' + res.ok + (res.fail ? ' (failed ' + res.fail + ')' : ''));
        }
        if (!any) {
            msg('No data found for ' + (yearLabel || 'this backup') + '. Nothing to restore.', 'warning');
            return false;
        }
        try {
            await supabase.from('backup_access_logs').insert({
                action: 'restore',
                performed_by: AUTH.getCurrentProfile?.()?.id,
                performed_by_name: AUTH.getCurrentProfile?.()?.full_name || AUTH.getCurrentProfile?.()?.email,
                details: 'Restore ' + (yearLabel || 'file') + ' — ' + summary.join('; ')
            });
        } catch (e) {}
        if (typeof logAudit === 'function') {
            try { await logAudit('BACKUP_RESTORE', 'data_backups', null, null, { year: yearLabel, summary }); } catch (e) {}
        }
        msg('Recovery complete for ' + (yearLabel || 'uploaded file') + ':<br>' + summary.join('<br>'), 'success');
        return true;
    }
    function run() {
        const yearBtn = document.getElementById('restore-from-year-btn');
        const fileBtn = document.getElementById('restore-from-file-btn');
        const listBtn = document.getElementById('list-backups-btn');
        if (yearBtn && !yearBtn._bound) {
            yearBtn._bound = true;
            yearBtn.addEventListener('click', async () => {
                if (!isSA()) { msg('Only Super Admin can restore.', 'danger'); return; }
                const year = document.getElementById('restore-year')?.value;
                if (!year || year.length !== 4) {
                    msg('Enter a valid 4-digit year (e.g. 2025).', 'warning');
                    return;
                }
                if (!confirm('Restore data for year ' + year + '? Existing matching rows may be duplicated if already present.')) return;
                msg('Looking up backups for ' + year + '…', 'info');
                // 1) Try DB backups
                let payload = null;
                try {
                    const { data: baks } = await supabase.from('data_backups').select('*').order('created_at', { ascending: false }).limit(20);
                    for (const b of (baks || [])) {
                        const filtered = filterByYear(b.payload || {}, year);
                        const total = Object.values(filtered).reduce((s, a) => s + (a?.length || 0), 0);
                        if (total > 0) { payload = filtered; break; }
                    }
                } catch (e) {
                    console.warn(e);
                }
                // 2) localStorage last backup
                if (!payload) {
                    try {
                        const last = localStorage.getItem('sbt_last_purge_backup_full');
                        if (last) {
                            const parsed = JSON.parse(last);
                            payload = filterByYear(parsed.data || parsed.payload || parsed, year);
                        }
                    } catch (e) {}
                }
                const total = payload ? Object.values(payload).reduce((s, a) => s + (a?.length || 0), 0) : 0;
                if (!total) {
                    msg('No backup data found for year ' + year + '. Upload a backup JSON file if you have one.', 'warning');
                    return;
                }
                await restorePayload(payload, year);
            });
        }
        if (fileBtn && !fileBtn._bound) {
            fileBtn._bound = true;
            fileBtn.addEventListener('click', async () => {
                if (!isSA()) { msg('Only Super Admin can restore.', 'danger'); return; }
                const file = document.getElementById('restore-file')?.files?.[0];
                if (!file) { msg('Choose a backup .json file first.', 'warning'); return; }
                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    let payload = parsed.data || parsed.payload || parsed;
                    const year = document.getElementById('restore-year')?.value;
                    if (year && year.length === 4) {
                        payload = filterByYear(payload, year);
                        const total = Object.values(payload).reduce((s, a) => s + (a?.length || 0), 0);
                        if (!total) {
                            msg('No data for year ' + year + ' in this file.', 'warning');
                            return;
                        }
                    }
                    if (!confirm('Restore data from this backup file?')) return;
                    msg('Restoring from file…', 'info');
                    // Keep full copy for future year filters
                    try { localStorage.setItem('sbt_last_purge_backup_full', text); } catch (e) {}
                    await restorePayload(payload, year || file.name);
                } catch (e) {
                    msg('Invalid backup file: ' + (e.message || e), 'danger');
                }
            });
        }
        if (listBtn && !listBtn._bound) {
            listBtn._bound = true;
            listBtn.addEventListener('click', async () => {
                const host = document.getElementById('backup-list');
                if (!host) return;
                host.innerHTML = 'Loading…';
                try {
                    const { data, error } = await supabase.from('data_backups').select('id, label, backup_type, created_at, file_size_estimate, status, row_counts').order('created_at', { ascending: false }).limit(15);
                    if (error) throw error;
                    if (!data || !data.length) {
                        host.innerHTML = '<span class="text-muted">No database backups found. Use a downloaded JSON file, or run MIGRATION_ADVANCED_FEATURES.sql.</span>';
                        return;
                    }
                    host.innerHTML = '<ul class="list-group">' + data.map(b =>
                        '<li class="list-group-item d-flex justify-content-between align-items-center">' +
                        '<span><strong>' + (b.label || b.id) + '</strong><br><small class="text-muted">' + (b.created_at || '') + ' · ' + (b.backup_type || '') + ' · ' + (b.file_size_estimate || 0) + ' bytes</small></span>' +
                        '<button type="button" class="btn btn-sm btn-outline-success restore-bak-btn" data-id="' + b.id + '">Restore</button></li>'
                    ).join('') + '</ul>';
                    host.querySelectorAll('.restore-bak-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!isSA()) return;
                            if (!confirm('Restore this full backup?')) return;
                            const id = btn.getAttribute('data-id');
                            const { data: one, error } = await supabase.from('data_backups').select('*').eq('id', id).maybeSingle();
                            if (error || !one) { msg('Backup not found.', 'danger'); return; }
                            const year = document.getElementById('restore-year')?.value;
                            let payload = one.payload || {};
                            if (year && year.length === 4) {
                                payload = filterByYear(payload, year);
                                const total = Object.values(payload).reduce((s, a) => s + (a?.length || 0), 0);
                                if (!total) { msg('No data for year ' + year + ' in this backup.', 'warning'); return; }
                            }
                            await restorePayload(payload, year || one.label);
                        });
                    });
                } catch (e) {
                    host.innerHTML = '<span class="text-muted">Could not list backups (' + (e.message || e) + '). Upload a JSON file instead.</span>';
                }
            });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();


// Admin activity feed for Super Admin
async function loadAdminActivity() {
    const body = document.getElementById('admin-activity-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="5" class="text-muted">Loading…</td></tr>';
    try {
        let rows = [];
        // Real schema uses "timestamp" (not created_at) — try several order columns
        let res = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(150);
        if (res.error) {
            res = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(150);
        }
        if (res.error) {
            res = await supabase.from('audit_logs').select('*').limit(150);
        }
        if (res.error) throw res.error;
        rows = res.data || [];
        // Sort client-side by best available time field
        rows.sort((a, b) => {
            const ta = new Date(a.timestamp || a.created_at || a.logged_at || 0).getTime();
            const tb = new Date(b.timestamp || b.created_at || b.logged_at || 0).getTime();
            return tb - ta;
        });
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="5" class="text-muted">No activity recorded yet.</td></tr>';
            return;
        }
        const esc = (s) => {
            const d = document.createElement('div');
            d.textContent = s == null ? '' : String(s);
            return d.innerHTML;
        };
        body.innerHTML = rows.map(r => {
            let details = '';
            try {
                const raw = r.details || r.metadata || r.new_value || r.result || '';
                details = typeof raw === 'string' ? raw : JSON.stringify(raw);
            } catch (e) { details = ''; }
            if (details && details.length > 120) details = details.slice(0, 120) + '…';
            const whenRaw = r.timestamp || r.created_at || r.logged_at || '';
            const when = whenRaw ? new Date(whenRaw).toLocaleString() : '';
            const who = r.user_name || r.performed_by_name || r.actor_name || r.user_id || '—';
            const entity = r.entity || r.entity_type || '';
            const eid = r.entity_id ? (' #' + String(r.entity_id).slice(0, 8)) : '';
            return '<tr>' +
                '<td class="text-nowrap small">' + esc(when) + '</td>' +
                '<td class="small text-nowrap">' + esc(who) + '</td>' +
                '<td><span class="badge bg-secondary">' + esc(r.action || '') + '</span></td>' +
                '<td class="small">' + esc(entity + eid) + '</td>' +
                '<td class="small text-muted">' + esc(details) + '</td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        body.innerHTML = '<tr><td colspan="5" class="text-danger">Could not load activity: ' + (e.message || e) + '</td></tr>';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('refresh-admin-activity-btn')?.addEventListener('click', loadAdminActivity);
    setTimeout(loadAdminActivity, 600);
});

