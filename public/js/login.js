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

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store the session
    if (data.session) {
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    // Redirect to dashboard
    window.location.href = '/dashboard';

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
