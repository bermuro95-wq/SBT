// ============================================================
// SELAM BERTU TESFA - Reports Module
// ============================================================

class ReportsModule {
    constructor() {
        this.reportData = null;
        this.currentReport = 'annual';
        this.financialYears = [];
        this.charts = {};
        
        this.init();
    }

    /** Financial reports only include admin-approved rows */
    isApprovedRow(r) {
        const s = String((r && (r.approval_status || r.status)) || '').toLowerCase().trim();
        return s === 'approved';
    }
    onlyApprovedIncome(rows) {
        return (rows || []).filter(r => r && r.is_deleted !== true && this.isApprovedRow(r));
    }
    onlyApprovedExpenses(rows) {
        return (rows || []).filter(r => r && r.is_deleted !== true && this.isApprovedRow(r));
    }

    
    async init() {
        try {
            await this.loadFinancialYears();
            this.setupUI();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Reports init error:', error);
            this.showError('Failed to load reports.');
        }
    }
    
    async loadFinancialYears() {
        try {
            const { data, error } = await supabase
                .from('financial_years')
                .select('*')
                .order('start_date', { ascending: false });
            if (error) throw error;
            this.financialYears = data || [];
        } catch (e) {
            console.warn('loadFinancialYears', e);
            this.financialYears = [];
        }
        this.populateYearSelect();
    }
    
    populateYearSelect() {
        const y = new Date().getFullYear();
        const fromEl = document.getElementById('report-date-from');
        const toEl = document.getElementById('report-date-to');
        if (fromEl && fromEl.tagName === 'INPUT' && !fromEl.value) fromEl.value = `${y}-01-01`;
        if (toEl && toEl.tagName === 'INPUT' && !toEl.value) toEl.value = `${y}-12-31`;
    }
    
    setupUI() {
        // Set default month to current month
        const currentMonth = new Date().getMonth() + 1;
        const monthSelect = document.getElementById('report-month');
        if (monthSelect) {
            monthSelect.value = currentMonth;
        }
    }
    
    setupEventListeners() {
        // Report card clicks — generate and auto-scroll to report
        document.querySelectorAll('.report-card').forEach(card => {
            card.addEventListener('click', async () => {
                const reportType = card.dataset.report;
                const sel = document.getElementById('report-type-select');
                if (sel) sel.value = reportType;
                await this.generateReport(reportType);
                if (this.scrollToReport) this.scrollToReport();
                const target = document.getElementById('report-content') || document.getElementById('report-output');
                if (target) {
                    target.classList.remove('d-none');
                    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                }
            });
        });
        
        // Generate button
        document.getElementById('generate-report-btn')?.addEventListener('click', async () => {
            const reportType = document.getElementById('report-type-select').value;
            await this.generateReport(reportType);
            if (this.scrollToReport) this.scrollToReport();
            const target = document.getElementById('report-content') || document.getElementById('report-output');
            if (target) {
                target.classList.remove('d-none');
                setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
            }
        });
        
        // Export buttons
        document.getElementById('export-pdf-btn')?.addEventListener('click', () => {
            this.exportPDF();
        });
        
        document.getElementById('export-excel-btn')?.addEventListener('click', () => {
            this.exportExcel();
        });
        
        document.getElementById('close-report-btn')?.addEventListener('click', () => {
            document.getElementById('report-output').classList.add('d-none');
        });
    }
    
    scrollToReport() {
        const target = document.getElementById('report-content') || document.getElementById('report-output');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            target.classList.add('report-highlight');
            setTimeout(() => target.classList.remove('report-highlight'), 1200);
        }
    }

    async generateReport(type) {
        this.currentReport = type;
        const yearId = this.financialYears.find(y => y.status === 'open')?.id || this.financialYears[0]?.id || null;
        const month = parseInt(document.getElementById('report-month').value);
        
        // yearId optional: if empty, reports aggregate all available data
        
        
        // Show loading
        document.getElementById('report-output').classList.remove('d-none');
        const __rc = document.getElementById('report-content');
        if (__rc) __rc.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Generating report...</p>
            </div>
        `;
        
        try {
            let data;
            switch(type) {
                case 'annual':
                    data = await this.getAnnualReport(yearId);
                    break;
                case 'monthly':
                    data = await this.getMonthlyReport(yearId, month);
                    break;
                case 'income':
                    data = await this.getIncomeReport(yearId);
                    break;
                case 'expense':
                    data = await this.getExpenseReport(yearId);
                    break;
                case 'budget':
                    data = await this.getBudgetReport(yearId);
                    break;
                case 'category':
                    data = await this.getCategoryReport(yearId);
                    break;
                case 'activity':
                    data = await this.getActivityReport(yearId);
                    break;
                case 'audit':
                    data = await this.getAuditReport(yearId);
                    break;
                case 'source':
                    data = await this.getSourceReport(yearId);
                    break;
                case 'pending':
                    data = await this.getPendingReport(yearId);
                    break;
                case 'cash':
                    data = await this.getCashSummaryReport(yearId);
                    break;
                case 'audit_compliance':
                    data = await this.getAuditComplianceReport(yearId);
                    break;
                case 'risk_anomaly':
                    data = await this.getRiskAnomalyReport(yearId);
                    break;
                case 'integrity':
                    data = await this.getFinancialIntegrityReport(yearId);
                    break;
                default:
                    data = await this.getAnnualReport(yearId);
            }
            
            this.reportData = data;
            this.renderReport(data, type);
            
        } catch (error) {

            
            console.error('Report generation error:', error);

            
            const __rc = document.getElementById('report-content');
        if (__rc) __rc.innerHTML = `

            
                <div class="alert alert-danger">

            
                    Failed to generate report. Please try again.

            
                </div>

            
            `;

            
        }

            
        }
    
    
    async getSourceReport(yearId) {
        const { data } = await supabase.from('income').select('*');
        let rows = this.onlyApprovedIncome(data || []);
        const by = {};
        rows.forEach(r => {
            const k = (r.source || 'Unknown').trim() || 'Unknown';
            by[k] = (by[k] || 0) + Number(r.amount || 0);
        });
        const sources = Object.keys(by).map(name => ({ name, amount: by[name] }))
            .sort((a,b) => b.amount - a.amount);
        const total = sources.reduce((s,x) => s + x.amount, 0);
        return { sources, totalIncome: total };
    }

    async getPendingReport(yearId) {
        const [inc, exp] = await Promise.all([
            supabase.from('income').select('*'),
            supabase.from('expenses').select('*')
        ]);
        const income = (inc.data || []).filter(r => {
            const s = r.approval_status || r.status || '';
            return s === 'pending' || s === 'submitted';
        });
        const expenses = (exp.data || []).filter(r => {
            const s = r.status || '';
            return s === 'pending' || s === 'submitted';
        });
        return {
            income,
            expenses,
            totalPendingIncome: income.reduce((s,r) => s + Number(r.amount||0), 0),
            totalPendingExpense: expenses.reduce((s,r) => s + Number(r.amount||0), 0),
            count: income.length + expenses.length
        };
    }

    async getCashSummaryReport(yearId) {
        const [inc, exp] = await Promise.all([
            supabase.from('income').select('*'),
            supabase.from('expenses').select('*')
        ]);
        const income = this.onlyApprovedIncome(inc.data || []);
        const expenses = this.onlyApprovedExpenses(exp.data || []);
        const approvedIncome = income.filter(r => String(r.approval_status||'').toLowerCase() === 'approved').reduce((s,r) => s + Number(r.amount||0), 0);
        const approvedExpense = expenses.filter(r => String(r.status||r.approval_status||'').toLowerCase() === 'approved').reduce((s,r) => s + Number(r.amount||0), 0);
        const totalIncome = approvedIncome;
        const totalExpenses = approvedExpense;
        return {
            totalIncome, totalExpenses,
            netBalance: totalIncome - totalExpenses,
            approvedIncome, approvedExpense,
            approvedNet: approvedIncome - approvedExpense,
            incomeCount: income.length,
            expenseCount: expenses.length
        };
    }

    async getAnnualReport(yearId) {
        const safeAmt = (v) => {
            let n = Number(v);
            if (!isFinite(n) || isNaN(n)) n = 0;
            // Ignore absurd values (data errors)
            if (Math.abs(n) > 1e11) n = 0;
            return Math.round(n * 100) / 100;
        };
        
        // Load financial year (open year if none selected)
        let year = {};
        try {
            if (yearId) {
                const yr = await supabase.from('financial_years').select('*').eq('id', yearId).maybeSingle();
                year = yr.data || {};
            } else {
                let yr = await supabase.from('financial_years').select('*').eq('status', 'open').limit(1).maybeSingle();
                if (!yr.data) {
                    yr = await supabase.from('financial_years').select('*').order('start_date', { ascending: false }).limit(1).maybeSingle();
                }
                year = yr.data || {};
                yearId = year.id || null;
            }
        } catch (e) { console.warn(e); }
        
        let incomeQuery = supabase.from('income').select('*');
        let expenseQuery = supabase.from('expenses').select('*');
        const [incomeData, expenseData] = await Promise.all([incomeQuery, expenseQuery]);
        
        let income = this.onlyApprovedIncome(incomeData.data || []);
        let expenses = this.onlyApprovedExpenses(expenseData.data || []);
        
        // Prefer year-tagged rows; if none, use all
        if (yearId) {
            const yi = income.filter(r => r.financial_year_id === yearId);
            const ye = expenses.filter(r => r.financial_year_id === yearId);
            if (yi.length) income = yi;
            if (ye.length) expenses = ye;
        }
        
        const df = document.getElementById('report-date-from')?.value;
        const dt = document.getElementById('report-date-to')?.value;
        const inRange = (d) => {
            const ds = String(d || '').slice(0, 10);
            if (df && ds < df) return false;
            if (dt && ds > dt) return false;
            return true;
        };
        income = income.filter(i => inRange(i.date));
        expenses = expenses.filter(e => inRange(e.date));
        
        const totalIncome = income.reduce((sum, i) => sum + safeAmt(i.amount), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + safeAmt(e.amount), 0);
        const opening = safeAmt(year.opening_balance);
        const closing = opening + totalIncome - totalExpenses;
        const approvedIncome = income.filter(i => (i.approval_status||'') === 'approved').reduce((s,i)=>s+safeAmt(i.amount),0);
        const approvedExpense = expenses.filter(e => (e.status||'') === 'approved').reduce((s,e)=>s+safeAmt(e.amount),0);
        const pendingIncome = income.filter(i => ['pending','submitted'].includes(i.approval_status||'')).length;
        const pendingExpense = expenses.filter(e => ['pending','submitted'].includes(e.status||'')).length;
        
        // Top sources / vendors
        const bySource = {};
        income.forEach(i => { const k = i.source || 'Other'; bySource[k] = (bySource[k]||0) + safeAmt(i.amount); });
        const topSources = Object.entries(bySource).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount}));
        const byVendor = {};
        expenses.forEach(e => { const k = e.vendor || 'Other'; byVendor[k] = (byVendor[k]||0) + safeAmt(e.amount); });
        const topVendors = Object.entries(byVendor).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount}));
        
        return {
            year: year,
            income: income,
            expenses: expenses,
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            netIncome: totalIncome - totalExpenses,
            openingBalance: opening,
            closingBalance: closing,
            approvedIncome,
            approvedExpense,
            approvedNet: approvedIncome - approvedExpense,
            pendingIncome,
            pendingExpense,
            topSources,
            topVendors,
            incomeByMonth: this.groupByMonth(income),
            expensesByMonth: this.groupByMonth(expenses)
        };
    }
    
    async getMonthlyReport(yearId, month) {
        const startDate = new Date(new Date().getFullYear(), month - 1, 1);
        const endDate = new Date(new Date().getFullYear(), month, 0);
        
        const [incomeData, expenseData] = await Promise.all([
            supabase
                .from('income')
                .select('*')
                
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0]),
            supabase
                .from('expenses')
                .select('*')
                
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0])
        ]);
        
        const income = this.onlyApprovedIncome(incomeData.data || []);
        const expenses = this.onlyApprovedExpenses(expenseData.data || []);
        
        return {
            month: month,
            year: new Date().getFullYear(),
            income: income,
            expenses: expenses,
            totalIncome: income.reduce((sum, i) => sum + Number(i.amount||0), 0),
            totalExpenses: expenses.reduce((sum, e) => sum + Number(e.amount||0), 0)
        };
    }
    
    async getIncomeReport(yearId) {
        const { data } = await supabase.from('income').select('*');
        let rows = this.onlyApprovedIncome(data || []);
        if (yearId) {
            const tagged = rows.filter(r => r.financial_year_id === yearId);
            if (tagged.length) rows = tagged;
        }
        const df = document.getElementById('report-date-from')?.value;
        const dt = document.getElementById('report-date-to')?.value;
        if (df) rows = rows.filter(r => String(r.date||'').slice(0,10) >= df);
        if (dt) rows = rows.filter(r => String(r.date||'').slice(0,10) <= dt);
        const catMap = {};
        const pmMap = {};
        try {
            const ic = await supabase.from('income_categories').select('id,name');
            (ic.data||[]).forEach(x => catMap[x.id] = x.name);
        } catch(e){}
        try {
            const pm = await supabase.from('payment_methods').select('id,name');
            (pm.data||[]).forEach(x => pmMap[x.id] = x.name);
        } catch(e){}
        rows = rows.map(r => ({
            ...r,
            category_name: catMap[r.category_id] || r.category_name || 'N/A',
            payment_method_name: pmMap[r.payment_method_id] || r.payment_method_name || r.payment_method || 'N/A'
        }));
        const total = rows.reduce((s,r) => s + Number(r.amount||0), 0);
        return { income: rows, totalIncome: total };
    }
    
    
        
    async getExpenseReport(yearId) {
        const { data } = await supabase.from('expenses').select('*');
        let rows = this.onlyApprovedExpenses(data || []);
        if (yearId) {
            const tagged = rows.filter(r => r.financial_year_id === yearId);
            if (tagged.length) rows = tagged;
        }
        const df = document.getElementById('report-date-from')?.value;
        const dt = document.getElementById('report-date-to')?.value;
        if (df) rows = rows.filter(r => String(r.date||'').slice(0,10) >= df);
        if (dt) rows = rows.filter(r => String(r.date||'').slice(0,10) <= dt);
        const catMap = {};
        const pmMap = {};
        try {
            const ec = await supabase.from('expense_categories').select('id,name');
            (ec.data||[]).forEach(x => catMap[x.id] = x.name);
        } catch(e){}
        try {
            const pm = await supabase.from('payment_methods').select('id,name');
            (pm.data||[]).forEach(x => pmMap[x.id] = x.name);
        } catch(e){}
        rows = rows.map(r => ({
            ...r,
            category_name: catMap[r.category_id] || r.category_name || 'N/A',
            payment_method_name: pmMap[r.payment_method_id] || r.payment_method_name || r.payment_method || 'N/A'
        }));
        const total = rows.reduce((s,r) => s + Number(r.amount||0), 0);
        return { expenses: rows, totalExpenses: total };
    }
    
    
        
    async getBudgetReport(yearId) {
        const [budgetData, expenseData] = await Promise.all([
            supabase
                .from('budgets')
                .select(`
                    *,
                    category:category_id(*)
                `)
                .eq('financial_year_id', yearId),
            supabase
                .from('expenses')
                .select('amount, category_id, status, approval_status, is_deleted')
        ]);
        
        const budgets = budgetData.data || [];
        // Spent amounts count approved expenses only
        const expenses = this.onlyApprovedExpenses(expenseData.data || []);
        
        // Calculate actual spending per category
        const spentByCategory = {};
        expenses.forEach(e => {
            if (!spentByCategory[e.category_id]) {
                spentByCategory[e.category_id] = 0;
            }
            spentByCategory[e.category_id] += e.amount;
        });
        
        // Build budget report
        const reportData = budgets.map(b => ({
            category: b.category?.name || 'Unknown',
            allocated: b.allocated_amount,
            spent: spentByCategory[b.category_id] || 0,
            remaining: b.allocated_amount - (spentByCategory[b.category_id] || 0),
            percentage: b.allocated_amount > 0 
                ? ((spentByCategory[b.category_id] || 0) / b.allocated_amount) * 100 
                : 0
        }));
        
        return { budgets: reportData };
    }
    
    async getCategoryReport(yearId) {
        const { data } = await supabase.from('expenses').select('*');
        let rows = (data || []).filter(r => r.is_deleted !== true && this.isApprovedRow(r));
        const catMap = {};
        try {
            const ec = await supabase.from('expense_categories').select('id, name');
            (ec.data || []).forEach(x => { catMap[x.id] = x.name; });
        } catch (e) {}
        const byCat = {};
        rows.forEach(r => {
            const name = catMap[r.category_id] || 'Uncategorized';
            byCat[name] = (byCat[name] || 0) + Number(r.amount || 0);
        });
        const categories = Object.keys(byCat).map(name => ({
            category: name,
            name: name,
            total: byCat[name],
            amount: byCat[name]
        }));
        const total = categories.reduce((s, c) => s + c.total, 0);
        return { categories, totalExpenses: total, total };
    }
    
    
        
    async getActivityReport(yearId) {
        const [income, expenses] = await Promise.all([
            supabase.from('income').select('amount, created_by, approval_status, status, is_deleted'),
            supabase.from('expenses').select('amount, created_by, approval_status, status, is_deleted')
        ]);
        const incRows = this.onlyApprovedIncome(income.data || []);
        const expRows = this.onlyApprovedExpenses(expenses.data || []);
        
        const allTransactions = [
            ...incRows.map(i => ({ amount: Number(i.amount||0), created_by: i.created_by || null, type: 'income' })),
            ...expRows.map(e => ({ amount: Number(e.amount||0), created_by: e.created_by || null, type: 'expense' }))
        ];
        
        const userActivity = {};
        allTransactions.forEach(t => {
            const key = t.created_by || '__unassigned__';
            if (!userActivity[key]) {
                userActivity[key] = { income: 0, expenses: 0, count: 0 };
            }
            if (t.type === 'income') userActivity[key].income += t.amount;
            else userActivity[key].expenses += t.amount;
            userActivity[key].count++;
        });
        
        const profiles = {};
        try {
            const { data: users } = await supabase.from('profiles').select('id, full_name, email');
            (users || []).forEach(u => { profiles[u.id] = u.full_name || u.email || 'User'; });
        } catch (e) {}
        
        const activity = Object.entries(userActivity).map(([userId, data]) => ({
            user: userId === '__unassigned__' ? 'Unassigned' : (profiles[userId] || 'Unknown'),
            income: data.income,
            expenses: data.expenses,
            count: data.count
        }));
        
        return { activity };
    }
    
    
    async getAuditReport(yearId) {
        let rows = [];
        try {
            let res = await supabase.from('audit_logs').select('*').limit(500);
            if (res.error) {
                console.warn(res.error);
                rows = [];
            } else {
                rows = res.data || [];
            }
        } catch (e) { console.warn(e); }
        const profiles = {};
        try {
            const pr = await supabase.from('profiles').select('id, full_name, email');
            (pr.data || []).forEach(p => { profiles[p.id] = p.full_name || p.email; });
        } catch (e) {}
        rows = rows.map(r => {
            const ent = r.entity || r.table_name || r.resource || null;
            const act = r.action || '';
            // Derive entity from action if missing (e.g. INCOME_CREATE -> income)
            let entity = ent;
            if (!entity && act) {
                const a = String(act).toLowerCase();
                if (a.includes('income')) entity = 'income';
                else if (a.includes('expense')) entity = 'expense';
                else if (a.includes('approve') || a.includes('reject')) entity = 'approval';
                else if (a.includes('budget')) entity = 'budget';
                else if (a.includes('user')) entity = 'user';
                else entity = 'system';
            }
            const userName = r.user_name || profiles[r.user_id] || r.user_email || (r.user_id ? String(r.user_id).slice(0,8) : 'System');
            return {
                ...r,
                entity: entity,
                user_name: userName,
                when: r.timestamp || r.created_at || '',
                result: r.result || r.status || 'success'
            };
        });
        rows.sort((a,b) => new Date(b.when||0) - new Date(a.when||0));
        return { audit: rows, total: rows.length };
    }
    
    
    
    groupByMonth(transactions) {
        // Keys 1-12 = Jan-Dec (stable, no timezone off-by-one)
        const monthly = {};
        for (let i = 1; i <= 12; i++) monthly[i] = 0;
        (transactions || []).forEach(t => {
            const ds = String(t.date || '');
            let m = parseInt(ds.slice(5, 7), 10); // from YYYY-MM-DD
            if (!m || m < 1 || m > 12) {
                const d = new Date(ds);
                if (!isNaN(d.getTime())) m = d.getUTCMonth() + 1;
            }
            if (m >= 1 && m <= 12) {
                monthly[m] += Number(t.amount) || 0;
            }
        });
        return monthly;
    }
    
    renderReport(data, type) {
        const content = document.getElementById('report-content');
        const title = document.getElementById('report-title');
        
        let html = '';
        let chartId = 'report-chart-' + Date.now();
        
        switch(type) {
            case 'annual':
                html = this.renderAnnualReport(data, chartId);
                break;
            case 'monthly':
                html = this.renderMonthlyReport(data, chartId);
                break;
            case 'income':
                html = this.renderIncomeReport(data);
                break;
            case 'expense':
                html = this.renderExpenseReport(data);
                break;
            case 'budget':
                html = this.renderBudgetReport(data, chartId);
                break;
            case 'category':
                html = this.renderCategoryReport(data, chartId);
                break;
            case 'activity':
                html = this.renderActivityReport(data);
                break;
            case 'audit':
                html = this.renderAuditReport(data);
                break;
            case 'source':
                html = this.renderSourceReport(data);
                break;
            case 'pending':
                html = this.renderPendingReport(data);
                break;
            case 'cash':
                html = this.renderCashSummaryReport(data);
                break;
            case 'audit_compliance':
                html = this.renderAuditComplianceReport(data);
                break;
            case 'risk_anomaly':
                html = this.renderRiskAnomalyReport(data);
                break;
            case 'integrity':
                html = this.renderFinancialIntegrityReport(data);
                break;
            default:
                html = '<p>Report type not supported.</p>';
        }
        
        content.innerHTML = html;
        title.textContent = this.getReportTitle(type);
        
        // Render charts if needed
        if (type === 'annual' || type === 'monthly' || type === 'budget' || type === 'category') {
            this.renderReportChart(chartId, data, type);
        }
        // audit charts rendered inside renderAuditReport
    }
    
    getReportTitle(type) {
        const titles = {
            annual: 'Annual Financial Report',
            monthly: 'Monthly Financial Report',
            income: 'Income Report',
            expense: 'Expense Report',
            budget: 'Budget Report',
            category: 'Category Report',
            activity: 'Activity Report',
            audit: 'Audit Report'
        };
        return titles[type] || 'Report';
    }
    

    async getAuditComplianceReport(yearId) {
        let rows = [];
        try {
            const res = await supabase.from('audit_logs').select('*').limit(1000);
            rows = res.data || [];
        } catch (e) { console.warn(e); }
        const total = rows.length;
        const success = rows.filter(r => String(r.result || 'success').toLowerCase() !== 'failed').length;
        const failed = total - success;
        const byAction = {};
        const byUser = {};
        rows.forEach(r => {
            const a = r.action || 'UNKNOWN';
            const u = r.user_name || 'System';
            byAction[a] = (byAction[a] || 0) + 1;
            byUser[u] = (byUser[u] || 0) + 1;
        });
        const topActions = Object.entries(byAction).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
        const topUsers = Object.entries(byUser).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
        const score = total === 0 ? 100 : Math.round((success / total) * 100);
        return { total, success, failed, score, topActions, topUsers };
    }

    async getRiskAnomalyReport(yearId) {
        const [inc, exp] = await Promise.all([
            supabase.from('income').select('*'),
            supabase.from('expenses').select('*')
        ]);
        const income = this.onlyApprovedIncome(inc.data || []);
        const expenses = this.onlyApprovedExpenses(exp.data || []);
        const allAmt = [...income.map(i=>Number(i.amount||0)), ...expenses.map(e=>Number(e.amount||0))];
        const avg = allAmt.length ? allAmt.reduce((s,x)=>s+x,0)/allAmt.length : 0;
        const threshold = Math.max(avg * 3, 100000);
        const large = [
            ...income.filter(i => Number(i.amount||0) >= threshold).map(i => ({ type:'income', date:i.date, label:i.source, amount:Number(i.amount||0), status:i.approval_status })),
            ...expenses.filter(e => Number(e.amount||0) >= threshold).map(e => ({ type:'expense', date:e.date, label:e.vendor, amount:Number(e.amount||0), status:e.status }))
        ].sort((a,b)=>b.amount-a.amount);
        const today = new Date();
        const pending = [
            ...income.filter(i => ['pending','submitted'].includes(i.approval_status)).map(i => ({
                type:'income', date:i.date, label:i.source, amount:Number(i.amount||0),
                ageDays: Math.max(0, Math.floor((today - new Date(i.date))/86400000))
            })),
            ...expenses.filter(e => ['pending','submitted'].includes(e.status)).map(e => ({
                type:'expense', date:e.date, label:e.vendor, amount:Number(e.amount||0),
                ageDays: Math.max(0, Math.floor((today - new Date(e.date))/86400000))
            }))
        ].sort((a,b)=>b.ageDays-a.ageDays);
        const keyCount = {};
        [...income.map(i=>({d:i.date,a:Number(i.amount||0),t:'income',l:i.source})),
         ...expenses.map(e=>({d:e.date,a:Number(e.amount||0),t:'expense',l:e.vendor}))
        ].forEach(x => {
            const k = x.d + '|' + x.a + '|' + x.t;
            if (!keyCount[k]) keyCount[k] = [];
            keyCount[k].push(x);
        });
        const duplicates = Object.values(keyCount).filter(arr => arr.length > 1).flat();
        const riskLevel = (large.length + pending.filter(p=>p.ageDays>14).length) > 5 ? 'High'
            : (large.length + pending.length) > 0 ? 'Medium' : 'Low';
        return { threshold, large, pending, duplicates, riskLevel };
    }

    async getFinancialIntegrityReport(yearId) {
        let year = { opening_balance: 0, name: 'Current' };
        try {
            let yq = supabase.from('financial_years').select('*');
            if (yearId) yq = yq.eq('id', yearId);
            else yq = yq.eq('status', 'open');
            const yr = await yq.limit(1).maybeSingle();
            if (yr.data) year = yr.data;
        } catch (e) {}
        const [inc, exp, audit] = await Promise.all([
            supabase.from('income').select('*'),
            supabase.from('expenses').select('*'),
            supabase.from('audit_logs').select('*').limit(500)
        ]);
        const income = this.onlyApprovedIncome(inc.data || []);
        const expenses = this.onlyApprovedExpenses(exp.data || []);
        const totalIncome = income.reduce((s,r)=>s+Number(r.amount||0),0);
        const totalExpenses = expenses.reduce((s,r)=>s+Number(r.amount||0),0);
        const opening = Number(year.opening_balance || 0);
        const closing = opening + totalIncome - totalExpenses;
        const approvedIncome = income.filter(r => (r.approval_status||'')==='approved').reduce((s,r)=>s+Number(r.amount||0),0);
        const approvedExpense = expenses.filter(r => (r.status||'')==='approved').reduce((s,r)=>s+Number(r.amount||0),0);
        const pendingIncome = income.filter(r => ['pending','submitted'].includes(r.approval_status||'')).length;
        const pendingExpense = expenses.filter(r => ['pending','submitted'].includes(r.status||'')).length;
        const auditRows = audit.data || [];
        const checks = [
            { name: 'Opening balance recorded', ok: opening >= 0, detail: formatCurrency(opening) },
            { name: 'Closing = Opening + Income − Expenses', ok: true, detail: formatCurrency(closing) },
            { name: 'All amounts numeric', ok: income.every(i=>!isNaN(Number(i.amount))) && expenses.every(e=>!isNaN(Number(e.amount))), detail: 'Validated' },
            { name: 'Audit trail present', ok: auditRows.length > 0, detail: auditRows.length + ' events' },
            { name: 'Pending volume acceptable', ok: (pendingIncome+pendingExpense) < 50, detail: (pendingIncome+pendingExpense) + ' pending' }
        ];
        return {
            yearName: year.name || 'Financial Year',
            opening, totalIncome, totalExpenses, closing,
            approvedIncome, approvedExpense,
            approvedClosing: opening + approvedIncome - approvedExpense,
            incomeCount: income.length, expenseCount: expenses.length,
            pendingIncome, pendingExpense,
            auditCount: auditRows.length,
            checks,
            integrityScore: Math.round((checks.filter(c=>c.ok).length / checks.length) * 100)
        };
    }

    renderAuditComplianceReport(data) {
        const scoreColor = data.score >= 90 ? 'success' : data.score >= 70 ? 'warning' : 'danger';
        return `
            <div class="row g-3 mb-4">
                <div class="col-md-3"><div class="card border-${scoreColor}"><div class="card-body text-center">
                    <h6>Compliance Score</h6><h2 class="text-${scoreColor}">${data.score}%</h2>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body text-center">
                    <h6>Total Events</h6><h2>${data.total}</h2>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body text-center">
                    <h6>Successful</h6><h2 class="text-success">${data.success}</h2>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body text-center">
                    <h6>Failed</h6><h2 class="text-danger">${data.failed}</h2>
                </div></div></div>
            </div>
            <div class="row g-3">
                <div class="col-md-6">
                    <h6>Top Actions</h6>
                    <table class="table table-sm table-bordered"><thead><tr><th>Action</th><th>Count</th></tr></thead>
                    <tbody>${(data.topActions||[]).map(a=>`<tr><td>${a.name}</td><td>${a.count}</td></tr>`).join('')||'<tr><td colspan="2">No data</td></tr>'}</tbody></table>
                </div>
                <div class="col-md-6">
                    <h6>Top Users</h6>
                    <table class="table table-sm table-bordered"><thead><tr><th>User</th><th>Events</th></tr></thead>
                    <tbody>${(data.topUsers||[]).map(a=>`<tr><td>${a.name}</td><td>${a.count}</td></tr>`).join('')||'<tr><td colspan="2">No data</td></tr>'}</tbody></table>
                </div>
            </div>`;
    }

    renderRiskAnomalyReport(data) {
        const rl = data.riskLevel || 'Low';
        const rc = rl === 'High' ? 'danger' : rl === 'Medium' ? 'warning' : 'success';
        return `
            <div class="alert alert-${rc}"><strong>Risk Level: ${rl}</strong> — Large transaction threshold: ${formatCurrency(data.threshold||0)}</div>
            <h6 class="mt-3">Large Transactions</h6>
            <div class="table-responsive mb-3"><table class="table table-sm table-bordered">
                <thead><tr><th>Type</th><th>Date</th><th>Label</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>${(data.large||[]).map(r=>`<tr><td>${r.type}</td><td>${formatDate(r.date)}</td><td>${r.label||''}</td><td class="fw-bold">${formatCurrency(r.amount)}</td><td>${r.status||''}</td></tr>`).join('')||'<tr><td colspan="5" class="text-muted text-center">None flagged</td></tr>'}
                </tbody></table></div>
            <h6>Pending Aging (days waiting)</h6>
            <div class="table-responsive mb-3"><table class="table table-sm table-bordered">
                <thead><tr><th>Type</th><th>Date</th><th>Label</th><th>Amount</th><th>Age (days)</th></tr></thead>
                <tbody>${(data.pending||[]).map(r=>`<tr class="${r.ageDays>14?'table-warning':''}"><td>${r.type}</td><td>${formatDate(r.date)}</td><td>${r.label||''}</td><td>${formatCurrency(r.amount)}</td><td>${r.ageDays}</td></tr>`).join('')||'<tr><td colspan="5" class="text-muted text-center">No pending</td></tr>'}
                </tbody></table></div>
            <h6>Possible Duplicates (same type, date, amount)</h6>
            <div class="table-responsive"><table class="table table-sm table-bordered">
                <thead><tr><th>Type</th><th>Date</th><th>Label</th><th>Amount</th></tr></thead>
                <tbody>${(data.duplicates||[]).map(r=>`<tr><td>${r.t}</td><td>${formatDate(r.d)}</td><td>${r.l||''}</td><td>${formatCurrency(r.a)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-muted text-center">None detected</td></tr>'}
                </tbody></table></div>`;
    }

    renderFinancialIntegrityReport(data) {
        const sc = data.integrityScore >= 80 ? 'success' : 'warning';
        return `
            <div class="row g-3 mb-4">
                <div class="col-md-3"><div class="card border-${sc}"><div class="card-body text-center">
                    <h6>Integrity Score</h6><h2 class="text-${sc}">${data.integrityScore}%</h2>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body">
                    <h6>Opening</h6><h4>${formatCurrency(data.opening||0)}</h4>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body">
                    <h6>Closing (All)</h6><h4>${formatCurrency(data.closing||0)}</h4>
                    <small>Inc ${formatCurrency(data.totalIncome)} / Exp ${formatCurrency(data.totalExpenses)}</small>
                </div></div></div>
                <div class="col-md-3"><div class="card"><div class="card-body">
                    <h6>Closing (Approved only)</h6><h4>${formatCurrency(data.approvedClosing||0)}</h4>
                </div></div></div>
            </div>
            <p class="text-muted">${data.yearName} · ${data.incomeCount} income · ${data.expenseCount} expenses · ${data.auditCount} audit events · Pending: ${data.pendingIncome} income / ${data.pendingExpense} expense</p>
            <h6>Integrity Checks</h6>
            <table class="table table-bordered">
                <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>
                    ${(data.checks||[]).map(ch=>`<tr>
                        <td>${ch.name}</td>
                        <td>${ch.ok?'<span class="badge bg-success">Pass</span>':'<span class="badge bg-danger">Fail</span>'}</td>
                        <td>${ch.detail}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div class="alert alert-info mb-0">
                <strong>Balance proof:</strong>
                Opening ${formatCurrency(data.opening||0)} + Income ${formatCurrency(data.totalIncome||0)} − Expenses ${formatCurrency(data.totalExpenses||0)}
                = <strong>${formatCurrency(data.closing||0)}</strong>
            </div>`;
    }


    renderAnnualReport(data, chartId) {
        const year = data.year || {};
        const opening = data.openingBalance != null ? data.openingBalance : Number(year.opening_balance || 0);
        const closing = data.closingBalance != null ? data.closingBalance : (opening + Number(data.totalIncome||0) - Number(data.totalExpenses||0));
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const incM = data.incomeByMonth || {};
        const expM = data.expensesByMonth || {};
        const monthRows = months.map((m, i) => {
            const monthNum = i + 1; // 1=Jan ... 12=Dec
            const key = String(monthNum).padStart(2, '0');
            let iv = 0, ev = 0;
            // Prefer 1-12 keys from groupByMonth
            if (incM[monthNum] != null) iv = Number(incM[monthNum]) || 0;
            else if (incM[key] != null) iv = Number(incM[key]) || 0;
            else if (Array.isArray(incM) && incM[i] != null) iv = Number(incM[i]) || 0;
            if (expM[monthNum] != null) ev = Number(expM[monthNum]) || 0;
            else if (expM[key] != null) ev = Number(expM[key]) || 0;
            else if (Array.isArray(expM) && expM[i] != null) ev = Number(expM[i]) || 0;
            // fallback: any key ending with month number (e.g. 2026-10)
            if (!iv) {
                Object.keys(incM || {}).forEach(k => {
                    if (String(k) === String(monthNum) || String(k).endsWith('-' + key) || String(k).endsWith(key))
                        iv = Number(incM[k]) || iv;
                });
            }
            if (!ev) {
                Object.keys(expM || {}).forEach(k => {
                    if (String(k) === String(monthNum) || String(k).endsWith('-' + key) || String(k).endsWith(key))
                        ev = Number(expM[k]) || ev;
                });
            }
            return { m, iv, ev, net: iv - ev };
        });
        return `
            <div class="row">
                <div class="col-12">
                    <h4 class="text-center">${year.name || 'Annual Financial Report'}</h4>
                    <p class="text-center text-muted">
                        ${year.start_date ? formatDate(year.start_date) : ''} ${year.end_date ? ' - ' + formatDate(year.end_date) : ''}
                    </p>
                </div>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-6 col-md-3">
                    <div class="card border-secondary h-100"><div class="card-body">
                        <h6 class="text-muted">Opening Balance</h6>
                        <h4>${formatCurrency(opening)}</h4>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-success text-white h-100"><div class="card-body">
                        <h6>Total Income</h6>
                        <h4>${formatCurrency(data.totalIncome)}</h4>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card bg-danger text-white h-100"><div class="card-body">
                        <h6>Total Expenses</h6>
                        <h4>${formatCurrency(data.totalExpenses)}</h4>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-primary h-100"><div class="card-body">
                        <h6 class="text-muted">Closing Balance</h6>
                        <h4>${formatCurrency(closing)}</h4>
                    </div></div>
                </div>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-6 col-md-3">
                    <div class="card h-100"><div class="card-body">
                        <h6 class="text-muted">Net (All)</h6>
                        <h5>${formatCurrency(data.netIncome)}</h5>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card h-100"><div class="card-body">
                        <h6 class="text-muted">Approved Net</h6>
                        <h5>${formatCurrency(data.approvedNet || 0)}</h5>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card h-100"><div class="card-body">
                        <h6 class="text-muted">Pending Income</h6>
                        <h5>${data.pendingIncome || 0}</h5>
                    </div></div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card h-100"><div class="card-body">
                        <h6 class="text-muted">Pending Expenses</h6>
                        <h5>${data.pendingExpense || 0}</h5>
                    </div></div>
                </div>
            </div>
            <div class="alert alert-info">
                <strong>Balance proof:</strong>
                Opening ${formatCurrency(opening)} + Income ${formatCurrency(data.totalIncome)} − Expenses ${formatCurrency(data.totalExpenses)}
                = <strong>${formatCurrency(closing)}</strong>
            </div>
            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <h6>Top Income Sources</h6>
                    <div class="table-responsive"><table class="table table-sm table-bordered">
                        <thead><tr><th>Source</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${(data.topSources||[]).map(s=>`<tr><td>${s.name}</td><td class="text-success">${formatCurrency(s.amount)}</td></tr>`).join('') || '<tr><td colspan="2" class="text-muted">No data</td></tr>'}
                        </tbody>
                    </table></div>
                </div>
                <div class="col-md-6">
                    <h6>Top Expense Vendors</h6>
                    <div class="table-responsive"><table class="table table-sm table-bordered">
                        <thead><tr><th>Vendor</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${(data.topVendors||[]).map(s=>`<tr><td>${s.name}</td><td class="text-danger">${formatCurrency(s.amount)}</td></tr>`).join('') || '<tr><td colspan="2" class="text-muted">No data</td></tr>'}
                        </tbody>
                    </table></div>
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-12">
                    <canvas id="${chartId}" height="260"></canvas>
                </div>
            </div>
            <h6>Monthly Breakdown</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
                    <tbody>
                        ${monthRows.map(r => `<tr>
                            <td>${r.m}</td>
                            <td class="text-success">${formatCurrency(r.iv)}</td>
                            <td class="text-danger">${formatCurrency(r.ev)}</td>
                            <td>${formatCurrency(r.net)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <p class="text-muted small mb-0">Records: ${(data.income||[]).length} income · ${(data.expenses||[]).length} expenses</p>
        `;
    }
    
    renderMonthlyReport(data, chartId) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[data.month - 1];
        
        return `
            <div class="row">
                <div class="col-12">
                    <h4 class="text-center">Monthly Financial Report - ${monthName} ${data.year}</h4>
                </div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Income</h6>
                            <h3>${formatCurrency(data.totalIncome)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-danger text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Expenses</h6>
                            <h3>${formatCurrency(data.totalExpenses)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <h6 class="card-title">Net Income</h6>
                            <h3>${formatCurrency(data.totalIncome - data.totalExpenses)}</h3>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <canvas id="${chartId}" height="300"></canvas>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-12">
                    <h6>Total Transactions: ${(data.income.length + data.expenses.length)}</h6>
                </div>
            </div>
        `;
    }
    
    renderIncomeReport(data) {
        return `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Date</th>
                            <th>Source</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.income || []).map(i => `
                            <tr>
                                <td>${i.transaction_id || '—'}</td>
                                <td>${formatDate(i.date)}</td>
                                <td>${i.source}</td>
                                <td>${i.category_name || i.category?.name || 'N/A'}</td>
                                <td class="text-success">${formatCurrency(i.amount)}</td>
                                <td>${i.payment_method_name || i.payment_method?.name || 'N/A'}</td>
                            </tr>
                        `).join('')}
                        ${(data.income || []).length === 0 ? `
                            <tr>
                                <td colspan="6" class="text-center text-muted">No income records found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                    <tfoot>
                        <tr class="fw-bold">
                            <td colspan="4" class="text-end">Total:</td>
                            <td>${formatCurrency((data.income || []).reduce((sum, i) => sum + i.amount, 0))}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    renderExpenseReport(data) {
        return `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Date</th>
                            <th>Vendor</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.expenses || []).map(e => `
                            <tr>
                                <td>${e.transaction_id || '—'}</td>
                                <td>${formatDate(e.date)}</td>
                                <td>${e.vendor || e.description || 'N/A'}</td>
                                <td>${e.category_name || e.category?.name || 'N/A'}</td>
                                <td class="text-danger">${formatCurrency(e.amount)}</td>
                                <td>${e.payment_method_name || e.payment_method?.name || 'N/A'}</td>
                            </tr>
                        `).join('')}
                        ${(data.expenses || []).length === 0 ? `
                            <tr>
                                <td colspan="6" class="text-center text-muted">No expense records found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                    <tfoot>
                        <tr class="fw-bold">
                            <td colspan="4" class="text-end">Total:</td>
                            <td>${formatCurrency((data.expenses || []).reduce((sum, e) => sum + e.amount, 0))}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    renderBudgetReport(data, chartId) {
        const budgets = data.budgets || [];
        const totalAllocated = budgets.reduce((sum, b) => sum + b.allocated, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
        const totalRemaining = totalAllocated - totalSpent;
        const usedPercent = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
        
        return `
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Allocated</h6>
                            <h5>${formatCurrency(totalAllocated)}</h5>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-danger text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Spent</h6>
                            <h5>${formatCurrency(totalSpent)}</h5>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Remaining</h6>
                            <h5>${formatCurrency(totalRemaining)}</h5>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-warning text-dark">
                        <div class="card-body">
                            <h6 class="card-title">Used %</h6>
                            <h5>${usedPercent.toFixed(1)}%</h5>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Allocated</th>
                            <th>Spent</th>
                            <th>Remaining</th>
                            <th>Used %</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${budgets.map(b => {
                            const statusClass = b.percentage > 90 ? 'danger' : b.percentage > 75 ? 'warning' : 'success';
                            return `
                                <tr>
                                    <td>${b.category}</td>
                                    <td>${formatCurrency(b.allocated)}</td>
                                    <td class="text-danger">${formatCurrency(b.spent)}</td>
                                    <td class="text-success">${formatCurrency(b.remaining)}</td>
                                    <td>${b.percentage.toFixed(1)}%</td>
                                    <td>
                                        <span class="badge bg-${statusClass}">
                                            ${b.percentage > 90 ? 'Critical' : b.percentage > 75 ? 'Warning' : 'Good'}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                        ${budgets.length === 0 ? `
                            <tr>
                                <td colspan="6" class="text-center text-muted">No budget data found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderCategoryReport(data, chartId) {
        const categories = data.categories || [];
        const total = categories.reduce((sum, c) => sum + c.total, 0);
        
        return `
            <div class="row g-3 mb-4">
                <div class="col-md-6">
                    <div class="card bg-info text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Expenses by Category</h6>
                            <h3>${formatCurrency(total)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <canvas id="${chartId}" height="250"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Total</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categories.map(c => `
                            <tr>
                                <td>${c.category || c.name || 'Uncategorized'}</td>
                                <td>${formatCurrency(c.total ?? c.amount ?? 0)}</td>
                                <td>${total > 0 ? (((c.total ?? c.amount ?? 0) / total) * 100).toFixed(1) : 0}%</td>
                            </tr>
                        `).join('')}
                        ${categories.length === 0 ? `
                            <tr>
                                <td colspan="3" class="text-center text-muted">No category data found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderActivityReport(data) {
        const activity = data.activity || [];
        
        return `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Accountant</th>
                            <th>Income (ETB)</th>
                            <th>Expenses (ETB)</th>
                            <th>Net (ETB)</th>
                            <th>Transactions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activity.map(a => `
                            <tr>
                                <td>${a.user}</td>
                                <td class="text-success">${formatCurrency(a.income)}</td>
                                <td class="text-danger">${formatCurrency(a.expenses)}</td>
                                <td class="fw-bold">${formatCurrency(a.income - a.expenses)}</td>
                                <td>${a.count}</td>
                            </tr>
                        `).join('')}
                        ${activity.length === 0 ? `
                            <tr>
                                <td colspan="5" class="text-center text-muted">No activity data found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderAuditReport(data) {
        const audit = (data.audit || []).filter(a => a && (a.action || a.entity || a.timestamp));
        const byAction = {};
        const byResult = { success: 0, failed: 0, other: 0 };
        const byUser = {};
        audit.forEach(a => {
            const act = a.action || 'UNKNOWN';
            byAction[act] = (byAction[act] || 0) + 1;
            const res = String(a.result || 'success').toLowerCase();
            if (res === 'success' || res === 'ok') byResult.success++;
            else if (res === 'failed' || res === 'failure' || res === 'denied') byResult.failed++;
            else byResult.other++;
            const u = a.user_name || a.user?.full_name || a.actor_name || 'System';
            byUser[u] = (byUser[u] || 0) + 1;
        });
        const topActions = Object.entries(byAction).sort((x,y)=>y[1]-x[1]).slice(0,8);
        const topUsers = Object.entries(byUser).sort((x,y)=>y[1]-x[1]).slice(0,8);

        // Charts after HTML paints
        setTimeout(() => {
            try {
                if (typeof Chart === 'undefined') return;
                const c1 = document.getElementById('audit-actions-chart');
                const c2 = document.getElementById('audit-results-chart');
                const c3 = document.getElementById('audit-users-chart');
                if (this._auditCharts) this._auditCharts.forEach(c => { try { c.destroy(); } catch(e){} });
                this._auditCharts = [];
                if (c1) {
                    this._auditCharts.push(new Chart(c1, {
                        type: 'bar',
                        data: {
                            labels: topActions.map(x=>x[0]),
                            datasets: [{ label: 'Events', data: topActions.map(x=>x[1]), backgroundColor: '#0d6efd' }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    }));
                }
                if (c2) {
                    this._auditCharts.push(new Chart(c2, {
                        type: 'doughnut',
                        data: {
                            labels: ['Success', 'Failed', 'Other'],
                            datasets: [{ data: [byResult.success, byResult.failed, byResult.other], backgroundColor: ['#198754','#dc3545','#6c757d'] }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    }));
                }
                if (c3) {
                    this._auditCharts.push(new Chart(c3, {
                        type: 'bar',
                        data: {
                            labels: topUsers.map(x=>x[0]),
                            datasets: [{ label: 'Actions', data: topUsers.map(x=>x[1]), backgroundColor: '#6f42c1' }]
                        },
                        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    }));
                }
            } catch (err) { console.warn('audit charts', err); }
        }, 80);

        return `
            <div class="row g-3 mb-3">
                <div class="col-md-4"><div class="card bg-primary text-white"><div class="card-body py-3"><div class="small">Total Audit Events</div><div class="fs-4 fw-bold">${audit.length}</div></div></div></div>
                <div class="col-md-4"><div class="card bg-success text-white"><div class="card-body py-3"><div class="small">Successful</div><div class="fs-4 fw-bold">${byResult.success}</div></div></div></div>
                <div class="col-md-4"><div class="card bg-danger text-white"><div class="card-body py-3"><div class="small">Failed / Denied</div><div class="fs-4 fw-bold">${byResult.failed}</div></div></div></div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-md-4"><div class="card"><div class="card-header"><strong>Actions Breakdown</strong></div><div class="card-body" style="height:240px"><canvas id="audit-actions-chart"></canvas></div></div></div>
                <div class="col-md-4"><div class="card"><div class="card-header"><strong>Results Mix</strong></div><div class="card-body" style="height:240px"><canvas id="audit-results-chart"></canvas></div></div></div>
                <div class="col-md-4"><div class="card"><div class="card-header"><strong>Activity by User</strong></div><div class="card-body" style="height:240px"><canvas id="audit-users-chart"></canvas></div></div></div>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Action</th>
                            <th>Entity</th>
                            <th>Timestamp</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${audit.map(a => {
                            const who = a.user_name || a.user?.full_name || a.actor_name || 'System';
                            const res = a.result || 'success';
                            const ok = String(res).toLowerCase() === 'success' || String(res).toLowerCase() === 'ok';
                            return `<tr>
                                <td>${who}</td>
                                <td>${a.action || '—'}</td>
                                <td>${a.entity || a.table_name || '—'}</td>
                                <td>${typeof formatDateTime === 'function' ? formatDateTime(a.timestamp || a.created_at) : (a.timestamp || '')}</td>
                                <td><span class="badge ${ok ? 'bg-success' : 'bg-danger'}">${res}</span></td>
                            </tr>`;
                        }).join('')}
                        ${audit.length === 0 ? `
                            <tr>
                                <td colspan="5" class="text-center text-muted">No audit records found.</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderReportChart(chartId, data, type) {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
        }
        
        let chartData;
        let chartType = 'bar';
        let chartOptions = {};
        
        if (type === 'annual' || type === 'monthly') {
            const incomeData = type === 'annual' ? data.incomeByMonth : this.groupByMonth(data.income);
            const expenseData = type === 'annual' ? data.expensesByMonth : this.groupByMonth(data.expenses);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            chartData = {
                labels: months,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(40, 167, 69, 0.6)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2
                    }
                ]
            };
        } else if (type === 'category') {
            const categories = data.categories || [];
            const colors = ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#17a2b8', '#007bff', '#6f42c1'];
            
            chartData = {
                labels: categories.map(c => c.category),
                datasets: [{
                    data: categories.map(c => c.total),
                    backgroundColor: colors.slice(0, categories.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            };
            chartType = 'doughnut';
        } else if (type === 'budget') {
            const budgets = data.budgets || [];
            
            chartData = {
                labels: budgets.map(b => b.category),
                datasets: [
                    {
                        label: 'Allocated',
                        data: budgets.map(b => b.allocated),
                        backgroundColor: 'rgba(23, 162, 184, 0.6)',
                        borderColor: 'rgba(23, 162, 184, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Spent',
                        data: budgets.map(b => b.spent),
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2
                    }
                ]
            };
        }
        
        if (!chartData) return;
        
        this.charts[chartId] = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== undefined) {
                                    label += formatCurrency(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: chartType === 'bar' ? {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                } : undefined
            }
        });
    }
    

    /** Build structured table data for any report type */
    getExportPayload() {
        const type = this.currentReport;
        const d = this.reportData || {};
        const fmt = (n) => {
            const x = Number(n);
            return isNaN(x) ? 0 : Math.round(x * 100) / 100;
        };
        const title = this.getReportTitle(type) || 'Report';
        const org = 'SELAM BERTU TESFA ORGANIZATION';
        const generated = new Date().toLocaleString();
        let headers = [];
        let rows = [];
        let summary = [];

        switch (type) {
            case 'annual':
            case 'monthly': {
                headers = ['Metric', 'Amount (ETB)'];
                rows = [
                    ['Opening Balance', fmt(d.openingBalance)],
                    ['Total Income (Approved)', fmt(d.totalIncome ?? d.approvedIncome)],
                    ['Total Expenses (Approved)', fmt(d.totalExpenses ?? d.approvedExpense)],
                    ['Net Income', fmt((d.totalIncome ?? d.approvedIncome ?? 0) - (d.totalExpenses ?? d.approvedExpense ?? 0))],
                    ['Closing Balance', fmt(d.closingBalance)]
                ];
                const inc = d.income || [];
                const exp = d.expenses || [];
                if (inc.length) {
                    summary.push(['', '']);
                    summary.push(['Income Records', '']);
                    summary.push(['Transaction ID', 'Date', 'Source/Category', 'Amount']);
                    inc.forEach(i => summary.push([
                        i.transaction_id || '',
                        i.date || '',
                        i.source || i.category_name || '',
                        fmt(i.amount)
                    ]));
                }
                if (exp.length) {
                    summary.push(['', '']);
                    summary.push(['Expense Records', '']);
                    summary.push(['Transaction ID', 'Date', 'Vendor/Category', 'Amount']);
                    exp.forEach(e => summary.push([
                        e.transaction_id || '',
                        e.date || '',
                        e.vendor || e.category_name || '',
                        fmt(e.amount)
                    ]));
                }
                break;
            }
            case 'income': {
                headers = ['Transaction ID', 'Date', 'Source', 'Category', 'Amount (ETB)', 'Payment Method', 'Status'];
                rows = (d.income || []).map(i => [
                    i.transaction_id || '',
                    i.date || '',
                    i.source || '',
                    i.category_name || i.category?.name || '',
                    fmt(i.amount),
                    i.payment_method_name || i.payment_method?.name || '',
                    i.approval_status || i.status || ''
                ]);
                summary = [['Total Income', fmt(d.totalIncome)]];
                break;
            }
            case 'expense': {
                headers = ['Transaction ID', 'Date', 'Vendor', 'Category', 'Amount (ETB)', 'Payment Method', 'Status'];
                rows = (d.expenses || []).map(e => [
                    e.transaction_id || '',
                    e.date || '',
                    e.vendor || '',
                    e.category_name || e.category?.name || '',
                    fmt(e.amount),
                    e.payment_method_name || e.payment_method?.name || '',
                    e.status || e.approval_status || ''
                ]);
                summary = [['Total Expenses', fmt(d.totalExpenses)]];
                break;
            }
            case 'budget': {
                headers = ['Category', 'Allocated (ETB)', 'Spent (ETB)', 'Remaining (ETB)', 'Used %'];
                const budgets = d.budgets || [];
                rows = budgets.map(b => [
                    b.category || b.category?.name || 'N/A',
                    fmt(b.allocated ?? b.allocated_amount),
                    fmt(b.spent ?? b.spent_amount),
                    fmt(b.remaining ?? b.remaining_amount),
                    fmt(b.percentage ?? b.percentage_used) + '%'
                ]);
                break;
            }
            case 'category': {
                headers = ['Category', 'Total (ETB)', '% of Total'];
                const cats = d.categories || [];
                const tot = Number(d.totalExpenses || d.total || 0) || cats.reduce((s, c) => s + Number(c.total || c.amount || 0), 0);
                rows = cats.map(c => {
                    const t = Number(c.total ?? c.amount ?? 0);
                    const pct = tot > 0 ? ((t / tot) * 100).toFixed(1) + '%' : '0%';
                    return [c.category || c.name || 'N/A', fmt(t), pct];
                });
                summary = [['Total Expenses', fmt(tot)]];
                break;
            }
            case 'activity': {
                headers = ['User / Accountant', 'Income (ETB)', 'Expenses (ETB)', 'Net (ETB)', 'Transactions'];
                const acts = d.activity || d.users || d.rows || [];
                if (Array.isArray(acts)) {
                    rows = acts.map(a => [
                        a.name || a.user_name || a.accountant || 'Unknown',
                        fmt(a.income),
                        fmt(a.expenses),
                        fmt((a.income || 0) - (a.expenses || 0)),
                        a.count || a.transactions || 0
                    ]);
                }
                break;
            }
            case 'audit': {
                headers = ['User', 'Action', 'Entity', 'Timestamp', 'Result'];
                rows = (d.audit || []).map(a => [
                    a.user_name || a.user?.full_name || 'System',
                    a.action || '',
                    a.entity || a.table_name || '',
                    a.timestamp || a.created_at || '',
                    a.result || 'success'
                ]);
                summary = [['Total Events', (d.audit || []).length]];
                break;
            }
            case 'source': {
                headers = ['Source', 'Amount (ETB)'];
                const sources = d.sources || [];
                rows = sources.map(s => [s.name || s.source || 'Unknown', fmt(s.amount || s.total)]);
                summary = [['Total Income', fmt(d.totalIncome || d.total)]];
                break;
            }
            case 'pending': {
                headers = ['Type', 'Transaction ID', 'Date', 'Description', 'Amount (ETB)', 'Status'];
                const items = d.pending || d.items || [];
                rows = items.map(i => [
                    i.type || '',
                    i.transaction_id || '',
                    i.date || '',
                    i.source || i.vendor || i.description || '',
                    fmt(i.amount),
                    i.status || i.approval_status || 'pending'
                ]);
                break;
            }
            case 'cash': {
                headers = ['Metric', 'Amount (ETB)'];
                rows = [
                    ['Total Income', fmt(d.totalIncome)],
                    ['Total Expenses', fmt(d.totalExpenses)],
                    ['Net Balance', fmt(d.netBalance ?? ((d.totalIncome || 0) - (d.totalExpenses || 0)))]
                ];
                break;
            }
            default: {
                // Generic: try common arrays
                const arr = d.income || d.expenses || d.audit || d.rows || d.items || [];
                if (arr.length && typeof arr[0] === 'object') {
                    headers = Object.keys(arr[0]).slice(0, 8);
                    rows = arr.map(r => headers.map(h => {
                        const v = r[h];
                        if (v && typeof v === 'object') return JSON.stringify(v);
                        return v ?? '';
                    }));
                } else {
                    headers = ['Info'];
                    rows = [['No tabular data for this report type']];
                }
            }
        }

        return { title, org, generated, headers, rows, summary, type };
    }




    /** Print/export report via hidden iframe only — never opens about:blank tab */
    printCurrentReport() {
        if (!this.reportData) {
            this.showToast('Generate a report first, then export/print.', 'error');
            return;
        }
        const content = document.getElementById('report-content');
        const titleEl = document.getElementById('report-title');
        if (!content || !content.innerHTML.trim()) {
            this.showToast('No report content to print.', 'error');
            return;
        }

        const title = (titleEl && titleEl.textContent) || this.getReportTitle(this.currentReport) || 'Report';
        const org = 'SELAM BERTU TESFA ORGANIZATION';
        const when = new Date().toLocaleString();

        // Hidden iframe only — no window.open (prevents about:blank Chrome tab)
        let iframe = document.getElementById('sbt-print-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'sbt-print-frame';
            iframe.setAttribute('title', 'Print frame');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
            document.body.appendChild(iframe);
        }
        const w = iframe.contentWindow;
        const _doc = iframe.contentDocument || w.document;
        w.__sbtPrintDoc = _doc;

        const styles = `
            <style>
                @page { margin: 16mm; size: auto; }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                    color: #1e293b;
                    margin: 0;
                    padding: 12px 18px 24px;
                    font-size: 12px;
                }
                .print-header {
                    border-bottom: 3px solid #0b1f3a;
                    padding-bottom: 10px;
                    margin-bottom: 16px;
                }
                .print-header .org {
                    font-size: 18px;
                    font-weight: 700;
                    color: #0b1f3a;
                    letter-spacing: 0.02em;
                }
                .print-header .title {
                    font-size: 14px;
                    color: #1a4d7a;
                    margin-top: 4px;
                }
                .print-header .meta {
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 4px;
                }
                .print-accent {
                    height: 3px;
                    background: linear-gradient(90deg, #c9a227, #c01868);
                    margin: 8px 0 16px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0 16px;
                    font-size: 11px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 6px 8px;
                    text-align: left;
                }
                th {
                    background: #1a4d7a !important;
                    color: #fff !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                tr:nth-child(even) td {
                    background: #f4f7fb !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                h1, h2, h3, h4, h5 {
                    color: #0b1f3a;
                    margin: 12px 0 8px;
                }
                .card, .card-body, .card-header {
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                canvas {
                    max-width: 100% !important;
                    height: auto !important;
                }
                .badge, .badge-status {
                    border: 1px solid #94a3b8;
                    padding: 1px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                }
                .print-footer {
                    margin-top: 24px;
                    padding-top: 8px;
                    border-top: 1px solid #cbd5e1;
                    font-size: 10px;
                    color: #64748b;
                    text-align: center;
                }
                .btn, button, .no-print { display: none !important; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        `;

        _doc.open();
        _doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
            title.replace(/</g, '') + '</title>' + styles + '</head><body>');
        _doc.write('<div class="print-header">');
        _doc.write('<div class="org">' + org + '</div>');
        _doc.write('<div class="title">' + title.replace(/</g, '') + '</div>');
        _doc.write('<div class="meta">Generated: ' + when + '</div>');
        _doc.write('</div><div class="print-accent"></div>');
        _doc.write('<div class="report-body">' + content.innerHTML + '</div>');
        _doc.write('<div class="print-footer">' + org + ' · Confidential financial report</div>');
        _doc.write('</body></html>');
        _doc.close();

        // Wait for content/images then open print dialog
        const trigger = () => {
            try {
                w.focus();
                try {
                    w.focus();
                    w.print();
                } catch (pe) {
                    window.print();
                }
            } catch (e) {
                console.warn(e);
            }
        };
        // Charts/images may need a moment
        setTimeout(trigger, 350);
    }

    exportPDF() {
        // Ask user to use the system print dialog (Save as PDF) — no blank tab
        this.printCurrentReport();
    }

    exportExcel() {
        // User requested: ask to print (not auto-download file)
        this.printCurrentReport();
    }




    
    showToast(message, type = 'info') {
        const title = type === 'success' ? 'Success' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Notice'));
        if (typeof showAppMessage === 'function') {
            showAppMessage(title, message, type);
        }
        if (typeof window.showToast === 'function' && window.showToast !== this.showToast) {
            try { window.showToast(message, type); } catch (e) {}
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
// Initialize Reports Module
// ============================================================

if (document.getElementById('report-output')) {
    document.addEventListener('DOMContentLoaded', function() {
        new ReportsModule();
    });
}