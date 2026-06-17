/**
 * Settings Page Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = '/';
        return;
    }

    // Initialize sidebar
    if (typeof initSidebar === 'function') initSidebar('settings');

    // Elements
    const googleStatusContainer = document.getElementById('googleStatusContainer');
    const googleActionContainer = document.getElementById('googleActionContainer');
    const userSelectorContainer = document.getElementById('userSelectorContainer');
    const userSelector = document.getElementById('userSelector');
    
    // Clear password validation errors on input
    const currentPasswordInput = document.getElementById('currentPassword');
    const currentPasswordError = document.getElementById('currentPasswordError');
    if (currentPasswordInput) {
        currentPasswordInput.addEventListener('input', () => {
            currentPasswordInput.classList.remove('input-error');
            if (currentPasswordError) {
                currentPasswordError.textContent = '';
                currentPasswordError.style.display = 'none';
            }
        });
    }

    const newPasswordInput = document.getElementById('newPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            newPasswordInput.classList.remove('input-error');
            if (newPasswordError) {
                newPasswordError.textContent = '';
                newPasswordError.style.display = 'none';
            }
        });
    }

    const confirmPasswordInput = document.getElementById('confirmPassword');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            confirmPasswordInput.classList.remove('input-error');
            if (confirmPasswordError) {
                confirmPasswordError.textContent = '';
                confirmPasswordError.style.display = 'none';
            }
        });
    }
    
    // Parse user and check if admin
    const user = JSON.parse(userStr || '{}');
    // Roles are stored as TEXT string (e.g., "admin,staff")
    const rolesStr = Array.isArray(user.roles) ? user.roles.join(',') : (user.roles || '');
    const isAdmin = rolesStr.includes('admin');
    
    // Selected user ID (for admin updates)
    let selectedUserId = null;

    // Initial Render
    renderGoogleSettings();
    if (isAdmin) {
        loadUsersList();
        userSelectorContainer.style.display = 'block';
        userSelector.addEventListener('change', handleUserSelection);
        
        // Show notification settings card and load data
        const notifSection = document.getElementById('notificationSettingsSection');
        if (notifSection) {
            notifSection.style.display = 'flex';
            loadNotificationSettings();
            setupNotificationSettingsForm();
        }
    } else {
        userSelectorContainer.style.display = 'none';
        const notifSection = document.getElementById('notificationSettingsSection');
        if (notifSection) notifSection.style.display = 'none';
    }
    renderProfileSettings();

    // Listen for storage changes (external updates)
    window.addEventListener('storage', (e) => {
        if (e.key === 'google_connected' || e.key === 'google_user') {
            renderGoogleSettings();
        }
    });

    // Listen for messages from popup
    window.addEventListener('message', (e) => {
        if (e.data.type === 'GOOGLE_AUTH_SUCCESS') {
            renderGoogleSettings();
        } else if (e.data.type === 'GOOGLE_AUTH_ERROR') {
            alert('Google Auth failed: ' + (e.data.error || 'Unknown error'));
            // Reset UI in case popup closed without clearing interval logic cleanly (though interval handles simple close)
            const btn = document.getElementById('connectBtn');
            if (btn) {
                btn.disabled = false;
                // Ideally restore original text, but simplified here:
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.38 0 8.79-3.96 8.79-8.79 0-.9 0-.82-.05-1.98z"/></svg>
                    Connect with Google
                `;
            }
        }
    });

    /**
     * Render Google Integration Status
     */
    function renderGoogleSettings() {
        const isConnected = localStorage.getItem('google_connected') === 'true';
        const user = getGoogleUser();

        if (isConnected && user) {
            // Connected State
            googleStatusContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div class="avatar-wrapper">
                        <img src="${user.picture}" alt="Avatar" class="user-avatar-large">
                        <div class="status-indicator online"></div>
                    </div>
                    <div style="text-align: center;">
                        <p style="color: var(--text-primary); font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">${user.name}</p>
                        <span class="status-badge connected">Connected</span>
                    </div>
                </div>
            `;

            googleActionContainer.innerHTML = `
                <button id="disconnectBtn" class="btn btn-disconnect btn-full">
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    Disconnect
                </button>
            `;

            document.getElementById('disconnectBtn').addEventListener('click', handleDisconnect);

        } else {
            // Disconnected State
            googleStatusContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--border);">
                         <svg width="32" height="32" viewBox="0 0 24 24" style="opacity: 0.4;"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                    </div>
                    <span class="status-badge disconnected">Not Connected</span>
                </div>
            `;

            googleActionContainer.innerHTML = `
                 <button id="connectBtn" class="btn btn-google btn-full">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.38 0 8.79-3.96 8.79-8.79 0-.9 0-.82-.05-1.98z"/></svg>
                    Connect with Google
                </button>
            `;

            document.getElementById('connectBtn').addEventListener('click', handleConnect);
        }
    }

    /**
     * Handle Disconnect Action
     */
    async function handleDisconnect() {
        if (!confirm('Are you sure you want to disconnect? Backups will stop working.')) return;

        const btn = document.getElementById('disconnectBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Disconnecting...';

        try {
            const token = localStorage.getItem('google_access_token');
            if (token) {
                await fetch('/auth/google/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
        } finally {
            // Clear storage
            localStorage.removeItem('google_connected');
            localStorage.removeItem('google_user');
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_refresh_token');
            localStorage.removeItem('google_expires_at');

            // Notify other tabs
            window.dispatchEvent(new Event('storage'));

            // Re-render
            renderGoogleSettings();
        }
    }

    /**
     * Handle Connect Action
     */
    async function handleConnect() {
        const btn = document.getElementById('connectBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small" style="margin-right: 8px;"></div> Initializing...';

        try {
            const response = await fetch('/auth/google');
            const data = await response.json();

            if (data.success && data.authUrl) {
                // Open in popup
                const width = 500;
                const height = 600;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                const popup = window.open(
                    data.authUrl,
                    'GoogleAuth',
                    `width=${width},height=${height},top=${top},left=${left}`
                );

                // Poll for popup closure (as a backup if message/storage fails)
                const checkPopup = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        // If closed but not connected, reset state
                        if (localStorage.getItem('google_connected') !== 'true') {
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                        }
                    }
                }, 1000);

            } else {
                alert('Failed to initialize Google Auth');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Auth init error:', error);
            alert('Error initializing Google Auth');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    /**
     * Helper to get user from storage
     */
    function getGoogleUser() {
        try {
            return JSON.parse(localStorage.getItem('google_user'));
        } catch {
            return null;
        }
    }

    /**
     * Load Users List (Admin Only)
     */
    async function loadUsersList() {
        try {
            const response = await fetch('/api/users/list');
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
                console.error('API Error:', errorData);
                userSelector.innerHTML = `<option value="">Error: ${errorData.error || 'Failed to load users'}</option>`;
                return;
            }
            
            const data = await response.json();
            
            if (data.success && data.users && Array.isArray(data.users)) {
                userSelector.innerHTML = '<option value="">Select a user...</option>';
                
                if (data.users.length === 0) {
                    userSelector.innerHTML = '<option value="">No users found</option>';
                    return;
                }
                
                data.users.forEach(u => {
                    const option = document.createElement('option');
                    option.value = u.id;
                    option.dataset.username = u.username;
                    option.dataset.roles = Array.isArray(u.roles) ? u.roles.join(',') : (u.roles || '');
                    option.textContent = `${u.username}${u.email ? ` (${u.email})` : ''}`;
                    userSelector.appendChild(option);
                });
            } else {
                console.error('Unexpected response format:', data);
                userSelector.innerHTML = '<option value="">Error: Invalid response format</option>';
            }
        } catch (error) {
            console.error('Error loading users list:', error);
            userSelector.innerHTML = '<option value="">Error loading users</option>';
        }
    }

    /**
     * Handle User Selection
     */
    async function handleUserSelection() {
        const userId = userSelector.value;
        selectedUserId = userId || null;
        
        if (userId) {
            await renderProfileSettings(userId);
        } else {
            await renderProfileSettings();
        }
    }

    /**
     * Toggle Profile Forms Visibility
     */
    function toggleProfileForms(show) {
        const container = document.getElementById('profileFormsContainer');
        if (!container) return;
        if (show) {
            container.classList.add('show');
        } else {
            container.classList.remove('show');
        }
    }

    /**
     * Render Profile Settings
     */
    async function renderProfileSettings(targetUserId = null) {
        // Update selected user ID if provided
        if (targetUserId) {
            selectedUserId = targetUserId;
            toggleProfileForms(true);
        } else {
            if (isAdmin) {
                selectedUserId = null;
                toggleProfileForms(false);
            } else {
                selectedUserId = user.id;
                toggleProfileForms(true);
            }
        }

        // Toggle Current Password visibility and required status
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const selectedOption = userSelector.options[userSelector.selectedIndex];
        const selectedUsername = selectedOption ? selectedOption.dataset.username : null;
        const isSelf = !isAdmin || (selectedUsername === currentUser.username);

        // Update the current username display
        const activeUsername = isSelf ? currentUser.username : selectedUsername;
        const activeRoles = isSelf 
            ? (Array.isArray(currentUser.roles) ? currentUser.roles.join(',') : (currentUser.roles || ''))
            : (selectedOption ? (selectedOption.dataset.roles || '') : '');

        const currentUsernameText = document.getElementById('currentUsernameText');
        if (currentUsernameText && activeUsername) {
            const formattedRoles = formatRoles(activeRoles);
            currentUsernameText.textContent = `${activeUsername}${formattedRoles ? ` (${formattedRoles})` : ''}`;
        }

        const currentPasswordGroup = document.getElementById('currentPasswordGroup');
        const currentPasswordInput = document.getElementById('currentPassword');
        
        if (currentPasswordGroup && currentPasswordInput) {
            if (isSelf) {
                currentPasswordGroup.style.display = 'block';
                currentPasswordInput.required = true;
            } else {
                currentPasswordGroup.style.display = 'none';
                currentPasswordInput.required = false;
                currentPasswordInput.value = '';
            }
        }

        // Setup form handlers
        setupProfileForms();
    }

    /**
     * Setup Profile Form Handlers
     */
    function setupProfileForms() {
        // Change Username Form
        const changeUsernameForm = document.getElementById('changeUsernameForm');
        if (changeUsernameForm) {
            changeUsernameForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleChangeUsername();
            });
        }

        // Change Password Form
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleChangePassword();
            });
        }
    }

    /**
     * Handle Change Username
     */
    async function handleChangeUsername() {
        const newUsername = document.getElementById('newUsername').value.trim();
        if (!newUsername) {
            alert('Please enter a new username');
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        // Step 1: Generate OTP
        const otpModal = showOTPModal('Change Username', async (otp) => {
            const btn = document.getElementById('changeUsernameBtn');
            setLoading(btn, true);

            try {
                const requestBody = {
                    new_username: newUsername,
                    otp: otp
                };
                
                const selectedOption = userSelector.options[userSelector.selectedIndex];
                const selectedUsername = selectedOption ? selectedOption.dataset.username : null;
                const isSelf = !isAdmin || (selectedUsername === currentUser.username);
                
                // Add target_user_id if admin is updating another user
                if (isAdmin && !isSelf && selectedUserId) {
                    requestBody.target_user_id = selectedUserId;
                }
                
                const response = await fetch('/api/user/profile/update-username', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to update username');
                }

                // Update local storage only if updating own profile
                if (isSelf) {
                    currentUser.username = newUsername;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                }

                // Reset form
                document.getElementById('changeUsernameForm').reset();

                closeOTPModal();
                showSuccessModal('Success', 'Your username has been updated successfully!');

                // Retrieve active roles to preserve display format
                const activeRoles = isSelf 
                    ? (Array.isArray(currentUser.roles) ? currentUser.roles.join(',') : (currentUser.roles || ''))
                    : (selectedOption ? (selectedOption.dataset.roles || '') : '');

                // Update the current username text indicator immediately
                const currentUsernameText = document.getElementById('currentUsernameText');
                if (currentUsernameText) {
                    const formattedRoles = formatRoles(activeRoles);
                    currentUsernameText.textContent = `${newUsername}${formattedRoles ? ` (${formattedRoles})` : ''}`;
                }

                // If admin, we should also update the selector's visible option text
                if (isAdmin && !isSelf && selectedOption) {
                    selectedOption.dataset.username = newUsername;
                    selectedOption.textContent = `${newUsername}${selectedOption.textContent.includes('(') ? ` (${selectedOption.textContent.split('(')[1]}` : ''}`;
                }
            } catch (error) {
                showModalError(error.message || 'Failed to update username');
            } finally {
                setLoading(btn, false);
            }
        });

        // Generate and send OTP
        try {
            const response = await fetch('/api/user/profile/generate-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate OTP');
            }

            showModalSuccess('OTP has been sent to your email address.');
        } catch (error) {
            showModalError(error.message || 'Failed to send OTP');
        }
    }

    /**
     * Handle Change Password
     */
    async function handleChangePassword() {
        const currentPasswordInput = document.getElementById('currentPassword');
        const currentPasswordError = document.getElementById('currentPasswordError');
        const newPasswordInput = document.getElementById('newPassword');
        const newPasswordError = document.getElementById('newPasswordError');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const confirmPasswordError = document.getElementById('confirmPasswordError');
        
        // Clear previous error styles
        if (currentPasswordInput) currentPasswordInput.classList.remove('input-error');
        if (currentPasswordError) {
            currentPasswordError.textContent = '';
            currentPasswordError.style.display = 'none';
        }
        if (newPasswordInput) newPasswordInput.classList.remove('input-error');
        if (newPasswordError) {
            newPasswordError.textContent = '';
            newPasswordError.style.display = 'none';
        }
        if (confirmPasswordInput) confirmPasswordInput.classList.remove('input-error');
        if (confirmPasswordError) {
            confirmPasswordError.textContent = '';
            confirmPasswordError.style.display = 'none';
        }

        const newPassword = newPasswordInput ? newPasswordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

        if (!newPassword || newPassword.length < 6) {
            if (newPasswordInput && newPasswordError) {
                newPasswordError.textContent = 'Password must be at least 6 characters long';
                newPasswordError.style.display = 'flex';
                newPasswordInput.classList.add('input-error');
                newPasswordInput.focus();
            } else {
                alert('Password must be at least 6 characters long');
            }
            return;
        }

        if (newPassword !== confirmPassword) {
            if (confirmPasswordInput && confirmPasswordError) {
                confirmPasswordError.textContent = 'Passwords do not match';
                confirmPasswordError.style.display = 'flex';
                confirmPasswordInput.classList.add('input-error');
                confirmPasswordInput.focus();
            } else {
                alert('Passwords do not match');
            }
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const selectedOption = userSelector.options[userSelector.selectedIndex];
        const selectedUsername = selectedOption ? selectedOption.dataset.username : null;
        const isSelf = !isAdmin || (selectedUsername === currentUser.username);

        const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';

        const changePasswordBtn = document.getElementById('changePasswordBtn');
        setLoading(changePasswordBtn, true);

        // Generate and send OTP (verifying password first if isSelf)
        try {
            const body = {};
            if (isSelf) {
                body.current_password = currentPassword;
            }

            const response = await fetch('/api/user/profile/generate-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate OTP');
            }

            // Step 2: Show OTP Modal since password is valid
            const otpModal = showOTPModal('Change Password', async (otp) => {
                const btn = document.getElementById('changePasswordBtn');
                setLoading(btn, true);

                try {
                    const requestBody = {
                        new_password: newPassword,
                        otp: otp
                    };
                    
                    if (isSelf) {
                        requestBody.current_password = currentPassword;
                    }
                    
                    // Add target_user_id if admin is updating another user
                    if (isAdmin && !isSelf && selectedUserId) {
                        requestBody.target_user_id = selectedUserId;
                    }
                    
                    const response = await fetch('/api/user/profile/update-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(data.error || 'Failed to update password');
                    }

                    // Reset form
                    document.getElementById('changePasswordForm').reset();

                    closeOTPModal();
                    showSuccessModal('Success', 'Your password has been updated successfully!');
                } catch (error) {
                    showModalError(error.message || 'Failed to update password');
                } finally {
                    setLoading(btn, false);
                }
            });

            showModalSuccess('OTP has been sent to your email address.');
        } catch (error) {
            const errMessage = error.message || 'Failed to send OTP';
            if (errMessage.toLowerCase().includes('password') && currentPasswordInput && currentPasswordError) {
                currentPasswordError.textContent = errMessage;
                currentPasswordError.style.display = 'flex';
                currentPasswordInput.classList.add('input-error');
                currentPasswordInput.focus();
            } else {
                alert(errMessage);
            }
        } finally {
            setLoading(changePasswordBtn, false);
        }
    }

    /**
     * Show OTP Verification Modal
     */
    function showOTPModal(title, onVerify) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('otpVerificationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'otpVerificationModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal modal-small">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" id="closeOtpModal">
                            <svg viewBox="0 0 24 24">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="otpModalError" class="alert alert-error" style="margin-bottom: 16px; display: none;">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            <span id="otpModalErrorText"></span>
                        </div>
                        <div id="otpModalSuccess" class="alert alert-success" style="margin-bottom: 16px; display: none;">
                            <svg viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            <span id="otpModalSuccessText"></span>
                        </div>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Enter the 6-digit OTP code sent to your email address.
                        </p>
                        <form id="otpVerifyForm">
                            <div class="form-group">
                                <label for="otpInput">OTP Code</label>
                                <div class="input-wrapper">
                                    <input type="text" id="otpInput" name="otp" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" style="text-align: center; font-size: 24px; letter-spacing: 8px; font-family: 'Courier New', monospace; font-weight: 600;">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary btn-full" id="verifyOtpBtn">
                                <span class="btn-text">Verify OTP</span>
                                <div class="spinner"></div>
                            </button>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close button
            document.getElementById('closeOtpModal').addEventListener('click', closeOTPModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeOTPModal();
            });

            // OTP form handler
            document.getElementById('otpVerifyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const otp = document.getElementById('otpInput').value.trim();
                if (otp.length !== 6) {
                    showModalError('Please enter a valid 6-digit OTP code');
                    return;
                }

                const btn = document.getElementById('verifyOtpBtn');
                setLoading(btn, true);

                try {
                    await onVerify(otp);
                } catch (error) {
                    showModalError(error.message || 'Verification failed');
                } finally {
                    setLoading(btn, false);
                }
            });

            // Auto-format OTP input
            document.getElementById('otpInput').addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            });
        } else {
            // Update title if modal exists
            modal.querySelector('.modal-header h3').textContent = title;
            const errorAlert = modal.querySelector('#otpModalError');
            if (errorAlert) {
                errorAlert.style.display = 'none';
                modal.querySelector('#otpModalErrorText').textContent = '';
            }
            const successAlert = modal.querySelector('#otpModalSuccess');
            if (successAlert) {
                successAlert.style.display = 'none';
                modal.querySelector('#otpModalSuccessText').textContent = '';
            }
        }

        modal.classList.add('show');
        setTimeout(() => document.getElementById('otpInput')?.focus(), 100);

        return modal;
    }

    /**
     * Close OTP Modal
     */
    function closeOTPModal() {
        const modal = document.getElementById('otpVerificationModal');
        if (modal) {
            modal.classList.remove('show');
            document.getElementById('otpInput').value = '';
            const errorAlert = modal.querySelector('#otpModalError');
            if (errorAlert) {
                errorAlert.style.display = 'none';
                modal.querySelector('#otpModalErrorText').textContent = '';
            }
            const successAlert = modal.querySelector('#otpModalSuccess');
            if (successAlert) {
                successAlert.style.display = 'none';
                modal.querySelector('#otpModalSuccessText').textContent = '';
            }
        }
    }

    function showModalSuccess(message) {
        const successAlert = document.getElementById('otpModalSuccess');
        const successText = document.getElementById('otpModalSuccessText');
        const errorAlert = document.getElementById('otpModalError');
        if (errorAlert) errorAlert.style.display = 'none';
        if (successAlert && successText) {
            successText.textContent = message;
            successAlert.className = 'alert alert-success show';
            successAlert.style.display = 'flex';
        }
    }

    function showModalError(message) {
        const errorAlert = document.getElementById('otpModalError');
        const errorText = document.getElementById('otpModalErrorText');
        const successAlert = document.getElementById('otpModalSuccess');
        if (successAlert) successAlert.style.display = 'none';
        if (errorAlert && errorText) {
            errorText.textContent = message;
            errorAlert.className = 'alert alert-error show';
            errorAlert.style.display = 'flex';
        }
    }

    function showSuccessModal(title, message) {
        let modal = document.getElementById('successNotificationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'successNotificationModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal modal-small" style="text-align: center;">
                    <div class="modal-body" style="padding: 32px 24px;">
                        <div style="width: 64px; height: 64px; background: rgba(0, 212, 170, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; border: 2px solid rgba(0, 212, 170, 0.3);">
                            <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: var(--success);">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <h3 style="color: var(--text-primary); font-size: 20px; font-weight: 600; margin-bottom: 12px;" id="successModalTitle"></h3>
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; line-height: 1.5;" id="successModalMessage"></p>
                        <button class="btn btn-primary btn-full" id="closeSuccessModalBtn">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('closeSuccessModalBtn').addEventListener('click', () => {
                modal.classList.remove('show');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('show');
            });
        }

        modal.querySelector('#successModalTitle').textContent = title;
        modal.querySelector('#successModalMessage').textContent = message;
        modal.classList.add('show');
    }

    function formatRoles(rolesString) {
        if (!rolesString) return '';
        return rolesString.split(',')
            .map(r => r.trim())
            .filter(Boolean)
            .map(r => r.charAt(0).toUpperCase() + r.slice(1))
            .join(', ');
    }

    /**
     * Load Notification Settings (Admin Only)
     */
    async function loadNotificationSettings() {
        try {
            const response = await fetch('/api/settings/notifications');
            const result = await response.json();
            
            if (result.success && result.data) {
                document.getElementById('lowStockNotificationsEnabled').checked = result.data.low_stock_notifications_enabled;
                document.getElementById('lowStockThreshold').value = result.data.low_stock_threshold;
                document.getElementById('lowStockEmail').value = result.data.low_stock_notification_email;
            } else {
                console.error('Failed to load notification settings:', result.error);
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }

    /**
     * Setup Notification Settings Form Submit Handler (Admin Only)
     */
    function setupNotificationSettingsForm() {
        const form = document.getElementById('notificationSettingsForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveNotificationSettingsBtn');
                setLoading(btn, true);

                const enabled = document.getElementById('lowStockNotificationsEnabled').checked;
                const threshold = parseInt(document.getElementById('lowStockThreshold').value, 10);
                const email = document.getElementById('lowStockEmail').value.trim();

                try {
                    const response = await fetch('/api/settings/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            low_stock_threshold: threshold,
                            low_stock_notifications_enabled: enabled,
                            low_stock_notification_email: email
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(data.error || 'Failed to save notification settings');
                    }

                    showSuccessModal('Success', 'Notification settings saved successfully!');
                } catch (error) {
                    alert(error.message || 'Failed to save notification settings');
                } finally {
                    setLoading(btn, false);
                }
            });
        }
    }

    /**
     * Set Loading State
     */
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
});
