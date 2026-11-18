// ============================================================
// SELAM BERTU TESFA - Users Module (Admin Only)
// ============================================================

class UsersModule {
    constructor() {
        // Prevent double init without breaking the instance
        if (window.__usersModuleStarted && window.usersModule) {
            return;
        }
        window.__usersModuleStarted = true;
        window.usersModule = this;

        this.data = [];
        this.roles = [];
        this.currentPage = 1;
        this.perPage = 20;
        this.filters = {
            role: 'all',
            status: 'all',
            search: ''
        };
        this.modalInstance = null;
        this.editingId = null;
        this.init();
    }
    
    async init() {
        try {
            if (typeof AUTH !== 'undefined' && AUTH.init) {
                try { await AUTH.init(); } catch (e) {}
            }
            // Wait briefly for profile/role to load
            for (let i = 0; i < 8; i++) {
                if (AUTH.currentProfile || AUTH.isAdmin()) break;
                await new Promise(r => setTimeout(r, 150));
                try { if (AUTH.init) await AUTH.init(); } catch (e) {}
            }
            // Re-show admin menus everywhere
            try {
                if (typeof applyPagePermissions === 'function') applyPagePermissions();
                document.querySelectorAll('.admin-only').forEach(el => {
                    if (AUTH.isAdmin()) el.classList.remove('d-none');
                });
            } catch (e) {}

            // Check admin permission (lenient)
            const role = String(AUTH.currentProfile?.role || AUTH.currentUser?.user_metadata?.role || '').toLowerCase();
            const ok = (typeof AUTH.isAdmin === 'function' && AUTH.isAdmin()) || role.includes('admin');
            if (!ok) {
                const pc = document.querySelector('.page-content');
                if (pc) {
                    pc.innerHTML = `
                    <div class="alert alert-danger">
                        You do not have permission to access user management. Role: ${role || 'unknown'}.
                        <br><small>If you are Admin, ensure profiles.role = administrator for your account.</small>
                    </div>`;
                }
                return;
            }
            
            await this.loadRoles();
            await this.loadData();
            
            this.setupUI();
            this.setupEventListeners();
            if (typeof this.renderTable === 'function') this.renderTable();
            if (typeof this.applyPermissions === 'function') this.applyPermissions();
            if (!this.data.length) {
                console.warn('Profiles query returned 0 rows. Check RLS / profiles table.');
            }
            
        } catch (error) {
            console.error('Users init error:', error);
            this.showError('Failed to load user data.');
        }
    }
    
    async loadRoles() {
        const { data, error } = await supabase
            .from('roles')
            .select('*');
        
        if (!error) {
            this.roles = data || [];
        }
    }
    
    async loadData() {
        let data = [];
        let error = null;
        // Simple select first (order/filters in JS — avoids missing-column / RLS filter issues)
        try {
            let res = await supabase.from('profiles').select('*');
            if (res.error) {
                // retry without order assumptions
                res = await supabase.from('profiles').select('id, auth_id, full_name, email, role, status, avatar_url, created_at, last_login');
            }
            if (res.error) {
                res = await supabase.from('profiles').select('id, full_name, email, role, status');
            }
            data = res.data || [];
            error = res.error;
        } catch (e) {
            error = e;
        }
        
        if (error) {
            console.error('Load users error:', error);
            this.showError('Failed to load users: ' + (error.message || error));
            this.data = [];
            return;
        }
        
        // Client-side filters
        if (this.filters.role && this.filters.role !== 'all') {
            const want = String(this.filters.role).toLowerCase();
            data = data.filter(u => {
                const r = String(u.role?.name || u.role || '').toLowerCase();
                if (want.includes('admin')) return r.includes('admin');
                if (want.includes('account')) return r.includes('account');
                return r === want;
            });
        }
        if (this.filters.status && this.filters.status !== 'all') {
            data = data.filter(u => String(u.status || '').toLowerCase() === String(this.filters.status).toLowerCase());
        }
        if (this.filters.search) {
            const q = this.filters.search.toLowerCase();
            data = data.filter(u =>
                String(u.full_name || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q)
            );
        }
        
        // Sort newest first when possible
        data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        this.data = data;
        console.log('Users loaded:', this.data.length);
    }
    

    populateRoleAndStatus() {
        const roleSel = document.getElementById('user-role');
        if (roleSel) {
            const isSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
                || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
            // Always rebuild so Role dropdown is never empty / hidden
            roleSel.innerHTML = '';
            if (isSA) {
                const optSA = document.createElement('option');
                optSA.value = 'super_admin';
                optSA.textContent = 'Super Admin';
                roleSel.appendChild(optSA);
            }
            const optAdmin = document.createElement('option');
            optAdmin.value = 'administrator';
            optAdmin.textContent = 'Administrator';
            roleSel.appendChild(optAdmin);
            const optAcc = document.createElement('option');
            optAcc.value = 'accountant';
            optAcc.textContent = 'Accountant';
            roleSel.appendChild(optAcc);
            const optView = document.createElement('option');
            optView.value = 'viewer';
            optView.textContent = 'Viewer (read-only)';
            roleSel.appendChild(optView);
        }
        const st = document.getElementById('user-status');
        if (st) {
            st.innerHTML = `
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
            `;
        }
        const filterRole = document.getElementById('user-filter-role');
        if (filterRole) {
            filterRole.innerHTML = `
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="administrator">Administrator</option>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer</option>
            `;
        }
        const filterStatus = document.getElementById('user-filter-status');
        if (filterStatus) {
            filterStatus.innerHTML = `
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
            `;
        }
    }

    setupUI() {
        this.populateRoleAndStatus();
        const modalEl = document.getElementById('user-modal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }
    }
    
    setupEventListeners() {
        document.getElementById('create-user-btn')?.addEventListener('click', () => {
            this.openCreateModal();
        });
        const saveBtn = document.getElementById('save-user-btn');
        if (saveBtn && !saveBtn._sbtBound) {
            saveBtn._sbtBound = true;
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveUser();
            });
        }
        document.getElementById('apply-user-filters')?.addEventListener('click', () => {
            this.filters.role = document.getElementById('user-role-filter')?.value
                || document.getElementById('user-filter-role')?.value || 'all';
            this.filters.status = document.getElementById('user-status-filter')?.value
                || document.getElementById('user-filter-status')?.value || 'all';
            this.filters.search = (document.getElementById('user-search')?.value || '').trim();
            this.currentPage = 1;
            this.refresh();
        });
        document.getElementById('user-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('apply-user-filters')?.click();
        });
    }

    resolveAvatarUrl(url) {
        if (!url) return 'assets/images/logo.png';
        if (/^https?:\/\//i.test(url)) return url;
        try {
            if (typeof supabase !== 'undefined') {
                let p = String(url);
                if (p.startsWith('avatars/')) p = p.slice(8);
                const { data } = supabase.storage.from('avatars').getPublicUrl(p);
                if (data?.publicUrl) return data.publicUrl;
            }
        } catch (e) {}
        return 'assets/images/logo.png';
    }

    bindAvatarPreview() {
        const fileInput = document.getElementById('user-avatar-file');
        const preview = document.getElementById('user-avatar-preview');
        if (!fileInput || fileInput._bound) return;
        fileInput._bound = true;
        fileInput.addEventListener('change', () => {
            const f = fileInput.files && fileInput.files[0];
            if (!f || !preview) return;
            if (!f.type.startsWith('image/')) {
                if (typeof showAppMessage === "function") showAppMessage("Notice", 'Please select an image file.', "info"); else console.log('Please select an image file.');
                fileInput.value = '';
                return;
            }
            if (f.size > 2 * 1024 * 1024) {
                if (typeof showAppMessage === "function") showAppMessage("Notice", 'Max photo size is 2MB.', "info"); else console.log('Max photo size is 2MB.');
                fileInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => { preview.src = ev.target.result; };
            reader.readAsDataURL(f);
        });
    }

    async uploadUserAvatar(profileId) {
        const fileInput = document.getElementById('user-avatar-file');
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (!file || !profileId) return null;
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = profileId + '_' + Date.now() + '.' + ext;
            const up = await supabase.storage.from('avatars').upload(path, file, {
                upsert: true,
                contentType: file.type || 'image/jpeg'
            });
            if (up.error) {
                console.warn('Avatar upload', up.error);
                if (typeof showAppMessage === 'function') {
                    showAppMessage('Photo upload failed', (up.error.message || 'Storage error') +
                        '. Create a PUBLIC Storage bucket named "avatars" in Supabase.', 'error');
                }
                return null;
            }
            const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
            const publicUrl = pub && pub.publicUrl;
            if (publicUrl) {
                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profileId);
            }
            return publicUrl;
        } catch (e) {
            console.warn(e);
            return null;
        }
    }

    openCreateModal() {
        this.editingId = null;
        document.getElementById('user-modal-title').textContent = 'Add User';
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('password-field').style.display = 'block';
        document.getElementById('user-password').required = true;
        const nameEl = document.getElementById('user-fullname');
        const emailEl = document.getElementById('user-email');
        if (nameEl) { nameEl.disabled = false; nameEl.readOnly = false; nameEl.title = ''; }
        if (emailEl) { emailEl.disabled = false; emailEl.readOnly = false; emailEl.title = ''; }
        // Always rebuild role + status options so the Role dropdown is visible
        this.populateRoleAndStatus();
        const statusEl = document.getElementById('user-status');
        if (statusEl) statusEl.value = 'active';
        const roleEl = document.getElementById('user-role');
        if (roleEl) roleEl.value = 'accountant';
        const preview = document.getElementById('user-avatar-preview');
        if (preview) preview.src = 'assets/images/logo.png';
        const fileInput = document.getElementById('user-avatar-file');
        if (fileInput) fileInput.value = '';
        this.bindAvatarPreview();
        this.modalInstance.show();
    }
    
    async openEditModal(id) {
        const user = this.data.find(u => u.id === id);
        if (!user) {
            this.showError('User not found.');
            return;
        }
        const roleRaw = String(user.role || '').toLowerCase();
        const targetIsAdmin = roleRaw.includes('admin');
        const actorIsSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
        const me = AUTH.getCurrentProfile && AUTH.getCurrentProfile();
        const isYou = me && String(me.id) === String(id);
        if (targetIsAdmin && !actorIsSA && !isYou) {
            this.showToast('Only Super Admin can edit Administrator / Super Admin accounts.', 'error');
            return;
        }
        
        this.editingId = id;
        document.getElementById('user-modal-title').textContent = 'Edit User';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-fullname').value = user.full_name;
        document.getElementById('user-email').value = user.email;
        // SECURITY: name and email are permanent after user is created (even Super Admin)
        const nameEl = document.getElementById('user-fullname');
        const emailEl = document.getElementById('user-email');
        if (nameEl) {
            nameEl.disabled = true; nameEl.readOnly = true;
            nameEl.style.pointerEvents = 'none';
            nameEl.style.backgroundColor = '#e9ecef';
            nameEl.title = 'Name cannot be changed after creation';
        }
        if (emailEl) {
            emailEl.disabled = true; emailEl.readOnly = true;
            emailEl.style.pointerEvents = 'none';
            emailEl.style.backgroundColor = '#e9ecef';
            emailEl.title = 'Email cannot be changed after creation';
        }
        document.getElementById('password-field').style.display = 'none';
        document.getElementById('user-password').required = false;
        
        // Always rebuild Role dropdown so options are visible
        this.populateRoleAndStatus();
        const roleSelect = document.getElementById('user-role');
        if (roleSelect) {
            const r = (user.role?.name || user.role || 'accountant').toString().toLowerCase().trim();
            if (r === 'super_admin' || r === 'superadmin') roleSelect.value = 'super_admin';
            else if (r.includes('admin')) roleSelect.value = 'administrator';
            else if (r === 'viewer') roleSelect.value = 'viewer';
            else roleSelect.value = 'accountant';
        }
        
        const statusEl = document.getElementById('user-status');
        if (statusEl) statusEl.value = user.status || 'active';
        
        const preview = document.getElementById('user-avatar-preview');
        if (preview) preview.src = this.resolveAvatarUrl(user.avatar_url);
        const fileInput = document.getElementById('user-avatar-file');
        if (fileInput) fileInput.value = '';
        this.bindAvatarPreview();
        this.modalInstance.show();
    }
    
    async saveUser() {
        if (this._saving) return;
        this._saving = true;
        this._lastCreatedProfileId = null;
        const id = document.getElementById('user-id').value;
        const fullName = document.getElementById('user-fullname').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        const roleId = document.getElementById('user-role').value;
        const status = document.getElementById('user-status').value;
        
        // Validate
        if (!fullName) {
            this._saving = false;
            this.showToast('Please enter full name.', 'error');
            return;
        }
        if (!email) {
            this._saving = false;
            this.showToast('Please enter email.', 'error');
            return;
        }
        if (!roleId) {
            this._saving = false;
            this.showToast('Please select a role.', 'error');
            return;
        }
        
        if (!id && (!password || password.length < 8)) {
            this._saving = false;
            this.showToast('Password must be at least 8 characters.', 'error');
            return;
        }

        // Duplicate email protection
        if (typeof checkEmailExists === 'function') {
            const emCheck = await checkEmailExists(email, id || null);
            if (emCheck.exists) {
                this._saving = false;
                this.showToast(emCheck.message || 'This email address already exists. Please use a different email address.', 'error');
                return;
            }
        }
        
        this.setLoading(true);
        
        let result;
        
        if (id) {
            // Update existing user — protect identity fields
            const roleValue = (roleId === 'super_admin' || roleId === 'superadmin') ? 'super_admin'
                : (roleId === 'administrator' || roleId === 'admin') ? 'administrator' : 'accountant';
            const actorIsSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
                || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
            if (roleValue === 'super_admin' && !actorIsSA) {
                this.setLoading(false);
                this._saving = false;
                this.showToast('Only Super Admin can assign Super Admin role.', 'error');
                return;
            }
            // SECURITY: name and email are permanent after creation (even Super Admin).
            // Only role and status may be changed here.
            const updates = {
                role: roleValue,
                status: status || 'active'
            };
            delete updates.full_name;
            delete updates.email;
            const existing = (this.data || []).find(u => String(u.id) === String(id));
            if (existing) {
                if (fullName && fullName !== existing.full_name) {
                    this.setLoading(false);
                    this._saving = false;
                    this.showToast('Name cannot be changed after the user is created.', 'error');
                    return;
                }
                if (email && existing.email && email.toLowerCase() !== String(existing.email).toLowerCase()) {
                    this.setLoading(false);
                    this._saving = false;
                    this.showToast('Email cannot be changed after the user is created.', 'error');
                    return;
                }
            }
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (!error && typeof logAudit === 'function') {
                try { await logAudit('USER_UPDATE', 'profiles', id, null, updates); } catch (e) {}
            }
            result = { data, error };
        } else {
            // Create user: preserve admin session, signUp, restore admin, write profile
            const roleValue = (roleId === 'super_admin' || roleId === 'superadmin') ? 'super_admin'
                : (roleId === 'administrator' || roleId === 'admin') ? 'administrator' : 'accountant';
            
            let adminAccess = null, adminRefresh = null;
            try {
                const { data: sessWrap } = await supabase.auth.getSession();
                adminAccess = sessWrap?.session?.access_token || null;
                adminRefresh = sessWrap?.session?.refresh_token || null;
            } catch (e) {}
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password || ('Temp@' + Math.random().toString(36).slice(2, 10) + '1a'),
                options: {
                    data: { full_name: fullName, role: roleValue },
                    emailRedirectTo: window.location.origin + '/login.html'
                }
            });
            
            if (authError) {
                const msg = (authError.message || '').toLowerCase();
                if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
                    // Email already in Auth — link profile using password admin typed
                    let linkedId = null;
                    try {
                        const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        if (!signErr && signData?.user?.id) {
                            linkedId = signData.user.id;
                        }
                    } catch (e) {}
                    // Restore admin session
                    try {
                        if (adminAccess && adminRefresh) {
                            await supabase.auth.setSession({
                                access_token: adminAccess,
                                refresh_token: adminRefresh
                            });
                        }
                    } catch (e) {}
                    if (linkedId) {
                        let ins = await supabase.from('profiles').upsert({
                            auth_id: linkedId,
                            full_name: fullName,
                            email: email,
                            role: roleValue,
                            status: status || 'active'
                        }, { onConflict: 'auth_id' }).select().maybeSingle();
                        if (ins.error || !ins.data) {
                            ins = await supabase.from('profiles').insert({
                                auth_id: linkedId,
                                full_name: fullName,
                                email: email,
                                role: roleValue,
                                status: status || 'active'
                            }).select().maybeSingle();
                        }
                        if (ins.error || !ins.data) {
                            const byEmail = await supabase.from('profiles').update({
                                auth_id: linkedId,
                                full_name: fullName,
                                role: roleValue,
                                status: status || 'active'
                            }).eq('email', email).select().maybeSingle();
                            result = { data: byEmail.data, error: byEmail.error };
                        } else {
                            result = { data: ins.data, error: null };
                        }
                        if (!result.error && result.data) {
                            this._lastCreatedProfileId = result.data.id;
                        }
                    } else {
                        // Cannot get auth id — ensure profile by email at least
                        let ins = await supabase.from('profiles').upsert({
                            email: email,
                            full_name: fullName,
                            role: roleValue,
                            status: status || 'active'
                        }, { onConflict: 'email' }).select().maybeSingle();
                        if (ins.error) {
                            ins = await supabase.from('profiles').insert({
                                email: email,
                                full_name: fullName,
                                role: roleValue,
                                status: status || 'active'
                            }).select().maybeSingle();
                        }
                        if (ins.data && !ins.error) {
                            result = { data: ins.data, error: null };
                            this._lastCreatedProfileId = ins.data.id;
                        } else {
                            result = {
                                data: null,
                                error: {
                                    message:
                                        'This email already exists in Supabase Authentication.\n\n' +
                                        'Options:\n' +
                                        '1. Use the SAME password that account already has, then Save again.\n' +
                                        '2. Or delete that user in Supabase → Authentication → Users, then add again.\n' +
                                        '3. Or use a different email.'
                                }
                            };
                        }
                    }
                } else {
                    result = { data: null, error: authError };
                }
            } else {
                const newAuthId = authData?.user?.id;
                // Restore admin session so we stay logged in as admin
                try {
                    if (adminAccess && adminRefresh) {
                        await supabase.auth.setSession({
                            access_token: adminAccess,
                            refresh_token: adminRefresh
                        });
                    }
                } catch (e) {
                    console.warn('Could not restore admin session', e);
                }
                
                // Upsert profile for the new user (multiple fallbacks)
                if (newAuthId) {
                    let prof = null, profErr = null;
                    let ins = await supabase.from('profiles').upsert({
                        auth_id: newAuthId,
                        full_name: fullName,
                        email: email,
                        role: roleValue,
                        status: status || 'active'
                    }, { onConflict: 'auth_id' }).select().maybeSingle();
                    prof = ins.data; profErr = ins.error;
                    if (profErr) {
                        ins = await supabase.from('profiles').insert({
                            auth_id: newAuthId,
                            full_name: fullName,
                            email: email,
                            role: roleValue,
                            status: status || 'active'
                        }).select().maybeSingle();
                        prof = ins.data; profErr = ins.error;
                    }
                    if (profErr) {
                        // last resort: update by email
                        ins = await supabase.from('profiles').update({
                            auth_id: newAuthId,
                            full_name: fullName,
                            role: roleValue,
                            status: status || 'active'
                        }).eq('email', email).select().maybeSingle();
                        if (!ins.error && ins.data) { prof = ins.data; profErr = null; }
                    }
                    // Trigger may have created profile already
                    if (profErr || !prof) {
                        const check = await supabase.from('profiles').select('*').eq('auth_id', newAuthId).maybeSingle();
                        if (check.data) { prof = check.data; profErr = null; }
                    }
                    result = { data: prof, error: profErr };
                } else {
                    result = { data: null, error: { message: 'User created in Auth but no user id returned. In Supabase → Authentication → Providers → Email, turn OFF "Confirm email" for admin-created accounts.' } };
                }
                
                if (typeof logAudit === 'function' && newAuthId) {
                    this._lastCreatedProfileId = null;
                    // resolve profile id for avatar
                    try {
                        const pr = await supabase.from('profiles').select('id').eq('auth_id', newAuthId).maybeSingle();
                        if (pr.data?.id) this._lastCreatedProfileId = pr.data.id;
                        else {
                            const pr2 = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
                            if (pr2.data?.id) this._lastCreatedProfileId = pr2.data.id;
                        }
                    } catch (e) {}
                    await logAudit('USER_CREATE', 'profiles', newAuthId, null, { email, role: roleValue });
                }
            }
        }
        
        this.setLoading(false);
        
        // If auth created user but profile write failed, try one more profile upsert
        if (result?.error) {
            const msg = String(result.error.message || result.error.msg || result.error || 'Failed to save user.');
            const low = msg.toLowerCase();
            // Soft recovery: sometimes Auth user exists and profile can still be written
            if (low.includes('database error') || low.includes('saving new user')) {
                try {
                    const emailEl = document.getElementById('user-email');
                    const em = (emailEl?.value || '').trim().toLowerCase();
                    const fullName = (document.getElementById('user-fullname')?.value || '').trim();
                    const roleId = document.getElementById('user-role')?.value;
                    const roleValue = (roleId === 'super_admin' || roleId === 'superadmin') ? 'super_admin'
                : (roleId === 'administrator' || roleId === 'admin') ? 'administrator' : 'accountant';
                    const status = document.getElementById('user-status')?.value || 'active';
                    let ins = await supabase.from('profiles').upsert({
                        email: em,
                        full_name: fullName,
                        role: roleValue,
                        status: status
                    }, { onConflict: 'email' }).select().maybeSingle();
                    if (ins.error) {
                        ins = await supabase.from('profiles').insert({
                            email: em,
                            full_name: fullName,
                            role: roleValue,
                            status: status
                        }).select().maybeSingle();
                    }
                    if (ins.data && !ins.error) {
                        result = { data: ins.data, error: null };
                        this._lastCreatedProfileId = ins.data.id;
                    }
                } catch (e) {}
            }
        }

        if (result?.error) {
            const msg = result.error.message || result.error.msg || 'Failed to save user.';
            this.showToast(msg, 'error');
            // Only one error toast — no long alert
            return;
        }
        
        document.getElementById('user-email').disabled = false;
        try {
            const pid = this.editingId || this._lastCreatedProfileId || (result && result.data && result.data.id);
            if (pid) {
                try { await this.uploadUserAvatar(pid); } catch (e) { console.warn(e); }
            }
            this.modalInstance?.hide();
        } catch (e) {}
        // Success only — no alert
        this.showToast('User saved successfully!', 'success');
        await this.refresh();
    }
    
    async deleteUser(id) {
        const user = (this.data || []).find(u => String(u.id) === String(id));
        if (!user) {
            this.showToast('User not found.', 'error');
            return;
        }
        // Only Super Admin may delete users
        const actorIsSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
        if (!actorIsSA) {
            this.showToast('Only Super Admin can delete users.', 'error');
            return;
        }
        // Prevent deleting yourself
        try {
            const me = AUTH.getCurrentProfile && AUTH.getCurrentProfile();
            if (me && String(me.id) === String(id)) {
                this.showToast('You cannot delete your own account while logged in.', 'error');
                return;
            }
        } catch (e) {}

        const label = user.full_name || user.email || id;
        const targetRole = String(user.role || '').toLowerCase();
        // Extra safety: non-SA already blocked above; keep message for admin targets
        if (targetRole.includes('admin') && !actorIsSA) {
            this.showToast('Only Super Admin can delete Administrator or Super Admin accounts.', 'error');
            return;
        }
        if (!confirm('Permanently delete user "' + label + '"?\n\nThis removes their profile from the system. This cannot be undone.')) return;
        if (!(await confirmPermanentDelete('Type confirmation to permanently delete this user from all profile data.'))) return;

        this.showToast('Deleting user...', 'info');

        const authId = user.auth_id || user.user_id || null;

        // 1) Detach FKs so profile row can be removed
        const detach = [
            ['income', 'created_by'],
            ['income', 'requested_by'],
            ['expenses', 'created_by'],
            ['expenses', 'requested_by'],
            ['audit_logs', 'user_id'],
            ['notifications', 'user_id'],
            ['memos', 'created_by'],
            ['receipts', 'uploaded_by'],
            ['audit_evidence', 'uploaded_by'],
            ['audit_evidence', 'created_by']
        ];
        for (const [table, col] of detach) {
            try {
                await supabase.from(table).update({ [col]: null }).eq(col, id);
                if (authId) await supabase.from(table).update({ [col]: null }).eq(col, authId);
            } catch (e) {}
        }

        // 2) Hard delete profile
        let delErr = null;
        let res = await supabase.from('profiles').delete().eq('id', id);
        delErr = res.error;
        if (delErr && authId) {
            res = await supabase.from('profiles').delete().eq('auth_id', authId);
            delErr = res.error;
        }
        if (delErr) {
            // 3) Force disable: scramble identity so they cannot appear as active staff
            const stamp = Date.now();
            const soft = await supabase.from('profiles').update({
                status: 'suspended',
                full_name: (user.full_name || 'User') + ' (deleted)',
                email: 'deleted+' + stamp + '@deleted.local',
                role: 'accountant',
                avatar_url: null
            }).eq('id', id);
            if (soft.error) {
                this.showToast('Delete failed: ' + (delErr.message || soft.error.message), 'error');
                return;
            }
            if (typeof logAudit === 'function') {
                await logAudit('USER_DELETE_SOFT', 'profiles', id, { email: user.email }, { status: 'suspended' });
            }
            this.showToast('User removed from active staff (linked records blocked hard delete). Account disabled.', 'success');
            await this.refresh();
            return;
        }

        // 4) Try RPC to remove auth user if available (optional)
        if (authId) {
            try {
                await supabase.rpc('admin_delete_auth_user', { target_uid: authId });
            } catch (e) {
                console.warn('auth delete rpc not available', e);
            }
        }

        if (typeof logAudit === 'function') {
            await logAudit('USER_DELETE', 'profiles', id, { email: user.email, auth_id: authId }, null);
        }
        this.showToast('User permanently deleted.', 'success');
        await this.refresh();
    }

    async toggleUserStatus(id, currentStatus) {
        const cycle = { active: 'inactive', inactive: 'suspended', suspended: 'active' };
        const newStatus = cycle[currentStatus] || 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        
        const { data, error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            this.showToast(error.message || 'Failed to update user status.', 'error');
            return;
        }
        if (typeof logAudit === 'function') {
            try {
                await logAudit('USER_STATUS', 'profiles', id, { status: currentStatus }, { status: newStatus, email: data?.email });
            } catch (e) {}
        }
        this.showToast(`User ${action}d successfully.`, 'success');
        this.refresh();
    }
    

    async refresh() {
        await this.loadData();
        this.renderTable();
    }

    applyPermissions() {
        // Admin-only page already gated in init
    }

    renderTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        const list = Array.isArray(this.data) ? this.data : [];
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / this.perPage) || 1);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const start = (this.currentPage - 1) * this.perPage;
        const pageData = list.slice(start, start + this.perPage);

        const info = document.getElementById('users-pagination-info');
        if (info) info.textContent = total ? ('Showing ' + total + ' user' + (total === 1 ? '' : 's')) : 'Showing 0 users';

        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No users found. Click <strong>Add User</strong> or run FIX_USERS_VISIBLE.sql if profiles exist in Supabase.</td></tr>';
            return;
        }

        const currentId = (typeof AUTH !== 'undefined' && AUTH.getCurrentProfile) ? AUTH.getCurrentProfile()?.id : null;
        const actorIsSA = (typeof isSuperAdmin === 'function' && isSuperAdmin())
            || (typeof AUTH !== 'undefined' && AUTH.isSuperAdmin && AUTH.isSuperAdmin());
        tbody.innerHTML = pageData.map(user => {
            const roleRaw = (user.role?.name || user.role || '').toString().toLowerCase().trim();
            const targetIsAdmin = roleRaw === 'super_admin' || roleRaw === 'superadmin' || roleRaw.includes('admin');
            let roleLabel = 'User';
            let roleBadge = 'bg-secondary';
            if (roleRaw === 'super_admin' || roleRaw === 'superadmin') {
                roleLabel = 'Super Admin';
                roleBadge = 'bg-danger';
            } else if (roleRaw.includes('admin')) {
                roleLabel = 'Administrator';
                roleBadge = 'bg-primary';
            } else if (roleRaw.includes('account')) {
                roleLabel = 'Accountant';
                roleBadge = 'bg-info text-dark';
            } else if (roleRaw === 'viewer') {
                roleLabel = 'Viewer';
                roleBadge = 'bg-secondary';
            }
            const status = (user.status || 'active').toString().toLowerCase();
            const statusColor = status === 'active' ? 'success' : (status === 'suspended' ? 'danger' : 'secondary');
            const lastLogin = user.last_login ? (typeof formatDateTime === 'function' ? formatDateTime(user.last_login) : user.last_login) : 'Never';
            const avatar = this.resolveAvatarUrl ? this.resolveAvatarUrl(user.avatar_url) : (user.avatar_url || 'assets/images/logo.png');
            const isYou = currentId && user.id === currentId;
            const name = user.full_name || user.email || 'User';
            // Super Admin: full control. Normal admin: cannot edit/delete/status other admins; never delete.
            const showDelete = actorIsSA && !isYou;
            const showEdit = actorIsSA || !targetIsAdmin || !!isYou;
            const showStatus = actorIsSA || !targetIsAdmin;
            return '<tr>' +
                '<td><div class="d-flex align-items-center gap-2">' +
                '<img src="' + avatar + '" alt="" class="rounded-circle" style="width:32px;height:32px;object-fit:cover">' +
                '<span>' + this.escapeHtml(name) + (isYou ? ' <span class="badge bg-info">You</span>' : '') + '</span></div></td>' +
                '<td>' + this.escapeHtml(user.email || '') + '</td>' +
                '<td><span class="badge ' + roleBadge + '">' + roleLabel + '</span></td>' +
                '<td><span class="badge bg-' + statusColor + '">' + status + '</span></td>' +
                '<td>' + lastLogin + '</td>' +
                '<td class="text-nowrap">' +
                (showEdit ? '<button type="button" class="btn btn-sm btn-outline-warning edit-user-btn" data-id="' + user.id + '" title="Edit"><i class="bi bi-pencil"></i></button> ' : '') +
                (showStatus ? '<button type="button" class="btn btn-sm btn-outline-secondary status-user-btn" data-id="' + user.id + '" data-status="' + status + '" title="Cycle status"><i class="bi bi-arrow-repeat"></i></button> ' : '') +
                (showDelete ? '<button type="button" class="btn btn-sm btn-outline-danger delete-user-btn" data-id="' + user.id + '" title="Delete (Super Admin only)"><i class="bi bi-trash"></i></button>' : '') +
                '</td></tr>';
        }).join('');

        tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
        });
        tbody.querySelectorAll('.status-user-btn').forEach(btn => {
            btn.addEventListener('click', () => this.toggleUserStatus(btn.dataset.id, btn.dataset.status));
        });
        tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteUser(btn.dataset.id));
        });
    }

    escapeHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    setLoading(loading) {
        this._saving = !!loading;
        const btn = document.getElementById('save-user-btn');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Saving...' : 'Save User';
        }
    }
    
    showToast(message, type = 'info') {
        const title = type === 'success' ? 'Success' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Notice'));
        if (typeof showAppMessage === 'function') {
            showAppMessage(title, message, type);
            return;
        }
        if (typeof window.showToast === 'function' && window.showToast !== this.showToast) {
            try { window.showToast(message, type); return; } catch (e) {}
        }
        if (type === 'success' || type === 'error') if (typeof showAppMessage === "function") showAppMessage("Notice", message, "info"); else console.log(message);
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
// Initialize Users Module
// ============================================================

if (document.getElementById('users-table-body')) {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            if (!window.__usersModuleStarted && !window.__usersModuleInstance) {
                try { window.usersModule = new UsersModule(); } catch (e) { console.error(e); }
            }
        }, 400);
    });
}