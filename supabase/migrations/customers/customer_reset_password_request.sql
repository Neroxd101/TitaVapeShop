-- customer_reset_password_request RPC.
CREATE OR REPLACE FUNCTION public.customer_reset_password_request(
    p_email VARCHAR(255), p_otp_code VARCHAR(6)
)
RETURNS TABLE (success BOOLEAN, customer_id UUID, full_name VARCHAR(255), error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_clean_email VARCHAR(255) := LOWER(BTRIM(p_email));
    v_customer RECORD;
BEGIN
    IF v_clean_email IS NULL OR v_clean_email = '' OR p_otp_code !~ '^[0-9]{6}$' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR(255), 'Invalid reset request'::TEXT;
        RETURN;
    END IF;

    SELECT c.id, c.full_name INTO v_customer
    FROM public.customers AS c
    WHERE LOWER(c.email) = v_clean_email AND c.is_verified IS TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR(255), 'Customer account not found'::TEXT;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.customer_verification_codes AS vc
        WHERE vc.customer_id = v_customer.id
          AND vc.purpose = 'password_reset'
          AND vc.created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR(255), 'Please wait before requesting another code'::TEXT;
        RETURN;
    END IF;

    UPDATE public.customer_verification_codes AS vc
    SET verified = TRUE, expires_at = NOW()
    WHERE vc.customer_id = v_customer.id
      AND vc.purpose = 'password_reset'
      AND vc.expires_at > NOW();

    INSERT INTO public.customer_verification_codes (
        customer_id, email, otp_code, expires_at, verified, attempt_count, purpose
    ) VALUES (
        v_customer.id, v_clean_email, p_otp_code,
        NOW() + INTERVAL '15 minutes', FALSE, 0, 'password_reset'
    );

    RETURN QUERY SELECT TRUE, v_customer.id, v_customer.full_name::VARCHAR(255), NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_reset_password_request(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reset_password_request(VARCHAR, VARCHAR) TO service_role;
