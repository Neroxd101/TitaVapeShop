-- =============================================
-- Update Username Function
-- Updates username after OTP verification
-- =============================================

CREATE OR REPLACE FUNCTION user_update_username(
    p_user_id UUID,
    p_new_username TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Validate new username
    IF p_new_username IS NULL OR TRIM(p_new_username) = '' THEN
        RAISE EXCEPTION 'Username cannot be empty';
    END IF;

    -- Check if username already exists
    SELECT id
    INTO v_user
    FROM public.users
    WHERE username = TRIM(p_new_username)
        AND id != p_user_id;

    IF v_user IS NOT NULL THEN
        RAISE EXCEPTION 'Username already exists';
    END IF;

    -- Update username
    UPDATE public.users
    SET username = TRIM(p_new_username)
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Username updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
