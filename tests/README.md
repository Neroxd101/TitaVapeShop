# Inventory deletion verification and rollout

Deleting an inventory product marks its lines in pending/confirmed orders as
unavailable, preserves their original details, recalculates totals, and cancels
orders with no available lines. Surviving lines keep existing reservations;
completion, cancellation and voiding skip unavailable lines. Terminal orders
remain unchanged. Known paid overpayments are recorded as refund due; submitted
proofs retain their amount for review. Refunds must be arranged by the store.

Run the display regression tests:

```powershell
node --test tests/order-availability.test.js tests/payment-reason.test.js tests/activity-cancellation.test.js tests/refund-action.test.js
```

Generate the database regression query:

```powershell
node tests/build-inventory-deletion-test.js
```

This query clones table definitions into `deletion_test`, loads the updated RPCs,
runs assertions using synthetic data, and rolls back the entire transaction.
It does not change business records. The schema name must be unused. The query
requires a PostgreSQL administrator and Supabase roles to exist.

Payment confirmation requires no reason. Only rejecting payment proof requires
a trimmed reason of 1–1000 characters. The payment tests cover the modal and API
validation, clearing an old rejection reason, and refreshing refund amounts.
The database regression query also checks rejection validation and auditing,
confirmation without a reason, and preservation of refund calculations.

Automatic cancellations log the order ID, order type, original item count and
unavailability reason. Older cancellation entries recover missing display
metadata from the stored audit item list and matching order when available;
stored audit records remain unchanged. Regression checks cover this recovery,
preservation of recorded snapshots, and cancellation text escaping.

The Mark Refunded action records the full outstanding amount after the store
has sent the refund. It keeps payment status and original payment amount intact,
records a cumulative `refunded_amount` and the latest `refunded_at`, clears the
current `refund_due_amount`, and logs the amount and actor as `order_refund`.
It does not transfer money. A later deletion subtracts prior refunds when
computing the new balance. Confirmation submits both the displayed balance
and prior refunded amount, so stale or duplicate requests cannot settle a new
refund. The database tests cover retries, additional deletions, changed balances,
audit failure rollback, cancelled paid orders, reader fields and RPC permissions.

Preview the actual customer page and deletion modal with local fixtures:

```powershell
node tests/preview-inventory-deletion.js
```

Open `http://127.0.0.1:3101/order-status?id=partial`,
`http://127.0.0.1:3101/order-status?id=cancelled`, or
`http://127.0.0.1:3101/delete-preview`. This fixture server has no database,
email or deletion connection.

Open `http://127.0.0.1:3101/order-details-preview` to test refund confirmation
with local fixtures. After confirming, `http://127.0.0.1:3101/order-status?id=refund-preview`
shows the same fixture's settlement to the customer. Both routes use local
test data and never mark a real order refunded.

## Rollout

Generate the SQL update from the same RPC sources in dependency order:

```powershell
node tests/build-inventory-deletion-test.js --deployment
```

Apply that output as one transaction using Supabase SQL Editor or the migration
API, then deploy the updated backend and frontend together. It adds cancellation
and payment/refund metadata, installs the preview/delete RPCs, replaces the order
read functions with their expanded return fields, and coordinates checkout and
status changes with deletion using shared/exclusive transaction advisory locks.
Existing inventory deletion calls with only `p_id` remain accepted. No existing
products are deleted and no existing orders are adjusted by installing the SQL.

The preview is informational: actual affected counts are recalculated when
deletion runs. Both deletion and audit logging roll back if any order adjustment
fails. Ordinary checkout operations use shared locks and remain concurrent;
deletions use the exclusive lock.

## Analytics money overflow

`analytics_total_profit` and related money totals now use unrestricted `NUMERIC`
for arithmetic and accumulation, with cent rounding retained for prices and costs.
The previous `DECIMAL(10,2)` variables failed for totals outside ±99,999,999.99.
Historical transaction values are left unchanged.

Generate the rollback-only analytics regression query with
`node tests/build-analytics-overflow-test.js`. It tests large positive/negative
profit and gross totals, large historical line amounts, cent rounding, date
filters, void exclusions, cost fallback and RPC permissions in an isolated schema.
`node tests/build-analytics-overflow-test.js --deployment` emits the database update.
