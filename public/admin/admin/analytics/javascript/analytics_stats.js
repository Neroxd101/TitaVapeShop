/**
 * Analytics Stats Module
 * Handles rendering of summary statistics: Total Revenue, Total Sales, Items Sold, Avg. Basket
 */
const AnalyticsStats = {
    /**
     * Render summary statistics
     * @param {Object} stats - Statistics data from the API
     */
    render(stats) {
        const formatNum = (n) => parseFloat(n || 0).toLocaleString(undefined, { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
        });

        // Total Profit
        const elRevenue = document.getElementById('statRevenue');
        if (elRevenue) {
            const profitValue = stats.totalProfit !== undefined ? stats.totalProfit : stats.totalRevenue;
            elRevenue.textContent = `₱${formatNum(profitValue)}`;
        }

        // Total Orders
        const elSales = document.getElementById('statSalesCount');
        if (elSales) {
            elSales.textContent = stats.ordersCount !== undefined ? stats.ordersCount : (stats.totalOrders !== undefined ? stats.totalOrders : (stats.salesCount || 0));
        }

        // Items Sold
        const elItems = document.getElementById('statItemsSold');
        if (elItems) {
            elItems.textContent = stats.itemsSold || 0;
        }

        // Gross Sales
        const elGross = document.getElementById('statAvgSale');
        if (elGross) {
            const gross = stats.grossSales !== undefined ? stats.grossSales : (stats.averageSale !== undefined ? stats.averageSale : 0);
            elGross.textContent = `₱${formatNum(gross)}`;
        }
    }
};

window.AnalyticsStats = AnalyticsStats;
