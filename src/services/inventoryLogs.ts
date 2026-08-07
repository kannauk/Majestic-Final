import { supabase } from '../lib/supabaseClient';
import { InventoryLog } from '../types';

export const getInventoryLogs = async (): Promise<InventoryLog[]> => {
  const { data, error } = await supabase
    .from('inventory_logs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createInventoryLog = async (log: Omit<InventoryLog, 'id'>): Promise<InventoryLog> => {
  const { data, error } = await supabase
    .from('inventory_logs')
    .insert([log])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
