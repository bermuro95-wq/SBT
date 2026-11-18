// ============================================================
// SELAM BERTU TESFA - Analytics Module
// ============================================================

class AnalyticsModule {
    constructor() {
        this.data = {
            income: [],
            expenses: [],
            financialYear: null
        };
        this.charts = {};
        this.financialYears = [];
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadFinancialYears();
            await this.loadCategoryNames(); await this.loadData();
            
            this.setupUI();
            this.setupEventListeners();
            this.renderCharts();
            this.updateMetrics();
            this.generateInsights();
            
        } catch (error) {
            console.error('Analytics init error:', error);
            this.showError('Failed to load analytics data.');
        }
    }
    
    async loadFinancialYears() {
        const { data, error } = await supabase
            .from('financial_years')
            .select('*')
            .order('start_date', { ascending: false });
        
        if (!error) {
            this.financialYears = data || [];
            this.populateYearSelect();
            
            // Set default to current open year
            const currentYear = this.financialYears.find(y => y.status === 'open');
            if (currentYear) {
                this.data.financialYear = currentYear;
            } else if (this.financialYears.length > 0) {
                this.data.financialYear = this.financialYears[0];
            }
        }
    }
    
    populateYearSelect() {
        const y = new Date().getFullYear();
        const fromEl = document.getElementById('analytics-date-from');
        const toEl = document.getElementById('analytics-date-to');
        if (fromEl && !fromEl.value) fromEl.value = `${y}-01-01`;
        if (toEl && !toEl.value) toEl.value = `${y}-12-31`;
    }
    
    async loadCategoryNames() {
        this.categoryNames = this.categoryNames || {};
        this.paymentMethodNames = this.paymentMethodNames || {};
        try {
            for (const table of ['expense_categories', 'income_categories', 'categories']) {
                const { data } = await supabase.from(table).select('id, name');
                (data || []).forEach(c => { if (c.id) this.categoryNames[c.id] = c.name || c.id; });
            }
            const { data: pms } = await supabase.from('payment_methods').select('id, name');
            (pms || []).forEach(p => { if (p.id) this.paymentMethodNames[p.id] = p.name || p.id; });
        } catch (e) {}
    }

    async loadData() {
        const [incomeData, expenseData] = await Promise.all([
            supabase.from('income').select('*'),
            supabase.from('expenses').select('*')
        ]);
        let income = (incomeData.data || []).filter(r => r.is_deleted !== true);
        let expenses = (expenseData.data || []).filter(r => r.is_deleted !== true);
        const df = document.getElementById('analytics-date-from')?.value;
        const dt = document.getElementById('analytics-date-to')?.value;
        const inRange = (d) => {
            const ds = String(d || '').slice(0,10);
            if (df && ds < df) return false;
            if (dt && ds > dt) return false;
            return true;
        };
        const isApprRow = (r) => String(r.approval_status || r.status || '').toLowerCase() === 'approved';
        // Charts/metrics use approved only; pending never inflates totals
        this.data.income = income.filter(r => inRange(r.date) && isApprRow(r));
        this.data.expenses = expenses.filter(r => inRange(r.date) && isApprRow(r));
        this.data.allIncome = income.filter(r => inRange(r.date));
        this.data.allExpenses = expenses.filter(r => inRange(r.date));
    }
    
    setupUI() {
        // Nothing specific needed
    }
    
    setupEventListeners() {
        document.getElementById('analytics-date-from')?.addEventListener('change', () => this.refresh());
        document.getElementById('analytics-date-to')?.addEventListener('change', () => this.refresh());
        
        // Refresh button
        document.getElementById('analytics-refresh')?.addEventListener('click', () => {
            this.refresh();
        });
        
        // Period selector
        document.getElementById('analytics-period')?.addEventListener('change', () => {
            this.refresh();
        });
    }
    
    async refresh() {
        await this.loadData();
        this.renderCharts();
        this.updateMetrics();
        this.generateInsights();
    }
    
    renderCharts() {
        const safe = (fn, name) => {
            try { fn.call(this); } catch (e) { console.warn('Chart failed:', name, e); }
        };
        safe(this.renderTrendChart, 'trend');
        safe(this.renderDistributionChart, 'distribution');
        safe(this.renderSourcesChart, 'sources');
        safe(this.renderBalanceChart, 'balance');
        safe(this.renderExpenseBreakdownBar, 'expenseBreakdown');
        safe(this.renderPaymentMethodsChart, 'paymentMethods');
        safe(this.renderStatusMixChart, 'statusMix');
    }
    
    renderTrendChart() {
        const ctx = document.getElementById('trend-chart');
        if (!ctx) return;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const incomeByMonth = this.groupByMonth(this.data.income);
        const expensesByMonth = this.groupByMonth(this.data.expenses);
        
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }
        
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeByMonth,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Expenses',
                        data: expensesByMonth,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderDistributionChart() {
        const ctx = document.getElementById('distribution-chart');
        if (!ctx) return;
        
        // Group expenses by category
        const categoryMap = {};
        this.data.expenses.forEach(e => {
            if (!categoryMap[e.category_id]) {
                categoryMap[e.category_id] = {
                    name: (e.category?.name || e.category_name || (this.categoryNames && this.categoryNames[e.category_id]) || e.category || 'Uncategorized'),
                    total: 0
                };
            }
            categoryMap[e.category_id].total += Number(e.amount) || 0;
        });
        
        const sorted = Object.values(categoryMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);
        
        const labels = sorted.length ? sorted.map(c => c.name || 'Uncategorized') : ['No expense data'];
        const data = sorted.length ? sorted.map(c => c.total) : [1];
        const colors = ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#17a2b8', '#007bff', '#6f42c1', '#e83e8c'];
        
        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }
        
        this.charts.distribution = new Chart(ctx, {
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
                        position: 'bottom',
                        labels: { boxWidth: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrency(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
    
    renderSourcesChart() {
        const ctx = document.getElementById('sources-chart');
        if (!ctx) return;
        
        // Group income by source
        const sourceMap = {};
        this.data.income.forEach(i => {
            if (!sourceMap[i.source]) {
                sourceMap[i.source] = 0;
            }
            sourceMap[i.source] += Number(i.amount) || 0;
        });
        
        const sorted = Object.entries(sourceMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);
        const colors = ['#28a745', '#17a2b8', '#ffc107', '#fd7e14', '#007bff', '#6f42c1'];
        
        if (this.charts.sources) {
            this.charts.sources.destroy();
        }
        
        this.charts.sources = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Income by Source',
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderBalanceChart() {
        const ctx = document.getElementById('balance-chart');
        if (!ctx) return;
        
        // Calculate monthly balance trend
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const incomeByMonth = this.groupByMonth(this.data.income);
        const expensesByMonth = this.groupByMonth(this.data.expenses);
        
        let balance = this.data.financialYear?.opening_balance || 0;
        const balanceTrend = [];
        const monthLabels = [];
        
        for (let i = 0; i < 12; i++) {
            balance += (incomeByMonth[i] || 0) - (expensesByMonth[i] || 0);
            balanceTrend.push(balance);
            monthLabels.push(months[i]);
        }
        
        if (this.charts.balance) {
            this.charts.balance.destroy();
        }
        
        this.charts.balance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [{
                    label: 'Balance',
                    data: balanceTrend,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Balance: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    

    renderExpenseBreakdownBar() {
        const ctx = document.getElementById('expense-breakdown-bar');
        if (!ctx || typeof Chart === 'undefined') return;

        const categoryMap = {};
        (this.data.expenses || []).forEach(e => {
            const key = e.category_id || e.category || 'uncategorized';
            const name = (e.category && e.category.name)
                || e.category_name
                || (this.categoryNames && this.categoryNames[e.category_id])
                || e.category
                || 'Uncategorized';
            if (!categoryMap[key]) categoryMap[key] = { name: String(name), total: 0 };
            categoryMap[key].total += Number(e.amount) || 0;
        });

        const sorted = Object.values(categoryMap).sort((a, b) => b.total - a.total).slice(0, 10);
        const labels = sorted.length ? sorted.map(c => c.name) : ['No expense data'];
        const data = sorted.length ? sorted.map(c => c.total) : [0];
        const colors = ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#17a2b8', '#007bff', '#6f42c1', '#e83e8c', '#20c997', '#6610f2'];

        if (this.charts.expenseBar) this.charts.expenseBar.destroy();
        this.charts.expenseBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Expenses by Category',
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => (typeof formatCurrency === 'function' ? formatCurrency(c.parsed.y) : c.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => (typeof formatCurrency === 'function' ? formatCurrency(v) : v)
                        }
                    }
                }
            }
        });
    }

    renderPaymentMethodsChart() {
        const ctx = document.getElementById('payment-methods-chart');
        if (!ctx || typeof Chart === 'undefined') return;

        const map = {};
        const bump = (row) => {
            const key = row.payment_method_id || row.payment_method || null;
            if (!key && key !== 0) return;
            let name = row.payment_method_name || row.payment_method || 'Unknown';
            if (this.paymentMethodNames && this.paymentMethodNames[row.payment_method_id]) {
                name = this.paymentMethodNames[row.payment_method_id];
            }
            const k = String(key);
            if (!map[k]) map[k] = { name: String(name), total: 0 };
            map[k].total += Number(row.amount) || 0;
        };
        (this.data.expenses || []).forEach(bump);
        (this.data.income || []).forEach(bump);

        const sorted = Object.values(map).sort((a, b) => b.total - a.total);
        const labels = sorted.length ? sorted.map(x => x.name) : ['No payment data'];
        const data = sorted.length ? sorted.map(x => x.total) : [1];
        const colors = ['#c01868', '#1a4d7a', '#f8d830', '#28a745', '#17a2b8', '#fd7e14', '#6f42c1'];

        if (this.charts.paymentMethods) this.charts.paymentMethods.destroy();
        this.charts.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12 } },
                    tooltip: {
                        callbacks: {
                            label: (c) => {
                                const total = c.dataset.data.reduce((a, b) => a + b, 0) || 1;
                                const pct = ((c.parsed / total) * 100).toFixed(1);
                                const val = typeof formatCurrency === 'function' ? formatCurrency(c.parsed) : c.parsed;
                                return c.label + ': ' + val + ' (' + pct + '%)';
                            }
                        }
                    }
                },
                cutout: '55%'
            }
        });
    }

    renderStatusMixChart() {
        const ctx = document.getElementById('status-mix-chart');
        if (!ctx || typeof Chart === 'undefined') return;

        const map = {};
        const add = (status) => {
            const s = String(status || 'unknown').toLowerCase();
            map[s] = (map[s] || 0) + 1;
        };
        (this.data.expenses || []).forEach(e => add(e.status || e.approval_status));
        (this.data.income || []).forEach(i => add(i.approval_status || i.status));

        const order = ['approved', 'submitted', 'pending', 'draft', 'rejected', 'unknown'];
        const labels = [];
        const data = [];
        order.forEach(k => {
            if (map[k]) {
                labels.push(k.charAt(0).toUpperCase() + k.slice(1));
                data.push(map[k]);
                delete map[k];
            }
        });
        Object.keys(map).forEach(k => {
            labels.push(k.charAt(0).toUpperCase() + k.slice(1));
            data.push(map[k]);
        });
        if (!labels.length) { labels.push('No status data'); data.push(1); }

        const colorMap = {
            Approved: '#28a745', Submitted: '#17a2b8', Pending: '#ffc107',
            Draft: '#6c757d', Rejected: '#dc3545', Unknown: '#adb5bd'
        };
        const colors = labels.map(l => colorMap[l] || '#007bff');

        if (this.charts.statusMix) this.charts.statusMix.destroy();
        this.charts.statusMix = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
            }
        });
    }

    updateMetrics() {
        const isAppr = (r) => String(r.approval_status || r.status || '').toLowerCase() === 'approved';
        const totalIncome = this.data.income.filter(isAppr).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const totalExpenses = this.data.expenses.filter(isAppr).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const netIncome = totalIncome - totalExpenses;
        const volume = this.data.income.length + this.data.expenses.length;
        
        document.getElementById('analytics-income').textContent = formatCurrency(totalIncome);
        document.getElementById('analytics-expenses').textContent = formatCurrency(totalExpenses);
        document.getElementById('analytics-net').textContent = formatCurrency(netIncome);
        document.getElementById('analytics-volume').textContent = volume;
    }
    
    generateInsights() {
        const insights = document.getElementById('analytics-insights');
        if (!insights) return;
        
        const totalIncome = this.data.income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const totalExpenses = this.data.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const count = this.data.income.length + this.data.expenses.length;
        
        if (count === 0) {
            insights.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-info-circle fs-3 d-block mb-2"></i>
                    Not enough data to generate insights.
                </div>
            `;
            return;
        }
        
        const insightsList = [];
        
        // Income vs Expenses
        if (totalIncome > totalExpenses) {
            const ratio = (totalIncome / totalExpenses).toFixed(2);
            insightsList.push(`Income exceeds expenses by ${formatCurrency(totalIncome - totalExpenses)}. (Ratio: ${ratio}:1)`);
        } else if (totalExpenses > totalIncome) {
            const ratio = (totalExpenses / totalIncome).toFixed(2);
            insightsList.push(`Expenses exceed income by ${formatCurrency(totalExpenses - totalIncome)}. (Ratio: ${ratio}:1)`);
        } else {
            insightsList.push('Income and expenses are balanced.');
        }
        
        // Top expense category
        const categoryMap = {};
        this.data.expenses.forEach(e => {
            const name = e.category?.name || e.category_name || (this.categoryNames && this.categoryNames[e.category_id]) || e.category || 'Uncategorized';
            if (!categoryMap[name]) categoryMap[name] = 0;
            categoryMap[name] += e.amount;
        });
        const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];
        if (topCategory) {
            const percentage = totalExpenses > 0 ? ((topCategory[1] / totalExpenses) * 100).toFixed(1) : 0;
            insightsList.push(`Top expense category: ${topCategory[0]} (${formatCurrency(topCategory[1])}, ${percentage}% of total expenses)`);
        }
        
        // Top income source
        const sourceMap = {};
        this.data.income.forEach(i => {
            if (!sourceMap[i.source]) sourceMap[i.source] = 0;
            sourceMap[i.source] += Number(i.amount) || 0;
        });
        const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];
        if (topSource) {
            const percentage = totalIncome > 0 ? ((topSource[1] / totalIncome) * 100).toFixed(1) : 0;
            insightsList.push(`Top income source: ${topSource[0]} (${formatCurrency(topSource[1])}, ${percentage}% of total income)`);
        }
        
        // Monthly average
        const months = new Set();
        this.data.income.forEach(i => months.add(new Date(i.date).getMonth()));
        this.data.expenses.forEach(e => months.add(new Date(e.date).getMonth()));
        const monthCount = months.size || 1;
        const avgSpending = totalExpenses / monthCount;
        insightsList.push(`Average monthly spending: ${formatCurrency(avgSpending)}`);
        
        // Transaction volume
        insightsList.push(`Total transactions: ${count} (${this.data.income.length} income, ${this.data.expenses.length} expenses)`);
        
        insights.innerHTML = `
            <ul class="list-group list-group-flush">
                ${insightsList.map(insight => `
                    <li class="list-group-item bg-transparent d-flex align-items-start gap-3">
                        <i class="bi bi-lightbulb text-warning mt-1"></i>
                        <span>${insight}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }
    
    groupByMonth(transactions) {
        const monthly = new Array(12).fill(0);
        (transactions || []).forEach(t => {
            const ds = String(t.date || '');
            let m = parseInt(ds.slice(5, 7), 10); // YYYY-MM-DD → 1-12
            if (!m || m < 1 || m > 12) {
                const d = new Date(ds);
                if (!isNaN(d.getTime())) m = d.getUTCMonth() + 1;
            }
            if (m >= 1 && m <= 12) monthly[m - 1] += Number(t.amount) || 0;
        });
        return monthly;
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
// Initialize Analytics Module
// ============================================================

if (document.getElementById('analytics-income')) {
    document.addEventListener('DOMContentLoaded', function() {
        new AnalyticsModule();
    });
}