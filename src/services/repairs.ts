import { supabase } from '../lib/supabaseClient';
import { Repair } from '../types';

export const getRepairs = async (): Promise<Repair[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('repairs')
    .select('*').order('created_at', { ascending: false });
  
  if (error) return [];
  return data || [];
};

export const createRepair = async (repair: Omit<Repair, 'id' | 'created_at' | 'updated_at'>): Promise<Repair> => {
  const { data, error } = await supabase
    .from('repairs')
    .insert([repair])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateRepair = async (repair: Repair): Promise<Repair> => {
  const { data, error } = await supabase
    .from('repairs')
    .update(repair)
    .eq('id', repair.id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
