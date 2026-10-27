-- Read status belongs to the recipient: customer reads admin messages; store reads customer messages.
ALTER TABLE public.order_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS order_chat_unread_idx ON public.order_chat_messages(order_id, sender, id) WHERE read_at IS NULL;
NOTIFY pgrst, 'reload schema';
