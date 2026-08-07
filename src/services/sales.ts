import { supabase } from '../lib/supabaseClient';
import { Invoice, InvoiceItem, SplitPaymentDetail } from '../types';

interface SaleData {
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  items: { 
    productId: string; 
    productName?: string;
    sku?: string;
    quantity: number; 
    discount: number; 
    sellingPrice: number 
  }[];
  discount: number;
  paymentMethod: string;
  paidAmount: number;
  splitDetails?: SplitPaymentDetail;
  cashierName: string;
  notes?: string;
}

export async function processSale(sale: SaleData): Promise<Invoice> {
  // Calculate subtotal taking into account item-level discounts
  const subtotal = sale.items.reduce((sum, item) => sum + (item.sellingPrice - item.discount) * item.quantity, 0);

  // Fetch branch details
  let branchName = 'Unknown Showroom';
  try {
    const { data: br } = await supabase.from('branches').select('name').eq('id', sale.branchId).single();
    if (br) {
      branchName = br.name;
    }
  } catch (err) {
    console.error('Failed to fetch branch details:', err);
  }

  // Fetch company tax settings
  let taxRate = 0;
  let taxEnabled = false;
  try {
    const { data: settings } = await supabase.from('company_settings').select('tax_rate, tax_enabled').limit(1);
    if (settings && settings.length > 0) {
      taxRate = settings[0].tax_rate || 0;
      taxEnabled = settings[0].tax_enabled !== false;
    }
  } catch (err) {
    console.error('Failed to fetch tax settings:', err);
  }

  const discounted = Math.max(0, subtotal - sale.discount);
  const tax = taxEnabled ? Math.round(discounted * (taxRate / 100)) : 0;
  const total = discounted + tax;

  // 1. Insert Invoice
  const { data: invoice, error: invError } = await supabase.from('invoices').insert({
    invoice_no: `INV-${Date.now()}`,
    branch_id: sale.branchId,
    branch_name: branchName,
    customer_id: sale.customerId,
    customer_name: sale.customerName,
    customer_phone: sale.customerPhone,
    subtotal,
    discount: sale.discount,
    tax,
    total,
    payment_method: sale.paymentMethod,
    paid_amount: sale.paidAmount,
    split_payment_details: sale.splitDetails,
    created_by_name: sale.cashierName,
    notes: sale.notes
  }).select().single();
  if (invError) throw invError;

  // Fetch product details for names and SKUs
  const productIds = sale.items.map(item => item.productId);
  let dbProducts: any[] = [];
  try {
    const { data: prods } = await supabase.from('products').select('id, name, sku').in('id', productIds);
    if (prods) dbProducts = prods;
  } catch (err) {
    console.error('Failed to fetch product names:', err);
  }

  // 2. Insert Invoice Items & Update Stock
  const invoiceItems: Omit<InvoiceItem, 'id'>[] = sale.items.map(item => {
    const matchedProd = dbProducts.find(p => p.id === item.productId);
    return {
      invoice_id: invoice.id,
      product_id: item.productId,
      product_name: item.productName || (matchedProd ? matchedProd.name : 'Unknown Product'),
      sku: item.sku || (matchedProd ? matchedProd.sku : 'Unknown SKU'),
      unit_price: item.sellingPrice,
      quantity: item.quantity,
      discount: item.discount,
      total: (item.sellingPrice - item.discount) * item.quantity
    };
  });

  const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
  if (itemsError) throw itemsError;

  // 3. Update stock (simplified, this should really be a DB function)
  for (const item of sale.items) {
    const { data: stock, error: stockError } = await supabase
      .from('product_stocks')
      .select('quantity')
      .eq('product_id', item.productId)
      .eq('branch_id', sale.branchId)
      .single();
    if (stockError) throw stockError;
    
    await supabase
      .from('product_stocks')
      .update({ quantity: stock.quantity - item.quantity })
      .eq('product_id', item.productId)
      .eq('branch_id', sale.branchId);
  }

  return invoice;
}
