import { supabase } from '../lib/supabaseClient';
import { ProductStock } from '../types';

export const getProductStocks = async (): Promise<ProductStock[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('product_stocks')
    .select('*');
  
  if (error) return [];
  return data || [];
};

export const updateProductStock = async (stock: ProductStock): Promise<ProductStock> => {
  const { data, error } = await supabase
    .from('product_stocks')
    .update(stock)
    .eq('id', stock.id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const createProductStock = async (stock: Omit<ProductStock, 'id'>): Promise<ProductStock> => {
  const { data, error } = await supabase
    .from('product_stocks')
    .insert([stock])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const upsertProductStock = async (stock: Omit<ProductStock, 'id'> & { id?: string }): Promise<ProductStock> => {
  if (!supabase) throw new Error('Supabase client not configured.');
  const { data, error } = await supabase
    .from('product_stocks')
    .upsert([stock], { onConflict: 'product_id,branch_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};
