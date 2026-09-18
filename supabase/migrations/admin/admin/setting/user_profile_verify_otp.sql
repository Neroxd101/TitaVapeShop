-- =============================================
-- Verify Profile Update OTP Function
-- Verifies OTP for profile changes
-- =============================================

CREATE OR REPLACE FUNCTION public.user_profile_verify_otp(
    p_user_id UUID,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_token RECORD;
BEGIN
    IF p_user_id IS NULL OR p_otp_code !~ '^[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired OTP');
    END IF;

    -- Lock the latest profile-update token before checking the code.
    SELECT t.id, t.otp_code, t.expires_at, t.attempt_count
    INTO v_token
    FROM public.password_reset_tokens AS t
    WHERE t.user_id = p_user_id
      AND t.purpose = 'profile_update'
      AND t.used = FALSE
    ORDER BY t.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired OTP'
        );
    END IF;

    IF v_token.expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired OTP'
        );
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

    -- Mark token as used
    UPDATE public.password_reset_tokens AS t
    SET used = TRUE
    WHERE t.id = v_token.id;

    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token.id
    );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.user_profile_verify_otp(UUID, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_verify_otp(UUID, VARCHAR) TO service_role;
