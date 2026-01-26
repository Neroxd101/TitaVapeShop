-- =============================================
-- Update Transactions Action Types
-- Adds order_confirm and order_cancel to allowed action types
-- =============================================

-- Drop the existing CHECK constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_action_type_check;

-- Add the updated CHECK constraint with new action types
ALTER TABLE transactions ADD CONSTRAINT transactions_action_type_check 
    CHECK (action_type IN (
        'inventory_add',
        'inventory_edit',
        'inventory_delete',
        'sale_complete',
        'sale_void',
        'order_confirm',
        'order_cancel'
    ));

-- Update the transactions_log function to accept new action types
-- (This is already in transactions_log.sql, but ensuring it's updated)
CREATE OR REPLACE FUNCTION transactions_log(
    p_action_type VARCHAR(50),
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_sale_total DECIMAL(10, 2) DEFAULT NULL,
    p_sale_items JSONB DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    action_type VARCHAR(50),
    user_email VARCHAR(255),
    entity_id UUID,
    entity_type VARCHAR(50),
    details JSONB,
    sale_total DECIMAL(10, 2),
    sale_items JSONB,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_transaction RECORD;
BEGIN
    -- Validate required fields
    IF p_action_type IS NULL OR p_action_type = '' THEN
        RAISE EXCEPTION 'action_type is required';
    END IF;

    -- Validate action_type (includes new order action types)
    IF p_action_type NOT IN ('inventory_add', 'inventory_edit', 'inventory_delete', 'sale_complete', 'sale_void', 'order_confirm', 'order_cancel') THEN
        RAISE EXCEPTION 'Invalid action_type: %', p_action_type;
    END IF;

    -- Insert transaction
    INSERT INTO transactions (
        action_type,
        user_email,
        entity_id,
        entity_type,
        details,
        sale_total,
        sale_items,
        customer_name,
        customer_email
    ) VALUES (
        p_action_type,
        p_user_email,
        p_entity_id,
        p_entity_type,
        COALESCE(p_details, '{}'::jsonb),
        p_sale_total,
        p_sale_items,
        p_customer_name,
        p_customer_email
    )
    RETURNING * INTO new_transaction;

    -- Return the created transaction
    RETURN QUERY
    SELECT
        new_transaction.id,
        new_transaction.action_type,
        new_transaction.user_email,
        new_transaction.entity_id,
        new_transaction.entity_type,
        new_transaction.details,
        new_transaction.sale_total,
        new_transaction.sale_items,
        new_transaction.customer_name,
        new_transaction.customer_email,
        new_transaction.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
