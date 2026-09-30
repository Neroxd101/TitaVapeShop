document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('user')) {
        window.location.href = '/login';
        return;
    }

    await initSidebar('settings');
});
