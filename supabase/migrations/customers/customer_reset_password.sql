-- Password-reset codes must be isolated from registration and email-change codes.
ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'email_verification';

ALTER TABLE public.customer_verification_codes
DROP CONSTRAINT IF EXISTS customer_verification_codes_purpose_check;

ALTER TABLE public.customer_verification_codes
ADD CONSTRAINT customer_verification_codes_purpose_check
CHECK (purpose IN ('email_verification', 'password_reset'));

-- Step 1: create a password-reset code. The backend generates and emails it.
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

-- Step 2: validate the code and authorize the final reset step.
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

-- Step 3: consume the verified code and replace the password atomically.
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

REVOKE ALL ON FUNCTION public.customer_reset_password_request(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_reset_password_verify_code(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_reset_password_confirm(VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_reset_password_request(VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_reset_password_verify_code(VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_reset_password_confirm(VARCHAR, VARCHAR, TEXT) TO service_role;
