// Client for the matching analytics_modal_items_sold route and RPC.
const AnalyticsModalItemsSold = {
    getData(filters = {}, signal) {
        return window.AnalyticsFetcher.request('items-sold-details', 'rpcData', filters, signal);
    }
};
window.AnalyticsModalItemsSold = AnalyticsModalItemsSold;
