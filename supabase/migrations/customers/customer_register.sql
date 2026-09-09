-- =============================================
-- Customer Register RPC Function
-- Registers a new customer and generates a 6-digit OTP code
-- =============================================

CREATE OR REPLACE FUNCTION customer_register(
    p_full_name TEXT,
    p_email TEXT,
    p_contact_number TEXT,
    p_password_hash TEXT,
    p_birthday DATE
)
RETURNS JSONB AS $$
DECLARE
    v_clean_email TEXT;
    v_clean_phone TEXT;
    v_clean_name TEXT;
    v_customer_id UUID;
    v_otp_code VARCHAR(6);
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_clean_name := TRIM(p_full_name);
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_phone := REGEXP_REPLACE(TRIM(p_contact_number), '\D', '', 'g');

    -- Validations
    IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter your full name (minimum 2 characters).');
    END IF;

    IF v_clean_email IS NULL OR v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please provide a valid email address.');
    END IF;

    IF LENGTH(v_clean_phone) <> 11 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contact number must be exactly 11 digits (e.g. 09123456789).');
    END IF;

    -- Age check (18+)
    IF p_birthday IS NULL OR (p_birthday + INTERVAL '18 years') > CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be at least 18 years of age under Republic Act No. 11900.');
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM public.customers WHERE LOWER(email) = v_clean_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This email already exists. Please sign in.');
    END IF;

    -- Check if phone already exists
    IF EXISTS (
        SELECT 1 FROM public.customers 
        WHERE contact_number = v_clean_phone 
           OR contact_number = '0' || SUBSTRING(v_clean_phone FROM 2)
           OR contact_number = '+63' || SUBSTRING(v_clean_phone FROM 2)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This mobile number already exists. Please use a different number or sign in.');
    END IF;

    -- Insert into customers table
    INSERT INTO public.customers (
        full_name,
        email,
        contact_number,
        password,
        birthday,
        is_verified
    )
    VALUES (
        v_clean_name,
        v_clean_email,
        v_clean_phone,
        p_password_hash,
        p_birthday,
        FALSE
    )
    RETURNING id INTO v_customer_id;

    -- Generate 6-digit OTP
    v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_expires_at := NOW() + INTERVAL '15 minutes';

    -- Insert into customer_verification_codes
    INSERT INTO public.customer_verification_codes (
        customer_id,
        email,
        otp_code,
        expires_at,
        verified
    )
    VALUES (
        v_customer_id,
        v_clean_email,
        v_otp_code,
        v_expires_at,
        FALSE
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'email', v_clean_email,
        'full_name', v_clean_name,
        'otp_code', v_otp_code,
        'expires_at', v_expires_at,
        'message', 'Verification code generated successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
