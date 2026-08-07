import { supabase } from '../lib/supabaseClient';
import { SupplierPayment } from '../types';

const STORAGE_KEY = 'majestic_supplier_payments';

export const getSupplierPayments = async (): Promise<SupplierPayment[]> => {
  if (!supabase) {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
  
  try {
    const { data, error } = await supabase
      .from('supplier_payments')
      .select('*');
    
    if (error) {
      console.warn("Supabase table 'supplier_payments' query failed, falling back to localStorage", error);
      const local = localStorage.getItem(STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
    return data || [];
  } catch (err) {
    console.warn("Supplier payments fetch failed, fallback to localStorage", err);
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
};

export const createSupplierPayment = async (payment: Omit<SupplierPayment, 'id' | 'created_at'>): Promise<SupplierPayment> => {
  const newPayment: SupplierPayment = {
    ...payment,
    id: Math.random().toString(36).substring(2, 15),
    created_at: new Date().toISOString()
  };

  // Sync to localStorage
  const localPayments = await getSupplierPayments();
  const updated = [newPayment, ...localPayments];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  if (!supabase) return newPayment;

  try {
    const { data, error } = await supabase
      .from('supplier_payments')
      .insert([payment])
      .select()
      .single();
    
    if (error) {
      console.warn("Supabase supplier_payments insertion failed, using local copy", error);
      return newPayment;
    }
    return data;
  } catch (err) {
    console.warn("Supabase supplier_payments error, using local copy", err);
    return newPayment;
  }
};
