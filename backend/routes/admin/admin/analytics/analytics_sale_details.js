// Match the dashboard RPCs: completed sales, excluding any subsequently voided sale.
async function readAll(query) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
        const { data, error } = await query().range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
    }
}

function buildSaleDetails(sales, voids, inventory) {
    const voided = new Set(voids.filter(row => row.entity_type != null && row.entity_id != null)
        .map(row => JSON.stringify([row.entity_type, row.entity_id])));
    const products = new Map(inventory.map(item => [item.id.toLowerCase(), item]));
    const lines = [];
    const orders = [];
    let ordersCount = 0;
    let grossCents = 0;
    let profitCents = 0;
    let itemsSold = 0;
    const cents = value => Math.round(Number(value ?? 0) * 100);
    for (const sale of sales) {
        if (voided.has(JSON.stringify([sale.entity_type, sale.entity_id]))) continue;
        ordersCount++;
        grossCents += cents(sale.sale_total);
        orders.push({
            id: sale.entity_id || sale.id,
            date: sale.created_at,
            customer: sale.customer_name || 'Customer not recorded',
            source: sale.entity_type === 'order' ? 'Customer order' : 'POS sale',
            total: cents(sale.sale_total) / 100,
            items: (Array.isArray(sale.sale_items) ? sale.sale_items : []).map(item => ({
                name: item.name ?? products.get(String(item.id || '').toLowerCase())?.name ?? 'Unknown Product',
                quantity: Number(item.qty ?? 0)
            }))
        });
        for (const item of Array.isArray(sale.sale_items) ? sale.sale_items : []) {
            const product = products.get(String(item.id || '').toLowerCase());
            const quantity = Number(item.qty ?? 0);
            const revenue = quantity * cents(item.price);
            const cost = quantity * cents(item.cost_price ?? product?.cost_price);
            const profit = revenue - cost;
            profitCents += profit;
            itemsSold += quantity;
            lines.push({
                productId: item.id || null,
                saleId: sale.entity_id || sale.id,
                date: sale.created_at,
                name: item.name ?? product?.name ?? 'Unknown Product',
                quantity, revenue: revenue / 100, cost: cost / 100, profit: profit / 100
            });
        }
    }
    return { lines, orders, ordersCount, itemsSold, grossSales: grossCents / 100, totalProfit: profitCents / 100 };
}

async function getSaleDetails(db, start, end) {
    const [sales, voids] = await Promise.all([
        readAll(() => db.from('transactions')
            .select('id,entity_id,entity_type,created_at,sale_items,sale_total,customer_name')
            .eq('action_type', 'sale_complete').gte('created_at', start).lt('created_at', end)
            .order('created_at', { ascending: false }).order('id')),
        // A void outside the selected range still cancels the original sale.
        readAll(() => db.from('transactions').select('id,entity_id,entity_type')
            .eq('action_type', 'sale_void').order('id'))
    ]);
    const ids = [...new Set(sales.flatMap(sale => Array.isArray(sale.sale_items) ? sale.sale_items : [])
        .map(item => String(item.id || '').toLowerCase())
        .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)))];
    const inventory = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await db.from('inventory').select('id,name,cost_price').in('id', ids.slice(offset, offset + 100));
        if (error) throw error;
        inventory.push(...(data || []));
    }
    return buildSaleDetails(sales, voids, inventory);
}

module.exports = { getSaleDetails, buildSaleDetails, readAll };
