CREATE OR REPLACE FUNCTION public.setting_store_link(
    p_action TEXT,
    p_location_url TEXT DEFAULT NULL,
    p_facebook_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_action = 'get' THEN
        RETURN jsonb_build_object(
            'location_url', COALESCE((SELECT value #>> '{}' FROM public.settings WHERE key = 'store_location_url'), 'https://maps.app.goo.gl/GzssH9xZQUN94pU38'),
            'facebook_url', COALESCE((SELECT value #>> '{}' FROM public.settings WHERE key = 'store_facebook_url'), 'https://www.facebook.com/TitasVShopNaic')
        );
    ELSIF p_action = 'update' THEN
        IF p_location_url IS NULL OR p_location_url !~* '^https?://[^[:space:]]+$'
           OR p_facebook_url IS NULL OR p_facebook_url !~* '^https?://[^[:space:]]+$' THEN
            RAISE EXCEPTION 'Invalid store links';
        END IF;

        INSERT INTO public.settings (key, value, updated_at)
        VALUES
            ('store_location_url', to_jsonb(BTRIM(p_location_url)), NOW()),
            ('store_facebook_url', to_jsonb(BTRIM(p_facebook_url)), NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

        RETURN jsonb_build_object('success', TRUE);
    END IF;

    RAISE EXCEPTION 'Invalid store links action';
END;
$$;


REVOKE ALL ON FUNCTION public.setting_store_link(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setting_store_link(TEXT, TEXT, TEXT) TO service_role;

