-- =============================================
-- User Login Function
-- Gets user by username for authentication
-- Password verification is done in Express using bcrypt
-- =============================================

CREATE OR REPLACE FUNCTION user_get_by_username(
    p_username TEXT
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    password TEXT,
    roles TEXT[],
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.email,
        u.password,
        u.roles,
        u.last_login,
        u.created_at
    FROM public.users u
    WHERE u.username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Update User Last Login Function
-- Updates the last_login timestamp for a user
-- =============================================

CREATE OR REPLACE FUNCTION user_update_last_login(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET last_login = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
