-- =============================================
-- Orders Table
-- Stores customer orders from the catalog
-- =============================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'pickup',
    items JSONB NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add order_type column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'order_type'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) NOT NULL DEFAULT 'pickup';
    END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Drop social_media column if it exists in an existing table
ALTER TABLE orders DROP COLUMN IF EXISTS social_media;

-- Add RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users (admin/staff) to view all orders
DROP POLICY IF EXISTS "Allow authenticated users to view orders" ON orders;
CREATE POLICY "Allow authenticated users to view orders"
    ON orders FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow public to create orders (for catalog)
DROP POLICY IF EXISTS "Allow public to create orders" ON orders;
CREATE POLICY "Allow public to create orders"
    ON orders FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy: Allow authenticated users to update orders
DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON orders;
CREATE POLICY "Allow authenticated users to update orders"
    ON orders FOR UPDATE
    TO authenticated
    USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();
