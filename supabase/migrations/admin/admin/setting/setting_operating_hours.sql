CREATE OR REPLACE FUNCTION public.setting_operating_hours(
    p_action TEXT,
    p_open_time TEXT DEFAULT NULL,
    p_close_time TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_action = 'get' THEN
        RETURN jsonb_build_object(
            'open_time', COALESCE((SELECT value #>> '{}' FROM public.settings WHERE key = 'operating_open_time'), '08:00'),
            'close_time', COALESCE((SELECT value #>> '{}' FROM public.settings WHERE key = 'operating_close_time'), '20:30')
        );
    ELSIF p_action = 'update' THEN
        IF p_open_time IS NULL OR p_open_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           OR p_close_time IS NULL OR p_close_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'Invalid operating hours';
        END IF;

        INSERT INTO public.settings (key, value, updated_at)
        VALUES
            ('operating_open_time', to_jsonb(p_open_time), NOW()),
            ('operating_close_time', to_jsonb(p_close_time), NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

        RETURN jsonb_build_object('success', TRUE);
    END IF;

    RAISE EXCEPTION 'Invalid operating hours action';
END;
$$;


REVOKE ALL ON FUNCTION public.setting_operating_hours(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setting_operating_hours(TEXT, TEXT, TEXT) TO service_role;

