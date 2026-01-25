const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.add('show');
}

function hideError() {
  errorMessage.classList.remove('show');
}

function setLoading(loading) {
  if (loading) {
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
  } else {
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('Please fill in all fields');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(form.action, {
      method: form.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Success! Redirect to dashboard (or special role-based path)
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    // Role-based redirection logic
    const roles = data.user.roles || [];
    if (roles.includes('staff')) {
      window.location.href = '/sales';
    } else {
      window.location.href = '/dashboard';
    }

  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

// Clear error on input
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('input', hideError);
});

// Check for error in URL
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  if (error) {
    showError(decodeURIComponent(error));
    // Clean up URL without reload
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
