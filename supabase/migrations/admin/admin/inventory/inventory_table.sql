-- =============================================
-- Inventory Table
-- Categories: hardware, juices
-- =============================================

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
  total_profit DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Block all public access (Implicitly allows Service Role/Admin)
-- We do not add any public policies, so only the Service Role key can access this table.
-- This protects inventory data from being exposed publicly.
-- All access is controlled through authenticated backend routes with proper authorization.

