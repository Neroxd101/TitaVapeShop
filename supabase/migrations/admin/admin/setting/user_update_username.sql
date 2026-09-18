-- =============================================
-- Update Username Function
-- Updates username after OTP verification
-- =============================================

CREATE OR REPLACE FUNCTION public.user_update_username(
    p_user_id UUID,
    p_new_username TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Validate new username
    IF p_new_username IS NULL
       OR LENGTH(BTRIM(p_new_username)) NOT BETWEEN 3 AND 50
       OR BTRIM(p_new_username) !~ '^[A-Za-z0-9_.-]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username must be 3–50 letters, numbers, dots, dashes, or underscores');
    END IF;

    -- Check if username already exists
    SELECT u.id
    INTO v_user
    FROM public.users AS u
    WHERE LOWER(u.username) = LOWER(BTRIM(p_new_username))
      AND u.id <> p_user_id;

    IF v_user IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username already exists');
    END IF;

    -- Update username
    UPDATE public.users AS u
    SET username = BTRIM(p_new_username)
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Username updated successfully'
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.user_update_username(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_update_username(UUID, TEXT) TO service_role;
