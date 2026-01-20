/**
 * TransactionsUI
 * Handles DOM rendering and UI interactions for the transactions page
 */
class TransactionsUI {
    constructor() {
        this.elements = {
            filterAction: document.getElementById('filterAction'),
            filterDateStart: document.getElementById('filterDateStart'),
            filterDateEnd: document.getElementById('filterDateEnd'),
            applyFiltersBtn: document.getElementById('applyFiltersBtn'),
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

        if (this.elements.applyFiltersBtn) {
            this.elements.applyFiltersBtn.addEventListener('click', () => {
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
        const start = this.elements.filterDateStart.value;
        const end = this.elements.filterDateEnd.value;

        const filters = {};

        if (action) filters.action_type = action;
        if (start) filters.start_date = new Date(start).toISOString();

        // For end date, set to end of day if only date provided
        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            filters.end_date = endDate.toISOString();
        }

        return filters;
    }

    /**
     * Reset DOM inputs
     */
    resetDOM() {
        if (this.elements.filterAction) this.elements.filterAction.value = '';
        if (this.elements.filterDateStart) this.elements.filterDateStart.value = '';
        if (this.elements.filterDateEnd) this.elements.filterDateEnd.value = '';
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

// Export to window
window.TransactionsUI = TransactionsUI;
