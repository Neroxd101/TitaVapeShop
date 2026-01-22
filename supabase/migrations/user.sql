-- Create users table for session-based authentication
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Hashed password
    roles TEXT[] DEFAULT '{user}',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS users_username_idx ON public.users (username);

-- Enable Row Level Security (optional, depending on project needs)
-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Block all public access (Implicitly allows Service Role/Admin)
-- We do not add any public policies, so only the Service Role key can access this table.
-- This protects user data (like password hashes) from being exposed.
