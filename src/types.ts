/**
 * Majestic Computers ERP Types Definition
 * This matches standard Supabase Schema specifications.
 */

export interface Branch {
  id: string;
  name: string;
  location: string;
  code: string;
  phone: string;
  email: string;
  created_at: string;
}

export type UserRole = 'super_admin' | 'branch_admin' | 'cashier' | 'technician' | 'inventory_manager';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  branch_id?: string; // Null for Super Admin
  avatar?: string;
  active: boolean;
  permissions: string[];
  created_at: string;
  password?: string;
}

export interface Role {
  id: string;
  name: UserRole;
  description: string;
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  description: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category_id: string;
  brand_id: string;
  cost_price: number;
  selling_price: number;
  serial_tracked: boolean;
  created_at: string;
}

// Branch stock mapping
export interface ProductStock {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  min_stock_alert: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  company_name?: string;
  credit_balance: number;
  loyalty_points: number;
  notes?: string;
  created_at: string;
}

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'split';
export type PaymentStatus = 'paid' | 'partially_paid' | 'unpaid';
export type RefundStatus = 'none' | 'fully_refunded' | 'partially_refunded';

export interface SplitPaymentDetail {
  cash: number;
  card: number;
  bank: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  branch_id: string;
  branch_name: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_amount: number;
  split_payment_details?: SplitPaymentDetail;
  refund_status: RefundStatus;
  refunded_amount?: number;
  created_by_name: string;
  created_at: string;
  notes?: string;
  invoice_items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  discount: number; // Item discount
  total: number;
}

export type QuotationStatus = 'draft' | 'pending' | 'accepted' | 'converted' | 'expired' | 'rejected';

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotation_no: string;
  branch_id: string;
  branch_name: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  valid_until: string;
  status: QuotationStatus;
  created_by_name: string;
  created_at: string;
  notes?: string;
  terms_conditions?: string;
  quotation_items?: QuotationItem[];
}

export type RepairStatus = 
  | 'received' 
  | 'diagnosing' 
  | 'waiting_parts' 
  | 'in_repair' 
  | 'completed' 
  | 'delivered' 
  | 'cancelled';

export type WarrantyPeriod = 'none' | '3_months' | '6_months' | '12_months';

export interface RepairJob {
  id: string;
  ticket_no: string;
  branch_id: string;
  branch_name: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  device_type: string; // e.g. Laptop, Deskop, Printer
  brand: string;
  model: string;
  serial_number: string;
  problem_desc: string;
  accessories: string[]; // Received accessories e.g. Charger, Bag, Battery
  technician_id?: string;
  technician_name?: string;
  estimated_cost: number;
  actual_cost: number;
  status: RepairStatus;
  warranty_period: WarrantyPeriod;
  notes?: string;
  signature_data?: string; // SVG or Base64 string representation
  created_at: string;
  updated_at: string;
}

export interface RepairUpdate {
  id: string;
  repair_id: string;
  status: RepairStatus;
  notes: string;
  updated_by_name: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  total_due: number;
  created_at: string;
}

export type PurchaseStatus = 'pending' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  po_no: string;
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  branch_name: string;
  status: PurchaseStatus;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  unit_cost: number;
  quantity: number;
  total: number;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  branch_id: string;
  branch_name: string;
  expense_date: string;
  recorded_by_name: string;
}

export type InventoryLogType = 
  | 'in' 
  | 'out' 
  | 'transfer_out' 
  | 'transfer_in' 
  | 'damaged' 
  | 'return';

export interface InventoryLog {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  branch_id: string;
  branch_name: string;
  quantity: number;
  type: InventoryLogType;
  description: string;
  reference_id?: string; // invoice_id or po_id
  created_at: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  branch_id?: string; // null for general, or specific branch
  read: boolean;
  created_at: string;
}

export interface CompanySetting {
  id: string;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_enabled?: boolean; // VAT / Sales Tax calculation toggle
  tax_rate: number; // e.g. 15 for 15%
  currency_symbol: string; // e.g. "LKR", "$"
  terms_conditions: string;
}

export type Setting = CompanySetting;
export type Repair = RepairJob;

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  branch_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
  reference_no: string;
  recorded_by_name: string;
  created_at: string;
}

export interface CustomerReceipt {
  id: string;
  customer_id: string;
  customer_name: string;
  branch_id: string;
  branch_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
  reference_no: string;
  recorded_by_name: string;
  created_at: string;
}
