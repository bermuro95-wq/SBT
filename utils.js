// ============================================================
// SELAM BERTU TESFA - Utility Functions
// ============================================================

// ============================================================
// String Utilities
// ============================================================

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str, length = 50, suffix = '...') {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
}

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// Date Utilities
// ============================================================

function formatDate(date, format = 'short') {
    const d = new Date(date);
    
    if (format === 'short') {
        return d.toLocaleDateString('en-ET', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    if (format === 'long') {
        return d.toLocaleDateString('en-ET', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    if (format === 'iso') {
        return d.toISOString();
    }
    
    return d.toLocaleDateString('en-ET');
}

function formatDateTime(date) {
    return new Date(date).toLocaleString('en-ET', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-ET', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month] || '';
}

function getMonthShort(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] || '';
}

function isToday(date) {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
}

function isThisWeek(date) {
    const now = new Date();
    const d = new Date(date);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    return d >= weekStart && d <= now;
}

function isThisMonth(date) {
    const now = new Date();
    const d = new Date(date);
    return d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
}

function isThisYear(date) {
    const now = new Date();
    const d = new Date(date);
    return d.getFullYear() === now.getFullYear();
}

// ============================================================
// Number Utilities
// ============================================================

function formatCurrency(amount, currency = 'ETB') {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return `${currency} 0.00`;
    }
    return `${currency} ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatNumber(number, decimals = 0) {
    if (number === null || number === undefined || isNaN(number)) {
        return '0';
    }
    return Number(number).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function percentOf(total, amount) {
    if (!total || total === 0) return 0;
    return (amount / total) * 100;
}

function roundTo(value, decimals = 2) {
    return Number(Math.round(parseFloat(value + 'e' + decimals)) + 'e-' + decimals);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ============================================================
// Array Utilities
// ============================================================

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

function sumBy(array, key) {
    return array.reduce((sum, item) => sum + (item[key] || 0), 0);
}

function averageBy(array, key) {
    if (array.length === 0) return 0;
    return sumBy(array, key) / array.length;
}

function unique(array, key = null) {
    if (key) {
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    }
    return [...new Set(array)];
}

function sortBy(array, key, direction = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function paginate(array, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
        items: array.slice(start, end),
        total: array.length,
        page,
        perPage,
        totalPages: Math.ceil(array.length / perPage)
    };
}

// ============================================================
// Object Utilities
// ============================================================

function pick(obj, keys) {
    return keys.reduce((result, key) => {
        if (key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return !obj;
}

// ============================================================
// DOM Utilities
// ============================================================

function $(selector, context = document) {
    return context.querySelector(selector);
}

function $$(selector, context = document) {
    return [...context.querySelectorAll(selector)];
}

function createElement(tag, className = '', attributes = {}, children = []) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    
    Object.keys(attributes).forEach(key => {
        el.setAttribute(key, attributes[key]);
    });
    
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else {
            el.appendChild(child);
        }
    });
    
    return el;
}

function showElement(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.classList.remove('d-none');
}

function hideElement(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.classList.add('d-none');
}

function toggleElement(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.classList.toggle('d-none');
}

function setLoading(el, loading = true) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    
    if (loading) {
        el.dataset.originalText = el.textContent;
        el.textContent = 'Loading...';
        el.disabled = true;
        el.classList.add('opacity-50');
    } else {
        el.textContent = el.dataset.originalText || '';
        el.disabled = false;
        el.classList.remove('opacity-50');
        delete el.dataset.originalText;
    }
}

// ============================================================
// URL Utilities
// ============================================================

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

function getUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
}

function buildUrl(base, params) {
    const url = new URL(base, window.location.origin);
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        }
    });
    return url.toString();
}

// ============================================================
// Validation Utilities
// ============================================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^\+?[\d\s-]{7,15}$/.test(phone);
}

function isValidAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
}

function isValidDate(date) {
    return !isNaN(new Date(date).getTime());
}

function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

// ============================================================
// Export
// ============================================================

window.utils = {
    // String
    capitalize,
    truncate,
    slugify,
    escapeHtml,
    
    // Date
    formatDate,
    formatDateTime,
    formatTime,
    getMonthName,
    getMonthShort,
    isToday,
    isThisWeek,
    isThisMonth,
    isThisYear,
    
    // Number
    formatCurrency,
    formatNumber,
    percentOf,
    roundTo,
    clamp,
    
    // Array
    groupBy,
    sumBy,
    averageBy,
    unique,
    sortBy,
    paginate,
    
    // Object
    pick,
    omit,
    deepClone,
    isEmpty,
    
    // DOM
    $,
    $$,
    createElement,
    showElement,
    hideElement,
    toggleElement,
    setLoading,
    
    // URL
    getUrlParams,
    getUrlParam,
    buildUrl,
    
    // Validation
    isValidEmail,
    isValidPhone,
    isValidAmount,
    isValidDate,
    isNumeric
};
// ============================================================
// Real audit + notification helpers (Supabase-backed)
// Prefer SECURITY DEFINER RPC for trustworthiness.
// Never store passwords, tokens, or session secrets.
// ============================================================

function _auditSeverity(action, result) {
    const a = String(action || '').toUpperCase();
    const r = String(result || 'success').toLowerCase();
    if (r === 'failure' || r === 'failed' || r === 'denied' || r === 'unauthorized') {
        if (a.includes('LOGIN') || a.includes('AUTH') || a.includes('PERMISSION') || a.includes('UNAUTHORIZED'))
            return 'suspicious';
        return 'warning';
    }
    if (a.includes('DELETE') || a.includes('ROLE') || a.includes('PERMISSION') || a.includes('USER_') || a.includes('SETTINGS'))
        return 'warning';
    if (a.includes('LOGIN_FAILED') || a.includes('TAMPER') || a.includes('BYPASS'))
        return 'critical';
    return 'info';
}

function _safeJson(val) {
    if (val == null) return null;
    try {
        if (typeof val === 'string') return val.slice(0, 4000);
        return JSON.parse(JSON.stringify(val, (k, v) => {
            const key = String(k).toLowerCase();
            if (key.includes('password') || key.includes('token') || key.includes('secret') ||
                key.includes('cookie') || key.includes('authorization') || key === 'anon_key')
                return '[REDACTED]';
            return v;
        }));
    } catch (e) {
        return { _note: 'value not serializable' };
    }
}

function _toUuidOrNull(id) {
    if (id == null || id === '') return null;
    const s = String(id);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;
    return null;
}

/**
 * Reliable audit writer — persists to Supabase audit_logs.
 * Works with original schema AND migration 004. Never stores passwords/tokens.
 */
async function logAudit(action, entity, entityId, oldValue, newValue, metadata, result) {
    try {
        const actor = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? (AUTH.getCurrentProfile() || {}) : {};
        const actorUser = (typeof AUTH !== 'undefined' && AUTH.getCurrentUser) ? (AUTH.getCurrentUser() || {}) : {};
        const actorName = actor.full_name || actor.email || actorUser.email || 'System';
        const actorEmail = actor.email || actorUser.email || null;
        const actorRole = actor.role || actor.role_name || null;
        const nowIso = new Date().toISOString();

        if (typeof supabase === 'undefined') {
            console.warn('logAudit: supabase not ready');
            return null;
        }

        let profile = null;
        try {
            if (typeof AUTH !== 'undefined') {
                profile = AUTH.getCurrentProfile ? AUTH.getCurrentProfile() : (AUTH.currentProfile || null);
            }
        } catch (e) {}

        const actionStr = String(action || 'ACTION').slice(0, 100);
        const entityStr = entity != null ? String(entity).slice(0, 100) : null;
        const entityUuid = _toUuidOrNull(entityId);
        const resultStr = String(result || 'success').toLowerCase();
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? String(navigator.userAgent).slice(0, 500) : null;
        const userName = profile?.full_name || profile?.email || null;
        const userId = profile?.id || null;
        const now = new Date().toISOString();

        let meta = _safeJson(metadata);
        if (meta == null || typeof meta !== 'object') meta = {};
        meta = Object.assign({}, meta, {
            client_ts: now,
            path: (typeof location !== 'undefined') ? location.pathname : null
        });
        if (entityId != null && !entityUuid) meta.entity_id_raw = String(entityId).slice(0, 120);

        // 1) Original 7-arg RPC (works without migration 004)
        try {
            const { data: rpcId, error: rpcErr } = await supabase.rpc('write_audit_log', {
                p_action: actionStr,
                p_entity: entityStr,
                p_entity_id: entityUuid,
                p_old: _safeJson(oldValue),
                p_new: _safeJson(newValue),
                p_metadata: meta,
                p_result: resultStr
            });
            if (!rpcErr && rpcId) return [{ id: rpcId }];
            if (rpcErr) console.warn('write_audit_log RPC:', rpcErr.message || rpcErr);
        } catch (rpcEx) {
            console.warn('write_audit_log RPC exception', rpcEx);
        }

        // 2) Direct insert — core columns only
        const core = {
            action: actionStr,
            entity: entityStr || actionStr,
            result: resultStr,
            timestamp: now,
            created_at: now
        };
        if (userId) core.user_id = userId;
        if (entityUuid) core.entity_id = entityUuid;
        // Who
        if (typeof actorName !== 'undefined' && actorName) core.user_name = actorName;
        else if (userName) core.user_name = userName;
        if (typeof actorRole !== 'undefined' && actorRole) core.role_at_event = actorRole;
        if (typeof actorEmail !== 'undefined' && actorEmail) {
            meta = Object.assign({}, meta, { email: actorEmail });
        }
        // What (human summary stored in details when column allows)
        try {
            core.details = typeof meta === 'object' ? meta : { info: String(meta || '') };
        } catch (e) {}

        let res = await supabase.from('audit_logs').insert(core).select('id');
        if (!res.error && res.data) return res.data;

        // 3) With user_name if available
        if (res.error && userName) {
            const withName = Object.assign({}, core, { user_name: userName });
            res = await supabase.from('audit_logs').insert(withName).select('id');
            if (!res.error && res.data) return res.data;
        }

        // 4) Absolute minimum
        if (res.error) {
            res = await supabase.from('audit_logs').insert({
                action: actionStr,
                entity: entityStr || actionStr,
                result: resultStr
            , user_name: (typeof actorName!=='undefined'?actorName:((typeof AUTH!=='undefined'&&AUTH.getCurrentProfile&&AUTH.getCurrentProfile())?(AUTH.getCurrentProfile().full_name||AUTH.getCurrentProfile().email):'System'))}).select('id');
            if (!res.error && res.data) return res.data;
        }

        if (res.error) {
            console.warn('Audit insert failed after all attempts:', res.error.message || res.error);
        }
        return res.data || null;
    } catch (e) {
        console.warn('Audit log failed', e);
        return null;
    }
}

async function logFailedLogin(email, reason) {
    try {
        if (typeof supabase === 'undefined') return null;
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0, 500) : null;
        const emailSafe = String(email || '').slice(0, 120);
        const reasonSafe = String(reason || 'invalid_credentials').slice(0, 100);

        try {
            const { data, error } = await supabase.rpc('write_failed_login_audit', {
                p_email: emailSafe,
                p_ip: null,
                p_user_agent: ua,
                p_reason: reasonSafe
            });
            if (!error && data) return data;
        } catch (e) {}

        // Fallback via original RPC as generic event
        try {
            const { data, error } = await supabase.rpc('write_audit_log', {
                p_action: 'LOGIN_FAILED',
                p_entity: 'auth',
                p_entity_id: null,
                p_old: null,
                p_new: null,
                p_metadata: { email_attempted: emailSafe, reason: reasonSafe },
                p_result: 'failure'
            });
            if (!error && data) return data;
        } catch (e) {}

        let res = await supabase.from('audit_logs').insert({
            action: 'LOGIN_FAILED',
            entity: 'auth',
            result: 'failure',
            timestamp: new Date().toISOString()
        }).select('id');
        if (res.error) console.warn('Failed-login audit:', res.error.message || res.error);
        return res.data;
    } catch (e) {
        console.warn('Failed-login audit error', e);
        return null;
    }
}

async function notifyUser(userId, title, message, type, link) {
    try {
        if (!userId) return;
        await supabase.from('notifications').insert({
            user_id: userId,
            title: title,
            message: message,
            type: type || 'info',
            link: link || null
        });
    } catch (e) {
        console.warn('Notification failed', e);
    }
}

async function notifyAdmins(title, message, type, link) {
    try {
        if (typeof supabase === 'undefined') return;
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'administrator')
            .eq('status', 'active');
        if (!admins || !admins.length) return;
        await supabase.from('notifications').insert(admins.map(a => ({
            user_id: a.id,
            title: title,
            message: message,
            type: type || 'warning',
            link: link || 'audit-logs.html'
        })));
    } catch (e) {
        console.warn('notifyAdmins failed', e);
    }
}

window.logAudit = logAudit;
window.logFailedLogin = logFailedLogin;
window.notifyUser = notifyUser;
window.notifyAdmins = notifyAdmins;


// ============================================================
// Period lock + print voucher (additive)
// ============================================================

async function checkPeriodLock(dateStr) {
    try {
        if (!dateStr || typeof supabase === 'undefined') return { locked: false };
        const { data: years } = await supabase.from('financial_years').select('*').eq('status', 'closed');
        if (!years || !years.length) return { locked: false };
        const d = String(dateStr).slice(0, 10);
        for (const y of years) {
            const a = String(y.start_date || '').slice(0, 10);
            const b = String(y.end_date || '').slice(0, 10);
            if (a && b && d >= a && d <= b) {
                return { locked: true, year: y };
            }
        }
        return { locked: false };
    } catch (e) {
        return { locked: false };
    }
}

function printVoucher(type, item) {
    const org = 'SELAM BERTU TESFA ORGANIZATION';
    const title = type === 'income' ? 'INCOME VOUCHER' : 'EXPENSE VOUCHER';
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { if (typeof showAppMessage === "function") showAppMessage("Pop-up blocked", "Please allow pop-ups to print.", "warning"); return; }
    const amount = item.amount != null ? Number(item.amount).toFixed(2) : '0.00';
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#1a1a2e}
      .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1a4d7a;padding-bottom:12px;margin-bottom:16px}
      .logo{max-height:64px}
      h1{font-size:18px;margin:0;color:#0d2b4a}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      td,th{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
      th{background:#f0f4f8}
      .amt{font-size:20px;font-weight:700;color:#1a4d7a}
      .foot{margin-top:32px;display:flex;justify-content:space-between}
      .sign{width:40%;border-top:1px solid #333;margin-top:48px;padding-top:6px;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>
    <div class="head">
      <div>
        <h1>${org}</h1>
        <div style="color:#6c757d;font-size:12px">Financial Management System</div>
      </div>
      <img class="logo" src="assets/images/logo.png" onerror="this.style.display='none'" />
    </div>
    <h2 style="margin:0 0 8px;color:#1a4d7a">${title}</h2>
    <table>
      <tr><th>Transaction ID</th><td>${item.transaction_id || item.id || '—'}</td></tr>
      <tr><th>Date</th><td>${item.date || '—'}</td></tr>
      <tr><th>${type==='income'?'Source':'Vendor'}</th><td>${item.source || item.vendor || '—'}</td></tr>
      <tr><th>Description</th><td>${item.description || '—'}</td></tr>
      <tr><th>Status</th><td>${item.approval_status || item.status || '—'}</td></tr>
      <tr><th>Amount (ETB)</th><td class="amt">${amount}</td></tr>
    </table>
    <div class="foot">
      <div class="sign">Prepared by</div>
      <div class="sign">Approved by</div>
    </div>
    <p style="margin-top:24px"><button onclick="window.print()">Print</button></p>
    </body></html>`);
    w.document.close();
}

window.checkPeriodLock = checkPeriodLock;
window.printVoucher = printVoucher;


// ============================================================
// Global UI feedback (toast + modal-style alerts) — no redesign
// ============================================================

function ensureToastHost() {
    let host = document.getElementById('sbt-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'sbt-toast-host';
        host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;';
        document.body.appendChild(host);
    }
    return host;
}

function showAppMessage(title, message, type) {
    type = type || 'info';
    const colors = {
        success: { bg: '#198754', border: '#146c43', text: '#fff', icon: '✓' },
        error: { bg: '#dc3545', border: '#b02a37', text: '#fff', icon: '!' },
        warning: { bg: '#ffc107', border: '#ffca2c', text: '#000', icon: '⚠' },
        info: { bg: '#0d6efd', border: '#0a58ca', text: '#fff', icon: 'i' }
    };
    const c = colors[type] || colors.info;
    const host = ensureToastHost();
    // Only ONE notification at a time
    try { host.innerHTML = ''; } catch (e) {}
    const el = document.createElement('div');
    el.style.cssText = 'background:' + c.bg + ';border:2px solid ' + c.border + ';color:' + c.text +
        ';padding:16px 18px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.25);font-size:15px;' +
        'min-width:280px;animation:sbtSlideIn .35s ease;display:flex;gap:12px;align-items:flex-start;max-width:380px;';
    // Escape to prevent XSS; allow simple <br> for multi-line messages
    const safeTitle = (typeof escapeHtml === 'function' ? escapeHtml(title || '') : String(title || '').replace(/</g, '&lt;'));
    let safeMsg = (typeof escapeHtml === 'function' ? escapeHtml(String(message || '')) : String(message || '').replace(/</g, '&lt;'));
    safeMsg = safeMsg.replace(/\n/g, '<br>').replace(/&lt;br&gt;/gi, '<br>');
    el.innerHTML = '<div style="font-size:22px;font-weight:800;line-height:1;flex-shrink:0;">' + c.icon + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-weight:800;margin-bottom:4px;font-size:16px;">' + safeTitle + '</div>' +
        '<div style="opacity:.95;word-break:break-word">' + safeMsg + '</div></div>' +
        '<button type="button" style="background:transparent;border:0;color:inherit;font-size:18px;cursor:pointer;opacity:.8;flex-shrink:0" aria-label="Close">×</button>';
    if (!document.getElementById('sbt-toast-style')) {
        const st = document.createElement('style');
        st.id = 'sbt-toast-style';
        st.textContent = '@keyframes sbtSlideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(st);
    }
    el.querySelector('button')?.addEventListener('click', () => el.remove());
    host.appendChild(el);
    setTimeout(function() { try { el.remove(); } catch (e) {} }, type === 'success' ? 4500 : 7000);
    if (type === 'error') console.error(title, message);
    else console.log(title, message);
}

window.showAppMessage = showAppMessage;
window.showToast = function(titleOrMsg, msgOrType, maybeType) {
    // Support showToast(msg), showToast(title, msg), showToast(msg, type), showToast(title, msg, type)
    if (maybeType) {
        showAppMessage(titleOrMsg, msgOrType, maybeType);
    } else if (msgOrType === 'success' || msgOrType === 'error' || msgOrType === 'warning' || msgOrType === 'info') {
        showAppMessage(msgOrType === 'success' ? 'Success' : (msgOrType === 'error' ? 'Error' : 'Notice'), titleOrMsg, msgOrType);
    } else if (msgOrType) {
        showAppMessage(titleOrMsg, msgOrType, 'info');
    } else {
        showAppMessage('Notice', titleOrMsg, 'info');
    }
};


// ============================================================
// Advanced helpers (no redesign)
// ============================================================

async function findRecentDuplicate(table, match) {
    try {
        let q = supabase.from(table).select('id, created_at').limit(5);
        Object.keys(match || {}).forEach(k => {
            if (match[k] != null && match[k] !== '') q = q.eq(k, match[k]);
        });
        const { data } = await q;
        if (!data || !data.length) return null;
        const recent = data.find(r => {
            const t = new Date(r.created_at).getTime();
            return Date.now() - t < 2 * 60 * 1000; // last 2 minutes
        });
        return recent || null;
    } catch (e) {
        return null;
    }
}

function flashPageTitle(msg) {
    const old = document.title;
    document.title = msg + ' — ' + old;
    setTimeout(() => { document.title = old; }, 2500);
}

window.findRecentDuplicate = findRecentDuplicate;
window.flashPageTitle = flashPageTitle;


// ============================================================
// Permanent delete: re-auth with email + password
// ============================================================
async function confirmPermanentDelete(warningText) {
    const msg = (warningText || 'This will permanently delete data.') +
        '\n\nEnter your login email and password to confirm.';
    const email = prompt(msg + '\n\nEmail:');
    if (email === null) return false;
    const password = prompt('Password:');
    if (password === null) return false;
    const em = String(email || '').trim();
    const pw = String(password || '');
    if (!em || !pw) {
        if (typeof showAppMessage === "function") showAppMessage("Required", "Email and password are required.", "warning");
        return false;
    }
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error || !data?.session) {
            if (typeof showAppMessage === "function") showAppMessage("Authentication failed", (error?.message || "Invalid email or password.") + " Delete cancelled.", "error");
            return false;
        }
        // Keep current session (sign-in refreshes same user or switches — restore preferred session is complex;
        // require matching current user email)
        const profile = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile() : null;
        const currentEmail = (profile?.email || data.user?.email || '').toLowerCase();
        if (em.toLowerCase() !== currentEmail && profile?.email) {
            if (typeof showAppMessage === "function") showAppMessage("Mismatch", "Email must match the currently logged-in account.", "error");
            return false;
        }
        return true;
    } catch (e) {
        if (typeof showAppMessage === "function") showAppMessage("Authentication error", (e.message || String(e)), "error");
        return false;
    }
}
window.confirmPermanentDelete = confirmPermanentDelete;



// Global show/hide password for any .toggle-pw button
(function () {
    function wirePasswordToggles(root) {
        (root || document).querySelectorAll('.toggle-pw').forEach(function (btn) {
            if (btn.dataset.pwWired) return;
            btn.dataset.pwWired = '1';
            btn.setAttribute('type', 'button');
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var id = btn.getAttribute('data-target');
                var input = id ? document.getElementById(id) : btn.parentElement && btn.parentElement.querySelector('input');
                if (!input) return;
                var show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                var icon = btn.querySelector('i');
                if (icon) icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
            });
        });
    }
    document.addEventListener('DOMContentLoaded', function () { wirePasswordToggles(document); });
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.toggle-pw');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-target');
        var input = id ? document.getElementById(id) : null;
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        var icon = btn.querySelector('i');
        if (icon) icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    }, true);
    window.wirePasswordToggles = wirePasswordToggles;
})();


/** Only admin-approved income/expense counts toward financial totals */
function isApprovedFinancial(item) {
    if (!item) return false;
    const s = String(item.approval_status || item.status || '').toLowerCase().trim();
    return s === 'approved';
}
function sumApprovedAmount(rows) {
    return (rows || []).filter(isApprovedFinancial).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}


// ============================================================
// Financial integrity helpers
// ============================================================
function normalizeReferenceNumber(ref) {
    return String(ref || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeVendorName(v) {
    return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check income duplicate by normalized reference_number.
 * Returns { duplicate: boolean, message?: string, row?: object }
 */
async function checkDuplicateIncomeReference(referenceNumber, excludeId) {
    const norm = normalizeReferenceNumber(referenceNumber);
    if (!norm) return { duplicate: false };
    try {
        let q = supabase.from('income').select('id, reference_number, transaction_id, amount, date, source')
            .eq('reference_normalized', norm);
        const { data, error } = await q;
        let rows = data || [];
        if (error || !rows.length) {
            // Fallback without normalized column
            const all = await supabase.from('income').select('id, reference_number, transaction_id, amount, date, source, is_deleted');
            rows = (all.data || []).filter(r => r.is_deleted !== true && normalizeReferenceNumber(r.reference_number) === norm);
        } else {
            rows = rows.filter(r => true);
        }
        if (excludeId) rows = rows.filter(r => String(r.id) !== String(excludeId));
        if (rows.length) {
            return {
                duplicate: true,
                row: rows[0],
                message: 'Duplicate Transaction: This Reference Number has already been registered for income. Please check the existing transaction (' + (rows[0].transaction_id || rows[0].reference_number || rows[0].id) + ').'
            };
        }
    } catch (e) {
        console.warn('dup income check', e);
    }
    return { duplicate: false };
}

/**
 * Check expense duplicate by reference + vendor (normalized)
 */
async function checkDuplicateExpenseReference(referenceNumber, vendor, excludeId) {
    const norm = normalizeReferenceNumber(referenceNumber);
    const vend = normalizeVendorName(vendor);
    if (!norm) return { duplicate: false };
    try {
        const all = await supabase.from('expenses').select('id, reference_number, vendor, transaction_id, amount, date, is_deleted');
        let rows = (all.data || []).filter(r => r.is_deleted !== true);
        rows = rows.filter(r => normalizeReferenceNumber(r.reference_number) === norm);
        if (vend) {
            rows = rows.filter(r => normalizeVendorName(r.vendor) === vend);
        }
        if (excludeId) rows = rows.filter(r => String(r.id) !== String(excludeId));
        if (rows.length) {
            return {
                duplicate: true,
                row: rows[0],
                message: 'Duplicate Transaction: This Reference Number and Vendor/Payee combination has already been registered. Please check the existing transaction (' + (rows[0].transaction_id || rows[0].reference_number || rows[0].id) + ').'
            };
        }
    } catch (e) {
        console.warn('dup expense check', e);
    }
    return { duplicate: false };
}

async function checkEmailExists(email, excludeProfileId) {
    const em = String(email || '').trim().toLowerCase();
    if (!em) return { exists: false };
    try {
        const { data } = await supabase.from('profiles').select('id, email').limit(500);
        const hit = (data || []).find(p => {
            if (excludeProfileId && String(p.id) === String(excludeProfileId)) return false;
            return String(p.email || '').trim().toLowerCase() === em;
        });
        if (hit) {
            return { exists: true, message: 'This email address already exists. Please use a different email address.' };
        }
    } catch (e) {}
    return { exists: false };
}

if (typeof window !== 'undefined') {
    window.normalizeReferenceNumber = normalizeReferenceNumber;
    window.checkDuplicateIncomeReference = checkDuplicateIncomeReference;
    window.checkDuplicateExpenseReference = checkDuplicateExpenseReference;
    window.checkEmailExists = checkEmailExists;
}
