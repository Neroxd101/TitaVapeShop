/**
 * Settings Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Initialize sidebar/header
    if (typeof initSidebar === 'function') initSidebar('settings');
    if (window.HeaderStatus && HeaderStatus.init) HeaderStatus.init();

    // Elements
    const googleStatusContainer = document.getElementById('googleStatusContainer');
    const googleActionContainer = document.getElementById('googleActionContainer');

    // Initial Render
    renderGoogleSettings();

    // Listen for storage changes (external updates)
    window.addEventListener('storage', (e) => {
        if (e.key === 'google_connected' || e.key === 'google_user') {
            renderGoogleSettings();
        }
    });

    // Listen for messages from popup
    window.addEventListener('message', (e) => {
        if (e.data.type === 'GOOGLE_AUTH_SUCCESS') {
            renderGoogleSettings();
        } else if (e.data.type === 'GOOGLE_AUTH_ERROR') {
            alert('Google Auth failed: ' + (e.data.error || 'Unknown error'));
            // Reset UI in case popup closed without clearing interval logic cleanly (though interval handles simple close)
            const btn = document.getElementById('connectBtn');
            if (btn) {
                btn.disabled = false;
                // Ideally restore original text, but simplified here:
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.38 0 8.79-3.96 8.79-8.79 0-.9 0-.82-.05-1.98z"/></svg>
                    Connect with Google
                `;
            }
        }
    });

    /**
     * Render Google Integration Status
     */
    function renderGoogleSettings() {
        const isConnected = localStorage.getItem('google_connected') === 'true';
        const user = getGoogleUser();

        if (isConnected && user) {
            // Connected State
            googleStatusContainer.innerHTML = `
                <div class="user-info">
                    <img src="${user.picture}" alt="Avatar" class="user-avatar-large">
                    <div class="user-details">
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                        <span class="status-badge connected">Connected</span>
                    </div>
                </div>
            `;

            googleActionContainer.innerHTML = `
                <button id="disconnectBtn" class="btn btn-disconnect btn-full">
                    Disconnect Account
                </button>
            `;

            document.getElementById('disconnectBtn').addEventListener('click', handleDisconnect);

        } else {
            // Disconnected State
            googleStatusContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary);">
                    <p>Not connected</p>
                    <span class="status-badge disconnected">Offline</span>
                </div>
            `;

            googleActionContainer.innerHTML = `
                 <button id="connectBtn" class="btn btn-connect btn-full">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.38 0 8.79-3.96 8.79-8.79 0-.9 0-.82-.05-1.98z"/></svg>
                    Connect with Google
                </button>
            `;

            document.getElementById('connectBtn').addEventListener('click', handleConnect);
        }
    }

    /**
     * Handle Disconnect Action
     */
    async function handleDisconnect() {
        if (!confirm('Are you sure you want to disconnect? Backups will stop working.')) return;

        const btn = document.getElementById('disconnectBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Disconnecting...';

        try {
            const token = localStorage.getItem('google_access_token');
            if (token) {
                await fetch('/auth/google/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
        } finally {
            // Clear storage
            localStorage.removeItem('google_connected');
            localStorage.removeItem('google_user');
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_refresh_token');
            localStorage.removeItem('google_expires_at');

            // Notify other tabs
            window.dispatchEvent(new Event('storage'));

            // Re-render
            renderGoogleSettings();
        }
    }

    /**
     * Handle Connect Action
     */
    async function handleConnect() {
        const btn = document.getElementById('connectBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div> Connecting...'; // Ensure you have css for spinner-small or reuse existing

        try {
            const response = await fetch('/auth/google');
            const data = await response.json();

            if (data.success && data.authUrl) {
                // Open in popup
                const width = 500;
                const height = 600;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                const popup = window.open(
                    data.authUrl,
                    'GoogleAuth',
                    `width=${width},height=${height},top=${top},left=${left}`
                );

                // Poll for popup closure (as a backup if message/storage fails)
                const checkPopup = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        // If closed but not connected, reset state
                        if (localStorage.getItem('google_connected') !== 'true') {
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                        }
                    }
                }, 1000);

            } else {
                alert('Failed to initialize Google Auth');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Auth init error:', error);
            alert('Error initializing Google Auth');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    /**
     * Helper to get user from storage
     */
    function getGoogleUser() {
        try {
            return JSON.parse(localStorage.getItem('google_user'));
        } catch {
            return null;
        }
    }
});
