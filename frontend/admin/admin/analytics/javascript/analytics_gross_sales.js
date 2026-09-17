// Client for the matching analytics_gross_sales backend route and RPC.
const AnalyticsGrossSales = {
    getData(filters = {}) {
        return window.AnalyticsFetcher.request('gross-sales', 'grossSales', filters);
    },
};
window.AnalyticsGrossSales = AnalyticsGrossSales;
