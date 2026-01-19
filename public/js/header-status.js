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

    if (!isGoogleConnected()) {
      googleStatusEl.innerHTML = '';
      return;
    }

    const user = getGoogleUser();
    if (user?.picture && user?.email) {
      googleStatusEl.innerHTML = `
        <div class="google-connected">
          <img src="${user.picture}" alt="${user.name || 'Google user'}" class="google-avatar">
          <span>${user.email}</span>
          <span class="google-badge">Connected</span>
        </div>
      `;
      return;
    }

    googleStatusEl.innerHTML = `
      <div class="google-connected">
        <span>Google</span>
        <span class="google-badge">Connected</span>
      </div>
    `;
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

