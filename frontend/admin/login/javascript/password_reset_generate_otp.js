const PasswordResetGenerateOtp = {
    async request(username) {
        const response = await fetch('/api/password-reset/request', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return { response, data: await response.json() };
    }
};

window.PasswordResetGenerateOtp = PasswordResetGenerateOtp;
