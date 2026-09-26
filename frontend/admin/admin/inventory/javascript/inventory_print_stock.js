// Print a snapshot of the inventory currently displayed, using the same filters.
const InventoryPrint = {
    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    },

    getPrintableImageUrl(url) {
        if (!url) return '';
        const match = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)|\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = match?.[1] || match?.[2];
        return fileId ? `/api/catalog/image/${encodeURIComponent(fileId)}` : String(url);
    },

    buildReport(items) {
        const escape = value => this.escape(value);
        const stockLabels = { all: 'All Stock', low: 'Low Stock (1–5)', none: 'No Stock (0)' };
        const filters = [
            `Category: ${InventoryState.currentFilter === 'all' ? 'All' : InventoryState.currentFilter}`
        ];
        if (InventoryState.searchQuery) filters.push(`Search: ${InventoryState.searchQuery}`);
        if (InventoryState.addedDateFrom) filters.push(`Date added from: ${InventoryState.addedDateFrom}`);
        if (InventoryState.addedDateTo) filters.push(`Date added to: ${InventoryState.addedDateTo}`);
        const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const rows = items.map((item, index) => {
            const quantity = Number(item.quantity || 0);
            const status = quantity === 0 ? 'No Stock' : quantity <= 5 ? 'Low Stock' : 'In Stock';
            return `<tr><td>${index + 1}</td><td>${escape(item.name)}</td><td>${escape(item.category)}</td>
                <td class="number">${quantity}</td><td>${status}</td></tr>`;
        }).join('');
        return `<!doctype html><html lang="en"><head><meta charset="utf-8">
            <title>Inventory Stock Report</title><style>
            @page { size: A4; margin: 12mm; }
            body { font: 12px Arial, sans-serif; color: #111; margin: 20px; position: relative; }
            body > :not(.print-watermark) { position: relative; z-index: 1; }
            .print-watermark { position: fixed; inset: 0; z-index: 0; display: grid;
                grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(4, 1fr);
                align-items: center; justify-items: center; overflow: hidden; pointer-events: none; }
            .print-watermark span { color: rgba(0,0,0,.055); font-size: 18px; font-weight: 700;
                letter-spacing: 1px; white-space: nowrap; transform: rotate(-32deg); }
            h1 { font-size: 22px; margin-bottom: 6px; }
            p { line-height: 1.5; overflow-wrap: anywhere; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #bbb; padding: 8px; text-align: left; overflow-wrap: anywhere; }
            th { background: #eee; } th:first-child { width: 6%; } th:nth-child(2) { width: 40%; }
            .number { text-align: right; } thead { display: table-header-group; }
            tr { break-inside: avoid; } button { padding: 8px 16px; margin-bottom: 16px; }
            @media print { body { margin: 0; } button { display: none; } }
            </style></head><body>
            <div class="print-watermark" aria-hidden="true">${Array.from({ length: 12 }, () => '<span>TitaVapeShop™</span>').join('')}</div>
            <button id="printReport">Print / Save PDF</button>
            <h1>Tita's Vape Shop — Stock Report</h1>
            <p>Generated: ${escape(new Date().toLocaleString('en-PH'))}</p>
            <p>${escape(filters.join(' | '))}</p>
            <p><strong>Products: ${items.length} | Total units: ${totalUnits}</strong></p>
            <table><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Quantity</th><th>Stock Status</th></tr></thead>
            <tbody>${rows}</tbody></table></body></html>`;
    },

    print() {
        const items = InventoryFilter.filterItems(InventoryState.inventoryItems);
        if (!items.length) {
            alert('No stocks match the current filters.');
            return;
        }
        const report = window.open('', '_blank');
        if (!report) {
            alert('Please allow pop-ups to print stocks.');
            return;
        }
        report.document.write(this.buildReport(items));
        report.document.close();
        report.document.getElementById('printReport').addEventListener('click', () => report.print());
        report.focus();
        report.setTimeout(() => report.print(), 250);
    }
};
