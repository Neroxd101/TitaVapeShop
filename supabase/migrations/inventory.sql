-- =============================================
-- Inventory Table
-- Categories: hardware, juices
-- =============================================

-- Create the update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(20) NOT NULL CHECK (category IN ('hardware', 'juices')),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  qr_image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);

-- =============================================
-- Run this if you already have the table without images column:
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
-- Run this if you already have the table without description column:
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS description TEXT;
-- =============================================
