-- Admin/staff password-reset tokens. Only trusted backend RPCs may access them.
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.password_reset_tokens
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.password_reset_tokens
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_password_reset_user_created
    ON public.password_reset_tokens(user_id, created_at DESC);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_reset_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;

-- Remove the unsafe legacy function that changed a password using only a user ID.
DROP FUNCTION IF EXISTS public.password_reset_generate_otp(TEXT);
DROP FUNCTION IF EXISTS public.password_reset_update_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.password_reset_generate_otp(
    p_username TEXT,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF p_username IS NULL OR BTRIM(p_username) = '' OR p_otp_code !~ '^[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid password reset request');
    END IF;

    SELECT u.id, u.email, u.username INTO v_user
    FROM public.users AS u
    WHERE LOWER(u.username) = LOWER(BTRIM(p_username));

    IF NOT FOUND OR v_user.email IS NULL OR BTRIM(v_user.email) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is unavailable');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.password_reset_tokens AS t
        WHERE t.user_id = v_user.id
          AND t.created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please wait before requesting another code');
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.user_id = v_user.id AND t.used = FALSE;

    INSERT INTO public.password_reset_tokens(user_id, otp_code, email, expires_at)
    VALUES (v_user.id, p_otp_code, v_user.email, NOW() + INTERVAL '15 minutes');

    RETURN jsonb_build_object(
        'success', true,
        'email', v_user.email,
        'otp_code', p_otp_code
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.password_reset_verify_otp(
    p_username TEXT,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_token RECORD;
BEGIN
    IF p_username IS NULL OR p_otp_code !~ '^[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    SELECT u.id INTO v_user_id
    FROM public.users AS u
    WHERE LOWER(u.username) = LOWER(BTRIM(p_username));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    SELECT t.id, t.otp_code, t.expires_at, t.attempt_count INTO v_token
    FROM public.password_reset_tokens AS t
    WHERE t.user_id = v_user_id AND t.used = FALSE
    ORDER BY t.created_at DESC
    LIMIT 1 FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    IF v_token.expires_at <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    IF v_token.attempt_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Request a new code.');
    END IF;

    IF v_token.otp_code <> p_otp_code THEN
        UPDATE public.password_reset_tokens AS t
        SET attempt_count = attempt_count + 1
        WHERE t.id = v_token.id;
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET verified_at = NOW()
    WHERE t.id = v_token.id;

    RETURN jsonb_build_object('success', true, 'token_id', v_token.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.password_reset_update_password(
    p_token_id UUID,
    p_new_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_token RECORD;
BEGIN
    IF p_token_id IS NULL
       OR p_new_password_hash IS NULL
       OR LENGTH(p_new_password_hash) <> 60
       OR p_new_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid password reset data');
    END IF;

    SELECT t.id, t.user_id INTO v_token
    FROM public.password_reset_tokens AS t
    WHERE t.id = p_token_id
      AND t.used = FALSE
      AND t.verified_at IS NOT NULL
      AND t.expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reset authorization is invalid or expired');
    END IF;

    UPDATE public.users AS u
    SET password = p_new_password_hash
    WHERE u.id = v_token.user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.user_id = v_token.user_id AND t.used = FALSE;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

-- Dedicated authenticated-admin operation used by the Settings page.
CREATE OR REPLACE FUNCTION public.user_admin_update_password(
    p_user_id UUID,
    p_new_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF p_user_id IS NULL
       OR p_new_password_hash IS NULL
       OR LENGTH(p_new_password_hash) <> 60
       OR p_new_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid password data');
    END IF;

    UPDATE public.users AS u SET password = p_new_password_hash WHERE u.id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.password_reset_generate_otp(TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.password_reset_verify_otp(TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.password_reset_update_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_admin_update_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.password_reset_generate_otp(TEXT, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.password_reset_verify_otp(TEXT, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.password_reset_update_password(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_admin_update_password(UUID, TEXT) TO service_role;
