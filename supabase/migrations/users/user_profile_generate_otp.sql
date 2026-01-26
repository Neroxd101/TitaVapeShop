-- =============================================
-- Generate Profile Update OTP Function
-- Creates a 6-digit OTP for profile changes
-- =============================================

CREATE OR REPLACE FUNCTION user_profile_generate_otp(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_otp_code VARCHAR(6);
    v_token_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get user by ID
    SELECT id, email, username
    INTO v_user
    FROM public.users
    WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if user has email
    IF v_user.email IS NULL OR TRIM(v_user.email) = '' THEN
        RAISE EXCEPTION 'User does not have an email address configured';
    END IF;

    -- Generate 6-digit OTP
    v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Set expiration (15 minutes from now)
    v_expires_at := NOW() + INTERVAL '15 minutes';

    -- Insert OTP token
    INSERT INTO password_reset_tokens (user_id, otp_code, email, expires_at)
    VALUES (v_user.id, v_otp_code, v_user.email, v_expires_at)
    RETURNING id INTO v_token_id;

    -- Return OTP info
    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token_id,
        'email', v_user.email,
        'otp_code', v_otp_code, -- Server-side only, sent via email
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
