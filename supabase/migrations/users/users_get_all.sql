-- =============================================
-- Users Get All Function
-- Gets list of all users (admin only)
-- If p_user_id is provided, returns only that user
-- Returns user info without password
-- =============================================

CREATE OR REPLACE FUNCTION users_get_all(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    roles TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.email,
        u.roles,
        u.last_login,
        u.created_at
    FROM public.users u
    WHERE (p_user_id IS NULL OR u.id = p_user_id)
    ORDER BY u.username ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
