// Client for the matching analytics_total_orders backend route and RPC.
const AnalyticsTotalOrders = {
    getData(filters = {}) {
        return window.AnalyticsFetcher.request('total-orders', 'ordersCount', filters);
    },
};
window.AnalyticsTotalOrders = AnalyticsTotalOrders;
