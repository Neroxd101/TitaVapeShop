/**
 * Analytics Print Module
 * Handles printing of analytics dashboard
 */
const AnalyticsPrint = {
    /**
     * Initialize print functionality
     * @param {Object} controller - The AnalyticsController instance
     */
    init(controller) {
        const printBtn = document.getElementById('printAnalyticsBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printAnalytics(controller);
            });
        }
    },

    /**
     * Print analytics dashboard
     * @param {Object} controller - The AnalyticsController instance
     */
    printAnalytics(controller) {
        if (!controller.state.report) {
            alert('No analytics data to print');
            return;
        }

        // The controller stores response.report which is already the report object
        // The RPC returns { success: true, report: {...} }
        // The fetcher returns { success: true, report: result.report }
        // So controller.state.report is already the report object
        const report = controller.state.report;
        const printWindow = window.open('', '_blank');
        
        // Get current date for header
        const currentDate = new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Get time range label
        const timeRangeLabels = {
            '7days': 'Last 7 Days',
            '30days': 'Last 30 Days',
            '90days': 'Last 90 Days'
        };
        const timeRangeLabel = timeRangeLabels[controller.state.timeRange] || 'Last 7 Days';

        // Build print HTML
        let printHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Analytics Report - ${currentDate}</title>
    <style>
        @media print {
            @page {
                margin: 1cm;
            }
        }
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #000;
        }
        .print-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .print-header h1 {
            margin: 0;
            font-size: 24px;
        }
        .print-header p {
            margin: 5px 0;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 20px;
            font-weight: bold;
            color: #000;
        }
        .section-header {
            font-size: 18px;
            font-weight: bold;
            margin: 30px 0 15px 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            margin-bottom: 30px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-size: 12px;
        }
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            background-color: #e5e7eb;
            color: #000;
        }
        .print-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }
        .category-stats {
            margin-bottom: 30px;
        }
        .category-item {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .category-name {
            font-weight: 600;
        }
        .category-value {
            color: #065f46;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>Tita Vape Shop</h1>
        <p>Business Analytics Report</p>
        <p>Date: ${currentDate} | Period: ${timeRangeLabel}</p>
    </div>

    <!-- Summary Statistics -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">₱${this.formatNumber(report.totalRevenue || 0)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Sales</div>
            <div class="stat-value">${report.salesCount || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Items Sold</div>
            <div class="stat-value">${report.itemsSold || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg. Basket</div>
            <div class="stat-value">₱${this.formatNumber(report.averageSale || 0)}</div>
        </div>
    </div>

    <!-- Category Performance -->
    ${this.renderCategoryStats(report.categoryStats || {})}

    <!-- Top Products -->
    <div class="section-header">Product Performance Details</div>
    <table>
        <thead>
            <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Stock Left</th>
            </tr>
        </thead>
        <tbody>`;

        // Add product rows
        const products = report.topProducts || [];
        products.forEach(p => {
            printHTML += `
            <tr>
                <td><strong>${this.escapeHtml(p.name)}</strong></td>
                <td><span class="badge">${this.escapeHtml(p.category || 'Uncategorized')}</span></td>
                <td>${p.unitsSold} units</td>
                <td>₱${this.formatNumber(p.revenue || 0)}</td>
                <td>${p.stockLeft !== undefined ? p.stockLeft : '-'}</td>
            </tr>`;
        });

        printHTML += `
        </tbody>
    </table>

    <!-- Daily Revenue Summary -->
    ${this.renderDailyRevenue(report.dailyRevenue || [])}

    <div class="print-footer">
        <p>Total Products: ${products.length}</p>
        <p>Generated on ${new Date().toLocaleString('en-PH')}</p>
    </div>
</body>
</html>`;

        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },

    /**
     * Render category statistics
     * @param {Object} categoryStats - Category stats object
     * @returns {string} HTML string
     */
    renderCategoryStats(categoryStats) {
        if (!categoryStats || Object.keys(categoryStats).length === 0) {
            return '';
        }

        let html = '<div class="section-header">Category Performance</div><div class="category-stats">';
        
        // Sort by revenue descending
        const sortedCategories = Object.entries(categoryStats)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

        sortedCategories.forEach(cat => {
            html += `
            <div class="category-item">
                <span class="category-name">${this.escapeHtml(cat.name)}</span>
                <span class="category-value">₱${this.formatNumber(cat.revenue || 0)}</span>
            </div>`;
        });

        html += '</div>';
        return html;
    },

    /**
     * Render daily revenue summary
     * @param {Array} dailyRevenue - Array of daily revenue data
     * @returns {string} HTML string
     */
    renderDailyRevenue(dailyRevenue) {
        if (!dailyRevenue || dailyRevenue.length === 0) {
            return '';
        }

        let html = '<div class="section-header">Daily Revenue Summary</div><table><thead><tr><th>Date</th><th>Revenue</th></tr></thead><tbody>';
        
        dailyRevenue.forEach(day => {
            const date = new Date(day.date).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            html += `
            <tr>
                <td>${date}</td>
                <td>₱${this.formatNumber(day.revenue || 0)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        return html;
    },

    /**
     * Format number with commas
     * @param {number} n - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(n) {
        return parseFloat(n || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
};

window.AnalyticsPrint = AnalyticsPrint;
