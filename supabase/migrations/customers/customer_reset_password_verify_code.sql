-- customer_reset_password_verify_code RPC.
CREATE OR REPLACE FUNCTION public.customer_reset_password_verify_code(
    p_email VARCHAR(255), p_otp_code VARCHAR(6)
)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_clean_email VARCHAR(255) := LOWER(BTRIM(p_email));
    v_clean_code VARCHAR(6) := BTRIM(p_otp_code);
    v_code RECORD;
BEGIN
    IF v_clean_email IS NULL OR v_clean_code !~ '^[0-9]{6}$' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired verification code.'::TEXT;
        RETURN;
    END IF;

    SELECT vc.id, vc.otp_code, vc.expires_at, vc.attempt_count INTO v_code
    FROM public.customer_verification_codes AS vc
    WHERE LOWER(vc.email) = v_clean_email
      AND vc.purpose = 'password_reset'
      AND vc.verified = FALSE
    ORDER BY vc.created_at DESC
    LIMIT 1 FOR UPDATE;

    IF NOT FOUND OR v_code.expires_at <= NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired verification code.'::TEXT;
        RETURN;
    END IF;

    IF v_code.attempt_count >= 5 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Too many attempts. Please request a new code.'::TEXT;
        RETURN;
    END IF;

    IF v_code.otp_code <> v_clean_code THEN
        UPDATE public.customer_verification_codes AS vc
        SET attempt_count = attempt_count + 1 WHERE vc.id = v_code.id;
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired verification code.'::TEXT;
        RETURN;
    END IF;

    UPDATE public.customer_verification_codes AS vc
    SET verified = TRUE WHERE vc.id = v_code.id;

    RETURN QUERY SELECT TRUE, 'Code verified successfully.'::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_reset_password_verify_code(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reset_password_verify_code(VARCHAR, VARCHAR) TO service_role;
