const fs = require('node:fs');
const files = [
  'analytics_total_profit.sql', 'analytics_modal_total_profit.sql',
  'analytics_gross_sales.sql', 'analytics_modal_gross_sales.sql',
  'analytics_sales_trend.sql', 'analytics_top_products.sql', 'analytics_category_stats.sql'
];
const source = files.map(file => fs.readFileSync('supabase/migrations/admin/admin/analytics/' + file, 'utf8')).join('\n');
if (process.argv.includes('--deployment')) {
  process.stdout.write("BEGIN;\n" + source + "\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n");
} else {
  process.stdout.write(`BEGIN;
SET LOCAL statement_timeout = '20s';
CREATE SCHEMA analytics_overflow_test;
SET LOCAL search_path = analytics_overflow_test;
CREATE TABLE analytics_overflow_test.inventory (LIKE public.inventory INCLUDING ALL);
CREATE TABLE analytics_overflow_test.transactions (LIKE public.transactions INCLUDING ALL);
` + source.replaceAll('public.', 'analytics_overflow_test.').replaceAll('search_path = public', 'search_path = analytics_overflow_test') + '\n' +
    fs.readFileSync('tests/analytics-overflow.sql', 'utf8') + '\nROLLBACK;\n');
}
