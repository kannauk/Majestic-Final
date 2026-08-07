import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*').order('created_at', { ascending: false });
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*');
  const data = invoices?.map(inv => ({
    ...inv,
    invoice_items: items?.filter(item => item.invoice_id === inv.id) || []
  })) || [];
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data && data.length > 0) console.log(data[0].invoice_items?.length);
}
run();
