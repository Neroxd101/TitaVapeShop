// Client for the matching analytics_items_sold backend route and RPC.
const AnalyticsItemsSold = {
    getData(filters = {}) {
        return window.AnalyticsFetcher.request('items-sold', 'itemsSold', filters);
    },
};
window.AnalyticsItemsSold = AnalyticsItemsSold;
