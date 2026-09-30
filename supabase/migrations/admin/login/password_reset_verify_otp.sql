-- password_reset_verify_otp RPC.
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
    WHERE t.user_id = v_user_id
      AND t.purpose = 'password_reset'
      AND t.used = FALSE
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

REVOKE ALL ON FUNCTION public.password_reset_verify_otp(TEXT, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_verify_otp(TEXT, VARCHAR) TO service_role;
