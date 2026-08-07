import { supabase } from '../lib/supabaseClient';
import { InventoryLog } from '../types';

export const transferStock = async (
  productId: string,
  fromBranchId: string,
  toBranchId: string,
  quantity: number,
  remarks: string,
  userName: string
): Promise<void> => {
  // This needs to be a transaction or atomic operation in Supabase
  // For now, simple implementation
  const { data: stockFrom, error: err1 } = await supabase
    .from('product_stocks')
    .select('*')
    .eq('product_id', productId)
    .eq('branch_id', fromBranchId)
    .single();

  if (err1) throw err1;
  if (stockFrom.quantity < quantity) throw new Error('Insufficient stock');

  const { data: stockTo, error: err2 } = await supabase
    .from('product_stocks')
    .select('*')
    .eq('product_id', productId)
    .eq('branch_id', toBranchId)
    .single();

  if (err2) throw err2;

  await supabase
    .from('product_stocks')
    .update({ quantity: stockFrom.quantity - quantity })
    .eq('id', stockFrom.id);

  await supabase
    .from('product_stocks')
    .update({ quantity: stockTo.quantity + quantity })
    .eq('id', stockTo.id);

  let pName = 'Unknown';
  let pSku = 'Unknown';
  try {
    const { data: prod } = await supabase.from('products').select('name, sku').eq('id', productId).maybeSingle();
    if (prod) {
      pName = prod.name;
      pSku = prod.sku;
    }
  } catch (err) {
    console.error(err);
  }

  let fromBranchName = 'Unknown';
  try {
    const { data: brFrom } = await supabase.from('branches').select('name').eq('id', fromBranchId).maybeSingle();
    if (brFrom) fromBranchName = brFrom.name;
  } catch (err) {
    console.error(err);
  }

  let toBranchName = 'Unknown';
  try {
    const { data: brTo } = await supabase.from('branches').select('name').eq('id', toBranchId).maybeSingle();
    if (brTo) toBranchName = brTo.name;
  } catch (err) {
    console.error(err);
  }

  await supabase
    .from('inventory_logs')
    .insert([{
      product_id: productId,
      product_name: pName,
      sku: pSku,
      branch_id: fromBranchId,
      branch_name: fromBranchName,
      quantity: quantity,
      type: 'transfer_out',
      description: `Transfer from ${fromBranchName} to ${toBranchName}. Remarks: ${remarks}. By: ${userName}`,
      created_at: new Date().toISOString()
    }]);
};
