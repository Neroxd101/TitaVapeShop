-- =============================================
-- Settings Table for System Configurations
-- =============================================

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- No public policies are defined.
-- This ensures only the service role key (supabaseAdmin client) can access this table.
-- All access is mediated through our secure backend endpoints.

-- Seed default notification configurations
INSERT INTO public.settings (key, value)
VALUES 
('low_stock_threshold', '10'::jsonb),
('low_stock_notifications_enabled', 'true'::jsonb),
('low_stock_notification_email', '"vshoptita@gmail.com"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
