-- =============================================
-- Customer Update Profile RPC Function
-- Updates customer name, phone, and initiates email change OTP
-- =============================================

CREATE OR REPLACE FUNCTION customer_update_profile(
    p_customer_id UUID,
    p_full_name TEXT,
    p_contact_number TEXT,
    p_email TEXT
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
    v_clean_phone := REGEXP_REPLACE(TRIM(p_contact_number), '\D', '', 'g');
    v_clean_email := LOWER(TRIM(p_email));

    IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter your full name (at least 2 characters).');
    END IF;

    IF LENGTH(v_clean_phone) <> 11 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid 11-digit mobile number (e.g. 09123456789).');
    END IF;

    IF v_clean_email IS NULL OR v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid email address.');
    END IF;

    -- Look up active customer
    SELECT id, email, full_name, contact_number, birthday INTO v_current_customer
    FROM public.customers
    WHERE id = p_customer_id;

    IF v_current_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer account not found.');
    END IF;

    -- Check if phone is already in use by another account
    IF EXISTS (
        SELECT 1 FROM public.customers
        WHERE id <> p_customer_id
          AND (
              contact_number = v_clean_phone
              OR contact_number = '0' || SUBSTRING(v_clean_phone FROM 2)
              OR contact_number = '+63' || SUBSTRING(v_clean_phone FROM 2)
          )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already associated with another account.');
    END IF;

    v_is_email_changing := (v_clean_email <> LOWER(v_current_customer.email));

    IF v_is_email_changing THEN
        -- Check if new email belongs to someone else
        IF EXISTS (
            SELECT 1 FROM public.customers
            WHERE id <> p_customer_id
              AND LOWER(email) = v_clean_email
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'This email is already associated with another account.');
        END IF;

        -- Update name and phone immediately, but NOT email yet
        UPDATE public.customers
        SET full_name = v_clean_name,
            contact_number = v_clean_phone,
            updated_at = NOW()
        WHERE id = p_customer_id;

        -- Generate 6-digit OTP for the new email
        v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        v_expires_at := NOW() + INTERVAL '15 minutes';

        INSERT INTO public.customer_verification_codes (
            customer_id,
            email,
            otp_code,
            expires_at,
            verified
        )
        VALUES (
            p_customer_id,
            v_clean_email,
            v_otp_code,
            v_expires_at,
            FALSE
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
    UPDATE public.customers
    SET full_name = v_clean_name,
        contact_number = v_clean_phone,
        updated_at = NOW()
    WHERE id = p_customer_id
    RETURNING id, email, full_name, contact_number, birthday
    INTO v_updated_customer;

    RETURN jsonb_build_object(
        'success', true,
        'email_changed', false,
        'message', 'Profile updated successfully!',
        'customer', jsonb_build_object(
            'id', v_updated_customer.id,
            'email', v_updated_customer.email,
            'full_name', v_updated_customer.full_name,
            'contact_number', v_updated_customer.contact_number,
            'birthday', v_updated_customer.birthday,
            'role', 'customer'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
