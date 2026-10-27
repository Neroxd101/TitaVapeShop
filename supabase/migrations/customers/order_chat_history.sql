-- Chat history table and one-time import of surviving legacy notes.
-- Run before the separate send functions and order reader functions.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS admin_delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS delivery_notes_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_delivery_notes_at TIMESTAMPTZ;

-- Keep the legacy import consistent while preparing the history table.
LOCK TABLE public.orders IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.order_chat_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'admin')),
    body TEXT NOT NULL CHECK (LENGTH(BTRIM(body)) BETWEEN 1 AND 1000),
    -- Older notes can have no recorded date. Do not invent one during import.
    created_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    legacy BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (legacy OR created_at IS NOT NULL)
);
ALTER TABLE public.order_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS order_chat_messages_order_idx
    ON public.order_chat_messages(order_id, created_at, id);
ALTER TABLE public.order_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.order_chat_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_chat_messages_id_seq TO service_role;

-- Preserve the latest surviving notes once. Older overwritten text is unavailable.
INSERT INTO public.order_chat_messages(order_id, sender, body, created_at, legacy)
SELECT o.id, 'customer', BTRIM(o.delivery_notes), o.delivery_notes_at, TRUE
FROM public.orders o
WHERE NULLIF(BTRIM(o.delivery_notes), '') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.order_chat_messages m WHERE m.order_id = o.id AND m.sender = 'customer');
INSERT INTO public.order_chat_messages(order_id, sender, body, created_at, legacy)
SELECT o.id, 'admin', BTRIM(o.admin_delivery_notes), o.admin_delivery_notes_at, TRUE
FROM public.orders o
WHERE NULLIF(BTRIM(o.admin_delivery_notes), '') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.order_chat_messages m WHERE m.order_id = o.id AND m.sender = 'admin');

NOTIFY pgrst, 'reload schema';
COMMIT;
