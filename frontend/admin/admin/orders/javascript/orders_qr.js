// Dedicated QR Scanner Module for Orders Page Verification
const OrdersQR = {
    scanner: null,
    scanning: false,
    scanningOrderId: null,

    init(controller) {
        this.controller = controller;
        this.setupEventListeners();
    },

    setupEventListeners() {
        const qrScannerModal = document.getElementById('qrScannerModal');
        const closeQrScannerModal = document.getElementById('closeQrScannerModal');

        closeQrScannerModal?.addEventListener('click', async () => {
            await this.stop();
            this.scanningOrderId = null;
            qrScannerModal?.classList.remove('show');
        });

        qrScannerModal?.addEventListener('click', async (e) => {
            if (e.target === qrScannerModal) {
                await this.stop();
                this.scanningOrderId = null;
                qrScannerModal?.classList.remove('show');
            }
        });
    },

    scanCustomerQR(orderId) {
        this.scanningOrderId = orderId;
        const qrModal = document.getElementById('qrScannerModal');
        if (qrModal) {
            qrModal.classList.add('show');
            this.start();
        }
    },

    async start() {
        if (this.scanner && this.scanning) return;

        if (typeof Html5Qrcode === 'undefined') {
            alert('QR scanner library not loaded. Please check your internet connection.');
            return;
        }

        try {
            this.scanner = new Html5Qrcode('qrScanner');
            await this.scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: 250 },
                (decodedText) => {
                    this.handleScanned(decodedText);
                },
                () => {
                    // Ignore transient scan errors while hunting
                }
            );
            this.scanning = true;
        } catch (err) {
            console.error('Error starting QR scanner:', err);
            alert('Unable to access camera for QR scanning.');
            await this.stop();
        }
    },

    async stop() {
        if (!this.scanner || !this.scanning) return;

        try {
            await this.scanner.stop();
            await this.scanner.clear();
        } catch (err) {
            console.error('Error stopping QR scanner:', err);
        } finally {
            this.scanner = null;
            this.scanning = false;
        }
    },

    async handleScanned(decodedText) {
        if (!decodedText || !this.scanningOrderId) return;

        await this.stop();

        const qrModal = document.getElementById('qrScannerModal');
        if (qrModal) {
            qrModal.classList.remove('show');
        }

        const scannedOrderId = decodedText.trim();
        if (scannedOrderId === this.scanningOrderId) {
            // QR code matches - trigger completion
            if (window.OrdersModals?.completeOrder) {
                OrdersModals.completeOrder(this.scanningOrderId);
            } else if (this.controller?.completeOrder) {
                this.controller.completeOrder(this.scanningOrderId);
            }
        } else {
            alert('QR code does not match this order. Please scan the correct QR code.');
            this.scanningOrderId = null;
        }
    }
};

window.OrdersQR = OrdersQR;
