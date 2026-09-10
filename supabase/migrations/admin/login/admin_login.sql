-- =============================================
-- Admin / Staff Login RPC Functions
-- Handles authentication lookups and last login updates for admin/staff users
-- =============================================

-- Primary RPC: admin_login
CREATE OR REPLACE FUNCTION public.admin_login(
    p_username TEXT
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    password TEXT,
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
        u.password,
        u.roles,
        u.last_login,
        u.created_at
    FROM public.users u
    WHERE LOWER(u.username) = LOWER(TRIM(p_username))
       OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER(TRIM(p_username)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Admin / Staff Last Login Timestamp
CREATE OR REPLACE FUNCTION public.admin_update_last_login(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET last_login = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward Compatibility Alias for user_get_by_username
CREATE OR REPLACE FUNCTION public.user_get_by_username(
    p_username TEXT
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    password TEXT,
    roles TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.admin_login(p_username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward Compatibility Alias for user_update_last_login
CREATE OR REPLACE FUNCTION public.user_update_last_login(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM public.admin_update_last_login(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
