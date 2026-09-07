/**
 * Catalog Order Success Modal
 * Handles order success modal display with QR code generation
 */

const CatalogOrderSuccessModal = {
    modal: null,
    closeButton: null,

    /**
     * Initialize the order success modal
     */
    async init() {
        const container = document.getElementById('order-success-modal-container');
        if (!container) {
            console.error('[Order Success Modal] Container not found');
            return false;
        }

        try {
            const response = await fetch('/catalog/catalog-order-success-modal.html');
            if (!response.ok) {
                console.error('[Order Success Modal] Failed to load modal HTML:', response.status);
                return false;
            }
            
            container.innerHTML = await response.text();
            
            // Get modal references
            this.modal = document.getElementById('orderSuccessModal');
            this.closeButton = document.getElementById('closeOrderSuccessBtn');

            if (!this.modal) {
                console.error('[Order Success Modal] Modal element not found');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('[Order Success Modal] Error loading modal:', error);
            return false;
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }
    },

    /**
     * Save QR code as image
     */
    saveQRCode(orderId) {
        const qrCodeContainer = document.getElementById('orderQrCodeDisplay');
        if (!qrCodeContainer) {
            alert('QR code not found');
            return;
        }

        // Find the canvas element (QRCode library creates a canvas)
        const canvas = qrCodeContainer.querySelector('canvas');
        if (!canvas) {
            // Try to find img element if canvas is not available
            const img = qrCodeContainer.querySelector('img');
            if (img) {
                // Create a link to download the image
                const link = document.createElement('a');
                link.download = `QRCode_${orderId}.png`;
                link.href = img.src;
                link.click();
                return;
            }
            alert('QR code image not found');
            return;
        }

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('Failed to generate QR code image');
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `QRCode_${orderId}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
    },

    /**
     * Show the order success modal
     */
    show(order, orderToken, trackingUrl) {
        if (!this.modal) {
            console.error('[Order Success Modal] Modal not initialized');
            alert('Order created successfully!');
            return;
        }

        // Handle case where order might be an array (from RPC)
        if (Array.isArray(order) && order.length > 0) {
            order = order[0];
        }

        if (!order || !order.id) {
            console.error('Invalid order data:', order);
            // Still show modal with generic message
            const orderIdDisplay = document.getElementById('orderIdDisplay');
            const orderTotalDisplay = document.getElementById('orderTotalDisplay');
            if (orderIdDisplay) orderIdDisplay.textContent = 'N/A';
            if (orderTotalDisplay) orderTotalDisplay.textContent = 'N/A';
            this.modal.classList.add('show');
            return;
        }

        // Display order info
        const orderIdDisplay = document.getElementById('orderIdDisplay');
        const orderTypeDisplay = document.getElementById('orderTypeDisplay');
        const orderTotalDisplay = document.getElementById('orderTotalDisplay');
        const qrCodeContainer = document.getElementById('orderQrCodeDisplay');
        const qrCodeSection = document.getElementById('qrCodeSection');
        const successMessage = document.getElementById('orderSuccessMessage');
        const saveQrCodeBtn = document.getElementById('saveQrCodeBtn');

        if (orderIdDisplay) {
            orderIdDisplay.textContent = order.id;
        }

        if (orderTypeDisplay) {
            const typeLabel = order.order_type === 'pickup' ? 'Pickup' : 'Delivery (3rd Party)';
            orderTypeDisplay.textContent = typeLabel;
        }

        if (orderTotalDisplay) {
            orderTotalDisplay.textContent = `₱${parseFloat(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }

        // Only generate QR code for pickup orders
        if (order.order_type === 'pickup') {
            if (successMessage) {
                successMessage.textContent = 'Your order has been created. Please show this QR code to the admin when picking up.';
            }
            if (qrCodeSection) {
                qrCodeSection.style.display = 'block';
            }
            if (qrCodeContainer && typeof QRCode !== 'undefined') {
                qrCodeContainer.innerHTML = '';
                try {
                    new QRCode(qrCodeContainer, {
                        text: order.id,
                        width: 256,
                        height: 256,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    
                    // Show save button after QR code is generated
                    if (saveQrCodeBtn) {
                        setTimeout(() => {
                            saveQrCodeBtn.style.display = 'flex';
                            saveQrCodeBtn.onclick = () => this.saveQRCode(order.id);
                        }, 100);
                    }
                } catch (error) {
                    console.error('Error generating QR code:', error);
                    qrCodeContainer.innerHTML = '<p>QR code generation failed</p>';
                    if (saveQrCodeBtn) {
                        saveQrCodeBtn.style.display = 'none';
                    }
                }
            }
        } else {
            // Delivery order - no QR code
            if (successMessage) {
                successMessage.textContent = 'Your delivery order has been created. We will contact you soon through your provided social media or contact number!';
            }
            if (qrCodeSection) {
                qrCodeSection.style.display = 'none';
            }
            if (qrCodeContainer) {
                qrCodeContainer.innerHTML = '';
            }
            if (saveQrCodeBtn) {
                saveQrCodeBtn.style.display = 'none';
            }
        // Show the modal
        const viewDetailsBtn = document.getElementById('viewLiveOrderDetailsBtn');
        if (viewDetailsBtn) {
            const targetUrl = trackingUrl || (orderToken ? `/order-status?token=${encodeURIComponent(orderToken)}` : `/order-status?id=${encodeURIComponent(order.id)}`);
            viewDetailsBtn.href = targetUrl;
        }

        this.modal.classList.add('show');
    },

    /**
     * Close the order success modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }
};

// Expose globally
window.CatalogOrderSuccessModal = CatalogOrderSuccessModal;
