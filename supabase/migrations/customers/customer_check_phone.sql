-- =============================================
-- Customer Check Phone RPC Function
-- Checks if a mobile number is already registered in customers table
-- =============================================

CREATE OR REPLACE FUNCTION public.customer_check_phone(
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

    IF v_clean_phone IS NULL OR v_clean_phone !~ '^09[0-9]{9}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid phone is required');
    END IF;

    SELECT c.id INTO v_record
    FROM public.customers AS c
    WHERE (
        c.contact_number = v_clean_phone
        OR c.contact_number = '+63' || SUBSTRING(v_clean_phone FROM 2)
    )
    AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
    LIMIT 1;

    IF v_record IS NOT NULL THEN
        v_exists := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'exists', v_exists
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_check_phone(TEXT, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_check_phone(TEXT, UUID)
TO service_role;
