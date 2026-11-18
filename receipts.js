
// ============================================================
// SELAM BERTU TESFA - Audit Evidence Register
// Advanced audit feature: evidence log + chain of custody
// ============================================================

class EvidenceModule {
    constructor() {
        if (window.__evidenceModuleInstance) {
            return window.__evidenceModuleInstance;
        }
        this.data = [];
        this.filters = { status: 'all', risk: 'all', search: '' };
        this.modal = null;
        this.editingId = null;
        this._saving = false;
        this._bound = false;
        window.__evidenceModuleInstance = this;
        this.init();
    }

    async init() {
        if (this._inited) return;
        this._inited = true;
        try {
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            const modalEl = document.getElementById('evidence-modal');
            if (modalEl && window.bootstrap) {
                this.modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            }
            this.bind();
            await this.loadData();
            this.render();
        } catch (e) {
            console.error('Evidence init', e);
            if (typeof showAppMessage === "function") showAppMessage("Notice", 'Failed to load evidence register.', "info"); else console.log('Failed to load evidence register.');
        }
    }

    bind() {
        if (this._bound) return;
        this._bound = true;
        document.getElementById('evidence-add-btn')?.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); this.openCreate();
        });
        document.getElementById('evidence-save-btn')?.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); this.save();
        });
        document.getElementById('ev-refresh-btn')?.addEventListener('click', (e) => {
            e.preventDefault(); this.refresh();
        });
        document.getElementById('ev-filter-status')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value; this.render();
        });
        document.getElementById('ev-filter-risk')?.addEventListener('change', (e) => {
            this.filters.risk = e.target.value; this.render();
        });
        document.getElementById('ev-search')?.addEventListener('input', (e) => {
            this.filters.search = (e.target.value || '').trim(); this.render();
        });
    }

    async loadData() {
        let res = await supabase.from('audit_evidence').select('*').order('created_at', { ascending: false });
        if (res.error) {
            res = await supabase.from('audit_evidence').select('*');
        }
        if (res.error) {
            console.warn(res.error);
            this.data = [];
            return;
        }
        this.data = res.data || [];
    }

    filtered() {
        let rows = this.data.slice();
        if (this.filters.status !== 'all') {
            rows = rows.filter(r => (r.status || '') === this.filters.status);
        }
        if (this.filters.risk !== 'all') {
            rows = rows.filter(r => (r.risk_level || '') === this.filters.risk);
        }
        if (this.filters.search) {
            const q = this.filters.search.toLowerCase();
            rows = rows.filter(r =>
                String(r.reference_code || '').toLowerCase().includes(q) ||
                String(r.title || '').toLowerCase().includes(q) ||
                String(r.entity || '').toLowerCase().includes(q) ||
                String(r.collected_by_name || '').toLowerCase().includes(q) ||
                String(r.description || '').toLowerCase().includes(q)
            );
        }
        return rows;
    }

    updateStats(rows) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('ev-total', rows.length);
        set('ev-verified', rows.filter(r => r.status === 'verified').length);
        set('ev-pending', rows.filter(r => r.status === 'collected' || r.status === 'exception').length);
        set('ev-risk', rows.filter(r => r.risk_level === 'high').length);
    }

    render() {
        const tbody = document.getElementById('evidence-table-body');
        if (!tbody) return;
        const rows = this.filtered();
        this.updateStats(this.data);

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No evidence recorded yet. Click <strong>Add Evidence</strong> to start the audit trail.</td></tr>';
            return;
        }

        const riskBadge = (r) => {
            const c = r === 'high' ? 'danger' : (r === 'medium' ? 'warning' : 'success');
            return '<span class="badge bg-' + c + '">' + (r || 'low') + '</span>';
        };
        const statusBadge = (s) => {
            const map = { collected: 'secondary', verified: 'success', exception: 'warning', archived: 'dark' };
            return '<span class="badge bg-' + (map[s] || 'secondary') + '">' + (s || 'collected') + '</span>';
        };

        tbody.innerHTML = rows.map(r => {
            const when = r.collected_at || r.created_at || '';
            const whenStr = when ? (typeof formatDateTime === 'function' ? formatDateTime(when) : String(when).slice(0, 16)) : '—';
            return '<tr>' +
                '<td><code>' + (r.reference_code || '—') + '</code></td>' +
                '<td>' + this.esc(r.title) + '</td>' +
                '<td>' + this.esc(r.evidence_type || 'document') + '</td>' +
                '<td>' + this.esc(r.entity || 'general') + '</td>' +
                '<td>' + riskBadge(r.risk_level) + '</td>' +
                '<td>' + statusBadge(r.status) + '</td>' +
                '<td>' + this.esc(r.collected_by_name || '—') + '</td>' +
                '<td>' + whenStr + '</td>' +
                '<td class="text-nowrap">' +
                '<button type="button" class="btn btn-sm btn-outline-primary ev-view" data-id="' + r.id + '" title="View"><i class="bi bi-eye"></i></button> ' +
                (r.status !== 'verified' ? '<button type="button" class="btn btn-sm btn-outline-success ev-verify" data-id="' + r.id + '" title="Mark verified"><i class="bi bi-check2"></i></button> ' : '') +
                (this.canDeleteEvidence(r) ? '<button type="button" class="btn btn-sm btn-outline-danger ev-del" data-id="' + r.id + '" title="Delete"><i class="bi bi-trash"></i></button>' : '') +
                '</td></tr>';
        }).join('');

        tbody.querySelectorAll('.ev-view').forEach(b => b.addEventListener('click', () => this.view(b.dataset.id)));
        tbody.querySelectorAll('.ev-verify').forEach(b => b.addEventListener('click', () => this.verify(b.dataset.id)));
        tbody.querySelectorAll('.ev-del').forEach(b => b.addEventListener('click', () => this.remove(b.dataset.id)));
    }

    esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    openCreate() {
        this.editingId = null;
        document.getElementById('evidence-modal-title').textContent = 'Add Audit Evidence';
        document.getElementById('evidence-form')?.reset();
        document.getElementById('evidence-id').value = '';
        this.modal?.show();
    }

    view(id) {
        const r = this.data.find(x => String(x.id) === String(id));
        if (!r) return;
        const details =
            'Ref: ' + (r.reference_code || '') + '\n' +
            'Title: ' + (r.title || '') + '\n' +
            'Type: ' + (r.evidence_type || '') + '\n' +
            'Entity: ' + (r.entity || '') + '\n' +
            'Risk: ' + (r.risk_level || '') + '\n' +
            'Status: ' + (r.status || '') + '\n' +
            'Collected by: ' + (r.collected_by_name || '') + '\n' +
            'Source: ' + (r.source_location || '') + '\n\n' +
            (r.description || '');
        if (typeof showAppMessage === 'function') {
            showAppMessage(r.title || 'Evidence', details.replace(/\n/g, '<br>'), 'info');
        } else {
            console.log(details);
        }
    }

    async verify(id) {
        const profile = AUTH.getCurrentProfile?.();
        const { error } = await supabase.from('audit_evidence').update({
            status: 'verified',
            verified_by_name: profile?.full_name || profile?.email || 'Reviewer',
            verified_at: new Date().toISOString()
        }).eq('id', id);
        if (error) {
            if (typeof showAppMessage === 'function') showAppMessage('Verify failed', (error.message || String(error)), 'error');
            else console.error(error);
            return;
        }
        if (typeof logAudit === 'function') await logAudit('EVIDENCE_VERIFY', 'audit_evidence', id, null, null);
        await this.refresh();
        if (typeof showAppMessage === 'function') showAppMessage('Verified', 'Evidence marked as verified.', 'success');
    }

    canDeleteEvidence(r) {
        const profile = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
        if (!profile || !r) return false;
        // Only the person who collected this evidence may delete it
        if (r.collected_by && profile.id && String(r.collected_by) === String(profile.id)) return true;
        if (r.collected_by_name && profile.full_name &&
            String(r.collected_by_name).toLowerCase() === String(profile.full_name).toLowerCase()) return true;
        if (r.collected_by_name && profile.email &&
            String(r.collected_by_name).toLowerCase() === String(profile.email).toLowerCase()) return true;
        return false;
    }

    async remove(id) {
        const r = this.data.find(x => String(x.id) === String(id));
        if (!r) return;
        if (!this.canDeleteEvidence(r)) {
            if (typeof showAppMessage === "function") showAppMessage("Notice", 'You can only delete evidence that you collected. Others\' evidence cannot be deleted.', "info"); else console.log('You can only delete evidence that you collected. Others\' evidence cannot be deleted.');
            return;
        }
        if (!(await confirmPermanentDelete('Permanently delete this evidence record?'))) return;
        const { error } = await supabase.from('audit_evidence').delete().eq('id', id);
        if (error) {
            if (typeof showAppMessage === "function") showAppMessage("Delete failed", (error.message || String(error)), "error");
            return;
        }
        if (typeof logAudit === 'function') await logAudit('EVIDENCE_DELETE', 'audit_evidence', id, null, null);
        await this.refresh();
    }

    async save() {
        if (this._saving) return;
        const title = (document.getElementById('ev-title')?.value || '').trim();
        if (!title) {
            if (typeof showAppMessage === "function") showAppMessage("Notice", 'Title is required.', "info"); else console.log('Title is required.');
            return;
        }
        this._saving = true;
        const saveBtn = document.getElementById('evidence-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        const profile = AUTH.getCurrentProfile?.();
        const year = new Date().getFullYear();
        const ref = 'EVD-' + year + '-' + String(Date.now()).slice(-6);

        const row = {
            reference_code: ref,
            title: title,
            evidence_type: document.getElementById('ev-type')?.value || 'document',
            entity: document.getElementById('ev-entity')?.value || 'general',
            risk_level: document.getElementById('ev-risk')?.value || 'low',
            status: document.getElementById('ev-status')?.value || 'collected',
            description: document.getElementById('ev-description')?.value || '',
            source_location: document.getElementById('ev-source')?.value || '',
            collected_by: profile?.id || null,
            collected_by_name: profile?.full_name || profile?.email || 'User',
            collected_at: new Date().toISOString()
        };

        // Optional file upload
        const fileInput = document.getElementById('ev-file');
        const file = fileInput?.files?.[0];
        if (file) {
            try {
                const path = 'evidence/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const up = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
                if (!up.error) {
                    const { data: pub } = supabase.storage.from('receipts').getPublicUrl(path);
                    row.file_url = pub?.publicUrl || path;
                    row.file_name = file.name;
                }
            } catch (e) { console.warn(e); }
        }

        let data = null, error = null;
        try {
            const ins = await supabase.from('audit_evidence').insert(row).select();
            data = ins.data; error = ins.error;
            if (error) {
                const min = {
                    title: row.title,
                    evidence_type: row.evidence_type,
                    status: row.status,
                    collected_by_name: row.collected_by_name
                };
                const ins2 = await supabase.from('audit_evidence').insert(min).select();
                data = ins2.data; error = ins2.error;
            }
        } catch (err) {
            error = err;
        }
        if (error) {
            this._saving = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Evidence'; }
            if (typeof showAppMessage === "function") showAppMessage("Notice", 'Save failed: ' + (error.message || error) + '\n\nRun FIX_AUDIT_EVIDENCE.sql in Supabase SQL Editor.', "info"); else console.log('Save failed: ' + (error.message || error) + '\n\nRun FIX_AUDIT_EVIDENCE.sql in Supabase SQL Editor.');
            return;
        }
        if (typeof logAudit === 'function') {
            await logAudit('EVIDENCE_CREATE', 'audit_evidence', data?.[0]?.id, null, { title });
        }
        this.modal?.hide();
        await this.refresh();
        this._saving = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Evidence'; }
        if (typeof showAppMessage === 'function') {
            showAppMessage('Saved', 'Evidence recorded by ' + row.collected_by_name, 'success');
        } else {
            console.log('Evidence saved. Collected by: ' + row.collected_by_name);
        }
    }

    async refresh() {
        await this.loadData();
        this.render();
    }
}

// Single entry for app.js — never start twice
class ReceiptsModule {
    constructor() {
        if (window.__evidenceModuleInstance) {
            return window.__evidenceModuleInstance;
        }
        const inst = new EvidenceModule();
        window.__evidenceModuleInstance = inst;
        window.receiptsModule = inst;
        return inst;
    }
}

// Fallback only if app.js did not start it
document.addEventListener('DOMContentLoaded', () => {
    if (!window.__evidenceModuleInstance &&
        (document.getElementById('evidence-table-body') || document.getElementById('receipts-table-body'))) {
        window.__evidenceModuleInstance = new EvidenceModule();
        window.receiptsModule = window.__evidenceModuleInstance;
    }
});
