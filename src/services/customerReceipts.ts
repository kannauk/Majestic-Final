import { supabase } from '../lib/supabaseClient';
import { CustomerReceipt } from '../types';

const STORAGE_KEY = 'majestic_customer_receipts';

export const getCustomerReceipts = async (): Promise<CustomerReceipt[]> => {
  if (!supabase) {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
  
  try {
    const { data, error } = await supabase
      .from('customer_receipts')
      .select('*');
    
    if (error) {
      console.warn("Supabase table 'customer_receipts' query failed, falling back to localStorage", error);
      const local = localStorage.getItem(STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
    return data || [];
  } catch (err) {
    console.warn("Customer receipts fetch failed, fallback to localStorage", err);
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  }
};

export const createCustomerReceipt = async (receipt: Omit<CustomerReceipt, 'id' | 'created_at'>): Promise<CustomerReceipt> => {
  const newReceipt: CustomerReceipt = {
    ...receipt,
    id: Math.random().toString(36).substring(2, 15),
    created_at: new Date().toISOString()
  };

  // Sync to localStorage
  const localReceipts = await getCustomerReceipts();
  const updated = [newReceipt, ...localReceipts];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  if (!supabase) return newReceipt;

  try {
    const { data, error } = await supabase
      .from('customer_receipts')
      .insert([receipt])
      .select()
      .single();
    
    if (error) {
      console.warn("Supabase customer_receipts insertion failed, using local copy", error);
      return newReceipt;
    }
    return data;
  } catch (err) {
    console.warn("Supabase customer_receipts error, using local copy", err);
    return newReceipt;
  }
};
