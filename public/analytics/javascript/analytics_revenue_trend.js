/**
 * Analytics Revenue Trend Module
 * Handles rendering of the sales revenue trend chart
 */
const AnalyticsRevenueTrend = {
    chart: null,

    /**
     * Render revenue trend chart
     * @param {Array} dailyData - Array of daily revenue data { date, revenue }
     */
    render(dailyData) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        const labels = dailyData.map(d => 
            new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        );
        const values = dailyData.map(d => d.revenue);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Daily Revenue',
                    data: values,
                    borderColor: '#00d4aa',
                    backgroundColor: 'rgba(0, 212, 170, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#00d4aa'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#a5a5b0', font: { family: 'Outfit' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a5a5b0', font: { family: 'Outfit' } }
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

window.AnalyticsRevenueTrend = AnalyticsRevenueTrend;
