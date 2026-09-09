-- =============================================
-- Customer Check Email RPC Function
-- Checks if an email is already registered in customers table
-- =============================================

CREATE OR REPLACE FUNCTION customer_check_email(
    p_email TEXT,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_clean_email TEXT;
    v_exists BOOLEAN := FALSE;
    v_is_verified BOOLEAN := FALSE;
    v_record RECORD;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email is required');
    END IF;

    SELECT id, is_verified INTO v_record
    FROM public.customers
    WHERE LOWER(email) = v_clean_email
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    LIMIT 1;

    IF v_record IS NOT NULL THEN
        v_exists := TRUE;
        v_is_verified := COALESCE(v_record.is_verified, FALSE);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'exists', v_exists,
        'is_verified', v_is_verified
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
