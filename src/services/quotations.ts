import { supabase } from '../lib/supabaseClient';
import { Quotation, QuotationItem } from '../types';

const LOCAL_STORAGE_KEY = 'majestic_erp_quotations';

const sampleQuotations: Quotation[] = [
  {
    id: 'qtn-001',
    quotation_no: 'QTN-202608-0001',
    branch_id: 'b-colombo',
    branch_name: 'Colombo HQ Showroom',
    customer_id: 'cust-01',
    customer_name: 'Kasun Perera',
    customer_phone: '0771234567',
    customer_email: 'kasun.perera@gmail.com',
    subtotal: 395000,
    discount: 5000,
    tax: 0,
    total: 390000,
    valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: 'pending',
    created_by_name: 'Showroom Admin',
    created_at: new Date().toISOString(),
    notes: 'Quotation for Enterprise Asus ROG Strix Workstation setup with high-speed SSD upgrade.',
    terms_conditions: '1. Prices are valid for 14 days from quotation date.\n2. 1-Year Comprehensive Hardware Warranty.\n3. Goods subject to stock availability upon confirmation.',
    quotation_items: [
      {
        id: 'qi-1',
        quotation_id: 'qtn-001',
        product_id: 'prod-01',
        product_name: 'Asus ROG Strix G16 (i7-13650HX, 16GB, RTX 4060)',
        sku: 'ASUS-ROG-G16',
        unit_price: 360000,
        quantity: 1,
        discount: 5000,
        total: 355000
      },
      {
        id: 'qi-2',
        quotation_id: 'qtn-001',
        product_id: 'prod-02',
        product_name: 'Samsung 990 Pro 1TB NVMe Gen4 SSD',
        sku: 'SAM-990-1TB',
        unit_price: 35000,
        quantity: 1,
        discount: 0,
        total: 35000
      }
    ]
  }
];

// Helper to get local data
function getLocalQuotations(): Quotation[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to read quotations from localStorage:', e);
  }
  return sampleQuotations;
}

// Helper to save local data
function saveLocalQuotations(quotes: Quotation[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Failed to save quotations to localStorage:', e);
  }
}

export async function getQuotations(): Promise<Quotation[]> {
  if (supabase) {
    try {
      const { data: quotes, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && quotes && quotes.length > 0) {
        const { data: items } = await supabase.from('quotation_items').select('*');
        const enriched = quotes.map(q => ({
          ...q,
          quotation_items: items?.filter(item => item.quotation_id === q.id) || []
        }));
        saveLocalQuotations(enriched);
        return enriched as Quotation[];
      }
    } catch (err) {
      console.warn('Supabase quotation query failed, fallback to local storage:', err);
    }
  }
  return getLocalQuotations();
}

export interface CreateQuotationInput {
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
  valid_until?: string;
  created_by_name: string;
  notes?: string;
  terms_conditions?: string;
  items: {
    product_id: string;
    product_name: string;
    sku: string;
    unit_price: number;
    quantity: number;
    discount: number;
  }[];
}

export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
  const timestamp = Date.now();
  const dateCode = new Date().toISOString().slice(0, 7).replace('-', '');
  const randSeq = String(Math.floor(1000 + Math.random() * 9000));
  const quotationNo = `QTN-${dateCode}-${randSeq}`;
  const quotationId = `qtn-${timestamp}`;

  const defaultValidUntil = new Date(timestamp + 14 * 86400000).toISOString().split('T')[0];

  const newQuote: Quotation = {
    id: quotationId,
    quotation_no: quotationNo,
    branch_id: input.branch_id,
    branch_name: input.branch_name,
    customer_id: input.customer_id,
    customer_name: input.customer_name || 'Valued Customer',
    customer_phone: input.customer_phone,
    customer_email: input.customer_email,
    subtotal: input.subtotal,
    discount: input.discount,
    tax: input.tax,
    total: input.total,
    valid_until: input.valid_until || defaultValidUntil,
    status: 'pending',
    created_by_name: input.created_by_name,
    created_at: new Date().toISOString(),
    notes: input.notes || '',
    terms_conditions: input.terms_conditions || '1. Prices are valid for 14 days from date of quote.\n2. Official distributor hardware warranty applies.\n3. Payment by Cash / Bank Transfer / Card upon acceptance.',
    quotation_items: input.items.map((item, idx) => ({
      id: `qi-${timestamp}-${idx}`,
      quotation_id: quotationId,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      unit_price: item.unit_price,
      quantity: item.quantity,
      discount: item.discount,
      total: (item.unit_price - item.discount) * item.quantity
    }))
  };

  // Try saving to Supabase if available
  if (supabase) {
    try {
      const { data: insertedQuote, error: quoteErr } = await supabase
        .from('quotations')
        .insert({
          id: newQuote.id,
          quotation_no: newQuote.quotation_no,
          branch_id: newQuote.branch_id,
          branch_name: newQuote.branch_name,
          customer_id: newQuote.customer_id,
          customer_name: newQuote.customer_name,
          customer_phone: newQuote.customer_phone,
          customer_email: newQuote.customer_email,
          subtotal: newQuote.subtotal,
          discount: newQuote.discount,
          tax: newQuote.tax,
          total: newQuote.total,
          valid_until: newQuote.valid_until,
          status: newQuote.status,
          created_by_name: newQuote.created_by_name,
          notes: newQuote.notes,
          terms_conditions: newQuote.terms_conditions
        })
        .select()
        .single();

      if (!quoteErr && insertedQuote) {
        if (newQuote.quotation_items && newQuote.quotation_items.length > 0) {
          await supabase.from('quotation_items').insert(
            newQuote.quotation_items.map(it => ({
              quotation_id: insertedQuote.id,
              product_id: it.product_id,
              product_name: it.product_name,
              sku: it.sku,
              unit_price: it.unit_price,
              quantity: it.quantity,
              discount: it.discount,
              total: it.total
            }))
          );
        }
      }
    } catch (e) {
      console.warn('Failed to insert into Supabase, maintaining local storage:', e);
    }
  }

  // Update local storage
  const current = getLocalQuotations();
  const updated = [newQuote, ...current];
  saveLocalQuotations(updated);

  return newQuote;
}

export async function updateQuotation(quotation: Quotation): Promise<Quotation> {
  if (supabase) {
    try {
      const copy = { ...quotation };
      delete (copy as any).quotation_items;
      await supabase.from('quotations').update(copy).eq('id', quotation.id);
    } catch (e) {
      console.warn('Supabase update failed:', e);
    }
  }

  const current = getLocalQuotations();
  const updated = current.map(q => (q.id === quotation.id ? quotation : q));
  saveLocalQuotations(updated);
  return quotation;
}

export async function updateQuotationStatus(id: string, status: Quotation['status']): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('quotations').update({ status }).eq('id', id);
    } catch (e) {
      console.warn('Supabase update failed:', e);
    }
  }

  const current = getLocalQuotations();
  const updated = current.map(q => (q.id === id ? { ...q, status } : q));
  saveLocalQuotations(updated);
}

export async function deleteQuotation(id: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('quotation_items').delete().eq('quotation_id', id);
      await supabase.from('quotations').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete failed:', e);
    }
  }

  const current = getLocalQuotations();
  const updated = current.filter(q => q.id !== id);
  saveLocalQuotations(updated);
}
