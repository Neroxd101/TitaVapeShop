-- Admin/staff password-reset tokens. Only trusted backend RPCs may access them.
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    purpose VARCHAR(30) NOT NULL DEFAULT 'password_reset',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.password_reset_tokens
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.password_reset_tokens
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.password_reset_tokens
ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'password_reset';

ALTER TABLE public.password_reset_tokens
DROP CONSTRAINT IF EXISTS password_reset_tokens_purpose_check;
ALTER TABLE public.password_reset_tokens
ADD CONSTRAINT password_reset_tokens_purpose_check
CHECK (purpose IN ('password_reset', 'profile_update'));

CREATE INDEX IF NOT EXISTS idx_password_reset_user_created
    ON public.password_reset_tokens(user_id, created_at DESC);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_reset_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;
