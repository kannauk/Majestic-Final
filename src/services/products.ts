import { supabase } from '../lib/supabaseClient';
import { Product } from '../types';

export const getProducts = async (): Promise<Product[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*');
  
  if (error) return [];
  return data || [];
};

export const createProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateProduct = async (product: Product): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', product.id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
