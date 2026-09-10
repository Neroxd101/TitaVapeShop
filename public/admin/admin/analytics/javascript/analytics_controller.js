/**
 * Analytics Controller
 * Orchestrates data fetching and visualization for the analytics page
 */

class AnalyticsController {
    constructor() {
        this.state = {
            timeRange: '7days',
            stats: null,
            report: null
        };
    }

    async init() {
        // Authenticate
        const user = localStorage.getItem('user');
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Initialize sidebar
        if (typeof initSidebar === 'function') initSidebar('analytics');

        // Initialize print module
        if (window.AnalyticsPrint) {
            AnalyticsPrint.init(this);
        }

        this.setupEventListeners();
        await this.loadDashboardData();
    }

    setupEventListeners() {
        const timeRangeSelect = document.getElementById('timeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.state.timeRange = e.target.value;
                this.loadDashboardData();
            });
        }
    }

    async loadDashboardData() {
        try {
            // Calculate date range based on selection
            const dateRange = this.getDateRange(this.state.timeRange);

            // Fetch all analytics data from the unified Edge Function
            const response = await AnalyticsFetcher.getDashboard(dateRange);

            if (response.success) {
                const data = response.report;
                this.state.report = data;

                // Render everything using separate modules
                if (window.AnalyticsStats) {
                    AnalyticsStats.render(data);
                }
                
                if (window.AnalyticsRevenueTrend) {
                    AnalyticsRevenueTrend.render(data.dailyRevenue || []);
                }
                
                if (window.AnalyticsTopProducts) {
                    AnalyticsTopProducts.render(data.topProducts || []);
                }
                
                if (window.AnalyticsCategoryPerformance) {
                    AnalyticsCategoryPerformance.render(data.categoryStats || {});
                }
                
                if (window.AnalyticsProductDetails) {
                    AnalyticsProductDetails.render(data.topProducts || []);
                }
            } else {
                // Show error in UI if available
                console.error('Analytics loading failed:', response.error);
            }

        } catch (error) {
            console.error('Error loading analytics data:', error);
        }
    }

    getDateRange(range) {
        const end = new Date();
        const start = new Date();

        switch (range) {
            case '7days': start.setDate(end.getDate() - 7); break;
            case '30days': start.setDate(end.getDate() - 30); break;
            case '90days': start.setDate(end.getDate() - 90); break;
            default: start.setDate(end.getDate() - 7);
        }

        return {
            start_date: start.toISOString(),
            end_date: end.toISOString()
        };
    }

}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const controller = new AnalyticsController();
    controller.init();
});
