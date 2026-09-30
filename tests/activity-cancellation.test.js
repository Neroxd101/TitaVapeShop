const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { document: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('frontend/admin/admin/activity-log/javascript/activity-log-controller.js', 'utf8'), context);
const ui = vm.runInContext('Object.create(TransactionsUI.prototype)', context);

test('refund activity identifies the amount and order', () => {
  assert.equal(ui.formatDetails({ action_type: 'order_refund', entity_id: '12345678-abcd',
    details: { refund_amount: 600 } }), 'Refunded ₱600.00 for order 12345678');
});

test('automatic cancellation shows order, original item count, delivery and reason', () => {
  const result = ui.formatDetails({ action_type: 'order_cancel', details: {
    order_id: '12345678-abcd', items_count: 1, order_type: 'delivery',
    cancelled_by: 'product_deletion', reason: 'All products in this order are unavailable.'
  } });
  assert.equal(result, 'Automatically cancelled order 12345678 (1 item, delivery) — All products in this order are unavailable.');
});

test('old cancellation falls back to entity ID and stored unavailable lines', () => {
  const result = ui.formatDetails({ action_type: 'order_cancel', entity_id: '12345678-abcd',
    details: { cancelled_by: 'product_deletion' }, sale_items: [{ unavailable: true }] });
  assert.equal(result, 'Automatically cancelled order 12345678 (1 item)');
  assert.doesNotMatch(result, /N\/A|0 items|pickup/);
});

test('customer and admin cancellations keep their actor and snapshot counts', () => {
  assert.equal(ui.formatDetails({ action_type: 'order_cancel', details: {
    order_id: '12345678-abcd', items_count: 2, order_type: 'pickup', cancelled_by: 'customer'
  } }), 'Customer cancelled order 12345678 (2 items, pickup)');
  assert.equal(ui.formatDetails({ action_type: 'order_cancel', entity_id: '12345678-abcd',
    details: { items_count: 0, order_type: 'delivery' }, sale_items: [{}, {}] }),
    'Cancelled order 12345678 (0 items, delivery)');
});

test('missing metadata is omitted and cancellation text is escaped', () => {
  assert.equal(ui.formatDetails({ action_type: 'order_cancel', entity_id: '12345678-abcd',
    details: {} }), 'Cancelled order 12345678');
  assert.match(ui.formatDetails({ action_type: 'order_cancel', details: {
    order_type: '<img>', reason: '<script>alert(1)</script>'
  } }), /&lt;img&gt;.*&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
