const UserProfileGenerateOtp = {
    async generate(profileData = {}) {
        const response = await fetch('/api/user/profile/generate-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to generate OTP');
        }
        return data;
    }
};

window.UserProfileGenerateOtp = UserProfileGenerateOtp;
