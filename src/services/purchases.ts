import { supabase } from '../lib/supabaseClient';
import { PurchaseOrder } from '../types';

export async function getPurchases(): Promise<PurchaseOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('purchases').select('*');
  if (error) return [];
  return data || [];
}

export async function createPurchase(purchase: Omit<PurchaseOrder, 'id' | 'created_at'>): Promise<PurchaseOrder> {
  const { data, error } = await supabase.from('purchases').insert(purchase).select().single();
  if (error) throw error;
  return data;
}
