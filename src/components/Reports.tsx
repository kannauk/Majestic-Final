import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Filter, FileText, 
  Layers, Package, Wrench, Coins, TrendingUp, Calendar
} from 'lucide-react';
import { User, Branch, Invoice, Product, ProductStock, Repair } from '../types';
import { getBranches } from '../services/branches';
import { getInvoices } from '../services/invoices';
import { getProducts } from '../services/products';
import { getProductStocks } from '../services/productStocks';
import { getRepairs } from '../services/repairs';

interface ReportsProps {
  user: User;
  activeBranch: Branch | null;
}

export default function Reports({ user, activeBranch }: ReportsProps) {
  const [reportType, setReportType] = useState<'sales' | 'inventory' | 'repairs'>('sales');
  const [branchScope, setBranchScope] = useState<string>(user.role === 'super_admin' ? 'all' : (user.branch_id || ''));
  const [dateRange, setDateRange] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getBranches(),
      getInvoices(),
      getProducts(),
      getProductStocks(),
      getRepairs()
    ]).then(([b, inv, p, st, r]) => {
      setBranches(b);
      setInvoices(inv);
      setProducts(p);
      setStocks(st);
      setRepairs(r);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  const invoiceItems = useMemo(() => invoices.flatMap(inv => inv.invoice_items || []), [invoices]);

  // Filter lists based on target branch scope
  const filteredInvoices = useMemo(() => {
    return branchScope === 'all' ? invoices : invoices.filter(i => i.branch_id === branchScope);
  }, [invoices, branchScope]);

  const filteredInvoicesByDate = useMemo(() => {
    return filteredInvoices.filter(inv => {
      if (!inv.created_at) return false;
      const d = new Date(inv.created_at);
      const invDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (dateRange === 'daily') {
        return invDateStr === selectedDate;
      } else if (dateRange === 'weekly') {
        const selTime = new Date(selectedDate).getTime();
        const invTime = new Date(invDateStr).getTime();
        const diffDays = Math.abs(selTime - invTime) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      } else if (dateRange === 'monthly') {
        const selMonth = selectedDate.substring(0, 7); // e.g. "2026-08"
        return invDateStr.startsWith(selMonth);
      }
      return true; // 'all'
    });
  }, [filteredInvoices, dateRange, selectedDate]);

  const filteredRepairs = useMemo(() => {
    return branchScope === 'all' ? repairs : repairs.filter(r => r.branch_id === branchScope);
  }, [repairs, branchScope]);

  const filteredRepairsByDate = useMemo(() => {
    return filteredRepairs.filter(rep => {
      if (!rep.created_at) return false;
      const d = new Date(rep.created_at);
      const repDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (dateRange === 'daily') {
        return repDateStr === selectedDate;
      } else if (dateRange === 'weekly') {
        const selTime = new Date(selectedDate).getTime();
        const repTime = new Date(repDateStr).getTime();
        const diffDays = Math.abs(selTime - repTime) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      } else if (dateRange === 'monthly') {
        const selMonth = selectedDate.substring(0, 7);
        return repDateStr.startsWith(selMonth);
      }
      return true; // 'all'
    });
  }, [filteredRepairs, dateRange, selectedDate]);

  // Compute stats for Sales report tab
  const salesReportRows = useMemo(() => {
    return filteredInvoicesByDate.map(inv => {
      const items = invoiceItems.filter(itm => itm.invoice_id === inv.id);
      return {
        invoiceNo: inv.invoice_no,
        date: (() => { const d = new Date(inv.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
        client: inv.customer_name,
        branch: inv.branch_name,
        itemsCount: items.reduce((sum, i) => sum + i.quantity, 0),
        tax: inv.tax,
        discount: inv.discount,
        total: inv.total,
        status: inv.payment_status,
        items: items.map(itm => {
          let pName = itm.product_name;
          if (!pName || pName === 'Unknown Product' || pName === 'Unknown') {
            const p = products.find(prod => prod.id === itm.product_id);
            if (p) pName = p.name;
          }
          return {
            ...itm,
            product_name: pName || 'Unknown Product'
          };
        })
      };
    });
  }, [filteredInvoicesByDate, invoiceItems, products]);

  // Compute stats for Inventory report tab
  const inventoryReportRows = useMemo(() => {
    const list: any[] = [];
    stocks.forEach(stk => {
      if (branchScope !== 'all' && stk.branch_id !== branchScope) return;

      const p = products.find(prod => prod.id === stk.product_id);
      const br = branches.find(b => b.id === stk.branch_id);

      if (p) {
        list.push({
          sku: p.sku,
          name: p.name,
          branchName: br ? br.name : 'Unknown',
          quantity: stk.quantity,
          cost: p.cost_price,
          selling: p.selling_price,
          totalValueCost: p.cost_price * stk.quantity,
          totalValueSelling: p.selling_price * stk.quantity,
          status: stk.quantity === 0 ? 'Out' : stk.quantity <= stk.min_stock_alert ? 'Low' : 'OK'
        });
      }
    });
    return list;
  }, [stocks, products, branches, branchScope]);

  // Compute stats for Repairs report tab
  const repairReportRows = useMemo(() => {
    return filteredRepairsByDate.map(rep => ({
      ticketNo: rep.ticket_no,
      date: (() => { const d = new Date(rep.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
      client: rep.customer_name,
      phone: rep.customer_phone,
      branchName: rep.branch_name,
      device: `${rep.brand} ${rep.model}`,
      tech: rep.technician_name || 'Unassigned',
      status: rep.status,
      cost: rep.actual_cost || rep.estimated_cost
    }));
  }, [filteredRepairsByDate]);

  // Total summary calculations
  const totalSalesVolume = useMemo(() => {
    return salesReportRows.reduce((sum, r) => sum + r.total, 0);
  }, [salesReportRows]);

  const totalInventoryAssetValue = useMemo(() => {
    return inventoryReportRows.reduce((sum, r) => sum + r.totalValueCost, 0);
  }, [inventoryReportRows]);

  const totalClosedRepairsValue = useMemo(() => {
    return repairReportRows.reduce((sum, r) => sum + r.cost, 0);
  }, [repairReportRows]);

  // Download Trigger Mock
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    alert(`TRANSMITTING RAPID DOWNLOAD API:\n\n` + 
          `Preparing ${reportType.toUpperCase()} file export payload...\n` +
          `Format target: ${format.toUpperCase()}\n` +
          `Scope: ${branchScope === 'all' ? 'Enterprise-wide' : branches.find(b => b.id === branchScope)?.name}\n` +
          `Date Focus: ${dateRange === 'daily' ? `Selected Day (${selectedDate})` : dateRange === 'weekly' ? `Week of ${selectedDate}` : dateRange === 'monthly' ? `Month of ${selectedDate}` : 'All Time'}\n\n` +
          `Save: majestic_${reportType}_report_${dateRange}_${selectedDate}.${format} successfully downloaded.`);
  };

  return (
    <div className="space-y-6" id="reports-module-root">
      {/* Title section with Filter controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-3.5 bg-zinc-50 border rounded-2xl gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-1.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-650" />
            Executive Business Reports
          </h2>
          <p className="text-xs text-zinc-550 mt-1">
            Conduct sales forecasts, stock assets evaluation, and technician delivery audits.
          </p>
        </div>

        <div className="flex bg-zinc-150 rounded-lg p-0.5 border border-zinc-200 shrink-0">
          {[
            { id: 'sales', label: 'Sales Reports', icon: Coins },
            { id: 'inventory', label: 'Stocks Reports', icon: Package },
            { id: 'repairs', label: 'Repairs Reports', icon: Wrench }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id as 'sales' | 'inventory' | 'repairs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  reportType === tab.id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-905'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Filters layout */}
      <div className="bg-white p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between text-xs font-medium text-zinc-650">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span>Showroom:</span>
            {user.role === 'super_admin' ? (
              <select
                value={branchScope}
                onChange={(e) => setBranchScope(e.target.value)}
                className="bg-zinc-50 border rounded-lg px-2.5 py-1 focus:outline-indigo-500 cursor-pointer"
              >
                <option value="all">Enterprise Global</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-zinc-805 bg-zinc-100 px-2 py-1 rounded">
                {branches.find(b => b.id === branchScope)?.name || 'Local'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span>Aggregate Period:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-zinc-50 border rounded-lg px-2.5 py-1 cursor-pointer focus:outline-indigo-550 font-semibold text-zinc-805"
            >
              <option value="daily">Selected Day</option>
              <option value="weekly">Weekly Statements</option>
              <option value="monthly">Monthly Aggregate</option>
              <option value="all">All Time (No Date Filter)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span>Filter Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-50 border rounded-lg px-2.5 py-1 text-zinc-800 outline-none focus:border-indigo-500 font-semibold cursor-pointer"
            />
          </div>
        </div>

        {/* Exports Buttons triggers */}
        <div className="flex gap-1.5">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 border hover:bg-zinc-200 hover:text-zinc-900 rounded-lg font-bold text-[11px] uppercase transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 border hover:bg-zinc-200 hover:text-zinc-900 rounded-lg font-bold text-[11px] uppercase transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-820 text-white rounded-lg font-bold text-[11px] uppercase transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF Report
          </button>
        </div>
      </div>

      {/* Render Dynamic tables based on selected type */}
      {reportType === 'sales' ? (
        /* SALES REPORT PANE */
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Sales aggregate data lines
            </h4>
            <div className="text-xs bg-indigo-50/55 p-1.5 px-3 border rounded-xl">
              Nett aggregate volume: <strong className="text-indigo-650 ml-1">Rs. {totalSalesVolume.toLocaleString()}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                  <th className="pb-3 text-left">Bill ID</th>
                  <th className="pb-3 text-left">Issued Date</th>
                  <th className="pb-3 text-left">Client Profile</th>
                  <th className="pb-3 text-left">Showroom Branch</th>
                  <th className="pb-3 text-left">Items Issued</th>
                  <th className="pb-3 text-right">VAT amount</th>
                  <th className="pb-3 text-right">Nett total values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {salesReportRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 font-bold font-mono text-zinc-900">{r.invoiceNo}</td>
                    <td className="py-2.5 font-mono text-zinc-445">{r.date}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{r.client}</td>
                    <td className="py-2.5 text-zinc-650">{r.branch}</td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-1 py-1">
                        <span className="font-semibold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] w-fit">
                          {r.itemsCount} {r.itemsCount === 1 ? 'item' : 'items'} total
                        </span>
                        <div className="flex flex-col gap-1 mt-0.5 max-w-[280px]">
                          {r.items.map((itm: any, iidx: number) => (
                            <div key={iidx} className="text-[10px] text-zinc-500 leading-tight">
                              <span className="font-medium text-zinc-700">{itm.product_name}</span>{' '}
                              <span className="text-zinc-400">({itm.quantity} × Rs. {itm.unit_price.toLocaleString()})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-455">Rs. {r.tax.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-black text-zinc-900">Rs. {r.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : reportType === 'inventory' ? (
        /* STOCKS VALUATION REPORT PANE */
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1">
              <Package className="w-4 h-4 text-indigo-550" />
              Store assets evaluation summaries
            </h4>
            <div className="text-xs bg-indigo-50/55 p-1.5 px-3 border rounded-xl">
              Nett Stock Valuation (at cost): <strong className="text-indigo-650 ml-1">Rs. {totalInventoryAssetValue.toLocaleString()}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                  <th className="pb-3">SKU Code</th>
                  <th className="pb-3">Hardware Details</th>
                  <th className="pb-3">Showroom Location</th>
                  <th className="pb-3 text-right">Unit Buy Cost</th>
                  <th className="pb-3 text-right">Unit Sell Price</th>
                  <th className="pb-3 text-center">Batch Stock</th>
                  <th className="pb-3 text-right">In-Stock assets Turnout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {inventoryReportRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 font-bold font-mono text-zinc-950">{r.sku}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{r.name}</td>
                    <td className="py-2.5 text-zinc-650">{r.branchName}</td>
                    <td className="py-2.5 text-right">Rs. {r.cost.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-800">Rs. {r.selling.toLocaleString()}</td>
                    <td className="py-2.5 text-center font-extrabold text-sm text-zinc-900">{r.quantity}</td>
                    <td className="py-2.5 text-right font-black text-indigo-650">Rs. {r.totalValueCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* REPAIRS PERFORMANCE REPORT PANE */
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1">
              <Wrench className="w-4 h-4 text-amber-500" />
              Workshop service execution logs
            </h4>
            <div className="text-xs bg-indigo-50/55 p-1.5 px-3 border rounded-xl">
              Nett Services billing yield: <strong className="text-indigo-650 ml-1">Rs. {totalClosedRepairsValue.toLocaleString()}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px]">
                  <th className="pb-3 text-left">Ticket ID</th>
                  <th className="pb-3 text-left">Brought Date</th>
                  <th className="pb-3 text-left">Client Profile</th>
                  <th className="pb-3 text-left">Showroom Hub</th>
                  <th className="pb-3 text-left">Received Device Details</th>
                  <th className="pb-3 text-left">Assigned Tech</th>
                  <th className="pb-3 text-center">Diagnostics Status</th>
                  <th className="pb-3 text-right">Actual cost yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {repairReportRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 text-[11px]">
                    <td className="py-2.5 font-bold font-mono text-zinc-850">{r.ticketNo}</td>
                    <td className="py-2.5 text-zinc-500 font-mono">{r.date}</td>
                    <td className="py-2.5">
                      <div className="font-bold text-zinc-900">{r.client}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{r.phone}</div>
                    </td>
                    <td className="py-2.5 text-zinc-650">{r.branchName}</td>
                    <td className="py-2.5 font-semibold text-zinc-800">{r.device}</td>
                    <td className="py-2.5 text-zinc-505 font-bold">{r.tech}</td>
                    <td className="py-2.5 text-center">
                      <span className="uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-black text-indigo-650">Rs. {r.cost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
