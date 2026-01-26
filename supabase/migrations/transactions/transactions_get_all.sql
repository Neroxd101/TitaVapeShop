-- =============================================
-- Transactions Get All Function
-- Gets all transactions with filtering and pagination
-- Returns JSONB with transactions array and metadata
-- =============================================

CREATE OR REPLACE FUNCTION transactions_get_all(
    p_action_type VARCHAR(50) DEFAULT NULL,
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    total_count BIGINT;
    transaction_data JSONB;
    result JSONB;
BEGIN
    -- Count total matching records
    SELECT COUNT(*) INTO total_count
    FROM transactions
    WHERE
        (p_action_type IS NULL OR action_type = p_action_type)
        AND (p_user_email IS NULL OR user_email = p_user_email)
        AND (p_entity_id IS NULL OR entity_id = p_entity_id)
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);

    -- Get paginated transactions
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', t.id,
            'action_type', t.action_type,
            'user_email', t.user_email,
            'entity_id', t.entity_id,
            'entity_type', t.entity_type,
            'details', t.details,
            'sale_total', t.sale_total,
            'sale_items', t.sale_items,
            'customer_name', t.customer_name,
            'customer_email', t.customer_email,
            'created_at', t.created_at
        ) ORDER BY t.created_at DESC
    ), '[]'::jsonb) INTO transaction_data
    FROM (
        SELECT *
        FROM transactions
        WHERE
            (p_action_type IS NULL OR action_type = p_action_type)
            AND (p_user_email IS NULL OR user_email = p_user_email)
            AND (p_entity_id IS NULL OR entity_id = p_entity_id)
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        ORDER BY created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;

    -- Build result JSONB
    result := jsonb_build_object(
        'success', true,
        'transactions', transaction_data,
        'total', total_count,
        'limit', p_limit,
        'offset', p_offset
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
