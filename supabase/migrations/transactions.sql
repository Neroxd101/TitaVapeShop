-- =============================================
-- Transactions/Activity Log Table
-- Tracks all system activities for auditing
-- =============================================

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction type
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'inventory_add',
    'inventory_edit',
    'inventory_delete',
    'sale_complete',
    'sale_void'
  )),
  
  -- User information (from session)
  user_email VARCHAR(255),
  
  -- Related entity ID (inventory item, sale, etc.)
  entity_id UUID,
  entity_type VARCHAR(50),
  
  -- Transaction details (JSON for flexibility)
  details JSONB DEFAULT '{}'::jsonb,
  
  -- For sales transactions
  sale_total DECIMAL(10, 2),
  sale_items JSONB,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  

  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_action_type ON transactions(action_type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_email ON transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_id ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_email ON transactions(customer_email);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_email, created_at DESC);

-- =============================================
-- Sample queries for reference:
-- =============================================

-- Get all transactions for a specific user
-- SELECT * FROM transactions WHERE user_email = 'user@example.com' ORDER BY created_at DESC;

-- Get all sales transactions
-- SELECT * FROM transactions WHERE action_type = 'sale_complete' ORDER BY created_at DESC;

-- Get total sales for a date range
-- SELECT SUM(sale_total) as total_sales 
-- FROM transactions 
-- WHERE action_type = 'sale_complete' 
-- AND created_at >= '2026-01-01' 
-- AND created_at < '2026-02-01';

-- Get inventory changes for a specific item
-- SELECT * FROM transactions 
-- WHERE entity_id = 'item-uuid-here' 
-- AND action_type IN ('inventory_add', 'inventory_edit', 'inventory_delete')
-- ORDER BY created_at DESC;

-- Get recent activity (last 50 transactions)
-- SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50;
