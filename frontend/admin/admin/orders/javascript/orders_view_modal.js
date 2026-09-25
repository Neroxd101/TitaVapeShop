// Logic for Order Details View Modal
const OrdersViewModal = {
    controller: null,

    init(controller) {
        this.controller = controller;
        this.setupEventListeners();
    },

    async loadModal() {
        const container = document.getElementById('order-details-modal-container');
        if (!container) return;

        try {
            const response = await fetch('/admin/admin/orders/order-details-modal.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error loading order details modal:', error);
        }
    },

    setupEventListeners() {
        const modal = document.getElementById('orderDetailsModal');
        const closeBtn = document.getElementById('closeOrderDetailsModal');
        const closeModal = () => modal?.classList.remove('show');

        closeBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    },

    viewOrder(orderId) {
        const order = this.controller?.state?.orders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('orderDetailsModal');
        const content = document.getElementById('orderDetailsContent');
        if (!modal || !content) return;

        const escapeHtml = (text) => {
            if (!text) return '';
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(text).replace(/[&<>"']/g, m => map[m]);
        };

        const formatDate = (dateString) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleString('en-PH', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        };

        const getStatusBadge = (status) => {
            const badges = {
                'pending': '<span class="badge badge-warning">Pending</span>',
                'confirmed': '<span class="badge badge-info">Confirmed</span>',
                'completed': '<span class="badge badge-success">Completed</span>',
                'voided': '<span class="badge badge-danger">Voided</span>',
                'cancelled': '<span class="badge badge-danger">Cancelled</span>'
            };
            return badges[status] || `<span class="badge">${status}</span>`;
        };

        const getPaymentBadge = (status) => {
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
        };

        // Render order details
        const itemsHtml = Array.isArray(order.items) ? order.items.map(item => `
            <div class="order-item-row">
                <div class="order-item-info">
                    <strong>${escapeHtml(item.name || 'Item')}</strong>
                    <div class="order-item-meta-row">
                        <span class="order-item-category">${escapeHtml(item.category || '')}</span>
                        ${(item.selected_variation || item.variation) ? `<span class="order-item-variation">Variation: ${escapeHtml(item.selected_variation || item.variation)}</span>` : ''}
                    </div>
                </div>
                <div class="order-item-qty">${item.quantity}x</div>
                <div class="order-item-price">₱${parseFloat(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div class="order-item-subtotal">₱${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
        `).join('') : '<p>No items</p>';

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
            console.warn('Order details - missing or invalid order_type:', {
                orderId: order.id,
                order_type: order.order_type
            });
            orderTypeLabel = 'Pickup';
            showQrCode = true;
        }

        const isDelivery = orderType === 'delivery';
        const paymentStatus = order.payment_status || 'unpaid';
        const voidReasonHtml = order.status === 'voided' ? `
            <div class="order-void-reason">
                <strong>Void Reason</strong>
                <span>${escapeHtml(order.void_reason || 'No reason recorded.')}</span>
            </div>
        ` : '';

        if (isDelivery) {
            const hasReceipt = Boolean(order.payment_receipt_url);
            content.innerHTML = `
                <div class="order-details">
                    <div class="order-details-delivery-header ${hasReceipt ? '' : 'no-receipt'}">
                        <div class="order-details-info-combined">
                            <div class="order-details-info order-details-info-col">
                                <h4>Order Information</h4>
                                <p><strong>Order ID:</strong> <code>${order.id}</code></p>
                                <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
                                <p><strong>Contact:</strong> ${escapeHtml(order.contact_number)}</p>
                                <p><strong>Order Type:</strong> ${orderTypeLabel}</p>
                                <p><strong>Status:</strong> ${getStatusBadge(order.status)}</p>
                                ${voidReasonHtml}
                                <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
                            </div>
                            <div class="order-details-info order-details-info-col">
                                <h4>Payment Information</h4>
                                <p><strong>Payment Method:</strong> GCash / InstaPay</p>
                                <p><strong>Payment Status:</strong> ${getPaymentBadge(paymentStatus)}</p>
                                <p class="payment-reference-row"><strong>Reference No:</strong> ${order.payment_reference ? `<code class="payment-reference-value">${escapeHtml(order.payment_reference)}</code>` : '<span class="text-muted">Not submitted yet</span>'}</p>
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
                            <a href="${escapeHtml(order.payment_receipt_url)}" target="_blank" rel="noopener noreferrer" class="receipt-proof-link">
                                <img src="${escapeHtml(order.payment_receipt_url)}" alt="Payment Receipt" class="receipt-proof-img" />
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
                            <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
                            <p><strong>Contact:</strong> ${escapeHtml(order.contact_number)}</p>
                            <p><strong>Order Type:</strong> ${orderTypeLabel}</p>
                            <p><strong>Status:</strong> ${getStatusBadge(order.status)}</p>
                                ${voidReasonHtml}
                            <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
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
};

window.OrdersViewModal = OrdersViewModal;
