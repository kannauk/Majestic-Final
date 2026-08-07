import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('invoices').select('*, invoice_items(*)').order('created_at', { ascending: false });
  console.log("Error:", error);
  console.log("Data length:", data?.length);
}
run();
