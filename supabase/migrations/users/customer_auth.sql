-- =============================================
-- Customer Authentication & Verification Schema
-- Supports customer accounts, email verification OTP, and order linking
-- =============================================

-- 1. Add customer columns to users table if they do not already exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN full_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'contact_number'
    ) THEN
        ALTER TABLE public.users ADD COLUMN contact_number VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN email_verified_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Create customer email verification codes table
CREATE TABLE IF NOT EXISTS public.customer_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_verify_email ON public.customer_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_cust_verify_user ON public.customer_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_cust_verify_otp ON public.customer_verification_codes(email, otp_code);

-- Enable RLS
ALTER TABLE public.customer_verification_codes ENABLE ROW LEVEL SECURITY;

-- 3. Add customer_id reference to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
