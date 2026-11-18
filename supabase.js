

// ============================================================
// ============================================================
// SELAM BERTU TESFA - Supabase Client
// ============================================================

const SUPABASE_URL = 'https://dfaxwzsiwrpwgambutro.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYXh3enNpd3Jwd2dhbWJ1dHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDkxNzMsImV4cCI6MjEwNDE4NTE3M30.qg5W82VG3_m2-qdBShys3IBotZFahUaasDeMvhBruOM';

// Correct way (avoids name conflict with the CDN library)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Make it available as "supabase" for the rest of your project
window.supabase = supabaseClient;
var supabase = supabaseClient;



// ============================================================
// Database Queries
// ============================================================

const DB = {
    // Profiles
    profiles: {
        getByAuthId: async (authId) => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('auth_id', authId)
                .maybeSingle();
            return { data, error };
        },
        
        getById: async (id) => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            return { data, error };
        },
        
        update: async (id, updates) => {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            return { data, error };
        },
        
        list: async (filters = {}) => {
            let query = supabase.from('profiles').select('*');
            
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.role) {
                // profiles.role is the text column (administrator, accountant, super_admin, viewer)
                // role_id is the optional FK to roles table
                query = query.eq('role', filters.role);
            }
            
            const { data, error } = await query;
            return { data, error };
        }
    },
    
    // Financial Years
    financialYears: {
        getCurrent: async () => {
            const { data, error } = await supabase
                .from('financial_years')
                .select('*')
                .eq('status', 'open')
                .single();
            return { data, error };
        },
        
        getAll: async () => {
            const { data, error } = await supabase
                .from('financial_years')
                .select('*')
                .order('start_date', { ascending: false });
            return { data, error };
        },
        
        getById: async (id) => {
            const { data, error } = await supabase
                .from('financial_years')
                .select('*')
                .eq('id', id)
                .single();
            return { data, error };
        }
    },
    
    // Income
    income: {
        list: async (filters = {}) => {
            let query = supabase
                .from('income')
                .select(`
                    *,
                    category:category_id(*),
                    payment_method:payment_method_id(*),
                    received_by_user:received_by(full_name, avatar_url),
                    created_by_user:created_by(full_name, avatar_url)
                `)
                .eq('is_deleted', false);
            
            if (filters.financial_year_id) {
                query = query.eq('financial_year_id', filters.financial_year_id);
            }
            if (filters.approval_status) {
                query = query.eq('approval_status', filters.approval_status);
            }
            if (filters.category_id) {
                query = query.eq('category_id', filters.category_id);
            }
            if (filters.date_from && filters.date_to) {
                query = query.gte('date', filters.date_from).lte('date', filters.date_to);
            }
            
            query = query.order('created_at', { ascending: false });
            
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            return { data, error };
        },
        
        getById: async (id) => {
            const { data, error } = await supabase
                .from('income')
                .select(`
                    *,
                    category:category_id(*),
                    payment_method:payment_method_id(*),
                    received_by_user:received_by(full_name, avatar_url),
                    created_by_user:created_by(full_name, avatar_url)
                `)
                .eq('id', id)
                .single();
            return { data, error };
        },
        
        create: async (incomeData) => {
            const { data, error } = await supabase
                .from('income')
                .insert(incomeData)
                .select()
                .single();
            return { data, error };
        },
        
        update: async (id, updates) => {
            const { data, error } = await supabase
                .from('income')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            return { data, error };
        },
        
        delete: async (id) => {
            // Hard delete so row is removed from database
            let res = await supabase.from('income').delete().eq('id', id).select();
            if (res.error) {
                // Fallback soft delete
                res = await supabase.from('income').update({ is_deleted: true }).eq('id', id).select();
            }
            return { data: res.data, error: res.error };
        }
    },
    
    // Expenses
    expenses: {
        list: async (filters = {}) => {
            let query = supabase
                .from('expenses')
                .select(`
                    *,
                    category:category_id(*),
                    payment_method:payment_method_id(*),
                    requested_by_user:requested_by(full_name, avatar_url),
                    created_by_user:created_by(full_name, avatar_url),
                    approved_by_user:approved_by(full_name, avatar_url)
                `)
                .eq('is_deleted', false);
            
            if (filters.financial_year_id) {
                query = query.eq('financial_year_id', filters.financial_year_id);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.category_id) {
                query = query.eq('category_id', filters.category_id);
            }
            if (filters.date_from && filters.date_to) {
                query = query.gte('date', filters.date_from).lte('date', filters.date_to);
            }
            
            query = query.order('created_at', { ascending: false });
            
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            return { data, error };
        },
        
        getById: async (id) => {
            const { data, error } = await supabase
                .from('expenses')
                .select(`
                    *,
                    category:category_id(*),
                    payment_method:payment_method_id(*),
                    requested_by_user:requested_by(full_name, avatar_url),
                    created_by_user:created_by(full_name, avatar_url),
                    approved_by_user:approved_by(full_name, avatar_url)
                `)
                .eq('id', id)
                .single();
            return { data, error };
        },
        
        create: async (expenseData) => {
            const { data, error } = await supabase
                .from('expenses')
                .insert(expenseData)
                .select()
                .single();
            return { data, error };
        },
        
        update: async (id, updates) => {
            const { data, error } = await supabase
                .from('expenses')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            return { data, error };
        },
        
        delete: async (id) => {
            let res = await supabase.from('expenses').delete().eq('id', id).select();
            if (res.error) {
                res = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id).select();
            }
            return { data: res.data, error: res.error };
        }
    },
    
    // Approvals
    approvals: {
        list: async (filters = {}) => {
            let query = supabase
                .from('approvals')
                .select(`
                    *,
                    submitted_by_user:submitted_by(full_name, avatar_url),
                    reviewed_by_user:reviewed_by(full_name, avatar_url)
                `);
            
            if (filters.transaction_type) {
                query = query.eq('transaction_type', filters.transaction_type);
            }
            if (filters.decision) {
                query = query.eq('decision', filters.decision);
            }
            
            query = query.order('submitted_date', { ascending: false });
            
            const { data, error } = await query;
            return { data, error };
        },
        
        create: async (approvalData) => {
            const { data, error } = await supabase
                .from('approvals')
                .insert(approvalData)
                .select()
                .single();
            return { data, error };
        }
    },
    
    // Budgets
    budgets: {
        list: async (filters = {}) => {
            let query = supabase
                .from('budgets')
                .select(`
                    *,
                    category:category_id(*),
                    financial_year:financial_year_id(*)
                `);
            
            if (filters.financial_year_id) {
                query = query.eq('financial_year_id', filters.financial_year_id);
            }
            
            const { data, error } = await query;
            return { data, error };
        },
        
        create: async (budgetData) => {
            const { data, error } = await supabase
                .from('budgets')
                .insert(budgetData)
                .select()
                .single();
            return { data, error };
        },
        
        update: async (id, updates) => {
            const { data, error } = await supabase
                .from('budgets')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            return { data, error };
        }
    },
    
    // Receipts
    receipts: {
        upload: async (file, path) => {
            const { data, error } = await supabase.storage
                .from('receipts')
                .upload(path, file);
            return { data, error };
        },
        
        getUrl: (path) => {
            return supabase.storage.from('receipts').getPublicUrl(path);
        },
        
        list: async (filters = {}) => {
            let query = supabase
                .from('receipts')
                .select(`
                    *,
                    uploaded_by_user:uploaded_by(full_name, avatar_url)
                `);
            
            if (filters.transaction_id) {
                query = query.eq('transaction_id', filters.transaction_id);
            }
            if (filters.transaction_type) {
                query = query.eq('transaction_type', filters.transaction_type);
            }
            
            query = query.order('upload_date', { ascending: false });
            
            const { data, error } = await query;
            return { data, error };
        },
        
        create: async (receiptData) => {
            const { data, error } = await supabase
                .from('receipts')
                .insert(receiptData)
                .select()
                .single();
            return { data, error };
        }
    },
    
    // Audit Logs
    auditLogs: {
        list: async (filters = {}) => {
            let query = supabase
                .from('audit_logs')
                .select(`
                    *,
                    user:user_id(full_name, email)
                `)
                .order('timestamp', { ascending: false });
            
            if (filters.action) {
                query = query.eq('action', filters.action);
            }
            if (filters.entity) {
                query = query.eq('entity', filters.entity);
            }
            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }
            if (filters.date_from && filters.date_to) {
                query = query.gte('timestamp', filters.date_from).lte('timestamp', filters.date_to);
            }
            
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            return { data, error };
        },
        
        create: async (logData) => {
            const { data, error } = await supabase
                .from('audit_logs')
                .insert(logData)
                .select()
                .single();
            return { data, error };
        }
    },
    
    // Notifications
    notifications: {
        list: async (userId, unreadOnly = false) => {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (unreadOnly) {
                query = query.eq('is_read', false);
            }
            
            const { data, error } = await query;
            return { data, error };
        },
        
        markRead: async (id) => {
            const { data, error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            return { data, error };
        },
        
        markAllRead: async (userId) => {
            const { data, error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('is_read', false)
                .select();
            return { data, error };
        },
        
        create: async (notificationData) => {
            const { data, error } = await supabase
                .from('notifications')
                .insert(notificationData)
                .select()
                .single();
            return { data, error };
        }
    }
};

// ============================================================
// Storage Operations
// ============================================================

const Storage = {
    uploadReceipt: async (file, transactionId, transactionType) => {
        const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
        const safeName = String(transactionId || 'file').replace(/[^a-zA-Z0-9_-]/g, '_');
        const path = `${transactionType || 'misc'}/${safeName}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('receipts')
            .upload(path, file, { upsert: true, contentType: file.type || undefined });
        
        if (error) {
            return { data: null, error, path: null, publicUrl: null };
        }
        const { data: pub } = supabase.storage.from('receipts').getPublicUrl(path);
        return {
            data: data,
            error: null,
            path: path,
            publicUrl: pub?.publicUrl || null
        };
    },
    
    uploadAvatar: async (file, userId) => {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const fileName = `${userId}_${Date.now()}.${ext}`;
        const path = fileName; // path inside bucket
        // ensure bucket exists attempts are silent
        let data = null, error = null;
        ({ data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' }));
        if (error) {
            // try public folder style
            ({ data, error } = await supabase.storage.from('avatars').upload(`public/${path}`, file, { upsert: true, contentType: file.type || 'image/jpeg' }));
            if (!error && data) data.path = data.path || `public/${path}`;
        }
        if (error) return { data: null, error, path: null };
        const finalPath = data?.path || path;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(finalPath);
        return { data, error: null, path: finalPath, publicUrl: pub?.publicUrl || null };
    },
    
    getPublicUrl: (bucket, path) => {
        // Already a full URL — return as-is (do not double-wrap)
        if (!path) return { data: { publicUrl: '' } };
        if (/^https?:\/\//i.test(path)) {
            return { data: { publicUrl: path } };
        }
        // Path may be "receipts/xxx" — strip bucket prefix
        let p = String(path);
        if (p.startsWith(bucket + '/')) p = p.slice(bucket.length + 1);
        return supabase.storage.from(bucket).getPublicUrl(p);
    },
    resolveReceiptUrl: (stored) => {
        if (!stored) return '';
        if (/^https?:\/\//i.test(stored)) return stored;
        let p = String(stored);
        if (p.startsWith('receipts/')) p = p.slice('receipts/'.length);
        try {
            const { data } = supabase.storage.from('receipts').getPublicUrl(p);
            return data?.publicUrl || '';
        } catch (e) {
            return '';
        }
    }
};

// ============================================================
// Realtime Subscriptions
// ============================================================

const Realtime = {
    subscribeToIncome: (callback) => {
        return supabase
            .channel('income-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'income' },
                (payload) => callback(payload)
            )
            .subscribe();
    },
    
    subscribeToExpenses: (callback) => {
        return supabase
            .channel('expenses-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'expenses' },
                (payload) => callback(payload)
            )
            .subscribe();
    },
    
    subscribeToNotifications: (userId, callback) => {
        return supabase
            .channel(`notifications-${userId}`)
            .on('postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => callback(payload)
            )
            .subscribe();
    }
};

// ============================================================
// Utility Functions
// ============================================================

function formatCurrency(amount, currency = 'ETB') {
    if (amount === null || amount === undefined) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function generateTransactionId(prefix, year) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${year}-${timestamp}${random}`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-ET', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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