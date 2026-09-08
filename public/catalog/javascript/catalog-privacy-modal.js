/**
 * Catalog Data Privacy Consent Modal
 * Handles privacy consent modal display and interactions
 */

const CatalogPrivacyModal = {
    modal: null,
    checkbox: null,
    acceptBtn: null,
    declineBtn: null,

    /**
     * Initialize the privacy modal
     */
    async init() {
        const container = document.getElementById('privacy-modal-container');
        if (!container) {
            console.error('[Privacy Modal] Container not found');
            return false;
        }

        try {
            const response = await fetch('/catalog/catalog-privacy-modal.html');
            if (!response.ok) {
                console.error('[Privacy Modal] Failed to load modal HTML:', response.status);
                return false;
            }
            
            container.innerHTML = await response.text();
            
            // Get modal references
            this.modal = document.getElementById('privacyConsentModal');
            this.checkbox = document.getElementById('privacyConsentCheckbox');
            this.acceptBtn = document.getElementById('acceptPrivacyBtn');
            this.declineBtn = document.getElementById('declinePrivacyBtn');

            if (!this.modal) {
                console.error('[Privacy Modal] Modal element not found');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('[Privacy Modal] Error loading modal:', error);
            return false;
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.getElementById('privacyDeclinedModal').addEventListener('close', () => {
            document.getElementById('cartBtn')?.focus();
        });
        if (this.checkbox) {
            this.checkbox.addEventListener('change', (e) => {
                if (this.acceptBtn) {
                    this.acceptBtn.disabled = !e.target.checked;
                }
            });
        }

        if (this.acceptBtn) {
            this.acceptBtn.addEventListener('click', () => {
                if (this.checkbox && this.checkbox.checked) {
                    this.close();
                    if (window.CatalogCheckoutModal) {
                        window.CatalogCheckoutModal.show();
                    }
                }
            });
        }

        if (this.declineBtn) {
            this.declineBtn.addEventListener('click', () => {
                this.close();
                document.getElementById('privacyDeclinedModal').showModal();
            });
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
     * Show the privacy modal
     */
    show() {
        if (!this.modal) {
            console.error('[Privacy Modal] Modal not initialized');
            return;
        }

        // Reset checkbox
        if (this.checkbox) {
            this.checkbox.checked = false;
        }
        if (this.acceptBtn) {
            this.acceptBtn.disabled = true;
        }

        this.modal.classList.add('show');
    },

    /**
     * Close the privacy modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
        }
    }
};

// Expose globally
window.CatalogPrivacyModal = CatalogPrivacyModal;
