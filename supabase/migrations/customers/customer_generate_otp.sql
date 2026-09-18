-- =============================================
-- Customer Generate/Resend OTP RPC Function
-- Generates a fresh 6-digit OTP for registration or email change
-- =============================================

CREATE OR REPLACE FUNCTION public.customer_generate_otp(
    p_email TEXT,
    p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_clean_email TEXT;
    v_customer RECORD;
    v_target_customer_id UUID := p_customer_id;
    v_target_name TEXT := 'Customer';
    v_otp_code VARCHAR(6);
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email address is required.');
    END IF;

    -- If customer ID provided, verify customer
    IF v_target_customer_id IS NOT NULL THEN
        SELECT id, full_name, email INTO v_customer
        FROM public.customers
        WHERE id = v_target_customer_id;

        IF v_customer IS NOT NULL AND LOWER(v_customer.email) = v_clean_email THEN
            v_target_name := v_customer.full_name;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Customer account does not match this email.');
        END IF;
    ELSE
        -- Look up customer by email
        SELECT id, full_name, email, is_verified INTO v_customer
        FROM public.customers
        WHERE LOWER(email) = v_clean_email;

        IF v_customer IS NOT NULL THEN
            IF v_customer.is_verified THEN
                RETURN jsonb_build_object('success', false, 'error', 'This account is already verified. You can log in.');
            END IF;
            v_target_customer_id := v_customer.id;
            v_target_name := v_customer.full_name;
        ELSE
            -- Check if there is an unverified code pending for an email change
            SELECT customer_id INTO v_target_customer_id
            FROM public.customer_verification_codes
            WHERE LOWER(email) = v_clean_email
              AND purpose = 'email_verification'
              AND verified = FALSE
            ORDER BY created_at DESC
            LIMIT 1;

            IF v_target_customer_id IS NOT NULL THEN
                SELECT full_name INTO v_target_name
                FROM public.customers
                WHERE id = v_target_customer_id;
            END IF;
        END IF;
    END IF;

    IF v_target_customer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No customer account found with this email.');
    END IF;

    -- Prevent email flooding and uncontrolled OTP creation.
    IF EXISTS (
        SELECT 1
        FROM public.customer_verification_codes
        WHERE customer_id = v_target_customer_id
          AND LOWER(email) = v_clean_email
          AND purpose = 'email_verification'
          AND created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Please wait 60 seconds before requesting another code.'
        );
    END IF;

    -- A newly generated code replaces all older active codes.
    UPDATE public.customer_verification_codes
    SET verified = TRUE
    WHERE customer_id = v_target_customer_id
      AND LOWER(email) = v_clean_email
      AND purpose = 'email_verification'
      AND verified = FALSE;

    -- Generate fresh 6-digit OTP
    v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_expires_at := NOW() + INTERVAL '15 minutes';

    -- Insert into verification table
    INSERT INTO public.customer_verification_codes (
        customer_id,
        email,
        otp_code,
        expires_at,
        verified,
        purpose
    )
    VALUES (
        v_target_customer_id,
        v_clean_email,
        v_otp_code,
        v_expires_at,
        FALSE,
        'email_verification'
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_target_customer_id,
        'email', v_clean_email,
        'full_name', v_target_name,
        'otp_code', v_otp_code,
        'expires_at', v_expires_at,
        'message', 'A new verification code has been generated.'
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_generate_otp(TEXT, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_generate_otp(TEXT, UUID)
TO service_role;
