// Reusable header widgets: Google status + date/time
// Requires elements: #googleStatus, #currentDate (optional).
// Uses dashboard.css styles: .google-connected, .google-avatar, .google-badge, .current-date

(function () {
  function isGoogleConnected() {
    return localStorage.getItem('google_connected') === 'true';
  }

  function getGoogleUser() {
    const raw = localStorage.getItem('google_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function formatDateTime(date) {
    // Show date + time (PH locale)
    return new Date(date).toLocaleString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderGoogleStatus(googleStatusEl) {
    if (!googleStatusEl) return;

    // Only admins should see Google connection status
    const rawUser = localStorage.getItem('user');
    let isAdmin = false;
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        isAdmin = (user.roles || []).includes('admin');
      } catch (e) {
        console.error('Error parsing user data for header status:', e);
      }
    }

    if (!isAdmin || !isGoogleConnected()) {
      googleStatusEl.innerHTML = '';
      return;
    }

    const user = getGoogleUser();

    let content = '';

    if (user?.picture && user?.email) {
      content = `
          <img src="${user.picture}" alt="${user.name || 'Google user'}" class="google-avatar">
          <span>${user.email}</span>
          <span class="google-badge">Connected</span>
      `;
    } else {
      content = `
          <span>Google</span>
          <span class="google-badge">Connected</span>
      `;
    }

    // Add Disconnect Button
    content += `
      <button class="google-disconnect-btn" aria-label="Disconnect Google Account" title="Disconnect">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    `;

    googleStatusEl.innerHTML = `<div class="google-connected">${content}</div>`;

    // Bind click event for disconnect
    const btn = googleStatusEl.querySelector('.google-disconnect-btn');
    if (btn) {
      btn.addEventListener('click', handleDisconnect);
    }
  }

  async function handleDisconnect(e) {
    if (e) e.preventDefault();
    if (!confirm('Are you sure you want to disconnect your Google account?')) return;

    try {
      const accessToken = localStorage.getItem('google_access_token');

      // Call backend to revoke (best effort)
      if (accessToken) {
        await fetch('/auth/google/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: accessToken })
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      // Clear local storage regardless of backend success
      localStorage.removeItem('google_connected');
      localStorage.removeItem('google_user');
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_refresh_token');
      localStorage.removeItem('google_expires_at');

      // Force UI update
      window.dispatchEvent(new Event('storage'));
      // Reload page to reflect changes cleanly
      window.location.reload();
    }
  }

  function renderDateTime(currentDateEl) {
    if (!currentDateEl) return;
    currentDateEl.textContent = formatDateTime(new Date());
  }

  function init({ googleStatusId = 'googleStatus', currentDateId = 'currentDate' } = {}) {
    const googleStatusEl = document.getElementById(googleStatusId);
    const currentDateEl = document.getElementById(currentDateId);

    renderGoogleStatus(googleStatusEl);
    renderDateTime(currentDateEl);

    // Keep the time fresh (minute-level)
    const timer = setInterval(() => renderDateTime(currentDateEl), 30_000);

    // Update Google UI if localStorage changes (cross-tab)
    const onStorage = (e) => {
      if (!e || (e.key !== 'google_connected' && e.key !== 'google_user')) return;
      renderGoogleStatus(googleStatusEl);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }

  window.HeaderStatus = { init };
})();

