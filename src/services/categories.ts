import { supabase } from '../lib/supabaseClient';
import { ProductCategory } from '../types';

export const getCategories = async (): Promise<ProductCategory[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('product_categories')
    .select('*');
  
  if (error) return [];
  return data || [];
};

export const createCategory = async (category: Omit<ProductCategory, 'id'>): Promise<ProductCategory> => {
  const { data, error } = await supabase
    .from('product_categories')
    .insert([category])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
};
