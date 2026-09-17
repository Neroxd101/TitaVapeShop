// Client for the matching analytics_category_stats backend route and RPC.
const AnalyticsCategoryStats = {
    getData(filters = {}) {
        return window.AnalyticsFetcher.request('category-stats', 'categoryStats', filters);
    },
};
window.AnalyticsCategoryStats = AnalyticsCategoryStats;
