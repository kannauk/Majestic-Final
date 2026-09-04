import { supabase } from '../lib/supabaseClient';
import { Invoice } from '../types';

export const getInvoices = async (): Promise<Invoice[]> => {
  if (!supabase) return [];
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*').order('created_at', { ascending: false });
  
  if (error) return [];

  const { data: items } = await supabase.from('invoice_items').select('*');
  
  const data = invoices?.map(inv => ({
    ...inv,
    status: inv.status || (inv.notes?.includes('[VOIDED') ? 'void' : 'active'),
    invoice_items: items?.filter(item => item.invoice_id === inv.id) || []
  })) || [];

  // Reconcile and auto-repair any empty/Unknown item names or SKUs in memory from master product catalog
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku');
    
    if (products && data) {
      const prodMap = new Map((products as any[]).map(p => [p.id, p]));
      data.forEach((inv: any) => {
        if (inv.invoice_items) {
          inv.invoice_items.forEach((item: any) => {
            const prod = prodMap.get(item.product_id);
            if (prod) {
              if (!item.product_name || item.product_name === 'Unknown Product' || item.product_name === 'Unknown') {
                item.product_name = (prod as any).name;
              }
              if (!item.sku || item.sku === 'Unknown SKU' || item.sku === 'Unknown') {
                item.sku = (prod as any).sku;
              }
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Failed to auto-repair missing invoice item names/SKUs:', err);
  }

  return data as Invoice[];
};

export const updateInvoice = async (invoice: Invoice): Promise<Invoice> => {
  const updateData = { ...invoice };
  delete (updateData as any).invoice_items;

  let { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoice.id)
    .select('*')
    .single();

  if (error) {
    console.warn('Update invoice failed with full payload, trying fallback:', error);
    const fallbackData = { ...updateData };
    delete (fallbackData as any).status;
    delete (fallbackData as any).voided_by;
    delete (fallbackData as any).voided_at;
    delete (fallbackData as any).void_reason;
    delete (fallbackData as any).split_payment_details;

    const fbRes = await supabase
      .from('invoices')
      .update(fallbackData)
      .eq('id', invoice.id)
      .select('*')
      .single();

    if (fbRes.error) throw fbRes.error;
    data = { ...fbRes.data, status: invoice.status || 'active' };
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id);

  if (data) {
    (data as any).invoice_items = items || [];
  }

  // Repair nested items if necessary
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku');
    
    if (products && data && data.invoice_items) {
      const prodMap = new Map((products as any[]).map(p => [p.id, p]));
      data.invoice_items.forEach((item: any) => {
        const prod = prodMap.get(item.product_id);
        if (prod) {
          if (!item.product_name || item.product_name === 'Unknown Product' || item.product_name === 'Unknown') {
            item.product_name = (prod as any).name;
          }
          if (!item.sku || item.sku === 'Unknown SKU' || item.sku === 'Unknown') {
            item.sku = (prod as any).sku;
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }

  return data;
};

export const modifyInvoice = async (
  invoiceId: string,
  branchId: string,
  updatedData: {
    customer_name: string;
    customer_phone?: string;
    payment_method: string;
    paid_amount: number;
    discount: number;
    subtotal: number;
    tax: number;
    total: number;
    payment_status: string;
  },
  newItems: {
    product_id: string;
    product_name: string;
    sku: string;
    unit_price: number;
    quantity: number;
    discount: number;
  }[]
): Promise<Invoice> => {
  if (!supabase) {
    return {
      id: invoiceId,
      invoice_no: 'MOCK-INV',
      branch_id: branchId,
      branch_name: 'Mock Branch',
      customer_name: updatedData.customer_name,
      customer_phone: updatedData.customer_phone,
      subtotal: updatedData.subtotal,
      discount: updatedData.discount,
      tax: updatedData.tax,
      total: updatedData.total,
      payment_method: updatedData.payment_method as any,
      payment_status: updatedData.payment_status as any,
      paid_amount: updatedData.paid_amount,
      refund_status: 'none',
      created_by_name: 'Admin',
      created_at: new Date().toISOString(),
      invoice_items: newItems.map((itm, index) => ({
        id: `itm-${index}`,
        invoice_id: invoiceId,
        ...itm,
        total: (itm.unit_price - itm.discount) * itm.quantity
      }))
    };
  }

  // 1. Fetch original items to revert stock
  const { data: originalItems, error: fetchErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);
  
  if (fetchErr) throw fetchErr;

  // 2. Revert stock for original items
  if (originalItems && originalItems.length > 0) {
    for (const item of originalItems) {
      const { data: stock } = await supabase
        .from('product_stocks')
        .select('quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', branchId)
        .maybeSingle();
      
      if (stock) {
        await supabase
          .from('product_stocks')
          .update({ quantity: stock.quantity + Number(item.quantity) })
          .eq('product_id', item.product_id)
          .eq('branch_id', branchId);
      }
    }
  }

  // 3. Delete existing invoice items
  const { error: deleteErr } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId);
  
  if (deleteErr) throw deleteErr;

  // 4. Update the invoice record
  const { data: updatedInvoice, error: updateErr } = await supabase
    .from('invoices')
    .update({
      customer_name: updatedData.customer_name,
      customer_phone: updatedData.customer_phone,
      payment_method: updatedData.payment_method,
      paid_amount: updatedData.paid_amount,
      discount: updatedData.discount,
      subtotal: updatedData.subtotal,
      tax: updatedData.tax,
      total: updatedData.total,
      payment_status: updatedData.payment_status
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  // 5. Insert the new items
  const invoiceItemsToInsert = newItems.map(item => ({
    invoice_id: invoiceId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    unit_price: item.unit_price,
    quantity: item.quantity,
    discount: item.discount,
    total: (item.unit_price - item.discount) * item.quantity
  }));

  const { error: insertErr } = await supabase
    .from('invoice_items')
    .insert(invoiceItemsToInsert);
  
  if (insertErr) throw insertErr;

  // 6. Deduct stock for new items
  for (const item of newItems) {
    const { data: stock } = await supabase
      .from('product_stocks')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', branchId)
      .maybeSingle();
    
    if (stock) {
      await supabase
        .from('product_stocks')
        .update({ quantity: stock.quantity - Number(item.quantity) })
        .eq('product_id', item.product_id)
        .eq('branch_id', branchId);
    }
  }

  // 7. Return the fully updated invoice with nested items
  const { data: finalInvoice, error: finalErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();
  
  if (finalErr) throw finalErr;

  const { data: finalItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);
  
  if (finalInvoice) {
    (finalInvoice as any).invoice_items = finalItems || [];
  }

  // Repair nested items if necessary
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku');
    
    if (products && finalInvoice && finalInvoice.invoice_items) {
      const prodMap = new Map((products as any[]).map(p => [p.id, p]));
      finalInvoice.invoice_items.forEach((item: any) => {
        const prod = prodMap.get(item.product_id);
        if (prod) {
          if (!item.product_name || item.product_name === 'Unknown Product' || item.product_name === 'Unknown') {
            item.product_name = (prod as any).name;
          }
          if (!item.sku || item.sku === 'Unknown SKU' || item.sku === 'Unknown') {
            item.sku = (prod as any).sku;
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }

  return finalInvoice;
};

export const processSalesReturn = async (
  invoiceId: string,
  branchId: string,
  returnItems: {
    item_id: string;
    product_id: string;
    product_name: string;
    return_qty: number;
  }[],
  refundAmount: number,
  companyTaxRate: number,
  companyTaxEnabled: boolean
): Promise<Invoice> => {
  if (!supabase) {
    // Offline/Mock mode fallback
    return {
      id: invoiceId,
      invoice_no: 'MOCK-INV',
      branch_id: branchId,
      branch_name: 'Mock Branch',
      customer_name: 'Mock Client',
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      payment_method: 'cash',
      payment_status: 'paid',
      paid_amount: 0,
      refund_status: 'partially_refunded',
      refunded_amount: refundAmount,
      created_by_name: 'Admin',
      created_at: new Date().toISOString(),
      invoice_items: []
    };
  }

  // 1. Fetch original invoice items and invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invErr) throw invErr;
  if (!invoice) throw new Error('Invoice not found.');

  const { data: invItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);
    
  invoice.invoice_items = invItems || [];

  const items = invoice.invoice_items || [];

  // 2. Process stock replenishment and update invoice item quantities
  let totalReturnedQty = 0;
  for (const ret of returnItems) {
    if (ret.return_qty <= 0) continue;
    totalReturnedQty += ret.return_qty;

    // Find the original item
    const origItem = items.find((itm: any) => itm.id === ret.item_id);
    if (!origItem) continue;

    // Prevent returning more than original quantity
    const finalQty = Math.max(0, origItem.quantity - ret.return_qty);

    // Update item quantity in invoice_items
    const { error: itemUpdateErr } = await supabase
      .from('invoice_items')
      .update({
        quantity: finalQty,
        total: (origItem.unit_price - origItem.discount) * finalQty
      })
      .eq('id', ret.item_id);

    if (itemUpdateErr) throw itemUpdateErr;

    // Replenish stock in product_stocks
    const { data: stock } = await supabase
      .from('product_stocks')
      .select('quantity')
      .eq('product_id', ret.product_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (stock) {
      await supabase
        .from('product_stocks')
        .update({ quantity: stock.quantity + ret.return_qty })
        .eq('product_id', ret.product_id)
        .eq('branch_id', branchId);
    }

    // Fetch actual SKU and Name from the products table to be absolutely sure we don't save "unknown"
    let dbProdName = ret.product_name;
    let dbSku = '';
    try {
      const { data: prodData } = await supabase
        .from('products')
        .select('name, sku')
        .eq('id', ret.product_id)
        .maybeSingle();
      if (prodData) {
        dbProdName = prodData.name;
        dbSku = prodData.sku;
      }
    } catch (e) {
      console.error('Failed to fetch product details for return log:', e);
    }

    // Fetch branch name to log it properly
    let dbBranchName = '';
    try {
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .maybeSingle();
      if (branchData) {
        dbBranchName = branchData.name;
      }
    } catch (e) {
      console.error('Failed to fetch branch details for return log:', e);
    }

    // Create an inventory log for the return
    await supabase.from('inventory_logs').insert({
      product_id: ret.product_id,
      product_name: dbProdName || 'Unknown Product',
      sku: dbSku || 'Unknown SKU',
      branch_id: branchId,
      branch_name: dbBranchName || 'Showroom',
      quantity: ret.return_qty,
      type: 'return',
      description: `Sales Return from Invoice #${invoice.invoice_no}`
    });
  }

  if (totalReturnedQty === 0) {
    throw new Error('No items returned.');
  }

  // 3. Fetch newly updated items of the invoice to recalculate invoice totals
  const { data: updatedItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  if (itemsErr) throw itemsErr;

  const newSubtotal = (updatedItems || []).reduce((sum, item) => sum + Number(item.total), 0);
  const discounted = Math.max(0, newSubtotal - Number(invoice.discount));
  const taxRate = companyTaxRate || 0;
  const taxEnabled = companyTaxEnabled !== false;
  const newTax = taxEnabled ? Math.round(discounted * (taxRate / 100)) : 0;
  const newTotal = discounted + newTax;

  const allReturned = (updatedItems || []).every(item => Number(item.quantity) === 0);
  const refundStatus = allReturned ? 'fully_refunded' : 'partially_refunded';
  const newRefundedAmount = Number(invoice.refunded_amount || 0) + refundAmount;

  // 4. Update the invoice
  const { error: invUpdateErr } = await supabase
    .from('invoices')
    .update({
      subtotal: newSubtotal,
      tax: newTax,
      total: newTotal,
      refund_status: refundStatus,
      refunded_amount: newRefundedAmount,
      payment_status: allReturned ? 'unpaid' : invoice.payment_status
    })
    .eq('id', invoiceId);

  if (invUpdateErr) throw invUpdateErr;

  // 5. Fetch and return final invoice with nested items
  const { data: finalInvoice, error: finalErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (finalErr) throw finalErr;

  const { data: finalItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);
    
  if (finalInvoice) {
    (finalInvoice as any).invoice_items = finalItems || [];
  }

  // Repair nested items if necessary
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku');

    if (products && finalInvoice && finalInvoice.invoice_items) {
      const prodMap = new Map((products as any[]).map(p => [p.id, p]));
      finalInvoice.invoice_items.forEach((item: any) => {
        const prod = prodMap.get(item.product_id);
        if (prod) {
          if (!item.product_name || item.product_name === 'Unknown Product' || item.product_name === 'Unknown') {
            item.product_name = (prod as any).name;
          }
          if (!item.sku || item.sku === 'Unknown SKU' || item.sku === 'Unknown') {
            item.sku = (prod as any).sku;
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
  }

  return finalInvoice;
};

// Helper to check if user has admin privileges across any role formatting
export const isUserAdmin = (userOrRole?: any): boolean => {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'string') {
    const r = userOrRole.toLowerCase().trim();
    return r === 'super_admin' || r === 'branch_admin' || r === 'admin' || r === 'superadmin' || r.includes('admin') || r === 'owner' || r === 'manager';
  }
  const role = (userOrRole.role || '').toLowerCase().trim();
  const perms = Array.isArray(userOrRole.permissions) ? userOrRole.permissions : [];
  return (
    role === 'super_admin' ||
    role === 'branch_admin' ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'administrator' ||
    role === 'owner' ||
    role === 'manager' ||
    role.includes('admin') ||
    perms.includes('all') ||
    perms.includes('manage_all') ||
    perms.includes('invoices_manage') ||
    perms.includes('invoices_delete')
  );
};

// In-flight tracking to prevent simultaneous duplicate void actions on the same invoice
const activeVoidsInFlight = new Set<string>();

export const voidSalesInvoice = async (
  invoiceId: string,
  adminUser: { id?: string; name: string; role?: string; permissions?: string[] },
  reason: string
): Promise<Invoice> => {
  // 1. Role Authorization Check (Backend/Service level enforcement)
  if (!isUserAdmin(adminUser)) {
    throw new Error('Access Denied: Only Admin users (Super Admin / Branch Admin) can delete or void sales invoices.');
  }

  const finalReason = reason?.trim() || 'Administrative void and stock restoration';

  // 2. Concurrency lock to prevent duplicate double-click void requests
  if (activeVoidsInFlight.has(invoiceId)) {
    throw new Error('Invoice void operation already in progress. Please wait.');
  }
  activeVoidsInFlight.add(invoiceId);

  try {
    if (!supabase) {
      throw new Error('Database connection is offline.');
    }

    // 3. Fetch invoice and verify it is currently ACTIVE
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      throw new Error('Sales invoice record not found.');
    }

    if (invoice.status === 'void' || invoice.status === 'deleted') {
      throw new Error(`Invoice #${invoice.invoice_no} has already been voided. Stock cannot be restored twice.`);
    }

    // 4. Fetch invoice items to calculate restoration amounts
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (itemsErr) throw itemsErr;

    const branchId = invoice.branch_id;

    // 5. Restore stock for each sold item exactly once
    if (items && items.length > 0 && branchId) {
      for (const item of items) {
        if (!item.product_id || Number(item.quantity) <= 0) continue;

        // Fetch current stock
        const { data: stock } = await supabase
          .from('product_stocks')
          .select('quantity')
          .eq('product_id', item.product_id)
          .eq('branch_id', branchId)
          .maybeSingle();

        if (stock) {
          const newQty = Number(stock.quantity) + Number(item.quantity);
          await supabase
            .from('product_stocks')
            .update({ quantity: newQty })
            .eq('product_id', item.product_id)
            .eq('branch_id', branchId);
        }

        // Fetch product names/sku if needed for inventory log
        let prodName = item.product_name;
        let prodSku = item.sku;
        if (!prodName || prodName === 'Unknown Product') {
          try {
            const { data: p } = await supabase.from('products').select('name, sku').eq('id', item.product_id).maybeSingle();
            if (p) {
              prodName = p.name;
              prodSku = p.sku;
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Insert inventory audit log
        try {
          await supabase.from('inventory_logs').insert({
            product_id: item.product_id,
            product_name: prodName || 'Product',
            sku: prodSku || '',
            branch_id: branchId,
            branch_name: invoice.branch_name || 'Showroom',
            quantity: Number(item.quantity),
            type: 'restock',
            description: `Stock restored from Voided Invoice #${invoice.invoice_no} by ${adminUser.name}. Reason: ${finalReason}`
          });
        } catch (logErr) {
          console.error('Inventory log error during void:', logErr);
        }
      }
    }

    // 6. Atomically mark the invoice as VOID
    const voidTime = new Date().toISOString();
    const updatedNotes = invoice.notes 
      ? `${invoice.notes}\n[VOIDED by ${adminUser.name} on ${new Date().toLocaleDateString()}: ${finalReason}]`
      : `[VOIDED by ${adminUser.name} on ${new Date().toLocaleDateString()}: ${finalReason}]`;

    let updatedInvoice: any = null;

    const { data: resInvoice, error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'void',
        payment_status: 'unpaid',
        voided_by: adminUser.name,
        voided_at: voidTime,
        void_reason: finalReason,
        notes: updatedNotes
      })
      .eq('id', invoiceId)
      .select('*')
      .single();

    if (updateErr) {
      console.warn('Void update with full status columns failed, retrying with standard columns:', updateErr);
      const { data: fallbackInvoice, error: fbErr } = await supabase
        .from('invoices')
        .update({
          payment_status: 'unpaid',
          notes: updatedNotes
        })
        .eq('id', invoiceId)
        .select('*')
        .single();

      if (fbErr) throw fbErr;
      updatedInvoice = {
        ...fallbackInvoice,
        status: 'void',
        voided_by: adminUser.name,
        voided_at: voidTime,
        void_reason: finalReason
      };
    } else {
      updatedInvoice = resInvoice;
    }

    const completed: Invoice = {
      ...updatedInvoice,
      invoice_items: items || []
    };

    return completed;
  } finally {
    activeVoidsInFlight.delete(invoiceId);
  }
};

export const permanentlyDeleteSalesInvoice = async (
  invoiceId: string,
  adminUser: { id?: string; name: string; role?: string; permissions?: string[] }
): Promise<void> => {
  if (!isUserAdmin(adminUser)) {
    throw new Error('Access Denied: Only Admin users can permanently delete sales invoices.');
  }

  if (!supabase) {
    throw new Error('Database connection is offline.');
  }

  // 1. Fetch invoice to check if we should restore stock
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoice) {
    // If not already voided, restore stock before deleting permanently
    if (invoice.status !== 'void' && invoice.status !== 'deleted') {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      const branchId = invoice.branch_id;
      if (items && items.length > 0 && branchId) {
        for (const item of items) {
          if (!item.product_id || Number(item.quantity) <= 0) continue;
          const { data: stock } = await supabase
            .from('product_stocks')
            .select('quantity')
            .eq('product_id', item.product_id)
            .eq('branch_id', branchId)
            .maybeSingle();

          if (stock) {
            await supabase
              .from('product_stocks')
              .update({ quantity: Number(stock.quantity) + Number(item.quantity) })
              .eq('product_id', item.product_id)
              .eq('branch_id', branchId);
          }
        }
      }
    }
  }

  // 2. Delete invoice items
  await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId);

  // 3. Delete invoice
  const { error: delErr } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId);

  if (delErr) {
    throw delErr;
  }
};

export const deleteSalesInvoice = voidSalesInvoice;


