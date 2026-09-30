// Local UI fixtures only: no database, credentials, email or actual deletion.
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const app = express();
const frontend = path.resolve(__dirname, '../frontend');
const refundFixtureOrder = { id: '11111111-2222-4333-8444-555555555555', customer_name: 'Preview Customer', contact_number: '09123456789',
  created_at: '2026-09-30T04:00:00Z', status: 'confirmed', order_type: 'pickup', payment_status: 'paid',
  total_amount: 1500, payment_amount: 2100, refund_due_amount: 600, refunded_amount: 0,
  items: [{ name: 'Britless', category: 'Banana-cat', quantity: 1, price: 600, unavailable: true },
    { name: 'Banana Cat', quantity: 1, price: 1500 }] };
app.use(express.json());
app.post('/api/orders/mark_refunded', (req, res) => {
  if (req.body.order_id !== refundFixtureOrder.id || req.body.refund_amount !== refundFixtureOrder.refund_due_amount
      || req.body.expected_refunded_amount !== refundFixtureOrder.refunded_amount) {
    return res.status(400).json({ success: false, error: 'Fixture refund balance changed.' });
  }
  refundFixtureOrder.refunded_amount += refundFixtureOrder.refund_due_amount;
  refundFixtureOrder.refund_due_amount = 0;
  refundFixtureOrder.refunded_at = new Date().toISOString();
  res.json({ success: true, order: refundFixtureOrder });
});
app.get('/order-status', (req, res) => res.sendFile(path.join(frontend, 'order-status/order-status.html')));
app.get('/api/customer/orders/track', (req, res) => {
  if (req.query.id === 'refund-preview') return res.json({ success: true, order: refundFixtureOrder });
  const cancelled = req.query.id === 'cancelled';
  const delivery = req.query.id === 'delivery';
  res.json({ success: true, order: {
    id: cancelled ? 'cancelled' : delivery ? 'delivery' : 'partial', customer_name: 'Preview Customer',
    contact_number: '09123456789', customer_email: 'preview@example.invalid',
    created_at: '2026-09-30T04:00:00Z', status: cancelled ? 'cancelled' : delivery ? 'pending' : 'confirmed',
    order_type: delivery ? 'delivery' : 'pickup', payment_status: 'paid', payment_amount: 350,
    payment_reference: '213123123', payment_receipt_url: 'https://example.invalid/receipt.png',
    total_amount: cancelled ? 0 : 150, refund_due_amount: cancelled ? 350 : 200,
    cancellation_reason: cancelled ? 'All products in this order are unavailable.' : null,
    items: [
      { id: 'a', name: 'Deleted Product', quantity: 2, price: 100, unavailable: true },
      { id: 'b', name: 'Remaining Product', quantity: 3, price: 50, selected_variation: 'Blue', unavailable: cancelled }
    ]
  } });
});
app.get('/inventory/inventory_delete_item/:id/preview', (req, res) => {
  res.json({ success: true, affected_orders: 3, cancelled_orders: 1, payment_review_orders: 1 });
});
app.get('/delete-preview', (req, res) => res.send(`<!doctype html><html><head>
<link rel="stylesheet" href="/css/components/variables.css">
<link rel="stylesheet" href="/css/components/resets.css">
<link rel="stylesheet" href="/css/components/buttons.css">
<link rel="stylesheet" href="/css/components/modal.css">
<link rel="stylesheet" href="/css/components/confirmation-modal.css">
</head><body><button id="openPreview">Delete Preview Product</button><div id="delete-modal-container"></div>
<script>const InventoryState = {}; const InventoryDOM = {}; const InventoryDisplay = { initialLoad() {} };</script>
<script src="/admin/admin/inventory/javascript/inventory_delete_item.js"></script>
<script>InventoryDelete.init().then(() => document.getElementById('openPreview').addEventListener('click', () => InventoryDelete.openDeleteModal('preview', 'Preview Product')));</script>
</body></html>`));
app.get('/order-details-preview', (req, res) => res.send(`<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/css/components/variables.css">
<link rel="stylesheet" href="/css/components/resets.css">
<link rel="stylesheet" href="/css/components/buttons.css">
<link rel="stylesheet" href="/css/components/badges.css">
<link rel="stylesheet" href="/css/components/modal.css">
<link rel="stylesheet" href="/css/components/modal-layouts.css">
<link rel="stylesheet" href="/css/components/order-details.css">
<link rel="stylesheet" href="/admin/admin/orders/orders-structure.css">
</head><body>
${fs.readFileSync(path.join(frontend, 'admin/admin/orders/order-details-modal.html'), 'utf8')}
<script src="/customer/javascript/order-availability.js"></script>
<script src="/admin/admin/orders/javascript/orders_view_modal.js"></script>
<script src="/admin/admin/orders/javascript/orders_modals.js"></script>
<script src="/admin/admin/orders/javascript/orders_update_payment_status.js"></script>
<script>
const fixtureOrder = ${JSON.stringify(refundFixtureOrder)};
const fixtureController = { state: { orders: [fixtureOrder] }, renderOrders() {}, viewOrder: id => OrdersViewModal.viewOrder(id) };
OrdersViewModal.controller = fixtureController;
OrdersViewModal.setupEventListeners();
OrdersModals.init(fixtureController);
document.addEventListener('click', event => {
  const button = event.target.closest('[data-order-action="markRefunded"]');
  if (button) OrdersModals.markRefunded(button.dataset.orderId);
});
OrdersViewModal.viewOrder(fixtureOrder.id);
</script></body></html>`));
app.use(express.static(frontend));
app.use('/qr', express.static(path.resolve(__dirname, '../qr')));
app.listen(3101, '127.0.0.1', () => console.log('Deletion UI fixtures: http://127.0.0.1:3101'));
