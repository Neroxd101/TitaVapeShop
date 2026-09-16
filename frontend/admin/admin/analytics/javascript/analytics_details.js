const AnalyticsDetails = {
    init(controller) {
        this.controller = controller;
        this.dialog = document.getElementById('analyticsDetailsModal');
        this.body = document.getElementById('analyticsDetailsRows');
        this.status = document.getElementById('analyticsDetailsStatus');
        this.table = document.getElementById('analyticsDetailsTable');
        this.pager = document.getElementById('analyticsDetailsPager');
        this.metrics = {
            statRevenue: ['Total Profit', 'totalProfit', true],
            statSalesCount: ['Total Orders', 'ordersCount', false],
            statItemsSold: ['Items Sold', 'itemsSold', false],
            statAvgSale: ['Gross Sales', 'grossSales', true]
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

    getView(report, metricId) {
        if (metricId === 'statSalesCount' || metricId === 'statAvgSale') {
            const isOrders = metricId === 'statSalesCount';
            return {
                headers: isOrders ? ['Date', 'Order / sale', 'Customer', 'Source', 'Items ordered', 'Order total']
                    : ['Date', 'Order / sale', 'Customer', 'Sales amount'],
                note: isOrders ? 'One row per completed customer order or POS sale counted in Total Orders. Voided sales are excluded.'
                    : 'Recorded sales totals for completed orders and POS sales. Voided sales are excluded.',
                empty: 'No completed orders or sales found for this date range.',
                rows: report.orders.map(order => {
                    const values = [new Date(order.date).toLocaleString('en-PH'), order.id, order.customer];
                    if (isOrders) values.push(order.source, order.items.map(item => `${item.name} × ${item.quantity}`).join(', ') || 'No item details recorded');
                    values.push(this.money(order.total));
                    return values;
                })
            };
        }
        const products = new Map();
        for (const line of report.lines) {
            const key = line.productId ? String(line.productId).toLowerCase() : line.name;
            const item = products.get(key) || { name: line.name, quantity: 0, profitCents: 0 };
            item.quantity += line.quantity;
            item.profitCents += Math.round(line.profit * 100);
            products.set(key, item);
        }
        const isProfit = metricId === 'statRevenue';
        const items = [...products.values()].sort((a, b) => isProfit ? b.profitCents - a.profitCents : b.quantity - a.quantity);
        return {
            headers: ['Product', isProfit ? 'Profit' : 'Units sold'],
            note: isProfit ? 'Total profit per product sold in this date range. Voided sales are excluded.'
                : 'Total quantity sold per product in this date range. Voided sales are excluded.',
            empty: 'No products sold for this date range.',
            rows: items.map(item => [item.name, isProfit ? this.money(item.profitCents / 100) : item.quantity])
        };
    },

    async open(metricId, selectedRange) {
        this.abort?.abort();
        const abort = this.abort = new AbortController();
        this.metricId = metricId;
        this.range = selectedRange || this.controller.state.reportRange;
        const [title, key, currency] = this.metrics[metricId];
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
        const params = new URLSearchParams({
            start_date: new Date(`${this.range.from}T00:00:00`).toISOString(),
            end_date: new Date(`${this.range.to}T00:00:00`).toISOString()
        });
        try {
            const response = await fetch(`/api/analytics/sale-details?${params}`, { signal: abort.signal });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load sale details.');
            if (abort.signal.aborted) return;
            const view = this.getView(result.report, metricId);
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
            total.textContent = `${title}: ${currency ? this.money(result.report[key]) : result.report[key].toLocaleString()}`;
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
        for (const values of this.rows.slice(this.page * 25, (this.page + 1) * 25)) {
            const row = document.createElement('tr');
            values.forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });
            this.body.appendChild(row);
        }
        this.pager.hidden = this.rows.length <= 25;
        document.getElementById('analyticsDetailsPage').textContent = `Page ${this.page + 1} of ${Math.max(1, Math.ceil(this.rows.length / 25))}`;
        document.getElementById('analyticsDetailsPrev').disabled = this.page === 0;
        document.getElementById('analyticsDetailsNext').disabled = (this.page + 1) * 25 >= this.rows.length;
    }
};
window.AnalyticsDetails = AnalyticsDetails;
