-- Public store profile data exposed through a narrow RPC.
DROP FUNCTION IF EXISTS public.catalog_get_store_hours();

CREATE OR REPLACE FUNCTION public.catalog_store_hours_link()
RETURNS TABLE (
    open_time TEXT,
    close_time TEXT,
    location_url TEXT,
    facebook_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(MAX(value #>> '{}') FILTER (WHERE key = 'operating_open_time'), '08:00'),
        COALESCE(MAX(value #>> '{}') FILTER (WHERE key = 'operating_close_time'), '20:30'),
        COALESCE(MAX(value #>> '{}') FILTER (WHERE key = 'store_location_url'), 'https://maps.app.goo.gl/GzssH9xZQUN94pU38'),
        COALESCE(MAX(value #>> '{}') FILTER (WHERE key = 'store_facebook_url'), 'https://www.facebook.com/TitasVShopNaic')
    FROM public.settings
    WHERE key IN ('operating_open_time', 'operating_close_time', 'store_location_url', 'store_facebook_url');
$$;

REVOKE ALL ON FUNCTION public.catalog_store_hours_link() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_store_hours_link() TO anon, service_role;
