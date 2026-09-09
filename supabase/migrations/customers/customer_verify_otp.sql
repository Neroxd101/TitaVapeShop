-- =============================================
-- Customer Verify OTP RPC Function
-- Verifies 6-digit OTP code, activates customer, updates email
-- =============================================

CREATE OR REPLACE FUNCTION customer_verify_otp(
    p_email TEXT,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_clean_email TEXT;
    v_clean_code VARCHAR(6);
    v_code_record RECORD;
    v_customer RECORD;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_code := TRIM(p_otp_code);

    IF v_clean_email IS NULL OR v_clean_code IS NULL OR LENGTH(v_clean_code) <> 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid email and 6-digit code are required.');
    END IF;

    -- Look up latest active matching code
    SELECT id, customer_id, email, expires_at, verified
    INTO v_code_record
    FROM public.customer_verification_codes
    WHERE LOWER(email) = v_clean_email
      AND otp_code = v_clean_code
      AND verified = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired verification code. Please check your code or request a new one.'
        );
    END IF;

    -- Mark OTP as verified
    UPDATE public.customer_verification_codes
    SET verified = TRUE
    WHERE id = v_code_record.id;

    -- Update customer status and email
    UPDATE public.customers
    SET email = v_code_record.email,
        is_verified = TRUE,
        email_verified_at = NOW(),
        updated_at = NOW()
    WHERE id = v_code_record.customer_id
    RETURNING id, email, full_name, contact_number, birthday
    INTO v_customer;

    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer account not found.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Email successfully verified!',
        'customer', jsonb_build_object(
            'id', v_customer.id,
            'email', v_customer.email,
            'full_name', v_customer.full_name,
            'contact_number', v_customer.contact_number,
            'birthday', v_customer.birthday,
            'role', 'customer'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
