-- =============================================
-- Admin / Staff Login RPC Functions
-- Handles authentication lookups and last login updates for admin/staff users
-- =============================================

-- Return type changed to include session_version; remove old definitions first.
DROP FUNCTION IF EXISTS public.user_get_by_username(TEXT);
DROP FUNCTION IF EXISTS public.user_update_last_login(UUID);
DROP FUNCTION IF EXISTS public.admin_login(TEXT);

-- Primary RPC: admin_login
CREATE FUNCTION public.admin_login(
    p_username TEXT
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    password TEXT,
    roles TEXT,
    session_version INTEGER,
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
        u.session_version,
        u.last_login,
        u.created_at
    FROM public.users u
    WHERE LOWER(u.username) = LOWER(TRIM(p_username))
       OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER(TRIM(p_username)));
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_login(TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_last_login(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_login(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_last_login(UUID) TO service_role;
