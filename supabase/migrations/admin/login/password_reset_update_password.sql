-- password_reset_update_password RPC.
DROP FUNCTION IF EXISTS public.password_reset_update_password(UUID, TEXT);
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
      AND t.purpose = 'password_reset'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reset authorization is invalid or expired');
    END IF;

    UPDATE public.users AS u
    SET password = p_new_password_hash,
        session_version = COALESCE(u.session_version, 0) + 1
    WHERE u.id = v_token.user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.user_id = v_token.user_id
      AND t.purpose = 'password_reset'
      AND t.used = FALSE;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.password_reset_update_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_update_password(UUID, TEXT) TO service_role;
