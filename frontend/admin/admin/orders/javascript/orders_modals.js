// Dedicated module for managing Orders Action & Confirmation Modals
const OrdersModals = {
    controller: null,
    pendingOrderId: null,
    pendingPaymentAction: null,
    pendingRefundAction: null,
    refundSubmitting: false,

    init(controller) {
        this.controller = controller;
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Order Details Modal
        const orderDetailsModal = document.getElementById('orderDetailsModal');
        const closeOrderDetailsModal = document.getElementById('closeOrderDetailsModal');
        closeOrderDetailsModal?.addEventListener('click', () => orderDetailsModal?.classList.remove('show'));
        orderDetailsModal?.addEventListener('click', (e) => {
            if (e.target === orderDetailsModal) orderDetailsModal.classList.remove('show');
        });

        // Confirm Order Modal
        const confirmOrderModal = document.getElementById('confirmOrderModal');
        const closeConfirmOrderModal = document.getElementById('closeConfirmOrderModal');
        const cancelConfirmOrderBtn = document.getElementById('cancelConfirmOrderBtn');
        const confirmOrderBtn = document.getElementById('confirmOrderBtn');

        const closeConfirm = () => {
            confirmOrderModal?.classList.remove('show');
            this.pendingOrderId = null;
        };
        closeConfirmOrderModal?.addEventListener('click', closeConfirm);
        cancelConfirmOrderBtn?.addEventListener('click', closeConfirm);
        confirmOrderModal?.addEventListener('click', (e) => {
            if (e.target === confirmOrderModal) closeConfirm();
        });
        confirmOrderBtn?.addEventListener('click', () => {
            if (this.pendingOrderId) this.executeConfirmOrder(this.pendingOrderId);
        });

        // Complete Order Modal
        const completeOrderModal = document.getElementById('completeOrderModal');
        const closeCompleteOrderModal = document.getElementById('closeCompleteOrderModal');
        const cancelCompleteOrderBtn = document.getElementById('cancelCompleteOrderBtn');
        const confirmCompleteOrderBtn = document.getElementById('confirmCompleteOrderBtn');

        const closeComplete = () => {
            completeOrderModal?.classList.remove('show');
            this.pendingOrderId = null;
        };
        closeCompleteOrderModal?.addEventListener('click', closeComplete);
        cancelCompleteOrderBtn?.addEventListener('click', closeComplete);
        completeOrderModal?.addEventListener('click', (e) => {
            if (e.target === completeOrderModal) closeComplete();
        });
        confirmCompleteOrderBtn?.addEventListener('click', () => {
            if (this.pendingOrderId) this.executeCompleteOrder(this.pendingOrderId);
        });

        // Cancel Order Modal
        const cancelOrderModal = document.getElementById('cancelOrderModal');
        const closeCancelOrderModal = document.getElementById('closeCancelOrderModal');
        const cancelCancelOrderBtn = document.getElementById('cancelCancelOrderBtn');
        const confirmCancelOrderBtn = document.getElementById('confirmCancelOrderBtn');

        const closeCancel = () => {
            cancelOrderModal?.classList.remove('show');
            this.pendingOrderId = null;
        };
        closeCancelOrderModal?.addEventListener('click', closeCancel);
        cancelCancelOrderBtn?.addEventListener('click', closeCancel);
        cancelOrderModal?.addEventListener('click', (e) => {
            if (e.target === cancelOrderModal) closeCancel();
        });
        confirmCancelOrderBtn?.addEventListener('click', () => {
            if (this.pendingOrderId) this.executeCancelOrder(this.pendingOrderId);
        });

        // Payment: Mark Paid Modal
        const confirmVerifyPaymentModal = document.getElementById('confirmVerifyPaymentModal');
        const closeVerifyPaymentModal = document.getElementById('closeVerifyPaymentModal');
        const cancelVerifyPaymentBtn = document.getElementById('cancelVerifyPaymentBtn');
        const confirmVerifyPaymentBtn = document.getElementById('confirmVerifyPaymentBtn');

        const closeVerify = () => {
            confirmVerifyPaymentModal?.classList.remove('show');
            this.pendingPaymentAction = null;
        };
        closeVerifyPaymentModal?.addEventListener('click', closeVerify);
        cancelVerifyPaymentBtn?.addEventListener('click', closeVerify);
        confirmVerifyPaymentModal?.addEventListener('click', (e) => {
            if (e.target === confirmVerifyPaymentModal) closeVerify();
        });
        confirmVerifyPaymentBtn?.addEventListener('click', () => {
            if (this.pendingPaymentAction) {
                const { orderId, paymentStatus } = this.pendingPaymentAction;
                closeVerify();
                this.executeVerifyPayment(orderId, paymentStatus);
            }
        });

        // Payment: Reject / Mark Unpaid Modal
        const confirmMarkUnpaidModal = document.getElementById('confirmMarkUnpaidModal');
        const closeMarkUnpaidModal = document.getElementById('closeMarkUnpaidModal');
        const cancelMarkUnpaidBtn = document.getElementById('cancelMarkUnpaidBtn');
        const confirmMarkUnpaidBtn = document.getElementById('confirmMarkUnpaidBtn');

        const closeUnpaid = () => {
            confirmMarkUnpaidModal?.classList.remove('show');
            this.pendingPaymentAction = null;
        };
        closeMarkUnpaidModal?.addEventListener('click', closeUnpaid);
        cancelMarkUnpaidBtn?.addEventListener('click', closeUnpaid);
        confirmMarkUnpaidModal?.addEventListener('click', (e) => {
            if (e.target === confirmMarkUnpaidModal) closeUnpaid();
        });
        confirmMarkUnpaidBtn?.addEventListener('click', () => {
            if (this.pendingPaymentAction) {
                const { orderId, paymentStatus } = this.pendingPaymentAction;
                const reasonInput = document.getElementById('markUnpaidReason');
                const reason = paymentStatus === 'rejected' ? reasonInput?.value.trim() || '' : null;
                if (paymentStatus === 'rejected' && (!reason || reason.length > 1000)) {
                    alert('Enter a reason of 1–1000 characters.');
                    reasonInput?.focus();
                    return;
                }
                closeUnpaid();
                this.executeVerifyPayment(orderId, paymentStatus, reason);
            }
        });

        const refundModal = document.getElementById('confirmRefundModal');
        const closeRefund = () => {
            if (this.refundSubmitting) return;
            refundModal?.classList.remove('show');
            this.pendingRefundAction = null;
        };
        document.getElementById('closeRefundModal')?.addEventListener('click', closeRefund);
        document.getElementById('cancelRefundBtn')?.addEventListener('click', closeRefund);
        refundModal?.addEventListener('click', event => {
            if (event.target === refundModal) closeRefund();
        });
        document.getElementById('confirmRefundBtn')?.addEventListener('click', async () => {
            if (await this.executeMarkRefunded()) closeRefund();
        });

        // Success Modals (Confirmed, Completed, Voided, Cancelled)
        this.setupSuccessModal('orderConfirmedSuccessModal', 'closeOrderConfirmedSuccessModal', 'closeOrderConfirmedSuccessBtn');
        this.setupSuccessModal('orderCompletedSuccessModal', 'closeOrderCompletedSuccessModal', 'closeOrderCompletedSuccessBtn');
        this.setupSuccessModal('orderVoidedSuccessModal', 'closeOrderVoidedSuccessModal', 'closeOrderVoidedSuccessBtn');
        this.setupSuccessModal('orderCancelledSuccessModal', 'closeOrderCancelledSuccessModal', 'closeOrderCancelledSuccessBtn');
    },

    setupSuccessModal(modalId, closeBtnId, confirmBtnId) {
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeBtnId);
        const actionBtn = document.getElementById(confirmBtnId);
        const hide = () => modal?.classList.remove('show');
        closeBtn?.addEventListener('click', hide);
        actionBtn?.addEventListener('click', hide);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) hide();
        });
    },

    confirmOrder(orderId) {
        this.pendingOrderId = orderId;
        document.getElementById('confirmOrderModal')?.classList.add('show');
    },

    async executeConfirmOrder(orderId) {
        document.getElementById('confirmOrderModal')?.classList.remove('show');
        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                order_id: orderId,
                status: 'confirmed'
            });

            if (result.success) {
                document.getElementById('orderConfirmedSuccessModal')?.classList.add('show');
                this.controller?.loadOrders();
            } else {
                alert('Failed to confirm order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error confirming order:', error);
            alert('Error confirming order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    },

    completeOrder(orderId) {
        this.pendingOrderId = orderId;
        document.getElementById('completeOrderModal')?.classList.add('show');
    },

    async executeCompleteOrder(orderId) {
        document.getElementById('completeOrderModal')?.classList.remove('show');
        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                order_id: orderId,
                status: 'completed'
            });

            if (result.success) {
                document.getElementById('orderCompletedSuccessModal')?.classList.add('show');
                this.controller?.loadOrders();
            } else {
                alert('Failed to complete order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error completing order:', error);
            alert('Error completing order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    },

    cancelOrder(orderId) {
        this.pendingOrderId = orderId;
        document.getElementById('cancelOrderModal')?.classList.add('show');
    },

    async executeCancelOrder(orderId) {
        document.getElementById('cancelOrderModal')?.classList.remove('show');
        try {
            const result = await window.OrdersUpdateStatus.updateStatus({
                order_id: orderId,
                status: 'cancelled'
            });

            if (result.success) {
                document.getElementById('orderCancelledSuccessModal')?.classList.add('show');
                this.controller?.loadOrders();
            } else {
                alert('Failed to cancel order: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Error cancelling order. Please try again.');
        } finally {
            this.pendingOrderId = null;
        }
    },

    voidOrder(orderId) {
        const modal = document.getElementById('voidOrderModal');
        const form = document.getElementById('voidOrderForm');
        const button = document.getElementById('submitVoidOrder');
        const errorBox = document.getElementById('voidOrderError');
        const reasonInput = document.getElementById('voidReason');
        const charCount = document.getElementById('voidReasonCharCount');
        const closeBtn = document.getElementById('closeVoidOrderModal');
        const dismissBtn = document.getElementById('dismissVoidOrder');

        if (!modal || button?.disabled) return;
        form?.reset();
        if (errorBox) errorBox.textContent = '';
        if (charCount) charCount.textContent = '0 / 1000';
        modal.classList.add('show');
        reasonInput?.focus();

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
                if (charCount) charCount.textContent = `${reasonInput.value.length} / 1000`;
                if (errorBox) errorBox.textContent = '';
            };
        }

        form.onsubmit = async (event) => {
            event.preventDefault();
            if (button.disabled) return;
            const reason = reasonInput ? reasonInput.value.trim() : '';
            if (!reason || reason.length > 1000) {
                if (errorBox) errorBox.textContent = 'Please enter a reason for voiding (1–1000 characters).';
                reasonInput?.focus();
                return;
            }
            button.disabled = true;
            if (errorBox) errorBox.textContent = '';
            try {
                const result = await window.OrdersVoid.voidOrder(orderId, reason);
                if (!result || !result.success) throw new Error(result?.error || 'Unable to void order.');
                modal.classList.remove('show');
                await this.controller?.loadOrders();
                document.getElementById('orderVoidedSuccessModal')?.classList.add('show');
            } catch (error) {
                if (errorBox) errorBox.textContent = error.message || 'Unable to void order. Please try again.';
            } finally {
                button.disabled = false;
            }
        };
    },

    markRefunded(orderId) {
        if (this.refundSubmitting) return;
        const order = this.controller?.state?.orders.find(o => o.id === orderId);
        if (!order || order.payment_status !== 'paid' || !(Number(order.refund_due_amount) > 0)
            || !Array.isArray(order.items) || !order.items.some(window.OrderAvailability.isUnavailable)) return;
        const modal = document.getElementById('confirmRefundModal');
        const amount = document.getElementById('confirmRefundAmount');
        if (!modal || !amount) return;
        this.pendingRefundAction = {
            order_id: order.id, refund_amount: Number(order.refund_due_amount),
            expected_refunded_amount: Number(order.refunded_amount) || 0
        };
        amount.textContent = '₱' + this.pendingRefundAction.refund_amount.toLocaleString('en-PH', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
        modal.classList.add('show');
    },

    async executeMarkRefunded() {
        if (!this.pendingRefundAction || this.refundSubmitting) return false;
        this.refundSubmitting = true;
        const buttons = ['confirmRefundBtn', 'cancelRefundBtn', 'closeRefundModal']
            .map(id => document.getElementById(id)).filter(Boolean);
        buttons.forEach(button => { button.disabled = true; });
        const confirmButton = document.getElementById('confirmRefundBtn');
        if (confirmButton) confirmButton.textContent = 'Recording…';
        try {
            const result = await window.OrdersMarkRefunded.markRefunded(this.pendingRefundAction);
            if (!result.success) {
                alert(result.error || 'Unable to record refund.');
                return false;
            }
            const orderId = this.pendingRefundAction.order_id;
            const existing = this.controller?.state?.orders.find(o => o.id === orderId);
            if (existing) Object.assign(existing, result.order);
            this.controller?.renderOrders();
            this.controller?.viewOrder(orderId);
            return true;
        } catch (error) {
            console.error('Error recording refund:', error);
            alert('Unable to record refund. Please try again.');
            return false;
        } finally {
            this.refundSubmitting = false;
            buttons.forEach(button => { button.disabled = false; });
            if (confirmButton) confirmButton.textContent = 'Yes, Mark Refunded';
        }
    },

    verifyPayment(orderId, paymentStatus) {
        this.pendingPaymentAction = { orderId, paymentStatus };
        const reasonInput = document.getElementById('markUnpaidReason');
        if (reasonInput) {
            reasonInput.value = '';
            reasonInput.required = paymentStatus === 'rejected';
        }
        const reasonGroup = document.getElementById('paymentRejectionReasonGroup');
        if (reasonGroup) reasonGroup.hidden = paymentStatus !== 'rejected';

        if (paymentStatus === 'paid') {
            const modal = document.getElementById('confirmVerifyPaymentModal');
            if (modal) modal.classList.add('show');
            else alert('Payment confirmation dialog is unavailable.');
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

            if (modal) modal.classList.add('show');
            else alert('Payment confirmation dialog is unavailable.');
        }
    },

    async executeVerifyPayment(orderId, paymentStatus, reason) {
        try {
            const result = await window.OrdersUpdatePaymentStatus.update({
                order_id: orderId,
                payment_status: paymentStatus,
                reason
            });
            if (result.success) {
                const existing = this.controller?.state?.orders.find(o => o.id === orderId);
                if (existing) {
                    Object.assign(existing, result.order);
                }
                this.controller?.renderOrders();
                this.controller?.viewOrder(orderId);
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
};

window.OrdersModals = OrdersModals;
