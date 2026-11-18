// ============================================================
// SELAM BERTU TESFA - Audit Log Module (Admin Only)
// Fixed: wait for AUTH.init() before permission check
// ============================================================

class AuditModule {
    constructor() {
        this.data = [];
        this.filtered = [];
        this.currentPage = 1;
        this.perPage = 25;
        this.filters = {
            action: 'all',
            entity: 'all',
            result: 'all',
            severity: 'all',
            dateFrom: '',
            dateTo: '',
            search: ''
        };
        this.detailModalInstance = null;
        this._started = false;
        this.init();
    }

    async init() {
        if (this._started) return;
        this._started = true;
        try {
            // CRITICAL: wait for auth + profile before any permission check
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) { console.warn('AUTH.init', e); }
            }

            // Retry briefly if profile still missing (race with session restore)
            let tries = 0;
            while (tries < 8 && typeof AUTH !== 'undefined' && !AUTH.getCurrentProfile?.() && !AUTH.currentProfile) {
                await new Promise(r => setTimeout(r, 150));
                tries++;
                if (AUTH.init) { try { await AUTH.init(); } catch (e) {} }
            }

            const isAdmin = (typeof AUTH !== 'undefined' && AUTH.isAdmin)
                ? AUTH.isAdmin()
                : false;

            if (!isAdmin) {
                const el = document.querySelector('.page-content');
                if (el) {
                    el.innerHTML = `
                        <div class="empty-state py-5">
                            <div class="empty-icon"><i class="bi bi-shield-lock"></i></div>
                            <div class="empty-title">Access Restricted</div>
                            <div class="empty-subtitle">You do not have permission to view audit logs. Administrator role required.</div>
                            <a href="dashboard.html" class="btn btn-primary mt-3">Back to Dashboard</a>
                        </div>`;
                }
                return;
            }

            await this.loadData();
            this.setupUI();
            this.setupEventListeners();
            this.applyClientFilters();
            this.renderTable();
            this.updateStats();
        } catch (error) {
            console.error('Audit init error:', error);
            this.showError('Failed to load audit logs.');
        }
    }

    async loadData() {
        let data = [];
        try {
            let res = await supabase
                .from('audit_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(1000);
            if (res.error) {
                res = await supabase.from('audit_logs').select('*').limit(1000);
            }
            if (res.error) {
                console.warn('audit load', res.error);
                data = [];
            } else {
                data = res.data || [];
            }
        } catch (e) {
            console.warn(e);
            data = [];
        }
        this.data = data.map(r => ({
            ...r,
            result: (r.result || 'success').toLowerCase(),
            severity: (r.severity || this._inferSeverity(r)).toLowerCase(),
            action: r.action || '',
            entity: r.entity || '',
            timestamp: r.timestamp || r.created_at || null
        }));
    }

    _inferSeverity(r) {
        const a = String(r.action || '').toUpperCase();
        const res = String(r.result || '').toLowerCase();
        if (res === 'failure' || res === 'failed' || res === 'denied') {
            if (a.includes('LOGIN') || a.includes('AUTH') || a.includes('UNAUTHORIZED')) return 'suspicious';
            return 'warning';
        }
        if (a.includes('DELETE') || a.includes('ROLE') || a.includes('USER_') || a.includes('SETTINGS')) return 'warning';
        if (a.includes('LOGIN_FAILED') || a.includes('TAMPER')) return 'critical';
        return 'info';
    }

    setupUI() {
        const entitySel = document.getElementById('audit-filter-entity');
        if (entitySel) {
            const entities = [...new Set(this.data.map(d => d.entity).filter(Boolean))].sort();
            const current = entitySel.value;
            entitySel.innerHTML = '<option value="all">All Entities</option>' +
                entities.map(e => `<option value="${this._esc(e)}">${this._esc(e)}</option>`).join('');
            if (current) entitySel.value = current;
        }
    }

    setupEventListeners() {
        document.getElementById('apply-audit-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-audit-filters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('export-audit-btn')?.addEventListener('click', () => this.exportData());
        document.getElementById('audit-refresh')?.addEventListener('click', () => this.refresh());

        document.getElementById('audit-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.applyFilters();
        });

        ['audit-filter-action', 'audit-filter-entity', 'audit-filter-result', 'audit-filter-severity']
            .forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => this.applyFilters());
            });
    }

    applyFilters() {
        this.filters.action = document.getElementById('audit-filter-action')?.value || 'all';
        this.filters.entity = document.getElementById('audit-filter-entity')?.value || 'all';
        this.filters.result = document.getElementById('audit-filter-result')?.value || 'all';
        this.filters.severity = document.getElementById('audit-filter-severity')?.value || 'all';
        this.filters.dateFrom = document.getElementById('audit-date-from')?.value || '';
        this.filters.dateTo = document.getElementById('audit-date-to')?.value || '';
        this.filters.search = (document.getElementById('audit-search')?.value || '').trim();
        this.currentPage = 1;
        this.applyClientFilters();
        this.renderTable();
        this.updateStats();
    }

    clearFilters() {
        const ids = {
            'audit-filter-action': 'all',
            'audit-filter-entity': 'all',
            'audit-filter-result': 'all',
            'audit-filter-severity': 'all',
            'audit-date-from': '',
            'audit-date-to': '',
            'audit-search': ''
        };
        Object.entries(ids).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        });
        this.filters = {
            action: 'all', entity: 'all', result: 'all', severity: 'all',
            dateFrom: '', dateTo: '', search: ''
        };
        this.currentPage = 1;
        this.applyClientFilters();
        this.renderTable();
        this.updateStats();
    }

    applyClientFilters() {
        let data = [...this.data];
        const f = this.filters;

        if (f.action && f.action !== 'all') {
            const q = f.action.toLowerCase();
            data = data.filter(r => String(r.action || '').toLowerCase().includes(q));
        }
        if (f.entity && f.entity !== 'all') {
            data = data.filter(r => String(r.entity || '').toLowerCase() === f.entity.toLowerCase());
        }
        if (f.result && f.result !== 'all') {
            data = data.filter(r => String(r.result || '').toLowerCase() === f.result.toLowerCase());
        }
        if (f.severity && f.severity !== 'all') {
            data = data.filter(r => String(r.severity || '').toLowerCase() === f.severity.toLowerCase());
        }
        if (f.dateFrom) {
            const from = new Date(f.dateFrom);
            data = data.filter(r => r.timestamp && new Date(r.timestamp) >= from);
        }
        if (f.dateTo) {
            const to = new Date(f.dateTo);
            to.setHours(23, 59, 59, 999);
            data = data.filter(r => r.timestamp && new Date(r.timestamp) <= to);
        }
        if (f.search) {
            const q = f.search.toLowerCase();
            data = data.filter(r =>
                String(r.action || '').toLowerCase().includes(q) ||
                String(r.entity || '').toLowerCase().includes(q) ||
                String(r.entity_id || '').toLowerCase().includes(q) ||
                String(r.event_id || '').toLowerCase().includes(q) ||
                String(r.user_name || '').toLowerCase().includes(q) ||
                String(r.user_id || '').toLowerCase().includes(q)
            );
        }
        this.filtered = data;
    }

    async refresh() {
        const btn = document.getElementById('audit-refresh');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
        await this.loadData();
        this.setupUI();
        this.applyClientFilters();
        this.renderTable();
        this.updateStats();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        }
    }

    updateStats() {
        const src = this.filtered.length ? this.filtered : this.data;
        const total = src.length;
        const success = src.filter(r => r.result === 'success').length;
        const failed = src.filter(r => ['failure', 'failed', 'denied', 'unauthorized'].includes(r.result)).length;
        const security = src.filter(r =>
            ['suspicious', 'critical'].includes(r.severity) ||
            /LOGIN_FAILED|UNAUTHORIZED|TAMPER|PERMISSION/i.test(r.action || '')
        ).length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('audit-total', total);
        set('audit-success', success);
        set('audit-failed', failed);
        set('audit-security', security);
    }


    describeEvent(item) {
        const action = String(item.action || 'ACTION').toUpperCase();
        const entity = item.entity || item.table_name || '';
        const details = item.details || item.metadata || item.new_data || item.new_value || {};
        let d = {};
        try {
            if (typeof details === 'string') {
                try { d = JSON.parse(details); } catch (e) { d = { note: details }; }
            } else if (details && typeof details === 'object') d = details;
        } catch (e) {}

        const amount = d.amount != null ? d.amount : (d.new && d.new.amount);
        const source = d.source || d.vendor || '';
        const txn = d.transaction_id || '';
        const status = d.status || d.approval_status || '';
        const email = d.email || item.email || '';
        const role = item.role_at_event || d.role || '';

        const map = {
            'INCOME_CREATE': 'Registered new income',
            'INCOME_UPDATE': 'Updated an income record',
            'INCOME_DELETE': 'Deleted an income record',
            'EXPENSE_CREATE': 'Registered new expense',
            'EXPENSE_UPDATE': 'Updated an expense record',
            'EXPENSE_DELETE': 'Deleted an expense record',
            'APPROVE': 'Approved a transaction',
            'REJECT': 'Rejected a transaction',
            'BUDGET_CREATE': 'Allocated budget to a category',
            'BUDGET_UPDATE': 'Updated a budget allocation',
            'BUDGET_DELETE': 'Removed a budget allocation',
            'USER_CREATE': 'Created a user account',
            'USER_UPDATE': 'Updated a user account',
            'USER_DELETE': 'Deleted a user account',
            'USER_DELETE_SOFT': 'Disabled a user account',
            'USER_STATUS': 'Changed user status',
            'LOGIN_SUCCESS': 'Signed in successfully',
            'LOGIN_FAILED': 'Failed sign-in attempt',
            'LOGIN_BLOCKED': 'Sign-in blocked (inactive/suspended)',
            'LOGOUT': 'Signed out',
            'EVIDENCE_CREATE': 'Uploaded audit evidence',
            'EVIDENCE_DELETE': 'Deleted audit evidence',
            'EVIDENCE_VERIFY': 'Verified audit evidence',
            'SETTINGS_UPDATE': 'Updated system settings',
            'PROFILE_UPDATE': 'Updated profile',
            'PASSWORD_CHANGE': 'Changed password',
            'RECEIPT_UPLOAD': 'Uploaded a receipt',
            'CATEGORY_CREATE': 'Added a category',
            'CATEGORY_DELETE': 'Removed a category',
            'PAYMENT_METHOD_CREATE': 'Added a payment method',
            'PURGE': 'Purged financial data'
        };

        let what = map[action] || (action.replace(/_/g, ' ').toLowerCase());
        const bits = [];
        if (entity && !['auth', 'profiles', 'system'].includes(String(entity).toLowerCase())) {
            bits.push(String(entity));
        }
        if (txn) bits.push('Ref: ' + txn);
        if (source) bits.push(String(source));
        if (amount != null && amount !== '') {
            const fmt = (typeof formatCurrency === 'function') ? formatCurrency(amount) : ('ETB ' + amount);
            bits.push(fmt);
        }
        if (status) bits.push('Status: ' + status);
        if (email && (action.includes('USER') || action.includes('LOGIN'))) bits.push(email);
        if (bits.length) what += ' — ' + bits.join(' · ');
        if (item.result && item.result !== 'success') what += ' (' + item.result + ')';
        return what;
    }

    whoLabel(item) {
        const name = item.user_name || item.actor_name || item.email || '';
        const role = item.role_at_event || '';
        const email = item.email || (item.details && item.details.email) || '';
        let d = item.details || item.metadata || {};
        if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (e) { d = {}; }
        }
        const mail = email || d.email || '';
        if (!name && !mail) return 'System';
        let line = name || mail || 'User';
        if (role) line += ' · ' + role;
        if (mail && name && mail !== name) line += ' · ' + mail;
        return line;
    }

renderTable() {
        const tbody = document.getElementById('audit-table-body');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.perPage;
        const pageData = this.filtered.slice(start, start + this.perPage);
        const total = this.filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / this.perPage));

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-5">
                        <div class="empty-state">
                            <div class="empty-icon"><i class="bi bi-clipboard-data"></i></div>
                            <div class="empty-title">No audit events found</div>
                            <div class="empty-subtitle">Activity will appear here when users sign in, save income/expenses, or change settings.</div>
                        </div>
                    </td>
                </tr>`;
            this.updatePagination(1, 0, 0);
            return;
        }

        tbody.innerHTML = pageData.map((item) => {
            const when = item.timestamp ? this._fmtDate(item.timestamp) : (item.created_at ? this._fmtDate(item.created_at) : '—');
            const who = this.whoLabel(item);
            const what = this.describeEvent(item);
            const id = item.id || item.event_id || '';
            return `
                <tr class="audit-row" data-id="${this._esc(String(id))}" style="cursor:pointer">
                    <td>
                        <div class="fw-semibold">${this._esc(who)}</div>
                    </td>
                    <td class="text-nowrap small text-muted">${this._esc(when)}</td>
                    <td class="small">
                        <div class="d-flex justify-content-between align-items-center gap-2">
                            <span>${this._esc(what)}</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary audit-eye-btn" data-id="${this._esc(String(id))}" title="View full activity details">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.audit-eye-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.viewDetail(btn.dataset.id);
            });
        });
        tbody.querySelectorAll('tr.audit-row').forEach(tr => {
            tr.addEventListener('click', () => this.viewDetail(tr.dataset.id));
        });

        this.updatePagination(this.currentPage, totalPages, total);
    }

    updatePagination(currentPage, totalPages, total) {
        const pagination = document.getElementById('audit-pagination');
        const info = document.getElementById('audit-pagination-info');

        if (info) {
            if (total === 0) info.textContent = 'No records';
            else {
                const start = (currentPage - 1) * this.perPage + 1;
                const end = Math.min(currentPage * this.perPage, total);
                info.textContent = `Showing ${start}–${end} of ${total}`;
            }
        }

        if (!pagination) return;

        if (totalPages <= 1) {
            pagination.innerHTML = `
                <li class="page-item disabled"><span class="page-link">Previous</span></li>
                <li class="page-item active"><span class="page-link">1</span></li>
                <li class="page-item disabled"><span class="page-link">Next</span></li>`;
            return;
        }

        const maxButtons = 7;
        let startP = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endP = Math.min(totalPages, startP + maxButtons - 1);
        if (endP - startP < maxButtons - 1) startP = Math.max(1, endP - maxButtons + 1);

        let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;

        for (let i = startP; i <= endP; i++) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }

        html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;

        pagination.innerHTML = html;
        pagination.querySelectorAll('a.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const p = parseInt(link.dataset.page, 10);
                if (p >= 1 && p <= totalPages && p !== this.currentPage) {
                    this.currentPage = p;
                    this.renderTable();
                }
            });
        });
    }

    viewDetail(id) {
        const item = this.data.find(r => String(r.id) === String(id) || String(r.event_id) === String(id));
        if (!item) return;

        const body = document.getElementById('audit-detail-body')
            || document.getElementById('audit-detail-content');
        if (!body) return;

        const fmtJson = (v) => {
            if (v == null || v === '') return '<span class="text-muted">—</span>';
            try {
                const obj = typeof v === 'string' ? JSON.parse(v) : v;
                return `<pre class="audit-json mb-0">${this._esc(JSON.stringify(obj, null, 2))}</pre>`;
            } catch {
                return `<pre class="audit-json mb-0">${this._esc(String(v))}</pre>`;
            }
        };

        const who = this.whoLabel(item);
        const when = item.timestamp ? this._fmtDate(item.timestamp) : (item.created_at ? this._fmtDate(item.created_at) : '—');
        const what = this.describeEvent(item);
        const actorId = item.user_id || item.actor_id;
        const actorName = item.user_name || '';
        const related = (this.data || []).filter(r => {
            if (String(r.id) === String(item.id)) return false;
            if (actorId && r.user_id && String(r.user_id) === String(actorId)) return true;
            if (actorName && r.user_name && String(r.user_name) === String(actorName)) return true;
            return false;
        }).slice(0, 12);

        const rows = [
            ['Who (Actor)', who],
            ['When', when],
            ['What happened', what],
            ['Action', item.action || ''],
            ['Module', item.entity || item.table_name || ''],
            ['Record ID', item.entity_id || ''],
            ['Result', item.result || ''],
            ['Role', item.role_at_event || ''],
            ['User ID', item.user_id || ''],
            ['IP address', item.ip_address || '']
        ].filter(([, val]) => val != null && String(val).trim() !== '' && String(val) !== '—');

        const oldV = item.old_value || item.old_data;
        const newV = item.new_value || item.new_data || item.details;
        const meta = item.metadata || item.details;
        const hasVal = (v) => {
            if (v == null || v === '') return false;
            if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
            return true;
        };

        body.innerHTML = `
            <div class="alert alert-light border mb-3">
                <div class="fw-bold mb-1">${this._esc(what)}</div>
                <div class="small text-muted">${this._esc(who)} · ${this._esc(when)}</div>
            </div>
            ${rows.map(([label, val]) => `
            <div class="d-flex border-bottom py-2">
                <div class="text-muted small" style="min-width:120px">${label}</div>
                <div class="flex-grow-1">${this._esc(String(val))}</div>
            </div>`).join('')}
            ${hasVal(oldV) ? `<div class="mt-3"><div class="fw-semibold small text-secondary mb-1">Before</div>${fmtJson(oldV)}</div>` : ''}
            ${hasVal(newV) ? `<div class="mt-3"><div class="fw-semibold small text-secondary mb-1">After / details</div>${fmtJson(newV)}</div>` : ''}
            ${hasVal(meta) && meta !== newV ? `<div class="mt-3"><div class="fw-semibold small text-secondary mb-1">Context</div>${fmtJson(meta)}</div>` : ''}
            ${related.length ? `
            <div class="mt-4">
                <div class="fw-semibold mb-2">Other recent activity by this actor</div>
                <ul class="list-group list-group-flush small">
                    ${related.map(r => `<li class="list-group-item px-0 d-flex justify-content-between gap-2">
                        <span>${this._esc(this.describeEvent(r))}</span>
                        <span class="text-muted text-nowrap">${this._esc(r.timestamp ? this._fmtDate(r.timestamp) : '')}</span>
                    </li>`).join('')}
                </ul>
            </div>` : ''}`;

        const modalEl = document.getElementById('auditDetailModal')
            || document.getElementById('audit-detail-modal');
        if (modalEl) {
            if (!this.detailModalInstance || this.detailModalInstance._element !== modalEl) {
                this.detailModalInstance = new bootstrap.Modal(modalEl);
            }
            this.detailModalInstance.show();
        }
    }

    exportData() {
        const rows = this.filtered.length ? this.filtered : this.data;
        if (!rows.length) {
            if (typeof showToast === 'function') showToast('No data to export', 'warning');
            return;
        }
        const headers = ['event_id', 'timestamp', 'user_name', 'role_at_event', 'action', 'entity',
            'entity_id', 'result', 'severity', 'ip_address'];
        const csv = [
            headers.join(','),
            ...rows.map(r => headers.map(h => {
                let v = r[h] == null ? '' : String(r[h]);
                if (v.includes(',') || v.includes('"') || v.includes('\n')) v = '"' + v.replace(/"/g, '""') + '"';
                return v;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    showError(msg) {
        const tbody = document.getElementById('audit-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${this._esc(msg)}</td></tr>`;
        }
    }

    _fmtDate(iso) {
        try {
            return new Date(iso).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch {
            return String(iso);
        }
    }

    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Only auto-start if app.js did not already create the module
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('audit-table-body') && !window.auditModule) {
        // Delay slightly so AUTH + app.js can finish first
        setTimeout(() => {
            if (!window.auditModule) {
                window.auditModule = new AuditModule();
            }
        }, 200);
    }
});


// ============================================================
// Audit Findings Module (real DB: audit_findings)
// ============================================================
class AuditFindingsModule {
    constructor() {
        this.items = [];
        this.init();
    }
    async init() {
        const host = document.querySelector('.page-content');
        if (!host || document.getElementById('audit-findings-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'audit-findings-panel';
        panel.className = 'card mb-4';
        panel.innerHTML = `
          <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 class="mb-0"><i class="bi bi-shield-exclamation"></i> Audit Findings & Observations</h5>
            <button type="button" class="btn btn-sm btn-primary" id="af-add-btn"><i class="bi bi-plus"></i> Add Finding</button>
          </div>
          <div class="card-body">
            <div id="af-form" class="border rounded p-3 mb-3 d-none bg-light">
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label small">Title *</label><input class="form-control form-control-sm" id="af-title"></div>
                <div class="col-md-3"><label class="form-label small">Type</label>
                  <select class="form-select form-select-sm" id="af-type">
                    <option value="observation">Observation</option>
                    <option value="risk">Risk</option>
                    <option value="control_weakness">Control weakness</option>
                    <option value="recommendation">Recommendation</option>
                  </select>
                </div>
                <div class="col-md-3"><label class="form-label small">Severity</label>
                  <select class="form-select form-select-sm" id="af-severity">
                    <option value="low">Low</option><option value="medium" selected>Medium</option>
                    <option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <div class="col-12"><label class="form-label small">Description</label><textarea class="form-control form-control-sm" id="af-desc" rows="2"></textarea></div>
                <div class="col-md-4"><label class="form-label small">Responsible person</label><input class="form-control form-control-sm" id="af-person"></div>
                <div class="col-md-4"><label class="form-label small">Department</label><input class="form-control form-control-sm" id="af-dept"></div>
                <div class="col-md-4"><label class="form-label small">Status</label>
                  <select class="form-select form-select-sm" id="af-status">
                    <option value="open">Open</option><option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option><option value="closed">Closed</option>
                  </select>
                </div>
                <div class="col-12"><label class="form-label small">Recommendation / corrective action</label><textarea class="form-control form-control-sm" id="af-reco" rows="2"></textarea></div>
                <div class="col-12">
                  <button type="button" class="btn btn-sm btn-success" id="af-save-btn">Save finding</button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" id="af-cancel-btn">Cancel</button>
                </div>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead><tr><th>Title</th><th>Type</th><th>Severity</th><th>Status</th><th>Responsible</th><th>When</th><th></th></tr></thead>
                <tbody id="af-table-body"><tr><td colspan="7" class="text-muted text-center">Loading…</td></tr></tbody>
              </table>
            </div>
          </div>`;
        host.appendChild(panel);
        document.getElementById('af-add-btn')?.addEventListener('click', () => {
            document.getElementById('af-form')?.classList.toggle('d-none');
        });
        document.getElementById('af-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('af-form')?.classList.add('d-none');
        });
        document.getElementById('af-save-btn')?.addEventListener('click', () => this.save());
        await this.load();
    }
    async load() {
        const tbody = document.getElementById('af-table-body');
        try {
            const { data, error } = await supabase.from('audit_findings').select('*').order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            this.items = data || [];
        } catch (e) {
            this.items = [];
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No findings yet (run MIGRATION_ADVANCED_FEATURES.sql if table missing).</td></tr>';
            return;
        }
        if (!tbody) return;
        if (!this.items.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No audit findings recorded.</td></tr>';
            return;
        }
        tbody.innerHTML = this.items.map(f => `
          <tr>
            <td>${this.esc(f.title)}</td>
            <td><span class="badge bg-secondary">${this.esc(f.finding_type)}</span></td>
            <td><span class="badge ${f.severity==='critical'?'bg-danger':f.severity==='high'?'bg-warning text-dark':'bg-info'}">${this.esc(f.severity)}</span></td>
            <td>${this.esc(f.status)}</td>
            <td>${this.esc(f.responsible_person||'—')}</td>
            <td class="small text-nowrap">${f.created_at ? new Date(f.created_at).toLocaleString() : ''}</td>
            <td><button type="button" class="btn btn-link btn-sm text-danger p-0" data-del="${f.id}">Delete</button></td>
          </tr>`).join('');
        tbody.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this.remove(btn.getAttribute('data-del')));
        });
    }
    async save() {
        const title = document.getElementById('af-title')?.value?.trim();
        if (!title) {
            if (typeof showAppMessage === 'function') showAppMessage('Required', 'Title is required.', 'warning');
            return;
        }
        const profile = AUTH.getCurrentProfile?.() || {};
        const row = {
            title,
            description: document.getElementById('af-desc')?.value || '',
            finding_type: document.getElementById('af-type')?.value || 'observation',
            severity: document.getElementById('af-severity')?.value || 'medium',
            status: document.getElementById('af-status')?.value || 'open',
            responsible_person: document.getElementById('af-person')?.value || '',
            responsible_department: document.getElementById('af-dept')?.value || '',
            recommendation: document.getElementById('af-reco')?.value || '',
            created_by: profile.id || null,
            created_by_name: profile.full_name || profile.email || ''
        };
        const { error } = await supabase.from('audit_findings').insert(row);
        if (error) {
            if (typeof showAppMessage === 'function') showAppMessage('Error', error.message, 'error');
            return;
        }
        if (typeof logAudit === 'function') {
            try { await logAudit('AUDIT_FINDING_CREATE', 'audit_findings', null, null, { title }); } catch (e) {}
        }
        document.getElementById('af-form')?.classList.add('d-none');
        document.getElementById('af-title').value = '';
        if (typeof showAppMessage === 'function') showAppMessage('Saved', 'Audit finding recorded.', 'success');
        await this.load();
    }
    async remove(id) {
        if (!confirm('Delete this finding?')) return;
        await supabase.from('audit_findings').delete().eq('id', id);
        await this.load();
    }
    esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('audit-table-body')) {
        setTimeout(() => {
            if (!window.auditFindingsModule) {
                window.auditFindingsModule = new AuditFindingsModule();
            }
        }, 400);
    }
});
