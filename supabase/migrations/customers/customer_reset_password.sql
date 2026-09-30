-- Password-reset codes must be isolated from registration and email-change codes.
ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.customer_verification_codes
ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'email_verification';

ALTER TABLE public.customer_verification_codes
DROP CONSTRAINT IF EXISTS customer_verification_codes_purpose_check;

ALTER TABLE public.customer_verification_codes
ADD CONSTRAINT customer_verification_codes_purpose_check
CHECK (purpose IN ('email_verification', 'password_reset'));
