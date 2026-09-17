// Client for the matching analytics_modal_gross_sales route and RPC.
const AnalyticsModalGrossSales = {
    getData(filters = {}, signal) {
        return window.AnalyticsFetcher.request('gross-sales-details', 'rpcData', filters, signal);
    }
};
window.AnalyticsModalGrossSales = AnalyticsModalGrossSales;
