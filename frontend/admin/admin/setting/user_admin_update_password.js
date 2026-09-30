const UserAdminUpdatePassword = {
    async update(profileData) {
        const response = await fetch('/api/user/profile/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update password');
        }
        return data;
    }
};

window.UserAdminUpdatePassword = UserAdminUpdatePassword;
