-- =============================================
-- Fix Customer Verification Codes Foreign Key Constraint
-- Drops the obsolete user_id foreign key pointing to users(id)
-- and ensures customer_id points to customers(id).
-- =============================================

-- 1. Drop the old foreign key constraint pointing to users table
ALTER TABLE IF EXISTS public.customer_verification_codes
    DROP CONSTRAINT IF EXISTS customer_verification_codes_user_id_fkey;

-- 2. Ensure customer_id column exists and properly references customers(id)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customer_verification_codes' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.customer_verification_codes 
            ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. If user_id column exists, drop NOT NULL so it never blocks customer OTP operations
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customer_verification_codes' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.customer_verification_codes 
            ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- 4. Rebuild indexes
CREATE INDEX IF NOT EXISTS idx_cust_verify_customer ON public.customer_verification_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_verify_email ON public.customer_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_cust_verify_otp ON public.customer_verification_codes(email, otp_code);
