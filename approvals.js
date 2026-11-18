// ============================================================
// SELAM BERTU TESFA - Approvals Module
// ============================================================

class ApprovalsModule {
    constructor() {
        this.data = [];
        this.modalInstance = null;
        this.currentApproval = null;
        this.filter = 'all';
        
        this.init();
    }
    
    async init() {
        try {
            // Wait for AUTH to finish loading profile
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            
            // Super Admin / Administrator / users with approve permission can access
            const allowed = (typeof canApproveTransactions === 'function' && canApproveTransactions())
                || (typeof isSuperAdmin === 'function' && isSuperAdmin())
                || (typeof isAdminOrAbove === 'function' && isAdminOrAbove())
                || (typeof AUTH !== 'undefined' && AUTH.isAdmin && AUTH.isAdmin());
            
            if (!allowed) {
                document.querySelector('.page-content').innerHTML = `
                    <div class="alert alert-danger">
                        You do not have permission to access approvals.
                    </div>
                `;
                return;
            }
            
            await this.loadLookups();
            await this.loadData();
            this.setupUI();
            this.setupEventListeners();
            this.renderTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Approvals init error:', error);
            this.showError('Failed to load approval data.');
        }
    }
    

    async loadLookups() {
        this.profilesMap = {};
        this.incomeCategories = {};
        this.expenseCategories = {};
        try {
            const pr = await supabase.from('profiles').select('id, full_name, email');
            (pr.data || []).forEach(p => {
                this.profilesMap[p.id] = p.full_name || p.email || 'User';
            });
        } catch (e) { console.warn(e); }
        try {
            const ic = await supabase.from('income_categories').select('id, name');
            (ic.data || []).forEach(c => { this.incomeCategories[c.id] = c.name; });
        } catch (e) {}
        try {
            const ec = await supabase.from('expense_categories').select('id, name');
            (ec.data || []).forEach(c => { this.expenseCategories[c.id] = c.name; });
        } catch (e) {}
    }
    
    resolveSubmitterName(item) {
        const id = item.created_by || item.submitted_by || item.requested_by;
        if (!id) return 'N/A';
        if (this.profilesMap && this.profilesMap[id]) return this.profilesMap[id];
        if (item.created_by_user?.full_name) return item.created_by_user.full_name;
        return 'N/A';
    }
    
    resolveCategoryName(item) {
        const isIncome = item._type === 'income' || item.approval_status !== undefined && item.status === undefined;
        const cid = item.category_id;
        if (!cid) return item.category?.name || 'N/A';
        if (item.category?.name) return item.category.name;
        if (isIncome || item._type === 'income') {
            return (this.incomeCategories && this.incomeCategories[cid]) || 'N/A';
        }
        return (this.expenseCategories && this.expenseCategories[cid]) ||
               (this.incomeCategories && this.incomeCategories[cid]) || 'N/A';
    }
    
    async loadData() {
        let pendingIncome = [];
        let pendingExpenses = [];
        try {
            let inc = await supabase.from('income').select('*');
            if (inc.error) {
                console.warn('approvals income', inc.error);
                pendingIncome = [];
            } else {
                pendingIncome = (inc.data || []).filter(r => r.is_deleted !== true);
            }
        } catch (e) { console.warn(e); }
        
        try {
            let exp = await supabase.from('expenses').select('*');
            if (exp.error) {
                console.warn('approvals expenses', exp.error);
                pendingExpenses = [];
            } else {
                pendingExpenses = (exp.data || []).filter(r => r.is_deleted !== true);
            }
        } catch (e) { console.warn(e); }
        
        // Combine with type
        this.data = [
            ...(pendingIncome || []).map(i => ({ ...i, _type: 'income' })),
            ...(pendingExpenses || []).map(e => ({ ...e, _type: 'expense' }))
        ];
        
        // Apply filter
        if (this.filter === 'income') {
            this.data = this.data.filter(d => d._type === 'income');
        } else if (this.filter === 'expense') {
            this.data = this.data.filter(d => d._type === 'expense');
        }
        
        this.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    setupUI() {
        const modalEl = document.getElementById('approval-modal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }
    }
    
    setupEventListeners() {
        const filter = document.getElementById('approval-filter');
        if (filter) {
            filter.addEventListener('change', (e) => {
                this.filter = e.target.value;
                this.refresh();
            });
        }
        
        // Approve button
        document.getElementById('approve-btn')?.addEventListener('click', () => {
            this.processApproval('approved');
        });
        
        // Reject button
        document.getElementById('reject-btn')?.addEventListener('click', () => {
            this.processApproval('rejected');
        });
    }
    
    async refresh() {
        await this.loadLookups();
        await this.loadData();
        this.renderTable();
        this.updateStats();
    }
    
    renderTable() {
        const tbody = document.getElementById('approvals-table-body');
        if (!tbody) return;
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">No pending approvals.</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map(item => {
            const isIncome = item._type === 'income';
            const status = isIncome ? item.approval_status : item.status;
            
            return `
                <tr>
                    <td>
                        <span class="badge bg-secondary">${item.transaction_id || 'N/A'}</span>
                    </td>
                    <td>
                        <span class="badge ${isIncome ? 'bg-success' : 'bg-danger'}">
                            ${isIncome ? 'Income' : 'Expense'}
                        </span>
                    </td>
                    <td class="fw-bold">${formatCurrency(item.amount)}</td>
                    <td>${this.resolveCategoryName(item)}</td>
                    <td>${this.resolveSubmitterName(item)}</td>
                    <td>${formatDateTime(item.created_at)}</td>
                    <td>
                        <span class="badge-status ${status}">${status}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary review-btn" 
                                data-id="${item.id}" 
                                data-type="${item._type}">
                            <i class="bi bi-eye"></i> Review
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        tbody.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openApprovalModal(btn.dataset.id, btn.dataset.type));
        });
    }
    
    updateStats() {
        const statusOf = (d) => d.approval_status || d.status || '';
        const pending = this.data.filter(d => ['pending','submitted'].includes(statusOf(d))).length;
        const approved = this.data.filter(d => statusOf(d) === 'approved').length;
        const rejected = this.data.filter(d => statusOf(d) === 'rejected').length;
        const total = this.data.length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pending-count', pending);
        set('approved-count', approved);
        set('rejected-count', rejected);
        set('total-count', total);
    }
    
    openApprovalModal(id, type) {
        const item = this.data.find(d => d.id === id && d._type === type);
        if (!item) return;
        
        this.currentApproval = item;
        
        const details = document.getElementById('approval-details');
        details.innerHTML = `
            <div class="mb-3">
                <strong>Transaction ID:</strong> ${item.transaction_id}
            </div>
            <div class="mb-3">
                <strong>Type:</strong> ${type === 'income' ? 'Income' : 'Expense'}
            </div>
            <div class="mb-3">
                <strong>Amount:</strong> ${formatCurrency(item.amount)}
            </div>
            <div class="mb-3">
                <strong>Category:</strong> ${this.resolveCategoryName(item)}
            </div>
            <div class="mb-3">
                <strong>Description:</strong> ${item.description || 'N/A'}
            </div>
            ${type === 'expense' ? `
                <div class="mb-3">
                    <strong>Vendor:</strong> ${item.vendor || 'N/A'}
                </div>
            ` : `
                <div class="mb-3">
                    <strong>Source:</strong> ${item.source || 'N/A'}
                </div>
            `}
            <div class="mb-3">
                <strong>Submitted By:</strong> ${this.resolveSubmitterName(item)}
            </div>
            ${item.receipt_url ? `
                <div class="mb-3">
                    <strong>Receipt:</strong>
                    <a href="${Storage.getPublicUrl('receipts', item.receipt_url).data.publicUrl}" 
                       target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-file-earmark-pdf"></i> View Receipt
                    </a>
                </div>
            ` : `
                <div class="mb-3 text-warning">
                    <i class="bi bi-exclamation-triangle"></i> No receipt attached
                </div>
            `}
        `;
        
        document.getElementById('approval-notes').value = '';
        this.modalInstance.show();
    }
    
    async processApproval(decision) {
        if (!this.currentApproval) return;
        if (this._processing) return;
        this._processing = true;
        const approveBtn = document.getElementById('approve-btn');
        const rejectBtn = document.getElementById('reject-btn');
        if (approveBtn) approveBtn.disabled = true;
        if (rejectBtn) rejectBtn.disabled = true;
        
        const notes = (document.getElementById('approval-notes')?.value || '').trim();
        const item = this.currentApproval;
        // Detect income robustly (_type, or presence of source / approval_status field patterns)
        const isIncome = item._type === 'income'
            || item.transaction_type === 'income'
            || (item.source != null && item.vendor == null && item.approval_status !== undefined);
        const table = isIncome ? 'income' : 'expenses';

        // Super Admin and Administrator may approve income & expenses
        if (typeof canApproveTransactions === 'function' && !canApproveTransactions()) {
            if (typeof showAppMessage === 'function') {
                showAppMessage('Permission denied', 'Only Super Admin or Administrator can approve transactions.', 'error');
            } else {
                this.showError('Permission denied.');
            }
            this._processing = false;
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            return;
        }

        // Update both status fields when possible so reports/grand budget all see "approved"
        // income table primarily uses approval_status; expenses primarily uses status
        const updates = isIncome
            ? { approval_status: decision }
            : { status: decision };
        
        let { error } = await supabase.from(table).update(updates).eq('id', item.id);
        // Fallback: only primary status field if dual update fails (missing column)
        if (error) {
            const single = isIncome ? { approval_status: decision } : { status: decision };
            const retry = await supabase.from(table).update(single).eq('id', item.id);
            error = retry.error;
        }
        
        if (error) {
            console.error('Approval update error', error);
            if (typeof showAppMessage === "function") showAppMessage("Approval failed", (error.message || String(error)), "error");
            this._processing = false;
            if (approveBtn) approveBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
            return;
        }
        
        // Create approval record
        await supabase
            .from('approvals')
            .insert({
                transaction_id: item.id,
                transaction_type: isIncome ? 'income' : 'expense',
                submitted_by: item.created_by,
                submitted_date: item.created_at,
                reviewed_by: AUTH.getCurrentProfile()?.id,
                reviewed_date: new Date().toISOString(),
                decision: decision,
                reason: notes || null,
                previous_status: isIncome ? item.approval_status : item.status,
                new_status: decision
            });
        
        // Notification (soft — never block approval)
        try {
            if (item.created_by && typeof notifyUser === 'function') {
                await notifyUser(
                    item.created_by,
                    'Transaction ' + decision,
                    `Your ${isIncome ? 'income' : 'expense'} ${item.transaction_id || ''} has been ${decision}.${notes ? ' Reason: ' + notes : ''}`,
                    decision === 'approved' ? 'success' : 'warning',
                    isIncome ? 'income.html' : 'expenses.html'
                );
            } else if (item.created_by) {
                await supabase.from('notifications').insert({
                    user_id: item.created_by,
                    title: 'Transaction ' + decision,
                    message: `Your transaction has been ${decision}`,
                    type: decision === 'approved' ? 'success' : 'warning'
                });
            }
        } catch (e) { console.warn(e); }
        
        if (typeof logAudit === 'function') {
            await logAudit(decision === 'approved' ? 'APPROVE' : 'REJECT', isIncome ? 'income' : 'expense', item.id, null, { status: decision, amount: item.amount, transaction_id: item.transaction_id, date: item.date });
        }

        // Income approved → automatically counted in Grand Budget (available for expenses)
        if (decision === 'approved' && isIncome) {
            try {
                // Full reconcile so totals always match all approved income rows
                const gb = await creditGrandBudgetIncome(item);
                const total = gb && gb.total_income != null ? Number(gb.total_income) : null;
                this._alreadyNotified = true;
                if (typeof showAppMessage === 'function') {
                    showAppMessage(
                        'Income approved',
                        total != null
                            ? ('Counted in Grand Budget. Total approved income: ETB ' + total.toFixed(2))
                            : 'Approved income added to Grand Budget.',
                        'success'
                    );
                }
            } catch (e) {
                console.error('Grand budget credit failed', e);
                // Still try a direct reconcile
                try {
                    if (typeof reconcileGrandBudgetFromApproved === 'function') {
                        await reconcileGrandBudgetFromApproved(item.financial_year_id || null);
                    }
                } catch (_) {}
                if (typeof showAppMessage === 'function') {
                    showAppMessage(
                        'Income approved',
                        'Income marked approved. Open Budget page to refresh Grand Budget totals if needed.',
                        'warning'
                    );
                }
            }
        }
        // Expense approved → debit grand budget expenses
        if (decision === 'approved' && !isIncome) {
            try {
                await debitGrandBudgetExpense(item);
            } catch (e) {
                console.warn('Grand budget expense debit failed', e);
            }
        }
        
        this.modalInstance.hide();
        // Single popup only (avoid duplicate toasts)
        if (!this._alreadyNotified) {
            if (typeof showAppMessage === "function") {
                showAppMessage("Success", "Transaction " + decision + " successfully!", "success");
            } else {
                this.showMessage('Transaction ' + decision + ' successfully.');
            }
        }
        this._alreadyNotified = false;
        this.currentApproval = null;
        this._processing = false;
        if (approveBtn) approveBtn.disabled = false;
        if (rejectBtn) rejectBtn.disabled = false;
        this.refresh();
    }
    
    showMessage(message, type = 'success') {
        // Show toast
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
}

// ============================================================
// Grand Budget helpers
// Approved income → total_income (unallocated pool)
// Super Admin later allocates from Available → category budgets
// ============================================================

async function ensureGrandBudgetRow(financialYearId) {
    try {
        let q = supabase.from('grand_budgets').select('*');
        if (financialYearId) q = q.eq('financial_year_id', financialYearId);
        let { data, error } = await q.maybeSingle();
        if (!error && data) return data;
        // Try any row if FY filter returned nothing
        if (financialYearId) {
            const any = await supabase.from('grand_budgets').select('*').limit(1).maybeSingle();
            if (any.data) return any.data;
        }
        const insert = {
            financial_year_id: financialYearId || null,
            annual_limit: 0,
            opening_balance: 0,
            total_income: 0,
            total_allocated: 0,
            total_expenses: 0,
            total_released: 0
        };
        const res = await supabase.from('grand_budgets').insert(insert).select().maybeSingle();
        if (res.data) return res.data;
        // Last resort: return local object (reconcile will persist later)
        return insert;
    } catch (e) {
        console.warn('ensureGrandBudgetRow', e);
        return {
            financial_year_id: financialYearId || null,
            total_income: 0, total_allocated: 0, total_expenses: 0,
            opening_balance: 0, annual_limit: 0, total_released: 0
        };
    }
}

/** Full reconcile: sum of ALL approved income/expenses → grand_budgets (income funds expenses) */
async function reconcileGrandBudgetFromApproved(financialYearId) {
    try {
        // Always load ALL income/expenses so we never miss rows missing financial_year_id
        const ir = await supabase.from('income').select('amount, approval_status, is_deleted, financial_year_id');
        let incomeRows = ir.data || [];
        if (financialYearId) {
            const filtered = incomeRows.filter(r => !r.financial_year_id || String(r.financial_year_id) === String(financialYearId));
            // If filter empties but we have approved income without FY, keep all
            if (filtered.some(r => String(r.approval_status || r.status || '').toLowerCase() === 'approved')) {
                incomeRows = filtered;
            }
        }
        const approvedIncome = incomeRows.filter(r => {
            if (r.is_deleted) return false;
            return String(r.approval_status || '').toLowerCase() === 'approved';
        }).reduce((s, r) => s + Number(r.amount || 0), 0);

        const er = await supabase.from('expenses').select('amount, status, is_deleted, financial_year_id');
        let expRows = er.data || [];
        if (financialYearId) {
            const filtered = expRows.filter(r => !r.financial_year_id || String(r.financial_year_id) === String(financialYearId));
            if (filtered.some(r => String(r.approval_status || r.status || '').toLowerCase() === 'approved')) {
                expRows = filtered;
            }
        }
        const approvedExp = expRows.filter(r => {
            if (r.is_deleted) return false;
            return String(r.status || '').toLowerCase() === 'approved';
        }).reduce((s, r) => s + Number(r.amount || 0), 0);

        const payload = {
            total_income: approvedIncome,
            total_expenses: approvedExp,
            updated_at: new Date().toISOString()
        };

        // Update every grand_budgets row (covers missing FY linkage)
        const allGb = await supabase.from('grand_budgets').select('id, financial_year_id');
        const rows = allGb.data || [];
        if (rows.length) {
            for (const g of rows) {
                await supabase.from('grand_budgets').update(payload).eq('id', g.id);
            }
        } else {
            // Create at least one Grand Budget row
            const ins = {
                ...payload,
                financial_year_id: financialYearId || null,
                opening_balance: 0,
                annual_limit: 0,
                total_allocated: 0,
                total_released: 0
            };
            const created = await supabase.from('grand_budgets').insert(ins).select().maybeSingle();
            if (created.error) {
                console.error('grand_budgets insert failed', created.error);
                // Still return totals so UI can show them even if persist failed
            }
        }
        return { total_income: approvedIncome, total_expenses: approvedExp };
    } catch (e) {
        console.warn('reconcileGrandBudgetFromApproved', e);
        return null;
    }
}

async function creditGrandBudgetIncome(item) {
    const amount = Number(item.amount) || 0;
    if (amount <= 0) return;
    const fyId = item.financial_year_id || null;
    // Prefer full reconcile so totals always match approved income (usable for expenses)
    const result = await reconcileGrandBudgetFromApproved(fyId);
    try {
        await supabase.from('budget_ledger').insert({
            financial_year_id: fyId,
            entry_type: 'income_credit',
            amount: amount,
            reference_id: item.id,
            reference_table: 'income',
            note: 'Approved income → Grand Budget (available for expenses)'
        });
    } catch (e) {}
    return result;
}

async function debitGrandBudgetExpense(item) {
    const amount = Number(item.amount) || 0;
    if (amount <= 0) return;
    const fyId = item.financial_year_id || null;
    await reconcileGrandBudgetFromApproved(fyId);
    try {
        await supabase.from('budget_ledger').insert({
            financial_year_id: fyId,
            entry_type: 'expense_debit',
            amount: amount,
            reference_id: item.id,
            reference_table: 'expenses',
            note: 'Approved expense from Grand Budget (funded by income)'
        });
    } catch (e) {}
}

window.reconcileGrandBudgetFromApproved = reconcileGrandBudgetFromApproved;

window.creditGrandBudgetIncome = creditGrandBudgetIncome;
window.debitGrandBudgetExpense = debitGrandBudgetExpense;
window.ensureGrandBudgetRow = ensureGrandBudgetRow;

// ============================================================
// Initialize Approvals Module
// ============================================================

if (document.getElementById('approvals-table-body')) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Approvals module ready');
    });
}