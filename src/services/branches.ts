import { supabase } from '../lib/supabaseClient';
import { Branch } from '../types';

export const getBranches = async (): Promise<Branch[]> => {
  if (!supabase) {
    return [
      { id: 'b-banbalapitiya', name: 'Banbalapitiya Branch', location: 'No. 320, Galle Road, Banbalapitiya', code: 'BAN-01', phone: '+94 11 258 1234', email: 'banbalapitiya@majestic.com', created_at: '2026-01-10T08:00:00Z' },
      { id: 'b-dematagoda', name: 'Dematagoda Branch', location: 'No. 54, Baseline Road, Dematagoda', code: 'DEM-02', phone: '+94 11 268 5678', email: 'dematagoda@majestic.com', created_at: '2026-01-15T08:00:00Z' }
    ];
  }
  const { data, error } = await supabase
    .from('branches')
    .select('*');
  
  if (error) {
    return [
      { id: 'b-banbalapitiya', name: 'Banbalapitiya Branch', location: 'No. 320, Galle Road, Banbalapitiya', code: 'BAN-01', phone: '+94 11 258 1234', email: 'banbalapitiya@majestic.com', created_at: '2026-01-10T08:00:00Z' },
      { id: 'b-dematagoda', name: 'Dematagoda Branch', location: 'No. 54, Baseline Road, Dematagoda', code: 'DEM-02', phone: '+94 11 268 5678', email: 'dematagoda@majestic.com', created_at: '2026-01-15T08:00:00Z' }
    ];
  }
  return data || [];
};

export const createBranch = async (branch: Omit<Branch, 'id' | 'created_at'>): Promise<Branch> => {
  if (!supabase) {
    return { ...branch, id: `b-${Date.now()}`, created_at: new Date().toISOString() };
  }
  const { data, error } = await supabase
    .from('branches')
    .insert([branch])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateBranch = async (branch: Branch): Promise<Branch> => {
  if (!supabase) return branch;
  const { data, error } = await supabase
    .from('branches')
    .update(branch)
    .eq('id', branch.id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
