import { supabase } from '../lib/supabaseClient';
import { Brand } from '../types';

export const getBrands = async (): Promise<Brand[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('brands')
    .select('*');
  
  if (error) return [];
  return data || [];
};

export const createBrand = async (brand: Omit<Brand, 'id'>): Promise<Brand> => {
  const { data, error } = await supabase
    .from('brands')
    .insert([brand])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
