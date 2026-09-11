// Forgot Password Flow
let currentUsername = '';
let currentUserId = null;
let currentTokenId = null;

// DOM Elements
const stepRequest = document.getElementById('stepRequest');
const stepVerify = document.getElementById('stepVerify');
const stepReset = document.getElementById('stepReset');
const stepSuccess = document.getElementById('stepSuccess');

const requestOtpForm = document.getElementById('requestOtpForm');
const verifyOtpForm = document.getElementById('verifyOtpForm');
const resetPasswordForm = document.getElementById('resetPasswordForm');

const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const successMessage = document.getElementById('successMessage');
const successText = document.getElementById('successText');
const verifyErrorMessage = document.getElementById('verifyErrorMessage');
const verifyErrorText = document.getElementById('verifyErrorText');
const resetErrorMessage = document.getElementById('resetErrorMessage');
const resetErrorText = document.getElementById('resetErrorText');

// Step 1: Request OTP
requestOtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAllMessages();

  const username = document.getElementById('username').value.trim();
  if (!username) {
    showError('Please enter your username');
    return;
  }

  const btn = document.getElementById('requestOtpBtn');
  setLoading(btn, true);

  try {
    const response = await fetch('/api/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showError(data.error || 'Failed to send OTP. Please try again.');
      return;
    }

    // Store username for next steps
    currentUsername = username;

    // Show success message
    showSuccess(data.message || 'OTP has been sent to your email address.');

    // Move to verify step after a short delay
    setTimeout(() => {
      stepRequest.style.display = 'none';
      stepVerify.style.display = 'block';
      document.getElementById('otp').focus();
    }, 1500);
  } catch (error) {
    console.error('Request OTP error:', error);
    showError('An error occurred. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// Step 2: Verify OTP
verifyOtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideVerifyError();

  const otp = document.getElementById('otp').value.trim();
  if (!otp || otp.length !== 6) {
    showVerifyError('Please enter a valid 6-digit OTP code');
    return;
  }

  const btn = document.getElementById('verifyOtpBtn');
  setLoading(btn, true);

  try {
    const response = await fetch('/api/password-reset/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: currentUsername,
        otp: otp
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showVerifyError(data.error || 'Invalid or expired OTP code');
      return;
    }

    // Store user ID and token for password reset
    currentUserId = data.user_id;
    currentTokenId = data.token_id;

    // Move to reset password step
    stepVerify.style.display = 'none';
    stepReset.style.display = 'block';
    document.getElementById('newPassword').focus();
  } catch (error) {
    console.error('Verify OTP error:', error);
    showVerifyError('An error occurred. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// Step 3: Reset Password
resetPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideResetError();

  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword.length < 6) {
    showResetError('Password must be at least 6 characters long');
    return;
  }

  if (newPassword !== confirmPassword) {
    showResetError('Passwords do not match');
    return;
  }

  const btn = document.getElementById('resetPasswordBtn');
  setLoading(btn, true);

  try {
    const response = await fetch('/api/password-reset/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUserId,
        new_password: newPassword
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showResetError(data.error || 'Failed to reset password');
      return;
    }

    // Show success step
    stepReset.style.display = 'none';
    stepSuccess.style.display = 'block';
  } catch (error) {
    console.error('Reset password error:', error);
    showResetError('An error occurred. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// Resend OTP
document.getElementById('resendOtpLink')?.addEventListener('click', async (e) => {
  e.preventDefault();
  
  if (!currentUsername) {
    // Go back to request step
    stepVerify.style.display = 'none';
    stepRequest.style.display = 'block';
    return;
  }

  const btn = document.getElementById('requestOtpBtn');
  setLoading(btn, true);
  hideVerifyError();

  try {
    const response = await fetch('/api/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: currentUsername })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showVerifyError('OTP has been resent to your email address.', 'success');
    } else {
      showVerifyError(data.error || 'Failed to resend OTP');
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    showVerifyError('An error occurred. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// Helper Functions
function showError(message) {
  errorText.textContent = message;
  errorMessage.style.display = 'flex';
}

function showSuccess(message) {
  successText.textContent = message;
  successMessage.style.display = 'flex';
  errorMessage.style.display = 'none';
}

function hideAllMessages() {
  errorMessage.style.display = 'none';
  successMessage.style.display = 'none';
}

function showVerifyError(message, type = 'error') {
  verifyErrorText.textContent = message;
  verifyErrorMessage.className = type === 'success' ? 'alert alert-success' : 'alert alert-error';
  verifyErrorMessage.style.display = 'flex';
}

function hideVerifyError() {
  verifyErrorMessage.style.display = 'none';
}

function showResetError(message) {
  resetErrorText.textContent = message;
  resetErrorMessage.style.display = 'flex';
}

function hideResetError() {
  resetErrorMessage.style.display = 'none';
}

function setLoading(button, isLoading) {
  if (!button) return;
  const btnText = button.querySelector('.btn-text');
  const spinner = button.querySelector('.spinner');
  
  if (isLoading) {
    button.disabled = true;
    button.classList.add('loading');
    if (btnText) btnText.style.opacity = '0';
    if (spinner) spinner.style.display = 'block';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    if (btnText) btnText.style.opacity = '1';
    if (spinner) spinner.style.display = 'none';
  }
}

// Auto-format OTP input (numbers only)
document.getElementById('otp')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

// Check for error in URL params
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');
if (error) {
  showError(decodeURIComponent(error));
}
