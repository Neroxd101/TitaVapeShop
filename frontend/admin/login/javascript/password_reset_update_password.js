const PasswordResetUpdatePassword = {
    async update(tokenId, newPassword) {
        const response = await fetch('/api/password-reset/reset', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_id: tokenId, new_password: newPassword })
        });
        return { response, data: await response.json() };
    }
};

window.PasswordResetUpdatePassword = PasswordResetUpdatePassword;
