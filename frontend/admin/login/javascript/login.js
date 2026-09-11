/**
 * Admin & Staff Login Client Script
 * Determines user role (admin vs staff) and redirects accordingly
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const showing = passwordInput.type === 'password';
      passwordInput.type = showing ? 'text' : 'password';
      togglePassword.classList.toggle('is-visible', showing);
      togglePassword.setAttribute('aria-pressed', showing ? 'true' : 'false');
      togglePassword.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    });
  }

  function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.classList.add('show');
  }

  function hideError() {
    if (errorMessage) errorMessage.classList.remove('show');
  }

  function setLoading(loading) {
    if (!loginBtn) return;
    if (loading) {
      loginBtn.classList.add('loading');
      loginBtn.disabled = true;
    } else {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const usernameInput = document.getElementById('username');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        showError('Please fill in all fields');
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(form.action || '/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        // Cache user info in localStorage
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        // Determine user role: redirect staff to sales/pos, admin to dashboard
        const roles = data.user?.roles || '';
        const roleList = Array.isArray(roles) ? roles : String(roles).split(',').map(r => r.trim());

        if (roleList.includes('staff')) {
          window.location.href = '/staff/pos';
        } else {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        showError(error.message || 'An error occurred during login');
      } finally {
        setLoading(false);
      }
    });
  }

  // Clear error on input
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', hideError);
  });

  // Check for error in query string
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  if (error) {
    showError(decodeURIComponent(error));
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
