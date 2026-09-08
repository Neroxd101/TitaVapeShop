/**
 * Catalog 18+ Age Verification Modal
 * Enforces RA 11900 compliance with one-time localStorage check
 */

const CatalogAgeModal = {
    STORAGE_KEY: 'tita_age_verified',
    overlayEl: null,
    cardEl: null,

    /**
     * Check verification state immediately
     */
    isVerified() {
        try {
            return localStorage.getItem(this.STORAGE_KEY) === 'true';
        } catch (e) {
            console.warn('[Age Verification] LocalStorage unavailable:', e);
            return false;
        }
    },

    /**
     * Initialize the Age Verification Gate
     */
    init() {
        this.overlayEl = document.getElementById('ageGateOverlay');
        this.cardEl = document.getElementById('ageGateCard');

        if (!this.overlayEl) return;

        // One-time check
        if (this.isVerified()) {
            this.overlayEl.style.display = 'none';
            document.body.classList.remove('age-gate-locked');
            return;
        }

        // Lock page and display modal
        document.body.classList.add('age-gate-locked');
        this.overlayEl.style.display = 'flex';
        // Force reflow for smooth opacity transition
        void this.overlayEl.offsetWidth;
        this.overlayEl.classList.add('active');

        this.bindEvents();
    },

    /**
     * Setup button and keyboard events
     */
    bindEvents() {
        const verifyBtn = document.getElementById('btnAgeVerify');
        const declineBtn = document.getElementById('btnAgeDecline');
        const retryBtn = document.getElementById('btnAgeRetry');

        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.handleVerify());
        }

        if (declineBtn) {
            declineBtn.addEventListener('click', () => this.handleDecline());
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.handleRetry());
        }

        // Block Escape key while locked
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.isVerified()) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    },

    /**
     * Handle user confirming they are 18+
     */
    handleVerify() {
        try {
            localStorage.setItem(this.STORAGE_KEY, 'true');
        } catch (e) {
            console.warn('[Age Verification] Unable to save to localStorage:', e);
        }

        if (this.overlayEl) {
            this.overlayEl.classList.add('fade-out');
            setTimeout(() => {
                this.overlayEl.classList.remove('active', 'fade-out');
                this.overlayEl.style.display = 'none';
                document.body.classList.remove('age-gate-locked');
            }, 300);
        } else {
            document.body.classList.remove('age-gate-locked');
        }
    },

    /**
     * Handle user indicating they are under 18
     */
    handleDecline() {
        if (this.cardEl) {
            this.cardEl.classList.add('is-declined');
        }
    },

    /**
     * Return to verification screen if user clicked decline by mistake
     */
    handleRetry() {
        if (this.cardEl) {
            this.cardEl.classList.remove('is-declined');
        }
    }
};

// Auto-run verification check immediately upon DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CatalogAgeModal.init());
} else {
    CatalogAgeModal.init();
}

window.CatalogAgeModal = CatalogAgeModal;
