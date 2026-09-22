/**
 * Orders Controller
 * Manages the orders page UI and interactions
 */
class OrdersController {
    constructor() {
        this.state = {
            filters: {
                status: '',
                search: '',
                start_date: '',
                end_date: '',
                limit: 20,
                offset: 0
            },
            loading: false,
            orders: [],
            total: 0
        };

        this.elements = {
            orderSearchInput: document.getElementById('orderSearchInput'),
            filterStatus: document.getElementById('filterStatus'),
            filterStartDate: document.getElementById('filterStartDate'),
            filterEndDate: document.getElementById('filterEndDate'),
            resetFiltersBtn: document.getElementById('resetFiltersBtn'),
            ordersList: document.getElementById('ordersList'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn'),
            pageInfo: document.getElementById('pageInfo'),

            // KPI Summary Cards
            kpiCardPending: document.getElementById('kpiCardPending'),
            kpiCardReady: document.getElementById('kpiCardReady'),
            kpiCardPickup: document.getElementById('kpiCardPickup'),
            kpiCardDelivery: document.getElementById('kpiCardDelivery'),
            kpiPendingCount: document.getElementById('kpiPendingCount'),
            kpiReadyCount: document.getElementById('kpiReadyCount'),
            kpiPickupCount: document.getElementById('kpiPickupCount'),
            kpiDeliveryCount: document.getElementById('kpiDeliveryCount')
        };

        // QR Scanner state
        this.qrScanner = null;
        this.qrScanning = false;
        this.scanningOrderId = null;

        // Modal state
        this.pendingOrderId = null;

        this.init();
    }

    get activeKpi() {
        return window.OrdersFilter?.activeKpi || null;
    }

    set activeKpi(val) {
        if (window.OrdersFilter) {
            window.OrdersFilter.activeKpi = val;
        }
    }

    async refreshKPIs() {
        if (window.OrdersSummaries?.updateKPIs) {
            await window.OrdersSummaries.updateKPIs(this.elements);
        }
    }

    async init() {
        // Check authentication
        const user = localStorage.getItem('user');
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Initialize sidebar
        if (typeof initSidebar === 'function') initSidebar('orders');

        this.setupEventListeners();

        // Load order details modal
        await this.loadOrderDetailsModal();

        this.setupModalEventListeners();
        await this.loadOrders();
    }

    async loadOrderDetailsModal() {
        if (window.OrdersViewModal?.loadModal) {
            await window.OrdersViewModal.loadModal();
            return;
        }

        const container = document.getElementById('order-details-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/orders/order-details-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
            }
        } catch (error) {
            console.error('Error loading order details modal:', error);
        }
    }

    setupModalEventListeners() {
        if (window.OrdersViewModal?.init) {
            window.OrdersViewModal.init(this);
        }
        if (window.OrdersModals?.init) {
            window.OrdersModals.init(this);
        }
        if (window.OrdersQR?.init) {
            window.OrdersQR.init(this);
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-order-action]');
            if (!actionButton) return;

            const orderId = actionButton.dataset.orderId;
            const action = actionButton.dataset.orderAction;
            if (!orderId || typeof this[action] !== 'function') return;

            event.preventDefault();
            if (action === 'verifyPayment') {
                this.verifyPayment(orderId, actionButton.dataset.paymentStatus);
                return;
            }
            this[action](orderId);
        });

        if (window.OrdersFilter?.init) {
            window.OrdersFilter.init(this);
        }

        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => {
                if (this.state.filters.offset >= this.state.filters.limit) {
                    this.state.filters.offset -= this.state.filters.limit;
                    this.loadOrders();
                }
            });
        }

        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.addEventListener('click', () => {
                if (this.state.filters.offset + this.state.filters.limit < this.state.total) {
                    this.state.filters.offset += this.state.filters.limit;
                    this.loadOrders();
                }
            });
        }
    }

    filterByStatus(status) {
        if (window.OrdersFilter?.filterByStatus) {
            window.OrdersFilter.filterByStatus(status);
        }
    }

    filterByOrderType(type) {
        if (window.OrdersFilter?.filterByOrderType) {
            window.OrdersFilter.filterByOrderType(type);
        }
    }

    updateActiveKpiCards() {
        if (window.OrdersFilter?.updateActiveKpiCards) {
            window.OrdersFilter.updateActiveKpiCards();
        }
    }

    resetFilters() {
        if (window.OrdersFilter?.resetFilters) {
            window.OrdersFilter.resetFilters();
        }
    }

    async loadOrders() {
        this.setLoading(true);

        try {
            const fetchFilters = { ...this.state.filters };
            // If filtering by order type (pickup/delivery), fetch more records to filter accurately client-side
            if (this.activeKpi === 'pickup' || this.activeKpi === 'delivery') {
                fetchFilters.limit = 200;
                fetchFilters.offset = 0;
            }

            const result = await OrdersGetAll.get(fetchFilters);

            if (result.success) {
                let orders = result.orders || [];

                if (this.activeKpi === 'pickup' || this.activeKpi === 'delivery') {
                    orders = orders.filter(order => {
                        const type = String(order.order_type || 'pickup').toLowerCase().trim();
                        return type === this.activeKpi;
                    });
                    this.state.total = orders.length;
                    // Slice for local pagination if needed
                    const pageOffset = this.state.filters.offset || 0;
                    const pageLimit = this.state.filters.limit || 20;
                    this.state.orders = orders.slice(pageOffset, pageOffset + pageLimit);
                } else {
                    this.state.orders = orders;
                    this.state.total = result.total || 0;
                }

                this.renderOrders();
                this.updatePagination();
                this.updateActiveKpiCards();
                // Refresh KPI counts in background
                this.refreshKPIs();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    renderOrders() {
        const listEl = this.elements.ordersList;
        if (!listEl) return;

        if (this.state.orders.length === 0) {
            let emptyMsg = 'No orders found';
            if (this.state.filters.search) {
                emptyMsg = `No orders found matching "${this.escapeHtml(this.state.filters.search)}"`;
            } else if (this.activeKpi === 'pickup') {
                emptyMsg = 'No pickup orders found';
            } else if (this.activeKpi === 'delivery') {
                emptyMsg = 'No delivery orders found';
            }
            listEl.innerHTML = `<tr class="empty-row"><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">${emptyMsg}</td></tr>`;
            return;
        }

        listEl.innerHTML = this.state.orders.map(order => {
            const dateParts = this.formatDateParts(order.created_at);
            const statusBadge = this.getStatusBadge(order.status);
            const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
            const itemsSummary = this.getItemsSummary(order.items);
            
            // Display order type based on customer's selection
            // Normalize order_type to lowercase for comparison
            const orderType = order.order_type ? String(order.order_type).toLowerCase().trim() : 'pickup';
            
            let orderTypeBadge;
            if (orderType === 'pickup') {
                orderTypeBadge = '<span class="badge badge-info">Pickup</span>';
            } else if (orderType === 'delivery') {
                orderTypeBadge = '<span class="badge badge-warning">Delivery (3rd Party)</span>';
            } else {
                // Should not reach here, but fallback
                orderTypeBadge = '<span class="badge badge-info">Pickup</span>';
            }

            const paymentBadge = orderType === 'delivery' 
                ? `<div class="payment-badge-wrap" style="margin-top: 4px;">${this.getPaymentBadge(order.payment_status)}</div>`
                : '';

            const contactHtml = order.contact_number 
                ? `<a href="tel:${this.escapeHtml(order.contact_number)}" class="contact-number"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" class="contact-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg><span>${this.escapeHtml(order.contact_number)}</span></a>`
                : `<span class="contact-number text-muted">-</span>`;

            return `
                <tr class="order-row" data-order-id="${order.id}">
                    <td class="col-order-id" data-label="Order ID"><code class="order-id" title="${order.id}">#${order.id.substring(0, 8)}</code></td>
                    <td class="col-customer" data-label="Customer"><span class="customer-name">${this.escapeHtml(order.customer_name || 'Guest')}</span></td>
                    <td class="col-contact" data-label="Contact">${contactHtml}</td>
                    <td class="col-items" data-label="Items">
                        <div class="items-cell">
                            <span class="items-count">${itemsCount} item(s)</span>
                            <small class="items-summary">${itemsSummary}</small>
                        </div>
                    </td>
                    <td class="col-total" data-label="Total"><strong class="total-amount">₱${parseFloat(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                    <td class="col-type" data-label="Type">${orderTypeBadge}${paymentBadge}</td>
                    <td class="col-status" data-label="Status">${statusBadge}</td>
                    <td class="col-date" data-label="Date">
                        <div class="order-date-cell">
                            <span class="order-date-main">${dateParts.date}</span>
                            ${dateParts.time ? `<span class="order-time-sub">${dateParts.time}</span>` : ''}
                        </div>
                        ${paymentBadge ? `<span class="payment-badge-mobile">${this.getPaymentBadge(order.payment_status)}</span>` : ''}
                    </td>
                    <td class="col-actions" data-label="Actions">
                        <div class="order-actions">
                            ${order.status === 'completed' ? `<button type="button" class="btn btn-small btn-danger" data-order-action="voidOrder" data-order-id="${order.id}">Void</button>` : ''}
                            <button type="button" class="btn btn-small btn-secondary" data-order-action="viewOrder" data-order-id="${order.id}">View</button>
                            ${order.status === 'pending' 
                                ? `
                                    <button type="button" class="btn btn-small btn-primary" data-order-action="confirmOrder" data-order-id="${order.id}">Confirm</button>
                                    <button type="button" class="btn btn-small btn-danger" data-order-action="cancelOrder" data-order-id="${order.id}">Cancel</button>
                                `
                                : ''}
                            ${order.status === 'confirmed'
                                ? `
                                    ${orderType === 'pickup' 
                                        ? `<button type="button" class="btn btn-small btn-info" data-order-action="scanCustomerQR" data-order-id="${order.id}">Scan QR</button>`
                                        : ''}
                                    <button type="button" class="btn btn-small btn-success" data-order-action="completeOrder" data-order-id="${order.id}">Complete</button>
                                    <button type="button" class="btn btn-small btn-danger" data-order-action="cancelOrder" data-order-id="${order.id}">Cancel</button>
                                `
                                : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getPaymentBadge(status) {
        const normalized = String(status || 'unpaid').toLowerCase();
        if (normalized === 'paid') {
            return '<span class="badge badge-success" style="font-size: 10px; padding: 2px 6px; letter-spacing: 0.3px; border: none;">💳 Paid</span>';
        } else if (normalized === 'pending_verification') {
            return '<span class="badge badge-warning" style="font-size: 10px; padding: 2px 6px; letter-spacing: 0.3px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: none;">⏳ Verify Payment</span>';
        } else if (normalized === 'rejected') {
            return '<span class="badge badge-danger" style="font-size: 10px; padding: 2px 6px; letter-spacing: 0.3px; border: none;">✕ Proof Rejected</span>';
        } else {
            return '<span class="badge badge-secondary" style="font-size: 10px; padding: 2px 6px; letter-spacing: 0.3px; opacity: 0.85; border: none;">Unpaid</span>';
        }
    }

    getItemsSummary(items) {
        if (!Array.isArray(items) || items.length === 0) return 'No items';
        const firstItem = items[0];
        const remaining = items.length - 1;
        let summary = `${firstItem.quantity}x ${this.escapeHtml(firstItem.name || 'Item')}`;
        if (remaining > 0) {
            summary += ` +${remaining} more`;
        }
        return summary;
    }

    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-warning">Pending</span>',
            'confirmed': '<span class="badge badge-info">Confirmed</span>',
            'completed': '<span class="badge badge-success">Completed</span>',
            'voided': '<span class="badge badge-danger">Voided</span>',
            'cancelled': '<span class="badge badge-danger">Cancelled</span>'
        };
        return badges[status] || `<span class="badge">${status}</span>`;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    formatDateParts(dateString) {
        if (!dateString) return { date: '-', time: '' };
        const d = new Date(dateString);
        return {
            date: d.toLocaleDateString('en-PH', { dateStyle: 'medium' }),
            time: d.toLocaleTimeString('en-PH', { timeStyle: 'short' })
        };
    }

    confirmOrder(orderId) {
        if (window.OrdersModals?.confirmOrder) {
            window.OrdersModals.confirmOrder(orderId);
        }
    }

    scanCustomerQR(orderId) {
        if (window.OrdersQR?.scanCustomerQR) {
            window.OrdersQR.scanCustomerQR(orderId);
        }
    }

    completeOrder(orderId) {
        if (window.OrdersModals?.completeOrder) {
            window.OrdersModals.completeOrder(orderId);
        }
    }

    voidOrder(orderId) {
        if (window.OrdersModals?.voidOrder) {
            window.OrdersModals.voidOrder(orderId);
        }
    }

    cancelOrder(orderId) {
        if (window.OrdersModals?.cancelOrder) {
            window.OrdersModals.cancelOrder(orderId);
        }
    }

    viewOrder(orderId) {
        if (window.OrdersViewModal?.viewOrder) {
            window.OrdersViewModal.viewOrder(orderId);
        }
    }

    updatePagination() {
        const currentPage = Math.floor(this.state.filters.offset / this.state.filters.limit) + 1;
        const totalPages = Math.ceil(this.state.total / this.state.filters.limit);

        if (this.elements.pageInfo) {
            this.elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        }

        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.disabled = currentPage <= 1;
        }

        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.disabled = currentPage >= totalPages;
        }
    }

    verifyPayment(orderId, paymentStatus) {
        if (window.OrdersModals?.verifyPayment) {
            window.OrdersModals.verifyPayment(orderId, paymentStatus);
        }
    }

    setLoading(loading) {
        this.state.loading = loading;
        // You can add loading indicator here if needed
    }

    showError(error) {
        console.error('Orders error:', error);
        // You can add error display here if needed
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
}

// Static methods for onclick handlers
OrdersController.viewOrder = function(orderId) {
    if (window.ordersController) {
        window.ordersController.viewOrder(orderId);
    }
};

OrdersController.verifyPayment = function(orderId, status) {
    if (window.ordersController) {
        window.ordersController.verifyPayment(orderId, status);
    }
};

OrdersController.confirmOrder = function(orderId) {
    if (window.ordersController) {
        window.ordersController.confirmOrder(orderId);
    }
};

OrdersController.scanCustomerQR = function(orderId) {
    if (window.ordersController) {
        window.ordersController.scanCustomerQR(orderId);
    }
};

OrdersController.completeOrder = function(orderId) {
    if (window.ordersController) {
        window.ordersController.completeOrder(orderId);
    }
};

OrdersController.cancelOrder = function(orderId) {
    if (window.ordersController) {
        window.ordersController.cancelOrder(orderId);
    }
};

OrdersController.resetFilters = function() {
    if (window.ordersController) {
        window.ordersController.resetFilters();
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.ordersController = new OrdersController();
});

