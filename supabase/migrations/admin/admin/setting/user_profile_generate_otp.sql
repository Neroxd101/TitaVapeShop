-- =============================================
-- Generate Profile Update OTP Function
-- Creates a 6-digit OTP for profile changes
-- =============================================

DROP FUNCTION IF EXISTS public.user_profile_generate_otp(UUID);

CREATE FUNCTION public.user_profile_generate_otp(
    p_user_id UUID,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
BEGIN
    IF p_user_id IS NULL OR p_otp_code !~ '^[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid OTP request');
    END IF;

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

    IF EXISTS (
        SELECT 1 FROM public.password_reset_tokens AS t
        WHERE t.user_id = v_user.id
          AND t.purpose = 'profile_update'
          AND t.created_at > NOW() - INTERVAL '60 seconds'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please wait before requesting another code');
    END IF;

    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.user_id = v_user.id
      AND t.purpose = 'profile_update'
      AND t.used = FALSE;

    -- Insert OTP token
    INSERT INTO public.password_reset_tokens (user_id, otp_code, email, expires_at, purpose)
    VALUES (v_user.id, p_otp_code, v_user.email, NOW() + INTERVAL '15 minutes', 'profile_update');

    -- Return OTP info
    RETURN jsonb_build_object(
        'success', true,
        'email', v_user.email,
        'otp_code', p_otp_code
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.user_profile_generate_otp(UUID, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_generate_otp(UUID, VARCHAR) TO service_role;
