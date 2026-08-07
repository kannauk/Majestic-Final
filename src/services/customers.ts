import { supabase } from '../lib/supabaseClient';
import { Customer } from '../types';

export const getCustomers = async (): Promise<Customer[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*');
  
  if (error) return [];
  return data || [];
};

export const createCustomer = async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateCustomer = async (customer: Customer): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .update(customer)
    .eq('id', customer.id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
