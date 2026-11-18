// app.js - Main application
// Uses the original permission system from permissions.js and auth.js
// No hard-coded roles.

class App {
    constructor() {
        this.init();
    }
    
    async init() {
        try {
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                await AUTH.init();
            }
        } catch (e) {
            console.warn('Auth init:', e.message);
        }

        // Use ORIGINAL permission system (from permissions.js)
        // Administrator → sees everything (Users, Audit Logs, Settings, etc.)
        // Accountant  → admin-only items stay hidden
        if (typeof applyPagePermissions === 'function') {
            applyPagePermissions();
        } else if (typeof AUTH !== 'undefined' && AUTH.isAdmin) {
            // Fallback that still uses original AUTH.isAdmin()
            document.querySelectorAll('.admin-only').forEach(el => {
                if (!AUTH.isAdmin()) {
                    el.classList.add('d-none');
                } else {
                    el.classList.remove('d-none');
                }
            });
        }

        document.body.classList.add('brand-ready');
        this.setupLogout();
        this.setupTheme();
        if (typeof updateUserHeader === 'function') updateUserHeader();
        // Notifications (retry if profile was slow)
        try {
            if (typeof NotificationsModule !== 'undefined') {
                window._notifications = new NotificationsModule();
            }
        } catch (e) { console.warn(e); }
        const revealMenus = () => {
            // Single source of truth: permissions.js (hides Settings from non-SA, admin menus from accountants)
            if (typeof applyPagePermissions === 'function') {
                try { applyPagePermissions(); } catch (e) {}
            }
        };
        revealMenus();
        setTimeout(revealMenus, 400);
        setTimeout(revealMenus, 1000);
        setTimeout(revealMenus, 2000);
        setTimeout(() => {
            if (typeof updateUserHeader === 'function') updateUserHeader();
            if ((!window._notifications || !window._notifications.userId) && typeof NotificationsModule !== 'undefined') {
                try { window._notifications = new NotificationsModule(); } catch (e) {}
            }
        }, 800);
        this.loadModules();
    }
    
    getCurrentPage() {
        const path = window.location.pathname || window.location.href;
        const file = path.split('/').pop() || '';
        return file.replace('.html', '').replace(/\/$/, '') || 'dashboard';
    }
    
    loadModules() {
        const page = this.getCurrentPage();
        try {
            switch (page) {
                case 'dashboard':
                    if (typeof Dashboard !== 'undefined') new Dashboard();
                    else if (typeof DashboardModule !== 'undefined') new DashboardModule();
                    break;
                case 'income':
                    if (typeof IncomeModule !== 'undefined') new IncomeModule();
                    break;
                case 'expenses':
                    if (typeof ExpensesModule !== 'undefined') new ExpensesModule();
                    break;
                case 'transaction':
                case 'transactions':
                    if (typeof TransactionsModule !== 'undefined') new TransactionsModule();
                    break;
                case 'budget':
                    if (typeof BudgetModule !== 'undefined') new BudgetModule();
                    break;
                case 'receipts':
                    if (typeof ReceiptsModule !== 'undefined') new ReceiptsModule();
                    break;
                case 'reports':
                    if (typeof ReportsModule !== 'undefined') new ReportsModule();
                    break;
                case 'analytics':
                    if (typeof AnalyticsModule !== 'undefined') new AnalyticsModule();
                    break;
                case 'approvals':
                    if (typeof ApprovalsModule !== 'undefined') new ApprovalsModule();
                    break;
                case 'users':
                    if (typeof UsersModule !== 'undefined') new UsersModule();
                    break;
                case 'audit-logs':
                    if (typeof AuditModule !== 'undefined') window.auditModule = new AuditModule();
                    break;
                case 'settings':
                    if (typeof SettingsModule !== 'undefined') new SettingsModule();
                    break;
                case 'UserProfile':
                case 'profile':
                    if (typeof ProfileModule !== 'undefined') new ProfileModule();
                    else if (typeof UserProfileModule !== 'undefined') new UserProfileModule();
                    break;
            }
        } catch (err) {
            console.error('Module load error:', err);
        }
    }
    
    setupLogout() {
        const doLogout = async (e) => {
            if (e) e.preventDefault();
            try {
                if (typeof AUTH !== 'undefined' && AUTH.signOut) {
                    await AUTH.signOut();
                }
            } catch (err) {}
            window.location.href = 'login.html';
        };
        document.querySelectorAll('#logout-btn, #logout-dropdown, [data-logout]').forEach(el => {
            el.addEventListener('click', doLogout);
        });
    }
    
    setupTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        const savedTheme = localStorage.getItem('sbt_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeIcon) {
            themeIcon.className = savedTheme === 'light' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
        }
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const next = current === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('sbt_theme', next);
                if (themeIcon) {
                    themeIcon.className = next === 'light' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
                }
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});




// Responsive UX: scroll-to-top button
(function () {
    function ensureScrollTop() {
        if (document.getElementById('scroll-top-btn')) return;
        const b = document.createElement('button');
        b.id = 'scroll-top-btn';
        b.type = 'button';
        b.title = 'Back to top';
        b.innerHTML = '<i class="bi bi-arrow-up"></i>';
        b.style.cssText = 'position:fixed;bottom:1.25rem;right:1.25rem;z-index:1050;width:44px;height:44px;border-radius:50%;border:none;background:#0d6efd;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2);display:none;align-items:center;justify-content:center;';
        b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.body.appendChild(b);
        window.addEventListener('scroll', () => {
            b.style.display = window.scrollY > 240 ? 'flex' : 'none';
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureScrollTop);
    else ensureScrollTop();
})();


// ============================================================
// Sidebar menu — phones (drawer) + desktop (collapse)
// ============================================================
(function () {
    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

    function isMobile() {
        return window.matchMedia('(max-width: 991.98px)').matches;
    }

    function ensureOverlay() {
        let ov = qs('.sidebar-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.className = 'sidebar-overlay';
            ov.setAttribute('aria-hidden', 'true');
            document.body.appendChild(ov);
        }
        return ov;
    }

    function ensureToggleButton() {
        let btn = qs('#sidebar-toggle, #menu-toggle, .sidebar-toggle, [data-sidebar-toggle]');
        if (btn) return btn;
        const nav = qs('.top-nav, .navbar, header');
        if (!nav) return null;
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'sidebar-toggle';
        btn.className = 'btn sidebar-toggle';
        btn.setAttribute('aria-label', 'Open menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
        nav.insertBefore(btn, nav.firstChild);
        return btn;
    }

    function getSidebar() {
        return qs('#sidebar, .sidebar');
    }

    function closeMobileMenu() {
        const sidebar = getSidebar();
        const ov = qs('.sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('open', 'show', 'mobile-open');
        }
        if (ov) {
            ov.classList.remove('show');
            ov.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('sidebar-open', 'menu-open');
        document.body.style.overflow = '';
        const btn = qs('#sidebar-toggle, #menu-toggle, .sidebar-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function openMobileMenu() {
        const sidebar = getSidebar();
        const ov = ensureOverlay();
        if (!sidebar) return;
        sidebar.classList.add('open', 'show', 'mobile-open');
        ov.classList.add('show');
        ov.setAttribute('aria-hidden', 'false');
        document.body.classList.add('sidebar-open', 'menu-open');
        document.body.style.overflow = 'hidden';
        const btn = qs('#sidebar-toggle, #menu-toggle, .sidebar-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function toggleMobileMenu() {
        const sidebar = getSidebar();
        if (!sidebar) return;
        if (sidebar.classList.contains('open')) closeMobileMenu();
        else openMobileMenu();
    }

    function toggleDesktopCollapse() {
        const sidebar = getSidebar();
        const main = qs('.main-content');
        if (!sidebar) return;
        const collapsed = sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        if (main) main.classList.toggle('sidebar-collapsed', collapsed);
        try { localStorage.setItem('sbt_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) {}
    }

    function onToggleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isMobile()) {
            toggleMobileMenu();
        } else {
            toggleDesktopCollapse();
        }
    }

    function bind() {
        ensureOverlay();
        const btn = ensureToggleButton();
        if (btn && !btn._sbtMenuBound) {
            btn._sbtMenuBound = true;
            btn.addEventListener('click', onToggleClick);
        }
        // Also bind any other menu buttons
        qsa('#sidebar-toggle, #menu-toggle, .sidebar-toggle, [data-sidebar-toggle]').forEach(function (el) {
            if (el._sbtMenuBound) return;
            el._sbtMenuBound = true;
            el.addEventListener('click', onToggleClick);
        });

        const ov = qs('.sidebar-overlay');
        if (ov && !ov._sbtBound) {
            ov._sbtBound = true;
            ov.addEventListener('click', closeMobileMenu);
        }

        // Close drawer after navigating on phone
        qsa('.sidebar a, .sidebar-nav a').forEach(function (a) {
            if (a._sbtNavBound) return;
            a._sbtNavBound = true;
            a.addEventListener('click', function () {
                if (isMobile()) closeMobileMenu();
            });
        });

        // Restore desktop collapse preference
        if (!isMobile()) {
            try {
                if (localStorage.getItem('sbt_sidebar_collapsed') === '1') {
                    const sidebar = getSidebar();
                    const main = qs('.main-content');
                    if (sidebar) sidebar.classList.add('collapsed');
                    document.body.classList.add('sidebar-collapsed');
                    if (main) main.classList.add('sidebar-collapsed');
                }
            } catch (e) {}
        } else {
            closeMobileMenu();
        }
    }

    document.addEventListener('DOMContentLoaded', bind);
    window.addEventListener('resize', function () {
        if (!isMobile()) {
            closeMobileMenu();
        }
    });
    // Escape closes mobile menu
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isMobile()) closeMobileMenu();
    });
})();
