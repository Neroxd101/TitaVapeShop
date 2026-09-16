/**
 * Analytics Controller
 * Orchestrates data fetching and visualization for the analytics page
 */

class AnalyticsController {
    constructor() {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const dateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        this.state = {
            dateFrom: dateValue(start),
            dateTo: dateValue(end),
            reportRange: null,
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
        const from = document.getElementById('analyticsDateFrom');
        const to = document.getElementById('analyticsDateTo');
        from.value = this.state.dateFrom;
        to.value = this.state.dateTo;
        const syncDateDisplays = () => {
            [from, to].forEach(input => {
                const [year, month, day] = input.value.split('-');
                input.nextElementSibling.textContent = input.value ? `${month}/${day}/${year}` : 'mm/dd/yyyy';
            });
        };
        syncDateDisplays();
        from.addEventListener('input', syncDateDisplays);
        to.addEventListener('input', syncDateDisplays);
        from.max = to.value;
        to.min = from.value;
        const updateDates = () => {
            syncDateDisplays();
            from.max = to.value;
            to.min = from.value;
            if (!from.reportValidity() || !to.reportValidity()) return;
            this.state.dateFrom = from.value;
            this.state.dateTo = to.value;
            this.loadDashboardData();
        };
        from.addEventListener('change', updateDates);
        to.addEventListener('change', updateDates);
    }

    async loadDashboardData() {
        const requestId = this.requestId = (this.requestId || 0) + 1;
        try {
            const reportRange = { from: this.state.dateFrom, to: this.state.dateTo };
            const dateRange = this.getDateRange();

            // Fetch all analytics data from the unified Edge Function
            const response = await AnalyticsFetcher.getDashboard(dateRange);
            if (requestId !== this.requestId) return;

            if (response.success) {
                const data = response.report;
                this.state.report = data;
                this.state.reportRange = reportRange;

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

    getDateRange() {
        // RPCs add one day to the end boundary, so send local midnight for both dates.
        return {
            start_date: new Date(`${this.state.dateFrom}T00:00:00`).toISOString(),
            end_date: new Date(`${this.state.dateTo}T00:00:00`).toISOString()
        };
    }

}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const controller = new AnalyticsController();
    controller.init();
});
