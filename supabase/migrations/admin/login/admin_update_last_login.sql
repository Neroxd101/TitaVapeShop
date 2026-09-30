-- admin_update_last_login RPC.
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

REVOKE ALL ON FUNCTION public.admin_update_last_login(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_last_login(UUID) TO service_role;
