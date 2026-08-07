import { supabase } from '../lib/supabaseClient';
import { Setting } from '../types';
import { db } from '../mockData';

export async function getSetting(): Promise<Setting> {
  const localSetting = db.getSetting();
  if (!supabase) return localSetting;
  try {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error || !data) return localSetting;
    db.saveSetting(data);
    return data;
  } catch {
    return localSetting;
  }
}

export async function updateSetting(setting: Setting): Promise<Setting> {
  db.saveSetting(setting);
  if (!supabase) return setting;
  try {
    const { data, error } = await supabase
      .from('settings')
      .upsert(setting)
      .select()
      .single();
    if (error) {
      console.warn('Supabase updateSetting error, saved locally:', error);
      return setting;
    }
    if (data) {
      db.saveSetting(data);
      return data;
    }
    return setting;
  } catch (err) {
    console.warn('Supabase updateSetting exception, saved locally:', err);
    return setting;
  }
}

