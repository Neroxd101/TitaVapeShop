const PosSalesHistory = {
    sales: [], offset: 0, total: 0, canVoid: false, busy: false, requestId: 0,
    init(onStockChanged) {
        this.onStockChanged = onStockChanged;
        document.getElementById('openSalesHistoryBtn').addEventListener('click', () => {
            document.getElementById('posSalesHistoryDialog').showModal();
            this.offset = 0;
            this.load();
        });
        document.querySelectorAll('.pos-history-dialog [data-history-close]').forEach(button => button.addEventListener('click', () => {
            if (!this.busy) button.closest('dialog').close();
        }));
        document.getElementById('posVoidDialog').addEventListener('cancel', event => { if (this.busy) event.preventDefault(); });
        const filters = document.getElementById('posHistoryFilters');
        let searchTimer;
        const refreshFilters = () => {
            clearTimeout(searchTimer);
            this.offset = 0;
            this.load();
        };
        filters.addEventListener('submit', event => {
            event.preventDefault();
            refreshFilters();
        });
        const syncDateHint = input => { input.dataset.empty = String(!input.value); };
        filters.querySelectorAll('input[type="date"]').forEach(input => {
            syncDateHint(input);
            input.addEventListener('input', () => syncDateHint(input));
            input.addEventListener('change', () => {
                syncDateHint(input);
                refreshFilters();
            });
        });
        document.getElementById('posHistorySearch').addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(refreshFilters, 300);
        });
        document.getElementById('posHistoryPrev').addEventListener('click', () => { this.offset = Math.max(0, this.offset - 20); this.load(); });
        document.getElementById('posHistoryNext').addEventListener('click', () => { this.offset += 20; this.load(); });
        document.getElementById('posHistoryRows').addEventListener('click', event => {
            const button = event.target.closest('[data-pos-sale]');
            if (!button) return;
            const sale = this.sales.find(item => item.id === button.dataset.posSale);
            if (!sale) return;
            if (button.dataset.action === 'void') this.openVoid(sale);
            else if (button.dataset.action === 'print') this.print(sale);
            else this.view(sale);
        });
        document.getElementById('posSaleDetailsContent').addEventListener('click', event => {
            const photo = event.target.closest('[data-preview-payment-photo]')?.querySelector('img');
            if (photo) {
                document.getElementById('posPaymentPhotoLarge').src = photo.src;
                document.getElementById('posPaymentPhotoDialog').showModal();
                return;
            }
        });
        document.getElementById('posVoidForm').addEventListener('submit', event => { event.preventDefault(); this.voidSale(); });
    },
    escape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); },
    money(value) { return '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    date(value) { return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }); },
    async load() {
        const requestId = ++this.requestId;
        const status = document.getElementById('posHistoryStatus');
        const rows = document.getElementById('posHistoryRows');
        status.textContent = 'Loading sales…';
        rows.replaceChildren();
        document.getElementById('posHistoryPrev').disabled = true;
        document.getElementById('posHistoryNext').disabled = true;
        const params = new URLSearchParams({ offset: this.offset, search: document.getElementById('posHistorySearch').value.trim() });
        const from = document.getElementById('posHistoryFrom').value;
        const to = document.getElementById('posHistoryTo').value;
        if (from && to && from > to) { status.textContent = 'From date must be on or before To date.'; return; }
        if (from) params.set('start_date', new Date(from + 'T00:00:00+08:00').toISOString());
        if (to) { const end = new Date(to + 'T00:00:00+08:00'); end.setUTCDate(end.getUTCDate() + 1); params.set('end_date', end.toISOString()); }
        try {
            const response = await fetch('/api/pos/sales-history?' + params, { headers: { Accept: 'application/json' }, credentials: 'include' });
            const result = await response.json();
            if (requestId !== this.requestId) return;
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load history.');
            this.sales = result.sales || [];
            this.total = Number(result.total || 0);
            this.canVoid = result.canVoid === true;
            const e = value => this.escape(value);
            rows.innerHTML = this.sales.map(sale => `<tr>
                <td><code>${e(sale.id)}</code><small>${e(this.date(sale.created_at))}</small></td>
                <td>${e(sale.customer_name || 'Walk-in')}<small>${e(sale.user_email || 'Not recorded')}</small></td>
                <td>${e(this.money(sale.sale_total))}</td>
                <td><span class="pos-history-badge ${sale.voided ? 'is-voided' : ''}">${sale.voided ? 'Voided' : 'Completed'}</span></td>
                <td><div class="pos-history-actions">
                    <button type="button" class="btn btn-secondary btn-small" data-pos-sale="${e(sale.id)}" data-action="view">View</button>
                    <button type="button" class="btn btn-secondary btn-small" data-pos-sale="${e(sale.id)}" data-action="print">Print</button>
                    ${this.canVoid && !sale.voided ? `<button type="button" class="btn btn-danger btn-small" data-pos-sale="${e(sale.id)}" data-action="void">Void</button>` : ''}
                </div></td>
            </tr>`).join('');
            status.textContent = this.sales.length ? '' : 'No POS sales found.';
            document.getElementById('posHistoryPage').textContent = this.total ? `${this.offset + 1}–${Math.min(this.offset + 20, this.total)} of ${this.total}` : '0 sales';
            document.getElementById('posHistoryPrev').disabled = this.offset === 0;
            document.getElementById('posHistoryNext').disabled = this.offset + 20 >= this.total;
        } catch (error) { if (requestId === this.requestId) { status.textContent = error.message; this.sales = []; } }
    },
    print(sale, status = document.getElementById('posHistoryStatus')) {
        const receipt = window.open('', '_blank');
        if (!receipt) {
            status.textContent = 'Allow pop-ups for this site to print the receipt.';
            return;
        }

        const e = value => this.escape(value);
        const money = value => e(this.money(value));
        const payment = sale.details || {};
        const online = payment.payment_method === 'online';
        const cash = sale.cash ?? payment.cash;
        const change = sale.change ?? payment.change;
        const rows = (sale.sale_items || []).map(item => {
            const variation = item.selected_variation || item.variation;
            return `<tr>
                <td>${e(item.name || 'Product')}${variation ? `<br><small>${e(variation)}</small>` : ''}</td>
                <td>${e(item.qty)}</td>
                <td>${money(item.price)}</td>
                <td>${money(Number(item.qty) * Number(item.price))}</td>
            </tr>`;
        }).join('');

        receipt.document.open();
        receipt.document.write(`<!doctype html>
            <html lang="en"><head><meta charset="utf-8"><title>POS Receipt</title>
            <style>
                @page { margin: 4mm; }
                body { max-width: 72mm; margin: 16px auto; color: #111; font: 12px Arial, sans-serif; overflow-wrap: anywhere; }
                h1, .receipt-heading { text-align: center; }
                h1 { font-size: 16px; margin-bottom: 4px; }
                p { margin: 5px 0; }
                .receipt-cash { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
                .receipt-cash span:last-child { text-align: right; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border-bottom: 1px solid #ccc; padding: 5px 2px; text-align: right; }
                th:first-child, td:first-child { text-align: left; }
                tr { break-inside: avoid; }
                .receipt-total { text-align: right; font-size: 14px; }
                @media print { button { display: none; } body { margin: 0 auto; } }
            </style></head><body>
            <button type="button" id="printReceipt">Print</button>
            <h1>Tita's Vape Shop</h1>
            <p class="receipt-heading"><strong>${sale.voided ? 'VOIDED SALE' : 'Sales Receipt'}</strong></p>
            ${sale.id ? `<p>Sale ID: ${e(sale.id)}</p>` : ''}
            <p>Date: ${e(this.date(sale.created_at))}</p>
            <p>Customer: ${e(sale.customer_name || 'Walk-in')}</p>
            <p>Payment: ${online ? 'Online Payment' : 'Cash'}</p>
            ${!online && cash != null && change != null ? `<p class="receipt-cash"><span>Cash: ${money(cash)}</span><span>Change: ${money(change)}</span></p>` : ''}
            ${online && payment.payment_reference ? `<p>Reference: ${e(payment.payment_reference)}</p>` : ''}
            <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <p class="receipt-total"><strong>${sale.voided ? 'Original total' : 'Total'}: ${money(sale.sale_total)}</strong></p>
            </body></html>`);
        receipt.document.close();
        receipt.document.getElementById('printReceipt').addEventListener('click', () => receipt.print());
        receipt.focus();
        receipt.print();
    },
    view(sale) {
        this.selected = sale;
        const e = value => this.escape(value);
        const details = sale.void_details || {};
        const payment = sale.details || {};
        const online = payment.payment_method === 'online';
        const proof = online && typeof payment.payment_proof === 'string'
            && (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(payment.payment_proof)
                || /^https:\/\/res\.cloudinary\.com\/titavapeshop\/image\/upload\/[A-Za-z0-9_./%-]+$/.test(payment.payment_proof))
            ? payment.payment_proof : null;
        document.getElementById('posSaleDetailsContent').innerHTML = `
            <div class="pos-sale-overview">
            <div class="pos-sale-info"><p><strong>Sale ID:</strong> <code>${e(sale.id)}</code></p>
            <p><strong>Date:</strong> ${e(this.date(sale.created_at))}</p><p><strong>Customer:</strong> ${e(sale.customer_name || 'Walk-in')}</p>
            <p><strong>Cashier:</strong> ${e(sale.user_email || 'Not recorded')}</p><p><strong>Status:</strong> ${sale.voided ? 'Voided' : 'Completed'}</p>
            <p><strong>Payment:</strong> ${online ? 'Online Payment' : 'Cash'}</p>
            ${!online && payment.cash != null && payment.change != null
                ? `<p><strong>Cash:</strong> ${e(this.money(payment.cash))}</p><p><strong>Change:</strong> ${e(this.money(payment.change))}</p>`
                : ''}
            ${online && payment.payment_reference ? '<p><strong>Reference:</strong> ' + e(payment.payment_reference) + '</p>' : ''}
            </div>
            ${proof ? '<figure class="pos-sale-proof"><figcaption>Payment photo</figcaption><button type="button" data-preview-payment-photo aria-label="Enlarge payment photo"><img alt="" src="' + proof + '"></button></figure>' : ''}
            </div>
            <div class="pos-history-scroll"><table class="pos-history-table"><thead><tr><th>Item / Variant</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead><tbody>
            ${(sale.sale_items || []).map(item => `<tr><td>${e(item.name || 'Product')}<small>${e(item.selected_variation || item.variation || '')}</small></td><td>${e(item.qty)}</td><td>${e(this.money(item.price))}</td><td>${e(this.money(Number(item.qty) * Number(item.price)))}</td></tr>`).join('')}
            </tbody></table></div>
            <p class="pos-sale-total"><strong>Total: ${e(this.money(sale.sale_total))}</strong></p>
            ${sale.voided ? `<div class="pos-void-audit"><h3>Void Details</h3><p>${e(this.date(sale.voided_at))} · ${e(sale.voided_by || 'Not recorded')}</p>
                <p><strong>Reason:</strong> ${e(details.reason)}</p>
                <p><strong>Stock restored:</strong> ${(details.restocked_items || []).reduce((n, item) => n + Number(item.qty || 0), 0)} unit(s)</p>
                ${(details.restock_skipped_items || []).map(item => `<p>${e(item.name || item.id)}${item.selected_variation ? ' / ' + e(item.selected_variation) : ''}: ${e(item.restock_skipped_reason)}</p>`).join('')}
                <p>Refund due: ${e(this.money(details.refund_amount ?? sale.sale_total))}. Handle the refund separately.</p></div>` : ''}`;
        document.getElementById('posSaleDetailsDialog').showModal();
    },
    openVoid(sale) {
        if (!sale || !this.canVoid || sale.voided || this.busy) return;
        this.selected = sale;
        document.getElementById('posVoidForm').reset();
        document.getElementById('posVoidSummary').textContent = `${sale.id} · ${this.money(sale.sale_total)} · ${sale.customer_name || 'Walk-in'}`;
        document.getElementById('posVoidStatus').textContent = '';
        document.getElementById('posVoidDialog').showModal();
    },
    async voidSale() {
        if (this.busy || !this.selected || !this.canVoid || this.selected.voided) return;
        const reason = document.getElementById('posVoidReason').value.trim();
        const status = document.getElementById('posVoidStatus');
        if (!reason || reason.length > 1000) { status.textContent = 'Enter a reason of 1–1,000 characters.'; return; }
        this.busy = true;
        const dialog = document.getElementById('posVoidDialog');
        dialog.querySelectorAll('button, input, textarea').forEach(element => element.disabled = true);
        status.textContent = 'Voiding sale…';
        try {
            const response = await fetch('/api/pos/void-sale', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include',
                body: JSON.stringify({ sale_id: this.selected.id, reason })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to void sale.');
            this.selected.voided = true;
            dialog.close();
            document.getElementById('posSaleDetailsDialog').close();
            await this.load();
            document.getElementById('posHistoryStatus').textContent = `Sale voided. ${(result.restocked_items || []).reduce((n, item) => n + Number(item.qty || 0), 0)} unit(s) returned to stock. Refund due: ${this.money(result.refund_amount)}; handle separately. View the sale for any skipped stock returns.`;
            await this.onStockChanged?.();
        } catch (error) { status.textContent = error.message; }
        finally { this.busy = false; dialog.querySelectorAll('button, input, textarea').forEach(element => element.disabled = false); }
    }
};
window.PosSalesHistory = PosSalesHistory;
