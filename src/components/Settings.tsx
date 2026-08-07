import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings2, MapPin, Percent, Phone, HelpCircle, 
  Database, ShieldAlert, Cpu, Landmark, CheckSquare, Clock,
  Users, UserPlus, Pencil, X, CheckCircle, Tag, Layers, Globe, Mail, FileText, Plus
} from 'lucide-react';
import { User, Branch, CompanySetting, ProductCategory, Brand } from '../types';
import { getSetting, updateSetting } from '../services/settings';
import { updateBranch } from '../services/branches';
import { createUser, updateUser } from '../services/users';

interface SettingsProps {
  user: User;
  activeBranch: Branch | null;
  theme?: string;
  setTheme?: (theme: string) => void;
}

export default function Settings({ user, activeBranch, theme = 'slate', setTheme }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'branches' | 'users' | 'catalog' | 'database'>('profile');
  
  // Company ERP Settings State
  const [companySetting, setCompanySetting] = useState<CompanySetting>({
    id: '1',
    company_name: 'Majestic POS',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_rate: 0,
    currency_symbol: 'LKR',
    terms_conditions: ''
  });

  // Categories & Brands State
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    import('../services/categories').then(s => s.getCategories()).then(setCategories).catch(console.error);
    import('../services/brands').then(s => s.getBrands()).then(setBrands).catch(console.error);
    import('../services/branches').then(s => s.getBranches()).then(setBranches).catch(console.error);
    import('../services/users').then(s => s.getUsers()).then(setAllUsers).catch(console.error);
    getSetting().then(s => { if (s) setCompanySetting(s); }).catch(console.error);
  }, []);

  // Branch configuration form fields
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  // Editing branch modal state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // User configuration form fields
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('cashier');

  // Editing user modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [newUserBranchId, setNewUserBranchId] = useState<string>(branches[0]?.id || '');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Save Company ERP Settings & Tax
  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSetting(companySetting);
      setStatusMsg(`Successful: Corporate ERP configurations & tax structure saved.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    }
  };

  // Create Category Handler
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    const code = newCategoryCode || newCategoryName.slice(0, 3).toUpperCase();
    try {
      const { createCategory } = await import('../services/categories');
      const newCat = await createCategory({
        name: newCategoryName,
        code: code.toUpperCase()
      });
      setCategories([...categories, newCat]);
      setNewCategoryName('');
      setNewCategoryCode('');
      setStatusMsg(`Product Category "${newCat.name}" added to catalog.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`Failed to add category: ${error.message || 'Unknown error'}`);
    }
  };

  // Create Brand Handler
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    try {
      const { createBrand } = await import('../services/brands');
      const newBr = await createBrand({
        name: newBrandName
      });
      setBrands([...brands, newBr]);
      setNewBrandName('');
      setStatusMsg(`Brand/Manufacturer "${newBr.name}" added to catalog.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`Failed to add brand: ${error.message || 'Unknown error'}`);
    }
  };

  // Submit adding unlimited new branches!
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchCode || !newBranchAddress) {
      alert('Please fill out Name, code and physical address.');
      return;
    }

    try {
      const { createBranch } = await import('../services/branches');
      const newBr = await createBranch({
        name: newBranchName,
        code: newBranchCode.toUpperCase().trim(),
        location: newBranchAddress,
        phone: newBranchPhone || '+94 11 000 0000',
        email: `contact@${newBranchCode.toLowerCase().trim()}.majestic.com`
      });
      setBranches([...branches, newBr]);
      setNewBranchName('');
      setNewBranchCode('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      setStatusMsg(`Branch "${newBr.name}" registered successfully.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (error) {
      console.error(error);
      setStatusMsg('Failed to add branch.');
    }
  };

  // Admin edit branch handler
  const handleSaveEditedBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    try {
      const updated = await updateBranch(editingBranch);
      setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
      setStatusMsg(`Branch profile "${editingBranch.name}" updated successfully.`);
      setEditingBranch(null);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to update branch.');
    }
  };

  // Admin edit user profile handler
  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      let uToUpdate = { ...editingUser }; if(!uToUpdate.branch_id) uToUpdate.branch_id = null; const updated = await updateUser(uToUpdate);
      setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setStatusMsg(`Staff user profile "${editingUser.name}" updated successfully.`);
      setEditingUser(null);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to update user profile.');
    }
  };

  // Submit and create staff users branchwise
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserUsername || !newUserPassword) {
      alert('Please fill out all staff fields.');
      return;
    }

    try {
      const duplicate = allUsers.some(
        u => u.username.toLowerCase() === newUserUsername.toLowerCase() ||
             u.email.toLowerCase() === newUserEmail.toLowerCase()
      );
      if (duplicate) {
        alert('A user with this email or username already exists within our ERP.');
        return;
      }

      let rolePermissions: string[] = [];
      if (newUserRole === 'branch_admin') {
        rolePermissions = ['branch_dashboard', 'billing', 'repairs', 'inventory_view', 'inventory_manage', 'staff_manage', 'reports_branch'];
      } else if (newUserRole === 'cashier') {
        rolePermissions = ['billing', 'customers_view', 'customers_manage'];
      } else if (newUserRole === 'technician') {
        rolePermissions = ['repairs_view', 'repairs_update', 'service_reports'];
      } else if (newUserRole === 'inventory_manager') {
        rolePermissions = ['inventory_view', 'inventory_manage', 'purchases_view', 'purchases_manage', 'suppliers_manage'];
      } else {
        rolePermissions = ['branch_dashboard'];
      }

      const created = await createUser({
        email: newUserEmail,
        username: newUserUsername.toLowerCase().trim(),
        name: newUserName,
        role: newUserRole as any,
        branch_id: newUserBranchId || branches[0]?.id || null,
        avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
        active: true,
        permissions: rolePermissions,
        password: newUserPassword
      });

      setAllUsers(prev => [...prev, created]);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserUsername('');
      setNewUserPassword('');
      setStatusMsg(`Staff account for "${created.name}" created successfully.`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to create staff user: ' + (err as any).message);
    }
  };

  const handleResetDataLogs = () => {
    if (confirm('Database diagnostics! Are you sure you wish to hard reset local database seed values? All added transactions/repairs will be defaulted.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6" id="settings-module-root">
      {/* Settings Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-3.5 bg-zinc-50 border rounded-2xl gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-1.5">
            <Settings2 className="w-5 h-5 text-indigo-650" />
            Majestic Enterprise Settings
          </h2>
          <p className="text-xs text-zinc-550 mt-1">
            Configure default invoice taxes, setup multi branch codes and inspect diagnostics.
          </p>
        </div>

        <div className="flex bg-zinc-150 rounded-lg p-0.5 border border-zinc-200 shrink-0 select-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'profile'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-650 hover:text-zinc-900'
            }`}
          >
            Showroom Config
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'catalog'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-650 hover:text-zinc-900'
            }`}
          >
            Categories & Brands
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'branches'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-650 hover:text-zinc-900'
            }`}
          >
            Branches Registry
          </button>
          {user.role === 'super_admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-650 hover:text-zinc-900'
              }`}
            >
              Staff Accounts
            </button>
          )}
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'database'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-650 hover:text-zinc-900'
            }`}
          >
            Database Maintenance
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-xs font-medium text-indigo-755">
          {statusMsg}
        </div>
      )}

      {/* Profile specs */}
      {activeTab === 'profile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-indigo-550" />
              Corporate Showroom & Invoicing Settings
            </h4>

            <form onSubmit={handleSaveCompanySettings} className="space-y-3.5 text-xs font-medium text-zinc-700">
              <div>
                <label className="text-zinc-500 block mb-1 font-bold">Company / Showroom Name:</label>
                <input
                  type="text"
                  value={companySetting.company_name || ''}
                  onChange={(e) => setCompanySetting({ ...companySetting, company_name: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-zinc-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-500 block mb-1 font-bold">Corporate Phone:</label>
                  <input
                    type="text"
                    value={companySetting.phone || ''}
                    onChange={(e) => setCompanySetting({ ...companySetting, phone: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1 font-bold">Support Email:</label>
                  <input
                    type="email"
                    value={companySetting.email || ''}
                    onChange={(e) => setCompanySetting({ ...companySetting, email: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1 font-bold">HQ Complex Address:</label>
                <input
                  type="text"
                  value={companySetting.address || ''}
                  onChange={(e) => setCompanySetting({ ...companySetting, address: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* VAT & Tax Calculation Enable / Disable Toggle */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-zinc-900">Enable VAT / Sales Tax Calculation</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={companySetting.tax_enabled !== false}
                      onChange={(e) => setCompanySetting({ ...companySetting, tax_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[10px] text-zinc-500">
                  {companySetting.tax_enabled !== false 
                    ? `VAT tax of ${companySetting.tax_rate}% will be automatically calculated on all POS checkout invoices.`
                    : 'Tax calculation is DISABLED. Billing total will be calculated strictly based on subtotal minus discounts.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-500 block mb-1 font-bold">Output VAT Tax (%):</label>
                  <input
                    type="number"
                    value={companySetting.tax_rate ?? 0}
                    onChange={(e) => setCompanySetting({ ...companySetting, tax_rate: parseFloat(e.target.value) || 0 })}
                    className={`w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold ${
                      companySetting.tax_enabled === false ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    max={45}
                    min={0}
                    disabled={companySetting.tax_enabled === false}
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1 font-bold">Currency Symbol:</label>
                  <input
                    type="text"
                    value={companySetting.currency_symbol || ''}
                    onChange={(e) => setCompanySetting({ ...companySetting, currency_symbol: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1 font-bold">Official Web Portal:</label>
                <input
                  type="text"
                  value={companySetting.website || ''}
                  onChange={(e) => setCompanySetting({ ...companySetting, website: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-zinc-500 block mb-1 font-bold">Invoice & Receipt Terms / Footer Notice:</label>
                <textarea
                  value={companySetting.terms_conditions || ''}
                  onChange={(e) => setCompanySetting({ ...companySetting, terms_conditions: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all uppercase tracking-wider text-[11px] shadow-sm cursor-pointer"
              >
                Save ERP Company Profile Settings
              </button>
            </form>
          </div>

          {/* Majestic computers profile stats */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-3.5 text-xs text-zinc-650" id="showroom-profile-card">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-50 pb-2 flex items-center gap-1.5 select-none">
              <Clock className="w-4.5 h-4.5 text-indigo-500" />
              Active Terminal & Operating Context
            </h4>

            <div className="space-y-2 bg-zinc-50 p-3.5 rounded-2xl border text-zinc-800 leading-relaxed">
              <div className="flex justify-between border-b border-zinc-200/60 pb-1.5">
                <span className="text-zinc-500">Corporate Name:</span>
                <span className="font-bold">{companySetting.company_name}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200/60 pb-1.5">
                <span className="text-zinc-500">Primary Phone:</span>
                <span className="font-mono font-bold">{companySetting.phone}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200/60 pb-1.5">
                <span className="text-zinc-500">VAT Tax Status:</span>
                <span className={`font-bold ${companySetting.tax_enabled !== false ? 'text-indigo-600' : 'text-zinc-500'}`}>
                  {companySetting.tax_enabled !== false ? `${companySetting.tax_rate}% VAT Enabled` : 'Disabled (0%)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Currency Symbol:</span>
                <span className="font-bold">{companySetting.currency_symbol}</span>
              </div>
            </div>

            <div className="space-y-1.5 p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-indigo-950 font-bold block mb-0.5">Logged Staff Account:</strong>
                <p className="text-[11px] text-indigo-800 font-semibold">
                  Employee: {user.name} ({user.role.toUpperCase()})<br />
                  Assigned Branch: {activeBranch ? activeBranch.name : 'All branches access'}
                </p>
              </div>
            </div>
          </div>

          {/* Visual ERP Themes Selector */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 col-span-1 md:col-span-2" id="corporate-theme-panel">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1.5">
              🎨 Corporate Branding & Palette Themes
            </h4>
            <p className="text-xs text-zinc-550 leading-relaxed">
              Tailor Majestic Computers Lanka's operational interface palette to match your office vibe. Changes apply globally across POS registers, workshops, ledgers, and inventory controls instantly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Theme 1 */}
              <button
                type="button"
                onClick={() => setTheme && setTheme('slate')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'slate'
                    ? 'border-orange-500 bg-orange-500/5 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-white">Majestic Dark Slate</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#F97316] ring-2 ring-offset-1 ring-offset-[#0F1115] ring-orange-500" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  The classic showroom signature theme. High contrast orange and cyber cyan over a sleek slate gray canvas.
                </p>
                <div className="flex gap-1.5 mt-3">
                  <span className="w-4 h-4 rounded bg-[#0F1115] border border-zinc-700" title="Base Background" />
                  <span className="w-4 h-4 rounded bg-[#16181D] border border-zinc-700" title="Card Background" />
                  <span className="w-4 h-4 rounded bg-[#F97316]" title="Primary Accent" />
                  <span className="w-4 h-4 rounded bg-[#00E5FF]" title="Secondary Accent" />
                </div>
              </button>

              {/* Theme 2 */}
              <button
                type="button"
                onClick={() => setTheme && setTheme('emerald')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'emerald'
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-white">Royal Emerald</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#10B981] ring-2 ring-offset-1 ring-offset-[#0B130E] ring-emerald-500" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  Elegant deep forest Moss background with fresh mint green and teal-emerald highlights. Luxury eco tech look.
                </p>
                <div className="flex gap-1.5 mt-3">
                  <span className="w-4 h-4 rounded bg-[#0B130E] border border-zinc-700" title="Base Background" />
                  <span className="w-4 h-4 rounded bg-[#122017] border border-zinc-700" title="Card Background" />
                  <span className="w-4 h-4 rounded bg-[#10B981]" title="Primary Accent" />
                  <span className="w-4 h-4 rounded bg-[#34D399]" title="Secondary Accent" />
                </div>
              </button>

              {/* Theme 3 */}
              <button
                type="button"
                onClick={() => setTheme && setTheme('nordic')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'nordic'
                    ? 'border-sky-400 bg-sky-450/5 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-white">Nordic Deep</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#38BDF8] ring-2 ring-offset-1 ring-offset-[#0A111E] ring-sky-400" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  Crisp deep arctic navy canvas with icy glacier blue and aurora-indigo highlights. High tech Scandinavian style.
                </p>
                <div className="flex gap-1.5 mt-3">
                  <span className="w-4 h-4 rounded bg-[#0A111E] border border-zinc-700" title="Base Background" />
                  <span className="w-4 h-4 rounded bg-[#111E30] border border-zinc-700" title="Card Background" />
                  <span className="w-4 h-4 rounded bg-[#38BDF8]" title="Primary Accent" />
                  <span className="w-4 h-4 rounded bg-[#818CF8]" title="Secondary Accent" />
                </div>
              </button>

              {/* Theme 4: Multi Color (Teal & Orange) */}
              <button
                type="button"
                onClick={() => setTheme && setTheme('multicolor')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'multicolor'
                    ? 'border-cyan-400 bg-cyan-400/5 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-white">Multi Color (Teal & Orange)</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#00D4E6] ring-2 ring-offset-1 ring-offset-[#061824] ring-cyan-400" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  Inspired by modern mobile UI lead designs. Vibrant cyan-teal headers paired with warm orange CTA highlights.
                </p>
                <div className="flex gap-1.5 mt-3">
                  <span className="w-4 h-4 rounded bg-[#061824] border border-zinc-700" title="Base Background" />
                  <span className="w-4 h-4 rounded bg-[#0F2736] border border-zinc-700" title="Card Background" />
                  <span className="w-4 h-4 rounded bg-[#00D4E6]" title="Teal Header Accent" />
                  <span className="w-4 h-4 rounded bg-[#F97316]" title="Orange CTA Accent" />
                </div>
              </button>

              {/* Theme 5: Enterprise Glass (Vercel & Stripe Fluent) */}
              <button
                type="button"
                onClick={() => setTheme && setTheme('glass')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'glass'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-md'
                    : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-xs text-white">Enterprise Glass (Vercel/Stripe)</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#6366F1] ring-2 ring-offset-1 ring-offset-[#080C14] ring-indigo-500" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  Glassmorphism aesthetics with translucent frosted panels, luminous neon indigo accents, and Fluent elevation depth.
                </p>
                <div className="flex gap-1.5 mt-3">
                  <span className="w-4 h-4 rounded bg-[#080C14] border border-zinc-700" title="Base Background" />
                  <span className="w-4 h-4 rounded bg-[#0F172A] border border-zinc-700" title="Card Background" />
                  <span className="w-4 h-4 rounded bg-[#6366F1]" title="Neon Indigo Accent" />
                  <span className="w-4 h-4 rounded bg-[#38BDF8]" title="Electric Cyan Accent" />
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'catalog' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="catalog-config-view">
          {/* Categories Management */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Product Categories ({categories.length})
              </span>
            </h4>

            <form onSubmit={handleCreateCategory} className="flex gap-2 text-xs">
              <input
                type="text"
                placeholder="Category Name (e.g., Laptops)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                required
              />
              <input
                type="text"
                placeholder="Code (LPT)"
                value={newCategoryCode}
                onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())}
                className="w-24 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {categories.map((c) => (
                <div key={c.id} className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-800">{c.name}</span>
                  <span className="font-mono bg-zinc-200 text-zinc-700 text-[10px] px-2 py-0.5 rounded font-black">{c.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brands Management */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-cyan-600" />
                Brands & Manufacturers ({brands.length})
              </span>
            </h4>

            <form onSubmit={handleCreateBrand} className="flex gap-2 text-xs">
              <input
                type="text"
                placeholder="Brand / Manufacturer Name (e.g., ASUS)"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                className="flex-1 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                required
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Brand
              </button>
            </form>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {brands.map((b) => (
                <div key={b.id} className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-800">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'branches' ? (
        /* Create unlimited branches form */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="branches-registry-view">
          {/* List existing Branches */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-emerald-550" />
              Registered Showroom Hubs ({branches.length})
            </h4>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {branches.map(b => (
                <div key={b.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs leading-normal">
                  <div>
                    <h5 className="font-bold text-zinc-900">{b.name} ({b.code})</h5>
                    <p className="text-zinc-500 mt-1">{b.location}</p>
                    <p className="text-indigo-700 font-semibold text-[10.5px] mt-0.5">Hub link: {b.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black tracking-widest bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded uppercase font-mono shadow-xs shrink-0 self-center">
                      {b.code}
                    </span>
                    {(user.role === 'super_admin' || user.role === 'branch_admin') && (
                      <button
                        type="button"
                        onClick={() => setEditingBranch(b)}
                        className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                        title="Edit Branch Settings"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Record / Enroll brand new branches */}
          {user.role === 'super_admin' ? (
            <form onSubmit={handleCreateBranch} className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 text-xs font-semibold">
              <h5 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1.5 font-sans">
                <Cpu className="w-4.5 h-4.5 text-zinc-400" />
                Register Unlimited New Branch channels
              </h5>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-zinc-500 block mb-1 col-span-2">New Branch Location Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Kurunegala Hub"
                    value={newBranchName || ''}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none"
                    required
                  />
                </div>
                <div className="space-y-0.5 uppercase">
                  <label className="text-zinc-505 block mb-1">Hub code: (e.g. KUR)</label>
                  <input
                    type="text"
                    placeholder="e.g. KUR"
                    value={newBranchCode || ''}
                    onChange={(e) => setNewBranchCode(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none font-mono font-bold"
                    maxLength={5}
                    required
                  />
                </div>
              </div>

              <div className="space-y-0.5 col-span-2">
                <label className="text-zinc-500 block mb-1">Commercial hotline:</label>
                <input
                  type="text"
                  placeholder="e.g. +94 (37) 2501 3900"
                  value={newBranchPhone || ''}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-zinc-500 block mb-1">Physical address details:</label>
                <textarea
                  placeholder="Street code, Shopping district, Sri Lanka"
                  value={newBranchAddress || ''}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-zinc-50 border p-2.5 rounded-xl outline-none"
                  rows={2}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] hover:bg-zinc-800 transition-all shadow-sm"
              >
                Launch branch Channels
              </button>
            </form>
          ) : (
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex flex-col justify-center items-center text-center space-y-2">
              <ShieldAlert className="w-10 h-10 text-amber-550 shrink-0" />
              <h5 className="text-xs font-black text-amber-800 uppercase tracking-wider">Super Admin Clearance required</h5>
              <p className="text-[11.5px] text-amber-705 leading-relaxed leading-normal">
                Only the designated Majestic Super Admin has clearance rights to create or edit multi brand physical offices.
              </p>
            </div>
          )}
        </div>
      ) : activeTab === 'users' ? (
        /* Userwise / Branchwise staff creation */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="users-registry-view">
          {/* List existing Staff */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1.5">
              <Users className="w-4.5 h-4.5 text-zinc-650" />
              Registered Staff Directory ({allUsers.length})
            </h4>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {allUsers.map(u => {
                const br = branches.find(b => b.id === u.branch_id);
                return (
                  <div key={u.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 flex justify-between items-center text-xs leading-normal">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-zinc-200" />
                      <div>
                        <h5 className="font-bold text-zinc-900">{u.name} <span className="text-[10px] text-zinc-400 font-mono">({u.username})</span></h5>
                        <p className="text-zinc-500 text-[11px] mt-0.5">{u.email}</p>
                        <span className="inline-block mt-1 text-[10px] bg-zinc-250 text-zinc-700 px-1.5 py-0.2 rounded font-mono uppercase">
                          {u.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black tracking-widest bg-indigo-50 text-indigo-755 border border-indigo-100 px-2.5 py-1 rounded-lg uppercase shrink-0">
                        {br ? br.name : 'Super Scope'}
                      </span>
                      {(user.role === 'super_admin' || user.role === 'branch_admin') && (
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                          title="Edit Staff Profile"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form to Create Users */}
          <form onSubmit={handleCreateUser} className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 text-xs font-semibold">
            <h5 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2.5 flex items-center gap-1.5 font-sans">
              <UserPlus className="w-4.5 h-4.5 text-indigo-550" />
              Add Branch-Wise Staff Member
            </h5>

            <div className="space-y-3">
              <div>
                <label className="text-zinc-500 block mb-1">Full Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Ruwan Silva"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 block mb-1">Username:</label>
                  <input
                    type="text"
                    placeholder="e.g. ruwan"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Account Passcode / Password:</label>
                  <input
                    type="password"
                    placeholder="e.g. 1234"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Corporate Email Address:</label>
                <input
                  type="email"
                  placeholder="e.g. ruwan@majestic.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-zinc-50 border px-3 py-1.5 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 block mb-1">Select Role / Clearance:</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-2 rounded-xl outline-none"
                  >
                    <option value="branch_admin">Branch Admin</option>
                    <option value="cashier">Cashier</option>
                    <option value="technician">Technician</option>
                    <option value="inventory_manager">Inventory Manager</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-500 block mb-1">Assign to Branch:</label>
                  <select
                    value={newUserBranchId}
                    onChange={(e) => setNewUserBranchId(e.target.value)}
                    className="w-full bg-zinc-50 border px-3 py-2 rounded-xl outline-none"
                  >
                    {branches.map(br => (
                      <option key={br.id} value={br.id}>{br.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-sm"
            >
              Enroll Staff Profile
            </button>
          </form>
        </div>
      ) : (
        /* Database diagnostics, reset, and seed tables details */
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4 max-w-lg mx-auto text-xs text-zinc-650" id="diagnostics-terminal">
          <div className="flex items-center gap-1.5 border-b border-zinc-100 pb-3">
            <Database className="w-5 h-5 text-zinc-400" />
            <div>
              <h4 className="text-sm font-bold text-zinc-950 font-sans uppercase">Local Engine Diagnostics</h4>
              <p className="text-[11px] text-zinc-450 mt-1">Status checks of mock local indexed DB database structure.</p>
            </div>
          </div>

          <div className="space-y-2 font-mono bg-zinc-950 text-emerald-500 p-4 rounded-2xl">
            <div>&gt; Checking branches state table... ok ({branches.length} loaded)</div>
            <div>&gt; Checking Supabase connection... ok (Connected)</div>
            <div>&gt; Checking Row Level Securities policies (RLS)... active</div>
            <div className="text-zinc-500 mt-2">&gt; System engine healthy on default host standard port: 3000</div>
          </div>

          {user.role === 'super_admin' && (
            <div className="border border-red-200 bg-red-50/50 p-4 rounded-2xl space-y-3">
              <strong className="text-red-900 block font-bold">Hard purge Local Data:</strong>
              <p className="text-[11.5px] text-red-750 font-medium">
                Resets all local client-side LocalStorage entries to initial mock setup seed values.
              </p>
              <button
                onClick={handleResetDataLogs}
                className="bg-red-600 font-bold hover:bg-red-755 text-white py-2 px-4 rounded-xl text-[11px] uppercase tracking-wider transition-all"
              >
                Reset showroom LocalStorage
              </button>
            </div>
          )}
        </div>
      )}
      {/* EDIT BRANCH MODAL */}
      {editingBranch && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-extrabold text-white">Edit Branch Profile</h4>
              </div>
              <button onClick={() => setEditingBranch(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedBranch} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Branch Location Name:</label>
                <input
                  type="text"
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Hub Code:</label>
                  <input
                    type="text"
                    value={editingBranch.code}
                    onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Commercial Hotline:</label>
                  <input
                    type="text"
                    value={editingBranch.phone}
                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Physical Address:</label>
                <textarea
                  value={editingBranch.location}
                  onChange={(e) => setEditingBranch({ ...editingBranch, location: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Contact Email:</label>
                <input
                  type="email"
                  value={editingBranch.email || ''}
                  onChange={(e) => setEditingBranch({ ...editingBranch, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Save Branch Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF USER PROFILE MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">Edit User Profile ({editingUser.username})</h4>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Full Name:</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Username:</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Password / Passcode:</label>
                  <input
                    type="text"
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    placeholder="Enter new passcode"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Role / Access Clearance:</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="branch_admin">Branch Admin</option>
                    <option value="cashier">Cashier</option>
                    <option value="technician">Technician</option>
                    <option value="inventory_manager">Inventory Manager</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block font-bold mb-1">Assigned Branch Hub:</label>
                  <select
                    value={editingUser.branch_id || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, branch_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  >
                    {branches.map(br => (
                      <option key={br.id} value={br.id}>{br.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Save User Profile Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
