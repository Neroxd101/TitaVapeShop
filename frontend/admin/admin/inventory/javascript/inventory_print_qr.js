// Print QR codes for inventory products currently matching the active filters.
const InventoryQrPrint = {
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

    buildReport(products) {
        const cards = products.map(item => `
            <article class="qr-card">
                <img src="${this.escape(this.getPrintableImageUrl(item.qr_image_url))}" alt="QR code for ${this.escape(item.name)}">
                <strong>${this.escape(item.name)}</strong>
            </article>`).join('');
        return `<!doctype html><html lang="en"><head><meta charset="utf-8">
            <title>Inventory QR Codes</title><style>
            @page { size: A4; margin: 12mm; }
            body { font: 14px Arial, sans-serif; color: #111; margin: 20px; }
            h1 { font-size: 22px; margin: 0 0 6px; }
            p { margin: 0 0 18px; }
            .qr-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
            .qr-card { border: 1px solid #bbb; padding: 8px 5px; min-height: 135px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; break-inside: avoid; }
            .qr-card img { width: 92px; height: 92px; object-fit: contain; margin-bottom: 7px; }
            .qr-card strong { font-size: 10px; line-height: 1.2; overflow-wrap: anywhere; }
            button { padding: 8px 16px; margin-bottom: 16px; }
            @media print { button { display: none; } }
            </style></head><body><button id="printQr">Print / Save PDF</button>
            <h1>Tita's Vape Shop — Product QR Codes</h1>
            <p>Generated: ${this.escape(new Date().toLocaleString('en-PH'))} | Products: ${products.length}</p>
            <div class="qr-grid">${cards}</div></body></html>`;
    },

    print() {
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
        report.document.write(this.buildReport(products));
        report.document.close();
        report.document.getElementById('printQr').addEventListener('click', () => report.print());
        report.focus();
        report.setTimeout(() => report.print(), 250);
    }
};
