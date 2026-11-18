// ============================================================
// SELAM BERTU TESFA - Profile Module
// ============================================================

class ProfileModule {
    constructor() {
        this.profile = null;
        this.init();
    }
    
    async init() {
        try {
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            this.profile = AUTH.getCurrentProfile && AUTH.getCurrentProfile();
            if (!this.profile) {
                await this.loadProfile();
            }
            this.displayProfile();
            if (typeof updateUserHeader === 'function') updateUserHeader();
            this.setupEventListeners();
        } catch (error) {
            console.error('Profile init error:', error);
            this.showError('Failed to load profile.');
        }
    }
    
    async loadProfile() {
        const authId = AUTH.session?.user?.id
            || AUTH.getCurrentUser?.()?.auth_id
            || AUTH.getCurrentUser?.()?.id;
        if (!authId) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_id', authId)
            .maybeSingle();
        if (!error && data) {
            this.profile = data;
            AUTH.currentProfile = data;
            AUTH.currentUser = { ...data, auth_id: authId };
            return;
        }
        // Create profile if missing
        const email = AUTH.session?.user?.email || '';
        const fullName = AUTH.session?.user?.user_metadata?.full_name || email.split('@')[0] || 'User';
        const roleMeta = AUTH.session?.user?.user_metadata?.role || 'accountant';
        const role = roleMeta === 'administrator' ? 'administrator' : roleMeta;
        const ins = await supabase.from('profiles').upsert({
            auth_id: authId,
            full_name: fullName,
            email: email,
            role: role,
            status: 'active'
        }, { onConflict: 'auth_id' }).select().maybeSingle();
        if (ins.data) {
            this.profile = ins.data;
            AUTH.currentProfile = ins.data;
            AUTH.currentUser = { ...ins.data, auth_id: authId };
        }
    }
    
    displayProfile() {
        if (!this.profile) return;
        
        // Avatar
        const avatar = document.getElementById('profile-avatar');
        if (avatar && this.profile.avatar_url) {
            avatar.src = this.profile.avatar_url;
        }
        
        // Name
        document.getElementById('profile-full-name').textContent = this.profile.full_name || 'User';
        document.getElementById('edit-full-name').value = this.profile.full_name || '';
        const _nf = document.getElementById('edit-full-name');
        if (_nf) {
            _nf.disabled = true; _nf.readOnly = true;
            _nf.style.pointerEvents = 'none';
            _nf.style.backgroundColor = '#e9ecef';
            _nf.title = 'Name cannot be changed after account creation';
        }
        const _ef = document.getElementById('edit-email');
        if (_ef) {
            _ef.disabled = true; _ef.readOnly = true;
            _ef.style.pointerEvents = 'none';
            _ef.style.backgroundColor = '#e9ecef';
            _ef.title = 'Email cannot be changed';
        }
        // name locked permanent
        
        // Email
        document.getElementById('profile-email').textContent = this.profile.email || '';
        document.getElementById('edit-email').value = this.profile.email || '';
        
        // Role
        const roleNames = {
            'administrator': 'Administrator',
            'accountant': 'Accountant'
        };
        const rawRole = (this.profile.role || this.profile.role_name || '').toString().toLowerCase().trim();
        const roleLabel = roleNames[rawRole] || roleNames[this.profile.role] ||
            (rawRole.includes('admin') ? 'Administrator' :
             rawRole.includes('account') ? 'Accountant' :
             this.profile.role || 'User');
        document.getElementById('profile-role').textContent = roleLabel;
        
        // Status
        const statusColors = {
            'active': 'success',
            'inactive': 'warning',
            'suspended': 'danger'
        };
        const statusEl = document.getElementById('profile-status');
        statusEl.textContent = this.profile.status || 'Active';
        statusEl.className = `badge bg-${statusColors[this.profile.status] || 'secondary'}`;
        
        // Last Login
        const ll = this.profile.last_login || this.profile.last_sign_in_at || this.profile.updated_at;
        document.getElementById('profile-last-login').textContent =
            ll ? (typeof formatDateTime === 'function' ? formatDateTime(ll) : ll) : 'Never';
        const sessEl = document.getElementById('profile-session-info');
        if (sessEl) {
            const email = this.profile.email || AUTH.session?.user?.email || '';
            sessEl.textContent = email ? ('Signed in as ' + email) : '';
        }
        
        // Created At
        document.getElementById('profile-created-at').textContent = 
            this.profile.created_at ? formatDate(this.profile.created_at) : '-';
        
        // Language
        const langNames = {
            'en': 'English',
            'am': 'አማርኛ',
            'ti': 'ትግርኛ',
            'om': 'Afaan Oromo'
        };
        document.getElementById('profile-language').textContent = 
            langNames[this.profile.language] || 'English';
        document.getElementById('edit-language').value = this.profile.language || 'en';
        
        // Theme
        document.getElementById('profile-theme').textContent = 
            this.profile.theme === 'dark' ? 'Dark' : 'Light';
        document.getElementById('edit-theme').value = this.profile.theme || 'light';
        
        // Update user name in nav
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = this.profile.full_name || 'User';
        }
        
        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl && this.profile.avatar_url) {
            userAvatarEl.src = this.profile.avatar_url;
        }
    }
    
    setupEventListeners() {
        // Profile form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }
        
        // Password form
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordUpdate(e));
        }
        
        // Avatar upload
        const changeAvatarBtn = document.getElementById('change-avatar-btn');
        const avatarFile = document.getElementById('avatar-file');
        if (changeAvatarBtn && avatarFile) {
            changeAvatarBtn.addEventListener('click', () => avatarFile.click());
            avatarFile.addEventListener('change', (e) => this.handleAvatarUpload(e));
        }
    }
    
    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('edit-full-name').value.trim();
        const language = document.getElementById('edit-language').value;
        const theme = document.getElementById('edit-theme').value;
        
        if (!fullName) {
            this.showMessage('Please enter your full name.', 'danger', 'profile-save-message');
            return;
        }
        // Identity locked: never change full_name after creation
        if (this.profile?.full_name && fullName !== this.profile.full_name) {
            this.showMessage('Name cannot be changed after account creation.', 'danger', 'profile-save-message');
            return;
        }
        // Security: full name must be unique across all users
        try {
            const { data: others } = await supabase
                .from('profiles')
                .select('id, full_name')
                .neq('id', this.profile.id);
            const taken = (others || []).some(u =>
                String(u.full_name || '').trim().toLowerCase() === fullName.toLowerCase()
            );
            if (taken) {
                this.showMessage('This name is already used by another account. Choose a different full name.', 'danger', 'profile-save-message');
                if (typeof showAppMessage === 'function') {
                    showAppMessage('Name not allowed', 'Another user already has this name. Use a unique name for security.', 'error');
                }
                return;
            }
        } catch (e) {
            console.warn('name uniqueness check', e);
        }
        
        // Never send full_name or email — identity is permanent for all roles
        const updates = {
            language: language,
            theme: theme
        };
        delete updates.full_name;
        delete updates.email;
        
        const { data, error } = await DB.profiles.update(this.profile.id, updates);
        
        if (error) {
            this.showMessage(error.message || 'Failed to update profile.', 'danger', 'profile-save-message');
            return;
        }
        
        // Update local profile
        this.profile = { ...this.profile, ...updates };
        AUTH.currentProfile = this.profile;
        
        // Update UI
        this.displayProfile();
        
        // Update i18n
        i18n.setLanguage(language);
        
        // Update theme
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sbt_theme', theme);
        
        this.showMessage('Profile updated successfully!', 'success', 'profile-save-message');
    }
    
    async handlePasswordUpdate(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password')?.value || '';
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!currentPassword) {
            this.showMessage('Please enter your current password.', 'danger', 'password-save-message');
            return;
        }
        if (!newPassword || newPassword.length < 8) {
            this.showMessage('Password must be at least 8 characters.', 'danger', 'password-save-message');
            return;
        }
        if (newPassword !== confirmPassword) {
            this.showMessage('Passwords do not match.', 'danger', 'password-save-message');
            return;
        }

        try {
            const email = this.profile?.email || (await supabase.auth.getUser()).data?.user?.email;
            const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
            if (reauthErr) {
                this.showMessage('Current password is incorrect.', 'danger', 'password-save-message');
                return;
            }
        } catch (err) {
            this.showMessage('Could not verify current password.', 'danger', 'password-save-message');
            return;
        }
        
        const result = await AUTH.updatePassword(newPassword);
        
        if (!result.success) {
            this.showMessage(result.error || 'Failed to update password.', 'danger', 'password-save-message');
            return;
        }
        
        const cur = document.getElementById('current-password');
        if (cur) cur.value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        this.showMessage('Password updated successfully!', 'success', 'password-save-message');
    }
    
    async handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('File is too large (max 5MB).', 'danger', 'profile-save-message');
            e.target.value = '';
            return;
        }
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select an image file.', 'danger', 'profile-save-message');
            e.target.value = '';
            return;
        }

        if (!this.profile || !this.profile.id) {
            this.showMessage('Profile not loaded. Please refresh and try again.', 'danger', 'profile-save-message');
            e.target.value = '';
            return;
        }

        const applySrc = (src) => {
            document.querySelectorAll('#profile-avatar, #user-avatar').forEach(el => {
                if (el) {
                    el.src = src;
                    el.style.objectFit = 'cover';
                    el.style.borderRadius = '50%';
                }
            });
        };

        // Compress to JPEG data URL (keeps DB size reasonable and always works)
        const compress = (file, maxW, quality) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    let w = img.width, h = img.height;
                    if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });

        try {
            this.showMessage('Uploading photo…', 'info', 'profile-save-message');
            let finalUrl = null;

            // 1) Try Supabase Storage bucket "avatars"
            try {
                if (typeof Storage !== 'undefined' && Storage.uploadAvatar) {
                    const result = await Storage.uploadAvatar(file, this.profile.id);
                    if (result && !result.error && result.path) {
                        let publicUrl = null;
                        if (Storage.getPublicUrl) {
                            const r = Storage.getPublicUrl('avatars', result.path);
                            publicUrl = r?.data?.publicUrl || r?.publicUrl || null;
                        }
                        if (!publicUrl && result.publicUrl) publicUrl = result.publicUrl;
                        if (publicUrl) finalUrl = publicUrl;
                    }
                }
            } catch (stErr) {
                console.warn('Storage avatar upload failed, using DB fallback', stErr);
            }

            // 2) Fallback: compressed data URL stored in profiles.avatar_url
            if (!finalUrl) {
                finalUrl = await compress(file, 320, 0.72);
            }

            applySrc(finalUrl);

            // Persist to database (required so photo survives refresh)
            const { data, error } = await supabase
                .from('profiles')
                .update({ avatar_url: finalUrl })
                .eq('id', this.profile.id)
                .select('id, avatar_url')
                .maybeSingle();

            if (error) {
                // try by auth_id
                const authId = this.profile.auth_id || (typeof AUTH !== 'undefined' && AUTH.session?.user?.id);
                let err2 = error;
                if (authId) {
                    const r2 = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('auth_id', authId).select('id, avatar_url').maybeSingle();
                    if (!r2.error) {
                        err2 = null;
                    } else {
                        err2 = r2.error;
                    }
                }
                if (err2) {
                    console.error('avatar save error', err2);
                    this.showMessage('Could not save photo to database: ' + (err2.message || 'error'), 'danger', 'profile-save-message');
                    e.target.value = '';
                    return;
                }
            }

            this.profile.avatar_url = finalUrl;
            if (typeof AUTH !== 'undefined') {
                AUTH.currentProfile = { ...(AUTH.currentProfile || {}), ...this.profile, avatar_url: finalUrl };
            }
            if (typeof updateUserHeader === 'function') {
                updateUserHeader(this.profile);
            }
            if (typeof logAudit === 'function') {
                try { logAudit('PROFILE_PHOTO_UPDATE', 'profiles', this.profile.id, null, null); } catch (e) {}
            }
            this.showMessage('Photo saved successfully. It will stay after refresh.', 'success', 'profile-save-message');
        } catch (err) {
            console.error('Avatar upload error:', err);
            this.showMessage('Could not process photo: ' + (err.message || 'error'), 'danger', 'profile-save-message');
        }
        e.target.value = '';
    }

    showMessage(message, type, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        el.className = `alert alert-${type} mt-3`;
        el.textContent = message;
        el.classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            el.classList.add('d-none');
        }, 5000);
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
// Initialize Profile Module
// ============================================================

if (document.getElementById('profile-form')) {
    document.addEventListener('DOMContentLoaded', function() {
        new ProfileModule();
    });
}

// Show / hide password buttons (works for all users)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-pw');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-target');
    const input = document.getElementById(id);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    }
});
