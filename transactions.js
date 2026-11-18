// ============================================================
// SELAM BERTU TESFA - Transactions Module
// ============================================================

class TransactionsModule {
    constructor() {
        this.data = [];
        this.currentPage = 1;
        this.perPage = 20;
        this.filters = {
            type: 'all',
            status: 'all',
            dateFrom: '',
            dateTo: '',
            search: ''
        };
        this.viewModalInstance = null;
        this.incomeCatMap = {};
        this.expenseCatMap = {};
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupUI();
            this.setupEventListeners();
            this.renderTable();
            this.updateStats();
            console.log('Transactions loaded:', this.data.length, 'rows');
        } catch (error) {
            console.error('Transactions init error:', error);
            this.showError('Failed to load transaction data.');
        }
    }

    async loadData() {
        let income = [];
        let expenses = [];

        try {
            let inc = await supabase.from('income').select('*');
            if (inc.error) console.warn('income load', inc.error);
            income = (inc.data || []).filter(r => r.is_deleted !== true);
        } catch (e) { console.warn(e); }

        try {
            let exp = await supabase.from('expenses').select('*');
            if (exp.error) console.warn('expenses load', exp.error);
            expenses = (exp.data || []).filter(r => r.is_deleted !== true);
        } catch (e) { console.warn(e); }

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

        this.data = [
            ...income.map(i => ({
                ...i,
                _type: 'income',
                type: 'income',
                status: i.approval_status || i.status || 'pending',
                description: i.source || i.description || '',
                category_name: (i.category_id && this.incomeCatMap[i.category_id]) || 'N/A'
            })),
            ...expenses.map(e => ({
                ...e,
                _type: 'expense',
                type: 'expense',
                status: e.status || 'pending',
                description: e.vendor || e.description || '',
                category_name: (e.category_id && this.expenseCatMap[e.category_id]) || 'N/A'
            }))
        ];

        if (this.filters.type === 'income') {
            this.data = this.data.filter(d => d._type === 'income');
        } else if (this.filters.type === 'expense') {
            this.data = this.data.filter(d => d._type === 'expense');
        }
        if (this.filters.status && this.filters.status !== 'all') {
            this.data = this.data.filter(d => (d.status || '') === this.filters.status);
        }
        if (this.filters.dateFrom) {
            this.data = this.data.filter(d => String(d.date || '').slice(0, 10) >= this.filters.dateFrom);
        }
        if (this.filters.dateTo) {
            this.data = this.data.filter(d => String(d.date || '').slice(0, 10) <= this.filters.dateTo);
        }
        if (this.filters.search) {
            const s = this.filters.search.toLowerCase();
            this.data = this.data.filter(d =>
                String(d.transaction_id || '').toLowerCase().includes(s) ||
                String(d.description || '').toLowerCase().includes(s) ||
                String(d.source || '').toLowerCase().includes(s) ||
                String(d.vendor || '').toLowerCase().includes(s)
            );
        }

        this.data.sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
    }

    setupUI() {
        const viewModalEl = document.getElementById('transaction-view-modal');
        if (viewModalEl && typeof bootstrap !== 'undefined') {
            this.viewModalInstance = new bootstrap.Modal(viewModalEl);
        }
    }

    setupEventListeners() {
        document.getElementById('apply-filters-btn')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters-btn')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('transaction-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.applyFilters();
        });
    }

    applyFilters() {
        this.filters.type = document.getElementById('transaction-type-filter')?.value || 'all';
        this.filters.status = document.getElementById('transaction-status-filter')?.value || 'all';
        this.filters.dateFrom = document.getElementById('transaction-date-from')?.value || '';
        this.filters.dateTo = document.getElementById('transaction-date-to')?.value || '';
        this.filters.search = (document.getElementById('transaction-search')?.value || '').trim();
        this.currentPage = 1;
        this.refresh();
    }

    clearFilters() {
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal('transaction-type-filter', 'all');
        setVal('transaction-status-filter', 'all');
        setVal('transaction-date-from', '');
        setVal('transaction-date-to', '');
        setVal('transaction-search', '');
        this.filters = { type: 'all', status: 'all', dateFrom: '', dateTo: '', search: '' };
        this.currentPage = 1;
        this.refresh();
    }

    async refresh() {
        await this.loadData();
        this.renderTable();
        this.updateStats();
    }

    renderTable() {
        const tbody = document.getElementById('transactions-table-body');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.perPage;
        const end = start + this.perPage;
        const pageData = this.data.slice(start, end);
        const total = this.data.length;
        const totalPages = Math.max(1, Math.ceil(total / this.perPage) || 1);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No records found.</td></tr>';
            this.updatePagination(1, 0, 0);
            return;
        }

        const fc = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : ('ETB ' + Number(n || 0).toFixed(2)));
        const fd = (d) => (typeof formatDate === 'function' ? formatDate(d) : (d || ''));

        tbody.innerHTML = pageData.map(item => {
            const isIncome = item._type === 'income';
            const status = item.status || 'pending';
            return (
                '<tr>' +
                '<td><span class="badge bg-secondary">' + (item.transaction_id || String(item.id || '').slice(0, 8)) + '</span></td>' +
                '<td>' + fd(item.date) + '</td>' +
                '<td><span class="badge ' + (isIncome ? 'bg-success' : 'bg-danger') + '">' + (isIncome ? 'Income' : 'Expense') + '</span></td>' +
                '<td>' + (item.category_name || 'N/A') + '</td>' +
                '<td>' + this.escapeHtml(item.description || item.vendor || item.source || '') + '</td>' +
                '<td class="' + (isIncome ? 'text-success' : 'text-danger') + ' fw-bold">' + fc(item.amount) + '</td>' +
                '<td><span class="badge-status ' + status + '">' + status + '</span></td>' +
                '<td><button class="btn btn-sm btn-outline-primary view-trans-btn" data-id="' + item.id + '" data-type="' + item._type + '"><i class="bi bi-eye"></i></button></td>' +
                '</tr>'
            );
        }).join('');

        tbody.querySelectorAll('.view-trans-btn').forEach(btn => {
            btn.addEventListener('click', () => this.viewTransaction(btn.dataset.id, btn.dataset.type));
        });
        this.updatePagination(this.currentPage, totalPages, total);
    }

    updatePagination(currentPage, totalPages, total) {
        const info = document.getElementById('trans-pagination-info');
        if (info) {
            const start = total ? (currentPage - 1) * this.perPage + 1 : 0;
            const end = Math.min(currentPage * this.perPage, total);
            info.textContent = total ? ('Showing ' + start + '-' + end + ' of ' + total + ' records') : 'No records';
        }
        const pagination = document.getElementById('trans-pagination');
        if (!pagination) return;
        let html = '<li class="page-item ' + (currentPage <= 1 ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (currentPage - 1) + '">Previous</a></li>';
        for (let i = 1; i <= totalPages; i++) {
            html += '<li class="page-item ' + (i === currentPage ? 'active' : '') + '"><a class="page-link" href="#" data-page="' + i + '">' + i + '</a></li>';
        }
        html += '<li class="page-item ' + (currentPage >= totalPages ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (currentPage + 1) + '">Next</a></li>';
        pagination.innerHTML = html;
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page, 10);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderTable();
                }
            });
        });
    }

    updateStats() {
        const isAppr = (r) => String(r.status || r.approval_status || '').toLowerCase() === 'approved';
        const totalIncome = this.data.filter(i => i._type === 'income' && isAppr(i)).reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalExpenses = this.data.filter(i => i._type === 'expense' && isAppr(i)).reduce((s, i) => s + Number(i.amount || 0), 0);
        const fc = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : ('ETB ' + Number(n || 0).toFixed(2)));
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('trans-total-income', fc(totalIncome));
        set('trans-total-expenses', fc(totalExpenses));
        set('trans-net-balance', fc(totalIncome - totalExpenses));
        set('trans-total-count', String(this.data.length));
    }

    async viewTransaction(id, type) {
        const item = this.data.find(d => String(d.id) === String(id)) || {};
        const content = document.getElementById('transaction-view-content');
        const isIncome = type === 'income' || item._type === 'income';
        const fc = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : n);
        const html =
            '<p><strong>ID:</strong> ' + (item.transaction_id || item.id || '') + '</p>' +
            '<p><strong>Date:</strong> ' + (item.date || '') + '</p>' +
            '<p><strong>Type:</strong> ' + (isIncome ? 'Income' : 'Expense') + '</p>' +
            '<p><strong>Category:</strong> ' + (item.category_name || 'N/A') + '</p>' +
            '<p><strong>Description:</strong> ' + this.escapeHtml(item.description || item.source || item.vendor || '') + '</p>' +
            '<p><strong>Amount:</strong> ' + fc(item.amount) + '</p>' +
            '<p><strong>Status:</strong> ' + (item.status || item.approval_status || '') + '</p>';
        if (content) {
            content.innerHTML = html;
            if (this.viewModalInstance) this.viewModalInstance.show();
        } else if (typeof showAppMessage === 'function') {
            showAppMessage('Transaction details', html, 'info');
        } else {
            console.log(html.replace(/<[^>]+>/g, '\n'));
        }
    }

    showError(message) {
        if (typeof showAppMessage === "function") showAppMessage("Error", message, "error"); else console.error(message);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('transactions-table-body')) {
        window.transactionsModule = new TransactionsModule();
        console.log('Transactions module started');
    }
});
