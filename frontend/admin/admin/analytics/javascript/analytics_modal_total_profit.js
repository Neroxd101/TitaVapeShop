// Client for the matching analytics_modal_total_profit route and RPC.
const AnalyticsModalTotalProfit = {
    getData(filters = {}, signal) {
        return window.AnalyticsFetcher.request('total-profit-details', 'rpcData', filters, signal);
    }
};
window.AnalyticsModalTotalProfit = AnalyticsModalTotalProfit;
