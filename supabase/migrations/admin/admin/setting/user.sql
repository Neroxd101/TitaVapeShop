-- Create users table for session-based authentication
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password TEXT NOT NULL, -- Hashed password
    roles TEXT DEFAULT 'user',
    session_version INTEGER NOT NULL DEFAULT 0,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS users_username_idx ON public.users (username);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- Enable Row Level Security (optional, depending on project needs)
-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- Block all public access (Implicitly allows Service Role/Admin)
-- We do not add any public policies, so only the Service Role key can access this table.
-- This protects user data (like password hashes) from being exposed.

-- Add email column to existing tables (for migrations)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.users ADD COLUMN email TEXT UNIQUE;
        CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
    END IF;
END $$;
