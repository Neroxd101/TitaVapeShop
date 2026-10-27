const InventoryHistoryPrint = {
    buildReport(item, sales, start, end) {
        const esc = value => InventoryPrint.escape(value);
        const money = value => esc(InventoryUtils.formatCurrency(value));
        let units = 0;
        let total = 0;
        const rows = sales.map(sale => {
            const quantity = Number(sale.quantity_sold) || 0;
            const cost = Number(sale.cost_price) || 0;
            units += quantity;
            total += quantity * cost;
            return `<tr><td>${esc(InventoryUtils.formatDate(sale.sale_date))}</td><td>${quantity}</td>
                <td>${money(cost)}</td><td>${money(quantity * cost)}</td>
                <td>${esc(sale.customer_name || sale.customer_email || '-')}</td><td>${esc(sale.user_email || '-')}</td></tr>`;
        }).join('');
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sales History</title>
            <style>@page{size:A4 landscape;margin:12mm}body{font:12px Arial,sans-serif;color:#111;margin:20px}
            table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #bbb;padding:8px;text-align:left;overflow-wrap:anywhere}
            th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:22px}p{overflow-wrap:anywhere}
            button{padding:8px 16px}@media print{button{display:none}body{margin:0}}</style></head><body>
            <button id="printReport">Print / Save PDF</button><h1>Tita's Vape Shop — Sales History</h1>
            <p><strong>${esc(item.name)}</strong></p><p>Date range: ${esc(start || 'Beginning')} to ${esc(end || 'Present')}</p>
            <p>Generated: ${esc(new Date().toLocaleString('en-PH'))}</p>
            <p>Records: ${sales.length} | Units sold: ${units} | Total costing: ${money(total)}</p>
            <table><thead><tr><th>Date</th><th>Quantity</th><th>Costing</th><th>Subtotal</th><th>Customer</th><th>Sold By</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6">No sales found for this date range.</td></tr>'}</tbody></table></body></html>`;
    },

    async print() {
        const item = InventoryState.inventoryItems.find(item => item.id === InventoryState.viewingHistoryItemId);
        const button = document.getElementById('printHistoryBtn');
        if (!item || button.disabled) return;
        const start = InventoryState.historyStartDate;
        const end = InventoryState.historyEndDate;
        const report = window.open('', '_blank');
        if (!report) { alert('Please allow pop-ups to print sales history.'); return; }
        report.document.body.textContent = 'Loading sales history…';
        button.disabled = true;
        try {
            const sales = [];
            const params = new URLSearchParams({ limit: '200', offset: '0' });
            if (start) params.set('start_date', new Date(start + 'T00:00:00').toISOString());
            if (end) params.set('end_date', new Date(end + 'T23:59:59.999').toISOString());
            let total;
            do {
                params.set('offset', String(sales.length));
                const response = await fetch(`/inventory/inventory_get_sales_history/${encodeURIComponent(item.id)}?${params}`, {
                    headers: { Accept: 'application/json' }
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load sales history.');
                const page = result.sales || [];
                total = Number(result.total) || 0;
                if (!page.length && sales.length < total) throw new Error('Sales history changed. Please try printing again.');
                sales.push(...page);
            } while (sales.length < total);
            if (report.closed) return;
            report.document.open();
            report.document.write(this.buildReport(item, sales, start, end));
            report.document.close();
            report.document.getElementById('printReport').addEventListener('click', () => report.print());
            report.focus();
            report.setTimeout(() => { if (!report.closed) report.print(); }, 250);
        } catch (error) {
            if (!report.closed) report.document.body.textContent = 'Unable to print sales history. Please close this window and try again.';
            alert(error.message);
        } finally {
            button.disabled = false;
        }
    }
};
