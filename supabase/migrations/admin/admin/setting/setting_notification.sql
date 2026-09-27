CREATE OR REPLACE FUNCTION public.setting_notification(
    p_action TEXT,
    p_low_stock_threshold INTEGER DEFAULT NULL,
    p_low_stock_notifications_enabled BOOLEAN DEFAULT NULL,
    p_low_stock_notification_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_action = 'get' THEN
        RETURN jsonb_build_object(
            'low_stock_threshold', COALESCE((SELECT (value #>> '{}')::INTEGER FROM public.settings WHERE key = 'low_stock_threshold'), 10),
            'low_stock_notifications_enabled', COALESCE((SELECT (value #>> '{}')::BOOLEAN FROM public.settings WHERE key = 'low_stock_notifications_enabled'), TRUE),
            'low_stock_notification_email', COALESCE((SELECT value #>> '{}' FROM public.settings WHERE key = 'low_stock_notification_email'), current_setting('app.settings.smtp_user', TRUE), 'vshoptita@gmail.com')
        );
    ELSIF p_action = 'update' THEN
        IF p_low_stock_threshold IS NULL OR p_low_stock_threshold < 1
           OR p_low_stock_notifications_enabled IS NULL
           OR p_low_stock_notification_email IS NULL OR BTRIM(p_low_stock_notification_email) = '' THEN
            RAISE EXCEPTION 'Invalid notification settings';
        END IF;

        INSERT INTO public.settings (key, value, updated_at)
        VALUES
            ('low_stock_threshold', to_jsonb(p_low_stock_threshold), NOW()),
            ('low_stock_notifications_enabled', to_jsonb(p_low_stock_notifications_enabled), NOW()),
            ('low_stock_notification_email', to_jsonb(BTRIM(p_low_stock_notification_email)), NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

        RETURN jsonb_build_object('success', TRUE);
    END IF;

    RAISE EXCEPTION 'Invalid notification settings action';
END;
$$;


REVOKE ALL ON FUNCTION public.setting_notification(TEXT, INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setting_notification(TEXT, INTEGER, BOOLEAN, TEXT) TO service_role;

