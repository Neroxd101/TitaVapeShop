-- =============================================
-- Customer Change Password RPC Function
-- Allows an authenticated customer to update their password
-- =============================================

DROP FUNCTION IF EXISTS public.customer_change_password(UUID, TEXT);

CREATE FUNCTION public.customer_change_password(
    p_customer_id UUID,
    p_current_password_hash TEXT,
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

    IF p_current_password_hash IS NULL
       OR LENGTH(p_current_password_hash) <> 60
       OR p_current_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Current password data is invalid'::TEXT;
        RETURN;
    END IF;

    IF p_new_password_hash IS NULL
       OR LENGTH(p_new_password_hash) <> 60
       OR p_new_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'New password hash is required'::TEXT;
        RETURN;
    END IF;

    -- Update password and timestamp
    UPDATE public.customers AS c
    SET password = p_new_password_hash,
        updated_at = NOW()
    WHERE c.id = p_customer_id
      AND c.password = p_current_password_hash
      AND c.is_verified IS TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Password changed or customer account was not found'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Password updated successfully.'::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_change_password(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_change_password(UUID, TEXT, TEXT)
TO service_role;

COMMENT ON FUNCTION public.customer_change_password(UUID, TEXT, TEXT) IS
'Updates a verified customer password through the trusted backend.';
