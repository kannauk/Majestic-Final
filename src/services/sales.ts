import { supabase } from '../lib/supabaseClient';
import { Invoice, InvoiceItem, SplitPaymentDetail } from '../types';

interface SaleData {
  requestId?: string;
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

// In-flight request deduplication map to prevent simultaneous duplicate sales
const activeSalesInFlight = new Map<string, Promise<Invoice>>();
// Completed requests cache to return existing invoice if same requestId submitted again
const completedSalesCache = new Map<string, { invoice: Invoice; timestamp: number }>();

// Clean up completed cache entries older than 5 minutes
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, val] of completedSalesCache.entries()) {
    if (now - val.timestamp > 5 * 60 * 1000) {
      completedSalesCache.delete(key);
    }
  }
};

export async function processSale(sale: SaleData): Promise<Invoice> {
  const idempotencyKey = sale.requestId || `${sale.branchId}_${sale.cashierName}_${Date.now()}`;

  // If already completed recently with same requestId, return cached invoice immediately without re-saving
  if (sale.requestId && completedSalesCache.has(sale.requestId)) {
    const cached = completedSalesCache.get(sale.requestId);
    if (cached) {
      return cached.invoice;
    }
  }

  // If identical request is currently in-flight, return the existing promise to prevent duplicate creation
  if (sale.requestId && activeSalesInFlight.has(sale.requestId)) {
    return activeSalesInFlight.get(sale.requestId)!;
  }

  const executionPromise = (async () => {
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

    // Generate unique invoice number with timestamp + random suffix to prevent collisions
    const uniqueInvoiceNo = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Insert Invoice with resilient schema fallback
    const invoicePayload: Record<string, any> = {
      invoice_no: uniqueInvoiceNo,
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
      payment_status: 'paid',
      paid_amount: sale.paidAmount,
      split_payment_details: sale.splitDetails,
      created_by_name: sale.cashierName,
      notes: sale.notes
    };

    let invoice: any = null;
    
    // First try inserting with status: 'active'
    let { data: insertedInv, error: invError } = await supabase
      .from('invoices')
      .insert({ ...invoicePayload, status: 'active' })
      .select()
      .single();

    if (invError) {
      console.warn('Initial invoice insert with status column failed (table might not have status column yet), attempting fallback:', invError);
      
      // Fallback 1: Try without the status column
      const res1 = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (res1.error) {
        console.warn('Fallback 1 invoice insert failed, attempting stripped payload:', res1.error);
        // Fallback 2: Remove optional newer columns if database schema is legacy
        const strippedPayload = { ...invoicePayload };
        delete strippedPayload.split_payment_details;
        delete strippedPayload.customer_id;
        
        const res2 = await supabase
          .from('invoices')
          .insert(strippedPayload)
          .select()
          .single();

        if (res2.error) {
          throw res2.error;
        }
        insertedInv = res2.data;
      } else {
        insertedInv = res1.data;
      }
    }

    invoice = insertedInv;
    if (invoice && !invoice.status) {
      invoice.status = 'active';
    }

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

    const { data: insertedItems, error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems).select('*');
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

    const completedInvoice: Invoice = {
      ...invoice,
      invoice_items: (insertedItems && insertedItems.length > 0)
        ? insertedItems
        : invoiceItems.map((itm, idx) => ({ id: `itm-${Date.now()}-${idx}`, ...itm }))
    };

    if (sale.requestId) {
      cleanupCache();
      completedSalesCache.set(sale.requestId, { invoice: completedInvoice, timestamp: Date.now() });
    }

    return completedInvoice;
  })();

  if (sale.requestId) {
    activeSalesInFlight.set(sale.requestId, executionPromise);
  }

  try {
    const result = await executionPromise;
    return result;
  } finally {
    if (sale.requestId) {
      activeSalesInFlight.delete(sale.requestId);
    }
  }
}
