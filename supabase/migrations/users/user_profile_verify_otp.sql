-- =============================================
-- Verify Profile Update OTP Function
-- Verifies OTP for profile changes
-- =============================================

CREATE OR REPLACE FUNCTION user_profile_verify_otp(
    p_user_id UUID,
    p_otp_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_token RECORD;
BEGIN
    -- Find valid token
    SELECT id, user_id, otp_code, expires_at, used
    INTO v_token
    FROM password_reset_tokens
    WHERE user_id = p_user_id
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
        'token_id', v_token.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
