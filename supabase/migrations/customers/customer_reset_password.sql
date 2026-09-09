-- =============================================
-- Customer Reset Password RPC Functions
-- Handles requesting a password reset OTP, verifying the OTP first, and confirming password update
-- =============================================

-- 1. Function to request password reset code
CREATE OR REPLACE FUNCTION customer_reset_password_request(
    p_email VARCHAR(255),
    p_otp_code VARCHAR(6)
)
RETURNS TABLE (
    success BOOLEAN,
    customer_id UUID,
    full_name VARCHAR(255),
    error TEXT
) AS $$
DECLARE
    v_clean_email VARCHAR(255);
    v_customer RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR(255), 'Email address is required'::TEXT;
        RETURN;
    END IF;

    -- Look up customer
    SELECT c.id, c.full_name INTO v_customer
    FROM public.customers c
    WHERE LOWER(c.email) = v_clean_email;

    IF NOT FOUND THEN
        -- Return false without sensitive disclosure (caller handles generic message)
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR(255), 'Customer account not found'::TEXT;
        RETURN;
    END IF;

    v_expires_at := NOW() + INTERVAL '15 minutes';

    -- Insert verification code
    INSERT INTO public.customer_verification_codes (
        customer_id,
        email,
        otp_code,
        expires_at,
        verified
    )
    VALUES (
        v_customer.id,
        v_clean_email,
        p_otp_code,
        v_expires_at,
        FALSE
    );

    RETURN QUERY SELECT TRUE, v_customer.id, v_customer.full_name, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to verify the OTP code before showing/accepting new password
CREATE OR REPLACE FUNCTION customer_reset_password_verify_code(
    p_email VARCHAR(255),
    p_otp_code VARCHAR(6)
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    error TEXT
) AS $$
DECLARE
    v_clean_email VARCHAR(255);
    v_clean_code VARCHAR(6);
    v_code_record RECORD;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_code := TRIM(p_otp_code);

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Email address is required'::TEXT;
        RETURN;
    END IF;

    IF v_clean_code IS NULL OR LENGTH(v_clean_code) != 6 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'A valid 6-digit verification code is required'::TEXT;
        RETURN;
    END IF;

    -- Look up latest active unexpired code
    SELECT * INTO v_code_record
    FROM public.customer_verification_codes
    WHERE LOWER(email) = v_clean_email
      AND otp_code = v_clean_code
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired verification code. Please request a new code.'::TEXT;
        RETURN;
    END IF;

    -- Mark code as verified so caller knows it was successfully confirmed
    UPDATE public.customer_verification_codes
    SET verified = TRUE
    WHERE id = v_code_record.id;

    RETURN QUERY SELECT TRUE, 'Code verified successfully.'::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to confirm new password once code is verified
CREATE OR REPLACE FUNCTION customer_reset_password_confirm(
    p_email VARCHAR(255),
    p_otp_code VARCHAR(6),
    p_new_password_hash TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    error TEXT
) AS $$
DECLARE
    v_clean_email VARCHAR(255);
    v_clean_code VARCHAR(6);
    v_code_record RECORD;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_code := TRIM(p_otp_code);

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Email address is required'::TEXT;
        RETURN;
    END IF;

    IF v_clean_code IS NULL OR LENGTH(v_clean_code) != 6 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'A valid 6-digit verification code is required'::TEXT;
        RETURN;
    END IF;

    IF p_new_password_hash IS NULL OR LENGTH(p_new_password_hash) = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'New password hash is required'::TEXT;
        RETURN;
    END IF;

    -- Look up matching active code
    SELECT * INTO v_code_record
    FROM public.customer_verification_codes
    WHERE LOWER(email) = v_clean_email
      AND otp_code = v_clean_code
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid or expired verification code. Please request a new code.'::TEXT;
        RETURN;
    END IF;

    -- Invalidate code so it cannot be used again
    UPDATE public.customer_verification_codes
    SET verified = TRUE,
        expires_at = NOW()
    WHERE id = v_code_record.id;

    -- Update customer password and ensure account is marked verified
    UPDATE public.customers
    SET password = p_new_password_hash,
        is_verified = TRUE,
        updated_at = NOW()
    WHERE LOWER(email) = v_clean_email;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Customer account not found'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Password has been reset successfully. You can now sign in.'::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION customer_reset_password_request IS 'Generates and stores a password reset OTP for a customer.';
COMMENT ON FUNCTION customer_reset_password_verify_code IS 'Verifies that the customer has provided the correct OTP code before proceeding to password reset.';
COMMENT ON FUNCTION customer_reset_password_confirm IS 'Consumes verified password reset OTP and updates customer password.';
