// Transactions Page Logic

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Initialize sidebar
    if (typeof initSidebar === 'function') {
        initSidebar('transactions'); // Ensure sidebar has a 'transactions' active state or fallback
    }

    // Initialize Header Status
    if (window.HeaderStatus && HeaderStatus.init) {
        HeaderStatus.init();
    }

    // State
    const state = {
        filters: {
            limit: 20,
            offset: 0
        },
        loading: false
    };

    // DOM Elements
    const elements = {
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

    // Load Initial Data
    await loadTransactions();

    // Event Listeners
    elements.applyFiltersBtn.addEventListener('click', () => {
        state.filters.offset = 0;
        updateFiltersFromDOM();
        loadTransactions();
    });

    elements.resetFiltersBtn.addEventListener('click', () => {
        // Reset DOM
        elements.filterAction.value = '';
        elements.filterDateStart.value = '';
        elements.filterDateEnd.value = '';

        // Reset State
        state.filters = { limit: 20, offset: 0 };
        loadTransactions();
    });

    elements.prevPageBtn.addEventListener('click', () => {
        if (state.filters.offset >= state.filters.limit) {
            state.filters.offset -= state.filters.limit;
            loadTransactions();
        }
    });

    elements.nextPageBtn.addEventListener('click', () => {
        state.filters.offset += state.filters.limit;
        loadTransactions();
    });

    // Functions
    function updateFiltersFromDOM() {
        const action = elements.filterAction.value;
        const start = elements.filterDateStart.value;
        const end = elements.filterDateEnd.value;

        if (action) state.filters.action_type = action;
        else delete state.filters.action_type;

        if (start) state.filters.start_date = new Date(start).toISOString();
        else delete state.filters.start_date;

        // For end date, set to end of day if only date provided
        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            state.filters.end_date = endDate.toISOString();
        } else delete state.filters.end_date;
    }

    async function loadTransactions() {
        if (state.loading) return;
        setLoading(true);

        try {
            const result = await TransactionLogger.getTransactions(state.filters);

            if (result.success) {
                renderTransactions(result.transactions);
                updatePagination(result.total);
            } else {
                console.error('Failed to load transactions:', result.error);
                elements.transactionsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error loading logs</td></tr>`;
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            elements.transactionsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error loading logs</td></tr>`;
        } finally {
            setLoading(false);
        }
    }

    function renderTransactions(transactions) {
        elements.transactionsList.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            elements.transactionsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">No transactions found</td></tr>`;
            return;
        }

        transactions.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(t.created_at)}</td>
                <td>${getActionBadge(t.action_type)}</td>
                <td>${formatDetails(t)}</td>
                <td>${escapeHtml(t.user_email || 'System')}</td>
                <td>${formatAmount(t)}</td>
            `;
            elements.transactionsList.appendChild(row);
        });
    }

    function updatePagination(total) {
        const currentPage = Math.floor(state.filters.offset / state.filters.limit) + 1;
        const totalPages = Math.ceil(total / state.filters.limit);

        elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        elements.prevPageBtn.disabled = currentPage <= 1;
        elements.nextPageBtn.disabled = currentPage >= totalPages;
    }

    function setLoading(isLoading) {
        state.loading = isLoading;
        if (isLoading) {
            elements.transactionsList.style.opacity = '0.5';
        } else {
            elements.transactionsList.style.opacity = '1';
        }
    }

    // Helpers
    function formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function getActionBadge(type) {
        const map = {
            'sale_complete': '<span class="badge badge-sale">Sale</span>',
            'inventory_add': '<span class="badge badge-add">Add Item</span>',
            'inventory_edit': '<span class="badge badge-edit">Edit Item</span>',
            'inventory_delete': '<span class="badge badge-delete">Delete Item</span>'
        };
        return map[type] || `<span class="badge">${type}</span>`;
    }

    function formatDetails(t) {
        const d = t.details || {};

        if (t.action_type === 'sale_complete') {
            const items = t.sale_items || [];
            const itemCount = items.reduce((sum, i) => sum + (i.qty || 0), 0);
            return `Sold ${itemCount} items to ${escapeHtml(t.customer_name || 'Walk-in')}`;
        }

        if (t.action_type === 'inventory_add') {
            return `Added "${escapeHtml(d.name)}" (${d.quantity} qty)`;
        }

        if (t.action_type === 'inventory_edit') {
            const itemName = escapeHtml(d.new?.name || d.old?.name || 'Item');

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

                    changeList.push(`${formatFieldName(field)}: ${from} → ${to}`);
                }

                if (changeList.length > 0) {
                    return `Edited "${itemName}" (${changeList.join(', ')})`;
                }
            }

            return `Edited "${itemName}"`;
        }

        if (t.action_type === 'inventory_delete') {
            return `Deleted "${escapeHtml(d.name)}"`;
        }

        return JSON.stringify(d).substring(0, 50) + '...';
    }

    function formatAmount(t) {
        if (t.sale_total) {
            return `<span class="amount-positive">₱${parseFloat(t.sale_total).toFixed(2)}</span>`;
        }
        return '-';
    }

    function escapeHtml(text) {
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

    function formatFieldName(field) {
        return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
});
