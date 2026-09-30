const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const user = { id: 'fixture-user', username: 'Test Admin', full_name: 'Test Customer', roles: ['admin'], role: 'admin', email: 'test@example.invalid', contact_number: '09123456789', is_verified: true };
const product = { id: 'fixture-product', name: 'Fixture Product', category: 'hardware', quantity: 8, cost_price: 50, sale_price: 100, images: [], variations: [{ name: 'Blue', quantity: 8 }], description: 'Local verification product', total_profit: 0 };
const pages = ['catalog/catalog.html', 'admin/login/login.html', 'admin/login/forgot-password.html', 'admin/admin/dashboard/dashboard.html', 'admin/admin/inventory/inventory.html', 'admin/admin/analytics/analytics.html', 'admin/admin/pos/pos.html', 'admin/admin/orders/orders.html', 'admin/admin/activity-log/activity-log.html', 'admin/admin/setting/settings.html', 'order-status?id=partial', 'order-status?id=cancelled', 'order-status?id=delivery', 'order-details-preview'];
const sizes = [{ width: 1440, height: 900 }, { width: 1024, height: 600 }, { width: 390, height: 844 }];
const artifacts = process.env.VERIFICATION_DIR || os.tmpdir();
const results = [], errors = [], consoleErrors = [], missing = [], styles = {};
(async () => {
 const executable = process.env.BROWSER_EXECUTABLE_PATH || ['C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe','C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe'].find(file => fs.existsSync(file));
 const browser = await playwright.chromium.launch({ executablePath: executable, headless: true });
 try {
 const context = await browser.newContext();
 await context.addInitScript(({ user }) => { localStorage.setItem('user', JSON.stringify(user)); }, { user });
 await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== 'http://127.0.0.1:3101') {
   if (request.resourceType() === 'script') return route.fulfill({ contentType: 'application/javascript', body: 'window.Chart=class {constructor(ctx,config){this.data=config.data;this.options=config.options;}destroy(){}update(){}};window.QRCode=class{static CorrectLevel={H:2};constructor(element){element.appendChild(document.createElement("canvas"));}};window.Html5Qrcode=class{};' });
   return route.fulfill({ contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'text/plain', body: '' });
  }
  const pathname = url.pathname;
  if (pathname === '/api/customer/orders/track' || pathname === '/api/orders/mark_refunded') return route.continue();
  if (pathname.startsWith('/api/') || (!path.extname(pathname) && /(?:get_|summaries|categories|products|store_hours|store_link|\/settings|\/pos_process|google\/|\/auth\/)/.test(pathname))) {
   let payload = { success: true, data: [], items: [], orders: [], products: [], categories: [{ name: 'Hardware', slug: 'hardware' }], transactions: [], total: 0, authenticated: true, user, connected: false, exists: false, settings: {}, users: [user], operating_hours: [], totalProfit: 0, totalOrders: 0, ordersCount: 0, itemsSold: 0, grossSales: 0, salesTrend: [], topProducts: [], categoryStats: {}, total_profit: 0, total_orders: 0, total_items_sold: 0, gross_sales: 0, sales: [], trend: [], summary: {} };
   if (/catalog\/products|inventory_get_all|pos_get_products/.test(pathname)) payload.data = [product];
   if (/dashboard/.test(pathname)) payload.data = { total_products: 1, low_stock_count: 0, low_stock_items: [], pending_count: 0, pending_orders: [], recent_activity: [], total_sales: 0, total_profit: 0 };
   if (/dashboard_recent_activity/.test(pathname)) payload.data = [];
   return route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
  }
  return route.continue();
 });
 for (const size of sizes) for (const target of pages) {
  const key = target + '@' + size.width;
  const page = await context.newPage(); await page.setViewportSize(size);
  page.on('dialog', dialog => dialog.dismiss());
  page.on('pageerror', error => errors.push({ page: key, message: error.message }));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) consoleErrors.push({ page: key, message: message.text() }); });
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:3101')) missing.push({ page: key, status: response.status(), url: new URL(response.url()).pathname }); });
  const response = await page.goto('http://127.0.0.1:3101/' + target, { waitUntil: 'networkidle', timeout: 15000 });
  assert.equal(response.status(), 200, target);
  if (target === 'catalog/catalog.html') { await page.evaluate(product => { CatalogProductModal.show(product); }, product); }
  if (target === 'admin/admin/inventory/inventory.html') { await page.evaluate(product => { InventoryState.items=[product]; return InventoryViewModal.viewItem(product.id); }, product); }
  styles[key] = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getClientRects().length && !['SCRIPT','STYLE','LINK'].includes(element.tagName)).map(element => { const style=getComputedStyle(element); const box=element.getBoundingClientRect();return [element.tagName,element.id,element.className,...['display','position','color','backgroundColor','fontSize','padding','gap','gridTemplateColumns'].map(name=>style[name]),...[box.width,box.height].map(value=>Math.round(value))]; }));
  results.push({ page: key, visibleElements: styles[key].length, styleHash: crypto.createHash('sha256').update(JSON.stringify(styles[key])).digest('hex') });
  if (size.width === 1440 && /inventory\/inventory|order-details-preview/.test(target)) await page.screenshot({ path: path.join(os.tmpdir(),target.includes('inventory')?'titas-inventory-verification.png':'titas-order-verification.png'), fullPage: true });
  await page.close();
 }
 const mode=process.argv[2] || 'smoke';
 const output={ browser: await browser.version(), pageChecks: results.length, results, errors, consoleErrors, missing };
 fs.writeFileSync(path.join(artifacts, 'titas-verification-' + mode + '.json'),JSON.stringify(output,null,2));
 fs.writeFileSync(path.join(artifacts, 'titas-verification-styles-' + mode + '.json'),JSON.stringify(styles));
 console.log(JSON.stringify({ pageChecks: results.length, errors, consoleErrors, missing },null,2));
 assert.equal(errors.length, 0, 'Browser JavaScript errors');
 assert.equal(consoleErrors.length, 0, 'Browser console errors');
 assert.equal(missing.length, 0, 'Missing local assets');
 if (mode === 'after') {
  const before=JSON.parse(fs.readFileSync(path.join(artifacts, 'titas-verification-styles-baseline.json'),'utf8'));
  assert.deepEqual(styles, before, 'Rendered styles changed after CSS cleanup');
  console.log('All 42 rendered style snapshots match the baseline.');
 }
 } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode=1; });
