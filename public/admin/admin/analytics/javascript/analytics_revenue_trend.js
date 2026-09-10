/**
 * Analytics Sales Trend Module
 * Handles rendering of the sales trend chart (Daily Gross Sales & Total Profit)
 */
const AnalyticsRevenueTrend = {
    chart: null,

    /**
     * Render sales trend chart
     * @param {Array} dailyData - Array of daily data { date, grossSales, profit, revenue }
     */
    render(dailyData) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        const labels = (dailyData || []).map(d => 
            new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        );
        const grossSalesValues = (dailyData || []).map(d => 
            parseFloat(d.grossSales !== undefined ? d.grossSales : (d.revenue || 0))
        );
        const profitValues = (dailyData || []).map(d => 
            parseFloat(d.profit !== undefined ? d.profit : 0)
        );

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Daily Gross Sales',
                        data: grossSalesValues,
                        borderColor: '#00d4aa',
                        backgroundColor: 'rgba(0, 212, 170, 0.08)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.35,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#00d4aa',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Total Profit',
                        data: profitValues,
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.08)',
                        borderWidth: 2.5,
                        borderDash: [5, 4],
                        fill: true,
                        tension: 0.35,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#a855f7',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#a5a5b0',
                            font: { family: 'Outfit', size: 12, weight: '500' },
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 18, 26, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#e0e0e0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const val = parseFloat(context.parsed.y || 0).toLocaleString('en-PH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                                return ` ${context.dataset.label}: ₱${val}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: '#a5a5b0', 
                            font: { family: 'Outfit' },
                            callback: function(value) {
                                return '₱' + parseFloat(value).toLocaleString();
                            }
                        }
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
