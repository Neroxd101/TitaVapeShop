-- =============================================
-- Inventory Table
-- Categories: hardware, juices
-- =============================================

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(20) NOT NULL CHECK (category IN ('hardware', 'juices')),
  name VARCHAR(100) NOT NULL,
  variations JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  qr_image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  total_profit DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Normalize variation storage for both fresh and existing databases.
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS variations JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'variation'
  ) THEN
    EXECUTE $migration$
      UPDATE public.inventory
      SET variations = jsonb_build_array(jsonb_build_object('name', variation, 'quantity', quantity))
      WHERE (variations IS NULL OR jsonb_array_length(variations) = 0)
        AND variation IS NOT NULL
        AND btrim(variation) <> ''
    $migration$;
    ALTER TABLE public.inventory DROP COLUMN variation;
  END IF;
END $$;
-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Block all public access (Implicitly allows Service Role/Admin)
-- We do not add any public policies, so only the Service Role key can access this table.
-- This protects inventory data from being exposed publicly.
-- All access is controlled through authenticated backend routes with proper authorization.

