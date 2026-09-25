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
            filterSearch: document.getElementById('filterSearch'),
            filterDatePreset: document.getElementById('filterDatePreset'),
            filterStartDate: document.getElementById('filterStartDate'),
            filterEndDate: document.getElementById('filterEndDate'),
            customRangeFields: document.getElementById('customRangeFields'),
            resetFiltersBtn: document.getElementById('resetFiltersBtn'),
            printTransactionsBtn: document.getElementById('printTransactionsBtn'),
            transactionsList: document.getElementById('transactionsList'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn'),
            pageInfo: document.getElementById('pageInfo'),
            // KPI pill values
            kpiTotalVal: document.getElementById('kpiTotalVal'),
            kpiSalesVal: document.getElementById('kpiSalesVal'),
            kpiOrdersVal: document.getElementById('kpiOrdersVal'),
            kpiInvVal: document.getElementById('kpiInvVal')
        };
        this.syncDateHints();
    }

    /**
     * Bind event listeners
     * @param {Object} callbacks - Object containing event handlers
     */
    bindEvents(callbacks) {
        const { onApplyFilters, onResetFilters, onPrevPage, onNextPage } = callbacks;

        // Action type filter
        if (this.elements.filterAction) {
            this.elements.filterAction.addEventListener('change', () => {
                const filters = this.getFiltersFromDOM();
                if (filters && onApplyFilters) onApplyFilters(filters);
            });
        }

        // Date preset dropdown
        if (this.elements.filterDatePreset) {
            this.elements.filterDatePreset.addEventListener('change', () => {
                const isCustom = this.elements.filterDatePreset.value === 'custom';
                if (this.elements.customRangeFields) {
                    this.elements.customRangeFields.hidden = !isCustom;
                }
                if (!isCustom) {
                    // Clear custom fields when switching away
                    if (this.elements.filterStartDate) this.elements.filterStartDate.value = '';
                    if (this.elements.filterEndDate) this.elements.filterEndDate.value = '';
                    this.syncDateHints();
                    const filters = this.getFiltersFromDOM();
                    if (filters && onApplyFilters) onApplyFilters(filters);
                }
            });
        }

        // Custom date range inputs (only relevant when Custom Range is selected)
        for (const input of [this.elements.filterStartDate, this.elements.filterEndDate]) {
            if (!input) continue;
            input.addEventListener('input', () => this.syncDateHints());
            input.addEventListener('change', () => {
                const filters = this.getFiltersFromDOM();
                if (filters && onApplyFilters) onApplyFilters(filters);
            });
        }

        // Real-time client-side search (no API call)
        if (this.elements.filterSearch) {
            this.elements.filterSearch.addEventListener('input', () => {
                this.applySearch();
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
     * Apply client-side search filter on rendered rows.
     * Matches against: user/cashier name, customer name, details text.
     */
    applySearch() {
        const term = (this.elements.filterSearch?.value || '').trim().toLowerCase();
        const rows = this.elements.transactionsList?.querySelectorAll('tr:not(.empty-row)');
        if (!rows) return;
        rows.forEach(row => {
            if (!term) {
                row.classList.remove('search-hidden');
                return;
            }
            const text = row.textContent.toLowerCase();
            row.classList.toggle('search-hidden', !text.includes(term));
        });
    }

    /**
     * Resolve a date preset value into { start_date, end_date } ISO strings.
     * @param {string} preset - 'today' | 'last7' | 'thismonth' | 'custom' | ''
     */
    resolvePresetDates(preset) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (preset) {
            case 'today':
                return { start_date: todayStart.toISOString(), end_date: todayEnd.toISOString() };
            case 'last7': {
                const from = new Date(todayStart);
                from.setDate(from.getDate() - 6);
                return { start_date: from.toISOString(), end_date: todayEnd.toISOString() };
            }
            case 'thismonth': {
                const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                return { start_date: from.toISOString(), end_date: todayEnd.toISOString() };
            }
            case 'custom': {
                // Use the manual From/To inputs
                const start = this.elements.filterStartDate;
                const end   = this.elements.filterEndDate;
                return {
                    start_date: start?.value ? new Date(start.value + 'T00:00:00').toISOString() : '',
                    end_date:   end?.value   ? new Date(end.value   + 'T23:59:59.999').toISOString() : ''
                };
            }
            default:
                return { start_date: '', end_date: '' };
        }
    }

    /**
     * Get filter values from DOM inputs
     */
    getFiltersFromDOM() {
        this.syncDateHints();
        const preset = this.elements.filterDatePreset?.value || '';

        // Validate custom range
        if (preset === 'custom') {
            const start = this.elements.filterStartDate;
            const end   = this.elements.filterEndDate;
            if (start?.value && end?.value && start.value > end.value) {
                end.setCustomValidity('End date must be on or after start date.');
                end.reportValidity();
                return null;
            }
            if (end) end.setCustomValidity('');
        }

        const { start_date, end_date } = this.resolvePresetDates(preset);
        return {
            action_type: this.elements.filterAction?.value || '',
            start_date,
            end_date
        };
    }

    /**
     * Sync date input hint visibility
     */
    syncDateHints() {
        for (const input of [this.elements.filterStartDate, this.elements.filterEndDate]) {
            if (input) input.dataset.empty = String(!input.value);
        }
    }

    /**
     * Reset DOM inputs
     */
    resetDOM() {
        if (this.elements.filterAction) this.elements.filterAction.value = '';
        if (this.elements.filterSearch) this.elements.filterSearch.value = '';
        if (this.elements.filterDatePreset) this.elements.filterDatePreset.value = '';
        if (this.elements.customRangeFields) this.elements.customRangeFields.hidden = true;
        if (this.elements.filterStartDate) this.elements.filterStartDate.value = '';
        if (this.elements.filterEndDate) {
            this.elements.filterEndDate.value = '';
            this.elements.filterEndDate.setCustomValidity('');
        }
        this.syncDateHints();
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
        this.elements.transactionsList.innerHTML = `<tr class="empty-row"><td colspan="5" style="text-align:center; color: red;">${message || 'Error loading logs'}</td></tr>`;
    }

    /**
     * Show empty state
     */
    showEmpty() {
        this.elements.transactionsList.innerHTML = `<tr class="empty-row"><td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 40px 20px !important;">No transactions found</td></tr>`;
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
                <td class="col-time" data-label="Time">${this.formatDate(t.created_at)}</td>
                <td class="col-action" data-label="Action">${this.getActionBadge(t.action_type)}</td>
                <td class="col-details" data-label="Details">${this.formatDetails(t)}</td>
                <td class="col-user" data-label="User" title="${this.escapeHtml(this.getActorLabel(t))}">
                    <span class="user-chip">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="user-icon">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span class="user-text">${this.escapeHtml(this.getActorLabel(t))}</span>
                    </span>
                </td>
                <td class="col-amount" data-label="Amount">${this.formatAmount(t)}</td>
            `;
            this.elements.transactionsList.appendChild(row);
        });

        // Re-apply search term after new rows are rendered
        this.applySearch();
    }

    /**
     * Update KPI counter pills in the page header.
     * - Total  : grand total log entries from the API (all pages, all types)
     * - Sales  : completed sales only (sale_complete) on current page
     * - Orders : all order events (confirm / cancel / payment update) on current page
     * - Inv    : all inventory events (add / edit / delete) on current page
     * @param {number} total - Grand total from API response
     * @param {Array} transactions - Current page transactions
     */
    updateKPIs(total, transactions) {
        const sales = transactions.filter(t =>
            t.action_type === 'sale_complete'
        ).length;
        const orders = transactions.filter(t =>
            t.action_type === 'order_confirm' ||
            t.action_type === 'order_cancel' ||
            t.action_type === 'order_payment_update'
        ).length;
        const inv = transactions.filter(t =>
            t.action_type === 'inventory_add' ||
            t.action_type === 'inventory_edit' ||
            t.action_type === 'inventory_delete'
        ).length;

        if (this.elements.kpiTotalVal) this.elements.kpiTotalVal.textContent = total.toLocaleString();
        if (this.elements.kpiSalesVal) this.elements.kpiSalesVal.textContent = sales.toLocaleString();
        if (this.elements.kpiOrdersVal) this.elements.kpiOrdersVal.textContent = orders.toLocaleString();
        if (this.elements.kpiInvVal) this.elements.kpiInvVal.textContent = inv.toLocaleString();
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

    /**
     * Returns the display name for the User column.
     * Customer-triggered actions store the customer email in user_email,
     * so we show customer_name instead for those.
     */
    getActorLabel(t) {
        const d = t.details || {};
        const isCustomerAction =
            (t.action_type === 'order_cancel' && d.cancelled_by === 'customer') ||
            (t.action_type === 'order_payment_update' && d.submitted_by === 'customer');

        if (isCustomerAction) {
            return t.customer_name || t.user_email || 'Customer';
        }
        return t.user_email || 'System';
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `<div class="time-date">${dateStr}</div><div class="time-time">${timeStr}</div>`;
    }

    getActionBadge(type) {
        const map = {
            'sale_void': '<span class="badge badge-cancel">Void</span>',
            'sale_complete': '<span class="badge badge-sale">Sale</span>',
            'inventory_add': '<span class="badge badge-add">Add</span>',
            'inventory_edit': '<span class="badge badge-edit">Edit</span>',
            'inventory_delete': '<span class="badge badge-delete">Delete</span>',
            'order_confirm': '<span class="badge badge-confirm">Confirm</span>',
            'order_cancel': '<span class="badge badge-cancel">Cancel</span>',
            'order_payment_update': '<span class="badge badge-edit">Payment</span>'
        };
        return map[type] || `<span class="badge">${type}</span>`;
    }

    formatDetails(t) {
        const d = t.details || {};
        if (t.action_type === 'sale_void') {
            return `Voided order ${this.escapeHtml(d.order_id || t.entity_id || '')}; stock restored. Reason: ${this.escapeHtml(d.reason || '')}`;
        }

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

                    if (field === 'variations' && Array.isArray(change.items)) {
                        const variationChanges = change.items.map(item => {
                            const name = this.escapeHtml(item.name || 'Unnamed');
                            if (item.type === 'added') return `Added ${name} (Qty: ${Number(item.quantity) || 0})`;
                            if (item.type === 'removed') return `Removed ${name} (Qty: ${Number(item.quantity) || 0})`;
                            return `${name} (Qty: ${Number(item.from) || 0} → ${Number(item.to) || 0})`;
                        });
                        if (variationChanges.length > 0) {
                            changeList.push(`Variations: ${variationChanges.join('; ')}`);
                        }
                        continue;
                    }

                    // Format based on field type
                    if (field.includes('price')) {
                        const fromAmount = parseFloat(from || 0);
                        const toAmount = parseFloat(to || 0);
                        from = `₱${fromAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        to = `₱${toAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }

                    if (field === 'variations') {
                        const formatVariations = (value) => {
                            let variants = value;
                            if (typeof variants === 'string') {
                                try { variants = JSON.parse(variants); } catch { return this.escapeHtml(variants); }
                            }
                            if (!Array.isArray(variants) || variants.length === 0) return 'None';
                            return variants.map(variant => {
                                if (typeof variant === 'object' && variant) {
                                    return `${this.escapeHtml(variant.name || 'Unnamed')} (Qty: ${Number(variant.quantity) || 0})`;
                                }
                                return this.escapeHtml(String(variant));
                            }).join(', ');
                        };
                        from = formatVariations(from);
                        to = formatVariations(to);
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

        if (t.action_type === 'order_confirm') {
            const orderId = d.order_id ? d.order_id.substring(0, 8) : 'N/A';
            const itemsCount = d.items_count || 0;
            const orderType = d.order_type || 'pickup';
            return `Confirmed order ${orderId} (${itemsCount} items, ${orderType})`;
        }

        if (t.action_type === 'order_cancel') {
            const orderId = d.order_id ? d.order_id.substring(0, 8) : 'N/A';
            const itemsCount = d.items_count || 0;
            const orderType = d.order_type || 'pickup';
            const action = d.cancelled_by === 'customer' ? 'Customer cancelled order' : 'Cancelled order';
            return `${action} ${orderId} (${itemsCount} items, ${orderType})`;
        }

        if (t.action_type === 'order_payment_update') {
            const orderId = String(d.order_id || t.entity_id || 'N/A').substring(0, 8);
            const formatStatus = value => String(value || 'unknown')
                .replace(/_/g, ' ')
                .replace(/^\w/, character => character.toUpperCase());
            const previousStatus = formatStatus(d.previous_payment_status);
            const newStatus = formatStatus(d.new_payment_status);
            return `Payment ${this.escapeHtml(orderId)}: ${this.escapeHtml(previousStatus)} &rarr; ${this.escapeHtml(newStatus)}`;
        }

        return JSON.stringify(d).substring(0, 50) + '...';
    }

    formatAmount(t) {
        if (t.sale_total) {
            const amount = parseFloat(t.sale_total);
            const formatted = amount.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return `<span class="amount-positive">₱${formatted}</span>`;
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

    // Initialize sidebar
    if (typeof initSidebar === 'function') initSidebar('activity-log');

    // Initialize Modules
    const data = new TransactionsData();
    const ui = new TransactionsUI();

    // Initialize print module
    if (window.TransactionsPrint) {
        TransactionsPrint.init(ui);
    }

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
                const { transactions } = data.getState();
                ui.renderTransactions(transactions);
                ui.updateKPIs(data.state.total, data.state.transactions);

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
