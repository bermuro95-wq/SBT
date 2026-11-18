// ============================================================
// SELAM BERTU TESFA - Income Module
// ============================================================

class IncomeModule {
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
            // Load data
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            await this.loadDropdowns();
            await this.loadData();
            
            // Setup UI
            this.setupUI();
            this.setupEventListeners();
            this.bindCancelButtons();
            this.renderTable();
            this.updateStats();
            
            // Check permissions
            this.applyPermissions();
            
        } catch (error) {
            console.error('Income module init error:', error);
            this.showError('Failed to load income data.');
        }
    }
    
    async loadDropdowns() {
        // Load categories
        const { data: categories, error: catError } = await supabase
            .from('income_categories')
            .select('*');
        if (!catError) this.categories = categories || [];
        
        // Load payment methods
        const { data: methods, error: methodError } = await supabase
            .from('payment_methods')
            .select('*');
        if (!methodError) this.paymentMethods = methods || [];
        
        // Load financial years
        const { data: years, error: yearError } = await supabase
            .from('financial_years')
            .select('*')
            .order('start_date', { ascending: false });
        if (!yearError) this.financialYears = years || [];
        
        // Profiles for Created By / Received By
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
    }
    
    async loadData() {
        // Simple select — no joins (joins fail if FKs are missing in Supabase)
        let query = supabase
            .from('income')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Apply filters
        if (this.filters.status !== 'all') {
            query = query.eq('approval_status', this.filters.status);
        }
        // Date calendar filter applied after fetch in JS
        if (this.filters.search) {
            query = query.or(`source.ilike.%${this.filters.search}%,description.ilike.%${this.filters.search}%,transaction_id.ilike.%${this.filters.search}%`);
        }
        
        let { data, error } = await query;
        
        // Retry without order if created_at missing
        if (error) {
            console.warn('Income load retry', error);
            const retry = await supabase.from('income').select('*');
            data = retry.data;
            error = retry.error;
        }
        
        // Hide soft-deleted in JS if column exists
        if (data) {
            data = data.filter(r => r.is_deleted !== true);
        }
        
        if (error) {
            console.error('Load income error:', error);
            this.showError('Failed to load income records.');
            return;
        }
        
        this.data = data || [];
        const df = document.getElementById('income-date-from')?.value;
        const dt = document.getElementById('income-date-to')?.value;
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
        // Initialize modals
        const modalEl = document.getElementById('income-modal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }
        
        const viewModalEl = document.getElementById('income-view-modal');
        if (viewModalEl) {
            this.viewModalInstance = new bootstrap.Modal(viewModalEl);
        }
        
        // Populate dropdowns
        this.populateDropdowns();
    }
    
    populateDropdowns() {
        // Categories
        const categorySelect = document.getElementById('income-category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>' +
                this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        
        // Payment methods
        const methodSelect = document.getElementById('income-payment-method');
        if (methodSelect) {
            methodSelect.innerHTML = '<option value="">Select Payment Method</option>' +
                this.paymentMethods.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }
        
        // Financial years filter
        const yearFilter = document.getElementById('income-filter-year');
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="">All Years</option>' +
                this.financialYears.map(y => `<option value="${y.id}">${y.name}</option>`).join('');
        }
    }
    
    setupEventListeners() {
        // Create button
        const createBtn = document.getElementById('create-income-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
        
        // Filter status
        const statusFilter = document.getElementById('income-filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.currentPage = 1;
                this.refresh();
            });
        }
        
        // Filter year
        const yearFilter = document.getElementById('income-filter-year');
        if (yearFilter) {
            yearFilter.addEventListener('change', (e) => {
                this.filters.year = e.target.value;
                this.currentPage = 1;
                this.refresh();
            });
        }
        
        // Search
        const searchInput = document.getElementById('income-search');
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
        
        // Export
        const exportBtn = document.getElementById('export-income-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        
        // Form submission (direct + delegated)
        const draftBtn = document.getElementById('income-submit-draft');
        const approvalBtn = document.getElementById('income-submit-approval');
        if (draftBtn) draftBtn.onclick = () => this.saveIncome('draft');
        if (approvalBtn) approvalBtn.onclick = () => this.saveIncome('submitted');
        document.addEventListener('click', (e) => {
            const t = e.target.closest('#income-submit-draft, #income-submit-approval');
            if (!t) return;
            e.preventDefault();
            if (t.id === 'income-submit-draft') this.saveIncome('draft');
            if (t.id === 'income-submit-approval') this.saveIncome('submitted');
        });
        
        // File input
        const fileInput = document.getElementById('income-receipt');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
    }
    
    applyPermissions() {
        const canCreate = canCreateIncome();
        const canEdit = canEditIncome();
        const canDelete = canDeleteIncome();
        
        // Show/hide create button
        const createBtn = document.getElementById('create-income-btn');
        if (createBtn) {
            // Always show for admin/accountant; only hide pure viewers
            const role = AUTH?.getCurrentProfile?.()?.role || AUTH?.getCurrentUser?.()?.role;
            if (!canCreate && role === 'viewer') {
                createBtn.style.display = 'none';
            } else {
                createBtn.style.display = '';
            }
        }
        
        // Show/hide edit/delete buttons in table
        document.querySelectorAll('.income-actions').forEach(el => {
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
        if (!id) return 'N/A';
        if (this.profilesMap && this.profilesMap[id]) return this.profilesMap[id];
        return 'N/A';
    }
    resolveCategoryName(id) {
        if (!id) return 'N/A';
        const c = (this.categories || []).find(x => x.id === id);
        return c?.name || 'N/A';
    }
    resolvePaymentName(id) {
        if (!id) return 'N/A';
        const p = (this.paymentMethods || []).find(x => x.id === id);
        return p?.name || 'N/A';
    }
    
    renderTable() {
        const tbody = document.getElementById('income-table-body');
        if (!tbody) return;
        
        // Pagination
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
                <td>${this.escapeHtml(item.source)}</td>
                <td>${this.resolveCategoryName(item.category_id) || item.category?.name || 'N/A'}</td>
                <td class="text-success fw-bold">${formatCurrency(item.amount)}</td>
                <td>${this.resolvePaymentName(item.payment_method_id) || item.payment_method?.name || 'N/A'}</td>
                <td>
                    <span class="badge-status ${item.approval_status}">${item.approval_status}</span>
                </td>
                <td class="income-actions">
                    <button class="btn btn-sm btn-outline-primary view-btn" data-id="${item.id}">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${canEditIncome() && item.approval_status !== 'approved' ? `
                        <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${item.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    ` : ''}
                    ${canDeleteIncome() && item.approval_status !== 'approved' ? `
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${item.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-secondary duplicate-btn" data-id="${item.id}" title="Duplicate">
                        <i class="bi bi-copy"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Attach event listeners to action buttons
        
        tbody.onclick = (ev) => {
            const btn = ev.target.closest('button');
            if (!btn || !tbody.contains(btn)) return;
            const id = btn.getAttribute('data-id');
            if (!id) return;
            ev.preventDefault();
            if (btn.classList.contains('view-btn')) this.viewIncome(id);
            else if (btn.classList.contains('edit-btn')) this.openEditModal(id);
            else if (btn.classList.contains('delete-btn')) this.deleteIncome && this.deleteIncome(id);
            else if (btn.classList.contains('duplicate-btn')) this.duplicateIncome && this.duplicateIncome(id);
        };

        
        this.updatePagination(this.currentPage, totalPages, total);
    }
    
    updatePagination(currentPage, totalPages, total) {
        const pagination = document.getElementById('income-pagination');
        const info = document.getElementById('income-pagination-info');
        
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
    
    resolveName(id) {
        if (!id) return '';
        if (this.profilesMap && this.profilesMap[id]) return this.profilesMap[id];
        try {
            const p = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
            if (p && (p.id === id || p.auth_id === id)) return p.full_name || p.email || '';
        } catch (e) {}
        return '';
    }

    updateStats() {
        const statusOf = (item) => String(item.approval_status || item.status || '').toLowerCase();
        // Total Income amount = ONLY admin-approved records
        const total = this.data
            .filter(item => statusOf(item) === 'approved')
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const approved = this.data.filter(item => statusOf(item) === 'approved').length;
        const pending = this.data.filter(item => ['pending', 'submitted', 'draft'].includes(statusOf(item))).length;
        const rejected = this.data.filter(item => ['rejected', 'denied', 'declined'].includes(statusOf(item))).length;
        const count = this.data.length;
        
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('income-total', formatCurrency(total));
        set('income-approved', approved);
        set('income-pending', pending);
        set('income-rejected', rejected);
        set('income-count', count);
    }
    
    openCreateModal() {
        this.editingId = null;
        this.uploadedReceipt = null;
        document.getElementById('income-modal-title').textContent = 'Create Income';
        document.getElementById('income-form').reset();
        document.getElementById('income-id').value = '';
        document.getElementById('income-transaction-id').value = '';
        document.getElementById('income-receipt-preview').innerHTML = '';
        
        // Set default date
        document.getElementById('income-date').value = new Date().toISOString().split('T')[0];
        
        // Set financial year
        const currentYear = this.financialYears.find(y => y.status === 'open');
        if (currentYear) {
            document.getElementById('income-financial-year').value = currentYear.id;
        }
        
        this.modalInstance.show();
    }
    
    async openEditModal(id) {
        let item = this.data.find(d => String(d.id) === String(id));
        if (!item) {
            try {
                const { data } = await supabase.from('income').select('*').eq('id', id).maybeSingle();
                item = data;
            } catch (e) {}
        }
        if (!item) {
            this.showError('Record not found.');
            return;
        }
        
        this.editingId = id;
        document.getElementById('income-modal-title').textContent = 'Edit Income';
        document.getElementById('income-id').value = item.id;
        document.getElementById('income-transaction-id').value = item.transaction_id;
        document.getElementById('income-date').value = item.date;
        document.getElementById('income-amount').value = item.amount;
        document.getElementById('income-source').value = item.source;
        document.getElementById('income-category').value = item.category_id || '';
        document.getElementById('income-payment-method').value = item.payment_method_id || '';
        document.getElementById('income-reference').value = item.reference_number || '';
        document.getElementById('income-description').value = item.description || '';
        document.getElementById('income-notes').value = item.notes || '';
        document.getElementById('income-financial-year').value = item.financial_year_id;
        
        if (item.receipt_url) {
            document.getElementById('income-receipt-preview').innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-file-earmark-pdf text-danger"></i>
                    <span>Current receipt attached</span>
                    <button type="button" class="btn btn-sm btn-link text-danger remove-receipt-btn">Remove</button>
                </div>
            `;
            document.querySelector('.remove-receipt-btn')?.addEventListener('click', () => {
                document.getElementById('income-receipt-preview').innerHTML = '';
                document.getElementById('income-receipt').value = '';
                this.uploadedReceipt = null;
            });
        }
        
        const modalEl = document.getElementById('income-modal');
        if (!this.modalInstance && modalEl && window.bootstrap) {
            this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        }
        if (this.modalInstance) this.modalInstance.show();
        else if (modalEl) { modalEl.classList.add('show'); modalEl.style.display = 'block'; }
    }
    
    async saveIncome(status) {
        if (this._saving) return;
        this._saving = true;
        const form = document.getElementById('income-form');
        const formData = new FormData(form);
        
        // Validate
        const date = formData.get('date');
        let amountRaw = formData.get('amount');
        if (typeof amountRaw === 'string') amountRaw = amountRaw.replace(/,/g, '').replace(/[^0-9.-]/g, '');
        const amount = Math.round(parseFloat(amountRaw) * 100) / 100;
        const source = formData.get('source');
        const categoryId = formData.get('category_id');
        
        if (!date) {
            this.showToast('Please select a date.', 'error');
            this._saving = false;
            return;
        }
        if (typeof checkPeriodLock === 'function') {
            const lock = await checkPeriodLock(date);
            if (lock.locked) {
                if (typeof showAppMessage === "function") showAppMessage("Closed Period", "This date falls in a closed financial year (" + (lock.year?.name || "") + "). You cannot post new entries.", "warning");
                else this.showToast("Closed financial year — cannot post.", "warning");
                this._saving = false;
                return;
            }
        }
        if (!amount || amount <= 0 || isNaN(amount)) {
            this.showToast('Please enter a valid amount.', 'error');
            this._saving = false;
            return;
        }
        if (!source || !String(source).trim()) {
            this.showToast('Please enter the income source.', 'error');
            this._saving = false;
            return;
        }
        // Mandatory fields
        const missing = [];
        if (!date) missing.push('Date');
        if (!amount || amount <= 0 || isNaN(amount)) missing.push('Amount');
        if (!source || !String(source).trim()) missing.push('Source');
        // Category required only when category list is available
        const catOptions = document.getElementById('income-category');
        const hasCatOptions = catOptions && catOptions.options && catOptions.options.length > 1;
        if (hasCatOptions && !categoryId) missing.push('Category');
        // Receipt required for non-draft submits
        const receiptInput = document.getElementById('income-receipt');
        const hasNewReceipt = !!(receiptInput && receiptInput.files && receiptInput.files.length > 0);
        const previewHtml = document.getElementById('income-receipt-preview')?.innerHTML || '';
        const hasExistingReceipt = !!(this.editingId && previewHtml.trim().length > 0);
        if (hasNewReceipt) this.uploadedReceipt = receiptInput.files[0];
        const hasUploaded = !!(this.uploadedReceipt || hasNewReceipt || hasExistingReceipt);
        if (status !== 'draft' && !hasUploaded) {
            missing.push('Receipt (upload a PDF or image)');
        }
        if (missing.length) {
            const msg = 'Required: ' + missing.join(', ');
            this.showToast(msg, 'error');
            if (typeof showAppMessage === 'function') showAppMessage('Cannot save income', msg, 'error');
            this._saving = false;
            return;
        }

        // Ensure profile loaded
        if (typeof AUTH !== 'undefined' && AUTH.init) {
            try { await AUTH.init(); } catch (e) {}
        }
        let fy = formData.get('financial_year_id') || null;
        if (fy === '') fy = null;
        // Auto-pick open financial year if form empty
        if (!fy && this.financialYears && this.financialYears.length) {
            const openY = this.financialYears.find(y => y.status === 'open') || this.financialYears[0];
            fy = openY?.id || null;
        }
        let pm = formData.get('payment_method_id') || null;
        if (pm === '') pm = null;
        let cat = categoryId || null;
        if (cat === '') cat = null;
        
        const year = new Date(date).getFullYear();
        const count = (this.data || []).filter(i => i.transaction_id?.startsWith(`INC-${year}`)).length + 1;
        const txnId = this.editingId
            ? (formData.get('transaction_id') || null)
            : `INC-${year}-${String(count).padStart(6, '0')}`;
        
        // Only columns that exist in core schema
        // Minimal payload — only required columns first
        const data = {
            date: date,
            amount: amount,
            source: source.trim(),
            approval_status: (status === 'draft') ? 'pending' : 'submitted'
        };
        if (cat) data.category_id = cat;
        if (pm) data.payment_method_id = pm;
        if (fy) data.financial_year_id = fy;
        const ref = formData.get('reference_number');
        if (ref) data.reference_number = ref;
        const desc = formData.get('description');
        if (desc) data.description = desc;
        const profileId = AUTH.getCurrentProfile()?.id;
        if (profileId) data.created_by = profileId;
            data.created_by_name = (AUTH.getCurrentProfile()?.full_name || AUTH.getCurrentProfile()?.email || 'User');
        if (txnId) data.transaction_id = txnId;
        
        // Soft duplicate guard (same amount+source in last 2 minutes)
        if (!this.editingId && typeof findRecentDuplicate === 'function') {
            const dup = await findRecentDuplicate('income', { amount: amount, source: source.trim() });
            if (dup && !confirm('A similar income was saved very recently. Save another one anyway?')) {
                this._saving = false;
                return;
            }
        }
        
        // Duplicate reference protection
        const refRaw = formData.get('reference_number') || document.getElementById('income-reference')?.value || '';
        if (refRaw && String(refRaw).trim()) {
            if (typeof checkDuplicateIncomeReference === 'function') {
                const dup = await checkDuplicateIncomeReference(refRaw, this.editingId);
                if (dup.duplicate) {
                    this._saving = false;
                    if (typeof showAppMessage === 'function') showAppMessage('Duplicate', dup.message, 'error');
                    else this.showToast(dup.message, 'error');
                    return;
                }
            }
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
            // Minimal insert only (matches working console test) — avoids numeric overflow
            const minimal = {
                date: data.date,
                amount: Number(amount),
                source: String(data.source || '').slice(0, 500),
                approval_status: data.approval_status || 'pending'
            };
            console.log('Income save payload', minimal);
            
            if (this.editingId) {
                result = pick(await supabase.from('income').update(minimal).eq('id', this.editingId).select());
            } else {
                result = pick(await supabase.from('income').insert(minimal).select());
            }
            
            // Optional fields in second step
            if (result.data && result.data.id) {
                const extra = {};
                const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                if (data.transaction_id) extra.transaction_id = String(data.transaction_id).slice(0, 50);
                if (data.description) extra.description = String(data.description).slice(0, 2000);
                if (data.reference_number) extra.reference_number = String(data.reference_number).slice(0, 100);
                if (isUuid(data.category_id)) extra.category_id = data.category_id;
                if (isUuid(data.payment_method_id)) extra.payment_method_id = data.payment_method_id;
                if (isUuid(data.financial_year_id)) extra.financial_year_id = data.financial_year_id;
                if (isUuid(data.created_by)) extra.created_by = data.created_by;
                if (Object.keys(extra).length) {
                    const up = await supabase.from('income').update(extra).eq('id', result.data.id).select();
                    if (up.error) console.warn('Extra fields skipped', up.error);
                    else if (up.data && up.data[0]) result.data = up.data[0];
                }
            }
        } catch (e) {
            result = { data: null, error: e };
        }
        this.setLoading(false);
        
        if (result.error || !result.data) {
            console.error('Income save error', result.error);
            const msg = (result.error && (result.error.message || result.error.details)) || 'Failed to save income.';
            this.showToast(msg, 'error');
            /* toast already shown */
            this._saving = false;
            return;
        }
        
        // Upload receipt — mandatory for non-draft
        if (this.uploadedReceipt) {
            const receiptResult = await Storage.uploadReceipt(
                this.uploadedReceipt,
                result.data.id,
                'income'
            );
            
            if (receiptResult.error) {
                console.error('Receipt upload failed', receiptResult.error);
                if (status !== 'draft') {
                    // Roll back incomplete transaction
                    try { await supabase.from('income').delete().eq('id', result.data.id); } catch (e) {}
                    this.showToast('Receipt upload failed. Transaction was not saved. Try again.', 'error');
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
                await supabase.from('income').update({ receipt_url: publicUrl }).eq('id', result.data.id);
                // Also register in receipts list with uploader name
                try {
                    const p = AUTH.getCurrentProfile?.();
                    await supabase.from('receipts').insert({
                        file_name: (path || publicUrl).toString().split('/').pop(),
                        file_url: publicUrl,
                        transaction_type: 'income',
                        transaction_id: result.data.transaction_id || result.data.id,
                        income_id: result.data.id,
                        uploaded_by: p?.id || null,
                        uploaded_by_name: p?.full_name || p?.email || 'User'
                    });
                } catch (e) {}
            }
        }
        
        if (typeof logAudit === 'function') {
            await logAudit(this.editingId ? 'INCOME_UPDATE' : 'INCOME_CREATE', 'income', result.data?.id, null, { amount: result.data?.amount, status: result.data?.approval_status, source: result.data?.source, category_id: result.data?.category_id, transaction_id: result.data?.transaction_id, date: result.data?.date });
        }
        try { this.modalInstance?.hide(); } catch (e) {}
        this.uploadedReceipt = null;
        try {
            const fi = document.getElementById('income-receipt');
            if (fi) fi.value = '';
            const prev = document.getElementById('income-receipt-preview');
            if (prev) prev.innerHTML = '';
        } catch (e) {}
        if (typeof showAppMessage === 'function') {
            showAppMessage('Success', 'Income saved successfully!', 'success');
        } else {
            this.showToast('Income saved successfully!', 'success');
        }
        try { await this.refresh(); } catch (e) { console.warn(e); }
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

    async viewIncome(id) {
        try {
        const item = this.data.find(d => d.id === id);
        if (!item) {
            this.showError('Record not found.');
            return;
        }
        
        const content = document.getElementById('income-view-content');
        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <dl class="row">
                        <dt class="col-sm-4">Transaction ID</dt>
                        <dd class="col-sm-8">${item.transaction_id || 'N/A'}</dd>
                        
                        <dt class="col-sm-4">Date</dt>
                        <dd class="col-sm-8">${formatDate(item.date)}</dd>
                        
                        <dt class="col-sm-4">Source</dt>
                        <dd class="col-sm-8">${this.escapeHtml(item.source)}</dd>
                        
                        <dt class="col-sm-4">Category</dt>
                        <dd class="col-sm-8">${this.resolveCategoryName(item.category_id) || item.category?.name || 'N/A'}</dd>
                        
                        <dt class="col-sm-4">Amount</dt>
                        <dd class="col-sm-8 text-success fw-bold">${formatCurrency(item.amount)}</dd>
                    </dl>
                </div>
                <div class="col-md-6">
                    <dl class="row">
                        <dt class="col-sm-4">Payment Method</dt>
                        <dd class="col-sm-8">${this.resolvePaymentName(item.payment_method_id) || item.payment_method?.name || 'N/A'}</dd>
                        
                        <dt class="col-sm-4">Reference</dt>
                        <dd class="col-sm-8">${item.reference_number || 'N/A'}</dd>
                        
                        <dt class="col-sm-4">Status</dt>
                        <dd class="col-sm-8"><span class="badge-status ${item.approval_status}">${item.approval_status}</span></dd>
                        
                        <dt class="col-sm-4">Created By</dt>
                        <dd class="col-sm-8">${this.resolveProfileName(item.created_by)}</dd>
                        
                        <dt class="col-sm-4">Received By</dt>
                        <dd class="col-sm-8">${this.resolveProfileName(item.received_by || item.created_by)}</dd>
                    </dl>
                </div>
            </div>
            ${item.description ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <strong>Description:</strong>
                        <p class="mt-1">${this.escapeHtml(item.description)}</p>
                    </div>
                </div>
            ` : ''}
            ${item.notes ? `
                <div class="row mt-2">
                    <div class="col-12">
                        <strong>Notes:</strong>
                        <p class="mt-1">${this.escapeHtml(item.notes)}</p>
                    </div>
                </div>
            ` : ''}
            ${item.receipt_url ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <strong>Receipt:</strong>
                        <div class="mt-2">
                            <a href="${(typeof Storage !== 'undefined' && Storage.resolveReceiptUrl) ? Storage.resolveReceiptUrl(item.receipt_url) : item.receipt_url}" 
                               target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary">
                                <i class="bi bi-file-earmark-pdf"></i> View Receipt
                            </a>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        if (!this.viewModalInstance) {
            const el = document.getElementById('income-view-modal');
            if (el && window.bootstrap) this.viewModalInstance = bootstrap.Modal.getOrCreateInstance(el);
        }
        if (this.viewModalInstance) this.viewModalInstance.show();
        const printBtn = document.getElementById('income-print-voucher');
        if (printBtn) {
            printBtn.onclick = () => printVoucher('income', item);
        }
        } catch (err) {
            console.error('viewIncome error', err);
            if (typeof showAppMessage === "function") showAppMessage("Error", "Could not open income details: " + (err.message || err), "error");
        }
    }
    
    
    async duplicateIncome(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) return;
        this.editingId = null;
        if (typeof this.openCreateModal === 'function') this.openCreateModal();
        else {
            const btn = document.getElementById('add-income-btn');
            if (btn) btn.click();
        }
        setTimeout(() => {
            const form = document.getElementById('income-form');
            if (!form) return;
            const set = (sel, val) => {
                const el = form.querySelector(sel);
                if (el && val != null && val !== '') el.value = val;
            };
            set('[name="date"], #income-date', item.date || new Date().toISOString().slice(0,10));
            set('[name="amount"], #income-amount', item.amount);
            set('[name="source"], #income-source', item.source || '');
            set('[name="description"], #income-description', item.description || '');
            set('[name="category_id"], #income-category', item.category_id || '');
            set('[name="payment_method_id"], #income-payment-method', item.payment_method_id || '');
            set('[name="reference_number"], #income-reference', item.reference_number || '');
            if (typeof showAppMessage === "function") showAppMessage("Ready", "Form filled from existing income. Review and Save.", "info");
        }, 250);
    }

    async deleteIncome(id) {
        if (!(await confirmPermanentDelete('Permanently delete this income record?'))) return;
        let error = null;
        try {
            let res = await supabase.from('income').delete().eq('id', id);
            error = res.error;
            if (error) {
                res = await supabase.from('income').update({ is_deleted: true }).eq('id', id);
                error = res.error;
            }
        } catch (e) { error = e; }
        if (error) {
            if (typeof showAppMessage === "function") showAppMessage("Delete failed", (error.message || String(error)), "error");
            return;
        }
        if (typeof logAudit === 'function') await logAudit('INCOME_DELETE', 'income', id, null, null);
        if (typeof showAppMessage === "function") showAppMessage("Success", "Income deleted successfully.", "success");
        this.data = (this.data || []).filter(r => r.id !== id);
        this.renderTable();
        this.updateStats();
        await this.refresh();
    }
    
    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) {
            this.uploadedReceipt = null;
            return;
        }
        
        // Validate file
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
        document.getElementById('income-receipt-preview').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-check text-success"></i>
                <span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
        `;
    }
    

    renderPagination(totalPages) {
        const ul = document.getElementById('income-pagination');
        const info = document.getElementById('income-pagination-info');
        if (info) {
            const start = this.data.length ? (this.currentPage - 1) * this.perPage + 1 : 0;
            const end = Math.min(this.currentPage * this.perPage, this.data.length);
            info.textContent = `Showing ${start}-${end} of ${this.data.length} records`;
        }
        if (!ul) return;
        const pages = Math.max(1, totalPages || 1);
        let html = `<li class="page-item ${this.currentPage <= 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="prev">Previous</a></li>`;
        for (let i = 1; i <= pages; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        html += `<li class="page-item ${this.currentPage >= pages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="next">Next</a></li>`;
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
            
            // Get all data (not just current page)
            // Use already-loaded rows (no joins)
            let data = this.data || [];
            if (!data.length) {
                const res = await supabase.from('income').select('*');
                if (res.error) throw res.error;
                data = (res.data || []).filter(r => r.is_deleted !== true);
            }
            
            const headers = ['Transaction ID', 'Date', 'Source', 'Category', 'Amount (ETB)', 'Payment Method', 'Reference', 'Description', 'Status'];
            const rows = data.map(item => [
                item.transaction_id || '',
                item.date || '',
                `"${(item.source || '').replace(/"/g, '""')}"`,
                `"${this.resolveCategoryName(item.category_id)}"`,
                item.amount || 0,
                `"${this.resolvePaymentName(item.payment_method_id)}"`,
                `"${(item.reference_number || '').replace(/"/g, '""')}"`,
                `"${(item.description || '').replace(/"/g, '""')}"`,
                item.approval_status || ''
            ]);
            
            const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            
            // Download
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'income_export_' + new Date().toISOString().slice(0,10) + '.csv';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
            if (typeof showAppMessage === "function") showAppMessage("Export", "Export completed! Check your Downloads folder.", "success");
            
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export data.', 'error');
        }
    }
    
    setLoading(loading) {
        this._saving = !!loading;
        const btns = ['income-submit-draft', 'income-submit-approval'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = loading;
                btn.textContent = loading ? 'Saving...' : (id === 'income-submit-draft' ? 'Save Draft' : 'Submit for Approval');
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
// Initialize Income Module
// ============================================================

if (document.getElementById('income-table-body')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Will be initialized by app.js
        console.log('Income module ready');
    });
}