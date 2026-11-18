// ============================================================
// SELAM BERTU TESFA - Dashboard Module
// ============================================================

class Dashboard {
    constructor() {
        this.charts = {};
        this.data = {
            income: [],
            expenses: [],
            financialYear: null,
            stats: {}
        };
        this.init();
    }
    
    async init() {
        try {
            // Show loading state
            this.showLoading();
            
            // Load data
            await this.loadCategoryMaps();
            await this.loadData();
            
            // Update KPIs
            this.updateKPIs();
            
            // Date range calendars for charts
            const fromEl = document.getElementById('chart-date-from');
            const toEl = document.getElementById('chart-date-to');
            if (fromEl && !fromEl.dataset.bound) {
                fromEl.dataset.bound = '1';
                const y = new Date().getFullYear();
                if (!fromEl.value) fromEl.value = `${y}-01-01`;
                if (toEl && !toEl.value) toEl.value = `${y}-12-31`;
                const redraw = () => { this.renderCharts(); this.renderRecentTransactions(); };
                fromEl.addEventListener('change', redraw);
                if (toEl) toEl.addEventListener('change', redraw);
            }
            
            // Update charts
            this.renderCharts();
            
            // Update recent transactions
            this.renderRecentTransactions();
            
            // Money summary insights
            this.renderMoneyInsights();
            this.renderBudgetAlert();
            
            // Setup auto-refresh
            this.setupAutoRefresh();
            
            // Hide loading
            this.hideLoading();
            
        } catch (error) {
            console.error('Dashboard init error:', error);
            this.showError('Failed to load dashboard data. Please refresh the page.');
        }
    }
    

    async loadCategoryMaps() {
        this.incomeCatMap = {};
        this.expenseCatMap = {};
        try {
            const ic = await supabase.from('income_categories').select('id, name');
            (ic.data || []).forEach(r => { this.incomeCatMap[r.id] = r.name; });
        } catch (e) {}
        try {
            const ec = await supabase.from('expense_categories').select('id, name');
            (ec.data || []).forEach(r => { this.expenseCatMap[r.id] = r.name; });
        } catch (e) {}
    }
    
    resolveTxCategory(t) {
        if (t.category?.name) return t.category.name;
        if (t.category_name) return t.category_name;
        const id = t.category_id;
        if (!id) return 'N/A';
        if (t.type === 'expense') return this.expenseCatMap?.[id] || this.incomeCatMap?.[id] || 'N/A';
        return this.incomeCatMap?.[id] || this.expenseCatMap?.[id] || 'N/A';
    }

    async loadData() {
        // Get current financial year (do not hard-fail)
        let year = null;
        try {
            const res = await DB.financialYears.getCurrent();
            year = res.data;
            if (!year) {
                const all = await DB.financialYears.getAll();
                year = (all.data || []).find(y => y.status === 'open') || (all.data || [])[0] || null;
            }
        } catch (e) {
            console.warn('financial year load', e);
        }
        
        this.data.financialYear = year;
        
        if (!year) {
            year = { id: null, opening_balance: 0, annual_budget: 0, name: 'All' };
            this.data.financialYear = year;
        }
        
        // Load ALL income/expense rows (not only approved) so dashboard shows real stored data
        let income = [], expenses = [];
        try {
            let iq = supabase.from('income').select('*');
            if (year?.id) iq = iq.eq('financial_year_id', year.id);
            const ir = await iq;
            if (ir.error) {
                const all = await supabase.from('income').select('*');
                income = (all.data || []).filter(r => r.is_deleted !== true);
            } else {
                income = (ir.data || []).filter(r => r.is_deleted !== true);
            }
        } catch (e) { console.warn(e); }
        try {
            let eq = supabase.from('expenses').select('*');
            if (year?.id) eq = eq.eq('financial_year_id', year.id);
            const er = await eq;
            if (er.error) {
                const all = await supabase.from('expenses').select('*');
                expenses = (all.data || []).filter(r => r.is_deleted !== true);
            } else {
                expenses = (er.data || []).filter(r => r.is_deleted !== true);
            }
        } catch (e) { console.warn(e); }
        
        this.data.income = income;
        this.data.expenses = expenses;
        
        this.data.pending = {
            income: income.filter(i => ['submitted','pending'].includes(i.approval_status)),
            expenses: expenses.filter(e => ['submitted','pending'].includes(e.status))
        };
        
        // Totals = ONLY admin-approved amounts (pending/rejected excluded)
        const isAppr = (r) => String(r.approval_status || r.status || '').toLowerCase() === 'approved';
        const totalIncome = this.data.income.filter(isAppr).reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const totalExpenses = this.data.expenses.filter(isAppr).reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const opening = Number(year.opening_balance || 0);
        const balance = opening + totalIncome - totalExpenses;
        let annualBudget = Number(year.annual_budget || 0);
        // If year has no annual_budget, sum allocated budgets
        if (!annualBudget) {
            try {
                let bq = supabase.from('budgets').select('*');
                if (year?.id) bq = bq.eq('financial_year_id', year.id);
                const br = await bq;
                const brows = br.data || [];
                annualBudget = brows.reduce((s, b) => s + Number(b.budget_amount ?? b.allocated_amount ?? 0), 0);
            } catch (e) {}
        }
        // Fallback: use total expenses as reference only if still 0 -> show 0 not NaN
        const budgetUsed = annualBudget > 0 ? (totalExpenses / annualBudget) * 100 : 0;
        
        // Resolve expense category names for charts
        try {
            const ec = await supabase.from('expense_categories').select('id, name');
            const map = {};
            (ec.data || []).forEach(r => { map[r.id] = r.name; });
            this.data.expenses = this.data.expenses.map(e => ({
                ...e,
                category_name: map[e.category_id] || e.category_name || 'Uncategorized'
            }));
        } catch (e) {}
        
        this.data.stats = {
            totalIncome,
            totalExpenses,
            balance,
            annualBudget,
            budgetUsed: Math.min(budgetUsed, 999),
            totalTransactions: this.data.income.length + this.data.expenses.length,
            pendingApprovals: this.data.pending.income.length + this.data.pending.expenses.length
        };
    }
    
    updateKPIs() {
        const stats = this.data.stats;
        
        document.getElementById('total-income').textContent = formatCurrency(stats.totalIncome);
        document.getElementById('total-expenses').textContent = formatCurrency(stats.totalExpenses);
        document.getElementById('current-balance').textContent = formatCurrency(stats.balance);
        document.getElementById('budget-used').textContent = `${stats.budgetUsed.toFixed(1)}%`;
        const year = this.data.financialYear || {};
        const opening = Number(year.opening_balance || 0);
        const closing = opening + Number(stats.totalIncome || 0) - Number(stats.totalExpenses || 0);
        const ob = document.getElementById('opening-balance');
        const cb = document.getElementById('closing-balance');
        if (ob) ob.textContent = formatCurrency(opening);
        if (cb) cb.textContent = formatCurrency(closing);
        
        // Update budget progress bar if exists
        const progressBar = document.querySelector('.budget-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${stats.budgetUsed}%`;
            progressBar.setAttribute('aria-valuenow', stats.budgetUsed);
            
            // Change color based on usage
            if (stats.budgetUsed > 90) {
                progressBar.className = 'progress-bar bg-danger';
            } else if (stats.budgetUsed > 75) {
                progressBar.className = 'progress-bar bg-warning';
            } else {
                progressBar.className = 'progress-bar bg-success';
            }
        }
    }
    
    renderCharts() {
        // Monthly chart
        this.renderMonthlyChart();
        
        // Expense pie chart
        this.renderExpensePieChart();
    }
    
    renderMonthlyChart() {
        const ctx = document.getElementById('monthly-chart');
        if (!ctx) return;
        
        const from = document.getElementById('chart-date-from')?.value;
        const to = document.getElementById('chart-date-to')?.value;
        const inRange = (d) => {
            if (!d) return true;
            const ds = String(d).slice(0, 10);
            if (from && ds < from) return false;
            if (to && ds > to) return false;
            return true;
        };
        // Filter stored rows by calendar range
        this._incomeBackup = this.data.income;
        this._expensesBackup = this.data.expenses;
        this.data.income = (this.data.income || []).filter(i => inRange(i.date));
        this.data.expenses = (this.data.expenses || []).filter(e => inRange(e.date));
        
        // Prepare monthly data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const incomeByMonth = new Array(12).fill(0);
        const expensesByMonth = new Array(12).fill(0);
        
        this.data.income.forEach(item => {
            const ds = String(item.date || '');
            let month = parseInt(ds.slice(5, 7), 10) - 1;
            if (isNaN(month) || month < 0) { const d = new Date(ds); month = isNaN(d) ? 0 : d.getUTCMonth(); }
            incomeByMonth[month] += Number(item.amount) || 0;
        });
        
        this.data.expenses.forEach(item => {
            const ds = String(item.date || '');
            let month = parseInt(ds.slice(5, 7), 10) - 1;
            if (isNaN(month) || month < 0) { const d = new Date(ds); month = isNaN(d) ? 0 : d.getUTCMonth(); }
            expensesByMonth[month] += Number(item.amount) || 0;
        });
        
        // Destroy existing chart
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }
        
        // Create chart
        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeByMonth,
                        backgroundColor: 'rgba(40, 167, 69, 0.6)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Expenses',
                        data: expensesByMonth,
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'ETB ' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderExpensePieChart() {
        // Restore full datasets if monthly chart filtered them
        if (this._incomeBackup) {
            this.data.income = this._incomeBackup;
            this.data.expenses = this._expensesBackup;
            this._incomeBackup = null;
            this._expensesBackup = null;
        }
        const ctx = document.getElementById('expense-pie-chart');
        if (!ctx) return;
        
        const from = document.getElementById('chart-date-from')?.value;
        const to = document.getElementById('chart-date-to')?.value;
        const inRange = (d) => {
            if (!d) return true;
            const ds = String(d).slice(0, 10);
            if (from && ds < from) return false;
            if (to && ds > to) return false;
            return true;
        };
        
        // Group expenses by category (support plain category_id)
        const categoryMap = {};
        this.data.expenses.forEach(item => {
            const categoryName = item.category?.name || item.category_name || (item.category_id && String(item.category_id).length < 20 ? item.category_id : null) || 'Uncategorized';
            if (!categoryMap[categoryName]) {
                categoryMap[categoryName] = 0;
            }
            categoryMap[categoryName] += Number(item.amount || 0);
        });
        
        const labels = Object.keys(categoryMap);
        const data = Object.values(categoryMap);
        const colors = [
            '#dc3545', '#fd7e14', '#ffc107', '#28a745', 
            '#17a2b8', '#007bff', '#6f42c1', '#e83e8c',
            '#20c997', '#6610f2'
        ];
        
        // Destroy existing chart
        if (this.charts.expensePie) {
            this.charts.expensePie.destroy();
        }
        
        // Create chart
        this.charts.expensePie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            boxWidth: 12
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
    
    renderRecentTransactions() {
        const tbody = document.getElementById('recent-transactions');
        if (!tbody) return;
        
        // Combine and sort transactions
        const transactions = [
            ...this.data.income.map(i => ({
                ...i,
                type: 'income',
                status: i.approval_status
            })),
            ...this.data.expenses.map(e => ({
                ...e,
                type: 'expense',
                status: e.status
            }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
         .slice(0, 10);
        
        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">No recent transactions found.</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td>
                    <span class="badge bg-secondary">${t.transaction_id || 'N/A'}</span>
                </td>
                <td>${formatDate(t.date)}</td>
                <td>
                    <span class="badge ${t.type === 'income' ? 'bg-success' : 'bg-danger'}">
                        ${t.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                </td>
                <td>${this.resolveTxCategory(t)}</td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${formatCurrency(t.amount)}
                </td>
                <td>
                    <span class="badge-status ${t.status}">${t.status}</span>
                </td>
            </tr>
        `).join('');
    }
    

    renderBudgetAlert() {
        const s = this.data.stats || {};
        const used = Number(s.budgetUsed || 0);
        let banner = document.getElementById('budget-alert-banner');
        if (!banner) {
            const host = document.getElementById('money-insights');
            if (!host || !host.parentElement) return;
            banner = document.createElement('div');
            banner.id = 'budget-alert-banner';
            banner.className = 'alert mt-2 mb-0';
            host.parentElement.appendChild(banner);
        }
        if (used >= 100) {
            banner.className = 'alert alert-danger mt-2 mb-0';
            banner.textContent = 'Budget alert: spending has reached or exceeded 100% of allocated budget.';
            banner.classList.remove('d-none');
        } else if (used >= 90) {
            banner.className = 'alert alert-warning mt-2 mb-0';
            banner.textContent = 'Budget warning: ' + used.toFixed(1) + '% of budget used.';
            banner.classList.remove('d-none');
        } else {
            banner.classList.add('d-none');
        }
    }
    
    renderMoneyInsights() {
        const host = document.getElementById('money-insights');
        if (!host) return;
        const s = this.data.stats || {};
        const income = Number(s.totalIncome || 0);
        const expense = Number(s.totalExpenses || 0);
        const balance = Number(s.balance || (income - expense));
        const pending = Number(s.pendingApprovals || 0);
        const ratio = expense > 0 ? (income / expense).toFixed(2) : '—';
        const tips = [];
        if (income === 0 && expense === 0) {
            tips.push('No transactions yet. Create income or expense to see insights.');
        } else {
            if (balance >= 0) tips.push('Net position is positive by ' + formatCurrency(balance) + '.');
            else tips.push('Expenses exceed income by ' + formatCurrency(Math.abs(balance)) + '.');
            if (pending > 0) tips.push(pending + ' item(s) waiting for approval.');
            tips.push('Income-to-expense ratio: ' + ratio + '.');
            tips.push('Budget used: ' + (Number(s.budgetUsed || 0).toFixed(1)) + '%.');
        }
        host.innerHTML = '<ul class="mb-0 ps-3">' + tips.map(t => '<li class="mb-1">' + t + '</li>').join('') + '</ul>';
    }

    showLoading() {
        // Show loading indicators
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.textContent = 'Loading...';
        });
    }
    
    hideLoading() {
        // Loading is hidden after data is loaded
    }
    
    showEmptyState(message) {
        // Show empty state in dashboard
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.textContent = 'ETB 0.00';
        });
        
        // Show message in recent transactions
        const tbody = document.getElementById('recent-transactions');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">${message}</td>
                </tr>
            `;
        }
    }
    
    showError(message) {
        // Show error state
        const errorAlert = document.createElement('div');
        errorAlert.className = 'alert alert-danger alert-dismissible fade show';
        errorAlert.innerHTML = `
            <strong>Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.page-content');
        if (container) {
            container.prepend(errorAlert);
        }
    }
    
    setupAutoRefresh() {
        // Auto-refresh every 60 seconds
        setInterval(() => {
            this.refresh();
        }, 60000);
    }
    
    async refresh() {
        try {
            await this.loadData();
            this.updateKPIs();
            this.renderCharts();
            this.renderRecentTransactions();
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }
}

// ============================================================
// Initialize Dashboard
// ============================================================

if (document.getElementById('recent-transactions')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Dashboard will be initialized by app.js
        console.log('Dashboard module ready');
    });
}