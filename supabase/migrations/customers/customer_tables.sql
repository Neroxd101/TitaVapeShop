-- ==========================================================
-- Customer Tables Schema & Migration
-- Creates dedicated 'customers' and 'customer_verification_codes'
-- ==========================================================

-- 1. Create dedicated customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    contact_number VARCHAR(20) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    birthday DATE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive index for customer email and contact lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_contact ON public.customers(contact_number);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Create customer email verification codes table
CREATE TABLE IF NOT EXISTS public.customer_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_verify_email ON public.customer_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_cust_verify_customer ON public.customer_verification_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_verify_otp ON public.customer_verification_codes(email, otp_code);

-- Enable RLS
ALTER TABLE public.customer_verification_codes ENABLE ROW LEVEL SECURITY;

-- 3. Ensure orders table has customer_id column referencing customers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
