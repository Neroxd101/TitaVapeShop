// Client for the matching analytics_total_profit backend route and RPC.
const AnalyticsTotalProfit = {
    getData(filters = {}) {
        return window.AnalyticsFetcher.request('total-profit', 'totalProfit', filters);
    },
};
window.AnalyticsTotalProfit = AnalyticsTotalProfit;
