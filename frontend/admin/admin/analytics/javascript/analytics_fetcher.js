/** Shared transport and orchestration for the individual analytics clients. */
const AnalyticsFetcher = {
    async request(endpoint, field, filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`/api/analytics/${endpoint}?${params}`, {
            method: 'GET',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok || !result || !result.success) {
            throw new Error(result?.error || result?.message || 'Failed to fetch ' + endpoint);
        }
        if (!Object.prototype.hasOwnProperty.call(result, field)) {
            throw new Error('Invalid response format for ' + endpoint);
        }
        return result;
    },

    async getDashboard(filters = {}) {
        try {
            const results = await Promise.all([
                window.AnalyticsTotalProfit.getData(filters),
                window.AnalyticsTotalOrders.getData(filters),
                window.AnalyticsItemsSold.getData(filters),
                window.AnalyticsGrossSales.getData(filters),
                window.AnalyticsRevenueTrend.getData(filters),
                window.AnalyticsTopProducts.getData(filters),
                window.AnalyticsCategoryStats.getData(filters)
            ]);
            const report = { rawSales: [] };
            for (const { success, ...data } of results) Object.assign(report, data);
            return { success: true, report };
        } catch (error) {
            console.error('Error fetching analytics:', error);
            alert('Analytics Error: ' + error.message);
            return { success: false, error: error.message };
        }
    }
};
window.AnalyticsFetcher = AnalyticsFetcher;
