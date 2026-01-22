/**
 * Orders Controller
 * Manages the orders page UI and interactions
 */
class OrdersController {
    constructor() {
        this.state = {
            filters: {
                status: '',
                limit: 20,
                offset: 0
            },
            loading: false,
            orders: [],
            total: 0
        };

        this.elements = {
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

        this.setupEventListeners();
        await this.loadOrders();
    }

    setupEventListeners() {
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
            listEl.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">No orders found</td></tr>';
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
            
            // Debug log for troubleshooting
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

            return `
                <tr>
                    <td><code class="order-id" title="${order.id}">${order.id.substring(0, 8)}</code></td>
                    <td>${this.escapeHtml(order.customer_name)}</td>
                    <td>${this.escapeHtml(order.contact_number)}</td>
                    <td>${itemsCount} item(s)<br><small>${itemsSummary}</small></td>
                    <td><strong>₱${parseFloat(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                    <td>${orderTypeBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${orderDate}</td>
                    <td>
                        <div class="order-actions">
                            <button class="btn btn-small btn-secondary" onclick="OrdersController.viewOrder('${order.id}')">View</button>
                            ${order.status === 'pending' 
                                ? `<button class="btn btn-small btn-primary" onclick="OrdersController.confirmOrder('${order.id}')">Confirm</button>`
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

    async confirmOrder(orderId) {
        if (!confirm('Are you sure you want to confirm this order?')) {
            return;
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
                alert('Order confirmed successfully!');
                this.loadOrders();
            } else {
                alert('Failed to confirm order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error confirming order:', error);
            alert('Error confirming order. Please try again.');
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
            // QR code matches - complete the order
            this.completeOrder(this.scanningOrderId);
        } else {
            alert('QR code does not match this order. Please scan the correct QR code.');
            this.scanningOrderId = null;
        }
    }

    async completeOrder(orderId) {
        if (!confirm('Are you sure you want to complete this order?')) {
            return;
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
                alert('Order completed successfully!');
                this.loadOrders();
            } else {
                alert('Failed to complete order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error completing order:', error);
            alert('Error completing order. Please try again.');
        }
    }

    async cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
            return;
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
                alert('Order cancelled successfully!');
                this.loadOrders();
            } else {
                alert('Failed to cancel order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Error cancelling order. Please try again.');
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
                        ${order.social_media ? `<p><strong>Social Media:</strong> ${this.escapeHtml(order.social_media)}</p>` : ''}
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
        this.state.filters.offset = 0;
        if (this.elements.filterStatus) {
            this.elements.filterStatus.value = '';
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

    // Close order details modal
    const orderDetailsModal = document.getElementById('orderDetailsModal');
    const closeOrderDetailsModal = document.getElementById('closeOrderDetailsModal');

    if (closeOrderDetailsModal) {
        closeOrderDetailsModal.addEventListener('click', () => {
            orderDetailsModal.classList.remove('show');
        });
    }

    if (orderDetailsModal) {
        orderDetailsModal.addEventListener('click', (e) => {
            if (e.target === orderDetailsModal) {
                orderDetailsModal.classList.remove('show');
            }
        });
    }

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
