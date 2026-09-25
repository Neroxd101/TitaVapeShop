// Print a snapshot of the inventory currently displayed, using the same filters.
const InventoryPrint = {
    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
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
        const items = InventoryLoad.filterItems();
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
    },

    buildQrReport(items) {
        const products = items.filter(item => item.qr_image_url);
        const cards = products.map(item => `
            <article class="qr-card">
                <img src="${this.escape(item.qr_image_url)}" alt="QR code for ${this.escape(item.name)}">
                <strong>${this.escape(item.name)}</strong>
            </article>`).join('');
        return `<!doctype html><html lang="en"><head><meta charset="utf-8">
            <title>Inventory QR Codes</title><style>
            @page { size: A4; margin: 12mm; }
            body { font: 14px Arial, sans-serif; color: #111; margin: 20px; }
            h1 { font-size: 22px; margin: 0 0 6px; }
            p { margin: 0 0 18px; }
            .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
            .qr-card { border: 1px solid #bbb; padding: 12px; min-height: 190px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; break-inside: avoid; }
            .qr-card img { width: 140px; height: 140px; object-fit: contain; margin-bottom: 10px; }
            .qr-card strong { overflow-wrap: anywhere; }
            button { padding: 8px 16px; margin-bottom: 16px; }
            @media print { button { display: none; } }
            </style></head><body><button id="printQr">Print / Save PDF</button>
            <h1>Tita's Vape Shop — Product QR Codes</h1>
            <p>Generated: ${this.escape(new Date().toLocaleString('en-PH'))} | Products: ${products.length}</p>
            <div class="qr-grid">${cards}</div></body></html>`;
    },

    printQr() {
        const products = InventoryLoad.filterItems().filter(item => item.qr_image_url);
        if (!products.length) {
            alert('No products with QR codes match the current filters.');
            return;
        }
        const report = window.open('', '_blank');
        if (!report) {
            alert('Please allow pop-ups to print QR codes.');
            return;
        }
        report.document.write(this.buildQrReport(products));
        report.document.close();
        report.document.getElementById('printQr').addEventListener('click', () => report.print());
        report.focus();
        report.setTimeout(() => report.print(), 250);
    }
};
