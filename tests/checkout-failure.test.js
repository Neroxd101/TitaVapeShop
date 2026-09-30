const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function checkoutHarness(result) {
  const alerts = [];
  const calls = { clear: 0, close: 0, reset: 0, auth: 0 };
  const button = { disabled: false, textContent: 'Place Order' };
  const elements = {
    orderType: { value: 'pickup' }, customerName: { value: 'Customer' },
    contactNumber: { value: '09123456789' }, customerEmail: { value: 'customer@example.invalid' },
    createOrderBtn: button
  };
  const context = {
    console, alert: message => alerts.push(message),
    document: { getElementById: id => elements[id] },
    window: {
      location: { href: '' },
      CustomerAuth: { currentUser: {}, requireAuth() { calls.auth++; } },
      CustomerCreateOrder: { async submit() { if (result instanceof Error) throw result; return result; } },
      CatalogCart: {
        cart: [{ id: 'product-1', quantity: 1, sale_price: 100 }],
        getTotalAmount: () => 100, clearCart() { calls.clear++; }
      }
    }
  };
  vm.runInNewContext(fs.readFileSync('frontend/catalog/javascript/catalog-checkout-modal.js', 'utf8'), context);
  const modal = context.window.CatalogCheckoutModal;
  modal.close = () => { calls.close++; };
  modal.form = { reset() { calls.reset++; } };
  return { modal, context, alerts, calls, button };
}

test('checkout displays the server stock error and allows retry without clearing the cart', async () => {
  const harness = checkoutHarness({ success: false, error: 'Insufficient stock for Product A.' });
  await harness.modal.handleSubmit();
  assert.deepEqual(harness.alerts, ['Failed to create order: Insufficient stock for Product A.']);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, 'Place Order');
  assert.equal(harness.calls.clear, 0);
  assert.equal(harness.context.window.location.href, '');
});

test('checkout asks for authentication on an expired session', async () => {
  const harness = checkoutHarness({ success: false, requiresAuth: true, error: 'Session expired.' });
  await harness.modal.handleSubmit();
  assert.equal(harness.calls.auth, 1);
  assert.equal(harness.calls.close, 1);
  assert.equal(harness.calls.clear, 0);
  assert.equal(harness.button.disabled, false);
});

test('successful checkout clears the cart and redirects to order status', async () => {
  const harness = checkoutHarness({ success: true, order: { id: 'order-1' } });
  await harness.modal.handleSubmit();
  assert.equal(harness.context.window.location.href, '/order-status?id=order-1');
  assert.equal(harness.calls.clear, 1);
  assert.equal(harness.calls.close, 1);
  assert.equal(harness.calls.reset, 1);
  assert.equal(harness.alerts.length, 0);
});
