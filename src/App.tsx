import { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, LogOut, MapPin, Grid, Coins, 
  Wrench, Package, Truck, Landmark, FileSpreadsheet, Settings2, Code,
  Menu, X, Palette, Zap, ShoppingCart, Plus, Layers
} from 'lucide-react';
import { User, Branch } from './types';
import majesticLogo from './assets/images/majestic_logo_1780307785802.png';

// Component Imports
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import RepairCenter from './components/RepairCenter';
import Inventory from './components/Inventory';
import Purchasing from './components/Purchasing';
import Financials from './components/Financials';
import Reports from './components/Reports';
import Settings from './components/Settings';
import SQLSetup from './components/SQLSetup';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('majestic_erp_theme') || 'slate');
  const [fabOpen, setFabOpen] = useState(false);

  // Apply theme class to the HTML document root dynamically
  useEffect(() => {
    document.documentElement.classList.remove('theme-slate', 'theme-emerald', 'theme-nordic', 'theme-multicolor', 'theme-glass');
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('majestic_erp_theme', theme);
  }, [theme]);

  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    import('./services/branches').then(s => s.getBranches()).then(setBranches).catch(console.error);
  }, []);

  // Initialize Default Branch Context upon Login
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'super_admin') {
        // Super Admins default to Colombo HQ
        const colombo = branches.find(b => b.id === 'b-colombo') || branches[0] || null;
        setActiveBranch(colombo);
      } else {
        // Local staff isolated to their respective registered branch
        const staffBranch = branches.find(b => b.id === currentUser.branch_id) || null;
        setActiveBranch(staffBranch);
      }
    } else {
      setActiveBranch(null);
    }
  }, [currentUser, branches]);

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (!currentUser) {
    return <Auth onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Render correct workspace module matching selected navigation tab
  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={currentUser} activeBranch={activeBranch} />;
      case 'pos':
        return (
          <POS 
            user={currentUser} 
            activeBranch={activeBranch} 
            branches={branches}
            onBranchChange={(branchId) => {
              const selected = branches.find(b => b.id === branchId) || null;
              setActiveBranch(selected);
            }}
          />
        );
      case 'repairs':
        return <RepairCenter user={currentUser} activeBranch={activeBranch} />;
      case 'inventory':
        return <Inventory user={currentUser} activeBranch={activeBranch} />;
      case 'purchasing':
        return <Purchasing user={currentUser} activeBranch={activeBranch} />;
      case 'financials':
        return <Financials user={currentUser} activeBranch={activeBranch} />;
      case 'reports':
        return <Reports user={currentUser} activeBranch={activeBranch} />;
      case 'settings':
        return <Settings user={currentUser} activeBranch={activeBranch} theme={theme} setTheme={setTheme} />;
      case 'supabase-sql':
        return <SQLSetup />;
      default:
        return <Dashboard user={currentUser} activeBranch={activeBranch} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0F1115] text-[#E2E8F0] overflow-hidden font-sans" id="main-erp-applet">
      {/* Mobile Sidebar backdrop screen glass */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden transition-all duration-300 pointer-events-auto"
        />
      )}

      {/* Dynamic Navigation Sidebar */}
      <Sidebar 
        user={currentUser} 
        activeBranch={activeBranch}
        branches={branches}
        activeMenu={activeTab}
        setActiveMenu={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
        onBranchChange={(branchId) => {
          const selected = branches.find(b => b.id === branchId) || null;
          setActiveBranch(selected);
        }}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
      />

      {/* Main Panel Content Container (Scrolling viewport) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0F1115]">
        
        {/* Top bar header */}
        <header className="bg-[#0F1115] border-b border-[#1F2125] h-16 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Sidebar Trigger button */}
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#16181D] border border-[#2A2D35] text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer mr-1 shrink-0"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <img 
              src={majesticLogo} 
              alt="Majestic Logo" 
              className="w-7 h-7 object-cover rounded-lg hidden xs:block shrink-0"
              referrerPolicy="no-referrer"
            />
            
            <span className="text-sm font-black text-white tracking-tight uppercase font-sans hidden sm:block shrink-0">
              Majestic Computers <span className="text-[#00E5FF]">ERP Terminal</span>
            </span>
            
            {/* Visual separator */}
            <span className="text-slate-700 hidden sm:block shrink-0">|</span>
            
            {/* Display Active Branch Context */}
            {activeBranch ? (
              <div className="flex items-center gap-1.5 bg-[#16181D] border border-[#2A2D35] rounded-full px-2.5 py-1 text-[11px] text-orange-400 font-bold shrink-0">
                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-[10px] md:text-[11px]">
                  Branch: <span className="text-white uppercase font-black">{activeBranch.name.replace(' Branch', '')}</span>
                </span>
                {currentUser?.role === 'super_admin' && (
                  <span className="hidden md:inline-block text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/25 ml-1 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                    HQ
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500 font-semibold shrink-0">No branch.</span>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Branch isolation switcher inline in header panel for super admin (Desktop only to prevent wrapping) */}
            {currentUser?.role === 'super_admin' && (
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">Simulate Location:</span>
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => {
                    const selected = branches.find(b => b.id === e.target.value) || null;
                    setActiveBranch(selected);
                  }}
                  className="bg-[#16181D] border border-[#2A2D35] text-xs rounded-xl px-3 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 text-white cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Theme Switcher */}
            <div className="flex items-center gap-1.5 bg-[#16181D] border border-[#2A2D35] rounded-xl px-2 py-1 text-xs text-zinc-400 shrink-0">
              <Palette className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="bg-transparent border-none text-[11px] text-white font-bold py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="slate">Dark Slate</option>
                <option value="emerald">Royal Emerald</option>
                <option value="nordic">Nordic Deep</option>
                <option value="multicolor">Vibrant Multi-Color</option>
                <option value="glass">Enterprise Glass (Vercel/Stripe)</option>
              </select>
            </div>

            {/* Display logged profile name and toggle logout */}
            <div className="flex items-center gap-1.5 md:gap-2.5 text-xs">
              <span className="text-slate-500 font-medium hidden xs:inline">Operator:</span>
              <strong className="text-white font-bold max-w-[75px] sm:max-w-none truncate">{currentUser.name}</strong>
              <button
                onClick={handleLogout}
                title="Disconnect terminal connection"
                className="hover:bg-[#16181D] hover:text-red-500 transition-all p-1.5 md:p-2 rounded-lg text-slate-400 font-bold flex items-center gap-1.5 border border-[#1F2125] cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-slate-505" />
                <span className="hidden md:inline font-bold">Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic active module view port content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0F1115] relative" id="active-viewport-panel">
          {renderActiveModule()}

          {/* Floating Action Button (FAB) for Instant Quick Actions */}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {fabOpen && (
              <div className="flex flex-col gap-2 mb-2 p-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 min-w-[200px]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-cyan-400" /> Quick Enterprise Actions
                </div>
                
                <button
                  onClick={() => { setActiveTab('pos'); setFabOpen(false); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-orange-500/20 hover:border-orange-500/30 border border-transparent transition-all text-left"
                >
                  <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg shrink-0">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">New POS Sale</div>
                    <div className="text-[10px] text-slate-400 font-normal">Open billing terminal</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('repairs'); setFabOpen(false); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-indigo-500/20 hover:border-indigo-500/30 border border-transparent transition-all text-left"
                >
                  <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">New Repair Ticket</div>
                    <div className="text-[10px] text-slate-400 font-normal">Log device job card</div>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('inventory'); setFabOpen(false); }}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 border border-transparent transition-all text-left"
                >
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Check Inventory</div>
                    <div className="text-[10px] text-slate-400 font-normal">Manage stock reserves</div>
                  </div>
                </button>
              </div>
            )}

            <button
              onClick={() => setFabOpen(!fabOpen)}
              className={`p-4 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center ${
                fabOpen 
                  ? 'bg-red-500 hover:bg-red-600 text-white rotate-45 scale-105' 
                  : 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white hover:scale-110'
              }`}
              title="Quick Action Shortcuts"
            >
              {fabOpen ? <Plus className="w-6 h-6" /> : <Zap className="w-6 h-6 fill-current" />}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
