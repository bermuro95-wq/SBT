// i18n.js
const translations = {
    en: {
        // Navigation
        dashboard: 'Dashboard',
        income: 'Income',
        expenses: 'Expenses',
        transactions: 'Transactions',
        budget: 'Budget',
        audit_evidence: 'Audit Evidence',
        receipts: 'Audit Evidence',
        reports: 'Reports',
        analytics: 'Analytics',
        approvals: 'Approvals',
        users: 'Users',
        audit_logs: 'Audit Logs',
        settings: 'Settings',
        profile: 'Profile',
        logout: 'Logout',
        login: 'Login',
        register: 'Register',
        sign_in: 'Sign In',
        email: 'Email',
        password: 'Password',
        remember_me: 'Remember me',
        forgot_password: 'Forgot password?',
        organization_finance: 'Organization Financial Management System',
        reset_password_instruction: 'Enter your email to receive a password reset link.',
        send_reset_link: 'Send Reset Link',
        back_to_login: 'Back to Login',
        welcome_back: 'Welcome back',
        
        // Dashboard
        total_income: 'Total Income',
        total_expenses: 'Total Expenses',
        current_balance: 'Current Balance',
        annual_budget: 'Annual Budget',
        budget_used: 'Budget Used',
        remaining_budget: 'Remaining Budget',
        total_transactions: 'Total Transactions',
        pending_approvals: 'Pending Approvals',
        
        // Common
        etb: 'ETB',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',
        import: 'Import',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        view: 'View',
        submit: 'Submit',
        approve: 'Approve',
        reject: 'Reject',
        created_at: 'Created At',
        updated_at: 'Updated At',
        status: 'Status',
        actions: 'Actions',
        loading: 'Loading...',
        no_records: 'No records found.',
        error: 'An error occurred.',
        success: 'Operation successful.',
        
        // Income
        income_source: 'Income Source',
        income_category: 'Income Category',
        amount: 'Amount',
        date: 'Date',
        reference: 'Reference Number',
        payment_method: 'Payment Method',
        received_by: 'Received By',
        description: 'Description',
        notes: 'Notes',
        receipt: 'Receipt',
        
        // Expenses
        expense_category: 'Expense Category',
        vendor: 'Vendor/Payee',
        requested_by: 'Requested By',
        approved_by: 'Approved By',
        
        // ... etc
    },
    
    am: {
        // Amharic translations
        dashboard: 'ዳሽቦርድ',
        income: 'ገቢ',
        expenses: 'ወጪዎች',
        transactions: 'ግብይቶች',
        budget: 'በጀት',
        receipts: 'ደረሰኞች',
        reports: 'ሪፖርቶች',
        analytics: 'ትንተና',
        approvals: 'ማጽደቅ',
        users: 'ተጠቃሚዎች',
        audit_logs: 'የኦዲት መዝገቦች',
        settings: 'ቅንብሮች',
        profile: 'መገለጫ',
        logout: 'ውጣ',
        login: 'ግባ',
        // ... etc
    },
    
    ti: {
        // Tigrinya translations
        dashboard: 'ዳሽቦርድ',
        income: 'ገቢ',
        expenses: 'ወጻእቲ',
        // ... etc
    },
    
    om: {
        // Afaan Oromo translations
        dashboard: 'Dachii',
        income: 'Galii',
        expenses: 'Baasii',
        // ... etc
    }
}

class I18n {
    constructor() {
        this.currentLanguage = this.getUserLanguage() || 'en'
        this.translations = translations
    }
    
    t(key) {
        const lang = this.translations[this.currentLanguage] || {}
        const en = this.translations['en'] || {}
        if (lang[key]) return lang[key]
        if (en[key]) return en[key]
        // Never show raw keys with underscores — humanize as fallback
        return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
    
    getUserLanguage() {
        return localStorage.getItem('language') || 'en'
    }
    
    setLanguage(lang) {
        this.currentLanguage = lang
        localStorage.setItem('language', lang)
        this.updateUI()
    }
    
    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n
            el.textContent = this.t(key)
        })
        
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder
            el.placeholder = this.t(key)
        })
        
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle
            el.title = this.t(key)
        })
    }
}
// Create global instance and attach language switcher
const i18n = new I18n();
window.i18n = i18n;

document.addEventListener('DOMContentLoaded', function() {
    // Apply current language
    i18n.updateUI();

    // Language switch buttons
    document.querySelectorAll('.lang-btn, [data-lang]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            if (lang) {
                i18n.setLanguage(lang);
                // Optional: highlight active button
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
});
