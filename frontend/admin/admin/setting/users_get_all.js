const UsersGetAll = {
    async get() {
        const response = await fetch('/api/users/list');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch users');
        return data;
    }
};

window.UsersGetAll = UsersGetAll;
