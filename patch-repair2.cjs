const fs = require('fs');
let code = fs.readFileSync('src/components/RepairCenter.tsx', 'utf8');

if (!code.includes("import { supabase }")) {
  code = code.replace("import { getBranches }", "import { getBranches }\nimport { supabase } from '../lib/supabaseClient';\nimport { PaymentMethod } from '../types';");
}

const stateCost = "const [actualCost, setActualCost] = useState<number>(0);";
if (!code.includes("const [paymentMethod, setPaymentMethod]")) {
  code = code.replace(stateCost, stateCost + "\n  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');");
}

const updateFunc = `
  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const updated = {
      ...selectedJob,
      status: newStatus,
      actual_cost: actualCost || selectedJob.actual_cost,
      warranty_period: warranty,
      notes: progressNotes ? \`\${selectedJob.notes || ''}\\n[\${newStatus.toUpperCase()}] \${progressNotes}\` : selectedJob.notes,
      updated_at: new Date().toISOString()
    };

    try {
      if (newStatus === 'delivered' && updated.actual_cost && updated.actual_cost > 0) {
        // Auto-generate invoice to add charges to cash or bank
        const invoiceData = {
          invoice_no: \`INV-REP-\${Date.now()}\`,
          branch_id: selectedJob.branch_id,
          branch_name: selectedJob.branch_name,
          customer_name: selectedJob.customer_name,
          customer_phone: selectedJob.customer_phone,
          subtotal: updated.actual_cost,
          discount: 0,
          tax: 0,
          total: updated.actual_cost,
          payment_method: paymentMethod,
          payment_status: 'paid',
          paid_amount: updated.actual_cost,
          refund_status: 'none',
          created_by_name: user.name,
          notes: \`Repair Service - Ticket \${selectedJob.ticket_no}\`
        };
        const { data: invoice, error: invError } = await supabase.from('invoices').insert(invoiceData).select().single();
        if (invError) throw invError;
        
        // Add single line item for the repair
        if (invoice) {
           await supabase.from('invoice_items').insert({
             invoice_id: invoice.id,
             product_id: 'repair-service',
             product_name: \`Repair Service (\${selectedJob.brand} \${selectedJob.model})\`,
             sku: selectedJob.ticket_no,
             unit_price: updated.actual_cost,
             quantity: 1,
             discount: 0,
             total: updated.actual_cost
           });
        }
      }

      const res = await updateRepair(updated);
      setRepairsListState(prev => prev.map(r => r.id === res.id ? res : r));
      setSelectedJob(res);
      setProgressNotes('');
      alert(\`Repair status successfully logged as \${newStatus}\`);
    } catch (err) {
      console.error(err);
      alert('Failed to update repair status.');
    }
  };
`;

const oldUpdateFuncStart = code.indexOf('const handleUpdateProgress = (e: React.FormEvent) => {');
const oldUpdateFuncEnd = code.indexOf('const accessoryOptions = [');

if (oldUpdateFuncStart !== -1 && oldUpdateFuncEnd !== -1) {
  code = code.substring(0, oldUpdateFuncStart) + updateFunc + "\n  " + code.substring(oldUpdateFuncEnd);
}

const UIactualCost = `                    <div className="sm:col-span-2">
                      <label className="text-zinc-550 block mb-1">Final Bills actual cost value:</label>
                      <input
                        type="number"
                        value={actualCost || ''}
                        onChange={(e) => setActualCost(parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                    </div>`;
                    
const paymentUI = `
                    {newStatus === 'delivered' && (
                      <div className="sm:col-span-2">
                        <label className="text-zinc-550 block mb-1">Payment Method (Auto-adds to Ledger):</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                    )}
`;

code = code.replace(UIactualCost, UIactualCost + paymentUI);

fs.writeFileSync('src/components/RepairCenter.tsx', code);
