// ============================================================
// SELAM BERTU TESFA - Form Validation
// ============================================================

const Validators = {
    // Required field
    required: (value, message = 'This field is required') => {
        if (!value || value.trim() === '') {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Email validation
    email: (value, message = 'Please enter a valid email address') => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Amount validation
    amount: (value, message = 'Please enter a valid amount') => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Number validation
    number: (value, message = 'Please enter a valid number') => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Min length
    minLength: (value, min, message = null) => {
        if (!value || value.length < min) {
            return { 
                valid: false, 
                message: message || `Must be at least ${min} characters`
            };
        }
        return { valid: true };
    },
    
    // Max length
    maxLength: (value, max, message = null) => {
        if (value && value.length > max) {
            return { 
                valid: false, 
                message: message || `Must not exceed ${max} characters`
            };
        }
        return { valid: true };
    },
    
    // Date validation
    date: (value, message = 'Please enter a valid date') => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Date range
    dateRange: (startDate, endDate, message = 'End date must be after start date') => {
        if (new Date(startDate) > new Date(endDate)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // File validation
    file: (file, options = {}, message = null) => {
        const { maxSize = 5 * 1024 * 1024, allowedTypes = [] } = options;
        
        if (!file) {
            return { valid: false, message: 'Please select a file' };
        }
        
        // Check size
        if (file.size > maxSize) {
            const sizeInMB = (maxSize / (1024 * 1024)).toFixed(0);
            return { 
                valid: false, 
                message: message || `File size must be less than ${sizeInMB}MB`
            };
        }
        
        // Check type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            return { 
                valid: false, 
                message: message || `File type not supported. Allowed: ${allowedTypes.join(', ')}`
            };
        }
        
        return { valid: true };
    },
    
    // Password strength
    password: (value, message = 'Password must be at least 8 characters with uppercase, lowercase, and number') => {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Confirm password
    confirmPassword: (password, confirm, message = 'Passwords do not match') => {
        if (password !== confirm) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    // Reference number format
    referenceNumber: (value, message = 'Please enter a valid reference number') => {
        // Allow alphanumeric, dash, underscore
        const refRegex = /^[A-Za-z0-9\-_]+$/;
        if (!refRegex.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    }
};

// ============================================================
// Form Validation Class
// ============================================================

class FormValidator {
    constructor(form, rules) {
        this.form = form;
        this.rules = rules;
        this.errors = {};
        this.submitted = false;
        
        this.setupValidation();
    }
    
    setupValidation() {
        // Real-time validation on blur
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
            
            field.addEventListener('input', () => {
                if (this.submitted || this.errors[field.name]) {
                    this.validateField(field);
                }
            });
        });
    }
    
    validateField(field) {
        const name = field.name;
        const rules = this.rules[name];
        if (!rules) return true;
        
        let isValid = true;
        const errors = [];
        
        for (const rule of rules) {
            const result = this.applyRule(rule, field);
            if (!result.valid) {
                isValid = false;
                errors.push(result.message);
            }
        }
        
        if (isValid) {
            delete this.errors[name];
            this.clearFieldError(field);
        } else {
            this.errors[name] = errors;
            this.showFieldError(field, errors[0]);
        }
        
        return isValid;
    }
    
    applyRule(rule, field) {
        const { validator, params, message } = rule;
        const value = field.type === 'checkbox' ? field.checked : field.value;
        
        if (typeof validator === 'function') {
            const result = validator(value, ...(params || []));
            return result;
        }
        
        if (typeof validator === 'string') {
            switch(validator) {
                case 'required':
                    return Validators.required(value, message);
                case 'email':
                    return Validators.email(value, message);
                case 'amount':
                    return Validators.amount(value, message);
                case 'number':
                    return Validators.number(value, message);
                case 'date':
                    return Validators.date(value, message);
                case 'password':
                    return Validators.password(value, message);
                default:
                    return { valid: true };
            }
        }
        
        return { valid: true };
    }
    
    showFieldError(field, message) {
        let errorEl = field.parentElement.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error text-danger small mt-1';
            field.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
        field.classList.add('is-invalid');
    }
    
    clearFieldError(field) {
        const errorEl = field.parentElement.querySelector('.form-error');
        if (errorEl) {
            errorEl.remove();
        }
        field.classList.remove('is-invalid');
    }
    
    validate() {
        this.submitted = true;
        let isValid = true;
        
        for (const name of Object.keys(this.rules)) {
            const field = this.form.querySelector(`[name="${name}"]`);
            if (field) {
                const fieldValid = this.validateField(field);
                if (!fieldValid) {
                    isValid = false;
                }
            }
        }
        
        return isValid;
    }
    
    getErrors() {
        return this.errors;
    }
    
    hasErrors() {
        return Object.keys(this.errors).length > 0;
    }
}

// ============================================================
// Export
// ============================================================

window.Validators = Validators;
window.FormValidator = FormValidator;