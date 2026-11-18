// ============================================================
// SELAM BERTU TESFA - Chart Utilities
// ============================================================

const ChartUtils = {
    colors: {
        primary: '#1a4d7a',
        success: '#28a745',
        danger: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8',
        purple: '#6f42c1',
        pink: '#e83e8c',
        teal: '#20c997',
        orange: '#fd7e14',
        indigo: '#6610f2'
    },
    
    colorPalette: [
        '#1a4d7a', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
        '#6f42c1', '#e83e8c', '#20c997', '#fd7e14', '#6610f2',
        '#007bff', '#6c757d'
    ],
    
    // Common chart options
    getDefaultOptions(type = 'bar') {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        boxWidth: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== undefined) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        };
    },
    
    // Get common scales
    getMoneyScale() {
        return {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatCurrency(value);
                    }
                }
            }
        };
    },
    
    // Create a bar chart
    createBarChart(ctx, labels, datasets, options = {}) {
        const defaultOptions = this.getDefaultOptions('bar');
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            scales: {
                ...this.getMoneyScale(),
                ...(options.scales || {})
            }
        };
        
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: mergedOptions
        });
    },
    
    // Create a line chart
    createLineChart(ctx, labels, datasets, options = {}) {
        const defaultOptions = this.getDefaultOptions('line');
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            scales: {
                ...this.getMoneyScale(),
                ...(options.scales || {})
            }
        };
        
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: mergedOptions
        });
    },
    
    // Create a pie/doughnut chart
    createPieChart(ctx, labels, data, type = 'doughnut', options = {}) {
        const colors = this.colorPalette.slice(0, labels.length);
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        boxWidth: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.parsed)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: type === 'doughnut' ? '60%' : 0
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        return new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: mergedOptions
        });
    },
    
    // Group data by month
    groupByMonth(data, dateField = 'date', amountField = 'amount') {
        const monthly = new Array(12).fill(0);
        
        data.forEach(item => {
            const date = new Date(item[dateField]);
            const month = date.getMonth();
            monthly[month] += item[amountField] || 0;
        });
        
        return monthly;
    },
    
    // Group data by category
    groupByCategory(data, categoryField = 'category', amountField = 'amount') {
        const grouped = {};
        
        data.forEach(item => {
            const category = item[categoryField]?.name || 'Uncategorized';
            if (!grouped[category]) {
                grouped[category] = 0;
            }
            grouped[category] += item[amountField] || 0;
        });
        
        return grouped;
    },
    
    // Get month labels
    getMonthLabels() {
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    },
    
    // Get month names (full)
    getMonthNames() {
        return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    },
    
    // Destroy chart safely
    destroyChart(chart) {
        if (chart) {
            chart.destroy();
        }
        return null;
    }
};

// ============================================================
// Export for use
// ============================================================

window.ChartUtils = ChartUtils;