const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const orderId = '11111111-2222-4333-8444-555555555555';

function harness() {
  const elements = new Map();
  const alerts = [];
  for (const id of ['confirmRefundModal', 'confirmRefundAmount', 'confirmRefundBtn',
    'cancelRefundBtn', 'closeRefundModal', 'orderDetailsModal', 'orderDetailsContent']) {
    elements.set(id, { value: '', innerHTML: '', events: {}, shown: false,
      classList: { add() {}, remove() {} },
      addEventListener(event, handler) { this.events[event] = handler; } });
  }
  const context = { window: {}, document: { getElementById: id => elements.get(id) },
    alert: message => alerts.push(message), console };
  vm.createContext(context);
  for (const file of ['frontend/customer/javascript/order-availability.js',
    'frontend/admin/admin/orders/javascript/orders_modals.js',
    'frontend/admin/admin/orders/javascript/orders_view_modal.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  }
  const order = { id: orderId, order_type: 'delivery', total_amount: 1500, payment_status: 'paid',
    refund_due_amount: 600, refunded_amount: 0, status: 'cancelled', items: [{ name: 'Deleted', unavailable: true }] };
  const controller = { state: { orders: [order] }, renderOrders() {},
    viewOrder: id => context.window.OrdersViewModal.viewOrder(id) };
  const modals = context.window.OrdersModals;
  modals.init(controller);
  context.window.OrdersViewModal.init(controller);
  return { modals, elements, context, order, alerts };
}

test('only eligible paid orders show refund action; settled notice retains amount', () => {
  const { context, elements, order } = harness();
  const render = () => {
    context.window.OrdersViewModal.viewOrder(orderId);
    return elements.get('orderDetailsContent').innerHTML;
  };
  assert.match(render(), /Mark Refunded/);
  assert.doesNotMatch(render(), /Please contact the store/);
  order.payment_status = 'pending_verification';
  assert.doesNotMatch(render(), /Mark Refunded/);
  order.payment_status = 'paid';
  order.refund_due_amount = 0;
  order.refunded_amount = 600;
  assert.doesNotMatch(render(), /Mark Refunded|Refund due:/);
  assert.match(render(), /Refunded: ₱600\.00/);
  const customerNotice = context.window.OrderAvailability.notice(order);
  assert.match(customerNotice, /Refunded: ₱600\.00/);
  assert.doesNotMatch(customerNotice, /Please contact the store|Refund due:/);
});

test('refund confirmation captures displayed balance and blocks duplicate submission', async () => {
  const { modals, elements, context, order } = harness();
  let finish;
  let submitted;
  let calls = 0;
  context.window.OrdersUpdatePaymentStatus = { markRefunded: payload => {
    calls++;
    submitted = JSON.parse(JSON.stringify(payload));
    return new Promise(resolve => { finish = resolve; });
  } };
  modals.markRefunded(orderId);
  assert.equal(elements.get('confirmRefundAmount').textContent, '₱600.00');
  const pending = modals.executeMarkRefunded();
  assert.equal(elements.get('confirmRefundBtn').disabled, true);
  assert.equal(await modals.executeMarkRefunded(), false);
  assert.equal(calls, 1);
  assert.deepEqual(submitted, { order_id: orderId, refund_amount: 600, expected_refunded_amount: 0 });
  finish({ success: true, order: { ...order, refund_due_amount: 0, refunded_amount: 600 } });
  assert.equal(await pending, true);
  assert.equal(order.refund_due_amount, 0);
  assert.equal(order.refunded_amount, 600);
  assert.equal(elements.get('confirmRefundBtn').disabled, false);
});

test('failed refund keeps original balance and permits retry', async () => {
  const { modals, context, order, alerts } = harness();
  context.window.OrdersUpdatePaymentStatus = { markRefunded: async () => ({ success: false, error: 'Refund balance changed.' }) };
  modals.markRefunded(orderId);
  assert.equal(await modals.executeMarkRefunded(), false);
  assert.equal(order.refund_due_amount, 600);
  assert.equal(order.refunded_amount, 0);
  assert.equal(modals.refundSubmitting, false);
  assert.deepEqual(alerts, ['Refund balance changed.']);
});

function apiHarness() {
  const routes = new Map();
  const calls = [];
  const context = { module: { exports: {} }, console, require(name) {
    if (name === 'express') return { Router: () => ({ post: (path, ...handlers) => routes.set(path, handlers.at(-1)) }) };
    if (name.endsWith('/database/supabase')) return { supabaseAdmin: { rpc: async (...args) => {
      calls.push(args); return { data: [{ id: orderId, refund_due_amount: 0, refunded_amount: 600 }] };
    } } };
    if (name.endsWith('/middleware/authMiddleware')) return { isAuthenticated() {}, hasRole: () => () => {} };
    throw new Error('Unexpected dependency');
  } };
  vm.runInNewContext(fs.readFileSync('backend/routes/admin/admin/orders/orders_update_payment_status.js', 'utf8'), context);
  return { calls, async request(body) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    await routes.get('/api/orders/mark_refunded')({ body, user: { username: 'admin' } }, response);
    return response;
  } };
}

test('refund API rejects invalid amounts and IDs before calling database', async () => {
  const api = apiHarness();
  const valid = { order_id: orderId, refund_amount: 600, expected_refunded_amount: 0 };
  for (const change of [{ order_id: '' }, { order_id: 'invalid' }, { refund_amount: '600' },
    { refund_amount: 0 }, { refund_amount: -1 }, { refund_amount: NaN }, { refund_amount: Infinity },
    { expected_refunded_amount: undefined }, { expected_refunded_amount: -1 }, { expected_refunded_amount: Infinity }]) {
    assert.equal((await api.request({ ...valid, ...change })).statusCode, 400);
  }
  assert.equal(api.calls.length, 0);
  const response = await api.request(valid);
  assert.equal(response.statusCode, 200);
  assert.equal(api.calls[0][0], 'orders_mark_refunded');
  assert.equal(api.calls[0][1].p_user_email, 'admin');
  assert.equal(response.body.order.refund_due_amount, 0);
});
