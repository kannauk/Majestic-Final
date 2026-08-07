import { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, Wrench, AlertTriangle, Users, 
  MapPin, Coins, ArrowUpRight, BarChart2, BookOpen, Clock, Activity,
  Filter, Sparkles, RefreshCw, Layers, CheckCircle2, ShieldCheck, Zap
} from 'lucide-react';
import { User, Branch, Product, ProductStock, Customer, Invoice, Repair, Expense } from '../types';

interface DashboardProps {
  user: User;
  activeBranch: Branch | null;
}

export default function Dashboard({ user, activeBranch }: DashboardProps) {
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | 'MTD' | 'YTD'>('MTD');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      import('../services/branches').then(s => s.getBranches()),
      import('../services/products').then(s => s.getProducts()),
      import('../services/productStocks').then(s => s.getProductStocks()),
      import('../services/customers').then(s => s.getCustomers()),
      import('../services/invoices').then(s => s.getInvoices()),
      import('../services/repairs').then(s => s.getRepairs()),
      import('../services/expenses').then(s => s.getExpenses())
    ]).then(([branches, products, stocks, customers, invoices, repairs, expenses]) => {
      setBranches(branches);
      setProducts(products);
      setStocks(stocks);
      setCustomers(customers);
      setInvoices(invoices);
      setRepairs(repairs);
      setExpenses(expenses);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  const invoiceItems = useMemo(() => invoices.flatMap(inv => inv.invoice_items || []), [invoices]);

  // Is user locked to their own branch?
  const isBranchRestricted = user.role !== 'super_admin';
  const queryBranchId = isBranchRestricted ? user.branch_id : (selectedBranchFilter === 'all' ? null : selectedBranchFilter);

  // Simulate smooth skeleton loader when filter changes
  const handleBranchChange = (branchId: string) => {
    setIsLoading(true);
    setSelectedBranchFilter(branchId);
    setTimeout(() => setIsLoading(false), 350);
  };

  const handleTimeframeChange = (tf: '7D' | '30D' | 'MTD' | 'YTD') => {
    setIsLoading(true);
    setTimeframe(tf);
    setTimeout(() => setIsLoading(false), 250);
  };

  // Filtered records
  const branchInvoices = useMemo(() => {
    return queryBranchId ? invoices.filter(inv => inv.branch_id === queryBranchId) : invoices;
  }, [invoices, queryBranchId]);

  const branchRepairs = useMemo(() => {
    return queryBranchId ? repairs.filter(rep => rep.branch_id === queryBranchId) : repairs;
  }, [repairs, queryBranchId]);

  const branchExpenses = useMemo(() => {
    return queryBranchId ? expenses.filter(exp => exp.branch_id === queryBranchId) : expenses;
  }, [expenses, queryBranchId]);

  const lowStockItems = useMemo(() => {
    return stocks.filter(stock => {
      if (queryBranchId && stock.branch_id !== queryBranchId) return false;
      return stock.quantity <= stock.min_stock_alert;
    }).map(s => {
      const prod = products.find(p => p.id === s.product_id);
      const br = branches.find(b => b.id === s.branch_id);
      return {
        ...s,
        productName: prod ? prod.name : 'Unknown Product',
        sku: prod ? prod.sku : '',
        branchName: br ? br.name : 'Unknown'
      };
    });
  }, [stocks, products, branches, queryBranchId]);

  // Analytics Computations
  const stats = useMemo(() => {
    const filterByDate = (item: any) => {
      if (!item.created_at) return true;
      const itemTime = new Date(item.created_at).getTime();
      const now = Date.now();
      const diffDays = (now - itemTime) / (1000 * 60 * 60 * 24);
      
      if (timeframe === '7D') return diffDays <= 7;
      if (timeframe === '30D') return diffDays <= 30;
      if (timeframe === 'MTD') {
        const d = new Date(item.created_at);
        const curr = new Date();
        return d.getMonth() === curr.getMonth() && d.getFullYear() === curr.getFullYear();
      }
      if (timeframe === 'YTD') {
         const d = new Date(item.created_at);
         return d.getFullYear() === new Date().getFullYear();
      }
      return true;
    };

    const timeFilteredInvoices = branchInvoices.filter(filterByDate);
    const timeFilteredRepairs = branchRepairs.filter(filterByDate);
    const timeFilteredExpenses = branchExpenses.filter(filterByDate);

    let revenue = 0;
    timeFilteredInvoices.forEach(inv => {
      if (inv.refund_status !== 'fully_refunded') {
        revenue += inv.total;
      }
    });

    let costOfGoodsSold = 0;
    timeFilteredInvoices.forEach(inv => {
      const items = invoiceItems.filter(item => item.invoice_id === inv.id);
      items.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          costOfGoodsSold += prod.cost_price * item.quantity;
        }
      });
    });

    const activeRepairsCount = timeFilteredRepairs.filter(r => r.status !== 'delivered' && r.status !== 'cancelled').length;
    const completedRepairsCount = timeFilteredRepairs.filter(r => r.status === 'completed' || r.status === 'delivered').length;

    let totalExpense = 0;
    timeFilteredExpenses.forEach(exp => {
      totalExpense += exp.amount;
    });

    const estimatedProfit = Math.max(0, revenue - costOfGoodsSold - totalExpense);
    const profitMargin = revenue > 0 ? ((estimatedProfit / revenue) * 100).toFixed(1) : '0.0';

    return {
      revenue,
      profit: estimatedProfit,
      profitMargin,
      activeRepairs: activeRepairsCount,
      completedRepairs: completedRepairsCount,
      expenses: totalExpense,
      totalSalesCount: timeFilteredInvoices.length,
      customersCount: customers.length
    };
  }, [branchInvoices, invoiceItems, products, branchRepairs, branchExpenses, customers, timeframe]);

  // Top Selling Hardware & Spares
  const topSellingProducts = useMemo(() => {
    const counts: Record<string, { name: string; sku: string; qty: number; sales: number }> = {};
    
    branchInvoices.forEach(inv => {
      const items = invoiceItems.filter(item => item.invoice_id === inv.id);
      items.forEach(item => {
        if (!counts[item.product_id]) {
          counts[item.product_id] = { name: item.product_name, sku: item.sku, qty: 0, sales: 0 };
        }
        counts[item.product_id].qty += item.quantity;
        counts[item.product_id].sales += item.total;
      });
    });

    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [branchInvoices, invoiceItems]);

  // Monthly / Period Chart Data
  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }

    return months.map(m => {
      let monthlyRevenue = 0;
      branchInvoices.forEach(inv => {
        if (inv.created_at && inv.refund_status !== 'fully_refunded') {
          const invDate = new Date(inv.created_at);
          if (invDate.getMonth() === m.month && invDate.getFullYear() === m.year) {
            monthlyRevenue += inv.total;
          }
        }
      });
      return {
        name: m.month === now.getMonth() ? `${m.label} (MTD)` : m.label,
        value: monthlyRevenue
      };
    });
  }, [branchInvoices]);

  const maxChartValue = Math.max(...chartData.map(v => v.value), 1000);

  // Live Activity Feed Items
  const recentActivities = useMemo(() => {
    const invActivities = branchInvoices.slice(0, 3).map(inv => {
      const timeStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Just now';
      return {
        id: inv.id,
        type: 'sale',
        title: `Invoice #${inv.invoice_no} Issued`,
        time: timeStr,
        amount: `Rs. ${inv.total.toLocaleString()}`,
        status: inv.payment_status
      };
    });

    const repActivities = branchRepairs.slice(0, 2).map(rep => {
      const timeStr = rep.created_at ? new Date(rep.created_at).toLocaleDateString() : '12m ago';
      return {
        id: rep.id,
        type: 'repair',
        title: `Ticket #${rep.ticket_no} - ${rep.device_model}`,
        time: timeStr,
        amount: `Rs. ${rep.estimated_cost.toLocaleString()}`,
        status: rep.status
      };
    });

    return [...invActivities, ...repActivities].slice(0, 4);
  }, [branchInvoices, branchRepairs]);

  return (
    <div className="space-y-6" id="dashboard-root">
      {/* Premium Glass Hero Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-950/80 to-slate-900/90 border border-slate-700/60 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle ambient lighting spot */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" /> Live Enterprise Telemetry
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Majestic Analytical Command
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Realtime operations, automated ledger balance tracking, hardware stock velocity, and repair workshop status for Ceylon retail branches.
          </p>
        </div>

        {/* Timeframe & Branch Filters */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Timeframe Selector Pills */}
          <div className="flex items-center bg-slate-950/60 border border-slate-800 p-1 rounded-2xl shadow-inner">
            {(['7D', '30D', 'MTD', 'YTD'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Super Admin Scope Filter */}
          {user.role === 'super_admin' && (
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={selectedBranchFilter}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Showrooms (Enterprise)</option>
                {branches.map(br => (
                  <option key={br.id} value={br.id} className="bg-slate-900 text-white">{br.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid KPI Stat Counters */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-slate-900/40 border border-slate-800 p-5 skeleton-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="stats-counters-grid">
          {/* Revenue Card */}
          <div className="gradient-card-indigo p-5 rounded-2xl shadow-lg hover-lift flex flex-col justify-between group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Total Turnout Revenue</p>
                <h3 className="text-2xl font-black tracking-tight text-white mt-2">
                  Rs. {stats.revenue.toLocaleString()}
                </h3>
              </div>
              <div className="bg-indigo-500/20 p-2.5 rounded-2xl border border-indigo-500/30 group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                <TrendingUp className="w-3.5 h-3.5" /> +18.4%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{stats.totalSalesCount} Invoices Processed</span>
            </div>
          </div>

          {/* Operating Profit Card */}
          <div className="gradient-card-emerald p-5 rounded-2xl shadow-lg hover-lift flex flex-col justify-between group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Net Operating Profit</p>
                <h3 className="text-2xl font-black tracking-tight text-white mt-2">
                  Rs. {stats.profit.toLocaleString()}
                </h3>
              </div>
              <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {stats.profitMargin}% Profit Margin
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Expenses: Rs. {stats.expenses.toLocaleString()}</span>
            </div>
          </div>

          {/* Active Repair Queue Card */}
          <div className="gradient-card-amber p-5 rounded-2xl shadow-lg hover-lift flex flex-col justify-between group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Workshop Repair Queue</p>
                <h3 className="text-2xl font-black tracking-tight text-white mt-2">
                  {stats.activeRepairs} Active Jobs
                </h3>
              </div>
              <div className="bg-amber-500/20 p-2.5 rounded-2xl border border-amber-500/30 group-hover:scale-110 transition-transform">
                <Wrench className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                {stats.completedRepairs} Delivered
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Technicians On Duty</span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts & Live Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-grid">
        {/* Revenue Performance Trend Chart */}
        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl lg:col-span-2 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Revenue Turnout Curve
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Monthly revenue breakdown for selected timeframe and showrooms</p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Columns
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartType === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Linear
              </button>
            </div>
          </div>

          <div className="min-h-[220px] flex items-end justify-between pt-8 px-2 relative">
            {/* Horizontal guideline markers */}
            <div className="absolute left-0 right-0 top-[25%] border-t border-slate-800/80 border-dashed pointer-events-none" />
            <div className="absolute left-0 right-0 top-[50%] border-t border-slate-800/80 border-dashed pointer-events-none" />
            <div className="absolute left-0 right-0 top-[75%] border-t border-slate-800/80 border-dashed pointer-events-none" />

            {chartData.map((item, idx) => {
              const heightPct = Math.round((item.value / maxChartValue) * 100);
              const isPeak = item.value === maxChartValue;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center group relative z-10">
                  {/* Peak Marker Badge */}
                  {isPeak && (
                    <span className="absolute -top-7 text-[9px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full shadow-lg">
                      Peak
                    </span>
                  )}

                  {/* Hover tooltip */}
                  <div className="absolute -top-12 bg-slate-950 text-white text-[11px] font-mono py-1 px-3 rounded-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl pointer-events-none z-30">
                    Rs. {item.value.toLocaleString()}
                  </div>

                  {/* Column / Line visual */}
                  {chartType === 'bar' ? (
                    <div 
                      className={`w-[55%] sm:w-[40%] rounded-xl transition-all duration-500 shadow-md ${
                        isPeak 
                          ? 'bg-gradient-to-t from-cyan-500 to-indigo-500 shadow-cyan-500/20' 
                          : 'bg-gradient-to-t from-indigo-600/70 to-indigo-500/90 group-hover:from-indigo-500 group-hover:to-cyan-400'
                      }`}
                      style={{ height: `${Math.max(heightPct, 12)}%` }}
                    />
                  ) : (
                    <div className="flex flex-col items-center w-full relative">
                      <div 
                        className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-lg group-hover:scale-125 transition-transform z-20" 
                        style={{ marginBottom: `${Math.max(heightPct * 1.5, 10)}px` }}
                      />
                    </div>
                  )}

                  <span className="text-[11px] text-slate-400 font-bold mt-3">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Enterprise Activity Stream */}
        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Live Activity Telemetry
            </h4>
            <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Streaming
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[250px] pr-1">
            {recentActivities.map((act) => (
              <div key={act.id} className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all text-xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className={`p-2 rounded-xl shrink-0 ${act.type === 'sale' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {act.type === 'sale' ? <ShoppingBag className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-200 truncate">{act.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{act.time}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-white block">{act.amount}</span>
                  <span className="text-[9px] uppercase font-bold text-emerald-400">{act.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Top Selling Products & Low Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-tables-grid">
        {/* Top Selling Products */}
        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Top Selling Hardware & Spares
            </h4>
            <span className="text-[10px] font-mono text-slate-400">By Quantity Sold</span>
          </div>

          {topSellingProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold text-left">
                    <th className="pb-2">Product Name</th>
                    <th className="pb-2 text-center">Qty Issued</th>
                    <th className="pb-2 text-right">Total Turnout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {topSellingProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-slate-200">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      </td>
                      <td className="py-3 text-center font-extrabold text-cyan-400">{p.qty}</td>
                      <td className="py-3 text-right font-bold text-white">
                        Rs. {p.sales.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Layers className="w-8 h-8 text-slate-700" />
              No transaction logs recorded for this timeframe.
            </div>
          )}
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Critical Refill Watchlist
            </h4>
            <span className="text-[10px] font-mono text-slate-400">Low Stock Trigger</span>
          </div>

          {lowStockItems.length > 0 ? (
            <div className="overflow-y-auto max-h-[240px] pr-1 space-y-2.5">
              {lowStockItems.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-xs">
                  <div className="min-w-0 pr-3">
                    <div className="font-bold text-slate-100 truncate">{s.productName}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-slate-300">{s.sku}</span>
                      <span>•</span>
                      <span className="font-bold text-indigo-300">{s.branchName}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      s.quantity === 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {s.quantity === 0 ? 'Out of Stock' : `${s.quantity} units left`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              All showrooms reporting healthy stock reserves.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
