import { supabase } from '../lib/supabaseClient';
import { User } from '../types';

export const getUsers = async (): Promise<User[]> => {
  if (!supabase) {
    return [
      {
        id: 'u-abi',
        email: 'abi@majestic.com',
        username: 'abi',
        name: 'abi',
        role: 'super_admin',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        active: true,
        permissions: ['all'],
        created_at: '2026-06-01T00:00:00Z',
        password: 'abi@2026'
      }
    ];
  }
  const { data, error } = await supabase
    .from('users')
    .select('*');
  
  if (error) {
    return [
      {
        id: 'u-abi',
        email: 'abi@majestic.com',
        username: 'abi',
        name: 'abi',
        role: 'super_admin',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        active: true,
        permissions: ['all'],
        created_at: '2026-06-01T00:00:00Z',
        password: 'abi@2026'
      }
    ];
  }
  return data || [];
};

export const createUser = async (user: Omit<User, 'id' | 'created_at'>): Promise<User> => {
  if (!supabase) {
    return { ...user, id: `u-${Date.now()}`, created_at: new Date().toISOString() };
  }
  const { data, error } = await supabase
    .from('users')
    .insert([user])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateUser = async (user: User): Promise<User> => {
  if (!supabase) return user;
  const { data, error } = await supabase
    .from('users')
    .update(user)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
