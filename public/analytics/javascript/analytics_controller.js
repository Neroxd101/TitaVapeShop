/**
 * Analytics Controller
 * Orchestrates data fetching and visualization for the analytics page
 */

class AnalyticsController {
    constructor() {
        this.charts = {
            revenue: null,
            topProducts: null,
            category: null
        };

        this.state = {
            timeRange: '7days',
            stats: null,
            report: null
        };
    }

    async init() {
        // Authenticate
        const user = localStorage.getItem('user');
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Initialize sidebar/header
        if (typeof initSidebar === 'function') initSidebar('analytics');
        if (window.HeaderStatus && HeaderStatus.init) HeaderStatus.init();

        this.setupEventListeners();
        await this.loadDashboardData();
    }

    setupEventListeners() {
        const timeRangeSelect = document.getElementById('timeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.state.timeRange = e.target.value;
                this.loadDashboardData();
            });
        }

        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
    }

    async loadDashboardData() {
        try {
            // Calculate date range based on selection
            const dateRange = this.getDateRange(this.state.timeRange);

            // Fetch all analytics data from the unified Edge Function
            const response = await AnalyticsFetcher.getDashboard(dateRange);

            if (response.success) {
                const data = response.report;
                this.state.report = data;

                // Render everything
                this.renderStats(data);
                this.renderCharts(data);
                this.renderBestSellers(data.topProducts || []);
            }

        } catch (error) {
            console.error('Error loading analytics data:', error);
        }
    }

    getDateRange(range) {
        const end = new Date();
        const start = new Date();

        switch (range) {
            case '7days': start.setDate(end.getDate() - 7); break;
            case '30days': start.setDate(end.getDate() - 30); break;
            case '90days': start.setDate(end.getDate() - 90); break;
            default: start.setDate(end.getDate() - 7);
        }

        return {
            start_date: start.toISOString(),
            end_date: end.toISOString()
        };
    }

    renderStats(stats) {
        const formatNum = (n) => parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        const elRevenue = document.getElementById('statRevenue');
        const elSales = document.getElementById('statSalesCount');
        const elItems = document.getElementById('statItemsSold');
        const elAvg = document.getElementById('statAvgSale');

        if (elRevenue) elRevenue.textContent = `₱${formatNum(stats.totalRevenue)}`;
        if (elSales) elSales.textContent = stats.salesCount || 0;
        if (elItems) elItems.textContent = stats.itemsSold || 0;
        if (elAvg) {
            const avg = stats.salesCount > 0 ? (stats.totalRevenue / stats.salesCount) : 0;
            elAvg.textContent = `₱${formatNum(avg)}`;
        }
    }

    renderCharts(reportData) {
        this.renderRevenueChart(reportData.dailyRevenue || []);
        this.renderTopProductsChart(reportData.topProducts || []);
        this.renderCategoryChart(reportData.categoryStats || []);
    }

    renderRevenueChart(dailyData) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        if (this.charts.revenue) this.charts.revenue.destroy();

        const labels = dailyData.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const values = dailyData.map(d => d.revenue);

        this.charts.revenue = new Chart(ctx, {
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
    }

    renderTopProductsChart(products) {
        const ctx = document.getElementById('topProductsChart');
        if (!ctx) return;

        if (this.charts.topProducts) this.charts.topProducts.destroy();

        // Limit to top 5 for chart
        const top5 = products.slice(0, 5);
        const labels = top5.map(p => p.name);
        const values = top5.map(p => p.unitsSold);

        this.charts.topProducts = new Chart(ctx, {
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a5a5b0' } },
                    y: { grid: { display: false }, ticks: { color: '#a5a5b0' } }
                }
            }
        });
    }

    renderCategoryChart(categories) {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        if (this.charts.category) this.charts.category.destroy();

        const labels = Object.keys(categories);
        const values = Object.values(categories).map(c => c.revenue);

        this.charts.category = new Chart(ctx, {
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
                        labels: { color: '#a5a5b0', font: { family: 'Outfit' }, padding: 20 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    renderBestSellers(products) {
        const listEl = document.getElementById('bestSellersList');
        if (!listEl) return;

        listEl.innerHTML = '';
        products.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td><span class="badge">${p.category || 'Uncategorized'}</span></td>
                <td>${p.unitsSold} units</td>
                <td>₱${parseFloat(p.revenue || 0).toFixed(2)}</td>
                <td>${p.stockLeft !== undefined ? p.stockLeft : '-'}</td>
            `;
            listEl.appendChild(row);
        });
    }

    exportToCSV() {
        if (!this.state.report || !this.state.report.topProducts) return;

        const products = this.state.report.topProducts;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Product Name,Category,Units Sold,Revenue,Stock Left\n";

        products.forEach(p => {
            csvContent += `"${p.name}","${p.category || ''}",${p.unitsSold},${p.revenue},${p.stockLeft}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `tita-vape-analytics-${this.state.timeRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const controller = new AnalyticsController();
    controller.init();
});
