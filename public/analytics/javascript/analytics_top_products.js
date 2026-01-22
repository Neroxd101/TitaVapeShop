/**
 * Analytics Top Products Module
 * Handles rendering of the top selling products chart
 */
const AnalyticsTopProducts = {
    chart: null,

    /**
     * Render top products chart
     * @param {Array} products - Array of product data { name, unitsSold, revenue, ... }
     */
    render(products) {
        const ctx = document.getElementById('topProductsChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Limit to top 5 for chart
        const top5 = products.slice(0, 5);
        const labels = top5.map(p => p.name);
        const values = top5.map(p => p.unitsSold);

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Units Sold',
                    data: values,
                    backgroundColor: [
                        'rgba(0, 212, 170, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(168, 85, 247, 0.7)',
                        'rgba(239, 68, 68, 0.7)'
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { 
                    legend: { display: false } 
                },
                scales: {
                    x: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                        ticks: { color: '#a5a5b0' } 
                    },
                    y: { 
                        grid: { display: false }, 
                        ticks: { color: '#a5a5b0' } 
                    }
                }
            }
        });
    },

    /**
     * Destroy the chart (cleanup)
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.AnalyticsTopProducts = AnalyticsTopProducts;
