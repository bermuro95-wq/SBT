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
        if (avatar) {
            avatar.src = this.profile.avatar_url || 'assets/images/logo.png';
            avatar.onerror = function(){ this.src='assets/images/logo.png'; };
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
        
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!newPassword || newPassword.length < 8) {
            this.showMessage('Password must be at least 8 characters.', 'danger', 'password-save-message');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showMessage('Passwords do not match.', 'danger', 'password-save-message');
            return;
        }
        
        const result = await AUTH.updatePassword(newPassword);
        
        if (!result.success) {
            this.showMessage(result.error || 'Failed to update password.', 'danger', 'password-save-message');
            return;
        }
        
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        this.showMessage('Password updated successfully!', 'success', 'password-save-message');
    }
    
    async handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Basic validation
        if (file.size > 2 * 1024 * 1024) {
            this.showMessage("File is too large (max 2MB).", "danger", "profile-save-message");
            e.target.value = "";
            return;
        }
        if (!file.type.startsWith("image/")) {
            this.showMessage("Please select an image file.", "danger", "profile-save-message");
            e.target.value = "";
            return;
        }
        
        // Show local preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => {
            const avatar = document.getElementById("profile-avatar");
            const userAvatar = document.getElementById("user-avatar");
            if (avatar) avatar.src = ev.target.result;
            if (userAvatar) userAvatar.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        
        // Try to upload to Supabase Storage
        try {
            if (typeof Storage !== "undefined" && Storage.uploadAvatar && this.profile && this.profile.id) {
                const result = await Storage.uploadAvatar(file, this.profile.id);
                if (result && !result.error) {
                    const { data: urlData } = Storage.getPublicUrl("avatars", result.path);
                    if (urlData && urlData.publicUrl) {
                        await DB.profiles.update(this.profile.id, { avatar_url: urlData.publicUrl });
                        this.profile.avatar_url = urlData.publicUrl;
                        if (typeof AUTH !== "undefined") AUTH.currentProfile = this.profile;
                        this.showMessage("Avatar updated successfully!", "success", "profile-save-message");
                        e.target.value = "";
                        return;
                    }
                }
            }
            this.showMessage("Photo selected (preview shown). Connect Supabase Storage to save permanently.", "warning", "profile-save-message");
        } catch (err) {
            console.warn("Avatar upload error:", err);
            this.showMessage("Photo selected (preview shown). Upload requires Supabase connection.", "warning", "profile-save-message");
        }
        e.target.value = "";
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