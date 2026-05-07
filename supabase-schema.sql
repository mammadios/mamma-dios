-- ============================================
-- MAMMA DIO'S PIZZA - SUPABASE SCHEMA SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MENU ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'pizza',
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default menu items
INSERT INTO menu_items (name, price, category, sort_order) VALUES
  ('Classic Mamma (Pepperoni)', 17.00, 'pizza', 1),
  ('Hot Mamma', 18.00, 'pizza', 2),
  ('Mamma Rossa', 14.00, 'pizza', 3),
  ('Mamma''s Margherita', 16.00, 'pizza', 4),
  ('Mamma''s Margherita + Burrata', 20.00, 'pizza', 5),
  ('Oh Dio Mamma (Nutella)', 12.00, 'dessert', 6),
  ('Truffle Maker', 18.00, 'pizza', 7),
  ('Pop', 1.50, 'drink', 8);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  order_items JSONB NOT NULL DEFAULT '[]',
  special_requests TEXT DEFAULT '',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status values: 'pending', 'in_process', 'ready', 'completed', 'archived'
  in_process BOOLEAN DEFAULT false,
  ready_for_pickup BOOLEAN DEFAULT false,
  returning_customer BOOLEAN DEFAULT false,
  time_started TIMESTAMPTZ,
  time_ready TIMESTAMPTZ,
  total_time_minutes INTEGER,
  sms_sent_start BOOLEAN DEFAULT false,
  sms_sent_ready BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER ARCHIVE TABLE (same structure)
-- ============================================
CREATE TABLE IF NOT EXISTS orders_archive (
  id UUID PRIMARY KEY,
  order_number INTEGER,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  order_items JSONB NOT NULL DEFAULT '[]',
  special_requests TEXT DEFAULT '',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  in_process BOOLEAN DEFAULT false,
  ready_for_pickup BOOLEAN DEFAULT false,
  returning_customer BOOLEAN DEFAULT false,
  time_started TIMESTAMPTZ,
  time_ready TIMESTAMPTZ,
  total_time_minutes INTEGER,
  sms_sent_start BOOLEAN DEFAULT false,
  sms_sent_ready BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETURNING CUSTOMERS TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  visit_count INTEGER DEFAULT 1,
  first_visit TIMESTAMPTZ DEFAULT NOW(),
  last_visit TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate total time when order is ready
CREATE OR REPLACE FUNCTION calculate_total_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.time_ready IS NOT NULL AND NEW.time_started IS NOT NULL AND OLD.time_ready IS NULL THEN
    NEW.total_time_minutes = EXTRACT(EPOCH FROM (NEW.time_ready - NEW.time_started)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_calculate_time
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION calculate_total_time();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users and service role
CREATE POLICY "Enable all for service role" ON orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service role" ON menu_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service role" ON orders_archive
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service role" ON customers
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME (enable for live orders board)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
