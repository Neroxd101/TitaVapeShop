-- =============================================
-- Customer Check Email RPC Function
-- Checks if an email is already registered in customers table
-- =============================================

CREATE OR REPLACE FUNCTION public.customer_check_email(
    p_email TEXT,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_clean_email TEXT;
    v_exists BOOLEAN := FALSE;
    v_record RECORD;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email is required');
    END IF;

    SELECT c.id INTO v_record
    FROM public.customers AS c
    WHERE LOWER(c.email) = v_clean_email
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

REVOKE ALL ON FUNCTION public.customer_check_email(TEXT, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_check_email(TEXT, UUID)
TO service_role;
