const PasswordResetVerifyOtp = {
    async verify(username, otp) {
        const response = await fetch('/api/password-reset/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, otp })
        });
        return { response, data: await response.json() };
    }
};

window.PasswordResetVerifyOtp = PasswordResetVerifyOtp;
