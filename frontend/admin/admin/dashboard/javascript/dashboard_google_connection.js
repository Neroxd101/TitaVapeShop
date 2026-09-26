// Google Drive connection controls and status for the dashboard.
const DashboardGoogleConnection = {
    isConnected() {
        return localStorage.getItem('google_connected') === 'true';
    },

    showModal() {
        document.getElementById('googleConnectModal')?.classList.add('show');
    },

    closeModal() {
        document.getElementById('googleConnectModal')?.classList.remove('show');
    },

    connect() {
        window.location.href = '/settings';
    },

    init(user) {
        document.getElementById('googleConnectBtn')?.addEventListener('click', () => this.connect());
        document.getElementById('skipGoogleBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('closeGoogleModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('manageGoogleBtn')?.addEventListener('click', () => this.connect());

        const modal = document.getElementById('googleConnectModal');
        modal?.addEventListener('click', event => {
            if (event.target === modal) this.closeModal();
        });

        if ((user?.roles || []).includes('admin') && !this.isConnected()) {
            setTimeout(() => this.showModal(), 500);
        }
    },

    updateStatus() {
        const description = document.getElementById('googleStatusDesc');
        if (!description) return;

        if (this.isConnected()) {
            description.textContent = 'Connected · Product photos synced with Google Drive';
            description.style.color = 'var(--dash-emerald)';
        } else {
            description.textContent = 'Not connected · Connect to enable cloud image storage';
            description.style.color = 'var(--dash-text-dim)';
        }
    }
};
