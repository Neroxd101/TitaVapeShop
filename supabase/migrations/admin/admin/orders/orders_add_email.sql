-- =============================================
-- Add Email Column to Orders Table
-- =============================================

-- Add email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
    END IF;
END $$;

-- Add index for email queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
