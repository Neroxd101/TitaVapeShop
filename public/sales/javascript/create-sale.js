// Logic for Sales Checkout (Transaction)
const SalesCreate = {

    async handleCompleteSale(e, state) {
        if (e) e.preventDefault();

        // Handle case where state is passed as first arg (fallback)
        if (!state && e && e.cart) {
            state = e;
            e = null;
        }

        if (!state || !state.cart.length) {
            alert('Add items to the cart first.');
            return;
        }

        const total = state.cart.reduce((sum, item) => sum + item.qty * item.price, 0);
        const cashInput = document.getElementById('cashInput');

        // Find form or button to get route
        const form = document.getElementById('checkoutForm');
        const checkoutUrl = form?.dataset.apiRouteCheckout || '/api/sales/checkout';
        const receiptUrl = form?.dataset.apiRouteReceipt || '/api/email/send-receipt';

        const cash = parseFloat(cashInput?.value || '0') || 0;

        if (cash < total) {
            alert('Cash is not enough to complete the sale.');
            return;
        }

        const customerName = document.getElementById('customerName')?.value || 'Walk-in';
        const customerEmail = document.getElementById('customerEmail')?.value?.trim();
        const change = cash - total;

        // Show confirmation
        const confirmMsg = `Complete sale for ${customerName}?\nTotal: ${SalesCart.formatCurrencySafe(total)}`;
        if (!confirm(confirmMsg)) {
            return;
        }

        // 1. Deduct Inventory (Checkout)
        try {
            const checkoutResponse = await fetch(checkoutUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: state.cart })
            });

            const checkoutResult = await checkoutResponse.json();

            if (!checkoutResult.success) {
                console.error('Checkout failed:', checkoutResult);
                let errorMsg = 'Failed to process sale (Inventory Error).\n';
                if (checkoutResult.errors) {
                    errorMsg += checkoutResult.errors.map(e => `- ${e.name}: ${e.error}`).join('\n');
                } else {
                    errorMsg += checkoutResult.message || 'Unknown error';
                }
                alert(errorMsg);
                return; // Stop processing
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Failed to process sale due to network or server error.');
            return;
        }

        // 2. Send email receipt if email is provided
        if (customerEmail) {
            this.sendReceipt(receiptUrl, customerEmail, customerName, state.cart, total, cash, change);
        } else {
            alert(`Sale completed for ${customerName}.\nTotal: ${SalesCart.formatCurrencySafe(total)}`);
        }

        // Log transaction
        if (window.TransactionLogger) {
            TransactionLogger.logSaleComplete({
                total,
                items: state.cart,
                cash,
                change,
                customerName,
                customerEmail
            });
        }

        // Reset cart
        state.cart = [];
        if (cashInput) cashInput.value = '';
        const nameInput = document.getElementById('customerName');
        if (nameInput) nameInput.value = '';
        const emailInput = document.getElementById('customerEmail');
        if (emailInput) emailInput.value = '';

        SalesCart.updateCartUI(state);

        // Also reload products to get fresh stock counts from server since we just deducted
        await SalesLoad.loadProducts(state);
    },

    async sendReceipt(url, email, name, items, total, cash, change) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerEmail: email,
                    customerName: name,
                    items: items,
                    total,
                    cash,
                    change,
                    saleDate: new Date().toLocaleString('en-PH', {
                        timeZone: 'Asia/Manila',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Sale completed for ${name}.\nTotal: ${SalesCart.formatCurrencySafe(total)}\n\nReceipt sent to ${email}`);
            } else {
                console.error('Failed to send email:', result);
                alert(`Sale completed for ${name}.\nTotal: ${SalesCart.formatCurrencySafe(total)}\n\nNote: Failed to send email receipt.`);
            }
        } catch (error) {
            console.error('Error sending email:', error);
            alert(`Sale completed for ${name}.\nTotal: ${SalesCart.formatCurrencySafe(total)}\n\nNote: Failed to send email receipt.`);
        }
    }
};
