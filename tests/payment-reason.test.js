const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function modalHarness() {
  const elements = new Map();
  const alerts = [];
  for (const id of ['confirmVerifyPaymentModal', 'confirmVerifyPaymentBtn',
    'confirmMarkUnpaidModal', 'confirmMarkUnpaidBtn', 'markUnpaidReason',
    'paymentRejectionReasonGroup']) {
    elements.set(id, { value: '', hidden: true, required: false, events: {},
      classList: { add() {}, remove() {} },
      addEventListener(event, handler) { this.events[event] = handler; },
      focus() { this.focused = true; } });
  }
  const context = { window: {}, document: { getElementById: id => elements.get(id) },
    alert: message => alerts.push(message), console };
  vm.runInNewContext(fs.readFileSync('frontend/admin/admin/orders/javascript/orders_modals.js', 'utf8'), context);
  const modals = context.window.OrdersModals;
  modals.setupEventListeners();
  return { modals, elements, alerts, context };
}

test('payment confirmation proceeds without a reason field', () => {
  const { modals, elements, alerts } = modalHarness();
  let submitted;
  modals.executeVerifyPayment = (...args) => { submitted = args; };
  modals.verifyPayment('order-1', 'paid');
  elements.get('confirmVerifyPaymentBtn').events.click();
  assert.deepEqual(submitted, ['order-1', 'paid']);
  assert.equal(alerts.length, 0);
});

test('reason field appears only for rejection and blocks invalid reasons', () => {
  const { modals, elements, alerts } = modalHarness();
  const submissions = [];
  modals.executeVerifyPayment = (...args) => submissions.push(args);
  modals.verifyPayment('order-1', 'rejected');
  const field = elements.get('markUnpaidReason');
  assert.equal(elements.get('paymentRejectionReasonGroup').hidden, false);
  assert.equal(field.required, true);
  for (const value of ['', '  ', 'x'.repeat(1001)]) {
    field.value = value;
    elements.get('confirmMarkUnpaidBtn').events.click();
  }
  assert.equal(submissions.length, 0);
  assert.equal(alerts.length, 3);
  field.value = '  Receipt is unreadable  ';
  elements.get('confirmMarkUnpaidBtn').events.click();
  assert.deepEqual(submissions[0], ['order-1', 'rejected', 'Receipt is unreadable']);
  modals.verifyPayment('order-1', 'unpaid');
  assert.equal(elements.get('paymentRejectionReasonGroup').hidden, true);
  assert.equal(field.required, false);
  elements.get('confirmMarkUnpaidBtn').events.click();
  assert.deepEqual(submissions[1], ['order-1', 'unpaid', null]);
});

test('payment confirmation refreshes reason and refund amounts from server', async () => {
  const { modals, context } = modalHarness();
  const existing = { id: 'order-1', payment_status: 'rejected', payment_status_reason: 'Unreadable', refund_due_amount: 0 };
  const updated = { ...existing, payment_status: 'paid', payment_status_reason: null, payment_amount: 200, refund_due_amount: 200 };
  context.window.OrdersUpdatePaymentStatus = { update: async () => ({ success: true, order: updated }) };
  modals.controller = { state: { orders: [existing] }, renderOrders() {}, viewOrder() {} };
  await modals.executeVerifyPayment('order-1', 'paid');
  assert.deepEqual(existing, updated);
});

function apiHarness() {
  let handler;
  const rpcCalls = [];
  const context = { module: { exports: {} }, console,
    require(name) {
      if (name === 'express') return { Router: () => ({ post: (...args) => {
        if (args[0] === '/api/orders/update_payment_status') handler = args.at(-1);
      } }) };
      if (name.endsWith('/database/supabase')) return { supabaseAdmin: { rpc: async (...args) => {
        rpcCalls.push(args);
        return { data: [{ id: 'order-1', payment_status: args[1].p_payment_status }], error: null };
      } } };
      if (name.endsWith('/middleware/authMiddleware')) return { isAuthenticated() {}, hasRole: () => () => {} };
      throw new Error('Unexpected dependency: ' + name);
    } };
  vm.runInNewContext(fs.readFileSync('backend/routes/admin/admin/orders/orders_update_payment_status.js', 'utf8'), context);
  return { rpcCalls, async request(body) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ body, user: { email: 'admin@example.invalid' } }, response);
    return response;
  } };
}

test('API allows confirmation and unpaid without a reason', async () => {
  const api = apiHarness();
  for (const payment_status of ['paid', 'unpaid', 'pending_verification']) {
    const response = await api.request({ order_id: 'order-1', payment_status });
    assert.equal(response.statusCode, 200);
    assert.equal(api.rpcCalls.at(-1)[1].p_reason, null);
  }
});

test('API blocks invalid rejection reasons before RPC and trims valid ones', async () => {
  const api = apiHarness();
  for (const reason of [undefined, null, 42, '', '  ', 'x'.repeat(1001)]) {
    const response = await api.request({ order_id: 'order-1', payment_status: 'rejected', reason });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(api.rpcCalls.length, 0);
  const response = await api.request({ order_id: 'order-1', payment_status: 'rejected', reason: '  Wrong receipt  ' });
  assert.equal(response.statusCode, 200);
  assert.equal(api.rpcCalls[0][1].p_reason, 'Wrong receipt');
});
