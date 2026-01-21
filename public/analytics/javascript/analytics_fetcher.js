/**
 * Analytics Data Fetcher
 * Interacts with the backend Analytics API
 */
const AnalyticsFetcher = {
    /**
     * Get dashboard data
     * @param {Object} filters - Date range filters
     * @returns {Promise<Object>} The aggregated analytics data
     */
    async getDashboard(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/api/analytics/dashboard?${params}`, {
                method: 'GET'
            });
            const result = await response.json();

            if (!response.ok) {
                console.error('Failed to fetch analytics:', result);
                return { success: false, error: result.error };
            }

            return { success: true, report: result.report };
        } catch (error) {
            console.error('Error fetching analytics:', error);
            return { success: false, error: error.message };
        }
    }
};

window.AnalyticsFetcher = AnalyticsFetcher;
