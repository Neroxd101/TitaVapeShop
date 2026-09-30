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

    UPDATE public.users AS u
    SET password = p_new_password_hash,
        session_version = COALESCE(u.session_version, 0) + 1
    WHERE u.id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.user_admin_update_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_admin_update_password(UUID, TEXT) TO service_role;
