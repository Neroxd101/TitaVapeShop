const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('frontend/admin/admin/dashboard/javascript/dashboard_recent_activity.js', 'utf8'), context);

test('dashboard recovers old cancellation IDs and identifies automatic cancellation', () => {
  const transaction = { action_type: 'order_cancel', entity_id: '12345678-abcd',
    sale_items: [{ unavailable: true }], details: { cancelled_by: 'product_deletion',
      reason: 'All products in this order are unavailable.' } };
  assert.equal(context.getActivityTitle(transaction), 'Automatically cancelled order 12345678');
  assert.equal(context.getActivityMeta(transaction), '1 item · All products in this order are unavailable.');
});

test('dashboard respects recorded IDs and distinguishes customer and admin cancellations', () => {
  const transaction = { action_type: 'order_cancel', entity_id: 'different-order',
    details: { order_id: '12345678-abcd', items_count: 2, order_type: 'delivery', cancelled_by: 'customer' } };
  assert.equal(context.getActivityTitle(transaction), 'Customer cancelled order 12345678');
  assert.equal(context.getActivityMeta(transaction), '2 items · delivery');
  delete transaction.details.cancelled_by;
  assert.equal(context.getActivityTitle(transaction), 'Cancelled order 12345678');
  transaction.action_type = 'order_confirm';
  delete transaction.details.order_id;
  assert.equal(context.getActivityTitle(transaction), 'Confirmed order differen');
});

test('dashboard does not invent missing counts or pickup type and escapes cancellation text', () => {
  assert.equal(context.getActivityMeta({ action_type: 'order_cancel', details: {} }), '');
  assert.equal(context.getActivityMeta({ action_type: 'order_cancel', details: {
    items_count: 0, order_type: '<img>', reason: '<script>alert(1)</script>'
  } }), '0 items · &lt;img&gt; · &lt;script&gt;alert(1)&lt;/script&gt;');
});

function routeHarness(rpcResult) {
  let handler;
  const calls = [];
  const scope = { module: { exports: {} }, console: { error() {} }, require(name) {
    if (name === 'express') return { Router: () => ({ get: (...args) => { handler = args.at(-1); } }) };
    if (name.endsWith('/middleware/authMiddleware')) return { isAuthenticated() {}, hasRole: () => () => {} };
    if (name.endsWith('/database/supabase')) return { supabaseAdmin: { rpc: async (...args) => { calls.push(args); return rpcResult; } } };
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync('backend/routes/admin/admin/dashboard/dashboard_recent_activity.js', 'utf8'), scope);
  return { calls, async request() {
    const response = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; } };
    await handler({}, response);
    return response;
  } };
}

test('dashboard uses the shared activity reader and retains the response shape', async () => {
  const transactions = [{ action_type: 'order_cancel', entity_id: '12345678-abcd',
    details: { order_id: '12345678-abcd', items_count: 1, order_type: 'delivery' } }];
  const api = routeHarness({ data: { success: true, transactions } });
  const response = await api.request();
  assert.equal(response.statusCode, 200);
  assert.equal(api.calls[0][0], 'transactions_get_all');
  assert.equal(api.calls[0][1].p_limit, 14);
  assert.deepEqual(response.body.data, transactions);
});

test('dashboard reports reader failures instead of showing corrupt activity data', async () => {
  for (const result of [{ error: new Error('Database unavailable') }, { data: { success: false } }]) {
    assert.equal((await routeHarness(result).request()).statusCode, 503);
  }
});
