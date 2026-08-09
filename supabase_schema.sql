-- Majestic Computers ERP - Supabase PostgreSQL Schema

-- Note: Ensure you run this via Supabase SQL Editor.
-- This drops existing tables to cleanly create a fresh schema. Remove DROP statements if not desired.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location TEXT,
  code VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
-- In Supabase, users are typically managed via auth.users, but we can maintain a public users/users table.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Maps to auth.users id
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  avatar TEXT,
  active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '[]'::JSONB,
  password VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  tax_enabled BOOLEAN DEFAULT false,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  currency_symbol VARCHAR(10) DEFAULT 'LKR',
  terms_conditions TEXT
);

-- Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50)
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(255),
  description TEXT,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  cost_price DECIMAL(12, 2) DEFAULT 0,
  selling_price DECIMAL(12, 2) DEFAULT 0,
  serial_tracked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Stocks (Inventory per branch)
CREATE TABLE IF NOT EXISTS product_stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 0,
  UNIQUE(product_id, branch_id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  company_name VARCHAR(255),
  credit_balance DECIMAL(12, 2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no VARCHAR(100) UNIQUE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  tax DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50),
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  split_payment_details JSONB,
  refund_status VARCHAR(50) DEFAULT 'none',
  refunded_amount DECIMAL(12, 2) DEFAULT 0,
  created_by_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  sku VARCHAR(100),
  unit_price DECIMAL(12, 2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  discount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0
);

-- Repairs
CREATE TABLE IF NOT EXISTS repairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_no VARCHAR(100) UNIQUE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  device_type VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  problem_desc TEXT,
  accessories JSONB,
  technician_id UUID,
  technician_name VARCHAR(255),
  estimated_cost DECIMAL(12, 2) DEFAULT 0,
  actual_cost DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'received',
  warranty_period VARCHAR(50) DEFAULT 'none',
  notes TEXT,
  signature_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repair Updates
CREATE TABLE IF NOT EXISTS repair_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID REFERENCES repairs(id) ON DELETE CASCADE,
  status VARCHAR(50),
  notes TEXT,
  updated_by_name VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  total_due DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_no VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  total_amount DECIMAL(12, 2) DEFAULT 0,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  due_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  unit_cost DECIMAL(12, 2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  total DECIMAL(12, 2) DEFAULT 0
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100),
  amount DECIMAL(12, 2) DEFAULT 0,
  description TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recorded_by_name VARCHAR(255)
);

-- Inventory Logs
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  sku VARCHAR(100),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Notifications
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  amount DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  reference_no VARCHAR(100),
  recorded_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Receipts
CREATE TABLE IF NOT EXISTS customer_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  amount DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  reference_no VARCHAR(100),
  recorded_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Sales Quotations & Quotation Items (Latest POS Module Update)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(100) PRIMARY KEY,
  quotation_no VARCHAR(100) UNIQUE NOT NULL,
  branch_id VARCHAR(100),
  branch_name VARCHAR(255),
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  subtotal DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  tax DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  valid_until DATE,
  status VARCHAR(50) DEFAULT 'pending',
  created_by_name VARCHAR(255),
  notes TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id VARCHAR(100) PRIMARY KEY,
  quotation_id VARCHAR(100) REFERENCES quotations(id) ON DELETE CASCADE,
  product_id VARCHAR(100),
  product_name VARCHAR(255),
  sku VARCHAR(100),
  unit_price DECIMAL(12, 2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  discount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_branch ON quotations(branch_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_qid ON quotation_items(quotation_id);

-- Row Level Security (RLS) Policies
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow full access for quotations'
  ) THEN
    CREATE POLICY "Allow full access for quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quotation_items' AND policyname = 'Allow full access for quotation_items'
  ) THEN
    CREATE POLICY "Allow full access for quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- Default Super Admin role and branch can be seeded separately.
