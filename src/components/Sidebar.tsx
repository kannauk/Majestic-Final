import { 
  LayoutDashboard, ShoppingCart, Wrench, Package, Truck, Landmark, 
  FileSpreadsheet, Database, Settings, LogOut, ChevronLeft, ChevronRight, 
  MapPin, ShieldAlert, Award, X
} from 'lucide-react';
import { User, Branch } from '../types';
import majesticLogo from '../assets/images/majestic_logo_1780307785802.png';

interface SidebarProps {
  user: User | null;
  activeBranch: Branch | null;
  branches: Branch[];
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  onLogout: () => void;
  onBranchChange: (branchId: string) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (o: boolean) => void;
}

export default function Sidebar({
  user,
  activeBranch,
  branches,
  activeMenu,
  setActiveMenu,
  collapsed,
  setCollapsed,
  onLogout,
  onBranchChange,
  mobileSidebarOpen,
  setMobileSidebarOpen
}: SidebarProps) {
  if (!user) return null;

  const isSuperAdmin = user.role === 'super_admin';

  const menuItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'branch_admin'] },
    { id: 'pos', label: 'POS Billing Center', icon: ShoppingCart, roles: ['super_admin', 'branch_admin', 'cashier'] },
    { id: 'repairs', label: 'Repair Workshop', icon: Wrench, roles: ['super_admin', 'branch_admin', 'technician'] },
    { id: 'inventory', label: 'Stock & Inventory', icon: Package, roles: ['super_admin', 'branch_admin', 'inventory_manager'] },
    { id: 'purchasing', label: 'Supplier Purchases', icon: Truck, roles: ['super_admin', 'branch_admin', 'inventory_manager'] },
    { id: 'geo-attendance', label: 'Geo Attendance', icon: MapPin, roles: ['super_admin', 'branch_admin'] },
    { id: 'financials', label: 'Financial Ledgers', icon: Landmark, roles: ['super_admin', 'branch_admin'] },
    { id: 'reports', label: 'Business Reports', icon: FileSpreadsheet, roles: ['super_admin', 'branch_admin'] },
    { id: 'sql-setup', label: 'Supabase SQL Lab', icon: Database, roles: ['super_admin'] },
    { id: 'settings', label: 'ERP Settings', icon: Settings, roles: ['super_admin', 'branch_admin'] }
  ];

  // Filter menu items by user role
  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user.role));

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    branch_admin: 'Branch Admin',
    cashier: 'Cashier',
    technician: 'Technician',
    inventory_manager: 'Stock Manager'
  };

  const isExpanded = !collapsed || mobileSidebarOpen;

  return (
    <aside 
      id="app-sidebar"
      className={`bg-[#090A0C] text-slate-300 flex flex-col justify-between border-r border-[#1F2125] transition-all duration-300 fixed md:static inset-y-0 z-50 h-screen overflow-hidden shrink-0 
        ${mobileSidebarOpen ? 'left-0 w-72 shadow-2xl md:shadow-none' : '-left-72 md:left-0'} 
        ${collapsed ? 'md:w-20' : 'md:w-72'}
      `}
    >
      {/* Brand logo header */}
      <div className="p-5 border-b border-[#1F2125] flex items-center justify-between" id="sidebar-header">
        {isExpanded ? (
          <div className="flex items-center gap-2.5">
            <img 
              src={majesticLogo} 
              alt="Majestic Logo" 
              className="w-9 h-9 object-cover rounded-xl"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase leading-none">
                Majestic <span className="text-zinc-400">Computers</span>
              </h1>
              <p className="text-[9px] font-bold tracking-widest text-[#00E5FF] uppercase leading-none mt-1">ERP Engine</p>
            </div>
          </div>
        ) : (
          <img 
            src={majesticLogo} 
            alt="Majestic Logo" 
            className="w-9 h-9 object-cover rounded-xl mx-auto shadow-md"
            referrerPolicy="no-referrer"
          />
        )}

        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1 rounded-md hover:bg-[#16181D] text-slate-500 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        {/* Close mobile drawer button */}
        <button 
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-lg hover:bg-[#16181D] text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation menu items */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" id="sidebar-navigation">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-3 px-2">Navigation</div>
        {filteredMenuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveMenu(item.id);
                setMobileSidebarOpen(false); // Auto-dismiss mobile drawer
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive 
                  ? 'bg-slate-800 text-white border-l transition-all border-orange-500 pl-4 shadow-sm' 
                  : 'text-slate-400 hover:bg-[#16181D] hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-slate-500'}`} />
              {(isExpanded || mobileSidebarOpen) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Branch switching indicators and User settings in the footer */}
      <div className="p-4 border-t border-[#1F2125] bg-[#090A0C]/80 space-y-3" id="sidebar-footer">
        {/* Branch Context info card */}
        {isExpanded ? (
          <div className="bg-[#16181D] rounded-xl p-3 border border-[#2A2D35] space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium tracking-wide">
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
              <span>ACTIVE BRANCH:</span>
            </div>
            
            {isSuperAdmin ? (
              <select
                value={activeBranch?.id || ''}
                onChange={(e) => onBranchChange(e.target.value)}
                className="w-full bg-[#0F1115] text-xs font-bold text-white border border-[#2A2D35] rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-orange-500 focus:outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-bold text-white px-2.5 py-1.5 bg-[#0F1115] border border-[#2A2D35] rounded-lg">
                {activeBranch?.name || 'Loading Branch...'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center text-slate-400 cursor-pointer" title={activeBranch?.name}>
            <MapPin className="w-5 h-5 text-orange-500" />
          </div>
        )}

        {/* User profile capsule with role tag */}
        <div className={`flex items-center justify-between ${isExpanded ? 'gap-3' : 'flex-col gap-3 justify-center'} p-1`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'} 
              alt={user.name} 
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-orange-500/30"
            />
            {isExpanded && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">{user.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldAlert className="w-3 h-3 text-orange-400" />
                  <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase">
                    {roleLabels[user.role] || user.role}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={onLogout}
            title="Switch Session / Log Out"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
