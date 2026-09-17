// Client for the matching analytics_modal_total_orders route and RPC.
const AnalyticsModalTotalOrders = {
    getData(filters = {}, signal) {
        return window.AnalyticsFetcher.request('total-orders-details', 'rpcData', filters, signal);
    }
};
window.AnalyticsModalTotalOrders = AnalyticsModalTotalOrders;
