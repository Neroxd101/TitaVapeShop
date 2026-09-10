/**
 * Analytics Product Performance Details Module
 * Handles rendering of the product performance details table
 */
const AnalyticsProductDetails = {
    /**
     * Render product performance details table
     * @param {Array} products - Array of product data { name, category, unitsSold, revenue, stockLeft, ... }
     */
    render(products) {
        const listEl = document.getElementById('bestSellersList');
        if (!listEl) return;

        listEl.innerHTML = '';

        if (!products || products.length === 0) {
            listEl.innerHTML = '<tr class="empty-row"><td colspan="5" style="text-align:center; padding: 32px 16px; color: var(--text-secondary);">No product performance data available</td></tr>';
            return;
        }

        products.forEach((p, index) => {
            const row = document.createElement('tr');
            row.className = 'product-performance-row';
            row.style.animationDelay = `${index * 40}ms`;

            const revenue = parseFloat(p.revenue || 0);
            const formattedRevenue = revenue.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            const stockVal = p.stockLeft !== undefined ? p.stockLeft : '-';
            let stockClass = 'stock-normal';
            if (p.stockLeft !== undefined) {
                if (p.stockLeft === 0) stockClass = 'stock-out';
                else if (p.stockLeft <= 5) stockClass = 'stock-low';
            }

            row.innerHTML = `
                <td class="col-product-name" data-label="Product Name">
                    <span class="product-name-text">${this.escapeHtml(p.name)}</span>
                </td>
                <td class="col-category" data-label="Category">
                    <span class="badge category-badge">${this.escapeHtml(p.category || 'Uncategorized')}</span>
                </td>
                <td class="col-revenue" data-label="Revenue">
                    <span class="metric-label">Revenue:</span>
                    <strong class="revenue-val">₱${formattedRevenue}</strong>
                </td>
                <td class="col-units-sold" data-label="Units Sold">
                    <span class="metric-label">Sold:</span>
                    <span class="units-val">${p.unitsSold} units</span>
                </td>
                <td class="col-stock-left" data-label="Stock Left">
                    <span class="metric-label">Stock:</span>
                    <span class="stock-val ${stockClass}">${stockVal}</span>
                </td>
            `;
            listEl.appendChild(row);
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

window.AnalyticsProductDetails = AnalyticsProductDetails;
