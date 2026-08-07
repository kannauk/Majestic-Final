import { supabase } from '../lib/supabaseClient';
import { Supplier } from '../types';

export async function getSuppliers(): Promise<Supplier[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('suppliers').select('*');
  if (error) return [];
  return data || [];
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(supplier: Supplier): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').update(supplier).eq('id', supplier.id).select().single();
  if (error) throw error;
  return data;
}
