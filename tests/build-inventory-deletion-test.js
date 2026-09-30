// Output a single rollback-only SQL test query. Never runs against business tables.
const fs = require('node:fs');
const sources = [
  'admin/admin/activity-log/transactions_log.sql',
  'admin/admin/inventory/inventory_delete_item.sql',
  'admin/admin/orders/orders_update_status.sql',
  'admin/admin/orders/orders_void.sql',
  'admin/admin/orders/orders_update_payment_status.sql',
  'admin/admin/pos/pos_process.sql',
  'customers/customer_create_order.sql',
  'customers/customer_submit_payment_proof.sql',
  'customers/customer_track_order.sql',
  'customers/customer_get_orders.sql',
  'admin/admin/orders/orders_get_all.sql',
  'admin/admin/activity-log/transactions_get_all.sql',
];
if (process.argv.includes('--deployment')) {
  // Existing RPC sources are the repository's source of truth. Emit them in
  // dependency order for a single atomic database update.
  process.stdout.write('BEGIN;\n' + sources.map(file =>
    fs.readFileSync('supabase/migrations/' + file, 'utf8').replace(/^\uFEFF/, '')
  ).join('\n') + "\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n");
  process.exit(0);
}
let query = `BEGIN;
SET LOCAL statement_timeout = '20s';
CREATE SCHEMA deletion_test;
SET LOCAL search_path = deletion_test;
`;
for (const table of ['inventory', 'orders', 'customers', 'transactions']) {
  query += `CREATE TABLE deletion_test.${table} (LIKE public.${table} INCLUDING ALL);\n`;
}
for (const file of sources) {
  query += fs.readFileSync('supabase/migrations/' + file, 'utf8').replace(/^\uFEFF/, '')
    .replaceAll('public.', 'deletion_test.').replaceAll('search_path = public', 'search_path = deletion_test') + '\n';
}
query += fs.readFileSync('tests/inventory-deletion.sql', 'utf8') + '\nROLLBACK;\n';
process.stdout.write(query);
