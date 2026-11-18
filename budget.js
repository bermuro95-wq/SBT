// ============================================================
// SELAM BERTU TESFA - Budget Module
// ============================================================

class BudgetModule {
    constructor() {
        this.data = [];
        this.financialYears = [];
        this.categories = [];
        this.modalInstance = null;
        this.editingId = null;
        this.selectedYearId = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadDropdowns();
            await this.loadData();
            await this.loadGrandBudget();
            
            this.setupUI();
            this.setupEventListeners();
            this.renderTable();
            this.updateSummary();
            this.applyPermissions();
            
        } catch (error) {
            console.error('Budget init error:', error);
            this.showError('Failed to load budget data.');
        }
    }
    
    async loadDropdowns() {
        // Load financial years
        const { data: years, error: yearError } = await supabase
            .from('financial_years')
            .select('*')
            .order('start_date', { ascending: false });
        
        if (!yearError) {
            this.financialYears = years || [];
        }
        
        // MUST use expense_categories so budget category_id matches expense category_id
        let categories = [];
        try {
            const r2 = await supabase.from('expense_categories').select('*');
            categories = (r2.data || []).filter(c => c.is_active !== false);
        } catch (e) {}
        if (!categories.length) {
            try {
                const r1 = await supabase.from('budget_categories').select('*');
                categories = (r1.data || []).filter(c => c.is_active !== false);
            } catch (e) {}
        }
        this.categories = categories;
        
        // Set default year (current open year)
        const currentYear = this.financialYears.find(y => y.status === 'open');
        if (currentYear) {
            this.selectedYearId = currentYear.id;
        } else if (this.financialYears.length > 0) {
            this.selectedYearId = this.financialYears[0].id;
        }
    }
    
    
    /**
     * Organization Budget model:
     *   Pool = Organization Budget (annual_limit) + Opening + Approved Income
     *   Available to allocate = Pool − Allocated to categories (+ released)
     *   Allocating to a category REDUCES available until it reaches 0.
     *   Approved income ADDS to the pool automatically.
     *   Only Super Admin sets the org budget and allocates to categories.
     */
    getAvailableToAllocate(g) {
        const gb = g || this.grandBudget || {};
        const orgBudget = Number(gb.annual_limit || 0);
        const opening = Number(gb.opening_balance || 0);
        const income = Number(gb.total_income || 0);
        const allocated = Number(gb.total_allocated || 0);
        const released = Number(gb.total_released || 0);
        // Pool = org ceiling + opening + income; available shrinks as categories get allocations
        return Math.max(0, orgBudget + opening + income - allocated + released);
    }

    getTotalPool(g) {
        const gb = g || this.grandBudget || {};
        return Number(gb.annual_limit || 0) + Number(gb.opening_balance || 0) + Number(gb.total_income || 0) + Number(gb.total_released || 0);
    }

    async loadGrandBudget() {
        try {
            let fy = this.selectedYearId;
            let data = null;
            // Prefer row for selected year; otherwise any row (org may have set budget without FY)
            if (fy) {
                const byFy = await supabase.from('grand_budgets').select('*').eq('financial_year_id', fy).maybeSingle();
                data = byFy.data || null;
            }
            if (!data) {
                const all = await supabase.from('grand_budgets').select('*').order('updated_at', { ascending: false }).limit(1);
                data = (all.data && all.data[0]) || null;
            }
            if (!data) {
                const any = await supabase.from('grand_budgets').select('*').limit(1);
                data = (any.data && any.data[0]) || null;
            }
            this.grandBudget = data || {
                annual_limit: 0,
                opening_balance: 0,
                total_income: 0,
                total_allocated: 0,
                total_expenses: 0,
                total_released: 0
            };

            // Reconcile: ALL approved income → adds to organization pool
            try {
                let iq = supabase.from('income').select('amount, approval_status, is_deleted');
                if (fy) iq = iq.eq('financial_year_id', fy);
                const ir = await iq;
                if (ir.error) console.warn('income sum error', ir.error);
                const approvedIncome = (ir.data || []).filter(r => {
                    if (r.is_deleted) return false;
                    return String(r.approval_status || '').toLowerCase() === 'approved';
                }).reduce((s, r) => s + Number(r.amount || 0), 0);

                let eq = supabase.from('expenses').select('amount, status, is_deleted');
                if (fy) eq = eq.eq('financial_year_id', fy);
                const er = await eq;
                if (er.error) console.warn('expense sum error', er.error);
                const approvedExp = (er.data || []).filter(r => {
                    if (r.is_deleted) return false;
                    return String(r.status || '').toLowerCase() === 'approved';
                }).reduce((s, r) => s + Number(r.amount || 0), 0);

                const alloc = (this.data || []).reduce((s, b) => s + Number(b.allocated_amount || b.budget_amount || 0), 0);

                this.grandBudget.total_income = approvedIncome;
                this.grandBudget.total_expenses = approvedExp;
                this.grandBudget.total_allocated = alloc;

                if (this.grandBudget.id) {
                    await supabase.from('grand_budgets').update({
                        total_income: approvedIncome,
                        total_expenses: approvedExp,
                        total_allocated: alloc,
                        updated_at: new Date().toISOString()
                    }).eq('id', this.grandBudget.id);
                } else if (fy) {
                    const ins = await supabase.from('grand_budgets').upsert({
                        financial_year_id: fy,
                        total_income: approvedIncome,
                        total_expenses: approvedExp,
                        total_allocated: alloc,
                        opening_balance: Number(this.grandBudget.opening_balance || 0),
                        annual_limit: Number(this.grandBudget.annual_limit || 0)
                    }, { onConflict: 'financial_year_id' }).select().maybeSingle();
                    if (ins.data) this.grandBudget = { ...this.grandBudget, ...ins.data };
                }
            } catch (reconErr) {
                console.warn('grand budget reconcile', reconErr);
            }

            this.renderGrandBudget();
            this.loadBudgetHistory();
        } catch (e) {
            console.warn('grand budget', e);
            this.grandBudget = null;
        }
    }

    /** Super Admin: set organization budget (e.g. 5,000,000 ETB) and optional opening balance */
    async saveOrganizationBudget() {
        const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof canManageBudget === 'function' && canManageBudget());
        if (!isSA) {
            if (typeof showAppMessage === 'function') {
                showAppMessage('Permission denied', 'Only Super Admin can set the organization budget.', 'error');
            }
            return;
        }
        const limitEl = document.getElementById('org-budget-limit-input');
        const openEl = document.getElementById('org-budget-opening-input');
        const annual_limit = parseFloat(limitEl?.value || '0') || 0;
        const opening_balance = parseFloat(openEl?.value || '0') || 0;
        if (annual_limit < 0 || opening_balance < 0) {
            if (typeof showAppMessage === 'function') showAppMessage('Validation', 'Amounts cannot be negative.', 'warning');
            return;
        }
        const fy = this.selectedYearId || null;
        try {
            let gid = this.grandBudget?.id;
            if (!gid) {
                const ins = await supabase.from('grand_budgets').insert({
                    financial_year_id: fy,
                    annual_limit,
                    opening_balance,
                    total_income: Number(this.grandBudget?.total_income || 0),
                    total_allocated: Number(this.grandBudget?.total_allocated || 0),
                    total_expenses: Number(this.grandBudget?.total_expenses || 0),
                    total_released: 0
                }).select().maybeSingle();
                if (ins.error) throw ins.error;
                this.grandBudget = ins.data || this.grandBudget;
                gid = ins.data?.id;
            } else {
                const upd = await supabase.from('grand_budgets').update({
                    annual_limit,
                    opening_balance,
                    updated_at: new Date().toISOString()
                }).eq('id', gid).select().maybeSingle();
                if (upd.error) throw upd.error;
                if (upd.data) this.grandBudget = { ...this.grandBudget, ...upd.data };
            }
            // History
            try {
                await supabase.from('budget_ledger').insert({
                    financial_year_id: fy,
                    entry_type: 'set_org_budget',
                    amount: annual_limit,
                    note: `Organization budget set to ETB ${annual_limit.toFixed(2)} (opening ${opening_balance.toFixed(2)}) by Super Admin`
                });
            } catch (e) {}
            if (typeof logAudit === 'function') {
                try { await logAudit('SET_ORG_BUDGET', 'grand_budgets', gid, null, { annual_limit, opening_balance }); } catch (e) {}
            }
            if (typeof showAppMessage === 'function') {
                showAppMessage('Organization budget saved', `Pool set to ETB ${annual_limit.toFixed(2)}. Available will increase when income is approved.`, 'success');
            }
            await this.loadGrandBudget();
        } catch (e) {
            console.error(e);
            if (typeof showAppMessage === 'function') showAppMessage('Error', e.message || 'Failed to save organization budget.', 'error');
        }
    }

    /** After category allocation: set grand_budgets.total_allocated = sum of category budgets */
    async syncGrandAllocated(financialYearId, deltaAmount, categoryName) {
        const fy = financialYearId || this.selectedYearId;
        let q = supabase.from('budgets').select('allocated_amount, budget_amount');
        if (fy) q = q.eq('financial_year_id', fy);
        const { data } = await q;
        const total = (data || []).reduce((s, b) => s + Number(b.allocated_amount || b.budget_amount || 0), 0);
        let gq = supabase.from('grand_budgets').select('id');
        if (fy) gq = gq.eq('financial_year_id', fy);
        let { data: grow } = await gq.maybeSingle();
        if (!grow) {
            const ins = await supabase.from('grand_budgets').insert({
                financial_year_id: fy || null,
                total_allocated: total,
                total_income: Number(this.grandBudget?.total_income || 0),
                opening_balance: Number(this.grandBudget?.opening_balance || 0),
                annual_limit: Number(this.grandBudget?.annual_limit || 0),
                total_expenses: Number(this.grandBudget?.total_expenses || 0)
            }).select().maybeSingle();
            grow = ins.data;
        } else {
            await supabase.from('grand_budgets').update({
                total_allocated: total,
                updated_at: new Date().toISOString()
            }).eq('id', grow.id);
        }
        // History: register this allocation
        try {
            await supabase.from('budget_ledger').insert({
                financial_year_id: fy,
                entry_type: 'allocate',
                category_id: null,
                amount: Number(deltaAmount) || total,
                note: categoryName
                    ? `Allocated ETB ${Number(deltaAmount || 0).toFixed(2)} to category "${categoryName}" from organization pool`
                    : `Category allocation synced — total allocated ETB ${total.toFixed(2)}`
            });
        } catch (e) {}
        await this.loadGrandBudget();
    }

    renderGrandBudget() {
        const g = this.grandBudget;
        if (!g) return;
        const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
        const pool = this.getTotalPool(g);
        const available = this.getAvailableToAllocate(g);
        const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof canManageBudget === 'function' && canManageBudget());

        // Update numbers only — panel lives in budget.html (avoids layout jump)
        const map = {
            'grand-annual-limit': g.annual_limit,
            'grand-opening': g.opening_balance,
            'grand-income': g.total_income,
            'grand-allocated': g.total_allocated,
            'grand-expenses': g.total_expenses,
            'grand-available': available,
            'grand-pool': pool
        };
        Object.keys(map).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = fmt(map[id]);
        });

        const limitIn = document.getElementById('org-budget-limit-input');
        const openIn = document.getElementById('org-budget-opening-input');
        if (limitIn && document.activeElement !== limitIn) limitIn.value = Number(g.annual_limit || 0);
        if (openIn && document.activeElement !== openIn) openIn.value = Number(g.opening_balance || 0);

        document.querySelectorAll('.need-budget-manage').forEach(el => {
            if (isSA) {
                el.classList.remove('d-none');
                el.style.display = '';
            } else {
                el.classList.add('d-none');
            }
        });
    }

    async loadBudgetHistory() {
        const host = document.getElementById('budget-history-list');
        if (!host) return;
        try {
            let q = supabase.from('budget_ledger').select('*').order('created_at', { ascending: false }).limit(25);
            if (this.selectedYearId) q = q.eq('financial_year_id', this.selectedYearId);
            let { data, error } = await q;
            if (error || !data) {
                const all = await supabase.from('budget_ledger').select('*').order('created_at', { ascending: false }).limit(25);
                data = all.data || [];
            }
            if (!data.length) {
                host.innerHTML = '<span class="text-muted">No budget history yet. Set organization budget or allocate to a category.</span>';
                return;
            }
            const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
            const typeLabel = (t) => {
                const m = {
                    set_org_budget: 'Set org budget',
                    income_credit: 'Income approved (+)',
                    allocate: 'Allocated to category (−)',
                    expense_debit: 'Expense approved',
                    release: 'Released back to pool'
                };
                return m[t] || t || 'Entry';
            };
            host.innerHTML = `
              <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead><tr><th>When</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
                  <tbody>
                    ${data.map(r => {
                        const when = r.created_at ? new Date(r.created_at).toLocaleString() : '—';
                        return `<tr>
                          <td class="text-nowrap">${when}</td>
                          <td>${typeLabel(r.entry_type)}</td>
                          <td class="text-nowrap">${fmt(r.amount)}</td>
                          <td>${(r.note || '').replace(/</g, '&lt;')}</td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`;
        } catch (e) {
            host.innerHTML = '<span class="text-muted">Could not load history.</span>';
        }
    }

    async loadData() {
        if (!this.selectedYearId) {
            this.data = [];
            return;
        }
        
        // Load budget data (simple select — no joins required)
        let { data: budgetData, error: budgetError } = await supabase
            .from('budgets')
            .select('*')
            .eq('financial_year_id', this.selectedYearId);
        if (budgetError) {
            console.warn(budgetError);
            const all = await supabase.from('budgets').select('*');
            budgetData = all.data || [];
            budgetError = all.error;
        }
        if (budgetError) {
            console.error(budgetError);
            this.data = [];
            return;
        }
        // Attach category names from local list
        this.data = (budgetData || []).map(b => {
            const cat = this.categories.find(c => c.id === b.category_id);
            const amount = Number(b.budget_amount ?? b.allocated_amount ?? 0);
            const spent = Number(b.spent_amount ?? 0);
            return {
                ...b,
                budget_amount: amount,
                allocated_amount: amount,
                spent_amount: spent,
                remaining_amount: amount - spent,
                percentage_used: amount > 0 ? (spent / amount) * 100 : 0,
                category: cat ? { name: cat.name, type: cat.type || 'expense' } : { name: 'N/A', type: 'expense' }
            };
        });
        
        // Calculate actual spending from expenses (all rows if year not tagged)
        let expenses = [];
        try {
            const expR = await supabase.from('expenses').select('*');
            expenses = (expR.data || []).filter(e => e.is_deleted !== true);
            if (this.selectedYearId) {
                const tagged = expenses.filter(e => e.financial_year_id === this.selectedYearId);
                if (tagged.length) expenses = tagged;
            }
        } catch (e) { console.warn(e); }
        
        const spentByCategory = {};
        let totalSpentAll = 0;
        expenses.forEach(exp => {
            const amt = Number(exp.amount || 0);
            totalSpentAll += amt;
            const key = exp.category_id || '__none__';
            spentByCategory[key] = (spentByCategory[key] || 0) + amt;
        });
        
        // Update each budget line by category; if no category matches, leave 0 on lines but summary uses total
        this.data.forEach(budget => {
            const spent = Number(spentByCategory[budget.category_id] || 0);
            const alloc = Number(budget.budget_amount ?? budget.allocated_amount ?? 0);
            budget.spent_amount = spent;
            budget.allocated_amount = alloc;
            budget.budget_amount = alloc;
            budget.remaining_amount = alloc - spent;
            budget.percentage_used = alloc > 0 ? (spent / alloc) * 100 : 0;
        });
        this._totalSpentAll = totalSpentAll;
    }
    
    setupUI() {
        const modalEl = document.getElementById('budget-modal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }
        
        // Date calendars (financial period filter)
        const y = new Date().getFullYear();
        const fromEl = document.getElementById('budget-date-from');
        const toEl = document.getElementById('budget-date-to');
        if (fromEl && !fromEl.value) fromEl.value = `${y}-01-01`;
        if (toEl && !toEl.value) toEl.value = `${y}-12-31`;
        
        // Populate category dropdown
        const categorySelect = document.getElementById('budget-category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>' +
                this.categories.map(c => 
                    `<option value="${c.id}" data-type="${c.type}">${c.name} (${c.type})</option>`
                ).join('');
        }
    }
    
    setupEventListeners() {
        // Date calendar filter
        const fromEl = document.getElementById('budget-date-from');
        const toEl = document.getElementById('budget-date-to');
        const onDate = () => this.refresh();
        if (fromEl) fromEl.addEventListener('change', onDate);
        if (toEl) toEl.addEventListener('change', onDate);
        
        // Allocate to category (Super Admin)
        const addBtn = document.getElementById('add-budget-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openCreateModal());
        }
        
        // Save category allocation
        const saveBtn = document.getElementById('save-budget-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveBudget());
        }

        // Organization budget controls (Super Admin)
        const editOrg = document.getElementById('btn-edit-org-budget');
        const formOrg = document.getElementById('org-budget-edit-form');
        const saveOrg = document.getElementById('btn-save-org-budget');
        const cancelOrg = document.getElementById('btn-cancel-org-budget');
        if (editOrg && formOrg) {
            editOrg.addEventListener('click', () => formOrg.classList.toggle('d-none'));
        }
        if (cancelOrg && formOrg) {
            cancelOrg.addEventListener('click', () => formOrg.classList.add('d-none'));
        }
        if (saveOrg) {
            saveOrg.addEventListener('click', () => this.saveOrganizationBudget());
        }
    }
    
    applyPermissions() {
        const canManage = (typeof canManageBudget === 'function' && canManageBudget())
            || (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
        document.querySelectorAll('.need-budget-manage').forEach(el => {
            if (canManage) {
                el.classList.remove('d-none');
                el.style.display = '';
            } else {
                el.classList.add('d-none');
                el.style.display = 'none';
            }
        });
        // Re-apply after profile may load late
        setTimeout(() => {
            const ok = (typeof canManageBudget === 'function' && canManageBudget())
                || (typeof isSuperAdmin === 'function' && isSuperAdmin());
            document.querySelectorAll('.need-budget-manage').forEach(el => {
                if (ok) { el.classList.remove('d-none'); el.style.display = ''; }
            });
        }, 600);
    }
    
    async refresh() {
        await this.loadData();
        await this.loadGrandBudget();
        this.renderTable();
        this.updateSummary();
    }
    
    renderTable() {
        const tbody = document.getElementById('budget-table-body');
        if (!tbody) return;
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        No budget data found for this financial year.
                        ${canManageBudget() ? 'Click "Add Budget" to create one.' : ''}
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map(item => {
            const usedPercent = item.percentage_used || 0;
            let statusClass = 'success';
            let statusText = 'Good';
            
            if (usedPercent > 90) {
                statusClass = 'danger';
                statusText = 'Critical';
            } else if (usedPercent > 75) {
                statusClass = 'warning';
                statusText = 'Warning';
            }
            
            return `
                <tr>
                    <td>${item.category?.name || 'N/A'}</td>
                    <td>
                        <span class="badge ${item.category?.type === 'income' ? 'bg-success' : 'bg-danger'}">
                            ${item.category?.type || 'N/A'}
                        </span>
                    </td>
                    <td>${formatCurrency(item.allocated_amount)}</td>
                    <td class="text-danger">${formatCurrency(item.spent_amount || 0)}</td>
                    <td class="text-success">${formatCurrency(item.remaining_amount || 0)}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="progress flex-grow-1" style="height: 8px; width: 100px;">
                                <div class="progress-bar bg-${statusClass}" 
                                     style="width: ${Math.min(usedPercent, 100)}%"></div>
                            </div>
                            <span>${usedPercent.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-${statusClass}">${statusText}</span>
                    </td>
                    <td class="need-budget-manage">
                        <button class="btn btn-sm btn-outline-warning edit-budget-btn" data-id="${item.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-budget-btn" data-id="${item.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Attach event listeners
        tbody.querySelectorAll('.edit-budget-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
        });
        
        tbody.querySelectorAll('.delete-budget-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteBudget(btn.dataset.id));
        });
    }
    
    updateSummary() {
        const totalAllocated = this.data.reduce((sum, item) => sum + Number(item.allocated_amount || item.budget_amount || 0), 0);
        let totalSpent = this.data.reduce((sum, item) => sum + Number(item.spent_amount || 0), 0);
        // If line categories don't match expense categories, use all expenses total
        if (totalSpent === 0 && this._totalSpentAll > 0) {
            totalSpent = this._totalSpentAll;
        }
        const totalRemaining = totalAllocated - totalSpent;
        const usedPercent = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
        
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('budget-annual', formatCurrency(totalAllocated));
        set('budget-spent', formatCurrency(totalSpent));
        set('budget-remaining', formatCurrency(totalRemaining));
        set('budget-percentage', usedPercent.toFixed(1) + '%');
    }
    
    openCreateModal() {
        const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof canManageBudget === 'function' && canManageBudget());
        if (!isSA) {
            if (typeof showAppMessage === 'function') {
                showAppMessage('Permission denied', 'Only Super Admin can allocate budget to categories.', 'error');
            }
            return;
        }
        this.editingId = null;
        const titleEl = document.getElementById('budget-modal-title');
        if (titleEl) titleEl.textContent = 'Allocate from Organization Budget';
        document.getElementById('budget-form')?.reset?.();
        const idEl = document.getElementById('budget-id');
        if (idEl) idEl.value = '';
        // Ensure year is set
        if (!this.selectedYearId && this.financialYears.length) {
            this.selectedYearId = this.financialYears.find(y => y.status === 'open')?.id || this.financialYears[0].id;
        }
        const hy = document.getElementById('budget-financial-year');
        if (hy) hy.value = this.selectedYearId || '';
        const amtEl = document.getElementById('budget-amount');
        if (amtEl) amtEl.value = '';
        const notesEl = document.getElementById('budget-notes');
        if (notesEl) notesEl.value = '';
        
        // Re-populate categories (may have loaded late)
        const categorySelect = document.getElementById('budget-category');
        if (categorySelect) {
            categorySelect.disabled = false;
            categorySelect.innerHTML = '<option value="">Select Category</option>' +
                (this.categories || []).map(c =>
                    `<option value="${c.id}">${c.name}</option>`
                ).join('');
            if (!this.categories.length) {
                categorySelect.innerHTML = '<option value="">No categories — run SQL seed</option>';
            }
        }
        if (!this.selectedYearId) {
            if (typeof showAppMessage === "function") showAppMessage("Setup required", "No financial year found. Run FIX_DB_NOW.sql to create one.", "warning");
            return;
        }
        const available = this.getAvailableToAllocate();
        const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
        if (available <= 0) {
            if (typeof showAppMessage === 'function') {
                showAppMessage(
                    'No available budget',
                    'Organization pool available is 0. Set organization budget (e.g. 5,000,000) or wait for approved income.',
                    'warning'
                );
            }
        }
        if (amtEl) amtEl.placeholder = `Max available: ${fmt(available)}`;
        if (!this.modalInstance) {
            const modalEl = document.getElementById('budget-modal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                this.modalInstance = new bootstrap.Modal(modalEl);
            }
        }
        this.modalInstance?.show();
    }
    
    async openEditModal(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) {
            this.showError('Budget record not found.');
            return;
        }
        
        this.editingId = id;
        document.getElementById('budget-modal-title').textContent = 'Edit Budget';
        document.getElementById('budget-id').value = item.id;
        document.getElementById('budget-financial-year').value = item.financial_year_id;
        document.getElementById('budget-category').value = item.category_id;
        document.getElementById('budget-amount').value = item.budget_amount ?? item.allocated_amount ?? '';
        document.getElementById('budget-notes').value = item.notes || '';
        
        // Disable category selection when editing
        document.getElementById('budget-category').disabled = true;
        
        this.modalInstance.show();
    }
    
    async saveBudget() {
        // Only Super Admin allocates from organization pool to categories
        const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof canManageBudget === 'function' && canManageBudget());
        if (!isSA) {
            if (typeof showAppMessage === 'function') {
                showAppMessage('Permission denied', 'Only Super Admin can allocate budget to categories.', 'error');
            }
            return;
        }

        const id = document.getElementById('budget-id').value;
        const financialYearId = document.getElementById('budget-financial-year').value;
        const categoryId = document.getElementById('budget-category').value;
        const amount = parseFloat(document.getElementById('budget-amount').value);
        const notes = document.getElementById('budget-notes').value.trim();
        
        const fy = financialYearId || this.selectedYearId || null;
        if (!fy) {
            if (typeof showAppMessage === "function") showAppMessage("Validation", "Please select a financial year first.", "warning");
            return;
        }
        if (!categoryId) {
            if (typeof showAppMessage === "function") showAppMessage("Validation", "Please select a category.", "warning");
            return;
        }
        if (!amount || amount <= 0) {
            if (typeof showAppMessage === "function") showAppMessage("Validation", "Please enter a valid amount.", "warning");
            return;
        }

        // Ensure grand budget is up to date
        await this.loadGrandBudget();
        const available = this.getAvailableToAllocate();
        // When editing, the previous amount for this line is already inside total_allocated — add it back for the check
        let previousAmount = 0;
        if (id) {
            const existing = (this.data || []).find(d => String(d.id) === String(id));
            previousAmount = Number(existing?.allocated_amount || existing?.budget_amount || 0);
        }
        const effectiveAvailable = available + previousAmount;
        if (amount > effectiveAvailable + 0.001) {
            const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
            if (typeof showAppMessage === 'function') {
                showAppMessage(
                    'Not enough available budget',
                    `You can allocate at most ${fmt(effectiveAvailable)}. Organization pool is reduced by each category allocation until it reaches zero. Increase organization budget or wait for approved income.`,
                    'warning'
                );
            }
            return;
        }
        
        const catRow = (this.categories || []).find(c => String(c.id) === String(categoryId));
        const data = {
            financial_year_id: fy,
            category_id: categoryId,
            budget_amount: amount,
            allocated_amount: amount,
            category_name: catRow ? catRow.name : null,
            notes: notes || null
        };
        
        let result;
        try {
            const pick = (res) => {
                if (!res) return { data: null, error: { message: 'No response' } };
                if (res.error) return { data: null, error: res.error };
                const row = Array.isArray(res.data) ? res.data[0] : res.data;
                return { data: row || null, error: res.error };
            };
            if (id) {
                result = pick(await supabase.from('budgets').update(data).eq('id', id).select());
            } else {
                result = pick(await supabase.from('budgets').insert(data).select());
                if (result.error) {
                    const minimal = {
                        budget_amount: data.budget_amount || data.allocated_amount,
                        allocated_amount: data.allocated_amount || data.budget_amount
                    };
                    if (data.category_id) minimal.category_id = data.category_id;
                    if (data.financial_year_id) minimal.financial_year_id = data.financial_year_id;
                    result = pick(await supabase.from('budgets').insert(minimal).select());
                }
            }
        } catch (e) {
            result = { error: e };
        }
        
        if (result.error) {
            const msg = result.error.message || 'Failed to save budget.';
            if (typeof showAppMessage === 'function') showAppMessage('Error', msg, 'error');
            this.showToast(msg, 'error');
            if (typeof showAppMessage === "function") showAppMessage("Save failed", msg, "error");
            return;
        }
        
        document.getElementById('budget-category').disabled = false;
        try { this.modalInstance?.hide(); } catch (e) {}
        // Sync Grand Budget: reduce available by this allocation
        try {
            const delta = id ? (amount - previousAmount) : amount;
            await this.syncGrandAllocated(fy, Math.abs(delta), catRow ? catRow.name : null);
        } catch (e) { console.warn('sync grand allocated', e); }
        const left = this.getAvailableToAllocate();
        const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
        if (typeof showAppMessage === 'function') {
            showAppMessage(
                'Allocated from organization pool',
                `ETB ${Number(amount).toFixed(2)} assigned to ${catRow ? catRow.name : 'category'}. Remaining available: ${fmt(left)}.`,
                'success'
            );
        }
        if (typeof logAudit === 'function') {
            try {
                await logAudit(
                    this.editingId ? 'BUDGET_UPDATE' : 'BUDGET_CREATE',
                    'budget',
                    (result && result.data && (result.data.id || result.data[0]?.id)) || this.editingId,
                    null,
                    { amount: data.budget_amount, category_id: data.category_id, available_left: left }
                );
            } catch (e) {}
        }
        this.showToast('Budget allocated from organization pool.', 'success');
        await this.refresh();
    }
    
    async deleteBudget(id) {
        if (!(await confirmPermanentDelete('Permanently delete this budget line?'))) return;
        const idStr = String(id);
        let error = null;
        // Hard delete — try id match (uuid or text)
        let res = await supabase.from('budgets').delete().eq('id', id);
        if (res.error) {
            res = await supabase.from('budgets').delete().eq('id', idStr);
        }
        if (res.error) {
            // last resort: delete matching row fetched first
            const got = await supabase.from('budgets').select('id').eq('id', id).maybeSingle();
            if (got.data?.id) {
                res = await supabase.from('budgets').delete().eq('id', got.data.id);
            }
        }
        error = res.error;
        if (error) {
            this.showToast(error.message || 'Failed to delete budget.', 'error');
            return;
        }
        // Remove from local list immediately so UI updates for everyone on refresh
        this.data = (this.data || []).filter(b => String(b.id) !== idStr);
        this.renderTable();
        this.updateSummary();
        if (typeof logAudit === 'function') {
            try { await logAudit('BUDGET_DELETE', 'budget', idStr, null, null); } catch (e) {}
        }
        this.showToast('Budget deleted successfully.', 'success');
        await this.refresh();
    }
    
    showToast(message, type = 'info') {
        const title = type === 'success' ? 'Success' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Notice'));
        // Single notification only
        if (typeof showAppMessage === 'function') {
            showAppMessage(title, message, type);
            return;
        }
        if (typeof window.showToast === 'function' && window.showToast !== this.showToast) {
            try { window.showToast(message, type); } catch (e) {}
            return;
        }
        // Always visible for success/error
        if (type === 'success' || type === 'error') {
            // toast already shown; alert only if no showAppMessage
            if (typeof showAppMessage !== "function") { console.error(message); }
        }
    }
    
    showError(message) {
        if (window.app) {
            app.showError(message);
        } else {
            if (typeof showAppMessage === "function") showAppMessage("Error", message, "error"); else console.error(message);
        }
    }
}

// ============================================================
// Initialize Budget Module
// ============================================================

if (document.getElementById('budget-table-body')) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Budget module ready');
    });
}