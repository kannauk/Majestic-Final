import { supabase } from '../lib/supabaseClient';
import { Expense } from '../types';

export const getExpenses = async (): Promise<Expense[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('expenses')
    .select('*').order('created_at', { ascending: false });
  
  if (error) return [];
  return data || [];
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([expense])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateExpense = async (expense: Expense): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .update(expense)
    .eq('id', expense.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
