// Consolidated QR Code Scanner Logic for Sales POS
const SalesQR = {
    scanner: null,
    scanning: false,

    async start(state) {
        if (this.scanning) return;

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
                    this.handleDecoded(decodedText, state);
                },
                (errorMessage) => {
                    // ignore scan errors, they happen frequently while searching
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
        } catch (_) {
            // ignore errors during stop
        } finally {
            this.scanner = null;
            this.scanning = false;
        }
    },

    handleDecoded(decodedText, state) {
        if (!decodedText || !state) return;

        // Stop scanning immediately
        this.stop();

        // Close modal
        const qrModal = document.getElementById('qrModal');
        if (qrModal) {
            qrModal.classList.remove('show');
        }

        // Process Code
        const code = this.extractProductCode(decodedText);
        const product = this.findProductByCode(state.products, code);

        if (!product) {
            alert('No matching product found for this QR code.');
            return;
        }

        // Add to cart
        SalesCart.addToCart(state, product, 1);

        // Optional: Feedback
        // alert(`Added 1 "${product.name}" to the cart.`); 
        // Or maybe a toast notification would be better in the future
    },

    // --- Utilities ---

    normalizeText(value) {
        return String(value || '').trim();
    },

    extractProductCode(decodedText) {
        const raw = this.normalizeText(decodedText);
        if (!raw) return '';

        const upper = raw.toUpperCase();

        // If the QR contains our code directly
        if (upper.startsWith('TVS-')) return upper;

        // If the QR contains a URL
        try {
            const url = new URL(raw);
            const candidates = [
                url.searchParams.get('url'),
                url.searchParams.get('code'),
                url.searchParams.get('qr'),
                url.searchParams.get('product'),
                url.searchParams.get('productCode'),
            ].filter(Boolean);

            for (const c of candidates) {
                const v = String(c).trim().toUpperCase();
                if (v.startsWith('TVS-')) return v;
                const m = v.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
                if (m) return m[0];
            }

            // Check full path/string if param not found
            const m = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
            if (m) return m[0];

        } catch (_) {
            // Not a URL
        }

        // RegEx fallback on the raw string
        const match = upper.match(/TVS-[A-Z0-9]+-[A-Z0-9]+/);
        if (match) return match[0];

        return upper;
    },

    findProductByCode(products, code) {
        const normalizedCode = this.normalizeText(code).toUpperCase();
        if (!normalizedCode) return null;
        const list = Array.isArray(products) ? products : [];

        // 1. Try direct matches on potential code fields
        let item = list.find(p =>
            String(p?.product_code || '').toUpperCase() === normalizedCode ||
            String(p?.code || '').toUpperCase() === normalizedCode ||
            String(p?.qr_code || '').toUpperCase() === normalizedCode
        );
        if (item) return item;

        // 2. Fallback: match generated TVS code format to Product Name
        const match = normalizedCode.match(/^TVS-([A-Z0-9]+)-/);
        if (match) {
            const safeName = match[1];
            item = list.find(p => {
                if (!p?.name) return false;
                // Re-create the safe name logic used in generation
                const normalized = String(p.name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                return normalized === safeName;
            });
        }

        return item || null;
    }
};
