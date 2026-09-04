import { useState } from 'react';
import { Database, Check, Clipboard, Shield, Info, Lightbulb } from 'lucide-react';

export default function SQLSetup() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schema' | 'rls' | 'seeds'>('schema');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const schemaSql = `
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
  status VARCHAR(50) DEFAULT 'active',
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  split_payment_details JSONB,
  refund_status VARCHAR(50) DEFAULT 'none',
  refunded_amount DECIMAL(12, 2) DEFAULT 0,
  voided_by VARCHAR(255),
  voided_at TIMESTAMP WITH TIME ZONE,
  void_reason TEXT,
  created_by_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrations for existing databases:
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_by VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS split_payment_details JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'none';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(12, 2) DEFAULT 0;

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

-- Supplier Payments Ledger
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  amount DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(100),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  reference_no VARCHAR(100),
  recorded_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Receipts Ledger
CREATE TABLE IF NOT EXISTS customer_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  amount DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(100),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  reference_no VARCHAR(100),
  recorded_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Default Super Admin role and branch can be seeded separately.

`;

  const rlsSql = `-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR BRANCH DATA ISOLATION
-- ==========================================

-- Enable Row Level Security on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Dynamic function to determine user’s branch and check if super_admin
CREATE OR REPLACE FUNCTION get_user_branch_and_role()
RETURNS TABLE (user_branch_id UUID, user_role VARCHAR) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY 
  SELECT branch_id, role::VARCHAR 
  FROM users 
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql;

-- 1. BRANCHES POLICIES
CREATE POLICY "Super Admins can do all on branches" 
ON branches FOR ALL 
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Branch staff can read active branches" 
ON branches FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. USER PROFILES POLICIES
CREATE POLICY "Allow users to read users in their own branch" 
ON users FOR SELECT 
USING (
  role = 'super_admin' OR 
  branch_id = (SELECT branch_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Super admins can manage all users" 
ON users FOR ALL 
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- 3. PRODUCT CATALOG POLICIES (Read-all, only stock manager/admins write)
CREATE POLICY "Anyone authenticated can view products catalog"
ON products FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Inventory managers and Admins can write products"
ON products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('super_admin', 'branch_admin', 'inventory_manager')
  )
);

-- 4. BRANCH INVENTORY STOCKS POLICIES (Branch Data Isolation)
CREATE POLICY "Isolate stock viewing by branch"
ON product_stocks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND (role = 'super_admin' OR branch_id = product_stocks.branch_id)
  )
);

CREATE POLICY "Isolate stock updates by branch for permitted staff"
ON product_stocks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (role = 'super_admin' OR (branch_id = product_stocks.branch_id AND role IN ('branch_admin', 'inventory_manager', 'cashier')))
  )
);

-- 5. EXTREME ISOLATION FOR FINANCIALS / INVOICES (RBAC + Branch Isolation)
CREATE POLICY "Isolate invoice view by branch"
ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND (role = 'super_admin' OR branch_id = invoices.branch_id)
  )
);

CREATE POLICY "Only Cashier and Admins can issue invoices in their branch"
ON invoices FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (role = 'super_admin' OR (branch_id = invoices.branch_id AND role IN ('branch_admin', 'cashier')))
  )
);

-- 6. REPAIR TICKETS TRACKING POLICIES (Branch Isolated)
CREATE POLICY "Only branch technicians or admins view branch repairs"
ON repairs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND (role = 'super_admin' OR branch_id = repairs.branch_id)
  )
);

CREATE POLICY "Create or update repairs inside own branch"
ON repairs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (role = 'super_admin' OR (branch_id = repairs.branch_id AND role IN ('branch_admin', 'technician')))
  )
);
`;

  const seedSql = `-- ==========================================
-- HIGH-FIDELITY SAMPLE SEED DATA
-- ==========================================

-- Populate branches
INSERT INTO branches (id, name, location, code, phone, email) VALUES
('b0000000-0000-0000-0000-000000000001', 'Colombo Branch (HQ)', 'No. 45, Galle Road, Colombo 03', 'COL-01', '+94 11 234 5678', 'colombo@majestic.com'),
('b0000000-0000-0000-0000-000000000002', 'Kandy Branch', 'No. 120, Dalada Veediya, Kandy', 'KAN-02', '+94 81 222 3456', 'kandy@majestic.com'),
('b0000000-0000-0000-0000-000000000003', 'Jaffna Branch', 'No. 88, Hospital Road, Jaffna', 'JAF-03', '+94 21 222 7890', 'jaffna@majestic.com'),
('b0000000-0000-0000-0000-000000000004', 'Galle Branch', 'No. 32, Colombo Road, Galle', 'GAL-04', '+94 91 222 1122', 'galle@majestic.com');

-- Populate catalog categories
INSERT INTO product_categories (id, name, code) VALUES
('c0000000-0000-0000-0000-000000000001', 'Laptops', 'LPT'),
('c0000000-0000-0000-0000-000000000002', 'Storage (SSDs)', 'STG'),
('c0000000-0000-0000-0000-000000000003', 'Memory (RAM)', 'RAM'),
('c0000000-0000-0000-0000-000000000004', 'Mobile Phones', 'MOB');

-- Populate brands
INSERT INTO brands (id, name) VALUES
('d0000000-0000-0000-0000-000000000001', 'ASUS'),
('d0000000-0000-0000-0000-000000000002', 'Samsung'),
('d0000000-0000-0000-0000-000000000003', 'Corsair'),
('d0000000-0000-0000-0000-000000000004', 'Apple'),
('d0000000-0000-0000-0000-000000000005', 'Xiaomi'),
('d0000000-0000-0000-0000-000000000006', 'Oppo'),
('d0000000-0000-0000-0000-000000000007', 'Vivo');

-- Populate products
INSERT INTO products (id, name, sku, barcode, description, category_id, brand_id, cost_price, selling_price, serial_tracked) VALUES
('p0000000-0000-0000-0000-000000000001', 'Asus ROG Zephyrus G14 Gaming Laptop', 'ASUS-ROG-G14-01', '889349120491', 'AMD Ryzen 9, 16GB DDR5, 1TB SSD', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 360000.00, 445000.00, true),
('p0000000-0000-0000-0000-000000000002', 'Samsung 980 Pro 1TB NVMe PCIe SSD', 'SAM-980PRO-1T', '887276451551', 'High Speed Gen4 NVMe Solid State Drive', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 28000.00, 36000.00, true);

-- Add initial stock records per branch
INSERT INTO product_stocks (product_id, branch_id, quantity, min_stock_alert) VALUES
('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 10, 3),
('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 4, 2),
('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 25, 5);

-- Customer seed
INSERT INTO customers (id, name, phone, email, credit_balance, loyalty_points) VALUES
('c0000000-0000-0000-0000-000000000010', 'Kumar Sangakkara', '+94 77 123 4567', 'kumar@sanga.lk', 0.00, 100);
`;

  return (
    <div className="space-y-6" id="sql-setup-root">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Supabase PostgreSQL Setup Manager
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Copy and paste this production-ready database schema, security levels (RLS) and dummy seed blocks directly into your Supabase SQL editor.
          </p>
        </div>
        <div className="flex bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'schema'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Database Schema
          </button>
          <button
            onClick={() => setActiveTab('rls')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'rls'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            RLS Isolation Rules
          </button>
          <button
            onClick={() => setActiveTab('seeds')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'seeds'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Sample Seed Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-950 shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
              <span className="font-mono text-xs text-zinc-400">
                {activeTab === 'schema' && 'setup_schema.sql'}
                {activeTab === 'rls' && 'row_level_security.sql'}
                {activeTab === 'seeds' && 'seed_records.sql'}
              </span>
              <button
                onClick={() => {
                  const sql = activeTab === 'schema' ? schemaSql : activeTab === 'rls' ? rlsSql : seedSql;
                  copyToClipboard(sql, activeTab);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white font-mono text-xs transition-colors"
              >
                {copied === activeTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    Copied SQL!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    Copy SQL Code
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-zinc-300 h-[500px]">
              {activeTab === 'schema' && schemaSql}
              {activeTab === 'rls' && rlsSql}
              {activeTab === 'seeds' && seedSql}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              Role Based Security (RLS)
            </h3>
            <p className="text-xs leading-relaxed text-indigo-700">
              We leverage Supabase's Native Row Level Security so branch offices do not see other branch records accidentally.
            </p>
            <ul className="text-xs list-disc pl-4 space-y-1 text-indigo-800">
              <li><strong>Branch Administrators</strong> can access and change local state records.</li>
              <li><strong>Cashiers / Techs</strong> are isolated within their own registered branch.</li>
              <li><strong>Super Admins</strong> bypass branch whereclause limits.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              Supabase Integrations
            </h3>
            <p className="text-xs leading-relaxed text-zinc-600">
              How to go live with your Supabase credentials:
            </p>
            <ol className="text-xs list-decimal pl-4 space-y-1 text-zinc-700">
              <li>Deploy this schema in the Supabase SQL lab.</li>
              <li><strong className="text-red-600">IMPORTANT: DO NOT enable RLS</strong> (Row Level Security) for this demo, as it uses a custom frontend auth system instead of Supabase Auth. Leave RLS disabled on all tables.</li>
              <li>Connect using <code className="bg-zinc-200 px-1 rounded">@supabase/supabase-js</code> with matching environment secret credentials.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
