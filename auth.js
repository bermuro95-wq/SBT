// ============================================================
// SELAM BERTU TESFA - Authentication Module
// ============================================================

const AUTH = {
    currentUser: null,
    currentProfile: null,
    session: null,
    listeners: [],
    
    // Initialize auth
    init: async function() {
        try {
            // Get session
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            this.session = session;
            
            if (session) {
                await this.loadUserProfile(session.user.id);
                // HARD BLOCK: inactive / suspended / disabled never stay logged in
                if (this.currentProfile && !this.isAccountAllowed(this.currentProfile)) {
                    const msg = this.accountStatusMessage(this.currentProfile);
                    try { await supabase.auth.signOut(); } catch (e) {}
                    this.session = null;
                    this.currentUser = null;
                    this.currentProfile = null;
                    // Remember message so login page can show it
                    try { sessionStorage.setItem('sbt_login_block_msg', msg); } catch (e) {}
                    if (!this.isAuthPage()) {
                        window.location.replace('login.html?blocked=1');
                        return { success: false, error: msg };
                    }
                }
            }
            
            // Listen for auth changes
            supabase.auth.onAuthStateChange(async (event, session) => {
                this.session = session;
                
                if (event === 'SIGNED_IN' && session) {
                    await this.loadUserProfile(session.user.id);
                    if (this.currentProfile && !this.isAccountAllowed(this.currentProfile)) {
                        const msg = this.accountStatusMessage(this.currentProfile);
                        try { await supabase.auth.signOut(); } catch (e) {}
                        this.session = null;
                        this.currentUser = null;
                        this.currentProfile = null;
                        try { sessionStorage.setItem('sbt_login_block_msg', msg); } catch (e) {}
                        if (!this.isAuthPage()) {
                            window.location.replace('login.html?blocked=1');
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.currentProfile = null;
                }
                
                this.notifyListeners(event);
            });
            
            return { success: true };
        } catch (error) {
            console.error('Auth init error:', error);
            return { success: false, error: error.message };
        }
    },

    isAuthPage: function() {
        const path = (window.location.pathname || '').toLowerCase();
        return path.includes('login') || path.includes('reset-password') || path === '/' || path.endsWith('/index.html');
    },
    
    // Load user profile
    loadUserProfile: async function(authId) {
        try {
            let data = null;
            let error = null;
            
            // Use maybeSingle-style query (no throw on 0 rows)
            const res = await supabase
                .from('profiles')
                .select('*')
                .eq('auth_id', authId)
                .maybeSingle();
            data = res.data;
            error = res.error;
            
            // Auto-create profile if missing
            if (!data && !error) {
                const { data: userData } = await supabase.auth.getUser();
                const email = userData?.user?.email || '';
                const fullName = userData?.user?.user_metadata?.full_name || email.split('@')[0] || 'User';
                const role = userData?.user?.user_metadata?.role || 'accountant';
                const inserted = await supabase.from('profiles').upsert({
                    auth_id: authId,
                    full_name: fullName,
                    email: email,
                    role: role === 'administrator' ? 'administrator' : (role || 'accountant'),
                    status: 'active'
                }, { onConflict: 'auth_id' }).select().maybeSingle();
                data = inserted.data;
                error = inserted.error;
            }
            
            if (error) throw error;
            
            this.currentProfile = data;
            try {
                if (data && data.role) {
                    sessionStorage.setItem('sbt_role', String(data.role));
                    sessionStorage.setItem('sbt_user_id', String(data.id || ''));
                }
            } catch (e) {}
            if (typeof updateUserHeader === 'function' && data) updateUserHeader(data);
            
            // Load role permissions when available
            let permissions = [];
            try {
                if (data && data.role_id) {
                    const { data: rp } = await supabase
                        .from('role_permissions')
                        .select('permissions:permission_id(resource, action)')
                        .eq('role_id', data.role_id);
                    if (rp) {
                        permissions = rp.map(r => r.permissions).filter(Boolean);
                    }
                }
            } catch (e) {
                console.warn('Could not load role_permissions', e);
            }
            
            this.currentUser = {
                ...data,
                auth_id: authId,
                permissions: permissions
            };
            
            // Show/hide admin menus now that role is known
            if (typeof applyPagePermissions === 'function') {
                try { applyPagePermissions(); } catch (e) {}
            }
            
            return this.currentUser;
        } catch (error) {
            console.error('Load profile error:', error);
            return null;
        }
    },
    
    // Sign in
    signIn: async function(email, password) {
        try {
            const emailKey = String(email || '').trim().toLowerCase();
            // Password try-lock (Super Admin setting)
            try {
                const ss = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
                const lockOn = ss.password_lock_enabled !== 'false';
                if (lockOn && emailKey) {
                    const lockRaw = localStorage.getItem('sbt_login_lock_' + emailKey);
                    if (lockRaw) {
                        const lock = JSON.parse(lockRaw);
                        if (lock.until && Date.now() < lock.until) {
                            const mins = Math.ceil((lock.until - Date.now()) / 60000);
                            return { success: false, error: 'Account temporarily locked after failed password attempts. Try again in ' + mins + ' minute(s).' };
                        }
                    }
                }
            } catch (e) {}

            const { data, error } = await supabase.auth.signInWithPassword({
                email: String(email || '').trim(),
                password: password
            });
            if (error) throw error;
            if (!data || !data.user) {
                return { success: false, error: 'Invalid email or password.' };
            }

            const uid = data.user.id;
            this.session = data.session;
            this.currentUser = data.user;

            // Load profile and enforce status (inactive / suspended cannot login)
            await this.loadUserProfile(uid);
            let prof = this.currentProfile;
            // Fallback: fetch status by auth_id or email (in case profile load was incomplete)
            if (!prof || !prof.status) {
                try {
                    let pr = await supabase.from('profiles').select('*').eq('auth_id', uid).maybeSingle();
                    if (!pr.data) {
                        pr = await supabase.from('profiles').select('*').eq('email', String(email || '').trim()).maybeSingle();
                    }
                    if (pr.data) {
                        prof = pr.data;
                        this.currentProfile = pr.data;
                    }
                } catch (e) {}
            }

            // Hard block inactive / suspended / disabled
            if (prof && !this.isAccountAllowed(prof)) {
                const msg = this.accountStatusMessage(prof);
                try { await supabase.auth.signOut(); } catch (e) {}
                this.session = null;
                this.currentUser = null;
                this.currentProfile = null;
                if (typeof logAudit === 'function') {
                    try { await logAudit('LOGIN_BLOCKED', 'auth', uid, null, { email: email, status: prof.status }); } catch (e) {}
                }
                return { success: false, error: msg };
            }

            // Soft-deleted email pattern
            const em = String(prof?.email || email || '').toLowerCase();
            if (em.includes('@deleted.local') || String(prof?.full_name || '').includes('(deleted)')) {
                try { await supabase.auth.signOut(); } catch (e) {}
                this.session = null;
                this.currentUser = null;
                this.currentProfile = null;
                return { success: false, error: 'Access denied: this account has been removed. Please contact the administrator.' };
            }

            // Update last_login
            const now = new Date().toISOString();
            try {
                await supabase.from('profiles').update({ last_login: now }).eq('auth_id', uid);
                if (prof?.id) {
                    await supabase.from('profiles').update({ last_login: now }).eq('id', prof.id);
                }
                if (this.currentProfile) this.currentProfile.last_login = now;
            } catch (e) {}

            if (typeof logAudit === 'function') {
                try {
                    await logAudit('LOGIN_SUCCESS', 'auth', uid, null, {
                        email: email,
                        role: prof?.role || null
                    });
                } catch (e) {}
            }

            // Clear failed-attempt counter on success
            try {
                const emailKey = String(email || '').trim().toLowerCase();
                localStorage.removeItem('sbt_login_fail_' + emailKey);
                localStorage.removeItem('sbt_login_lock_' + emailKey);
            } catch (e) {}
            return { success: true, user: data.user, session: data.session, profile: this.currentProfile };
        } catch (error) {
            console.error('Sign in error:', error);
            if (typeof logAudit === 'function') {
                try {
                    await logAudit('LOGIN_FAILED', 'auth', null, null, null, { email: email, reason: error.message });
                } catch (e) {}
            }
            // Track failed attempts for password lock
            try {
                const emailKey = String(email || '').trim().toLowerCase();
                const ss = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
                if (ss.password_lock_enabled !== 'false' && emailKey) {
                    const max = parseInt(ss.max_login_attempts || '5', 10) || 5;
                    const lockMins = parseInt(ss.lockout_minutes || '15', 10) || 15;
                    const key = 'sbt_login_fail_' + emailKey;
                    let fails = parseInt(localStorage.getItem(key) || '0', 10) || 0;
                    fails += 1;
                    localStorage.setItem(key, String(fails));
                    if (fails >= max) {
                        localStorage.setItem('sbt_login_lock_' + emailKey, JSON.stringify({ until: Date.now() + lockMins * 60 * 1000 }));
                        localStorage.setItem(key, '0');
                        return { success: false, error: 'Too many failed attempts. Account locked for ' + lockMins + ' minutes.' };
                    }
                }
            } catch (e) {}
            return { success: false, error: error.message || 'Invalid email or password.' };
        }
    },
    // Register new user
    signUp: async function(email, password, fullName) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: { full_name: fullName || '', role: 'accountant' }
                }
            });
            if (error) throw error;
            // Ensure profile
            if (data.user) {
                try {
                    await supabase.from('profiles').upsert({
                        auth_id: data.user.id,
                        full_name: fullName || email.split('@')[0],
                        email: email.trim(),
                        role: 'accountant',
                        status: 'active'
                    }, { onConflict: 'auth_id' });
                } catch (pe) {
                    console.warn('Profile upsert', pe);
                }
            }
            return { success: true, data };
        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Sign out
    signOut: async function() {
        try {
            // Log before clearing session so actor is known
            if (typeof logAudit === 'function') {
                try {
                    await logAudit('LOGOUT', 'auth', this.currentProfile?.id || null, null, null, {
                        email: this.currentProfile?.email || this.currentUser?.email || null
                    }, 'success');
                } catch (ae) {}
            }
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            this.currentProfile = null;
            this.session = null;
            
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Reset password — uses Supabase Auth (works even if profiles row is missing)
    resetPassword: async function(email) {
        try {
            // Super Admin setting: allow / deny password reset emails
            try {
                const ss = JSON.parse(localStorage.getItem('sbt_system_settings') || '{}');
                if (ss.allow_password_reset === 'false') {
                    return { success: false, error: 'Password reset is disabled by Super Admin. Contact the administrator.' };
                }
            } catch (e) {}

            email = String(email || '').trim().toLowerCase();
            if (!email || !email.includes('@')) {
                return { success: false, error: 'Please enter a valid email address.' };
            }

            let redirectTo = 'http://localhost:3000/reset-password.html';
            try {
                if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                    redirectTo = window.location.origin.replace(/\/$/, '') + '/reset-password.html';
                }
            } catch (e) {}

            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectTo
            });

            if (error) {
                let msg = error.message || 'Unable to send recovery email.';
                const low = String(msg).toLowerCase();
                if (low.includes('rate') || low.includes('limit')) {
                    msg = 'Too many reset requests. Please wait a few minutes and try again.';
                } else if (low.includes('redirect') || low.includes('url')) {
                    msg = 'Email configuration error. Please contact the administrator.';
                } else {
                    msg = 'Unable to send the recovery email right now. Please try again later or contact the administrator.';
                }
                throw new Error(msg);
            }

            // Professional message (Supabase does not reveal whether the email exists)
            return {
                success: true,
                message: 'If this email is registered in the system, a password reset link has been sent. Please check your inbox and spam folder.'
            };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message || 'Unable to send recovery email.' };
        }
    },

    // Update password
    updatePassword: async function(newPassword) {
        try {
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            console.error('Update password error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Get current user
    getCurrentUser: function() {
        return this.currentUser;
    },
    
    // Get current profile
    getCurrentProfile: function() {
        return this.currentProfile;
    },
    
    // Check if authenticated — session alone is not enough; account must be ACTIVE
    isAuthenticated: function() {
        if (!this.session) return false;
        if (this.currentProfile && !this.isAccountAllowed(this.currentProfile)) return false;
        return true;
    },
    
    // Check if admin
    isAdmin: function() {
        const role = (this.currentProfile?.role || this.currentProfile?.role_name || this.currentUser?.role || this.currentUser?.user_metadata?.role || '').toString().toLowerCase().trim();
        if (role === 'super_admin' || role === 'superadmin') return true;
        if (role === 'administrator' || role === 'admin') return true;
        if (role.includes('admin')) return true;
        return false;
    },

    isSuperAdmin: function() {
        let role = (this.currentProfile?.role || this.currentProfile?.role_name || this.currentUser?.role || this.currentUser?.user_metadata?.role || '').toString();
        if (!role) {
            try { role = sessionStorage.getItem('sbt_role') || ''; } catch (e) {}
        }
        role = role.toLowerCase().trim().replace(/[\s-]+/g, '_');
        return role === 'super_admin' || role === 'superadmin' || role.includes('super_admin');
    },
    

    /** Only active accounts may use the system */
    isAccountAllowed: function(profile) {
        if (!profile) return true;
        const s = String(profile.status ?? 'active').toLowerCase().trim();
        if (s === 'active') return true;
        if (['inactive', 'suspended', 'disabled', 'deleted', 'banned', 'locked'].includes(s)) return false;
        // unknown status → allow only if explicitly active-like
        return s === '' || s === 'null' || s === 'undefined';
    },

    accountStatusMessage: function(profile) {
        const s = String((profile && profile.status) || '').toLowerCase().trim();
        if (s === 'suspended') {
            return 'Access denied: your account is SUSPENDED. You cannot sign in. Please contact the administrator.';
        }
        if (s === 'inactive') {
            return 'Access denied: your account is INACTIVE. You cannot sign in. Please contact the administrator.';
        }
        if (s === 'disabled' || s === 'locked' || s === 'banned') {
            return 'Access denied: your account is ' + s.toUpperCase() + '. You cannot sign in. Please contact the administrator.';
        }
        if (s === 'deleted') {
            return 'Access denied: this account has been removed. Please contact the administrator.';
        }
        return 'Access denied: this account is not allowed to sign in. Please contact the administrator.';
    },

    // Add listener
    addListener: function(callback) {
        this.listeners.push(callback);
    },
    
    // Remove listener
    removeListener: function(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    },
    
    // Notify listeners
    notifyListeners: function(event) {
        this.listeners.forEach(callback => callback({
            event,
            user: this.currentUser,
            profile: this.currentProfile,
            session: this.session
        }));
    },
    
    // Check if user has permission
    hasPermission: function(resource, action) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        
        // Check permissions from profile
        const permissions = this.currentUser?.permissions || [];
        return permissions.some(p => p.resource === resource && p.action === action);
    }
};

// ============================================================
// Login Page Functions
// ============================================================

function setupLoginPage() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');
    const loginError = document.getElementById('login-error');
    const forgotPasswordLink = document.getElementById('forgot-password');
    const resetForm = document.getElementById('reset-password-form');
    const backToLoginBtn = document.getElementById('back-to-login');
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const resetEmail = document.getElementById('reset-email');
    const resetError = document.getElementById('reset-error');
    const resetSuccess = document.getElementById('reset-success');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    
    if (!loginForm) return;
    
    // Login form submit
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = (document.getElementById('email')?.value || '').trim();
        const password = (document.getElementById('password')?.value || passwordInput?.value || '');
        
        // Validate
        if (!email || !password) {
            showLoginError('Please fill in all fields.');
            return;
        }
        // Temporary lockout with live countdown
        const remain = (typeof getLoginLockRemaining === 'function') ? getLoginLockRemaining(email) : 0;
        if (remain > 0) {
            const endAt = Date.now() + remain;
            showLoginError('Account temporarily locked. Try again in ' + formatRemain(remain) + '.');
            if (window._lockTimer) clearInterval(window._lockTimer);
            window._lockTimer = setInterval(() => {
                const left = Math.max(0, endAt - Date.now());
                if (left <= 0) {
                    clearInterval(window._lockTimer);
                    hideLoginError();
                    return;
                }
                showLoginError('Account temporarily locked. Remaining: ' + formatRemain(left));
            }, 1000);
            return;
        }
        
        // Show loading (null-safe)
        if (loginBtn) loginBtn.disabled = true;
        if (loginText) loginText.textContent = 'Logging in...';
        if (loginSpinner) loginSpinner.classList.remove('d-none');
        hideLoginError();
        // Professional status under form
        let statusEl = document.getElementById('login-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'login-status';
            statusEl.className = 'alert alert-info mt-3';
            const form = document.getElementById('login-form');
            if (form) form.appendChild(statusEl);
        }
        statusEl.className = 'alert alert-info mt-3';
        statusEl.textContent = 'Logging in, please wait...';
        statusEl.classList.remove('d-none');
        
        // Attempt login
        let result;
        try {
            result = await AUTH.signIn(email, password);
        } catch (err) {
            result = { success: false, error: err.message || 'Sign in failed' };
        }
        
        if (result && result.success) {
            if (typeof clearLoginFailures === 'function') clearLoginFailures(email);
            if (loginText) loginText.textContent = 'Success';
            statusEl.className = 'alert alert-success mt-3';
            statusEl.textContent = 'Logged in successfully. Redirecting to dashboard...';
            if (typeof showAppMessage === 'function') {
                showAppMessage('Welcome', 'Logged in successfully.', 'success');
            }
            setTimeout(function() {
                window.location.replace('dashboard.html');
            }, 700);
            return;
        }
        
        // Hide loading on failure + lockout counter
        if (loginBtn) loginBtn.disabled = false;
        if (loginText) loginText.textContent = 'Sign In';
        if (loginSpinner) loginSpinner.classList.add('d-none');
        const lockInfo = (typeof recordLoginFailure === 'function') ? recordLoginFailure(email) : null;
        let errMsg = (result && result.error) || 'Invalid email or password.';
        if (lockInfo && lockInfo.locked) {
            errMsg = 'Too many failed attempts. Account locked. Remaining: ' + formatRemain(lockInfo.remainingMs);
            const endAt = Date.now() + lockInfo.remainingMs;
            if (window._lockTimer) clearInterval(window._lockTimer);
            window._lockTimer = setInterval(() => {
                const left = Math.max(0, endAt - Date.now());
                if (left <= 0) {
                    clearInterval(window._lockTimer);
                    hideLoginError();
                    if (statusEl) statusEl.classList.add('d-none');
                    return;
                }
                const msg = 'Account temporarily locked. Remaining: ' + formatRemain(left);
                showLoginError(msg);
                if (statusEl) {
                    statusEl.className = 'alert alert-danger mt-3';
                    statusEl.innerHTML = '<strong>Account locked</strong><br>' + msg;
                }
            }, 1000);
        } else if (lockInfo) {
            errMsg += ' (Attempt ' + lockInfo.attempts + '/' + lockInfo.maxAttempts + ')';
        }
        statusEl.className = 'alert alert-danger mt-3';
        statusEl.innerHTML = '<strong>Cannot sign in</strong><br>' + errMsg;
        statusEl.classList.remove('d-none');
        showLoginError(errMsg);
        if (typeof showAppMessage === 'function') {
            showAppMessage('Cannot sign in', errMsg, 'error');
        }
    });
    
    // Password toggle handled only in login.html (avoid double-toggle)

    
    // Forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginForm.classList.add('d-none');
            resetForm.classList.remove('d-none');
        });
    }
    
    // Back to login
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            resetForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
            resetError.classList.add('d-none');
            resetSuccess.classList.add('d-none');
        });
    }
    
    // Reset password
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async function() {
            const email = resetEmail.value.trim();
            
            if (!email) {
                showResetError('Please enter your email address.');
                return;
            }
            
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.textContent = 'Sending...';
            hideResetError();
            hideResetSuccess();
            
            const result = await AUTH.resetPassword(email);
            
            resetPasswordBtn.disabled = false;
            resetPasswordBtn.textContent = 'Send Reset Link';
            
            if (result.success) {
                showResetSuccess(result.message || ('Password reset link sent to ' + email + '. Check inbox/spam.'));
                resetEmail.value = '';
            } else {
                showResetError(result.error || 'Failed to send reset link.');
            }
        });
    }
    
    // Enter key for reset
    if (resetEmail) {
        resetEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                resetPasswordBtn.click();
            }
        });
    }
}

function showLoginError(message) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    }
}

function hideLoginError() {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.classList.add('d-none');
    }
}

function showResetError(message) {
    const errorEl = document.getElementById('reset-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    }
}

function hideResetError() {
    const errorEl = document.getElementById('reset-error');
    if (errorEl) {
        errorEl.classList.add('d-none');
    }
}

function showResetSuccess(message) {
    const successEl = document.getElementById('reset-success');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.remove('d-none');
    }
}

function hideResetSuccess() {
    const successEl = document.getElementById('reset-success');
    if (successEl) {
        successEl.classList.add('d-none');
    }
}


// Update top-nav user photo + name on every page
function updateUserHeader() {
    try {
        const profile = AUTH.currentProfile || AUTH.currentUser;
        if (!profile) return;
        const name = profile.full_name || profile.email || 'User';
        document.querySelectorAll('#user-name').forEach(el => { el.textContent = name; });
        const url = profile.avatar_url;
        document.querySelectorAll('#user-avatar').forEach(el => {
            if (url) {
                el.src = url;
                el.style.objectFit = 'cover';
                el.style.borderRadius = '50%';
                el.style.width = '36px';
                el.style.height = '36px';
            }
            el.onerror = function() {
                this.src = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="18" fill="#1a4d7a"/><text x="18" y="22" text-anchor="middle" fill="white" font-size="14">' +
                    (name.charAt(0) || 'U') + '</text></svg>'
                );
            };
        });
        // Role badges if present
        const roleNames = { administrator: 'Administrator', accountant: 'Accountant', admin: 'Administrator' };
        const roleLabel = roleNames[(profile.role || '').toLowerCase()] || profile.role || 'User';
        document.querySelectorAll('#profile-role, #user-role, .user-role-label').forEach(el => {
            el.textContent = roleLabel;
        });
        if (typeof applyPagePermissions === 'function') {
            try { applyPagePermissions(); } catch (e) {}
        }
    } catch (e) { console.warn('updateUserHeader', e); }
}
window.updateUserHeader = updateUserHeader;

// ============================================================
// Initialize Auth on Page Load
// ============================================================


// If recovery email lands on login (Site URL), forward tokens to reset UI
(function bridgeRecoveryLink() {
    try {
        var path = (window.location.pathname || '').toLowerCase();
        if (path.indexOf('reset-password') !== -1) return;
        var hash = window.location.hash || '';
        var search = window.location.search || '';
        var hasAuthPayload = hash.indexOf('access_token=') !== -1 ||
            search.indexOf('code=') !== -1 ||
            hash.indexOf('type=recovery') !== -1 ||
            search.indexOf('type=recovery') !== -1;
        if (hasAuthPayload) {
            window.location.replace('reset-password.html' + search + hash);
        }
    } catch (e) {}
})();


// ---- Temporary account lockout (client-side, respects Settings values) ----
function _lockKey(email) {
    return 'sbt_lock_' + String(email || '').trim().toLowerCase();
}
function _getLockSettings() {
    let maxAttempts = 5, lockMinutes = 15;
    try {
        const a = localStorage.getItem('sbt_max_login_attempts');
        const m = localStorage.getItem('sbt_lockout_minutes');
        if (a) maxAttempts = Math.max(3, parseInt(a, 10) || 5);
        if (m) lockMinutes = Math.max(1, parseInt(m, 10) || 15);
    } catch (e) {}
    return { maxAttempts, lockMinutes };
}
function getLoginLockRemaining(email) {
    try {
        const raw = localStorage.getItem(_lockKey(email));
        if (!raw) return 0;
        const until = parseInt(raw, 10);
        if (!until) return 0;
        return Math.max(0, until - Date.now());
    } catch (e) { return 0; }
}
function recordLoginFailure(email) {
    const { maxAttempts, lockMinutes } = _getLockSettings();
    const k = 'sbt_fail_' + String(email || '').trim().toLowerCase();
    let n = 0;
    try { n = parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) {}
    n += 1;
    try { localStorage.setItem(k, String(n)); } catch (e) {}
    if (n >= maxAttempts) {
        const until = Date.now() + lockMinutes * 60 * 1000;
        try { localStorage.setItem(_lockKey(email), String(until)); localStorage.setItem(k, '0'); } catch (e) {}
        return { locked: true, remainingMs: lockMinutes * 60 * 1000, attempts: n, maxAttempts };
    }
    return { locked: false, remainingMs: 0, attempts: n, maxAttempts };
}
function clearLoginFailures(email) {
    try {
        localStorage.removeItem('sbt_fail_' + String(email || '').trim().toLowerCase());
        localStorage.removeItem(_lockKey(email));
    } catch (e) {}
}
function formatRemain(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
}

document.addEventListener('DOMContentLoaded', async function() {
    // Never let init errors block the login form
    try {
        await AUTH.init();
    } catch (e) {
        console.warn('AUTH.init', e);
    }
    
    // Wire login whenever the form exists (any path / server)
    if (document.getElementById('login-form')) {
        setupLoginPage();
        // Show blocked / inactive / suspended message if redirected here
        try {
            const params = new URLSearchParams(window.location.search || '');
            let blockMsg = sessionStorage.getItem('sbt_login_block_msg') || '';
            if (params.get('blocked') === '1' || blockMsg) {
                if (!blockMsg) {
                    blockMsg = 'Access denied: your account is inactive or suspended. You cannot sign in. Please contact the administrator.';
                }
                sessionStorage.removeItem('sbt_login_block_msg');
                if (typeof showLoginError === 'function') showLoginError(blockMsg);
                if (typeof showAppMessage === 'function') showAppMessage('Cannot sign in', blockMsg, 'error');
                const statusEl = document.getElementById('login-status');
                if (statusEl) {
                    statusEl.className = 'alert alert-danger mt-3';
                    statusEl.innerHTML = '<strong>Cannot sign in</strong><br>' + blockMsg;
                    statusEl.classList.remove('d-none');
                }
            }
        } catch (e) {}
        // Never redirect to dashboard if account is not allowed
        if (AUTH.isAuthenticated() && AUTH.currentProfile && AUTH.isAccountAllowed(AUTH.currentProfile)) {
            window.location.replace('dashboard.html');
        }
    } else if (AUTH.isAuthenticated()) {
        // Protected pages: if somehow session exists but account blocked → force logout + login
        if (AUTH.currentProfile && !AUTH.isAccountAllowed(AUTH.currentProfile)) {
            try { await AUTH.signOut(); } catch (e) {}
            window.location.replace('login.html?blocked=1');
            return;
        }
        if (typeof updateUserHeader === 'function') updateUserHeader();
    } else {
        // Not authenticated on a protected page → go to login
        const path = (window.location.pathname || '').toLowerCase();
        const isAuth = path.includes('login') || path.includes('reset-password') || path.endsWith('/') || path.includes('index.html');
        if (!isAuth) {
            window.location.replace('login.html');
        }
    }
    
    // Setup logout buttons
    document.querySelectorAll('#logout-btn, #logout-dropdown').forEach(el => {
        el?.addEventListener('click', async function(e) {
            e.preventDefault();
            try { await AUTH.signOut(); } catch (err) {}
            window.location.replace('login.html');
        });
    });
});