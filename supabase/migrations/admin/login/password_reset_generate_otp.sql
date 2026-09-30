-- password_reset_generate_otp RPC.
DROP FUNCTION IF EXISTS public.password_reset_generate_otp(TEXT);
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
          AND t.purpose = 'password_reset'
          AND t.created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please wait before requesting another code');
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.user_id = v_user.id
      AND t.purpose = 'password_reset'
      AND t.used = FALSE;

    INSERT INTO public.password_reset_tokens(user_id, otp_code, email, expires_at, purpose)
    VALUES (v_user.id, p_otp_code, v_user.email, NOW() + INTERVAL '15 minutes', 'password_reset');

    RETURN jsonb_build_object(
        'success', true,
        'email', v_user.email,
        'otp_code', p_otp_code
    );
END;
$$;

REVOKE ALL ON FUNCTION public.password_reset_generate_otp(TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_generate_otp(TEXT, VARCHAR) TO service_role;
