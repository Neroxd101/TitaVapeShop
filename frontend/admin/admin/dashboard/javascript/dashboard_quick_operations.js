// Add Stock shortcuts from the dashboard.
const DashboardQuickOperations = {
    init() {
        ['quickActionAddProduct', 'headerAddProductBtn'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', event => {
                event.preventDefault();
                sessionStorage.setItem('openAddItemModal', 'true');
                window.location.href = '/inventory';
            });
        });
    }
};
