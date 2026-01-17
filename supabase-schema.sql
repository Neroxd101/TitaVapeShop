-- Create the inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sale_price DECIMAL(10, 2) NOT NULL CHECK (sale_price >= 0),
  costing DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (costing >= 0),
  category TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  qr_code_url TEXT,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

-- Create an index on date_added for faster sorting
CREATE INDEX IF NOT EXISTS idx_inventory_date_added ON inventory(date_added DESC);

-- Create a function to automatically update last_update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_update = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update last_update on row updates
CREATE TRIGGER update_inventory_last_update
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (you can customize this later)
-- For now, this allows anyone with the anon key to read/write
-- You should restrict this based on your authentication needs

-- Policy for SELECT (read)
CREATE POLICY "Allow public read access" ON inventory
  FOR SELECT
  USING (true);

-- Policy for INSERT (create)
CREATE POLICY "Allow public insert access" ON inventory
  FOR INSERT
  WITH CHECK (true);

-- Policy for UPDATE (update)
CREATE POLICY "Allow public update access" ON inventory
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy for DELETE (delete)
CREATE POLICY "Allow public delete access" ON inventory
  FOR DELETE
  USING (true);

-- Migration: Update image_url to image_urls (array)
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Add QR code URL column
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- Migrate existing image_url to image_urls array (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='image_url') THEN
    UPDATE inventory 
    SET image_urls = CASE 
      WHEN image_url IS NOT NULL AND image_url != '' THEN jsonb_build_array(image_url)
      ELSE '[]'::jsonb
    END
    WHERE image_urls IS NULL OR image_urls = '[]'::jsonb;
    
    -- Optionally drop old column after migration
    -- ALTER TABLE inventory DROP COLUMN IF EXISTS image_url;
  END IF;
END $$;
