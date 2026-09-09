/**
 * Customer Authentication & Email Verification Controller
 * Handles client-side customer login, registration, OTP email verification, and session state
 */

const CustomerAuth = {
  currentUser: null,
  pendingSuccessAction: null,
  resendTimerInterval: null,
  activeEmail: '',
  isEmailChangeVerification: false,

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

    const ordersBtn = document.getElementById('ordersBtn');
    if (ordersBtn) {
      ordersBtn.style.display = this.currentUser ? 'none' : '';
    }
    document.body.classList.toggle('customer-logged-in', Boolean(this.currentUser));

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
            <button type="button" class="customer-dropdown-item" id="navProfileItem">
              <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <span>My Profile</span>
            </button>
            <button type="button" class="customer-dropdown-item" id="navMyOrdersItem">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
              <span>My Orders</span>
              <span id="navOrdersBadge" style="display: none; margin-left: auto; background: var(--accent); color: #0a0a0f; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 700;"></span>
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

      const profileItem = document.getElementById('navProfileItem');
      if (profileItem) {
        profileItem.addEventListener('click', () => {
          this.openProfile();
          if (menu) menu.classList.remove('show');
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

    if (window.CatalogOrdersModal && typeof window.CatalogOrdersModal.updateBadge === 'function') {
      window.CatalogOrdersModal.updateBadge();
    }
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
    const privacyView = document.getElementById('customerPrivacyView');
    const profileView = document.getElementById('customerProfileView');

    const modalContent = document.querySelector('.customer-auth-modal-content');
    if (modalContent) {
      modalContent.classList.toggle('privacy-active', view === 'privacy');
      modalContent.classList.toggle('signin-active', view === 'signin');
      modalContent.classList.toggle('verify-active', view === 'verify');
      modalContent.classList.toggle('register-active', view === 'register');
      modalContent.classList.toggle('profile-active', view === 'profile');
    }

    if (signInView) signInView.style.display = view === 'signin' ? 'block' : 'none';
    if (regView) regView.style.display = view === 'register' ? 'block' : 'none';
    if (verifyView) verifyView.style.display = view === 'verify' ? 'block' : 'none';
    if (privacyView) privacyView.style.display = view === 'privacy' ? 'block' : 'none';
    if (profileView) profileView.style.display = view === 'profile' ? 'block' : 'none';

    // Clear error messages
    this.clearErrors();

    if (view === 'signin') {
      const emailInput = document.getElementById('customerSignInEmail');
      if (emailInput) setTimeout(() => emailInput.focus(), 50);
      const passInput = document.getElementById('customerSignInPassword');
      const toggleBtn = document.getElementById('toggleCustomerSignInPassword');
      if (passInput) passInput.type = 'password';
      if (toggleBtn) {
        toggleBtn.classList.remove('is-visible');
        toggleBtn.setAttribute('aria-pressed', 'false');
        toggleBtn.setAttribute('aria-label', 'Show password');
      }
    } else if (view === 'register') {
      const nameInput = document.getElementById('customerRegName');
      if (nameInput) setTimeout(() => nameInput.focus(), 50);
      const bday = document.getElementById('customerRegBirthday');
      if (bday && !bday.max) {
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() - 18);
        bday.max = maxDate.toISOString().split('T')[0];
      }
    } else if (view === 'verify') {
      const otpInput = document.getElementById('customerOtpInput');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 50);
      }
      const emailTarget = document.getElementById('customerVerifyEmailTarget');
      if (emailTarget) emailTarget.textContent = this.activeEmail;
    } else if (view === 'profile') {
      const nameInput = document.getElementById('customerProfileName');
      if (nameInput) setTimeout(() => nameInput.focus(), 50);
    }
  },

  /**
   * Clear all error banners
   */
  clearErrors() {
    const errors = [
      'customerSignInError',
      'customerRegisterError',
      'customerVerifyError',
      'customerVerifySuccess',
      'customerProfileError',
      'customerProfileSuccess'
    ];
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
    if (toSignInBtn) {
      toSignInBtn.addEventListener('click', () => {
        const regEmail = document.getElementById('customerRegEmail');
        const signInEmail = document.getElementById('customerSignInEmail');
        if (regEmail && signInEmail && regEmail.value.trim() && !signInEmail.value) {
          signInEmail.value = regEmail.value.trim();
        }
        this.switchView('signin');
      });
    }

    const backToRegBtn = document.getElementById('customerBackToRegBtn');
    if (backToRegBtn) {
      backToRegBtn.addEventListener('click', () => {
        if (this.isEmailChangeVerification) {
          this.switchView('profile');
        } else {
          this.switchView('register');
        }
      });
    }

    // Privacy View Triggers
    const openPrivacyBtn = document.getElementById('openPrivacyModalBtn');
    if (openPrivacyBtn) {
      openPrivacyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView('privacy');
      });
    }

    const closePrivacyBtn = document.getElementById('customerClosePrivacyBtn');
    if (closePrivacyBtn) {
      closePrivacyBtn.addEventListener('click', () => this.switchView('register'));
    }

    // Set max date for birthday picker (must be at least 18 years ago)
    const birthdayInput = document.getElementById('customerRegBirthday');
    if (birthdayInput) {
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - 18);
      birthdayInput.max = maxDate.toISOString().split('T')[0];
    }

    // 1. Sign In Form & Password Visibility Toggle
    const toggleSignInPassword = document.getElementById('toggleCustomerSignInPassword');
    const signInPasswordInput = document.getElementById('customerSignInPassword');
    if (toggleSignInPassword && signInPasswordInput) {
      toggleSignInPassword.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = signInPasswordInput.type === 'password';
        signInPasswordInput.type = isPassword ? 'text' : 'password';
        toggleSignInPassword.classList.toggle('is-visible', isPassword);
        toggleSignInPassword.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        toggleSignInPassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }

    const signInForm = document.getElementById('customerSignInForm');
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => this.handleSignIn(e));
    }

    // 2. Register Form & Email Uniqueness Check
    const regForm = document.getElementById('customerRegisterForm');
    if (regForm) {
      regForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    const regEmailInput = document.getElementById('customerRegEmail');
    if (regEmailInput) {
      regEmailInput.addEventListener('blur', async () => {
        const val = regEmailInput.value.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val || !emailRegex.test(val)) return;

        try {
          const res = await fetch(`/api/customer/check-email?email=${encodeURIComponent(val)}`);
          const data = await res.json();
          if (data.success && data.exists) {
            this.showError('customerRegisterError', 'This email already exists. Please sign in.');
            regEmailInput.style.borderColor = 'var(--error, #ff4757)';
            const signInEmail = document.getElementById('customerSignInEmail');
            if (signInEmail) signInEmail.value = val;
          } else {
            const errEl = document.getElementById('customerRegisterError');
            if (errEl && errEl.textContent.includes('already exists')) {
              errEl.style.display = 'none';
              errEl.textContent = '';
            }
            regEmailInput.style.borderColor = '';
          }
        } catch (_) { }
      });

      regEmailInput.addEventListener('input', () => {
        regEmailInput.style.borderColor = '';
        const errEl = document.getElementById('customerRegisterError');
        if (errEl && errEl.textContent.includes('already exists')) {
          errEl.style.display = 'none';
          errEl.textContent = '';
        }
      });
    }

    const regPhoneInput = document.getElementById('customerRegPhone');
    if (regPhoneInput) {
      regPhoneInput.addEventListener('blur', async () => {
        const val = regPhoneInput.value.replace(/\D/g, '');
        if (!val || val.length !== 11) return;

        try {
          const res = await fetch(`/api/customer/check-phone?phone=${encodeURIComponent(val)}`);
          const data = await res.json();
          if (data.success && data.exists) {
            this.showError('customerRegisterError', 'This mobile number already exists. Please use another number or sign in.');
            regPhoneInput.style.borderColor = 'var(--error, #ff4757)';
          } else {
            const errEl = document.getElementById('customerRegisterError');
            if (errEl && errEl.textContent.includes('mobile number already exists')) {
              errEl.style.display = 'none';
              errEl.textContent = '';
            }
            regPhoneInput.style.borderColor = '';
          }
        } catch (_) { }
      });

      regPhoneInput.addEventListener('input', () => {
        regPhoneInput.style.borderColor = '';
        const errEl = document.getElementById('customerRegisterError');
        if (errEl && errEl.textContent.includes('mobile number already exists')) {
          errEl.style.display = 'none';
          errEl.textContent = '';
        }
      });
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

    // Password Strength live evaluation
    const regPasswordInput = document.getElementById('customerRegPassword');
    const strengthWrap = document.getElementById('passwordStrengthWrap');
    const strengthFill = document.getElementById('passwordStrengthBarFill');
    const strengthLabel = document.getElementById('passwordStrengthLabelText');

    const badgeLength = document.getElementById('pwdReqLength');
    const badgeUpper = document.getElementById('pwdReqUpper');
    const badgeLower = document.getElementById('pwdReqLower');
    const badgeNumber = document.getElementById('pwdReqNumber');
    const badgeSymbol = document.getElementById('pwdReqSymbol');

    if (regPasswordInput) {
      regPasswordInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!val) {
          if (strengthWrap) strengthWrap.style.display = 'none';
          [badgeLength, badgeUpper, badgeLower, badgeNumber, badgeSymbol].forEach(b => b && b.classList.remove('met'));
          return;
        }

        if (strengthWrap) strengthWrap.style.display = 'flex';

        const isLen = val.length >= 8;
        const isUp = /[A-Z]/.test(val);
        const isLow = /[a-z]/.test(val);
        const isNum = /[0-9]/.test(val);
        const isSym = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(val);

        if (badgeLength) badgeLength.classList.toggle('met', isLen);
        if (badgeUpper) badgeUpper.classList.toggle('met', isUp);
        if (badgeLower) badgeLower.classList.toggle('met', isLow);
        if (badgeNumber) badgeNumber.classList.toggle('met', isNum);
        if (badgeSymbol) badgeSymbol.classList.toggle('met', isSym);

        const score = [isLen, isUp, isLow, isNum, isSym].filter(Boolean).length;

        if (strengthFill && strengthLabel) {
          if (score <= 1) {
            strengthFill.style.width = '20%';
            strengthFill.style.backgroundColor = 'var(--error, #ff4757)';
            strengthLabel.textContent = 'Weak';
            strengthLabel.style.color = 'var(--error, #ff4757)';
          } else if (score === 2) {
            strengthFill.style.width = '40%';
            strengthFill.style.backgroundColor = '#ffa502';
            strengthLabel.textContent = 'Fair';
            strengthLabel.style.color = '#ffa502';
          } else if (score === 3) {
            strengthFill.style.width = '65%';
            strengthFill.style.backgroundColor = '#eccc68';
            strengthLabel.textContent = 'Good';
            strengthLabel.style.color = '#eccc68';
          } else if (score === 4) {
            strengthFill.style.width = '85%';
            strengthFill.style.backgroundColor = '#7bed9f';
            strengthLabel.textContent = 'Almost';
            strengthLabel.style.color = '#7bed9f';
          } else {
            strengthFill.style.width = '100%';
            strengthFill.style.backgroundColor = 'var(--accent, #00d4aa)';
            strengthLabel.textContent = 'Strong ✓';
            strengthLabel.style.color = 'var(--accent, #00d4aa)';
          }
        }
      });
    }

    // Confirm password real-time match feedback
    const regConfirmInput = document.getElementById('customerRegConfirmPassword');
    const matchHint = document.getElementById('passwordMatchHint');
    if (regConfirmInput) {
      regConfirmInput.addEventListener('input', (e) => {
        const pwd = regPasswordInput ? regPasswordInput.value : '';
        const conf = e.target.value;
        if (!conf) {
          if (matchHint) {
            matchHint.textContent = '(re-enter)';
            matchHint.style.color = '';
          }
          return;
        }
        if (pwd === conf) {
          if (matchHint) {
            matchHint.textContent = '✓ Match';
            matchHint.style.color = 'var(--accent, #00d4aa)';
          }
        } else {
          if (matchHint) {
            matchHint.textContent = '✗ Mismatch';
            matchHint.style.color = 'var(--error, #ff4757)';
          }
        }
      });
    }

    // 4. Customer Profile Form
    const profileForm = document.getElementById('customerProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleUpdateProfile(e));
    }

    const profilePhoneInput = document.getElementById('customerProfilePhone');
    if (profilePhoneInput) {
      profilePhoneInput.addEventListener('blur', async () => {
        const val = profilePhoneInput.value.replace(/\D/g, '');
        if (!val || val.length !== 11) return;
        const currentPhone = (this.currentUser?.contact_number || '').replace(/\D/g, '');
        if (val === currentPhone) return;

        try {
          const excludeId = this.currentUser?.id ? `&exclude_user_id=${encodeURIComponent(this.currentUser.id)}` : '';
          const res = await fetch(`/api/customer/check-phone?phone=${encodeURIComponent(val)}${excludeId}`);
          const data = await res.json();
          if (data.success && data.exists) {
            this.showError('customerProfileError', 'This mobile number is already associated with another account.');
            profilePhoneInput.style.borderColor = 'var(--error, #ff4757)';
          } else {
            const errEl = document.getElementById('customerProfileError');
            if (errEl && errEl.textContent.includes('mobile number is already')) {
              errEl.style.display = 'none';
              errEl.textContent = '';
            }
            profilePhoneInput.style.borderColor = '';
          }
        } catch (_) { }
      });

      profilePhoneInput.addEventListener('input', () => {
        profilePhoneInput.style.borderColor = '';
        const errEl = document.getElementById('customerProfileError');
        if (errEl && errEl.textContent.includes('mobile number is already')) {
          errEl.style.display = 'none';
          errEl.textContent = '';
        }
      });
    }

    const profileEmailInput = document.getElementById('customerProfileEmail');
    if (profileEmailInput) {
      profileEmailInput.addEventListener('blur', async () => {
        const val = profileEmailInput.value.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val || !emailRegex.test(val)) return;
        const currentEmail = (this.currentUser?.email || '').trim().toLowerCase();
        if (val === currentEmail) return;

        try {
          const excludeId = this.currentUser?.id ? `&exclude_user_id=${encodeURIComponent(this.currentUser.id)}` : '';
          const res = await fetch(`/api/customer/check-email?email=${encodeURIComponent(val)}${excludeId}`);
          const data = await res.json();
          if (data.success && data.exists) {
            this.showError('customerProfileError', 'This email is already associated with another account.');
            profileEmailInput.style.borderColor = 'var(--error, #ff4757)';
          } else {
            const errEl = document.getElementById('customerProfileError');
            if (errEl && errEl.textContent.includes('email is already associated')) {
              errEl.style.display = 'none';
              errEl.textContent = '';
            }
            profileEmailInput.style.borderColor = '';
          }
        } catch (_) { }
      });

      profileEmailInput.addEventListener('input', () => {
        profileEmailInput.style.borderColor = '';
        const errEl = document.getElementById('customerProfileError');
        if (errEl && errEl.textContent.includes('email is already associated')) {
          errEl.style.display = 'none';
          errEl.textContent = '';
        }
      });
    }

    const cancelProfileBtn = document.getElementById('customerCancelProfileBtn');
    if (cancelProfileBtn) {
      cancelProfileBtn.addEventListener('click', () => this.close());
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
    const birthday = document.getElementById('customerRegBirthday').value;
    const password = document.getElementById('customerRegPassword').value;
    const confirmPassword = document.getElementById('customerRegConfirmPassword') ? document.getElementById('customerRegConfirmPassword').value : '';
    const privacyCheck = document.getElementById('customerRegPrivacyCheck').checked;
    const submitBtn = document.getElementById('customerRegisterSubmitBtn');

    if (!birthday) {
      this.showError('customerRegisterError', 'Please enter your date of birth.');
      return;
    }

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      this.showError('customerRegisterError', 'Please enter a valid date of birth.');
      return;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      this.showError('customerRegisterError', 'You must be at least 18 years old to create an account and purchase vape products (Republic Act No. 11900).');
      return;
    }

    if (!password || password.length < 8) {
      this.showError('customerRegisterError', 'Password must be at least 8 characters long.');
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      this.showError('customerRegisterError', 'Password must include uppercase, lowercase, a number, and a special character.');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('customerRegisterError', 'Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!privacyCheck) {
      this.showError('customerRegisterError', 'You must consent to the Data Privacy Act terms to register.');
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
          birthday,
          password
        })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to register');
      }

      this.activeEmail = result.email || email;
      this.isEmailChangeVerification = false;
      const verifyBtn = document.getElementById('customerVerifySubmitBtn');
      if (verifyBtn) {
        verifyBtn.textContent = this.pendingSuccessAction ? 'Verify & Place Order' : 'Verify Email';
      }
      this.switchView('verify');
      this.startResendCountdown(60);
    } catch (err) {
      this.showError('customerRegisterError', err.message || 'Registration failed. Please check your information.');
      if (err.message && err.message.toLowerCase().includes('mobile number')) {
        const regPhoneInput = document.getElementById('customerRegPhone');
        if (regPhoneInput) regPhoneInput.style.borderColor = 'var(--error, #ff4757)';
      } else if (err.message && err.message.toLowerCase().includes('already exists')) {
        const regEmailInput = document.getElementById('customerRegEmail');
        if (regEmailInput) regEmailInput.style.borderColor = 'var(--error, #ff4757)';
        const signInEmail = document.getElementById('customerSignInEmail');
        if (signInEmail && email) signInEmail.value = email;
      }
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
      this.isEmailChangeVerification = false;
      this.updateNavUI();

      // Sync profile modal inputs with the verified user
      const nameInput = document.getElementById('customerProfileName');
      const phoneInput = document.getElementById('customerProfilePhone');
      const emailInput = document.getElementById('customerProfileEmail');
      if (nameInput) nameInput.value = this.currentUser.full_name || '';
      if (phoneInput) phoneInput.value = this.currentUser.contact_number || '';
      if (emailInput) emailInput.value = this.currentUser.email || '';

      // Sync customer details to checkout form autofill if present
      const checkoutName = document.getElementById('customerName');
      const checkoutPhone = document.getElementById('customerPhone');
      const checkoutEmail = document.getElementById('customerEmail');
      if (checkoutName) checkoutName.value = this.currentUser.full_name || '';
      if (checkoutPhone) checkoutPhone.value = this.currentUser.contact_number || '';
      if (checkoutEmail) checkoutEmail.value = this.currentUser.email || '';

      this.showSuccess('customerVerifySuccess', '✓ Email verified successfully!');

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
      submitBtn.textContent = this.pendingSuccessAction ? 'Verify & Place Order' : 'Verify Email';
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
    } catch (e) { }
    try {
      localStorage.removeItem('tita_recent_orders');
    } catch (_) { }
    this.currentUser = null;
    this.updateNavUI();
    // Refresh page to sync cart & modals
    window.location.reload();
  },

  /**
   * Open Profile modal view with active customer data
   */
  openProfile() {
    if (!this.currentUser) {
      this.open('signin');
      return;
    }

    const nameInput = document.getElementById('customerProfileName');
    const phoneInput = document.getElementById('customerProfilePhone');
    const emailInput = document.getElementById('customerProfileEmail');
    const avatarBadge = document.getElementById('profileModalAvatar');
    const ageBadgeText = document.getElementById('profileAgeBadgeText');

    if (nameInput) nameInput.value = this.currentUser.full_name || '';
    if (phoneInput) phoneInput.value = this.currentUser.contact_number || '';
    if (emailInput) emailInput.value = this.currentUser.email || '';

    if (avatarBadge) {
      const initial = (this.currentUser.full_name || this.currentUser.email || 'C')
        .trim()
        .charAt(0)
        .toUpperCase();
      avatarBadge.textContent = initial;
    }

    if (ageBadgeText && this.currentUser.birthday) {
      ageBadgeText.textContent = `Verified 18+ Customer (Born ${this.currentUser.birthday}) • RA 11900`;
    }

    this.open('profile');
  },

  /**
   * Handle Customer Profile Update submission
   */
  async handleUpdateProfile(e) {
    if (e) e.preventDefault();
    this.clearErrors();

    const nameInput = document.getElementById('customerProfileName');
    const phoneInput = document.getElementById('customerProfilePhone');
    const emailInput = document.getElementById('customerProfileEmail');
    const submitBtn = document.getElementById('customerProfileSubmitBtn');

    const fullName = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

    if (!fullName || fullName.length < 2) {
      this.showError('customerProfileError', 'Please enter your full name (at least 2 characters).');
      if (nameInput) nameInput.focus();
      return;
    }

    const phonePattern = /^(09|\+639)\d{9}$/;
    if (!phone || !phonePattern.test(phone)) {
      this.showError('customerProfileError', 'Please enter a valid 11-digit mobile number (e.g. 09123456789).');
      if (phoneInput) phoneInput.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      this.showError('customerProfileError', 'Please enter a valid email address.');
      if (emailInput) emailInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Changes...';
    }

    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: fullName,
          contact_number: phone,
          email: email
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        this.showError('customerProfileError', data.error || 'Failed to update profile.');
        if (data.error && data.error.toLowerCase().includes('mobile number')) {
          if (phoneInput) phoneInput.style.borderColor = 'var(--error, #ff4757)';
        } else if (data.error && data.error.toLowerCase().includes('email')) {
          if (emailInput) emailInput.style.borderColor = 'var(--error, #ff4757)';
        }
        return;
      }

      // If email was changed, require 6-digit OTP verification before applying the new email address
      if (data.email_changed) {
        this.activeEmail = data.email;
        this.isEmailChangeVerification = true;
        // Keep current session active so user is not logged out during verification

        // Switch to OTP verify view
        this.switchView('verify');
        this.startResendCountdown(60);

        const emailTarget = document.getElementById('customerVerifyEmailTarget');
        if (emailTarget) emailTarget.textContent = data.email;

        const verifyBtn = document.getElementById('customerVerifySubmitBtn');
        if (verifyBtn) verifyBtn.textContent = 'Verify & Update Email';

        this.showSuccess('customerVerifySuccess', data.message || `Verification code sent to ${data.email}. Please verify to confirm.`);
        return;
      }

      // Normal profile update without changing email
      this.currentUser = data.user;
      this.updateNavUI();

      // Update avatar badge in modal
      const avatarBadge = document.getElementById('profileModalAvatar');
      if (avatarBadge) {
        avatarBadge.textContent = (this.currentUser.full_name || 'C').trim().charAt(0).toUpperCase();
      }

      // Sync customer details to checkout form autofill if active
      const checkoutName = document.getElementById('customerName');
      const checkoutPhone = document.getElementById('customerPhone');
      const checkoutEmail = document.getElementById('customerEmail');
      if (checkoutName) checkoutName.value = this.currentUser.full_name || '';
      if (checkoutPhone) checkoutPhone.value = this.currentUser.contact_number || '';
      if (checkoutEmail) checkoutEmail.value = this.currentUser.email || '';

      this.showSuccess('customerProfileSuccess', '✓ Profile updated successfully!');

      // Smoothly close after a brief delay
      setTimeout(() => {
        const profileView = document.getElementById('customerProfileView');
        if (profileView && profileView.style.display !== 'none') {
          this.close();
        }
      }, 1400);

    } catch (err) {
      console.error('[Customer Auth] Profile update error:', err);
      this.showError('customerProfileError', 'Unable to reach the server. Please check your connection.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
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
