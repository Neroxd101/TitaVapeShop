// Transactions Controller
// Orchestrates Data and UI

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Initialize sidebar and header
    if (typeof initSidebar === 'function') initSidebar('transactions');
    if (window.HeaderStatus && HeaderStatus.init) HeaderStatus.init();

    // Initialize Modules
    const data = new TransactionsData();
    const ui = new TransactionsUI();

    // Bind UI Events
    ui.bindEvents({
        onApplyFilters: (filters) => {
            data.updateFilters(filters);
            loadData();
        },
        onResetFilters: () => {
            data.resetFilters();
            loadData();
        },
        onPrevPage: () => {
            data.prevPage();
            loadData();
        },
        onNextPage: () => {
            data.nextPage();
            loadData();
        }
    });

    // Initial Load
    await loadData();

    // Core Logic
    async function loadData() {
        ui.setLoading(true);
        try {
            const result = await data.fetchTransactions();

            if (result && result.success) {
                const { transactions, total, limit, offset } = data.getState();
                ui.renderTransactions(transactions);

                // Use state values or result values
                ui.updatePagination(data.state.total, data.state.filters.limit, data.state.filters.offset);
            } else {
                ui.showError(result?.error);
            }
        } catch (error) {
            console.error('Controller Error:', error);
            ui.showError(error.message);
        } finally {
            ui.setLoading(false);
        }
    }
});
