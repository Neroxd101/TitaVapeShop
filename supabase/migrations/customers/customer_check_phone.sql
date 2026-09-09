-- =============================================
-- Customer Check Phone RPC Function
-- Checks if a mobile number is already registered in customers table
-- =============================================

CREATE OR REPLACE FUNCTION customer_check_phone(
    p_phone TEXT,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_clean_phone TEXT;
    v_exists BOOLEAN := FALSE;
    v_record RECORD;
BEGIN
    v_clean_phone := REGEXP_REPLACE(TRIM(p_phone), '\D', '', 'g');

    IF v_clean_phone IS NULL OR LENGTH(v_clean_phone) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid phone is required');
    END IF;

    SELECT id INTO v_record
    FROM public.customers
    WHERE (
        contact_number = v_clean_phone
        OR contact_number = '0' || SUBSTRING(v_clean_phone FROM 2)
        OR contact_number = '+63' || SUBSTRING(v_clean_phone FROM 2)
    )
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    LIMIT 1;

    IF v_record IS NOT NULL THEN
        v_exists := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'exists', v_exists
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
