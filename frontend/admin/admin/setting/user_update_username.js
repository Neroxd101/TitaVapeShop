const UserUpdateUsername = {
    async update(profileData) {
        const response = await fetch('/api/user/profile/update-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update username');
        }
        return data;
    }
};

window.UserUpdateUsername = UserUpdateUsername;
