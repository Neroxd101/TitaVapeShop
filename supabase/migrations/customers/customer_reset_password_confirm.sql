-- customer_reset_password_confirm RPC.
CREATE OR REPLACE FUNCTION public.customer_reset_password_confirm(
    p_email VARCHAR(255), p_otp_code VARCHAR(6), p_new_password_hash TEXT
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

    IF p_new_password_hash IS NULL
       OR LENGTH(p_new_password_hash) <> 60
       OR p_new_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid password data.'::TEXT;
        RETURN;
    END IF;

    SELECT vc.id, vc.customer_id INTO v_code
    FROM public.customer_verification_codes AS vc
    WHERE LOWER(vc.email) = v_clean_email
      AND vc.otp_code = v_clean_code
      AND vc.purpose = 'password_reset'
      AND vc.verified = TRUE
      AND vc.expires_at > NOW()
    ORDER BY vc.created_at DESC
    LIMIT 1 FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Verify the reset code before changing your password.'::TEXT;
        RETURN;
    END IF;

    UPDATE public.customer_verification_codes AS vc
    SET expires_at = NOW() WHERE vc.id = v_code.id;

    UPDATE public.customers AS c
    SET password = p_new_password_hash, updated_at = NOW()
    WHERE c.id = v_code.customer_id
      AND LOWER(c.email) = v_clean_email
      AND c.is_verified IS TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer account not found';
    END IF;

    RETURN QUERY SELECT TRUE, 'Password has been reset successfully. You can now sign in.'::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_reset_password_confirm(VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reset_password_confirm(VARCHAR, VARCHAR, TEXT) TO service_role;
