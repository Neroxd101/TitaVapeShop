-- =============================================
-- Password Reset Table
-- Stores OTP tokens for password reset
-- =============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otp ON password_reset_tokens(otp_code);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Generate Password Reset OTP Function
-- Creates a 6-digit OTP and stores it
-- =============================================

CREATE OR REPLACE FUNCTION password_reset_generate_otp(
    p_username TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_otp_code VARCHAR(6);
    v_token_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get user by username
    SELECT id, email, username
    INTO v_user
    FROM public.users
    WHERE username = p_username;

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

    -- Return OTP info (OTP code returned server-side only for email sending)
    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token_id,
        'email', v_user.email,
        'otp_code', v_otp_code, -- Server-side only, sent via email
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Verify Password Reset OTP Function
-- Verifies if OTP is valid and not expired
-- =============================================

CREATE OR REPLACE FUNCTION password_reset_verify_otp(
    p_username TEXT,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_token RECORD;
    v_result JSONB;
BEGIN
    -- Get user by username
    SELECT id, email
    INTO v_user
    FROM public.users
    WHERE username = p_username;

    IF v_user IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;

    -- Find valid token
    SELECT id, user_id, otp_code, expires_at, used
    INTO v_token
    FROM password_reset_tokens
    WHERE user_id = v_user.id
        AND otp_code = p_otp_code
        AND used = FALSE
        AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_token IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired OTP'
        );
    END IF;

    -- Mark token as used
    UPDATE password_reset_tokens
    SET used = TRUE
    WHERE id = v_token.id;

    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token.id,
        'user_id', v_user.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Reset Password Function
-- Updates user password after OTP verification
-- =============================================

CREATE OR REPLACE FUNCTION password_reset_update_password(
    p_user_id UUID,
    p_new_password_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Verify user exists
    SELECT id, username
    INTO v_user
    FROM public.users
    WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Update password
    UPDATE public.users
    SET password = p_new_password_hash
    WHERE id = p_user_id;

    -- Invalidate all existing reset tokens for this user
    UPDATE password_reset_tokens
    SET used = TRUE
    WHERE user_id = p_user_id
        AND used = FALSE;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
