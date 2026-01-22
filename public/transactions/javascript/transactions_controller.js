// Transactions Controller and UI Logic
// Combines data management, UI rendering, and event orchestration

/**
 * TransactionsData
 * Handles data fetching and state management for the transactions page
 */
class TransactionsData {
    constructor() {
        this.state = {
            filters: {
                limit: 20,
                offset: 0
            },
            loading: false,
            transactions: [],
            total: 0
        };
    }

    /**
     * Update filters with new values
     * @param {Object} newFilters 
     */
    updateFilters(newFilters) {
        this.state.filters = {
            ...this.state.filters,
            ...newFilters,
            // reset offset when filters change (except pagination)
            offset: newFilters.offset !== undefined ? newFilters.offset : 0
        };
    }

    /**
     * Reset filters to default
     */
    resetFilters() {
        this.state.filters = {
            limit: 20,
            offset: 0
        };
    }

    /**
     * Go to next page
     */
    nextPage() {
        this.state.filters.offset += this.state.filters.limit;
    }

    /**
     * Go to previous page
     */
    prevPage() {
        if (this.state.filters.offset >= this.state.filters.limit) {
            this.state.filters.offset -= this.state.filters.limit;
        }
    }

    /**
     * Fetch transactions from API
     * @returns {Promise<Object>} Result with success/transactions/error
     */
    async fetchTransactions() {
        if (this.state.loading) return;
        this.state.loading = true;

        try {
            // Use the new modular fetcher
            const result = await TransactionsGetAll.get(this.state.filters);

            if (result.success) {
                this.state.transactions = result.transactions;
                this.state.total = result.total;
            }

            return result;
        } finally {
            this.state.loading = false;
        }
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}

/**
 * TransactionsUI
 * Handles DOM rendering and UI interactions for the transactions page
 */
class TransactionsUI {
    constructor() {
        this.elements = {
            filterAction: document.getElementById('filterAction'),
            filterMonth: document.getElementById('filterMonth'),
            filterWeek: document.getElementById('filterWeek'),
            resetFiltersBtn: document.getElementById('resetFiltersBtn'),
            transactionsList: document.getElementById('transactionsList'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn'),
            pageInfo: document.getElementById('pageInfo')
        };
    }

    /**
     * Bind event listeners
     * @param {Object} callbacks - Object containing event handlers
     */
    bindEvents(callbacks) {
        const { onApplyFilters, onResetFilters, onPrevPage, onNextPage } = callbacks;

        // Auto-apply filters when inputs change
        if (this.elements.filterAction) {
            this.elements.filterAction.addEventListener('change', () => {
                const filters = this.getFiltersFromDOM();
                if (onApplyFilters) onApplyFilters(filters);
            });
        }

        if (this.elements.filterMonth) {
            this.elements.filterMonth.addEventListener('change', () => {
                // Clear week filter when month is selected
                if (this.elements.filterWeek && this.elements.filterMonth.value) {
                    this.elements.filterWeek.value = '';
                }
                const filters = this.getFiltersFromDOM();
                if (onApplyFilters) onApplyFilters(filters);
            });
        }

        if (this.elements.filterWeek) {
            this.elements.filterWeek.addEventListener('change', () => {
                // Clear month filter when week is selected
                if (this.elements.filterMonth && this.elements.filterWeek.value) {
                    this.elements.filterMonth.value = '';
                }
                const filters = this.getFiltersFromDOM();
                if (onApplyFilters) onApplyFilters(filters);
            });
        }

        if (this.elements.resetFiltersBtn) {
            this.elements.resetFiltersBtn.addEventListener('click', () => {
                this.resetDOM();
                if (onResetFilters) onResetFilters();
            });
        }

        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => {
                if (onPrevPage) onPrevPage();
            });
        }

        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.addEventListener('click', () => {
                if (onNextPage) onNextPage();
            });
        }
    }

    /**
     * Get filter values from DOM inputs
     */
    getFiltersFromDOM() {
        const action = this.elements.filterAction.value;
        const month = this.elements.filterMonth.value;
        const week = this.elements.filterWeek.value;

        const filters = {};

        if (action) filters.action_type = action;

        // Calculate date range based on month selection
        if (month) {
            const dateRange = this.getMonthDateRange(month);
            if (dateRange.start) filters.start_date = dateRange.start.toISOString();
            if (dateRange.end) filters.end_date = dateRange.end.toISOString();
        }

        // Calculate date range based on week selection
        if (week) {
            const dateRange = this.getWeekDateRange(week);
            if (dateRange.start) filters.start_date = dateRange.start.toISOString();
            if (dateRange.end) filters.end_date = dateRange.end.toISOString();
        }

        return filters;
    }

    /**
     * Get date range for month filter
     */
    getMonthDateRange(monthValue) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        switch (monthValue) {
            case 'this_month':
                return { start, end };
            case 'last_month':
                return {
                    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
                };
            case '2_months_ago':
                return {
                    start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
                    end: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999)
                };
            case '3_months_ago':
                return {
                    start: new Date(now.getFullYear(), now.getMonth() - 3, 1),
                    end: new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59, 999)
                };
            default:
                return { start: null, end: null };
        }
    }

    /**
     * Get date range for week filter
     */
    getWeekDateRange(weekValue) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday as first day
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        switch (weekValue) {
            case 'this_week':
                return { start: monday, end: sunday };
            case 'last_week':
                const lastMonday = new Date(monday);
                lastMonday.setDate(lastMonday.getDate() - 7);
                const lastSunday = new Date(sunday);
                lastSunday.setDate(lastSunday.getDate() - 7);
                return { start: lastMonday, end: lastSunday };
            case '2_weeks_ago':
                const twoWeeksMonday = new Date(monday);
                twoWeeksMonday.setDate(twoWeeksMonday.getDate() - 14);
                const twoWeeksSunday = new Date(sunday);
                twoWeeksSunday.setDate(twoWeeksSunday.getDate() - 14);
                return { start: twoWeeksMonday, end: twoWeeksSunday };
            case '3_weeks_ago':
                const threeWeeksMonday = new Date(monday);
                threeWeeksMonday.setDate(threeWeeksMonday.getDate() - 21);
                const threeWeeksSunday = new Date(sunday);
                threeWeeksSunday.setDate(threeWeeksSunday.getDate() - 21);
                return { start: threeWeeksMonday, end: threeWeeksSunday };
            default:
                return { start: null, end: null };
        }
    }

    /**
     * Reset DOM inputs
     */
    resetDOM() {
        if (this.elements.filterAction) this.elements.filterAction.value = '';
        if (this.elements.filterMonth) this.elements.filterMonth.value = '';
        if (this.elements.filterWeek) this.elements.filterWeek.value = '';
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        if (isLoading) {
            this.elements.transactionsList.style.opacity = '0.5';
        } else {
            this.elements.transactionsList.style.opacity = '1';
        }
    }

    /**
     * Show internal error message
     */
    showError(message) {
        this.elements.transactionsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">${message || 'Error loading logs'}</td></tr>`;
    }

    /**
     * Show empty state
     */
    showEmpty() {
        this.elements.transactionsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No transactions found</td></tr>`;
    }

    /**
     * Render transactions list
     * @param {Array} transactions 
     */
    renderTransactions(transactions) {
        this.elements.transactionsList.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            this.showEmpty();
            return;
        }

        transactions.forEach((t, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 50}ms`;
            row.innerHTML = `
                <td>${this.formatDate(t.created_at)}</td>
                <td>${this.getActionBadge(t.action_type)}</td>
                <td>${this.formatDetails(t)}</td>
                <td>${this.escapeHtml(t.user_email || 'System')}</td>
                <td>${this.formatAmount(t)}</td>
            `;
            this.elements.transactionsList.appendChild(row);
        });
    }

    /**
     * Update pagination controls
     */
    updatePagination(total, limit, offset) {
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit);

        this.elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        this.elements.prevPageBtn.disabled = currentPage <= 1;
        this.elements.nextPageBtn.disabled = currentPage >= totalPages;
    }

    // --- Helpers ---

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    getActionBadge(type) {
        const map = {
            'sale_complete': '<span class="badge badge-sale">Sale</span>',
            'inventory_add': '<span class="badge badge-add">Add Item</span>',
            'inventory_edit': '<span class="badge badge-edit">Edit Item</span>',
            'inventory_delete': '<span class="badge badge-delete">Delete Item</span>'
        };
        return map[type] || `<span class="badge">${type}</span>`;
    }

    formatDetails(t) {
        const d = t.details || {};

        if (t.action_type === 'sale_complete') {
            const items = t.sale_items || [];
            const itemCount = items.reduce((sum, i) => sum + (i.qty || 0), 0);
            return `Sold ${itemCount} items to ${this.escapeHtml(t.customer_name || 'Walk-in')}`;
        }

        if (t.action_type === 'inventory_add') {
            return `Added "${this.escapeHtml(d.name)}" (${d.quantity} qty)`;
        }

        if (t.action_type === 'inventory_edit') {
            const itemName = this.escapeHtml(d.new?.name || d.old?.name || 'Item');

            if (d.changes && Object.keys(d.changes).length > 0) {
                const changeList = [];
                for (const [field, change] of Object.entries(d.changes)) {
                    // Skip internal fields if any
                    if (['updated_at', 'images', 'qr_image_url'].includes(field)) continue;

                    let from = change.from;
                    let to = change.to;

                    // Format based on field type
                    if (field.includes('price')) {
                        from = `₱${parseFloat(from || 0).toFixed(2)}`;
                        to = `₱${parseFloat(to || 0).toFixed(2)}`;
                    }

                    changeList.push(`${this.formatFieldName(field)}: ${from} → ${to}`);
                }

                if (changeList.length > 0) {
                    return `Edited "${itemName}" (${changeList.join(', ')})`;
                }
            }

            return `Edited "${itemName}"`;
        }

        if (t.action_type === 'inventory_delete') {
            return `Deleted "${this.escapeHtml(d.name)}"`;
        }

        return JSON.stringify(d).substring(0, 50) + '...';
    }

    formatAmount(t) {
        if (t.sale_total) {
            return `<span class="amount-positive">₱${parseFloat(t.sale_total).toFixed(2)}</span>`;
        }
        return '-';
    }

    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    formatFieldName(field) {
        return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
}

/**
 * Controller Initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Initialize sidebar and header
    if (typeof initSidebar === 'function') initSidebar('transactions');
    if (window.HeaderStatus && HeaderStatus.init) HeaderStatus.init();

    // Initialize Modules
    const data = new TransactionsData();
    const ui = new TransactionsUI();

    // Bind UI Events
    ui.bindEvents({
        onApplyFilters: (filters) => {
            data.updateFilters(filters);
            loadData();
        },
        onResetFilters: () => {
            data.resetFilters();
            loadData();
        },
        onPrevPage: () => {
            data.prevPage();
            loadData();
        },
        onNextPage: () => {
            data.nextPage();
            loadData();
        }
    });

    // Initial Load
    await loadData();

    // Core Logic
    async function loadData() {
        ui.setLoading(true);
        try {
            const result = await data.fetchTransactions();

            if (result && result.success) {
                const { transactions, total, limit, offset } = data.getState();
                ui.renderTransactions(transactions);

                // Use state values or result values
                ui.updatePagination(data.state.total, data.state.filters.limit, data.state.filters.offset);
            } else {
                ui.showError(result?.error);
            }
        } catch (error) {
            console.error('Controller Error:', error);
            ui.showError(error.message);
        } finally {
            ui.setLoading(false);
        }
    }
});
