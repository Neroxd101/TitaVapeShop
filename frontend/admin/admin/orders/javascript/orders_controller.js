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
            pageInfo: document.getElementById('pageInfo')
        };

        // QR Scanner state
        this.qrScanner = null;
        this.qrScanning = false;
        this.scanningOrderId = null;

        // Modal state
        this.pendingOrderId = null;

        this.init();
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

        // Load order details modal
        await this.loadOrderDetailsModal();

        this.setupEventListeners();
        this.setupModalEventListeners();
        await this.loadOrders();
    }

    async loadOrderDetailsModal() {
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
        const orderDetailsModal = document.getElementById('orderDetailsModal');
        const closeOrderDetailsModal = document.getElementById('closeOrderDetailsModal');

        if (closeOrderDetailsModal) {
            closeOrderDetailsModal.addEventListener('click', () => {
                if (orderDetailsModal) {
                    orderDetailsModal.classList.remove('show');
                }
            });
        }

        if (orderDetailsModal) {
            orderDetailsModal.addEventListener('click', (e) => {
                if (e.target === orderDetailsModal) {
                    orderDetailsModal.classList.remove('show');
                }
            });
        }

        // Confirm Order Modal
        const confirmOrderModal = document.getElementById('confirmOrderModal');
        const closeConfirmOrderModal = document.getElementById('closeConfirmOrderModal');
        const cancelConfirmOrderBtn = document.getElementById('cancelConfirmOrderBtn');
        const confirmOrderBtn = document.getElementById('confirmOrderBtn');

        if (closeConfirmOrderModal) {
            closeConfirmOrderModal.addEventListener('click', () => {
                if (confirmOrderModal) {
                    confirmOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (cancelConfirmOrderBtn) {
            cancelConfirmOrderBtn.addEventListener('click', () => {
                if (confirmOrderModal) {
                    confirmOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => {
                if (this.pendingOrderId) {
                    this.executeConfirmOrder(this.pendingOrderId);
                }
            });
        }

        if (confirmOrderModal) {
            confirmOrderModal.addEventListener('click', (e) => {
                if (e.target === confirmOrderModal) {
                    confirmOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        // Cancel Order Modal
        const cancelOrderModal = document.getElementById('cancelOrderModal');
        const closeCancelOrderModal = document.getElementById('closeCancelOrderModal');
        const cancelCancelOrderBtn = document.getElementById('cancelCancelOrderBtn');
        const confirmCancelOrderBtn = document.getElementById('confirmCancelOrderBtn');

        if (closeCancelOrderModal) {
            closeCancelOrderModal.addEventListener('click', () => {
                if (cancelOrderModal) {
                    cancelOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (cancelCancelOrderBtn) {
            cancelCancelOrderBtn.addEventListener('click', () => {
                if (cancelOrderModal) {
                    cancelOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (confirmCancelOrderBtn) {
            confirmCancelOrderBtn.addEventListener('click', () => {
                if (this.pendingOrderId) {
                    this.executeCancelOrder(this.pendingOrderId);
                }
            });
        }

        if (cancelOrderModal) {
            cancelOrderModal.addEventListener('click', (e) => {
                if (e.target === cancelOrderModal) {
                    cancelOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        // Complete Order Modal
        const completeOrderModal = document.getElementById('completeOrderModal');
        const closeCompleteOrderModal = document.getElementById('closeCompleteOrderModal');
        const cancelCompleteOrderBtn = document.getElementById('cancelCompleteOrderBtn');
        const confirmCompleteOrderBtn = document.getElementById('confirmCompleteOrderBtn');

        if (closeCompleteOrderModal) {
            closeCompleteOrderModal.addEventListener('click', () => {
                if (completeOrderModal) {
                    completeOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (cancelCompleteOrderBtn) {
            cancelCompleteOrderBtn.addEventListener('click', () => {
                if (completeOrderModal) {
                    completeOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        if (confirmCompleteOrderBtn) {
            confirmCompleteOrderBtn.addEventListener('click', () => {
                if (this.pendingOrderId) {
                    this.executeCompleteOrder(this.pendingOrderId);
                }
            });
        }

        if (completeOrderModal) {
            completeOrderModal.addEventListener('click', (e) => {
                if (e.target === completeOrderModal) {
                    completeOrderModal.classList.remove('show');
                    this.pendingOrderId = null;
                }
            });
        }

        // Confirm Verify Payment Modal (Mark Paid)
        const confirmVerifyPaymentModal = document.getElementById('confirmVerifyPaymentModal');
        const closeVerifyPaymentModal = document.getElementById('closeVerifyPaymentModal');
        const cancelVerifyPaymentBtn = document.getElementById('cancelVerifyPaymentBtn');
        const confirmVerifyPaymentBtn = document.getElementById('confirmVerifyPaymentBtn');

        if (closeVerifyPaymentModal) {
            closeVerifyPaymentModal.addEventListener('click', () => {
                if (confirmVerifyPaymentModal) confirmVerifyPaymentModal.classList.remove('show');
                this.pendingPaymentAction = null;
            });
        }
        if (cancelVerifyPaymentBtn) {
            cancelVerifyPaymentBtn.addEventListener('click', () => {
                if (confirmVerifyPaymentModal) confirmVerifyPaymentModal.classList.remove('show');
                this.pendingPaymentAction = null;
            });
        }
        if (confirmVerifyPaymentBtn) {
            confirmVerifyPaymentBtn.addEventListener('click', () => {
                if (this.pendingPaymentAction) {
                    const { orderId, paymentStatus } = this.pendingPaymentAction;
                    if (confirmVerifyPaymentModal) confirmVerifyPaymentModal.classList.remove('show');
                    this.executeVerifyPayment(orderId, paymentStatus);
                }
            });
        }
        if (confirmVerifyPaymentModal) {
            confirmVerifyPaymentModal.addEventListener('click', (e) => {
                if (e.target === confirmVerifyPaymentModal) {
                    confirmVerifyPaymentModal.classList.remove('show');
                    this.pendingPaymentAction = null;
                }
            });
        }

        // Confirm Mark Unpaid / Reject Proof Modal
        const confirmMarkUnpaidModal = document.getElementById('confirmMarkUnpaidModal');
        const closeMarkUnpaidModal = document.getElementById('closeMarkUnpaidModal');
        const cancelMarkUnpaidBtn = document.getElementById('cancelMarkUnpaidBtn');
        const confirmMarkUnpaidBtn = document.getElementById('confirmMarkUnpaidBtn');

        if (closeMarkUnpaidModal) {
            closeMarkUnpaidModal.addEventListener('click', () => {
                if (confirmMarkUnpaidModal) confirmMarkUnpaidModal.classList.remove('show');
                this.pendingPaymentAction = null;
            });
        }
        if (cancelMarkUnpaidBtn) {
            cancelMarkUnpaidBtn.addEventListener('click', () => {
                if (confirmMarkUnpaidModal) confirmMarkUnpaidModal.classList.remove('show');
                this.pendingPaymentAction = null;
            });
        }
        if (confirmMarkUnpaidBtn) {
            confirmMarkUnpaidBtn.addEventListener('click', () => {
                if (this.pendingPaymentAction) {
                    const { orderId, paymentStatus } = this.pendingPaymentAction;
                    if (confirmMarkUnpaidModal) confirmMarkUnpaidModal.classList.remove('show');
                    this.executeVerifyPayment(orderId, paymentStatus);
                }
            });
        }
        if (confirmMarkUnpaidModal) {
            confirmMarkUnpaidModal.addEventListener('click', (e) => {
                if (e.target === confirmMarkUnpaidModal) {
                    confirmMarkUnpaidModal.classList.remove('show');
                    this.pendingPaymentAction = null;
                }
            });
        }

        // Order Confirmed Success Modal
        const orderConfirmedSuccessModal = document.getElementById('orderConfirmedSuccessModal');
        const closeOrderConfirmedSuccessModal = document.getElementById('closeOrderConfirmedSuccessModal');
        const closeOrderConfirmedSuccessBtn = document.getElementById('closeOrderConfirmedSuccessBtn');

        if (closeOrderConfirmedSuccessModal) {
            closeOrderConfirmedSuccessModal.addEventListener('click', () => {
                if (orderConfirmedSuccessModal) {
                    orderConfirmedSuccessModal.classList.remove('show');
                }
            });
        }

        if (closeOrderConfirmedSuccessBtn) {
            closeOrderConfirmedSuccessBtn.addEventListener('click', () => {
                if (orderConfirmedSuccessModal) {
                    orderConfirmedSuccessModal.classList.remove('show');
                }
            });
        }

        if (orderConfirmedSuccessModal) {
            orderConfirmedSuccessModal.addEventListener('click', (e) => {
                if (e.target === orderConfirmedSuccessModal) {
                    orderConfirmedSuccessModal.classList.remove('show');
                }
            });
        }

        // Order Completed Success Modal
        const orderCompletedSuccessModal = document.getElementById('orderCompletedSuccessModal');
        const closeOrderCompletedSuccessModal = document.getElementById('closeOrderCompletedSuccessModal');
        const closeOrderCompletedSuccessBtn = document.getElementById('closeOrderCompletedSuccessBtn');

        if (closeOrderCompletedSuccessModal) {
            closeOrderCompletedSuccessModal.addEventListener('click', () => {
                if (orderCompletedSuccessModal) {
                    orderCompletedSuccessModal.classList.remove('show');
                }
            });
        }

        if (closeOrderCompletedSuccessBtn) {
            closeOrderCompletedSuccessBtn.addEventListener('click', () => {
                if (orderCompletedSuccessModal) {
                    orderCompletedSuccessModal.classList.remove('show');
                }
            });
        }

        if (orderCompletedSuccessModal) {
            orderCompletedSuccessModal.addEventListener('click', (e) => {
                if (e.target === orderCompletedSuccessModal) {
                    orderCompletedSuccessModal.classList.remove('show');
                }
            });
        }

        // Order Voided Success Modal
        const orderVoidedSuccessModal = document.getElementById('orderVoidedSuccessModal');
        const closeOrderVoidedSuccessModal = document.getElementById('closeOrderVoidedSuccessModal');
        const closeOrderVoidedSuccessBtn = document.getElementById('closeOrderVoidedSuccessBtn');

        if (closeOrderVoidedSuccessModal) {
            closeOrderVoidedSuccessModal.addEventListener('click', () => {
                if (orderVoidedSuccessModal) {
                    orderVoidedSuccessModal.classList.remove('show');
                }
            });
        }

        if (closeOrderVoidedSuccessBtn) {
            closeOrderVoidedSuccessBtn.addEventListener('click', () => {
                if (orderVoidedSuccessModal) {
                    orderVoidedSuccessModal.classList.remove('show');
                }
            });
        }

        if (orderVoidedSuccessModal) {
            orderVoidedSuccessModal.addEventListener('click', (e) => {
                if (e.target === orderVoidedSuccessModal) {
                    orderVoidedSuccessModal.classList.remove('show');
                }
            });
        }

        // Order Cancelled Success Modal
        const orderCancelledSuccessModal = document.getElementById('orderCancelledSuccessModal');
        const closeOrderCancelledSuccessModal = document.getElementById('closeOrderCancelledSuccessModal');
        const closeOrderCancelledSuccessBtn = document.getElementById('closeOrderCancelledSuccessBtn');

        if (closeOrderCancelledSuccessModal) {
            closeOrderCancelledSuccessModal.addEventListener('click', () => {
                if (orderCancelledSuccessModal) {
                    orderCancelledSuccessModal.classList.remove('show');
                }
            });
        }

        if (closeOrderCancelledSuccessBtn) {
            closeOrderCancelledSuccessBtn.addEventListener('click', () => {
                if (orderCancelledSuccessModal) {
                    orderCancelledSuccessModal.classList.remove('show');
                }
            });
        }

        if (orderCancelledSuccessModal) {
            orderCancelledSuccessModal.addEventListener('click', (e) => {
                if (e.target === orderCancelledSuccessModal) {
                    orderCancelledSuccessModal.classList.remove('show');
                }
            });
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

        if (this.elements.orderSearchInput) {
            let debounceTimer;
            this.elements.orderSearchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.state.filters.search = e.target.value.trim();
                    this.state.filters.offset = 0;
                    this.loadOrders();
                }, 300);
            });
        }

        if (this.elements.filterStatus) {
            this.elements.filterStatus.addEventListener('change', () => {
                this.state.filters.status = this.elements.filterStatus.value;
                this.state.filters.offset = 0;
                this.loadOrders();
            });
        }

        this.syncDateHints();

        const dateInputs = [this.elements.filterStartDate, this.elements.filterEndDate];
        for (const input of dateInputs) {
            if (!input) continue;
            input.addEventListener('input', () => this.syncDateHints());
            input.addEventListener('change', () => {
                this.syncDateHints();
                const start = this.elements.filterStartDate;
                const end = this.elements.filterEndDate;
                if (end) end.setCustomValidity('');
                if (start && end && start.value && end.value && start.value > end.value) {
                    end.setCustomValidity('End date must be on or after start date.');
                    end.reportValidity();
                    return;
                }
                this.state.filters.start_date = start && start.value ? new Date(start.value + 'T00:00:00').toISOString() : '';
                this.state.filters.end_date = end && end.value ? new Date(end.value + 'T23:59:59.999').toISOString() : '';
                this.state.filters.offset = 0;
                this.loadOrders();
            });
        }

        if (this.elements.resetFiltersBtn) {
            this.elements.resetFiltersBtn.addEventListener('click', () => {
                this.resetFilters();
            });
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

    syncDateHints() {
        if (this.elements.filterStartDate) {
            this.elements.filterStartDate.dataset.empty = String(!this.elements.filterStartDate.value);
        }
        if (this.elements.filterEndDate) {
            this.elements.filterEndDate.dataset.empty = String(!this.elements.filterEndDate.value);
        }
    }

    resetFilters() {
        if (this.elements.orderSearchInput) this.elements.orderSearchInput.value = '';
        if (this.elements.filterStatus) this.elements.filterStatus.value = '';
        if (this.elements.filterStartDate) this.elements.filterStartDate.value = '';
        if (this.elements.filterEndDate) {
            this.elements.filterEndDate.value = '';
            this.elements.filterEndDate.setCustomValidity('');
        }
        this.syncDateHints();

        this.state.filters = {
            status: '',
            search: '',
            start_date: '',
            end_date: '',
            limit: 20,
            offset: 0
        };

        this.loadOrders();
    }

    async loadOrders() {
        this.setLoading(true);

        try {
            const result = await OrdersGetAll.get(this.state.filters);

            if (result.success) {
                this.state.orders = result.orders || [];
                this.state.total = result.total || 0;
                this.renderOrders();
                this.updatePagination();
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
            const emptyMsg = this.state.filters.search
                ? `No orders found matching "${this.escapeHtml(this.state.filters.search)}"`
                : 'No orders found';
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
        this.pendingOrderId = orderId;
        const modal = document.getElementById('confirmOrderModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    async executeConfirmOrder(orderId) {
        const modal = document.getElementById('confirmOrderModal');
        if (modal) {
            modal.classList.remove('show');
        }

        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                    order_id: orderId,
                    status: 'confirmed'
                });

            if (result.success) {
                // Show success modal
                const successModal = document.getElementById('orderConfirmedSuccessModal');
                if (successModal) {
                    successModal.classList.add('show');
                }
                this.loadOrders();
            } else {
                alert('Failed to confirm order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error confirming order:', error);
            alert('Error confirming order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    }

    scanCustomerQR(orderId) {
        // Store the order ID for validation
        this.scanningOrderId = orderId;
        
        // Open QR scanner modal
        const qrModal = document.getElementById('qrScannerModal');
        if (qrModal) {
            qrModal.classList.add('show');
            this.startQRScanner();
        }
    }

    async startQRScanner() {
        if (this.qrScanner && this.qrScanning) return;

        if (typeof Html5Qrcode === 'undefined') {
            alert('QR scanner library not loaded. Please check your internet connection.');
            return;
        }

        try {
            this.qrScanner = new Html5Qrcode('qrScanner');
            await this.qrScanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    this.handleQRScanned(decodedText);
                },
                (errorMessage) => {
                    // Ignore scan errors, they happen frequently while searching
                }
            );
            this.qrScanning = true;
        } catch (err) {
            console.error('Error starting QR scanner:', err);
            alert('Unable to access camera for QR scanning.');
            await this.stopQRScanner();
        }
    }

    async stopQRScanner() {
        if (!this.qrScanner || !this.qrScanning) return;

        try {
            await this.qrScanner.stop();
            await this.qrScanner.clear();
        } catch (err) {
            console.error('Error stopping QR scanner:', err);
        } finally {
            this.qrScanner = null;
            this.qrScanning = false;
        }
    }

    async handleQRScanned(decodedText) {
        if (!decodedText || !this.scanningOrderId) return;

        // Stop scanning immediately
        await this.stopQRScanner();

        // Close modal
        const qrModal = document.getElementById('qrScannerModal');
        if (qrModal) {
            qrModal.classList.remove('show');
        }

        // Validate scanned QR code matches the order ID
        const scannedOrderId = decodedText.trim();
        
        if (scannedOrderId === this.scanningOrderId) {
            // QR code matches - show complete modal
            this.completeOrder(this.scanningOrderId);
        } else {
            alert('QR code does not match this order. Please scan the correct QR code.');
            this.scanningOrderId = null;
        }
    }

    completeOrder(orderId) {
        this.pendingOrderId = orderId;
        const modal = document.getElementById('completeOrderModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    async executeCompleteOrder(orderId) {
        const modal = document.getElementById('completeOrderModal');
        if (modal) {
            modal.classList.remove('show');
        }

        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                    order_id: orderId,
                    status: 'completed'
                });

            if (result.success) {
                const successModal = document.getElementById('orderCompletedSuccessModal');
                if (successModal) {
                    successModal.classList.add('show');
                }
                this.loadOrders();
            } else {
                alert('Failed to complete order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error completing order:', error);
            alert('Error completing order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    }

    voidOrder(orderId) {
        const modal = document.getElementById('voidOrderModal');
        const form = document.getElementById('voidOrderForm');
        const button = document.getElementById('submitVoidOrder');
        const errorBox = document.getElementById('voidOrderError');
        const reasonInput = document.getElementById('voidReason');
        const charCount = document.getElementById('voidReasonCharCount');
        const closeBtn = document.getElementById('closeVoidOrderModal');
        const dismissBtn = document.getElementById('dismissVoidOrder');

        if (button.disabled) return;
        form.reset();
        errorBox.textContent = '';
        if (charCount) charCount.textContent = '0 / 1000';
        modal.classList.add('show');
        if (reasonInput) reasonInput.focus();

        const closeModal = () => {
            if (!button.disabled) modal.classList.remove('show');
        };

        if (dismissBtn) dismissBtn.onclick = closeModal;
        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        if (reasonInput) {
            reasonInput.oninput = () => {
                if (charCount) {
                    charCount.textContent = `${reasonInput.value.length} / 1000`;
                }
                if (errorBox.textContent) {
                    errorBox.textContent = '';
                }
            };
        }

        form.onsubmit = async (event) => {
            event.preventDefault();
            if (button.disabled) return;
            const reason = reasonInput ? reasonInput.value.trim() : '';
            if (!reason || reason.length > 1000) {
                errorBox.textContent = 'Please enter a reason for voiding (1–1000 characters).';
                if (reasonInput) reasonInput.focus();
                return;
            }
            button.disabled = true;
            errorBox.textContent = '';
            try {
                const result = await window.OrdersVoid.voidOrder(orderId, reason);

                if (!result || !result.success) throw new Error(result?.error || 'Unable to void order.');
                modal.classList.remove('show');
                await this.loadOrders();
                const voidedModal = document.getElementById('orderVoidedSuccessModal');
                if (voidedModal) {
                    voidedModal.classList.add('show');
                }
            } catch (error) {
                errorBox.textContent = error.message || 'Unable to void order. Please try again.';
            } finally {
                button.disabled = false;
            }
        };
    }

    cancelOrder(orderId) {
        this.pendingOrderId = orderId;
        const modal = document.getElementById('cancelOrderModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    async executeCancelOrder(orderId) {
        const modal = document.getElementById('cancelOrderModal');
        if (modal) {
            modal.classList.remove('show');
        }

        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                    order_id: orderId,
                    status: 'cancelled'
                });

            if (result.success) {
                const successModal = document.getElementById('orderCancelledSuccessModal');
                if (successModal) {
                    successModal.classList.add('show');
                }
                this.loadOrders();
            } else {
                alert('Failed to cancel order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Error cancelling order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    }

    viewOrder(orderId) {
        const order = this.state.orders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('orderDetailsModal');
        const content = document.getElementById('orderDetailsContent');
        if (!modal || !content) return;

        // Render order details
        const itemsHtml = Array.isArray(order.items) ? order.items.map(item => `
            <div class="order-item-row">
                <div class="order-item-info">
                    <strong>${this.escapeHtml(item.name || 'Item')}</strong>
                    <span class="order-item-category">${this.escapeHtml(item.category || '')}</span>
                </div>
                <div class="order-item-qty">${item.quantity}x</div>
                <div class="order-item-price">₱${parseFloat(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div class="order-item-subtotal">₱${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
        `).join('') : '<p>No items</p>';

        // Display order type based on customer's selection
        // Normalize order_type to lowercase for comparison
        const orderType = order.order_type ? String(order.order_type).toLowerCase().trim() : null;
        
        let orderTypeLabel;
        let showQrCode;
        if (orderType === 'pickup') {
            orderTypeLabel = 'Pickup';
            showQrCode = true;
        } else if (orderType === 'delivery') {
            orderTypeLabel = 'Delivery (3rd Party)';
            showQrCode = false;
        } else {
            // Fallback for orders without order_type (legacy orders)
            console.warn('Order details - missing or invalid order_type:', {
                orderId: order.id,
                order_type: order.order_type
            });
            orderTypeLabel = 'Pickup';
            showQrCode = true;
        }

        const isDelivery = orderType === 'delivery';
        const paymentStatus = order.payment_status || 'unpaid';

        if (isDelivery) {
            const hasReceipt = Boolean(order.payment_receipt_url);
            content.innerHTML = `
                <div class="order-details">
                    <div class="order-details-delivery-header ${hasReceipt ? '' : 'no-receipt'}">
                        <div class="order-details-info-combined">
                            <div class="order-details-info order-details-info-col">
                                <h4>Order Information</h4>
                                <p><strong>Order ID:</strong> <code>${order.id}</code></p>
                                <p><strong>Customer:</strong> ${this.escapeHtml(order.customer_name)}</p>
                                <p><strong>Contact:</strong> ${this.escapeHtml(order.contact_number)}</p>
                                <p><strong>Order Type:</strong> ${orderTypeLabel}</p>
                                <p><strong>Status:</strong> ${this.getStatusBadge(order.status)}</p>
                                <p><strong>Date:</strong> ${this.formatDate(order.created_at)}</p>
                            </div>
                            <div class="order-details-info order-details-info-col">
                                <h4>Payment Information</h4>
                                <p><strong>Payment Method:</strong> GCash / InstaPay</p>
                                <p><strong>Payment Status:</strong> ${this.getPaymentBadge(paymentStatus)}</p>
                                <p><strong>Reference No:</strong> ${order.payment_reference ? `<code>${this.escapeHtml(order.payment_reference)}</code>` : '<span class="text-muted">Not submitted yet</span>'}</p>
                                ${paymentStatus === 'pending_verification' && Boolean(order.payment_reference || order.payment_receipt_url) ? `
                                    <div style="margin-top: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        <button type="button" class="btn btn-small btn-success" data-order-action="verifyPayment" data-order-id="${order.id}" data-payment-status="paid">
                                            ✓ Mark Paid
                                        </button>
                                        <button type="button" class="btn btn-small btn-danger" data-order-action="verifyPayment" data-order-id="${order.id}" data-payment-status="rejected">
                                            ✕ Reject Proof
                                        </button>
                                    </div>
                                ` : paymentStatus === 'rejected' ? `
                                    <div style="margin-top: 12px;">
                                        <small class="text-muted" style="display: block; font-size: 11px; color: var(--error);">Proof rejected. Waiting for customer to re-upload new payment proof.</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        ${hasReceipt ? `
                        <div class="order-details-receipt-col">
                            <h4 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Receipt Proof</h4>
                            <a href="${this.escapeHtml(order.payment_receipt_url)}" target="_blank" rel="noopener noreferrer" class="receipt-proof-link">
                                <img src="${this.escapeHtml(order.payment_receipt_url)}" alt="Payment Receipt" class="receipt-proof-img" />
                            </a>
                            <small class="receipt-proof-hint">Click to view full receipt ↗</small>
                        </div>
                        ` : ''}
                    </div>
                    <div class="order-items-section" style="margin-top: 24px;">
                        <h4>Order Items</h4>
                        <div class="order-items-list">
                            ${itemsHtml}
                        </div>
                        <div class="order-total-section">
                            <strong>Total: ₱${parseFloat(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="order-details">
                    <div class="order-details-header">
                        <div class="order-details-info">
                            <h4>Order Information</h4>
                            <p><strong>Order ID:</strong> <code>${order.id}</code></p>
                            <p><strong>Customer:</strong> ${this.escapeHtml(order.customer_name)}</p>
                            <p><strong>Contact:</strong> ${this.escapeHtml(order.contact_number)}</p>
                            <p><strong>Order Type:</strong> ${orderTypeLabel}</p>
                            <p><strong>Status:</strong> ${this.getStatusBadge(order.status)}</p>
                            <p><strong>Date:</strong> ${this.formatDate(order.created_at)}</p>
                        </div>
                        <div class="order-qr-section">
                            <h4>Order QR Code</h4>
                            <div id="orderQrCodeDisplay" class="qr-code-display"></div>
                            <p class="qr-hint">Customer can show this QR code</p>
                        </div>
                    </div>
                    <div class="order-items-section">
                        <h4>Order Items</h4>
                        <div class="order-items-list">
                            ${itemsHtml}
                        </div>
                        <div class="order-total-section">
                            <strong>Total: ₱${parseFloat(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        // Generate QR code only for pickup orders
        if (showQrCode) {
            const qrContainer = document.getElementById('orderQrCodeDisplay');
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: order.id,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }

        modal.classList.add('show');
    }

    resetFilters() {
        this.state.filters.status = '';
        this.state.filters.search = '';
        this.state.filters.offset = 0;
        if (this.elements.filterStatus) {
            this.elements.filterStatus.value = '';
        }
        if (this.elements.orderSearchInput) {
            this.elements.orderSearchInput.value = '';
        }
        this.loadOrders();
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
        this.pendingPaymentAction = { orderId, paymentStatus };

        if (paymentStatus === 'paid') {
            const modal = document.getElementById('confirmVerifyPaymentModal');
            if (modal) {
                modal.classList.add('show');
            } else {
                // Fallback if modal DOM element is missing
                if (confirm('Confirm that payment has been received for this order?')) {
                    this.executeVerifyPayment(orderId, paymentStatus);
                }
            }
        } else {
            const modal = document.getElementById('confirmMarkUnpaidModal');
            const titleEl = document.getElementById('markUnpaidModalTitle');
            const msgEl = document.getElementById('markUnpaidModalMessage');
            const subtextEl = document.getElementById('markUnpaidModalSubtext');

            if (titleEl && msgEl && subtextEl) {
                if (paymentStatus === 'rejected') {
                    titleEl.textContent = 'Reject Payment Proof';
                    msgEl.textContent = 'Are you sure you want to reject this payment receipt?';
                    subtextEl.textContent = 'The customer will need to re-upload a valid proof of payment.';
                } else {
                    titleEl.textContent = 'Mark Payment as Unpaid';
                    msgEl.textContent = 'Mark this order payment as unpaid?';
                    subtextEl.textContent = 'The order payment status will be updated to unpaid.';
                }
            }

            if (modal) {
                modal.classList.add('show');
            } else {
                // Fallback if modal DOM element is missing
                if (confirm(paymentStatus === 'rejected' ? 'Reject this payment proof?' : 'Mark this order payment as unpaid?')) {
                    this.executeVerifyPayment(orderId, paymentStatus);
                }
            }
        }
    }

    async executeVerifyPayment(orderId, paymentStatus) {
        try {
            const result = await window.OrdersUpdatePaymentStatus.update({
                    order_id: orderId,
                    payment_status: paymentStatus
                });
            if (result.success) {
                // Update local order data
                const existing = this.state.orders.find(o => o.id === orderId);
                if (existing) {
                    existing.payment_status = paymentStatus;
                }
                this.renderOrders();
                // Refresh modal details
                this.viewOrder(orderId);
            } else {
                alert('Failed to update payment status: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error updating payment status:', err);
            alert('Error updating payment status. Please try again.');
        } finally {
            this.pendingPaymentAction = null;
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.ordersController = new OrdersController();

    // QR Scanner Modal event listeners
    const qrScannerModal = document.getElementById('qrScannerModal');
    const closeQrScannerModal = document.getElementById('closeQrScannerModal');

    if (closeQrScannerModal) {
        closeQrScannerModal.addEventListener('click', async () => {
            if (window.ordersController) {
                await window.ordersController.stopQRScanner();
                window.ordersController.scanningOrderId = null;
            }
            if (qrScannerModal) {
                qrScannerModal.classList.remove('show');
            }
        });
    }

    if (qrScannerModal) {
        qrScannerModal.addEventListener('click', async (e) => {
            if (e.target === qrScannerModal) {
                if (window.ordersController) {
                    await window.ordersController.stopQRScanner();
                    window.ordersController.scanningOrderId = null;
                }
                qrScannerModal.classList.remove('show');
            }
        });
    }
});
