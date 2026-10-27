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
        if (!printWindow) {
            alert('Please allow pop-ups for this site to print the analytics report.');
            return;
        }
        
        // Get current date for header
        const currentDate = new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const range = controller.state.reportRange;
        const timeRangeLabel = range ? `${range.from} to ${range.to}` : '';
        const saleItems = Number(report.grossSales ?? report.averageSale ?? 0);
        const profit = Number(report.totalProfit ?? report.totalRevenue ?? 0);

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
            position: relative;
        }
        body > :not(.print-watermark) {
            position: relative;
            z-index: 1;
        }
        .print-watermark {
            position: fixed;
            inset: 0;
            z-index: 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(4, 1fr);
            align-items: center;
            justify-items: center;
            overflow: hidden;
            pointer-events: none;
        }
        .print-watermark span {
            color: rgba(0, 0, 0, 0.055);
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 1px;
            white-space: nowrap;
            transform: rotate(-32deg);
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
            grid-template-columns: repeat(3, 1fr);
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
        .category-summary-table,
        .daily-summary-table {
            table-layout: fixed;
            margin: 16px 0 24px;
        }
        .category-summary-table caption,
        .daily-summary-table caption {
            text-align: left;
            font-size: 18px;
            font-weight: bold;
            padding: 0 0 12px;
            break-after: avoid;
        }
        .category-summary-table th,
        .daily-summary-table th,
        .category-summary-table td,
        .daily-summary-table td {
            line-height: 1.5;
            vertical-align: top;
            overflow-wrap: anywhere;
        }
        .category-summary-table th:not(:first-child),
        .daily-summary-table th:not(:first-child),
        .category-summary-table td:not(:first-child),
        .daily-summary-table td:not(:first-child) {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .print-chart { break-inside: avoid; margin-bottom: 24px; }
        .print-chart img { display: block; width: 100%; max-height: 300px; object-fit: contain; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
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
    <div class="print-watermark" aria-hidden="true">
        ${Array.from({ length: 12 }, () => '<span>TitaVapeShop™</span>').join('')}
    </div>
    <div class="print-header">
        <h1>Tita\'s Vape Shop</h1>
        <p>Business Analytics Report</p>
        <p>Date: ${currentDate} | Period: ${timeRangeLabel}</p>
    </div>

    <!-- Summary Statistics -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Sales</div>
            <div class="stat-value">₱${this.formatNumber(report.totalProfit !== undefined ? report.totalProfit : (report.totalRevenue || 0))}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${report.ordersCount !== undefined ? report.ordersCount : (report.totalOrders !== undefined ? report.totalOrders : (report.salesCount || 0))}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Items Sold</div>
            <div class="stat-value">${report.itemsSold || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Sale Item</div>
            <div class="stat-value">₱${this.formatNumber(saleItems)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Cost of Items</div>
            <div class="stat-value">₱${this.formatNumber(saleItems - profit)}</div>
        </div>
    </div>

    ${this.renderCharts()}

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
        if (!products.length) printHTML += '<tr><td colspan="5">No product performance data available</td></tr>';
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
    ${this.renderSalesTrend(report.salesTrend || [], true)}

    <div class="print-footer">
        <p>Total Products: ${products.length}</p>
        <p>Generated on ${new Date().toLocaleString('en-PH')}</p>
    </div>
</body>
</html>`;

        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // Wait for chart images to finish loading before opening the print dialog.
        Promise.all(Array.from(printWindow.document.images, img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        })).then(() => {
            if (!printWindow.closed) printWindow.print();
        });
    },

    /**
     * Render category statistics
     * @param {Object} categoryStats - Category stats object
     * @returns {string} HTML string
     */
    renderCategoryStats(categoryStats) {
        let html = '<table class="data-table category-summary-table"><caption>Category Performance</caption><thead><tr><th>Category</th><th>Revenue</th></tr></thead><tbody>';
        const sortedCategories = Object.entries(categoryStats || {})
            .map(([name, data]) => ({ ...data, name }))
            .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
        sortedCategories.forEach(cat => {
            html += `<tr><td>${this.escapeHtml(cat.name)}</td><td>₱${this.formatNumber(cat.revenue || 0)}</td></tr>`;
        });
        if (!sortedCategories.length) html += '<tr><td colspan="2">No category performance data available</td></tr>';
        html += '</tbody></table>';
        return html;
    },

    /**
     * Render daily revenue summary
     * @param {Array} salesTrend - Array of daily sales trend data
     * @returns {string} HTML string
     */
    renderSalesTrend(salesTrend, forPrint = false) {
        let html = `<table class="data-table daily-summary-table"><caption>Daily Sales &amp; Profit Summary</caption><thead><tr><th>Date</th>${forPrint ? '<th>Cost of Items</th><th>Sale Item</th>' : '<th>Gross Sales</th>'}<th>Total Sales</th></tr></thead><tbody>`;
        
        (salesTrend || []).forEach(day => {
            const date = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const grossSales = day.grossSales !== undefined ? day.grossSales : (day.revenue || 0);
            const profit = day.profit !== undefined ? day.profit : 0;
            html += `
            <tr>
                <td>${date}</td>
                ${forPrint ? `<td>₱${this.formatNumber(Number(grossSales) - Number(profit))}</td>` : ''}
                <td>₱${this.formatNumber(grossSales)}</td>
                <td>₱${this.formatNumber(profit)}</td>
            </tr>`;
        });

        if (!salesTrend || !salesTrend.length) html += `<tr><td colspan="${forPrint ? 4 : 3}">No daily sales data available</td></tr>`;
        html += '</tbody></table>';
        return html;
    },

    renderCharts() {
        return [
            ['Sales Trend', window.AnalyticsSalesTrend],
            ['Top Selling Products', window.AnalyticsTopProducts],
            ['Category Performance', window.AnalyticsCategoryPerformance]
        ].map(([title, module]) => {
            if (!module || !module.chart) return '';
            module.chart.stop();
            module.chart.update('none');
            return `<div class="print-chart"><h3 class="section-header">${title}</h3><img src="${module.chart.toBase64Image()}" alt="${title}"></div>`;
        }).join('');
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
