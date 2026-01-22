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

        products.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${this.escapeHtml(p.name)}</strong></td>
                <td><span class="badge">${this.escapeHtml(p.category || 'Uncategorized')}</span></td>
                <td>${p.unitsSold} units</td>
                <td>₱${parseFloat(p.revenue || 0).toFixed(2)}</td>
                <td>${p.stockLeft !== undefined ? p.stockLeft : '-'}</td>
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
