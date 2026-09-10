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
                this.setupModalEventListeners();
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
            const orderDate = this.formatDate(order.created_at);
            const statusBadge = this.getStatusBadge(order.status);
            const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
            const itemsSummary = this.getItemsSummary(order.items);
            
            // Display order type based on customer's selection
            // Normalize order_type to lowercase for comparison
            const orderType = order.order_type ? String(order.order_type).toLowerCase().trim() : 'pickup';
            
            if (!order.order_type || order.order_type !== 'pickup' && order.order_type !== 'delivery') {
                console.warn('Order type issue:', {
                    orderId: order.id,
                    order_type: order.order_type,
                    normalized: orderType
                });
            }
            
            let orderTypeBadge;
            if (orderType === 'pickup') {
                orderTypeBadge = '<span class="badge badge-info">Pickup</span>';
            } else if (orderType === 'delivery') {
                orderTypeBadge = '<span class="badge badge-warning">Delivery (3rd Party)</span>';
            } else {
                // Should not reach here, but fallback
                orderTypeBadge = '<span class="badge badge-info">Pickup</span>';
            }

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
                    <td class="col-type" data-label="Type">${orderTypeBadge}</td>
                    <td class="col-status" data-label="Status">${statusBadge}</td>
                    <td class="col-date" data-label="Date"><span class="order-date-val">${orderDate}</span></td>
                    <td class="col-actions" data-label="Actions">
                        <div class="order-actions">
                            ${order.status === 'completed' ? `<button class="btn btn-small btn-danger" onclick="window.ordersController.voidOrder('${order.id}')">Void</button>` : ''}
                            <button class="btn btn-small btn-secondary" onclick="OrdersController.viewOrder('${order.id}')">View</button>
                            ${order.status === 'pending' 
                                ? `
                                    <button class="btn btn-small btn-primary" onclick="OrdersController.confirmOrder('${order.id}')">Confirm</button>
                                    <button class="btn btn-small btn-danger" onclick="OrdersController.cancelOrder('${order.id}')">Cancel</button>
                                `
                                : ''}
                            ${order.status === 'confirmed'
                                ? `
                                    ${orderType === 'pickup' 
                                        ? `<button class="btn btn-small btn-info" onclick="OrdersController.scanCustomerQR('${order.id}')">Scan QR</button>`
                                        : ''}
                                    <button class="btn btn-small btn-success" onclick="OrdersController.completeOrder('${order.id}')">Complete</button>
                                    <button class="btn btn-small btn-danger" onclick="OrdersController.cancelOrder('${order.id}')">Cancel</button>
                                `
                                : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
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
            const response = await fetch('/api/orders/update_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                    order_id: orderId,
                    status: 'confirmed'
                })
            });

            const result = await response.json();

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
            const response = await fetch('/api/orders/update_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                    order_id: orderId,
                    status: 'completed'
                })
            });

            const result = await response.json();

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
                const response = await fetch('/api/orders/update_status', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ order_id: orderId, status: 'voided', reason })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Unable to void order.');
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
            const response = await fetch('/api/orders/update_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                    order_id: orderId,
                    status: 'cancelled'
                })
            });

            const result = await response.json();

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
                    ${showQrCode ? `
                    <div class="order-qr-section">
                        <h4>Order QR Code</h4>
                        <div id="orderQrCodeDisplay" class="qr-code-display"></div>
                        <p class="qr-hint">Customer can show this QR code</p>
                    </div>
                    ` : ''}
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
