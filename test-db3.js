import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('invoice_items').select('*');
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data && data.length > 0) console.log(data[0]);
}
run();
