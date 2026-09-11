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
                
                // Show user-friendly error message
                if (result.message) {
                    alert(`Analytics Error: ${result.message}\n\nPlease check the browser console for details.`);
                } else if (result.error) {
                    alert(`Analytics Error: ${result.error}\n\nPlease check the browser console for details.`);
                } else {
                    alert('Failed to load analytics data. Please check the browser console for details.');
                }
                
                return { success: false, error: result.error || result.message || 'Unknown error' };
            }

            // Check if report exists
            if (!result.report) {
                console.error('Invalid response format:', result);
                alert('Analytics Error: Invalid response format. Please check the browser console.');
                return { success: false, error: 'Invalid response format' };
            }

            return { success: true, report: result.report };
        } catch (error) {
            console.error('Error fetching analytics:', error);
            alert(`Network Error: ${error.message}\n\nPlease check your connection and try again.`);
            return { success: false, error: error.message };
        }
    }
};

window.AnalyticsFetcher = AnalyticsFetcher;
