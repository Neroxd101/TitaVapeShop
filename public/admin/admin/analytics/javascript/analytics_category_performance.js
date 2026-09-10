/**
 * Analytics Category Performance Module
 * Handles rendering of the category performance chart
 */
const AnalyticsCategoryPerformance = {
    chart: null,

    /**
     * Render category performance chart
     * @param {Object} categories - Category data object { categoryName: { revenue, ... }, ... }
     */
    render(categories) {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        const labels = Object.keys(categories);
        const values = Object.values(categories).map(c => c.revenue);

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(16, 185, 129, 0.7)'
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { 
                            color: '#a5a5b0', 
                            font: { family: 'Outfit' }, 
                            padding: 20 
                        }
                    }
                },
                cutout: '70%'
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

window.AnalyticsCategoryPerformance = AnalyticsCategoryPerformance;
