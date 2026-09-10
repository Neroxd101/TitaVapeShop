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
  resetEmail: '',
  resetOtp: '',
  isEmailChangeVerification: false,

  /**
   * Initialize Customer Auth Modal & Session
   */
  async init() {
    const container = document.getElementById('customer-auth-modal-container');
    if (!container) return;

    try {
      let res = await fetch('/customer/customer-auth-modal.html');
      if (!res.ok) {
        res = await fetch('/catalog/customer-auth-modal.html');
      }
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
   * @param {'signin'|'register'|'verify'|'profile'|'privacy'|'forgot'|'reset-otp'|'reset-pwd'} view
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
    const forgotPwdView = document.getElementById('customerForgotPwdView');
    const resetOtpView = document.getElementById('customerResetOtpView');
    const resetPwdView = document.getElementById('customerResetPwdView');

    const isResetOtp = view === 'reset-otp' || view === 'reset';
    const isResetPwd = view === 'reset-pwd';

    const modalContent = document.querySelector('.customer-auth-modal-content');
    if (modalContent) {
      modalContent.classList.toggle('privacy-active', view === 'privacy');
      modalContent.classList.toggle('signin-active', view === 'signin');
      modalContent.classList.toggle('verify-active', view === 'verify');
      modalContent.classList.toggle('register-active', view === 'register');
      modalContent.classList.toggle('profile-active', view === 'profile');
      modalContent.classList.toggle('forgot-active', view === 'forgot');
      modalContent.classList.toggle('reset-otp-active', isResetOtp);
      modalContent.classList.toggle('reset-pwd-active', isResetPwd);
    }

    if (signInView) signInView.style.display = view === 'signin' ? 'block' : 'none';
    if (regView) regView.style.display = view === 'register' ? 'block' : 'none';
    if (verifyView) verifyView.style.display = view === 'verify' ? 'block' : 'none';
    if (privacyView) privacyView.style.display = view === 'privacy' ? 'block' : 'none';
    if (profileView) profileView.style.display = view === 'profile' ? 'block' : 'none';
    if (forgotPwdView) forgotPwdView.style.display = view === 'forgot' ? 'block' : 'none';
    if (resetOtpView) resetOtpView.style.display = isResetOtp ? 'block' : 'none';
    if (resetPwdView) resetPwdView.style.display = isResetPwd ? 'block' : 'none';

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
      // Profile rows start collapsed
    } else if (view === 'forgot') {
      const forgotEmail = document.getElementById('customerForgotEmail');
      const signInEmail = document.getElementById('customerSignInEmail');
      if (forgotEmail) {
        if (signInEmail && signInEmail.value.trim() && !forgotEmail.value) {
          forgotEmail.value = signInEmail.value.trim();
        }
        setTimeout(() => forgotEmail.focus(), 50);
      }
    } else if (isResetOtp) {
      const resetOtpInput = document.getElementById('customerResetOtpInput');
      const emailTarget = document.getElementById('customerResetOtpEmailTarget');
      if (emailTarget) emailTarget.textContent = this.resetEmail || '';
      if (resetOtpInput) {
        resetOtpInput.value = '';
        setTimeout(() => resetOtpInput.focus(), 50);
      }
    } else if (isResetPwd) {
      const newPwd = document.getElementById('customerResetNewPassword');
      const confirmPwd = document.getElementById('customerResetConfirmPassword');
      if (newPwd) {
        newPwd.value = '';
        newPwd.type = 'password';
        setTimeout(() => newPwd.focus(), 50);
      }
      if (confirmPwd) confirmPwd.value = '';
      const toggleBtn = document.getElementById('toggleCustomerResetPassword');
      if (toggleBtn) {
        toggleBtn.classList.remove('is-visible');
        toggleBtn.setAttribute('aria-pressed', 'false');
        toggleBtn.setAttribute('aria-label', 'Show password');
      }
      ['pwdResetReqLength', 'pwdResetReqUpper', 'pwdResetReqLower', 'pwdResetReqNumber', 'pwdResetReqSymbol'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('met');
      });
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
      'customerProfileSuccess',
      'customerForgotPwdError',
      'customerForgotPwdSuccess',
      'customerResetOtpError',
      'customerResetOtpSuccess',
      'customerResetPwdError',
      'customerResetPwdSuccess',
      'customerChangePwdError',
      'customerChangePwdSuccess'
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

    // Forgot Password navigation switchers
    const switchToForgotPwdBtn = document.getElementById('switchToForgotPwdBtn');
    if (switchToForgotPwdBtn) {
      switchToForgotPwdBtn.addEventListener('click', () => this.switchView('forgot'));
    }

    const switchToSignInFromForgotBtn = document.getElementById('switchToSignInFromForgotBtn');
    if (switchToSignInFromForgotBtn) {
      switchToSignInFromForgotBtn.addEventListener('click', () => this.switchView('signin'));
    }

    const switchToSignInFromResetOtpBtn = document.getElementById('switchToSignInFromResetOtpBtn');
    if (switchToSignInFromResetOtpBtn) {
      switchToSignInFromResetOtpBtn.addEventListener('click', () => this.switchView('signin'));
    }

    const switchToSignInFromResetBtn = document.getElementById('switchToSignInFromResetBtn');
    if (switchToSignInFromResetBtn) {
      switchToSignInFromResetBtn.addEventListener('click', () => this.switchView('signin'));
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
      window.CustomerCheckPhone.attachLiveValidation(profilePhoneInput, profileErrorEl, null, () => this.currentUser?.id);
    }
    if (window.CustomerCheckEmail && profileEmailInput) {
      window.CustomerCheckEmail.attachLiveValidation(profileEmailInput, profileErrorEl, null, () => this.currentUser?.id);
    }

    // Setup single-row collapsible edit toggles for Name, Phone, Email
    ['Name', 'Phone', 'Email'].forEach(field => {
      const toggleBtn = document.getElementById(`btnToggleEdit${field}`);
      const cancelBtn = document.getElementById(`btnCancelEdit${field}`);
      const form = document.getElementById(`formEditProfile${field}`);
      const input = document.getElementById(`customerProfile${field}`);

      if (toggleBtn && form) {
        toggleBtn.addEventListener('click', () => {
          form.style.display = 'block';
          toggleBtn.style.display = 'none';
          this.clearErrors();

          if (input) {
            if (field === 'Name') input.value = this.currentUser?.full_name || '';
            if (field === 'Phone') input.value = this.currentUser?.contact_number || '';
            if (field === 'Email') input.value = this.currentUser?.email || '';
            setTimeout(() => input.focus(), 50);
          }
        });
      }

      if (cancelBtn && form && toggleBtn) {
        cancelBtn.addEventListener('click', () => {
          form.style.display = 'none';
          toggleBtn.style.display = 'inline-flex';
          this.clearErrors();

          if (input) {
            if (field === 'Name') input.value = this.currentUser?.full_name || '';
            if (field === 'Phone') input.value = this.currentUser?.contact_number || '';
            if (field === 'Email') input.value = this.currentUser?.email || '';
          }
        });
      }

      if (form) {
        form.addEventListener('submit', (e) => this.handleSaveProfileField(field.toLowerCase(), e));
      }
    });

    const closeProfileModalBtn = document.getElementById('customerCloseProfileModalBtn');
    if (closeProfileModalBtn) {
      closeProfileModalBtn.addEventListener('click', () => this.close());
    }

    // Change Password Section Toggling
    const openChangePwdBtn = document.getElementById('customerOpenChangePwdBtn');
    const changePwdForm = document.getElementById('customerChangePwdForm');
    const cancelChangePwdBtn = document.getElementById('customerCancelChangePwdBtn');

    if (openChangePwdBtn && changePwdForm) {
      openChangePwdBtn.addEventListener('click', () => {
        changePwdForm.style.display = 'block';
        openChangePwdBtn.style.display = 'none';
        const currentInput = document.getElementById('customerCurrentPassword');
        if (currentInput) setTimeout(() => currentInput.focus(), 50);
      });
    }

    if (cancelChangePwdBtn && changePwdForm && openChangePwdBtn) {
      cancelChangePwdBtn.addEventListener('click', () => {
        changePwdForm.reset();
        changePwdForm.style.display = 'none';
        openChangePwdBtn.style.display = 'inline-flex';
        this.clearErrors();
        ['pwdChangeReqLength', 'pwdChangeReqUpper', 'pwdChangeReqLower', 'pwdChangeReqNumber', 'pwdChangeReqSymbol'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.remove('met');
        });
      });
    }

    // Password Visibility Toggles for Change Password
    const toggleCurrentPwd = document.getElementById('toggleCustomerCurrentPassword');
    const currentPwdInput = document.getElementById('customerCurrentPassword');
    if (toggleCurrentPwd && currentPwdInput) {
      toggleCurrentPwd.addEventListener('click', (e) => {
        e.preventDefault();
        const isPwd = currentPwdInput.type === 'password';
        currentPwdInput.type = isPwd ? 'text' : 'password';
        toggleCurrentPwd.classList.toggle('is-visible', isPwd);
        toggleCurrentPwd.setAttribute('aria-pressed', isPwd ? 'true' : 'false');
        toggleCurrentPwd.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
      });
    }

    const toggleNewPwd = document.getElementById('toggleCustomerNewPassword');
    const newPwdInput = document.getElementById('customerNewPassword');
    if (toggleNewPwd && newPwdInput) {
      toggleNewPwd.addEventListener('click', (e) => {
        e.preventDefault();
        const isPwd = newPwdInput.type === 'password';
        newPwdInput.type = isPwd ? 'text' : 'password';
        toggleNewPwd.classList.toggle('is-visible', isPwd);
        toggleNewPwd.setAttribute('aria-pressed', isPwd ? 'true' : 'false');
        toggleNewPwd.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
      });
    }

    // Live Password Criteria Badges on New Password
    if (newPwdInput) {
      newPwdInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const bLen = document.getElementById('pwdChangeReqLength');
        const bUp = document.getElementById('pwdChangeReqUpper');
        const bLow = document.getElementById('pwdChangeReqLower');
        const bNum = document.getElementById('pwdChangeReqNumber');
        const bSym = document.getElementById('pwdChangeReqSymbol');

        if (bLen) bLen.classList.toggle('met', val.length >= 8);
        if (bUp) bUp.classList.toggle('met', /[A-Z]/.test(val));
        if (bLow) bLow.classList.toggle('met', /[a-z]/.test(val));
        if (bNum) bNum.classList.toggle('met', /[0-9]/.test(val));
        if (bSym) bSym.classList.toggle('met', /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(val));
      });
    }

    // Change Password Form Submission
    if (changePwdForm) {
      changePwdForm.addEventListener('submit', (e) => this.handleChangePassword(e));
    }

    // Forgot Password Form Submission (Step 1)
    const forgotPwdForm = document.getElementById('customerForgotPwdForm');
    if (forgotPwdForm) {
      forgotPwdForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    // Verify Reset OTP Form Submission (Step 2)
    const resetOtpForm = document.getElementById('customerResetOtpForm');
    const resetOtpInput = document.getElementById('customerResetOtpInput');
    if (resetOtpInput) {
      resetOtpInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        if (e.target.value.length === 6 && resetOtpForm) {
          resetOtpForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }
    if (resetOtpForm) {
      resetOtpForm.addEventListener('submit', (e) => this.handleVerifyResetOtp(e));
    }

    // Resend Reset Code Button
    const resetResendBtn = document.getElementById('customerResetResendBtn');
    if (resetResendBtn) {
      resetResendBtn.addEventListener('click', () => this.handleResendResetOtp());
    }

    // Reset Password Form Submission (Step 3)
    const resetPwdForm = document.getElementById('customerResetPwdForm');
    if (resetPwdForm) {
      resetPwdForm.addEventListener('submit', (e) => this.handleResetPassword(e));
    }

    // Reset Password Visibility Toggle
    const toggleResetPassword = document.getElementById('toggleCustomerResetPassword');
    const resetPasswordInput = document.getElementById('customerResetNewPassword');
    if (toggleResetPassword && resetPasswordInput) {
      toggleResetPassword.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = resetPasswordInput.type === 'password';
        resetPasswordInput.type = isPassword ? 'text' : 'password';
        toggleResetPassword.classList.toggle('is-visible', isPassword);
        toggleResetPassword.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        toggleResetPassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }

    // Live Password Criteria Badges on Reset Password
    if (resetPasswordInput) {
      resetPasswordInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const bLen = document.getElementById('pwdResetReqLength');
        const bUp = document.getElementById('pwdResetReqUpper');
        const bLow = document.getElementById('pwdResetReqLower');
        const bNum = document.getElementById('pwdResetReqNumber');
        const bSym = document.getElementById('pwdResetReqSymbol');

        if (bLen) bLen.classList.toggle('met', val.length >= 8);
        if (bUp) bUp.classList.toggle('met', /[A-Z]/.test(val));
        if (bLow) bLow.classList.toggle('met', /[a-z]/.test(val));
        if (bNum) bNum.classList.toggle('met', /[0-9]/.test(val));
        if (bSym) bSym.classList.toggle('met', /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(val));
      });
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
    const changePwdForm = document.getElementById('customerChangePwdForm');
    const openChangePwdBtn = document.getElementById('customerOpenChangePwdBtn');
    if (changePwdForm) {
      changePwdForm.reset();
      changePwdForm.style.display = 'none';
    }
    if (openChangePwdBtn) {
      openChangePwdBtn.style.display = 'inline-flex';
    }
    this.open('profile');
  },

  /**
   * Handle Profile Field Update Submission using CustomerUpdateProfile module
   */
  async handleSaveProfileField(fieldKey, e) {
    if (e) e.preventDefault();
    this.clearErrors();

    if (!this.currentUser) return;

    let fullName = this.currentUser.full_name || '';
    let phone = this.currentUser.contact_number || '';
    let email = (this.currentUser.email || '').toLowerCase();

    let submitBtn = null;
    let collapseForm = null;
    let toggleBtn = null;

    if (fieldKey === 'name') {
      const input = document.getElementById('customerProfileName');
      submitBtn = document.getElementById('btnSaveProfileName');
      collapseForm = document.getElementById('formEditProfileName');
      toggleBtn = document.getElementById('btnToggleEditName');
      const val = input ? input.value.trim() : '';
      if (!val || val.length < 2) {
        this.showError('customerProfileError', 'Please enter your full name (at least 2 characters).');
        if (input) input.focus();
        return;
      }
      fullName = val;
    } else if (fieldKey === 'phone') {
      const input = document.getElementById('customerProfilePhone');
      submitBtn = document.getElementById('btnSaveProfilePhone');
      collapseForm = document.getElementById('formEditProfilePhone');
      toggleBtn = document.getElementById('btnToggleEditPhone');
      const val = input ? input.value.trim() : '';
      const phonePattern = /^(09|\+639)\d{9}$/;
      if (!val || !phonePattern.test(val)) {
        this.showError('customerProfileError', 'Please enter a valid 11-digit mobile number (e.g. 09123456789).');
        if (input) input.focus();
        return;
      }
      phone = val;
    } else if (fieldKey === 'email') {
      const input = document.getElementById('customerProfileEmail');
      submitBtn = document.getElementById('btnSaveProfileEmail');
      collapseForm = document.getElementById('formEditProfileEmail');
      toggleBtn = document.getElementById('btnToggleEditEmail');
      const val = input ? input.value.trim().toLowerCase() : '';
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!val || !emailPattern.test(val)) {
        this.showError('customerProfileError', 'Please enter a valid email address.');
        if (input) input.focus();
        return;
      }
      email = val;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const result = await window.CustomerUpdateProfile.update({
        full_name: fullName,
        contact_number: phone,
        email: email
      });

      if (!result.success) {
        this.showError('customerProfileError', result.error || 'Failed to update profile.');
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
        return;
      }

      // Unchanged email update - save succeeded directly
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

      if (collapseForm) collapseForm.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'inline-flex';

      this.showSuccess('customerProfileSuccess', '✓ Profile updated successfully!');
    } catch (err) {
      console.error('[Customer Auth] Save profile field error:', err);
      this.showError('customerProfileError', err.message || 'An unexpected error occurred.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
      }
    }
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    this.clearErrors();

    const emailInput = document.getElementById('customerForgotEmail');
    const email = emailInput ? emailInput.value.trim() : '';
    const submitBtn = document.getElementById('customerForgotSubmitBtn');

    if (!email) {
      this.showError('customerForgotPwdError', 'Please enter your email address.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Code...';
    }

    try {
      if (!window.CustomerResetPassword) {
        throw new Error('Customer reset password module is not loaded.');
      }
      const res = await window.CustomerResetPassword.requestReset(email);
      if (res && res.success) {
        this.resetEmail = email;
        this.switchView('reset-otp');
        this.showSuccess('customerResetOtpSuccess', 'Verification code sent! Please check your email.');
      } else {
        this.showError('customerForgotPwdError', res?.error || 'Failed to send reset code.');
      }
    } catch (err) {
      console.error('[Customer Auth] Forgot password error:', err);
      this.showError('customerForgotPwdError', err.message || 'An unexpected error occurred.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Code';
      }
    }
  },

  async handleVerifyResetOtp(e) {
    e.preventDefault();
    this.clearErrors();

    const otpInput = document.getElementById('customerResetOtpInput');
    const otp = otpInput ? otpInput.value.trim() : '';
    const submitBtn = document.getElementById('customerResetOtpSubmitBtn');

    if (!otp || otp.length !== 6) {
      this.showError('customerResetOtpError', 'Please enter the 6-digit verification code sent to your email.');
      if (otpInput) otpInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';
    }

    try {
      if (!window.CustomerResetPassword) {
        throw new Error('Customer reset password module is not loaded.');
      }
      const res = await window.CustomerResetPassword.verifyCode(this.resetEmail, otp);
      if (res && res.success) {
        this.resetOtp = otp;
        this.switchView('reset-pwd');
        this.showSuccess('customerResetPwdSuccess', 'Code verified! Now choose a new password.');
      } else {
        this.showError('customerResetOtpError', res?.error || 'Invalid or expired verification code.');
      }
    } catch (err) {
      console.error('[Customer Auth] Verify OTP error:', err);
      this.showError('customerResetOtpError', err.message || 'An unexpected error occurred.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Code';
      }
    }
  },

  async handleResendResetOtp() {
    this.clearErrors();
    const resendBtn = document.getElementById('customerResetResendBtn');
    if (!this.resetEmail) {
      this.switchView('forgot');
      return;
    }

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resending...';
    }

    try {
      if (!window.CustomerResetPassword) {
        throw new Error('Customer reset password module is not loaded.');
      }
      const res = await window.CustomerResetPassword.requestReset(this.resetEmail);
      if (res && res.success) {
        this.showSuccess('customerResetOtpSuccess', 'New 6-digit code has been sent to your email.');
      } else {
        this.showError('customerResetOtpError', res?.error || 'Failed to resend code.');
      }
    } catch (err) {
      this.showError('customerResetOtpError', err.message || 'Failed to resend code.');
    } finally {
      if (resendBtn) {
        let count = 30;
        const interval = setInterval(() => {
          if (count <= 0) {
            clearInterval(interval);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
          } else {
            resendBtn.textContent = `Resend in ${count}s`;
            count--;
          }
        }, 1000);
      }
    }
  },

  async handleResetPassword(e) {
    e.preventDefault();
    this.clearErrors();

    const newPwdInput = document.getElementById('customerResetNewPassword');
    const confirmPwdInput = document.getElementById('customerResetConfirmPassword');
    const submitBtn = document.getElementById('customerResetSubmitBtn');

    const newPassword = newPwdInput ? newPwdInput.value : '';
    const confirmPassword = confirmPwdInput ? confirmPwdInput.value : '';
    const otp = this.resetOtp;

    if (!otp) {
      this.showError('customerResetPwdError', 'Session expired. Please verify your OTP code again.');
      this.switchView('reset-otp');
      return;
    }

    if (!newPassword) {
      this.showError('customerResetPwdError', 'Please enter a new password.');
      if (newPwdInput) newPwdInput.focus();
      return;
    }

    // Password criteria validation
    const hasLen = newPassword.length >= 8;
    const hasUp = /[A-Z]/.test(newPassword);
    const hasLow = /[a-z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSym = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword);

    if (!hasLen || !hasUp || !hasLow || !hasNum || !hasSym) {
      this.showError('customerResetPwdError', 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
      if (newPwdInput) newPwdInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showError('customerResetPwdError', 'Passwords do not match.');
      if (confirmPwdInput) confirmPwdInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Password...';
    }

    try {
      if (!window.CustomerResetPassword) {
        throw new Error('Customer reset password module is not loaded.');
      }
      const res = await window.CustomerResetPassword.confirmReset(this.resetEmail, otp, newPassword);
      if (res && res.success) {
        this.showSuccess('customerResetPwdSuccess', 'Password successfully reset! You can now sign in.');
        setTimeout(() => {
          const signInEmail = document.getElementById('customerSignInEmail');
          if (signInEmail && this.resetEmail) {
            signInEmail.value = this.resetEmail;
          }
          this.switchView('signin');
          this.showSuccess('customerSignInError', 'Password reset successfully. Please sign in with your new password.');
        }, 1500);
      } else {
        this.showError('customerResetPwdError', res?.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('[Customer Auth] Reset password error:', err);
      this.showError('customerResetPwdError', err.message || 'An unexpected error occurred.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save New Password';
      }
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    this.clearErrors();

    const currentPwdInput = document.getElementById('customerCurrentPassword');
    const newPwdInput = document.getElementById('customerNewPassword');
    const confirmPwdInput = document.getElementById('customerConfirmNewPassword');
    const submitBtn = document.getElementById('customerChangePwdSubmitBtn');
    const form = document.getElementById('customerChangePwdForm');
    const openBtn = document.getElementById('customerOpenChangePwdBtn');

    const currentPassword = currentPwdInput ? currentPwdInput.value : '';
    const newPassword = newPwdInput ? newPwdInput.value : '';
    const confirmPassword = confirmPwdInput ? confirmPwdInput.value : '';

    if (!currentPassword) {
      this.showError('customerChangePwdError', 'Please enter your current password.');
      if (currentPwdInput) currentPwdInput.focus();
      return;
    }

    if (!newPassword) {
      this.showError('customerChangePwdError', 'Please enter a new password.');
      if (newPwdInput) newPwdInput.focus();
      return;
    }

    const hasLen = newPassword.length >= 8;
    const hasUp = /[A-Z]/.test(newPassword);
    const hasLow = /[a-z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSym = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword);

    if (!hasLen || !hasUp || !hasLow || !hasNum || !hasSym) {
      this.showError('customerChangePwdError', 'New password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
      if (newPwdInput) newPwdInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showError('customerChangePwdError', 'New passwords do not match.');
      if (confirmPwdInput) confirmPwdInput.focus();
      return;
    }

    if (currentPassword === newPassword) {
      this.showError('customerChangePwdError', 'New password cannot be identical to current password.');
      if (newPwdInput) newPwdInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating Password...';
    }

    try {
      if (!window.CustomerChangePassword) {
        throw new Error('Customer change password module is not loaded.');
      }
      const res = await window.CustomerChangePassword.changePassword(currentPassword, newPassword, confirmPassword);
      if (res && res.success) {
        this.showSuccess('customerChangePwdSuccess', '✓ Password updated successfully!');
        if (form) form.reset();
        ['pwdChangeReqLength', 'pwdChangeReqUpper', 'pwdChangeReqLower', 'pwdChangeReqNumber', 'pwdChangeReqSymbol'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.remove('met');
        });
        setTimeout(() => {
          if (form) form.style.display = 'none';
          if (openBtn) openBtn.style.display = 'inline-flex';
          this.clearErrors();
        }, 1500);
      } else {
        this.showError('customerChangePwdError', res?.error || 'Failed to update password.');
      }
    } catch (err) {
      console.error('[Customer Auth] Change password error:', err);
      this.showError('customerChangePwdError', err.message || 'An unexpected error occurred.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
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
