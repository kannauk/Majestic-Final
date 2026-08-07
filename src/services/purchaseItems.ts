import { supabase } from '../lib/supabaseClient';
import { PurchaseItem } from '../types';

export async function getPurchaseItems(): Promise<PurchaseItem[]> {
  const { data, error } = await supabase.from('purchase_items').select('*');
  if (error) throw error;
  return data || [];
}

export async function createPurchaseItems(items: Omit<PurchaseItem, 'id'>[]): Promise<PurchaseItem[]> {
  const { data, error } = await supabase.from('purchase_items').insert(items).select();
  if (error) throw error;
  return data || [];
}
