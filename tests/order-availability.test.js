const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('frontend/customer/javascript/order-availability.js', 'utf8'), context);
const availability = context.window.OrderAvailability;

test('unavailable lines keep original prices but contribute zero', () => {
  const removed = { name: 'Deleted product', price: 125, quantity: 2, unavailable: true };
  assert.equal(availability.lineTotal(removed), 0);
  assert.equal(availability.lineTotal({ price: 50, quantity: 3 }), 150);
  assert.equal(removed.price, 125);
});

test('show revised totals, automatic cancellation and refund instructions', () => {
  assert.match(availability.notice({ items: [{ unavailable: true }] }), /removed from your total/);
  assert.match(availability.notice({ cancellation_reason: 'All products in this order are unavailable.', refund_due_amount: 250 }), /unavailable.*Refund due: ₱250\.00/);
  assert.match(availability.notice({ payment_status: 'pending_verification', payment_amount: 250, total_amount: 100 }), /review your payment/);
  assert.equal(availability.notice({ items: [], total_amount: 100 }), '');
});
