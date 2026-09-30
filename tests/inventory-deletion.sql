-- Executed by build-inventory-deletion-test.js in an isolated schema and rolled back.
DO $$
DECLARE
    customer UUID := gen_random_uuid();
    deleted_product UUID := gen_random_uuid();
    retained_product UUID := gen_random_uuid();
    mixed UUID := gen_random_uuid();
    sole UUID := gen_random_uuid();
    paid UUID := gen_random_uuid();
    proof UUID := gen_random_uuid();
    history UUID := gen_random_uuid();
    cancel_remaining UUID := gen_random_uuid();
    pending_mixed UUID := gen_random_uuid();
    refunded_order UUID := gen_random_uuid();
    refund_test_order UUID;
    stale_checkout_rejected BOOLEAN;
    invalid_reason TEXT;
    reason_rejected BOOLEAN;
    result JSONB;
    line_a JSONB;
    line_b JSONB;
    target deletion_test.orders%ROWTYPE;
    available_qty INTEGER;
BEGIN
    INSERT INTO deletion_test.customers (id, full_name, email, contact_number, password, birthday, is_verified)
    VALUES (customer, 'Deletion test customer', 'deletion-test@example.invalid', '09123456789', 'test-only', '1990-01-01', TRUE);
    INSERT INTO deletion_test.inventory (id, category, name, quantity, cost_price, sale_price, variations)
    VALUES (deleted_product, 'Test', 'Deleted', 100, 40, 100, '[]'),
           (retained_product, 'Test', 'Retained', 100, 20, 50, '[{"name":"Blue","quantity":100}]');
    line_a := jsonb_build_object('id', deleted_product, 'name', 'Deleted', 'price', 100, 'quantity', 2);
    line_b := jsonb_build_object('id', retained_product, 'name', 'Retained', 'price', 50, 'quantity', 3, 'selected_variation', 'Blue');
    INSERT INTO deletion_test.orders (id, customer_id, customer_name, customer_email, contact_number, items, total_amount, status, payment_status)
    VALUES
      (mixed, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a, line_b), 350, 'pending', 'unpaid'),
      (sole, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a), 200, 'pending', 'unpaid'),
      (paid, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a, line_b), 350, 'pending', 'paid'),
      (proof, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a), 200, 'pending', 'pending_verification'),
      (history, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a), 200, 'completed', 'paid'),
      (cancel_remaining, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a, line_b), 350, 'pending', 'unpaid'),
      (pending_mixed, customer, 'Test', 'deletion-test@example.invalid', '09123456789', jsonb_build_array(line_a, line_b), 350, 'pending', 'unpaid');
    UPDATE deletion_test.orders SET order_type = 'delivery' WHERE id = sole;
    PERFORM deletion_test.orders_update_status(mixed, 'confirmed');
    PERFORM deletion_test.orders_update_status(sole, 'confirmed');
    PERFORM deletion_test.orders_update_status(cancel_remaining, 'confirmed');
    SELECT quantity INTO available_qty FROM deletion_test.inventory WHERE id = retained_product;

    result := deletion_test.inventory_delete_preview(deleted_product);
    ASSERT (result->>'affected_orders')::INT = 6, 'preview active order count';
    ASSERT (result->>'cancelled_orders')::INT = 2, 'preview automatic cancellation count';
    ASSERT (result->>'payment_review_orders')::INT = 2, 'preview payment review count';
    result := deletion_test.inventory_delete_item(deleted_product, 'test-admin');
    ASSERT result->>'success' = 'true', 'deletion succeeds';
    ASSERT (result->>'affected_orders')::INT = 6, 'actual affected count';
    ASSERT NOT EXISTS (SELECT 1 FROM deletion_test.inventory WHERE id = deleted_product), 'product removed';
    stale_checkout_rejected := FALSE;
    BEGIN
        PERFORM deletion_test.customer_create_order(customer, jsonb_build_array(line_a));
    EXCEPTION WHEN raise_exception THEN
        stale_checkout_rejected := SQLERRM LIKE 'Product % was not found';
    END;
    ASSERT stale_checkout_rejected, 'stale customer checkout rejects deleted product';
    stale_checkout_rejected := FALSE;
    BEGIN
        PERFORM deletion_test.pos_process_sale(jsonb_build_array(jsonb_build_object('id', deleted_product, 'qty', 1)), 100);
    EXCEPTION WHEN raise_exception THEN
        stale_checkout_rejected := SQLERRM LIKE 'Inventory item % was not found';
    END;
    ASSERT stale_checkout_rejected, 'stale POS checkout rejects deleted product';
    SELECT * INTO target FROM deletion_test.orders WHERE id = mixed;
    ASSERT target.total_amount = 150 AND target.status = 'confirmed' AND target.stock_reserved, 'mixed order remains confirmed with revised total';
    ASSERT target.items->0->>'unavailable' = 'true' AND (target.items->0->>'price')::INT = 100, 'original unavailable line preserved';
    ASSERT (SELECT quantity = available_qty FROM deletion_test.inventory WHERE id = retained_product), 'surviving reservation preserved';
    SELECT * INTO target FROM deletion_test.orders WHERE id = sole;
    ASSERT target.status = 'cancelled' AND target.total_amount = 0 AND NOT target.stock_reserved, 'sole item cancels at zero total';
    ASSERT target.cancellation_reason IS NOT NULL, 'cancellation reason recorded';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.transactions WHERE entity_id = sole AND action_type = 'order_cancel'
        AND details->>'order_id' = sole::TEXT AND details->>'order_type' = 'delivery'
        AND (details->>'items_count')::INT = 1 AND details->>'new_status' = 'cancelled'), 'automatic cancellation captures display metadata';
    -- Simulate entries from the old deletion function: read repairs their
    -- display using the audit snapshot and order without rewriting history.
    UPDATE deletion_test.transactions SET details = details - 'order_id' - 'items_count' - 'order_type'
    WHERE entity_id = sole AND action_type = 'order_cancel';
    result := deletion_test.transactions_get_all(p_action_type => 'order_cancel', p_entity_id => sole);
    ASSERT result->'transactions'->0->'details'->>'order_id' = sole::TEXT, 'legacy cancellation recovers order ID';
    ASSERT result->'transactions'->0->'details'->>'order_type' = 'delivery', 'legacy cancellation recovers delivery type';
    ASSERT (result->'transactions'->0->'details'->>'items_count')::INT = 1, 'legacy cancellation recovers snapshot item count';
    ASSERT NOT EXISTS (SELECT 1 FROM deletion_test.transactions WHERE entity_id = sole AND action_type = 'order_cancel' AND details ? 'order_id'), 'reader leaves historical audit data unchanged';
    UPDATE deletion_test.orders SET order_type = 'delivery' WHERE id = proof;
    result := deletion_test.transactions_get_all(p_action_type => 'order_cancel', p_entity_id => proof);
    ASSERT result->'transactions'->0->'details'->>'order_type' = 'pickup', 'recorded order type overrides later order changes';
    ASSERT (SELECT total_amount = 200 AND status = 'completed' AND NOT (items->0 ? 'unavailable') FROM deletion_test.orders WHERE id = history), 'history untouched';
    ASSERT (SELECT refund_due_amount = 200 AND payment_amount = 350 AND payment_status = 'paid' FROM deletion_test.orders WHERE id = paid), 'paid overpayment flagged';
    ASSERT (SELECT payment_amount = 200 AND refund_due_amount = 0 FROM deletion_test.orders WHERE id = proof), 'unverified proof amount preserved without assuming paid';

    PERFORM deletion_test.orders_update_status(mixed, 'completed');
    ASSERT (SELECT quantity = available_qty FROM deletion_test.inventory WHERE id = retained_product), 'completion does not double deduct';
    ASSERT (SELECT sale_total = 150 AND jsonb_array_length(sale_items) = 1 FROM deletion_test.transactions WHERE entity_id = mixed AND action_type = 'sale_complete'), 'sale logs only available items';
    PERFORM deletion_test.orders_void(mixed, 'test void');
    ASSERT (SELECT quantity = available_qty + 3 FROM deletion_test.inventory WHERE id = retained_product), 'void restores only sold surviving items';
    PERFORM deletion_test.orders_update_status(cancel_remaining, 'cancelled');
    ASSERT (SELECT quantity = available_qty + 6 FROM deletion_test.inventory WHERE id = retained_product), 'cancellation releases remaining reservations';
    ASSERT (SELECT (variations->0->>'quantity')::INT = available_qty + 6 FROM deletion_test.inventory WHERE id = retained_product), 'variation stock restored';
    PERFORM deletion_test.orders_update_status(pending_mixed, 'confirmed');
    ASSERT (SELECT quantity = available_qty + 3 FROM deletion_test.inventory WHERE id = retained_product), 'pending edited order reserves available items only';
    PERFORM deletion_test.orders_update_status(pending_mixed, 'cancelled');
    FOREACH invalid_reason IN ARRAY ARRAY[NULL::TEXT, '   ', repeat('x', 1001)] LOOP
        reason_rejected := FALSE;
        BEGIN
            PERFORM deletion_test.orders_update_payment_status(proof, 'rejected', 'test-admin', invalid_reason);
        EXCEPTION WHEN raise_exception THEN
            reason_rejected := SQLERRM = 'A rejection reason of 1–1000 characters is required';
        END;
        ASSERT reason_rejected, 'rejection requires a valid reason';
    END LOOP;
    ASSERT (SELECT payment_status = 'pending_verification' FROM deletion_test.orders WHERE id = proof), 'invalid rejection leaves status unchanged';
    ASSERT NOT EXISTS (SELECT 1 FROM deletion_test.transactions WHERE entity_id = proof AND action_type = 'order_payment_update'), 'invalid rejection leaves no audit entry';
    PERFORM deletion_test.orders_update_payment_status(proof, 'rejected', 'test-admin', '  Receipt is unreadable  ');
    ASSERT (SELECT payment_status_reason = 'Receipt is unreadable' FROM deletion_test.orders WHERE id = proof), 'rejection reason saved and trimmed';
    PERFORM deletion_test.orders_update_payment_status(proof, 'paid', 'test-admin');
    ASSERT (SELECT payment_status = 'paid' AND payment_status_reason IS NULL FROM deletion_test.orders WHERE id = proof), 'confirmation needs no reason and clears previous rejection';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.transactions WHERE entity_id = proof AND action_type = 'order_payment_update' AND details->>'new_payment_status' = 'paid' AND details->'reason' = 'null'::JSONB), 'confirmation audit needs no reason';
    ASSERT (SELECT refund_due_amount = 200 FROM deletion_test.orders WHERE id = proof), 'later proof verification flags full refund for cancelled order';
    result := deletion_test.inventory_delete_item(deleted_product);
    ASSERT result->>'success' = 'false', 'repeated delete cannot adjust orders again';
    ASSERT (SELECT COUNT(*) = 1 FROM deletion_test.transactions WHERE entity_id = deleted_product AND action_type = 'inventory_delete'), 'one audit entry';
    ASSERT (SELECT total_amount = 150 AND cancellation_reason IS NULL FROM deletion_test.customer_track_order(paid, customer)), 'customer tracking exposes revised details';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.customer_get_orders(customer) WHERE id = sole AND cancellation_reason IS NOT NULL), 'customer list exposes cancellation';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.orders_get_all() WHERE id = paid AND refund_due_amount = 200), 'admin list exposes refund';

    -- An already deleted line and a remaining line each represent 200 paid.
    INSERT INTO deletion_test.orders (id, customer_id, customer_name, contact_number, items,
        total_amount, status, payment_status, payment_amount, refund_due_amount)
    VALUES (refunded_order, customer, 'Refund test', '09123456789',
        jsonb_build_array(line_a || '{"unavailable":true}'::jsonb, line_b || '{"quantity":4}'::jsonb),
        200, 'pending', 'paid', 400, 200);
    reason_rejected := FALSE;
    BEGIN
        PERFORM deletion_test.orders_mark_refunded(refunded_order, 199, 0, 'test-admin');
    EXCEPTION WHEN raise_exception THEN reason_rejected := SQLERRM LIKE 'Refund balance changed.%';
    END;
    ASSERT reason_rejected, 'stale refund amount rejected';
    PERFORM deletion_test.orders_mark_refunded(refunded_order, 200, 0, 'test-admin');
    ASSERT (SELECT refund_due_amount = 0 AND refunded_amount = 200 AND refunded_at IS NOT NULL
        AND payment_status = 'paid' AND payment_amount = 400 AND total_amount = 200
        FROM deletion_test.orders WHERE id = refunded_order), 'refund settled without changing payment or order total';
    PERFORM deletion_test.orders_mark_refunded(refunded_order, 200, 0, 'test-admin');
    ASSERT (SELECT COUNT(*) = 1 FROM deletion_test.transactions WHERE entity_id = refunded_order AND action_type = 'order_refund'), 'refund retry is idempotent';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.transactions WHERE entity_id = refunded_order AND action_type = 'order_refund'
        AND user_email = 'test-admin' AND (details->>'refund_amount')::NUMERIC = 200), 'refund amount and actor audited';
    PERFORM deletion_test.orders_update_payment_status(refunded_order, 'pending_verification', 'test-admin');
    PERFORM deletion_test.orders_update_payment_status(refunded_order, 'paid', 'test-admin');
    ASSERT (SELECT refund_due_amount = 0 FROM deletion_test.orders WHERE id = refunded_order), 'payment confirmation cannot reopen refunded amount';
    ASSERT (SELECT refunded_amount = 200 AND refund_due_amount = 0 FROM deletion_test.customer_track_order(refunded_order, customer)), 'customer tracking exposes settlement';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.customer_get_orders(customer) WHERE id = refunded_order AND refunded_amount = 200), 'customer history exposes settlement';
    ASSERT EXISTS (SELECT 1 FROM deletion_test.orders_get_all() WHERE id = refunded_order AND refunded_amount = 200), 'admin list exposes settlement';
    FOREACH refund_test_order IN ARRAY ARRAY[sole, history] LOOP
        reason_rejected := FALSE;
        BEGIN
            PERFORM deletion_test.orders_mark_refunded(refund_test_order, 200, 0, 'test-admin');
        EXCEPTION WHEN raise_exception THEN reason_rejected := SQLERRM = 'Only paid orders with unavailable products can be refunded';
        END;
        ASSERT reason_rejected, 'unpaid and intact historical orders cannot be refunded';
    END LOOP;

    -- A failed operation rolls back both its order changes and deletion.
    BEGIN
        INSERT INTO deletion_test.orders (customer_name, contact_number, items, total_amount, status)
        VALUES ('Malformed test', '09123456789', jsonb_build_array(line_b, jsonb_build_object('id', gen_random_uuid(), 'price', 'invalid', 'quantity', 1)), 150, 'pending');
        PERFORM deletion_test.inventory_delete_item(retained_product);
        RAISE EXCEPTION 'Expected invalid numeric data to abort deletion';
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
    ASSERT EXISTS (SELECT 1 FROM deletion_test.inventory WHERE id = retained_product), 'failure keeps product';
    ASSERT (SELECT refund_due_amount = 200 AND total_amount = 150 FROM deletion_test.orders WHERE id = paid), 'failure rolls back order changes';

    -- Repeated different product deletions accumulate the original overpayment.
    PERFORM deletion_test.inventory_delete_item(retained_product);
    ASSERT (SELECT status = 'cancelled' AND total_amount = 0 AND refund_due_amount = 350 FROM deletion_test.orders WHERE id = paid), 'second deletion owes original full amount';
    ASSERT (SELECT status = 'cancelled' AND total_amount = 0 AND refund_due_amount = 200 AND refunded_amount = 200
        FROM deletion_test.orders WHERE id = refunded_order), 'later deletion owes only additional refund';
    reason_rejected := FALSE;
    BEGIN
        PERFORM deletion_test.orders_mark_refunded(refunded_order, 200, 0, 'test-admin');
    EXCEPTION WHEN raise_exception THEN reason_rejected := SQLERRM LIKE 'Refund balance changed.%';
    END;
    ASSERT reason_rejected, 'old retry cannot settle a new refund of the same amount';
    PERFORM deletion_test.orders_mark_refunded(refunded_order, 200, 200, 'test-admin');
    ASSERT (SELECT refunded_amount = 400 AND refund_due_amount = 0 FROM deletion_test.orders WHERE id = refunded_order), 'second refund accumulates';
    ASSERT (SELECT COUNT(*) = 2 FROM deletion_test.transactions WHERE entity_id = refunded_order AND action_type = 'order_refund'), 'one audit entry per settlement';
    -- Failure to audit must prevent settlement.
    ALTER TABLE deletion_test.transactions ADD CONSTRAINT test_refund_audit_failure CHECK (action_type <> 'order_refund') NOT VALID;
    reason_rejected := FALSE;
    BEGIN
        PERFORM deletion_test.orders_mark_refunded(proof, 200, 0, 'test-admin');
    EXCEPTION WHEN check_violation THEN reason_rejected := TRUE;
    END;
    ASSERT reason_rejected, 'audit failure aborts refund';
    ASSERT (SELECT refund_due_amount = 200 AND refunded_amount = 0 FROM deletion_test.orders WHERE id = proof), 'failed settlement changes no amounts';
    ALTER TABLE deletion_test.transactions DROP CONSTRAINT test_refund_audit_failure;
    PERFORM deletion_test.orders_mark_refunded(proof, 200, 0, 'test-admin');
    ASSERT (SELECT status = 'cancelled' AND refund_due_amount = 0 AND refunded_amount = 200 FROM deletion_test.orders WHERE id = proof), 'cancelled paid order can be refunded';
    ASSERT NOT has_function_privilege('anon', 'deletion_test.orders_mark_refunded(uuid,numeric,numeric,character varying)', 'EXECUTE'), 'anonymous refund denied';
    ASSERT NOT has_function_privilege('authenticated', 'deletion_test.orders_mark_refunded(uuid,numeric,numeric,character varying)', 'EXECUTE'), 'direct signed-in refund denied';
    ASSERT NOT has_function_privilege('anon', 'deletion_test.inventory_delete_item(uuid, character varying)', 'EXECUTE'), 'anonymous delete denied';
    ASSERT NOT has_function_privilege('authenticated', 'deletion_test.inventory_delete_item(uuid, character varying)', 'EXECUTE'), 'direct signed-in delete denied';
END;
$$;
SELECT 'inventory deletion regression scenarios passed' AS result;
