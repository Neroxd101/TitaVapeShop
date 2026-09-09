/**
 * Customer Authentication & Email Verification Controller
 * Handles client-side customer login, registration, OTP email verification, and session state
 */

const CustomerAuth = {
  currentUser: null,
  pendingSuccessAction: null,
  resendTimerInterval: null,
  activeEmail: '',

  /**
   * Initialize Customer Auth
   */
  async init() {
    const container = document.getElementById('customer-auth-modal-container');
    if (!container) return;

    try {
      const res = await fetch('/catalog/customer-auth-modal.html');
      if (res.ok) {
        container.innerHTML = await res.text();
        this.setupEventListeners();
      }
    } catch (err) {
      console.error('[Customer Auth] Failed to load modal HTML:', err);
    }

    // Check existing customer session
    await this.checkSession();
  },

  /**
   * Check if customer is currently logged in
   */
  async checkSession() {
    try {
      const res = await fetch('/api/customer/me', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        this.currentUser = data.user;
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      this.currentUser = null;
    }
    this.updateNavUI();
    return this.currentUser;
  },

  /**
   * Update navigation bar with Sign In button or Profile Pill
   */
  updateNavUI() {
    const container = document.getElementById('customerNavContainer');
    if (!container) return;

    if (this.currentUser) {
      const initials = (this.currentUser.full_name || this.currentUser.email || 'C')
        .trim()
        .charAt(0)
        .toUpperCase();
      const displayName = (this.currentUser.full_name || this.currentUser.email || 'Customer').split(' ')[0];

      container.innerHTML = `
        <div class="cart-button customer-profile-pill" id="customerProfileBtn" title="Account Menu">
          <div class="customer-avatar">${initials}</div>
          <span class="customer-profile-name">${this.escapeHtml(displayName)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="opacity: 0.7; flex-shrink: 0;">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          <div class="customer-dropdown-menu" id="customerDropdownMenu">
            <div class="customer-dropdown-header">
              <strong style="font-size: 13px; display: block; color: var(--text-primary);">${this.escapeHtml(this.currentUser.full_name || 'Customer')}</strong>
              <span class="customer-dropdown-email">${this.escapeHtml(this.currentUser.email)}</span>
            </div>
            <button type="button" class="customer-dropdown-item" id="navMyOrdersItem">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
              <span>My Orders</span>
            </button>
            <button type="button" class="customer-dropdown-item logout-item" id="navLogoutItem">
              <svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      `;

      const pill = document.getElementById('customerProfileBtn');
      const menu = document.getElementById('customerDropdownMenu');
      if (pill && menu) {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.toggle('show');
        });
      }

      const myOrdersItem = document.getElementById('navMyOrdersItem');
      if (myOrdersItem) {
        myOrdersItem.addEventListener('click', () => {
          if (window.CatalogOrdersModal) {
            window.CatalogOrdersModal.open();
          }
          if (menu) menu.classList.remove('show');
        });
      }

      const logoutItem = document.getElementById('navLogoutItem');
      if (logoutItem) {
        logoutItem.addEventListener('click', () => this.handleLogout());
      }
    } else {
      container.innerHTML = `
        <button type="button" class="cart-button customer-nav-btn" id="customerSignInNavBtn">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>Sign In</span>
        </button>
      `;
      const signInBtn = document.getElementById('customerSignInNavBtn');
      if (signInBtn) {
        signInBtn.addEventListener('click', () => this.open('signin'));
      }
    }

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      const menu = document.getElementById('customerDropdownMenu');
      if (menu) menu.classList.remove('show');
    });
  },

  /**
   * Require verified customer authentication before executing an action (e.g. Checkout)
   * @param {Function} onSuccess - Callback when verified
   * @param {string} noticeText - Optional banner text
   */
  requireAuth(onSuccess, noticeText) {
    if (this.currentUser) {
      if (typeof onSuccess === 'function') {
        onSuccess(this.currentUser);
      }
      return true;
    }

    this.pendingSuccessAction = onSuccess;
    this.open('signin', noticeText || 'Please sign in or create a verified account to place your order.');
    return false;
  },

  /**
   * Open the Customer Auth Modal in specific view
   * @param {'signin'|'register'|'verify'} view
   * @param {string} notice
   */
  open(view = 'signin', notice = null) {
    const modal = document.getElementById('customerAuthModal');
    if (!modal) return;

    const noticeEl = document.getElementById('customerAuthNotice');
    const noticeText = document.getElementById('customerAuthNoticeText');
    if (noticeEl && noticeText) {
      if (notice) {
        noticeText.textContent = notice;
        noticeEl.style.display = 'flex';
      } else {
        noticeEl.style.display = 'none';
      }
    }

    this.switchView(view);
    modal.classList.add('show');
  },

  /**
   * Close modal
   */
  close() {
    const modal = document.getElementById('customerAuthModal');
    if (modal) {
      modal.classList.remove('show');
    }
  },

  /**
   * Switch modal views
   */
  switchView(view) {
    const signInView = document.getElementById('customerSignInView');
    const regView = document.getElementById('customerRegisterView');
    const verifyView = document.getElementById('customerVerifyView');

    if (signInView) signInView.style.display = view === 'signin' ? 'block' : 'none';
    if (regView) regView.style.display = view === 'register' ? 'block' : 'none';
    if (verifyView) verifyView.style.display = view === 'verify' ? 'block' : 'none';

    // Clear error messages
    this.clearErrors();

    if (view === 'signin') {
      const emailInput = document.getElementById('customerSignInEmail');
      if (emailInput) setTimeout(() => emailInput.focus(), 50);
    } else if (view === 'register') {
      const nameInput = document.getElementById('customerRegName');
      if (nameInput) setTimeout(() => nameInput.focus(), 50);
    } else if (view === 'verify') {
      const otpInput = document.getElementById('customerOtpInput');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 50);
      }
      const emailTarget = document.getElementById('customerVerifyEmailTarget');
      if (emailTarget) emailTarget.textContent = this.activeEmail;
    }
  },

  /**
   * Clear all error banners
   */
  clearErrors() {
    const errors = ['customerSignInError', 'customerRegisterError', 'customerVerifyError', 'customerVerifySuccess'];
    errors.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  },

  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  },

  showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  },

  /**
   * Setup Event Listeners
   */
  setupEventListeners() {
    const modal = document.getElementById('customerAuthModal');
    const closeBtn = document.getElementById('closeCustomerAuthModal');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    // View Switchers
    const toRegisterBtn = document.getElementById('switchToRegisterBtn');
    if (toRegisterBtn) toRegisterBtn.addEventListener('click', () => this.switchView('register'));

    const toSignInBtn = document.getElementById('switchToSignInBtn');
    if (toSignInBtn) toSignInBtn.addEventListener('click', () => this.switchView('signin'));

    const backToRegBtn = document.getElementById('customerBackToRegBtn');
    if (backToRegBtn) backToRegBtn.addEventListener('click', () => this.switchView('register'));

    // 1. Sign In Form
    const signInForm = document.getElementById('customerSignInForm');
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => this.handleSignIn(e));
    }

    // 2. Register Form
    const regForm = document.getElementById('customerRegisterForm');
    if (regForm) {
      regForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // 3. Verify OTP Form
    const verifyForm = document.getElementById('customerVerifyForm');
    if (verifyForm) {
      verifyForm.addEventListener('submit', (e) => this.handleVerify(e));
    }

    // Resend OTP button
    const resendBtn = document.getElementById('customerResendBtn');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => this.handleResendCode());
    }

    // Auto submit OTP on 6th digit entered
    const otpInput = document.getElementById('customerOtpInput');
    if (otpInput) {
      otpInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        e.target.value = val;
        if (val.length === 6 && verifyForm) {
          verifyForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }
  },

  /**
   * Handle Sign In Submission
   */
  async handleSignIn(e) {
    e.preventDefault();
    this.clearErrors();

    const email = document.getElementById('customerSignInEmail').value.trim();
    const password = document.getElementById('customerSignInPassword').value;
    const submitBtn = document.getElementById('customerSignInSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';

    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const result = await res.json();

      if (result.requires_verification) {
        this.activeEmail = result.email || email;
        this.switchView('verify');
        this.startResendCountdown(60);
        this.showError('customerVerifyError', result.message || 'Please enter the verification code sent to your email.');
        return;
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Invalid credentials');
      }

      this.currentUser = result.user;
      this.updateNavUI();
      this.close();

      // If opening checkout was pending, trigger it
      if (typeof this.pendingSuccessAction === 'function') {
        const action = this.pendingSuccessAction;
        this.pendingSuccessAction = null;
        action(this.currentUser);
      }
    } catch (err) {
      this.showError('customerSignInError', err.message || 'Sign in failed. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  },

  /**
   * Handle Registration Submission
   */
  async handleRegister(e) {
    e.preventDefault();
    this.clearErrors();

    const fullName = document.getElementById('customerRegName').value.trim();
    const email = document.getElementById('customerRegEmail').value.trim();
    const phone = document.getElementById('customerRegPhone').value.trim();
    const password = document.getElementById('customerRegPassword').value;
    const ageCheck = document.getElementById('customerRegAgeCheck').checked;
    const submitBtn = document.getElementById('customerRegisterSubmitBtn');

    if (!ageCheck) {
      this.showError('customerRegisterError', 'You must be at least 18 years old to create an account.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending Verification Code...';

    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: fullName,
          email,
          contact_number: phone,
          password
        })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to register');
      }

      this.activeEmail = result.email || email;
      this.switchView('verify');
      this.startResendCountdown(60);
    } catch (err) {
      this.showError('customerRegisterError', err.message || 'Registration failed. Please check your information.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue & Send Code';
    }
  },

  /**
   * Handle 6-Digit OTP Verification Submission
   */
  async handleVerify(e) {
    e.preventDefault();
    this.clearErrors();

    const otpInput = document.getElementById('customerOtpInput');
    const code = otpInput ? otpInput.value.trim() : '';
    const submitBtn = document.getElementById('customerVerifySubmitBtn');

    if (code.length !== 6) {
      this.showError('customerVerifyError', 'Please enter the complete 6-digit verification code.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
      const res = await fetch('/api/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: this.activeEmail, code })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      this.currentUser = result.user;
      this.updateNavUI();
      this.showSuccess('customerVerifySuccess', '✓ Email verified successfully! Loading checkout...');

      clearInterval(this.resendTimerInterval);

      setTimeout(() => {
        this.close();
        if (typeof this.pendingSuccessAction === 'function') {
          const action = this.pendingSuccessAction;
          this.pendingSuccessAction = null;
          action(this.currentUser);
        }
      }, 700);
    } catch (err) {
      this.showError('customerVerifyError', err.message || 'Invalid code. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify & Place Order';
    }
  },

  /**
   * Handle Resend OTP Code
   */
  async handleResendCode() {
    const resendBtn = document.getElementById('customerResendBtn');
    if (!resendBtn || resendBtn.disabled) return;

    resendBtn.disabled = true;
    this.clearErrors();

    try {
      const res = await fetch('/api/customer/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: this.activeEmail })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Unable to resend code');
      }

      this.showSuccess('customerVerifySuccess', 'A fresh 6-digit code has been sent to your email.');
      this.startResendCountdown(60);
    } catch (err) {
      this.showError('customerVerifyError', err.message || 'Failed to resend code.');
      resendBtn.disabled = false;
    }
  },

  startResendCountdown(seconds) {
    const resendBtn = document.getElementById('customerResendBtn');
    const countdownEl = document.getElementById('customerResendCountdown');
    if (!resendBtn) return;

    clearInterval(this.resendTimerInterval);
    resendBtn.disabled = true;

    let remaining = seconds;
    if (countdownEl) countdownEl.textContent = `(${remaining}s)`;

    this.resendTimerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.resendTimerInterval);
        resendBtn.disabled = false;
        if (countdownEl) countdownEl.textContent = '';
      } else {
        if (countdownEl) countdownEl.textContent = `(${remaining}s)`;
      }
    }, 1000);
  },

  /**
   * Handle Customer Sign Out
   */
  async handleLogout() {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    this.currentUser = null;
    this.updateNavUI();
    // Refresh page to sync cart & modals
    window.location.reload();
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.CustomerAuth = CustomerAuth;
document.addEventListener('DOMContentLoaded', () => {
  CustomerAuth.init();
});
