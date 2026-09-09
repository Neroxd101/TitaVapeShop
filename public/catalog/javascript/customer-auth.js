/**
 * Customer Authentication Controller
 * Orchestrates customer modals and delegates to specific modular modules:
 * - CustomerLogin (customer_login.js)
 * - CustomerRegister (customer_register.js)
 * - CustomerVerifyOtp (customer_verify_otp.js)
 * - CustomerGenerateOtp (customer_generate_otp.js)
 * - CustomerUpdateProfile (customer_update_profile.js)
 * - CustomerCheckEmail (customer_check_email.js)
 * - CustomerCheckPhone (customer_check_phone.js)
 */

const CustomerAuth = {
  currentUser: null,
  pendingSuccessAction: null,
  activeEmail: '',
  isEmailChangeVerification: false,

  /**
   * Initialize Customer Auth Modal & Session
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
    if (window.CustomerLogin) {
      this.currentUser = await window.CustomerLogin.checkSession();
    }
    this.updateNavUI();
    return this.currentUser;
  },

  /**
   * Update navigation bar with Sign In button or Profile Pill
   */
  updateNavUI() {
    if (window.CustomerLogin) {
      window.CustomerLogin.updateNavUI(this.currentUser, {
        onOpenProfile: () => this.openProfile(),
        onOpenOrders: () => {
          if (window.CatalogOrdersModal) window.CatalogOrdersModal.open();
        },
        onOpenSignIn: () => this.open('signin')
      });
    }

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
   * Open modal in specific view
   * @param {'signin'|'register'|'verify'|'profile'|'privacy'} view
   * @param {string} [notice]
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
   * Setup Event Listeners across modular actions
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

    // View switchers
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

    // Privacy View
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

    // Sign In Password Toggle
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

    // Sign In Form Submission
    const signInForm = document.getElementById('customerSignInForm');
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => this.handleSignIn(e));
    }

    // Live Validation on Registration Email via CustomerCheckEmail
    const regEmailInput = document.getElementById('customerRegEmail');
    const regErrorEl = document.getElementById('customerRegisterError');
    if (window.CustomerCheckEmail && regEmailInput) {
      window.CustomerCheckEmail.attachLiveValidation(regEmailInput, regErrorEl, (existingEmail) => {
        const signInEmail = document.getElementById('customerSignInEmail');
        if (signInEmail) signInEmail.value = existingEmail;
      });
    }

    // Live Validation on Registration Phone via CustomerCheckPhone
    const regPhoneInput = document.getElementById('customerRegPhone');
    if (window.CustomerCheckPhone && regPhoneInput) {
      window.CustomerCheckPhone.attachLiveValidation(regPhoneInput, regErrorEl);
    }

    // Password strength meters & confirm password matches
    this.setupPasswordStrength();

    // Registration Form Submission
    const regForm = document.getElementById('customerRegisterForm');
    if (regForm) {
      regForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // OTP Verification Form & auto-submit
    const verifyForm = document.getElementById('customerVerifyForm');
    const otpInput = document.getElementById('customerOtpInput');
    if (window.CustomerVerifyOtp && otpInput) {
      window.CustomerVerifyOtp.bindOtpInput(otpInput, () => {
        if (verifyForm) verifyForm.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    }
    if (verifyForm) {
      verifyForm.addEventListener('submit', (e) => this.handleVerify(e));
    }

    // Resend OTP Button
    const resendBtn = document.getElementById('customerResendBtn');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => this.handleResendCode());
    }

    // Live Validation on Profile Phone & Email
    const profilePhoneInput = document.getElementById('customerProfilePhone');
    const profileEmailInput = document.getElementById('customerProfileEmail');
    const profileErrorEl = document.getElementById('customerProfileError');

    if (window.CustomerCheckPhone && profilePhoneInput) {
      window.CustomerCheckPhone.attachLiveValidation(profilePhoneInput, profileErrorEl, null, this.currentUser?.id);
    }
    if (window.CustomerCheckEmail && profileEmailInput) {
      window.CustomerCheckEmail.attachLiveValidation(profileEmailInput, profileErrorEl, null, this.currentUser?.id);
    }

    // Profile Form Submission
    const profileForm = document.getElementById('customerProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleUpdateProfile(e));
    }

    const cancelProfileBtn = document.getElementById('customerCancelProfileBtn');
    if (cancelProfileBtn) {
      cancelProfileBtn.addEventListener('click', () => this.close());
    }
  },

  /**
   * Password strength meter setup
   */
  setupPasswordStrength() {
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
  },

  /**
   * Handle Sign In Submission using CustomerLogin module
   */
  async handleSignIn(e) {
    e.preventDefault();
    this.clearErrors();

    const email = document.getElementById('customerSignInEmail').value.trim();
    const password = document.getElementById('customerSignInPassword').value;
    const submitBtn = document.getElementById('customerSignInSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';

    const result = await window.CustomerLogin.login(email, password);

    if (result.requires_verification) {
      this.activeEmail = result.email || email;
      this.switchView('verify');
      this.startResendCountdown(60);
      this.showError('customerVerifyError', result.message || 'Please enter the verification code sent to your email.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }

    if (!result.success) {
      this.showError('customerSignInError', result.error || 'Sign in failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      return;
    }

    this.currentUser = result.user;
    this.updateNavUI();
    this.close();

    if (typeof this.pendingSuccessAction === 'function') {
      const action = this.pendingSuccessAction;
      this.pendingSuccessAction = null;
      action(this.currentUser);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  },

  /**
   * Handle Registration Submission using CustomerRegister module
   */
  async handleRegister(e) {
    e.preventDefault();
    this.clearErrors();

    const payload = {
      full_name: document.getElementById('customerRegName').value.trim(),
      email: document.getElementById('customerRegEmail').value.trim(),
      contact_number: document.getElementById('customerRegPhone').value.trim(),
      birthday: document.getElementById('customerRegBirthday').value,
      password: document.getElementById('customerRegPassword').value,
      confirm_password: document.getElementById('customerRegConfirmPassword')?.value || '',
      privacy_check: document.getElementById('customerRegPrivacyCheck')?.checked || false
    };

    const validation = window.CustomerRegister.validate(payload);
    if (!validation.valid) {
      this.showError('customerRegisterError', validation.error);
      return;
    }

    const submitBtn = document.getElementById('customerRegisterSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending Verification Code...';

    const result = await window.CustomerRegister.submit({
      full_name: payload.full_name,
      email: payload.email,
      contact_number: payload.contact_number,
      birthday: payload.birthday,
      password: payload.password
    });

    if (!result.success) {
      this.showError('customerRegisterError', result.error || 'Registration failed. Please check your details.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue & Send Code';
      return;
    }

    this.activeEmail = result.email || payload.email;
    this.isEmailChangeVerification = false;
    const verifyBtn = document.getElementById('customerVerifySubmitBtn');
    if (verifyBtn) {
      verifyBtn.textContent = this.pendingSuccessAction ? 'Verify & Place Order' : 'Verify Email';
    }
    this.switchView('verify');
    this.startResendCountdown(60);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue & Send Code';
  },

  /**
   * Handle OTP Verification Submission using CustomerVerifyOtp module
   */
  async handleVerify(e) {
    e.preventDefault();
    this.clearErrors();

    const otpInput = document.getElementById('customerOtpInput');
    const code = otpInput ? otpInput.value.trim() : '';
    const submitBtn = document.getElementById('customerVerifySubmitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    const result = await window.CustomerVerifyOtp.verify(this.activeEmail, code);

    if (!result.success) {
      this.showError('customerVerifyError', result.error || 'Verification failed. Please check the code.');
      submitBtn.disabled = false;
      submitBtn.textContent = this.pendingSuccessAction ? 'Verify & Place Order' : 'Verify Email';
      return;
    }

    this.currentUser = result.user;
    this.isEmailChangeVerification = false;
    this.updateNavUI();

    // Sync profile and checkout form
    if (window.CustomerUpdateProfile) {
      window.CustomerUpdateProfile.populate(this.currentUser);
    }
    const checkoutName = document.getElementById('customerName');
    const checkoutPhone = document.getElementById('customerPhone');
    const checkoutEmail = document.getElementById('customerEmail');
    if (checkoutName) checkoutName.value = this.currentUser.full_name || '';
    if (checkoutPhone) checkoutPhone.value = this.currentUser.contact_number || '';
    if (checkoutEmail) checkoutEmail.value = this.currentUser.email || '';

    this.showSuccess('customerVerifySuccess', '✓ Email verified successfully!');

    if (window.CustomerGenerateOtp) {
      window.CustomerGenerateOtp.clearTimer();
    }

    setTimeout(() => {
      this.close();
      if (typeof this.pendingSuccessAction === 'function') {
        const action = this.pendingSuccessAction;
        this.pendingSuccessAction = null;
        action(this.currentUser);
      }
    }, 700);

    submitBtn.disabled = false;
    submitBtn.textContent = this.pendingSuccessAction ? 'Verify & Place Order' : 'Verify Email';
  },

  /**
   * Handle Resend OTP using CustomerGenerateOtp module
   */
  async handleResendCode() {
    this.clearErrors();
    const result = await window.CustomerGenerateOtp.resend(this.activeEmail);

    if (result.success) {
      this.showSuccess('customerVerifySuccess', result.message || 'A fresh 6-digit code has been sent to your email.');
      this.startResendCountdown(60);
    } else {
      this.showError('customerVerifyError', result.error || 'Failed to resend code.');
    }
  },

  startResendCountdown(seconds) {
    const resendBtn = document.getElementById('customerResendBtn');
    const countdownEl = document.getElementById('customerResendCountdown');
    if (window.CustomerGenerateOtp) {
      window.CustomerGenerateOtp.startCountdown(seconds, resendBtn, countdownEl);
    }
  },

  /**
   * Open Profile View
   */
  openProfile() {
    if (!this.currentUser) {
      this.open('signin');
      return;
    }
    if (window.CustomerUpdateProfile) {
      window.CustomerUpdateProfile.populate(this.currentUser);
    }
    this.open('profile');
  },

  /**
   * Handle Profile Update Submission using CustomerUpdateProfile module
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

    const result = await window.CustomerUpdateProfile.update({
      full_name: fullName,
      contact_number: phone,
      email: email
    });

    if (!result.success) {
      this.showError('customerProfileError', result.error || 'Failed to update profile.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
      return;
    }

    // If email was changed, require OTP verification
    if (result.email_changed) {
      this.activeEmail = result.email;
      this.isEmailChangeVerification = true;

      this.switchView('verify');
      this.startResendCountdown(60);

      const emailTarget = document.getElementById('customerVerifyEmailTarget');
      if (emailTarget) emailTarget.textContent = result.email;

      const verifyBtn = document.getElementById('customerVerifySubmitBtn');
      if (verifyBtn) verifyBtn.textContent = 'Verify & Update Email';

      this.showSuccess('customerVerifySuccess', result.message || `Verification code sent to ${result.email}. Please verify to confirm.`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
      return;
    }

    // Unchanged email update
    this.currentUser = result.user;
    this.updateNavUI();

    if (window.CustomerUpdateProfile) {
      window.CustomerUpdateProfile.populate(this.currentUser);
    }

    const checkoutName = document.getElementById('customerName');
    const checkoutPhone = document.getElementById('customerPhone');
    const checkoutEmail = document.getElementById('customerEmail');
    if (checkoutName) checkoutName.value = this.currentUser.full_name || '';
    if (checkoutPhone) checkoutPhone.value = this.currentUser.contact_number || '';
    if (checkoutEmail) checkoutEmail.value = this.currentUser.email || '';

    this.showSuccess('customerProfileSuccess', '✓ Profile updated successfully!');

    setTimeout(() => {
      const profileView = document.getElementById('customerProfileView');
      if (profileView && profileView.style.display !== 'none') {
        this.close();
      }
    }, 1400);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  },

  handleLogout() {
    if (window.CustomerLogin) {
      window.CustomerLogin.logout();
    }
  }
};

window.CustomerAuth = CustomerAuth;
document.addEventListener('DOMContentLoaded', () => {
  CustomerAuth.init();
});
