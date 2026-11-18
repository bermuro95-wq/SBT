// ============================================================
// SELAM BERTU TESFA - Expenses Module
// ============================================================

class ExpensesModule {
    constructor() {
        this.data = [];
        this.categories = [];
        this.paymentMethods = [];
        this.financialYears = [];
        this.currentPage = 1;
        this.perPage = 20;
        this.filters = {
            status: 'all',
            year: '',
            search: ''
        };
        this.modalInstance = null;
        this.viewModalInstance = null;
        this.editingId = null;
        this.uploadedReceipt = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Ensure auth/profile loaded before permission checks
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            await this.loadDropdowns();
            await this.loadData();
            
            this.setupUI();
            this.setupEventListeners();
            this.bindCancelButtons();
            this.renderTable();
            this.updateStats();
            this.applyPermissions();
            
        } catch (error) {
            console.error('Expense module init error:', error);
            this.showError('Failed to load expense data.');
        }
    }
    
    async loadDropdowns() {
        const { data: categories, error: catError } = await supabase
            .from('expense_categories').select('*');
        if (!catError) this.categories = categories || [];
        else this.categories = [];

        // Seed default categories if table is empty (so dropdown is not blank)
        if (!this.categories.length) {
            const defaults = ['Office Supplies', 'Travel', 'Utilities', 'Salaries', 'Program Costs', 'Other'];
            for (const name of defaults) {
                try {
                    await supabase.from('expense_categories').insert({ name });
                } catch (e) {}
            }
            const retry = await supabase.from('expense_categories').select('*');
            this.categories = retry.data || [];
        }

        this.categoryMap = {};
        (this.categories || []).forEach(c => {
            if (c && c.id) this.categoryMap[String(c.id)] = c.name || String(c.id);
        });
        
        const { data: methods, error: methodError } = await supabase
            .from('payment_methods').select('*');
        if (!methodError) this.paymentMethods = methods || [];
        else this.paymentMethods = [];

        if (!this.paymentMethods.length) {
            const defaults = ['Cash', 'Bank Transfer', 'Check', 'Mobile Money', 'Card'];
            for (const name of defaults) {
                try {
                    await supabase.from('payment_methods').insert({ name });
                } catch (e) {}
            }
            const retry = await supabase.from('payment_methods').select('*');
            this.paymentMethods = retry.data || [];
        }

        this.paymentMap = {};
        (this.paymentMethods || []).forEach(m => {
            if (m && m.id) this.paymentMap[String(m.id)] = m.name || String(m.id);
        });
        this.profilesMap = {};
        try {
            const pr = await supabase.from('profiles').select('id, auth_id, full_name, email');
            (pr.data || []).forEach(p => {
                const n = p.full_name || p.email || 'User';
                if (p.id) this.profilesMap[p.id] = n;
                if (p.auth_id) this.profilesMap[p.auth_id] = n;
                if (p.email) this.profilesMap[String(p.email).toLowerCase()] = n;
            });
        } catch (e) {}
        
        const { data: years, error: yearError } = await supabase
            .from('financial_years')
            .select('*')
            .order('start_date', { ascending: false });
        if (!yearError) this.financialYears = years || [];
    }
    
    async loadData() {
        let query = supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (this.filters.status !== 'all') {
            query = query.eq('status', this.filters.status);
        }
        // Date calendar filter applied in JS after fetch
        if (this.filters.search) {
            query = query.or(`vendor.ilike.%${this.filters.search}%,description.ilike.%${this.filters.search}%,transaction_id.ilike.%${this.filters.search}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Load expense error:', error);
            this.showError('Failed to load expense records.');
            return;
        }
        
        this.data = data || [];
        const df = document.getElementById('expense-date-from')?.value;
        const dt = document.getElementById('expense-date-to')?.value;
        if (df || dt) {
            this.data = this.data.filter(r => {
                const d = String(r.date || '').slice(0,10);
                if (df && d < df) return false;
                if (dt && d > dt) return false;
                return true;
            });
        }
    }
    
    setupUI() {
        const modalEl = document.getElementById('expense-modal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }
        
        const viewModalEl = document.getElementById('expense-view-modal');
        if (viewModalEl) {
            this.viewModalInstance = new bootstrap.Modal(viewModalEl);
        }
        
        this.populateDropdowns();
    }
    
    populateDropdowns() {
        const categorySelect = document.getElementById('expense-category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>' +
                this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        
        const methodSelect = document.getElementById('expense-payment-method');
        if (methodSelect) {
            methodSelect.innerHTML = '<option value="">Select Payment Method</option>' +
                this.paymentMethods.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }
        
        const yearFilter = document.getElementById('expense-filter-year');
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="">All Years</option>' +
                this.financialYears.map(y => `<option value="${y.id}">${y.name}</option>`).join('');
        }
    }
    
    setupEventListeners() {
        const createBtn = document.getElementById('create-expense-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
        
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
        
        const statusFilter = document.getElementById('expense-filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.currentPage = 1;
                this.refresh();
            });
        }
        
        const yearFilter = document.getElementById('expense-filter-year');
        if (yearFilter) {
            yearFilter.addEventListener('change', (e) => {
                this.filters.year = e.target.value;
                this.currentPage = 1;
                this.refresh();
            });
        }
        
        const searchInput = document.getElementById('expense-search');
        const searchBtn = document.getElementById('search-btn');
        if (searchInput && searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filters.search = searchInput.value.trim();
                this.currentPage = 1;
                this.refresh();
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filters.search = searchInput.value.trim();
                    this.currentPage = 1;
                    this.refresh();
                }
            });
        }
        
        const exportBtn = document.getElementById('export-expense-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        
        const draftBtn = document.getElementById('expense-submit-draft');
        const approvalBtn = document.getElementById('expense-submit-approval');
        
        if (draftBtn) draftBtn.onclick = () => this.saveExpense('draft');
            document.getElementById('expense-category')?.addEventListener('change', () => this.refreshBudgetHint());
            document.getElementById('expense-amount')?.addEventListener('input', () => this.refreshBudgetHint());
            document.getElementById('expense-financial-year')?.addEventListener('change', () => this.refreshBudgetHint());
        if (approvalBtn) approvalBtn.onclick = () => this.saveExpense('submitted');
        document.addEventListener('click', (e) => {
            const t = e.target.closest('#expense-submit-draft, #expense-submit-approval');
            if (!t) return;
            e.preventDefault();
            if (t.id === 'expense-submit-draft') this.saveExpense('draft');
            if (t.id === 'expense-submit-approval') this.saveExpense('submitted');
        });
        
        const fileInput = document.getElementById('expense-receipt');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
    }
    
    applyPermissions() {
        const canCreate = canCreateExpense();
        const canEdit = canEditExpense();
        const canDelete = canDeleteExpense();
        
        const createBtn = document.getElementById('create-expense-btn');
        if (createBtn) {
            // Always show for admin/accountant; only hide pure viewers
            const role = AUTH?.getCurrentProfile?.()?.role || AUTH?.getCurrentUser?.()?.role;
            if (!canCreate && role === 'viewer') {
                createBtn.style.display = 'none';
            } else {
                createBtn.style.display = '';
            }
        }
        
        document.querySelectorAll('.expense-actions').forEach(el => {
            if (!canEdit) {
                el.querySelectorAll('.edit-btn').forEach(b => b.style.display = 'none');
            }
            if (!canDelete) {
                el.querySelectorAll('.delete-btn').forEach(b => b.style.display = 'none');
            }
        });
    }
    
    async refresh() {
        await this.loadData();
        this.renderTable();
        this.updateStats();
    }
    
    resolveProfileName(id) {
        if (!id) return '';
        if (this.profilesMap) {
            if (this.profilesMap[id]) return this.profilesMap[id];
            const s = String(id);
            if (this.profilesMap[s]) return this.profilesMap[s];
        }
        try {
            const p = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
            if (p && (String(p.id) === String(id) || String(p.auth_id) === String(id))) {
                return p.full_name || p.email || 'User';
            }
        } catch (err) {}
        return '';
    }
    resolveName(id) {
        return this.resolveProfileName(id) || 'N/A';
    }
    resolveCategoryName(id) {
        if (id == null || id === '') return 'N/A';
        const sid = String(id);
        if (this.categoryMap && this.categoryMap[sid]) return this.categoryMap[sid];
        const c = (this.categories || []).find(x => String(x.id) === sid);
        if (c && c.name) return c.name;
        return 'N/A';
    }
    resolvePaymentName(id) {
        if (id == null || id === '') return 'N/A';
        const sid = String(id);
        if (this.paymentMap && this.paymentMap[sid]) return this.paymentMap[sid];
        const p = (this.paymentMethods || []).find(x => String(x.id) === sid);
        if (p && p.name) return p.name;
        return 'N/A';
    }
    renderTable() {
        const tbody = document.getElementById('expense-table-body');
        if (!tbody) return;
        
        const start = (this.currentPage - 1) * this.perPage;
        const end = start + this.perPage;
        const pageData = this.data.slice(start, end);
        const total = this.data.length;
        const totalPages = Math.ceil(total / this.perPage) || 1;
        if (typeof this.renderPagination === 'function') this.renderPagination(totalPages);
        
        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4" data-i18n="no_records">No records found.</td>
                </tr>
            `;
            this.updatePagination(1, 0, 0);
            return;
        }
        
        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td>
                    <span class="badge bg-secondary">${item.transaction_id || 'N/A'}</span>
                </td>
                <td>${formatDate(item.date)}</td>
                <td>${this.escapeHtml(item.vendor || 'N/A')}</td>
                <td>${this.resolveCategoryName(item.category_id)}</td>
                <td class="text-danger fw-bold">${formatCurrency(item.amount)}</td>
                <td>${this.resolvePaymentName(item.payment_method_id)}</td>
                <td>
                    <span class="badge-status ${item.status}">${item.status}</span>
                </td>
                <td class="expense-actions">
                    <button class="btn btn-sm btn-outline-primary view-btn" data-id="${item.id}">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${canEditExpense() && item.status !== 'approved' ? `
                        <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${item.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    ` : ''}
                    ${canDeleteExpense() && item.status !== 'approved' ? `
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${item.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary duplicate-btn" data-id="${item.id}" title="Duplicate">
                            <i class="bi bi-copy"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
        
        
        // Event delegation so icons always work
        tbody.onclick = (ev) => {
            const btn = ev.target.closest('button');
            if (!btn || !tbody.contains(btn)) return;
            const id = btn.getAttribute('data-id');
            if (!id) return;
            ev.preventDefault();
            ev.stopPropagation();
            if (btn.classList.contains('view-btn')) this.viewExpense(id);
            else if (btn.classList.contains('edit-btn')) this.openEditModal(id);
            else if (btn.classList.contains('delete-btn')) this.deleteExpense && this.deleteExpense(id);
            else if (btn.classList.contains('duplicate-btn')) this.duplicateExpense && this.duplicateExpense(id);
        };

        
        this.updatePagination(this.currentPage, totalPages, total);
    }
    
    updatePagination(currentPage, totalPages, total) {
        const pagination = document.getElementById('expense-pagination');
        const info = document.getElementById('expense-pagination-info');
        
        if (info) {
            const start = (currentPage - 1) * this.perPage + 1;
            const end = Math.min(currentPage * this.perPage, total);
            info.textContent = total > 0 ? `Showing ${start}-${end} of ${total} records` : 'No records';
        }
        
        if (!pagination) return;
        
        if (totalPages <= 1) {
            pagination.innerHTML = `
                <li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>
                <li class="page-item active"><a class="page-link" href="#">1</a></li>
                <li class="page-item disabled"><a class="page-link" href="#">Next</a></li>
            `;
            return;
        }
        
        let html = '';
        html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
                </li>`;
        
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>`;
        }
        
        html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
                </li>`;
        
        pagination.innerHTML = html;
        
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderTable();
                }
            });
        });
    }
    
    updateStats() {
        const statusOf = (item) => String(item.status || item.approval_status || '').toLowerCase();
        // Total Expenses = approved only
        const total = this.data.filter(item => statusOf(item) === 'approved').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const approved = this.data.filter(item => statusOf(item) === 'approved').length;
        const pending = this.data.filter(item => ['pending', 'submitted', 'draft'].includes(statusOf(item))).length;
        const rejected = this.data.filter(item => ['rejected', 'denied', 'declined'].includes(statusOf(item))).length;
        const count = this.data.length;
        
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('expense-total', formatCurrency(total));
        set('expense-approved', approved);
        set('expense-pending', pending);
        set('expense-rejected', rejected);
        set('expense-count', count);
        // Available funds = Grand Budget income − expenses (from approved income)
        this.refreshIncomeAvailabilityBanner(total);
    }

    async refreshIncomeAvailabilityBanner(approvedExpenseTotal) {
        try {
            // ALWAYS compute from real approved income rows (never trust a stale 0 in grand_budgets)
            const ir = await supabase.from('income').select('amount, approval_status, is_deleted');
            if (ir.error) console.warn('income load for banner', ir.error);
            const incomeTotal = (ir.data || []).filter(r => {
                if (r.is_deleted) return false;
                return String(r.approval_status || '').toLowerCase() === 'approved';
            }).reduce((s, r) => s + Number(r.amount || 0), 0);

            let expenseTotal = Number(approvedExpenseTotal) || 0;
            if (!expenseTotal) {
                const er = await supabase.from('expenses').select('amount, status, is_deleted');
                expenseTotal = (er.data || []).filter(r => {
                    if (r.is_deleted) return false;
                    return String(r.status || '').toLowerCase() === 'approved';
                }).reduce((s, r) => s + Number(r.amount || 0), 0);
            }

            // Keep grand_budgets in sync (best effort)
            try {
                if (typeof reconcileGrandBudgetFromApproved === 'function') {
                    await reconcileGrandBudgetFromApproved(null);
                } else {
                    const gb = await supabase.from('grand_budgets').select('id').limit(1).maybeSingle();
                    if (gb.data?.id) {
                        await supabase.from('grand_budgets').update({
                            total_income: incomeTotal,
                            total_expenses: expenseTotal,
                            updated_at: new Date().toISOString()
                        }).eq('id', gb.data.id);
                    } else {
                        await supabase.from('grand_budgets').insert({
                            total_income: incomeTotal,
                            total_expenses: expenseTotal,
                            opening_balance: 0,
                            annual_limit: 0,
                            total_allocated: 0,
                            total_released: 0
                        });
                    }
                }
            } catch (syncErr) {
                console.warn('grand budget sync from expenses page', syncErr);
            }

            // Also load org pool (annual_limit + opening) so expenses work when org budget is set
            let orgLimit = 0, orgOpening = 0;
            try {
                const gb = await supabase.from('grand_budgets').select('annual_limit, opening_balance, total_income, total_expenses').limit(1).maybeSingle();
                if (gb.data) {
                    orgLimit = Number(gb.data.annual_limit || 0);
                    orgOpening = Number(gb.data.opening_balance || 0);
                    // Prefer live income sum; if 0 but DB has total_income, use it
                    if (incomeTotal <= 0 && Number(gb.data.total_income || 0) > 0) {
                        incomeTotal = Number(gb.data.total_income || 0);
                    }
                }
            } catch (e) {}

            const pool = orgLimit + orgOpening + incomeTotal;
            const available = Math.max(0, pool - expenseTotal);
            this._availableFromIncome = available;
            this._incomeTotalForExpenses = incomeTotal;
            this._orgPoolAvailable = available;
            this._fundingPool = pool;

            let banner = document.getElementById('expense-income-banner');
            const host = document.querySelector('.page-content');
            if (!host) return;
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'expense-income-banner';
                banner.className = 'alert mb-3';
                const first = host.querySelector('.card, .row');
                if (first) host.insertBefore(banner, first);
                else host.prepend(banner);
            }
            const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n || 0).toFixed(2);
            if (pool <= 0) {
                banner.className = 'alert alert-info mb-3';
                banner.innerHTML = 'No funds in Organization Budget yet. Super Admin should set Organization Budget and/or approve income.';
            } else {
                banner.className = 'alert alert-success mb-3';
                banner.innerHTML = 'Funding pool: <strong>' + fmt(pool) + '</strong> (Org ' + fmt(orgLimit + orgOpening) + ' + Income ' + fmt(incomeTotal) + ') · Spent: <strong>' + fmt(expenseTotal) + '</strong> · Available: <strong>' + fmt(available) + '</strong>';
            }
        } catch (e) {
            console.warn('income availability', e);
        }
    }
    
    openCreateModal() {
        this.editingId = null;
        this.uploadedReceipt = null;
        document.getElementById('expense-modal-title').textContent = 'Create Expense';
        document.getElementById('expense-form').reset();
        document.getElementById('expense-id').value = '';
        document.getElementById('expense-transaction-id').value = '';
        document.getElementById('expense-receipt-preview').innerHTML = '';
        
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        
        const currentYear = this.financialYears.find(y => y.status === 'open');
        if (currentYear) {
            document.getElementById('expense-financial-year').value = currentYear.id;
        }
        
        this.modalInstance.show();
    }
    
    async openEditModal(id) {
        let item = this.data.find(d => String(d.id) === String(id));
        if (!item) {
            try {
                const { data } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle();
                item = data;
            } catch (e) {}
        }
        if (!item) {
            this.showError('Record not found.');
            return;
        }
        // Ensure dropdowns loaded so category/payment can be selected
        if (!this.categories?.length || !this.paymentMethods?.length) {
            try { await this.loadDropdowns(); this.populateDropdowns(); } catch (e) {}
        } else {
            this.populateDropdowns();
        }
        
        this.editingId = id;
        const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
        const title = document.getElementById('expense-modal-title');
        if (title) title.textContent = 'Edit Expense';
        set('expense-id', item.id);
        set('expense-transaction-id', item.transaction_id || '');
        set('expense-date', String(item.date || '').slice(0, 10));
        set('expense-amount', item.amount);
        set('expense-vendor', item.vendor || '');
        set('expense-category', item.category_id || '');
        set('expense-payment-method', item.payment_method_id || '');
        set('expense-reference', item.reference_number || '');
        set('expense-description', item.description || '');
        set('expense-notes', item.notes || '');
        set('expense-financial-year', item.financial_year_id || '');
        
        if (item.receipt_url) {
            document.getElementById('expense-receipt-preview').innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-file-earmark-pdf text-danger"></i>
                    <span>Current receipt attached</span>
                    <button type="button" class="btn btn-sm btn-link text-danger remove-receipt-btn">Remove</button>
                </div>
            `;
            document.querySelector('.remove-receipt-btn')?.addEventListener('click', () => {
                document.getElementById('expense-receipt-preview').innerHTML = '';
                document.getElementById('expense-receipt').value = '';
                this.uploadedReceipt = null;
            });
        }
        
        const modalEl = document.getElementById('expense-modal');
        if (!this.modalInstance && modalEl && window.bootstrap) {
            this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        }
        if (this.modalInstance) this.modalInstance.show();
        else if (modalEl) modalEl.classList.add('show'), modalEl.style.display = 'block';
    }
    

    async assertBudgetAllowsExpense(categoryId, financialYearId, amount, excludeId) {
        const amt = Number(amount) || 0;
        const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n).toFixed(2);
        const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

        if (!categoryId) {
            return { ok: false, message: 'Select a category. Each expense must use a category that has its own budget allocation.' };
        }

        let budgets = [];
        try {
            const br = await supabase.from('budgets').select('*');
            budgets = br.data || [];
            if (br.error) console.warn('budgets', br.error);
        } catch (e) {
            return { ok: false, message: 'Cannot read budgets. Ask Admin to enable budget access.' };
        }

        // Budgets for selected financial year (or all if year has none)
        let pool = budgets;
        if (financialYearId) {
            const yb = budgets.filter(b => String(b.financial_year_id || '') === String(financialYearId));
            if (yb.length) pool = yb;
        }

        const idToName = {};
        (this.categories || []).forEach(c => { if (c.id) idToName[String(c.id)] = norm(c.name); });
        try {
            for (const table of ['expense_categories', 'budget_categories']) {
                const { data } = await supabase.from(table).select('id, name');
                (data || []).forEach(c => { if (c.id) idToName[String(c.id)] = norm(c.name); });
            }
        } catch (e) {}

        let catName = '';
        const catObj = (this.categories || []).find(c => String(c.id) === String(categoryId));
        if (catObj) catName = norm(catObj.name);
        if (!catName) catName = norm(this.categoryMap && this.categoryMap[String(categoryId)]);
        const displayName = (catObj && catObj.name) || catName || 'this category';

        const budgetName = (b) => {
            if (b.category_name) return norm(b.category_name);
            if (b.category_id && idToName[String(b.category_id)]) return idToName[String(b.category_id)];
            return '';
        };
        const allocOf = (b) => Number(b.budget_amount ?? b.allocated_amount ?? b.amount ?? 0);

        // STRICT: only the budget for THIS category
        let budget = pool.find(b => String(b.category_id) === String(categoryId));
        if (!budget && catName) {
            budget = pool.find(b => budgetName(b) === catName);
        }
        if (!budget) {
            budget = budgets.find(b => String(b.category_id) === String(categoryId));
        }
        if (!budget && catName) {
            budget = budgets.find(b => budgetName(b) === catName);
        }

        if (!budget || allocOf(budget) <= 0) {
            const available = [...new Set(pool.map(b => {
                const n = budgetName(b) || idToName[String(b.category_id)] || '';
                const a = allocOf(b);
                return n && a > 0 ? (n + ' (' + fmt(a) + ')') : '';
            }).filter(Boolean))];
            return {
                ok: false,
                message: 'No budget allocated for category "' + displayName + '". ' +
                    (available.length
                        ? ('Budgets exist only for: ' + available.join(', ') + '. Admin must allocate a budget for "' + displayName + '" specifically.')
                        : 'Administrator must allocate a budget for this category first.')
            };
        }

        const allocated = allocOf(budget);

        // Spent only for THIS category (pending + approved, not rejected)
        let rows = [];
        try {
            const er = await supabase.from('expenses').select('id, amount, status, approval_status, category_id, financial_year_id, is_deleted, category_name');
            rows = (er.data || []).filter(r => r.is_deleted !== true);
        } catch (e) {
            rows = (this.data || []).filter(r => r.is_deleted !== true);
        }
        rows = rows.filter(r => {
            const s = String(r.status || r.approval_status || '').toLowerCase();
            return !['rejected', 'denied', 'declined'].includes(s);
        });
        if (excludeId) rows = rows.filter(r => String(r.id) !== String(excludeId));
        if (financialYearId) {
            const tagged = rows.filter(r => r.financial_year_id);
            if (tagged.length) {
                rows = rows.filter(r => !r.financial_year_id || String(r.financial_year_id) === String(financialYearId));
            }
        }
        rows = rows.filter(r => {
            const cid = String(r.category_id || '');
            if (cid === String(categoryId) || cid === String(budget.category_id)) return true;
            const rn = norm(r.category_name) || idToName[cid] || '';
            return catName && rn && rn === catName;
        });

        const spent = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const remaining = allocated - spent;

        if (amt > remaining + 0.009) {
            return {
                ok: false,
                message: 'Insufficient budget for "' + displayName + '". Allocated: ' + fmt(allocated) +
                    ' · Used: ' + fmt(spent) + ' · Remaining: ' + fmt(Math.max(0, remaining)) +
                    ' · Your request: ' + fmt(amt)
            };
        }

        return {
            ok: true,
            allocated,
            spent,
            remaining: Math.max(0, remaining - amt),
            message: 'OK',
            category: displayName
        };
    }

    async refreshBudgetHint() {
        const cat = document.getElementById('expense-category')?.value;
        const fy = document.getElementById('expense-financial-year')?.value;
        const amountRaw = document.getElementById('expense-amount')?.value || '0';
        const amount = parseFloat(String(amountRaw).replace(/,/g, '')) || 0;
        let el = document.getElementById('expense-budget-hint');
        if (!el) {
            const form = document.getElementById('expense-form');
            if (!form) return;
            el = document.createElement('div');
            el.id = 'expense-budget-hint';
            el.className = 'alert alert-info py-2 small mt-2';
            form.insertBefore(el, form.firstChild);
        }
        if (!cat) {
            el.className = 'alert alert-warning py-2 small mt-2';
            el.textContent = 'Select a category with an allocated budget to record an expense.';
            return;
        }
        const check = await this.assertBudgetAllowsExpense(cat, fy || null, amount || 0, this.editingId);
        const fmt = (typeof formatCurrency === 'function') ? formatCurrency : (n) => 'ETB ' + Number(n).toFixed(2);
        if (!check.ok) {
            el.className = 'alert alert-danger py-2 small mt-2';
            el.textContent = check.message || 'Budget not available for this expense.';
        } else {
            el.className = 'alert alert-success py-2 small mt-2';
            el.textContent = 'Budget OK for this category. Allocated ' + fmt(check.allocated) + ' · Used ' + fmt(check.spent) + ' · Remaining after this ≈ ' + fmt(check.remaining);
        }
    }

    async saveExpense(status) {
        if (this._saving) return;
        this._saving = true;
        const form = document.getElementById('expense-form');
        const formData = new FormData(form);
        
        const date = formData.get('date');
        let amountRaw = formData.get('amount');
        if (typeof amountRaw === 'string') amountRaw = amountRaw.replace(/,/g, '').replace(/[^0-9.-]/g, '');
        const amount = Math.round(parseFloat(amountRaw) * 100) / 100;
        const categoryId = formData.get('category_id');
        
        if (!date) {
            this.showToast('Please select a date.', 'error');
            this._saving = false;
            return;
        }
        if (typeof checkPeriodLock === 'function') {
            const lock = await checkPeriodLock(date);
            if (lock.locked) {
                if (typeof showAppMessage === "function") showAppMessage("Closed Period", "This date falls in a closed financial year. You cannot post new entries.", "warning"); else if (typeof this.showToast === "function") this.showToast("Closed financial year — cannot post.", "warning");
                this._saving = false;
                return;
            }
        }
        if (!amount || amount <= 0 || isNaN(amount)) {
            this.showToast('Please enter a valid amount.', 'error');
            this._saving = false;
            return;
        }
        // Mandatory fields + receipt
        const missing = [];
        const dateEl = document.getElementById('expense-date');
        const catEl = document.getElementById('expense-category');
        const dateVal = dateEl?.value || '';
        const catVal = catEl?.value || '';
        if (!dateVal) missing.push('Date');
        if (!amount || amount <= 0) missing.push('Amount');
        const catOptions = document.getElementById('expense-category');
        const hasCatOptions = catOptions && catOptions.options && catOptions.options.length > 1;
        if (hasCatOptions && !catVal) missing.push('Category');
        const receiptInput = document.getElementById('expense-receipt');
        const hasNewReceipt = receiptInput && receiptInput.files && receiptInput.files.length > 0;
        const hasExisting = !!(this.editingId && document.getElementById('expense-receipt-preview')?.innerHTML?.includes('Receipt'));
        if (hasNewReceipt && receiptInput.files[0]) this.uploadedReceipt = receiptInput.files[0];
        if (status !== 'draft' && !(this.uploadedReceipt || hasNewReceipt || hasExisting)) {
            missing.push('Receipt / supporting document');
        }
        if (missing.length) {
            this.showToast('Required fields missing: ' + missing.join(', '), 'error');
            if (typeof showAppMessage === 'function') {
                showAppMessage('Cannot save', 'Complete all required fields: ' + missing.join(', '), 'error');
            }
            this._saving = false;
            return;
        }
        // Super Admin setting: require approved income in Grand Budget before expenses
        try {
            let requireIncome = true;
            try {
                const ss = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
                if (ss.allow_expense_without_income === 'true') requireIncome = false;
                if (ss.require_income_before_expense === 'false') requireIncome = false;
            } catch (e) {}
            if (requireIncome) {
                if (typeof this._orgPoolAvailable !== 'number' && typeof this._incomeTotalForExpenses !== 'number') {
                    await this.refreshIncomeAvailabilityBanner(0);
                }
                const poolAvail = Number(this._orgPoolAvailable || 0);
                const incomeTot = Number(this._incomeTotalForExpenses || 0);
                // Allow if approved income exists OR organization budget pool has funds
                if (poolAvail <= 0 && incomeTot <= 0) {
                    if (typeof showAppMessage === 'function') {
                        showAppMessage(
                            'No budget funds',
                            'Set Organization Budget on the Budget page and/or approve income first, then record expenses.',
                            'info'
                        );
                    }
                    this.showToast('No organization budget or approved income available yet.', 'warning');
                    this._saving = false;
                    return;
                }
            }
        } catch (e) {}
        if (!categoryId) {
            this.showToast('Please select a category.', 'error');
            this._saving = false;
            return;
        }
        
        if (typeof AUTH !== 'undefined' && AUTH.init) {
            try { await AUTH.init(); } catch (e) {}
        }
        let fy = formData.get('financial_year_id') || null;
        if (fy === '') fy = null;
        if (!fy && this.financialYears && this.financialYears.length) {
            const openY = this.financialYears.find(y => y.status === 'open') || this.financialYears[0];
            fy = openY?.id || null;
        }
        let pm = formData.get('payment_method_id') || null;
        if (pm === '') pm = null;
        let cat = categoryId || null;
        if (cat === '') cat = null;

        
        // Duplicate reference + vendor protection
        const refRaw = formData.get('reference_number') || document.getElementById('expense-reference')?.value || '';
        const vendorRaw = formData.get('vendor') || document.getElementById('expense-vendor')?.value || '';
        if (refRaw && String(refRaw).trim()) {
            if (typeof checkDuplicateExpenseReference === 'function') {
                const dup = await checkDuplicateExpenseReference(refRaw, vendorRaw, this.editingId);
                if (dup.duplicate) {
                    this._saving = false;
                    if (typeof showAppMessage === 'function') showAppMessage('Duplicate', dup.message, 'error');
                    else this.showToast(dup.message, 'error');
                    return;
                }
            }
        }

// Budget gate: no allocation or insufficient remaining → block expense
        try {
            const budgetCheck = await this.assertBudgetAllowsExpense(cat, fy, amount, this.editingId);
            if (!budgetCheck.ok) {
                const msg = budgetCheck.message || 'Expense not allowed under current budget.';
                if (typeof showAppMessage === 'function') showAppMessage('Budget required', msg, 'error');
                else this.showToast(msg, 'error');
                this._saving = false;
                return;
            }
        } catch (be) {
            console.warn('Budget check', be);
            const msg = 'Could not verify budget. Expense was not saved.';
            if (typeof showAppMessage === 'function') showAppMessage('Budget check failed', msg, 'error');
            else this.showToast(msg, 'error');
            this._saving = false;
            return;
        }
        
        const year = new Date(date).getFullYear();
        const count = (this.data || []).filter(i => i.transaction_id?.startsWith(`EXP-${year}`)).length + 1;
        const txnId = this.editingId ? null : `EXP-${year}-${String(count).padStart(6, '0')}`;
        
        const data = {
            date: date,
            amount: amount,
            status: (status === 'draft') ? 'pending' : 'submitted'
        };
        const vendor = formData.get('vendor');
        if (vendor) data.vendor = vendor;
        if (cat) data.category_id = cat;
        if (pm) data.payment_method_id = pm;
        if (fy) data.financial_year_id = fy;
        const ref = formData.get('reference_number');
        if (ref) data.reference_number = ref;
        const desc = formData.get('description');
        if (desc) data.description = desc;
        const prof = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
        const profileId = prof?.id || null;
        const profileName = prof?.full_name || prof?.email || 'User';
        if (profileId) {
            data.created_by = profileId;
            data.requested_by = profileId;
        }
        data.created_by_name = profileName;
        data.requested_by_name = profileName;
        if (txnId) data.transaction_id = txnId;
        
        // Resolve human-readable names before save (denormalize for reliable details view)
        if (cat && this.categoryMap && this.categoryMap[String(cat)]) {
            data.category_name = this.categoryMap[String(cat)];
        } else if (cat) {
            const c = (this.categories || []).find(x => String(x.id) === String(cat));
            if (c && c.name) data.category_name = c.name;
        }
        if (pm && this.paymentMap && this.paymentMap[String(pm)]) {
            data.payment_method_name = this.paymentMap[String(pm)];
        } else if (pm) {
            const m = (this.paymentMethods || []).find(x => String(x.id) === String(pm));
            if (m && m.name) data.payment_method_name = m.name;
        }

        this.setLoading(true);
        let result;
        try {
            const pick = (res) => {
                if (!res) return { data: null, error: { message: 'No response' } };
                if (res.error) return { data: null, error: res.error };
                const row = Array.isArray(res.data) ? res.data[0] : res.data;
                return { data: row || null, error: null };
            };
            const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

            // Full payload first (preserves category, payment, user, reference)
            const full = {
                date: data.date,
                amount: Number(amount),
                status: data.status || 'pending'
            };
            if (data.vendor) full.vendor = String(data.vendor).slice(0, 200);
            if (data.transaction_id) full.transaction_id = String(data.transaction_id).slice(0, 50);
            if (data.description) full.description = String(data.description).slice(0, 2000);
            if (data.reference_number) full.reference_number = String(data.reference_number).slice(0, 100);
            if (data.category_id) full.category_id = data.category_id;
            if (data.payment_method_id) full.payment_method_id = data.payment_method_id;
            if (data.financial_year_id) full.financial_year_id = data.financial_year_id;
            if (data.created_by) full.created_by = data.created_by;
            if (data.requested_by) full.requested_by = data.requested_by;
            if (data.created_by_name) full.created_by_name = String(data.created_by_name).slice(0, 200);
            if (data.requested_by_name) full.requested_by_name = String(data.requested_by_name).slice(0, 200);
            if (data.category_name) full.category_name = String(data.category_name).slice(0, 200);
            if (data.payment_method_name) full.payment_method_name = String(data.payment_method_name).slice(0, 200);

            console.log('Expense save payload', full);

            if (this.editingId) {
                result = pick(await supabase.from('expenses').update(full).eq('id', this.editingId).select());
            } else {
                result = pick(await supabase.from('expenses').insert(full).select());
            }

            // Fallback: minimal row then patch extra fields (schema / RLS tolerance)
            if (result.error) {
                console.warn('Expense full save failed, trying minimal+extra', result.error);
                const minimal = { date: data.date, amount: Number(amount), status: 'pending' };
                if (data.vendor) minimal.vendor = String(data.vendor).slice(0, 200);
                if (this.editingId) {
                    result = pick(await supabase.from('expenses').update(minimal).eq('id', this.editingId).select());
                } else {
                    result = pick(await supabase.from('expenses').insert(minimal).select());
                }
            }

            if (result.data && result.data.id) {
                const extra = {};
                if (data.transaction_id) extra.transaction_id = String(data.transaction_id).slice(0, 50);
                if (data.description) extra.description = String(data.description).slice(0, 2000);
                if (data.reference_number) extra.reference_number = String(data.reference_number).slice(0, 100);
                if (data.category_id) extra.category_id = data.category_id;
                if (data.payment_method_id) extra.payment_method_id = data.payment_method_id;
                if (data.financial_year_id) extra.financial_year_id = data.financial_year_id;
                if (data.created_by) extra.created_by = data.created_by;
                if (data.requested_by) extra.requested_by = data.requested_by;
                if (data.created_by_name) extra.created_by_name = String(data.created_by_name).slice(0, 200);
                if (data.requested_by_name) extra.requested_by_name = String(data.requested_by_name).slice(0, 200);
                if (data.category_name) extra.category_name = String(data.category_name).slice(0, 200);
                if (data.payment_method_name) extra.payment_method_name = String(data.payment_method_name).slice(0, 200);
                if (data.status) extra.status = data.status;
                if (Object.keys(extra).length) {
                    const up = await supabase.from('expenses').update(extra).eq('id', result.data.id).select();
                    if (up.error) console.warn('Expense extra fields skipped', up.error);
                    else if (up.data && up.data[0]) result.data = up.data[0];
                }
            }
        } catch (e) {
            result = { data: null, error: e };
        }
        this.setLoading(false);
        
        if (result.error || !result.data) {
            console.error('Expense save error', result.error);
            const msg = (result.error && (result.error.message || result.error.details)) || 'Failed to save expense.';
            this.showToast(msg, 'error');
            if (typeof showAppMessage === 'function') showAppMessage('Save failed', msg, 'error');
            /* toast already shown */
            this._saving = false;
            return;
        }
        
        if (this.uploadedReceipt) {
            const receiptResult = await Storage.uploadReceipt(
                this.uploadedReceipt,
                result.data.id,
                'expense'
            );
            
            if (receiptResult.error) {
                console.error('Receipt upload failed', receiptResult.error);
                if (status !== 'draft') {
                    try { await supabase.from('expenses').delete().eq('id', result.data.id); } catch (e) {}
                    this.showToast('Receipt upload failed. Transaction was not saved.', 'error');
                    this._saving = false;
                    return;
                }
            } else if (!receiptResult.error) {
                let path = receiptResult.path || receiptResult.data?.path || '';
                let publicUrl = path;
                try {
                    const pub = supabase.storage.from('receipts').getPublicUrl(path);
                    publicUrl = pub?.data?.publicUrl || path;
                } catch (e) {}
                await supabase.from('expenses').update({ receipt_url: publicUrl }).eq('id', result.data.id);
                try {
                    const p = AUTH.getCurrentProfile?.();
                    await supabase.from('receipts').insert({
                        file_name: (path || publicUrl).toString().split('/').pop(),
                        file_url: publicUrl,
                        transaction_type: 'expense',
                        transaction_id: result.data.transaction_id || result.data.id,
                        expense_id: result.data.id,
                        uploaded_by: p?.id || null,
                        uploaded_by_name: p?.full_name || p?.email || 'User'
                    });
                } catch (e) {}
            }
        }
        
        if (typeof logAudit === 'function') {
            await logAudit(this.editingId ? 'EXPENSE_UPDATE' : 'EXPENSE_CREATE', 'expense', result.data?.id, null, { amount: result.data?.amount, status: result.data?.status, vendor: result.data?.vendor, category_id: result.data?.category_id, transaction_id: result.data?.transaction_id, date: result.data?.date });
        }
        this.showToast('Expense saved successfully!', 'success');
        try { this.modalInstance?.hide(); } catch (e) {}
        await this.refresh();
        if (typeof showAppMessage === 'function') showAppMessage('Saved', 'Expense saved successfully!', 'success');
        if (typeof showAppMessage === 'function') showAppMessage('Success', 'Expense saved successfully!', 'success');
        if (typeof showAppMessage === "function") showAppMessage("Success", "Expense saved successfully!", "success");
        this._saving = false;
    }
    
    bindCancelButtons() {
        document.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const modalEl = btn.closest('.modal');
                if (!modalEl) return;
                try {
                    const inst = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
                    inst.hide();
                } catch (err) {
                    modalEl.classList.remove('show');
                    modalEl.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                }
            });
        });
    }

    async viewExpense(id) {
        try {
            let item = this.data.find(d => String(d.id) === String(id));
            if (!item) {
                try {
                    const { data } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle();
                    item = data;
                } catch (e) {}
            }
            if (!item) {
                if (typeof showAppMessage === 'function') showAppMessage('Error', 'Record not found.', 'error');
                else if (typeof showAppMessage === "function") showAppMessage("Error", "Record not found.", "error");
                return;
            }

            if (!this.categories || !this.categories.length || !this.paymentMethods || !this.paymentMethods.length) {
                try { await this.loadDropdowns(); } catch (e) {}
            }

            const content = document.getElementById('expense-view-content');
            if (!content) {
                if (typeof showAppMessage === "function") showAppMessage("Error", "View panel missing on page.", "error");
                return;
            }

            // Prefer denormalized names stored on the row, then lookup maps
            let cat = item.category_name || this.resolveCategoryName(item.category_id);
            if (!cat || cat === 'N/A') cat = item.category || 'N/A';
            let pay = item.payment_method_name || this.resolvePaymentName(item.payment_method_id);
            if (!pay || pay === 'N/A') pay = item.payment_method || 'N/A';

            let currentName = '';
            try {
                const p = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
                currentName = (p && (p.full_name || p.email)) || '';
            } catch (e) {}

            const created = item.created_by_name
                || this.resolveProfileName(item.created_by)
                || this.resolveProfileName(item.requested_by)
                || currentName
                || 'N/A';
            const requested = item.requested_by_name
                || item.created_by_name
                || this.resolveProfileName(item.requested_by)
                || this.resolveProfileName(item.created_by)
                || currentName
                || 'N/A';
            const txnId = item.transaction_id
                || (item.reference_number ? String(item.reference_number) : null)
                || (item.id ? String(item.id).slice(0, 8).toUpperCase() : 'N/A');
            const vendor = item.vendor || item.payee || item.supplier || 'N/A';
            const reference = item.reference_number || item.reference || 'N/A';
            const esc = (t) => (typeof this.escapeHtml === 'function') ? this.escapeHtml(String(t ?? '')) : String(t ?? '');
            const amt = (typeof formatCurrency === 'function') ? formatCurrency(item.amount) : item.amount;
            const dt = (typeof formatDate === 'function') ? formatDate(item.date) : item.date;

            let receiptHtml = '';
            if (item.receipt_url) {
                let url = item.receipt_url;
                if (!String(url).startsWith('http') && typeof Storage !== 'undefined' && Storage.getPublicUrl) {
                    try {
                        const r = Storage.getPublicUrl('receipts', url);
                        url = r?.data?.publicUrl || url;
                    } catch (err) {}
                }
                receiptHtml = `<div class="mt-3"><strong>Receipt:</strong><div class="mt-2">
                    <a href="${url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-file-earmark"></i> View Receipt
                    </a></div></div>`;
            }

            content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <dl class="row mb-0">
                        <dt class="col-sm-4">Transaction ID</dt><dd class="col-sm-8">${esc(txnId)}</dd>
                        <dt class="col-sm-4">Date</dt><dd class="col-sm-8">${dt}</dd>
                        <dt class="col-sm-4">Vendor</dt><dd class="col-sm-8">${esc(vendor)}</dd>
                        <dt class="col-sm-4">Category</dt><dd class="col-sm-8">${esc(cat)}</dd>
                        <dt class="col-sm-4">Amount</dt><dd class="col-sm-8 text-danger fw-bold">${amt}</dd>
                    </dl>
                </div>
                <div class="col-md-6">
                    <dl class="row mb-0">
                        <dt class="col-sm-4">Payment Method</dt><dd class="col-sm-8">${esc(pay)}</dd>
                        <dt class="col-sm-4">Reference</dt><dd class="col-sm-8">${esc(reference)}</dd>
                        <dt class="col-sm-4">Status</dt><dd class="col-sm-8"><span class="badge-status ${esc(item.status || '')}">${esc(item.status || 'N/A')}</span></dd>
                        <dt class="col-sm-4">Created By</dt><dd class="col-sm-8">${esc(created)}</dd>
                        <dt class="col-sm-4">Requested By</dt><dd class="col-sm-8">${esc(requested)}</dd>
                    </dl>
                </div>
            </div>
            ${item.description ? `<div class="mt-3"><strong>Description:</strong><p class="mt-1 mb-0">${esc(item.description)}</p></div>` : ''}
            ${item.notes ? `<div class="mt-2"><strong>Notes:</strong><p class="mt-1 mb-0">${esc(item.notes)}</p></div>` : ''}
            ${receiptHtml}`;

            const modalEl = document.getElementById('expense-view-modal');
            if (!modalEl) {
                if (typeof showAppMessage === "function") showAppMessage("Error", "Expense details modal not found.", "error");
                return;
            }
            if (window.bootstrap && bootstrap.Modal) {
                this.viewModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
                this.viewModalInstance.show();
            } else {
                modalEl.classList.add('show');
                modalEl.style.display = 'block';
                modalEl.removeAttribute('aria-hidden');
                document.body.classList.add('modal-open');
                if (!document.querySelector('.modal-backdrop')) {
                    const bd = document.createElement('div');
                    bd.className = 'modal-backdrop fade show';
                    document.body.appendChild(bd);
                }
            }
        } catch (err) {
            console.error('viewExpense error', err);
            if (typeof showAppMessage === "function") showAppMessage("Error", "Could not open expense details: " + (err.message || err), "error");
        }
    }

    async duplicateExpense(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) return;
        this.editingId = null;
        if (typeof this.openCreateModal === 'function') this.openCreateModal();
        else {
            const btn = document.getElementById('add-expense-btn');
            if (btn) btn.click();
        }
        setTimeout(() => {
            const form = document.getElementById('expense-form');
            if (!form) return;
            const set = (sel, val) => {
                const el = form.querySelector(sel);
                if (el && val != null && val !== '') el.value = val;
            };
            set('[name="date"], #expense-date', item.date || new Date().toISOString().slice(0,10));
            set('[name="amount"], #expense-amount', item.amount);
            set('[name="vendor"], #expense-vendor', item.vendor || '');
            set('[name="description"], #expense-description', item.description || '');
            set('[name="category_id"], #expense-category', item.category_id || '');
            set('[name="payment_method_id"], #expense-payment-method', item.payment_method_id || '');
            set('[name="reference_number"], #expense-reference', item.reference_number || '');
            if (typeof showAppMessage === "function") showAppMessage("Ready", "Form filled from existing expense. Review and Save.", "info");
        }, 250);
    }

    async deleteExpense(id) {
        if (!(await confirmPermanentDelete('Permanently delete this expense record?'))) return;
        let error = null;
        try {
            let res = await supabase.from('expenses').delete().eq('id', id);
            error = res.error;
            if (error) {
                res = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
                error = res.error;
            }
        } catch (e) { error = e; }
        if (error) {
            if (typeof showAppMessage === "function") showAppMessage("Delete failed", (error.message || String(error)), "error");
            return;
        }
        if (typeof logAudit === 'function') await logAudit('EXPENSE_DELETE', 'expense', id, null, null);
        if (typeof showAppMessage === "function") showAppMessage("Success", "Expense deleted successfully.", "success");
        this.data = (this.data || []).filter(r => r.id !== id);
        this.renderTable();
        await this.refresh();
    }
    
    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) {
            this.uploadedReceipt = null;
            return;
        }
        
        const validation = Validators.file(file, {
            maxSize: 5 * 1024 * 1024,
            allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        });
        
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            e.target.value = '';
            this.uploadedReceipt = null;
            return;
        }
        
        this.uploadedReceipt = file;
        document.getElementById('expense-receipt-preview').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-check text-success"></i>
                <span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
        `;
    }
    

    renderPagination(totalPages) {
        const ul = document.getElementById('expense-pagination');
        const info = document.getElementById('expense-pagination-info');
        if (info) {
            const start = this.data.length ? (this.currentPage - 1) * this.perPage + 1 : 0;
            const end = Math.min(this.currentPage * this.perPage, this.data.length);
            info.textContent = 'Showing ' + start + '-' + end + ' of ' + this.data.length + ' records';
        }
        if (!ul) return;
        const pages = Math.max(1, totalPages || 1);
        let html = '<li class="page-item ' + (this.currentPage <= 1 ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="prev">Previous</a></li>';
        for (let i = 1; i <= pages; i++) {
            html += '<li class="page-item ' + (i === this.currentPage ? 'active' : '') + '"><a class="page-link" href="#" data-page="' + i + '">' + i + '</a></li>';
        }
        html += '<li class="page-item ' + (this.currentPage >= pages ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="next">Next</a></li>';
        ul.innerHTML = html;
        ul.querySelectorAll('a.page-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const p = a.getAttribute('data-page');
                if (p === 'prev' && this.currentPage > 1) this.currentPage--;
                else if (p === 'next' && this.currentPage < pages) this.currentPage++;
                else if (!isNaN(parseInt(p, 10))) this.currentPage = parseInt(p, 10);
                this.renderTable();
            });
        });
    }

    async exportData() {
        try {
            this.showToast('Preparing export...', 'info');
            
            const { data, error } = await supabase
                .from('expenses')
                .select(`
                    transaction_id,
                    date,
                    vendor,
                    category:category_id(name),
                    amount,
                    payment_method:payment_method_id(name),
                    reference_number,
                    description,
                    status,
                    created_at
                `)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const headers = ['Transaction ID', 'Date', 'Vendor', 'Category', 'Amount (ETB)', 'Payment Method', 'Reference', 'Description', 'Status'];
            const rows = data.map(item => [
                item.transaction_id || '',
                item.date || '',
                `"${item.vendor || ''}"`,
                `"${item.category?.name || ''}"`,
                item.amount || 0,
                `"${item.payment_method?.name || ''}"`,
                `"${item.reference_number || ''}"`,
                `"${(item.description || '').replace(/"/g, '""')}"`,
                item.status || ''
            ]);
            
            const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showToast('Export completed!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export data.', 'error');
        }
    }
    
    setLoading(loading) {
        const btns = ['expense-submit-draft', 'expense-submit-approval'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = loading;
                btn.textContent = loading ? 'Saving...' : (id === 'expense-submit-draft' ? 'Save Draft' : 'Submit for Approval');
            }
        });
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
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================================
// Initialize Expenses Module
// ============================================================

if (document.getElementById('expense-table-body')) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Expenses module ready');
    });
}