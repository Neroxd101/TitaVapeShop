BEGIN;
-- Existing names remain unchanged until the customer supplies their name parts.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_parts JSONB;

CREATE OR REPLACE FUNCTION public.customer_normalize_name_parts(p_parts JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    part TEXT;
    value TEXT;
BEGIN
    IF jsonb_typeof(p_parts) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Please provide your last name and first name';
    END IF;
    FOREACH part IN ARRAY ARRAY['last_name', 'first_name', 'middle_name', 'suffix'] LOOP
        IF p_parts ? part AND jsonb_typeof(p_parts->part) <> 'string' THEN
            RAISE EXCEPTION 'Name fields must be text';
        END IF;
        value := BTRIM(COALESCE(p_parts->>part, ''));
        IF LENGTH(value) > (CASE WHEN part = 'suffix' THEN 20 ELSE 100 END) THEN
            RAISE EXCEPTION 'Name field is too long';
        END IF;
        IF part IN ('last_name', 'first_name') AND value = '' THEN
            RAISE EXCEPTION 'Please enter your last name and first name';
        END IF;
        result := result || jsonb_build_object(part, value);
    END LOOP;
    IF LENGTH((result->>'last_name') || ', ' || CONCAT_WS(' ',
        NULLIF(result->>'first_name', ''), NULLIF(result->>'middle_name', ''), NULLIF(result->>'suffix', ''))) > 255 THEN
        RAISE EXCEPTION 'Your full name must not exceed 255 characters';
    END IF;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_format_name(p_parts JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT (p_parts->>'last_name') || ', ' || CONCAT_WS(' ',
        NULLIF(p_parts->>'first_name', ''), NULLIF(p_parts->>'middle_name', ''), NULLIF(p_parts->>'suffix', ''));
$$;
REVOKE ALL ON FUNCTION public.customer_normalize_name_parts(JSONB), public.customer_format_name(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_normalize_name_parts(JSONB), public.customer_format_name(JSONB) TO service_role;

-- =============================================
-- Customer Register RPC Function
-- Registers a new customer and generates a 6-digit OTP code
-- =============================================

DROP FUNCTION IF EXISTS public.customer_register(TEXT, TEXT, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.customer_register(
    p_full_name TEXT,
    p_email TEXT,
    p_contact_number TEXT,
    p_password_hash TEXT,
    p_birthday DATE,
    p_name_parts JSONB DEFAULT NULL
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
    IF p_name_parts IS NOT NULL THEN
        p_name_parts := public.customer_normalize_name_parts(p_name_parts);
        v_clean_name := public.customer_format_name(p_name_parts);
    END IF;
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

    -- Only accept a bcrypt hash produced by the trusted backend.
    IF p_password_hash IS NULL
       OR LENGTH(p_password_hash) <> 60
       OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid password data.');
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
        name_parts,
        email,
        contact_number,
        password,
        birthday,
        is_verified
    )
    VALUES (
        v_clean_name,
        p_name_parts,
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
        verified,
        purpose
    )
    VALUES (
        v_customer_id,
        v_clean_email,
        v_otp_code,
        v_expires_at,
        FALSE,
        'email_verification'
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Registration must pass through the backend, which validates the request,
-- hashes the password, and sends the verification email.
REVOKE ALL ON FUNCTION public.customer_register(TEXT, TEXT, TEXT, TEXT, DATE, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_register(TEXT, TEXT, TEXT, TEXT, DATE, JSONB)
TO service_role;

-- =============================================
-- Customer Update Profile RPC Function
-- Updates customer name, phone, and initiates email change OTP
-- =============================================

DROP FUNCTION IF EXISTS public.customer_update_profile(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.customer_update_profile(
    p_customer_id UUID,
    p_full_name TEXT,
    p_contact_number TEXT,
    p_email TEXT,
    p_name_parts JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_clean_email TEXT;
    v_current_customer RECORD;
    v_is_email_changing BOOLEAN := FALSE;
    v_otp_code VARCHAR(6);
    v_expires_at TIMESTAMPTZ;
    v_updated_customer RECORD;
BEGIN
    v_clean_name := TRIM(p_full_name);
    IF p_name_parts IS NOT NULL THEN
        p_name_parts := public.customer_normalize_name_parts(p_name_parts);
        v_clean_name := public.customer_format_name(p_name_parts);
    END IF;
    v_clean_phone := REGEXP_REPLACE(TRIM(p_contact_number), '\D', '', 'g');
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter your full name (at least 2 characters).');
    END IF;

    IF v_clean_phone ~ '^639[0-9]{9}$' THEN
        v_clean_phone := '0' || SUBSTRING(v_clean_phone FROM 3);
    END IF;

    IF v_clean_phone !~ '^09[0-9]{9}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid 11-digit mobile number (e.g. 09123456789).');
    END IF;

    IF v_clean_email IS NULL OR v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid email address.');
    END IF;

    -- Look up active customer
    SELECT c.id, c.email, c.full_name, c.contact_number, c.birthday, c.is_verified
    INTO v_current_customer
    FROM public.customers AS c
    WHERE c.id = p_customer_id
    FOR UPDATE;

    IF v_current_customer IS NULL OR v_current_customer.is_verified IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer account not found.');
    END IF;

    -- Check if phone is already in use by another account
    IF EXISTS (
        SELECT 1 FROM public.customers AS c
        WHERE c.id <> p_customer_id
          AND (
              c.contact_number = v_clean_phone
              OR c.contact_number = '+63' || SUBSTRING(v_clean_phone FROM 2)
          )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already associated with another account.');
    END IF;

    v_is_email_changing := (v_clean_email <> LOWER(v_current_customer.email));

    IF v_is_email_changing THEN
        -- Check if new email belongs to someone else
        IF EXISTS (
            SELECT 1 FROM public.customers AS c
            WHERE c.id <> p_customer_id
              AND LOWER(c.email) = v_clean_email
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'This email is already associated with another account.');
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.customer_verification_codes AS vc
            WHERE vc.customer_id = p_customer_id
              AND vc.purpose = 'email_verification'
              AND vc.created_at > NOW() - INTERVAL '60 seconds'
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Please wait 60 seconds before requesting another verification email.'
            );
        END IF;

        UPDATE public.customer_verification_codes AS vc
        SET verified = TRUE
        WHERE vc.customer_id = p_customer_id
          AND vc.purpose = 'email_verification'
          AND vc.verified = FALSE;

        -- Update name and phone immediately, but NOT email yet
        UPDATE public.customers AS c
        SET full_name = v_clean_name,
        name_parts = CASE WHEN p_name_parts IS NOT NULL THEN p_name_parts WHEN c.full_name = v_clean_name THEN c.name_parts ELSE NULL END,
            contact_number = v_clean_phone,
            updated_at = NOW()
        WHERE c.id = p_customer_id;

        -- Generate 6-digit OTP for the new email
        v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        v_expires_at := NOW() + INTERVAL '15 minutes';

        INSERT INTO public.customer_verification_codes (
            customer_id,
            email,
            otp_code,
            expires_at,
            verified,
            purpose
        )
        VALUES (
            p_customer_id,
            v_clean_email,
            v_otp_code,
            v_expires_at,
            FALSE,
            'email_verification'
        );

        RETURN jsonb_build_object(
            'success', true,
            'email_changed', true,
            'pending_verification', true,
            'customer_id', p_customer_id,
            'email', v_clean_email,
            'full_name', v_clean_name,
            'otp_code', v_otp_code,
            'expires_at', v_expires_at,
            'message', 'Verification code sent to your new email. Please verify to confirm.'
        );
    END IF;

    -- Email unchanged: update name & contact number only
    UPDATE public.customers AS c
    SET full_name = v_clean_name,
        name_parts = CASE WHEN p_name_parts IS NOT NULL THEN p_name_parts WHEN c.full_name = v_clean_name THEN c.name_parts ELSE NULL END,
        contact_number = v_clean_phone,
        updated_at = NOW()
    WHERE c.id = p_customer_id
    RETURNING c.id, c.email, c.full_name, c.name_parts, c.contact_number, c.birthday
    INTO v_updated_customer;

    RETURN jsonb_build_object(
        'success', true,
        'email_changed', false,
        'message', 'Profile updated successfully!',
        'customer', jsonb_build_object(
            'id', v_updated_customer.id,
            'email', v_updated_customer.email,
            'full_name', v_updated_customer.full_name,
            'name_parts', v_updated_customer.name_parts,
            'contact_number', v_updated_customer.contact_number,
            'birthday', v_updated_customer.birthday,
            'role', 'customer'
        )
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_update_profile(UUID, TEXT, TEXT, TEXT, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_update_profile(UUID, TEXT, TEXT, TEXT, JSONB)
TO service_role;

-- =============================================
-- Customer Login RPC Function
-- Returns customer authentication row by email
-- Password verification is done in Express using bcrypt
-- =============================================

DROP FUNCTION IF EXISTS public.customer_login(TEXT);

CREATE OR REPLACE FUNCTION public.customer_login(
    p_email TEXT
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    password TEXT,
    full_name TEXT,
    name_parts JSONB,
    contact_number VARCHAR(20),
    birthday DATE,
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.email,
        c.password,
        c.full_name,
        c.name_parts,
        c.contact_number,
        c.birthday,
        c.is_verified,
        c.created_at
    FROM public.customers c
    WHERE LOWER(c.email) = LOWER(TRIM(p_email));
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Remove the old duplicate password-reading entry point.
DROP FUNCTION IF EXISTS public.customer_get_by_email(TEXT);

-- This function returns a password hash, so only the trusted backend may run it.
REVOKE ALL ON FUNCTION public.customer_login(TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_login(TEXT)
TO service_role;

-- =============================================
-- Customer Verify OTP RPC Function
-- Verifies 6-digit OTP code, activates customer, updates email
-- =============================================

ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'email_verification';

CREATE OR REPLACE FUNCTION public.customer_verify_otp(
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

    IF v_clean_email IS NULL OR v_clean_code IS NULL OR v_clean_code !~ '^[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid email and 6-digit code are required.');
    END IF;

    -- Lock the latest active code so attempts cannot race each other.
    SELECT id, customer_id, email, otp_code, expires_at, verified, attempt_count
    INTO v_code_record
    FROM public.customer_verification_codes
    WHERE LOWER(email) = v_clean_email
      AND purpose = 'email_verification'
      AND verified = FALSE
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_code_record IS NULL OR v_code_record.expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired verification code. Please check your code or request a new one.'
        );
    END IF;

    IF v_code_record.attempt_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please request a new code.');
    END IF;

    IF v_code_record.otp_code <> v_clean_code THEN
        UPDATE public.customer_verification_codes
        SET attempt_count = attempt_count + 1
        WHERE id = v_code_record.id;

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
    RETURNING id, email, full_name, name_parts, contact_number, birthday
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
            'name_parts', v_customer.name_parts,
            'contact_number', v_customer.contact_number,
            'birthday', v_customer.birthday,
            'role', 'customer'
        )
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.customer_verify_otp(TEXT, VARCHAR)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.customer_verify_otp(TEXT, VARCHAR)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
