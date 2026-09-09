-- =============================================
-- Customer Change Password RPC Function
-- Allows an authenticated customer to update their password
-- =============================================

CREATE OR REPLACE FUNCTION customer_change_password(
    p_customer_id UUID,
    p_new_password_hash TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    error TEXT
) AS $$
BEGIN
    IF p_customer_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Customer ID is required'::TEXT;
        RETURN;
    END IF;

    IF p_new_password_hash IS NULL OR LENGTH(p_new_password_hash) = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'New password hash is required'::TEXT;
        RETURN;
    END IF;

    -- Update password and timestamp
    UPDATE public.customers
    SET password = p_new_password_hash,
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Customer account not found'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Password updated successfully.'::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION customer_change_password IS 'Updates password for an authenticated customer.';
