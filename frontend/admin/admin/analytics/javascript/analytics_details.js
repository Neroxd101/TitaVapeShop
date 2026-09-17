const AnalyticsDetails = {
    init(controller) {
        this.controller = controller;
        this.dialog = document.getElementById('analyticsDetailsModal');
        this.body = document.getElementById('analyticsDetailsRows');
        this.status = document.getElementById('analyticsDetailsStatus');
        this.table = document.getElementById('analyticsDetailsTable');
        this.pager = document.getElementById('analyticsDetailsPager');
        this.clients = {
            statRevenue: window.AnalyticsModalTotalProfit,
            statSalesCount: window.AnalyticsModalTotalOrders,
            statItemsSold: window.AnalyticsModalItemsSold,
            statAvgSale: window.AnalyticsModalGrossSales
        };
        this.metrics = {
            statRevenue: ['Total Profit', true],
            statSalesCount: ['Total Orders', false],
            statItemsSold: ['Items Sold', false],
            statAvgSale: ['Gross Sales', true]
        };
        Object.keys(this.metrics).forEach(id => {
            const card = document.getElementById(id).closest('.stat-card');
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-haspopup', 'dialog');
            card.setAttribute('aria-controls', this.dialog.id);
            card.setAttribute('aria-label', `View ${this.metrics[id][0]} sale details`);
            card.classList.add('analytics-stat-action');
            card.addEventListener('click', () => this.open(id));
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.open(id);
                }
            });
        });
        document.getElementById('analyticsDetailsClose').addEventListener('click', () => this.dialog.close());
        document.getElementById('analyticsDetailsPrint').addEventListener('click', () => this.printModalDetails());
        this.dialog.addEventListener('click', event => {
            if (event.target !== this.dialog) return;
            const rect = this.dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.dialog.close();
        });
        this.dialog.addEventListener('close', () => this.abort?.abort());
        document.getElementById('analyticsDetailsRetry').addEventListener('click', () => this.open(this.metricId, this.range));
        document.getElementById('analyticsDetailsPrev').addEventListener('click', () => { this.page--; this.renderRows(); });
        document.getElementById('analyticsDetailsNext').addEventListener('click', () => { this.page++; this.renderRows(); });
    },

    money(value) {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
    },

    getViewFromRpc(rpcData, metricId) {
        if (metricId === 'statSalesCount') {
            return {
                headers: ['Date', 'Order / sale', 'Customer', 'Source', 'Items ordered', 'Order total'],
                note: 'One row per completed customer order or POS sale counted in Total Orders. Voided sales are excluded.',
                empty: 'No completed orders or sales found for this date range.',
                totalValue: rpcData.total,
                rows: (rpcData.rows || []).map(row => [
                    new Date(row.date).toLocaleString('en-PH'),
                    row.order_id,
                    row.customer,
                    row.source,
                    row.items_summary || 'No item details recorded',
                    this.money(row.total_amount)
                ])
            };
        }
        if (metricId === 'statAvgSale') {
            return {
                headers: ['Date', 'Order / sale', 'Customer', 'Sales amount'],
                note: 'Recorded sales totals for completed orders and POS sales. Voided sales are excluded.',
                empty: 'No completed orders or sales found for this date range.',
                totalValue: rpcData.total,
                rows: (rpcData.rows || []).map(row => [
                    new Date(row.date).toLocaleString('en-PH'),
                    row.order_id,
                    row.customer,
                    this.money(row.total_amount)
                ])
            };
        }
        const isProfit = metricId === 'statRevenue';
        return {
            headers: ['Product', isProfit ? 'Profit' : 'Units sold'],
            note: isProfit ? 'Total profit per product sold in this date range. Voided sales are excluded.'
                : 'Total quantity sold per product in this date range. Voided sales are excluded.',
            empty: 'No products sold for this date range.',
            totalValue: rpcData.total,
            rows: (rpcData.rows || []).map(row => [
                row.product_name,
                isProfit ? this.money(row.profit) : row.quantity_sold
            ])
        };
    },

    async open(metricId, selectedRange) {
        this.abort?.abort();
        const abort = this.abort = new AbortController();
        this.metricId = metricId;
        this.range = selectedRange || this.controller.state.reportRange;
        const [title, currency] = this.metrics[metricId];
        document.getElementById('analyticsDetailsTitle').textContent = `${title} Details`;
        const total = document.getElementById('analyticsDetailsTotal');
        total.textContent = '';
        this.table.hidden = true;
        this.pager.hidden = true;
        this.body.replaceChildren();
        document.getElementById('analyticsDetailsNote').textContent = '';
        this.status.hidden = false;
        const retry = document.getElementById('analyticsDetailsRetry');
        retry.hidden = true;
        document.getElementById('analyticsDetailsPeriod').textContent = this.range ? `${this.range.from} to ${this.range.to}` : '';
        this.status.textContent = this.range ? 'Loading sale details…' : 'Wait for Analytics to finish loading, then open this card again.';
        if (!this.dialog.open) this.dialog.showModal();
        if (!this.range) return;
        const client = this.clients[metricId];
        const params = new URLSearchParams({
            start_date: new Date(`${this.range.from}T00:00:00`).toISOString(),
            end_date: new Date(`${this.range.to}T00:00:00`).toISOString()
        });
        try {
            const result = await client.getData(params, abort.signal);
            if (abort.signal.aborted) return;

            const view = this.getViewFromRpc(result.rpcData, metricId);

            this.rows = view.rows;
            this.table.classList.toggle('analytics-details-products', metricId === 'statRevenue' || metricId === 'statItemsSold');
            const heading = document.getElementById('analyticsDetailsHead');
            heading.replaceChildren();
            view.headers.forEach(label => {
                const cell = document.createElement('th');
                cell.scope = 'col';
                cell.textContent = label;
                heading.appendChild(cell);
            });
            document.getElementById('analyticsDetailsNote').textContent = view.note;
            
            this.currentView = {
                title,
                headers: view.headers,
                rows: view.rows,
                note: view.note,
                period: document.getElementById('analyticsDetailsPeriod').textContent,
                totalText: total.textContent
            };

            const totalVal = view.totalValue;
            total.textContent = `${title}: ${currency ? this.money(totalVal) : Number(totalVal).toLocaleString()}`;
            this.currentView.totalText = total.textContent;
            this.status.textContent = this.rows.length ? '' : view.empty;
            this.status.hidden = this.rows.length > 0;
            this.table.hidden = !this.rows.length;
            this.page = 0;
            this.renderRows();
        } catch (error) {
            if (abort.signal.aborted) return;
            this.status.textContent = error.message;
            retry.hidden = false;
        }
    },

    renderRows() {
        this.body.replaceChildren();
        const headers = this.currentView ? this.currentView.headers : [];
        for (const values of this.rows.slice(this.page * 25, (this.page + 1) * 25)) {
            const row = document.createElement('tr');
            values.forEach((value, idx) => {
                const cell = document.createElement('td');
                if (headers[idx]) {
                    cell.setAttribute('data-label', headers[idx]);
                }
                cell.textContent = value;
                row.appendChild(cell);
            });
            this.body.appendChild(row);
        }
        this.pager.hidden = this.rows.length <= 25;
        document.getElementById('analyticsDetailsPage').textContent = `Page ${this.page + 1} of ${Math.max(1, Math.ceil(this.rows.length / 25))}`;
        document.getElementById('analyticsDetailsPrev').disabled = this.page === 0;
        document.getElementById('analyticsDetailsNext').disabled = (this.page + 1) * 25 >= this.rows.length;
    },

    printModalDetails() {
        if (!this.currentView || !this.currentView.rows || !this.currentView.rows.length) {
            alert('No details available to print.');
            return;
        }

        const { title, headers, rows, note, period, totalText } = this.currentView;
        const currentDate = new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to print.');
            return;
        }

        const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
        const rowsHtml = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <title>${title} Details - ${currentDate}</title>
    <style>
        @media print {
            @page { margin: 1cm; size: auto; }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #111;
            margin: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #222;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .header h1 {
            margin: 0 0 4px;
            font-size: 22px;
        }
        .header h2 {
            margin: 0 0 6px;
            font-size: 16px;
            color: #444;
            font-weight: 500;
        }
        .header p {
            margin: 0;
            font-size: 13px;
            color: #666;
        }
        .summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f4f4f5;
            padding: 10px 14px;
            border-radius: 6px;
            margin-bottom: 16px;
        }
        .summary-total {
            font-size: 18px;
            font-weight: 700;
            color: #0f766e;
        }
        .note {
            font-size: 12px;
            color: #666;
            margin-bottom: 12px;
            font-style: italic;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 10px;
            text-align: left;
        }
        th {
            background-color: #f8fafc;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background-color: #fafafa;
        }
        .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Tita's Vape Shop</h1>
        <h2>${title} Details Report</h2>
        <p>Printed on ${currentDate}${period ? ` | Period: ${period}` : ''}</p>
    </div>
    <div class="summary">
        <div><strong>Total Records:</strong> ${rows.length}</div>
        <div class="summary-total">${totalText}</div>
    </div>
    ${note ? `<div class="note">${note}</div>` : ''}
    <table>
        <thead>
            <tr>${headerHtml}</tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
    <div class="footer">Generated by Tita's Vape Shop Management System</div>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 300);
    }
};
window.AnalyticsDetails = AnalyticsDetails;
