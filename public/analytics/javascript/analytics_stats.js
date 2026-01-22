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

        // Total Revenue
        const elRevenue = document.getElementById('statRevenue');
        if (elRevenue) {
            elRevenue.textContent = `₱${formatNum(stats.totalRevenue)}`;
        }

        // Total Sales
        const elSales = document.getElementById('statSalesCount');
        if (elSales) {
            elSales.textContent = stats.salesCount || 0;
        }

        // Items Sold
        const elItems = document.getElementById('statItemsSold');
        if (elItems) {
            elItems.textContent = stats.itemsSold || 0;
        }

        // Avg. Basket
        const elAvg = document.getElementById('statAvgSale');
        if (elAvg) {
            const avg = stats.salesCount > 0 ? (stats.totalRevenue / stats.salesCount) : 0;
            elAvg.textContent = `₱${formatNum(avg)}`;
        }
    }
};

window.AnalyticsStats = AnalyticsStats;
