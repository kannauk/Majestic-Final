import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Truck, Plus, Clipboard, User, Mail, Phone, Landmark, 
  MapPin, CheckCircle, Clock, AlertCircle, ShoppingBag, FolderSync,
  FileSpreadsheet, Download, Upload, FileUp, FileDown, X, Search, Pencil
} from 'lucide-react';
import { User as UserType, Branch, Supplier, PurchaseOrder, PurchaseItem, Product } from '../types';
import { exportToCSV, parseCSV } from '../utils/excelHelper';
import { extractTextFromPDF } from '../utils/pdfHelper';
import { getSuppliers, createSupplier, updateSupplier } from '../services/suppliers';
import { getPurchases, createPurchase } from '../services/purchases';
import { getPurchaseItems, createPurchaseItems } from '../services/purchaseItems';
import { getProducts, updateProduct } from '../services/products';
import { getBranches } from '../services/branches';
import { getProductStocks, upsertProductStock } from '../services/productStocks';
import { createInventoryLog } from '../services/inventoryLogs';

interface PurchasingProps {
  user: UserType;
  activeBranch: Branch | null;
}

export default function Purchasing({ user, activeBranch }: PurchasingProps) {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders' | 'stock_in'>('suppliers');
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Editing Supplier State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Create Supplier Fields
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supName, setSupName] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Supplier Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedSuppliers, setParsedSuppliers] = useState<Supplier[]>([]);
  const [importFilename, setImportFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create Purchase order fields
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [targetSupplierId, setTargetSupplierId] = useState('');
  const [targetProductId, setTargetProductId] = useState('');
  const [orderQty, setOrderQty] = useState<number>(5);
  const [orderUnitCost, setOrderUnitCost] = useState<number>(0);

  // Stock-In workflow states
  const [stockInSupplierId, setStockInSupplierId] = useState('');
  const [stockInItems, setStockInItems] = useState<any[]>([]);
  const [currentStockInProductId, setCurrentStockInProductId] = useState('');
  const [currentStockInQty, setCurrentStockInQty] = useState<number>(1);
  const [currentStockInUnitCost, setCurrentStockInUnitCost] = useState<number>(0);
  const [stockInPaidAmount, setStockInPaidAmount] = useState<number>(0);
  const [stockInPoNo, setStockInPoNo] = useState('');

  // Status updates
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Load resources
  const [purchasesList, setPurchasesList] = useState<PurchaseOrder[]>([]);
  const [purchaseItemsList, setPurchaseItemsList] = useState<PurchaseItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [productStocks, setProductStocks] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getSuppliers(),
      getPurchases(),
      getPurchaseItems(),
      getProducts(),
      getBranches(),
      getProductStocks()
    ]).then(([s, p, pi, pr, b, ps]) => {
      setSuppliers(s);
      setPurchasesList(p);
      setPurchaseItemsList(pi);
      setCatalogProducts(pr);
      setBranches(b);
      setProductStocks(ps);
    }).catch(console.error);
  }, []);

  // Filter purchase orders branchwise unless super admin
  const filteredPurchases = useMemo(() => {
    if (user.role !== 'super_admin' && user.branch_id) {
      return purchasesList.filter(p => p.branch_id === user.branch_id);
    }
    return purchasesList;
  }, [purchasesList, user]);

  // Filtered suppliers search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase().trim();
    return suppliers.filter(s => 
      s.company_name.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.contact_person.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  // Create Supplier Submit
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supCompany || !supPhone) {
      alert('Please fill supplier name, company and phone.');
      return;
    }

    try {
      const newSup: Omit<Supplier, 'id' | 'created_at'> = {
        name: supName,
        company_name: supCompany,
        contact_person: supContact || 'N/A',
        phone: supPhone,
        email: supEmail || 'wholesale@distributor.com',
        address: supAddress || 'Sri Lanka',
        total_due: 0
      };

      const created = await createSupplier(newSup);
      setSuppliers([created, ...suppliers]);
      setShowSupplierModal(false);

      // Reset
      setSupName('');
      setSupCompany('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
      setSupAddress('');

      setStatusMsg('Supplier registered successfully into Majestic Supplier Registry.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to register supplier.');
    }
  };

  // Export Suppliers to CSV
  const handleExportSuppliers = () => {
    const headers = ['Company Name', 'Contact Person', 'Phone Link', 'Email Address', 'Dispatch Address', 'Outstanding Due (LKR)'];
    const rows = suppliers.map(s => [
      s.company_name,
      s.contact_person,
      s.phone,
      s.email,
      s.address,
      s.total_due
    ]);
    exportToCSV(headers, rows, `Majestic_Suppliers_Registry_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Download Sample Supplier Import Template
  const handleDownloadSupplierTemplate = () => {
    const headers = ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Total Due'];
    const sampleRows = [
      ['Lanka Tech Distributors Ltd', 'Mohamed Shazni', '+94 11 445 4455', 'sales@lankatech.lk', '12, Reclamation Road, Colombo 11', '1200000'],
      ['Premium Component Hub (Pvt) Ltd', 'Kithsiri Bandara', '+94 11 556 7788', 'wholesale@premhub.lk', '334, Kandy Road, Kiribathgoda', '450000']
    ];
    exportToCSV(headers, sampleRows, 'Majestic_Suppliers_Import_Template.csv');
  };

  // Handle Save Supplier Edit
  const handleSaveSupplierEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    try {
      const updated = await updateSupplier(editingSupplier);
      setSuppliers(suppliers.map(s => s.id === updated.id ? updated : s));

      setStatusMsg(`Supplier ledger "${updated.company_name}" updated successfully.`);
      setEditingSupplier(null);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to update supplier.');
    }
  };

  // Handle Supplier File Upload (CSV, Excel, PDF)
  const handleSupplierFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFilename(file.name);
      if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const text = await extractTextFromPDF(file);
          if (text) {
            parseAndValidateSuppliers(text);
          } else {
            alert('No text could be extracted from PDF file.');
          }
        } catch (err: any) {
          alert(`PDF Reading Error: ${err.message || 'Failed to parse PDF file'}`);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target?.result as string;
          if (text) {
            parseAndValidateSuppliers(text);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const parseAndValidateSuppliers = (csvText: string) => {
    try {
      const grid = parseCSV(csvText);
      if (grid.length < 2) {
        alert('File is empty or missing data rows.');
        return;
      }

      const headers = grid[0].map(h => h.toLowerCase().trim());
      
      let companyIdx = headers.findIndex(h => h.includes('company') || h.includes('supplier') || h.includes('name'));
      let contactIdx = headers.findIndex(h => h.includes('contact') || h.includes('person') || h.includes('agent'));
      let phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
      let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
      let addressIdx = headers.findIndex(h => h.includes('address') || h.includes('location'));
      let dueIdx = headers.findIndex(h => h.includes('due') || h.includes('balance') || h.includes('amount'));

      if (companyIdx === -1) companyIdx = 0;
      if (contactIdx === -1) contactIdx = 1;
      if (phoneIdx === -1) phoneIdx = 2;
      if (emailIdx === -1) emailIdx = 3;
      if (addressIdx === -1) addressIdx = 4;
      if (dueIdx === -1) dueIdx = 5;

      const parsedList: Supplier[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

        const company = row[companyIdx]?.trim() || `Supplier #${i}`;
        const contact = row[contactIdx]?.trim() || 'Sales Representative';
        const phone = row[phoneIdx]?.trim() || '+94 11 000 0000';
        const email = row[emailIdx]?.trim() || 'info@supplier.com';
        const address = row[addressIdx]?.trim() || 'Sri Lanka';
        const dueVal = parseFloat(row[dueIdx]?.replace(/[^0-9.-]+/g, '')) || 0;

        parsedList.push({
          id: `s-imp-${Date.now()}-${i}`,
          name: company,
          company_name: company,
          contact_person: contact,
          phone: phone,
          email: email,
          address: address,
          total_due: Math.max(0, dueVal),
          created_at: new Date().toISOString()
        });
      }

      if (parsedList.length === 0) {
        alert('No valid supplier records found in spreadsheet.');
        return;
      }

      setParsedSuppliers(parsedList);
    } catch (err) {
      console.error(err);
      alert('Failed to parse supplier Excel/CSV file. Please verify format.');
    }
  };

  const handleConfirmImportSuppliers = async () => {
    if (parsedSuppliers.length === 0) return;

    try {
      const createdList: Supplier[] = [];
      for (const s of parsedSuppliers) {
        const created = await createSupplier({
          name: s.name,
          company_name: s.company_name,
          contact_person: s.contact_person,
          phone: s.phone,
          email: s.email,
          address: s.address,
          total_due: s.total_due
        });
        createdList.push(created);
      }
      
      setSuppliers([...createdList, ...suppliers]);

      setStatusMsg(`Successfully imported ${createdList.length} supplier ledgers from Excel file!`);
      setShowImportModal(false);
      setParsedSuppliers([]);
      setImportFilename('');

      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to import suppliers.');
    }
  };

  // Submit Purchase Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSupplierId || !targetProductId || !activeBranch) {
      alert('Choose supplier, product and ensure active branch is configured.');
      return;
    }
    if (orderQty <= 0 || orderUnitCost <= 0) {
      alert('Quantity and Unit Cost price must be positive numbers.');
      return;
    }

    try {
      const matchedSupplier = suppliers.find(s => s.id === targetSupplierId)!;
      const prod = catalogProducts.find(p => p.id === targetProductId)!;

      const totalPOCost = orderUnitCost * orderQty;

      // Create PO
      const newPO = await createPurchase({
        po_no: `PO-MAJ-${1000 + purchasesList.length + 1}`,
        supplier_id: targetSupplierId,
        supplier_name: matchedSupplier ? matchedSupplier.name : 'Supplier',
        branch_id: activeBranch.id,
        branch_name: activeBranch.name,
        status: 'pending',
        total_amount: totalPOCost,
        paid_amount: 0,
        due_amount: totalPOCost
      });

      // Create item
      const newItem = await createPurchaseItems([{
        purchase_id: newPO.id,
        product_id: targetProductId,
        product_name: prod.name,
        unit_cost: orderUnitCost,
        quantity: orderQty,
        total: totalPOCost
      }]);

      // Increment supplier ledger total due
      const updatedSupplier = { ...matchedSupplier, total_due: matchedSupplier.total_due + totalPOCost };
      await updateSupplier(updatedSupplier);
      setSuppliers(suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));

      setPurchasesList([newPO, ...purchasesList]);
      setPurchaseItemsList([...newItem, ...purchaseItemsList]);

      setShowOrderModal(false);
      setTargetSupplierId('');
      setTargetProductId('');
      setOrderQty(5);
      setOrderUnitCost(0);

      setStatusMsg(`Purchase Order ${newPO.po_no} flagged as pending cargo arrivals.`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to create purchase order.');
    }
  };

  // Add item to stock-in cart
  const handleAddStockInItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStockInProductId) {
      alert('Please select a product.');
      return;
    }
    if (currentStockInQty <= 0) {
      alert('Quantity must be greater than zero.');
      return;
    }
    if (currentStockInUnitCost < 0) {
      alert('Unit cost cannot be negative.');
      return;
    }

    const prod = catalogProducts.find(p => p.id === currentStockInProductId);
    if (!prod) {
      alert('Product not found.');
      return;
    }

    const existingIndex = stockInItems.findIndex(item => item.product_id === currentStockInProductId);
    if (existingIndex > -1) {
      const updated = [...stockInItems];
      updated[existingIndex].quantity += currentStockInQty;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_cost;
      setStockInItems(updated);
    } else {
      setStockInItems([
        ...stockInItems,
        {
          product_id: currentStockInProductId,
          product_name: prod.name,
          sku: prod.sku,
          quantity: currentStockInQty,
          unit_cost: currentStockInUnitCost,
          total: currentStockInQty * currentStockInUnitCost
        }
      ]);
    }

    // Reset current item selections
    setCurrentStockInProductId('');
    setCurrentStockInQty(1);
    setCurrentStockInUnitCost(0);
  };

  // Remove item from stock-in cart
  const handleRemoveStockInItem = (productId: string) => {
    setStockInItems(stockInItems.filter(item => item.product_id !== productId));
  };

  // Process the full direct Stock-In Purchase
  const handleSaveDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInSupplierId) {
      alert('Please choose a supplier or add a new one first.');
      return;
    }
    if (stockInItems.length === 0) {
      alert('Please add at least one hardware item to stock in.');
      return;
    }
    if (!activeBranch) {
      alert('Target branch not configured. Please ensure you are logged in to a branch.');
      return;
    }

    const totalCost = stockInItems.reduce((sum, item) => sum + item.total, 0);
    const poCode = stockInPoNo.trim() || `PO-MAJ-STOCK-${1000 + purchasesList.length + 1}`;

    try {
      setStatusMsg('Stock-in processing... updating inventory and catalog...');
      const matchedSupplier = suppliers.find(s => s.id === stockInSupplierId)!;

      // 1. Create Purchase Order record
      const newPO = await createPurchase({
        po_no: poCode,
        supplier_id: stockInSupplierId,
        supplier_name: matchedSupplier ? matchedSupplier.company_name : 'Supplier',
        branch_id: activeBranch.id,
        branch_name: activeBranch.name,
        status: 'received', // Immediately stocked in & received
        total_amount: totalCost,
        paid_amount: stockInPaidAmount,
        due_amount: Math.max(0, totalCost - stockInPaidAmount)
      });

      // 2. Create Purchase Item records
      const itemsToInsert = stockInItems.map(item => ({
        purchase_id: newPO.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_cost: item.unit_cost,
        quantity: item.quantity,
        total: item.total
      }));
      const insertedItems = await createPurchaseItems(itemsToInsert);

      // 3. Mutate product stocks, create inventory logs, and update cost prices
      const updatedStocks = [...productStocks];
      for (const item of stockInItems) {
        // Find existing stock record
        const existingStock = productStocks.find(stk => stk.product_id === item.product_id && stk.branch_id === activeBranch.id);
        const currentQty = existingStock ? existingStock.quantity : 0;
        const targetQty = currentQty + item.quantity;

        // Upsert the stock quantity
        const upserted = await upsertProductStock({
          product_id: item.product_id,
          branch_id: activeBranch.id,
          quantity: targetQty,
          min_stock_alert: existingStock ? existingStock.min_stock_alert : 5
        });

        // Update local state copy
        const idx = updatedStocks.findIndex(stk => stk.product_id === item.product_id && stk.branch_id === activeBranch.id);
        if (idx > -1) {
          updatedStocks[idx] = upserted;
        } else {
          updatedStocks.push(upserted);
        }

        // Update product cost_price in master catalog
        const pObj = catalogProducts.find(p => p.id === item.product_id);
        if (pObj && pObj.cost_price !== item.unit_cost) {
          const updatedProd = await updateProduct({
            ...pObj,
            cost_price: item.unit_cost
          });
          // Update local catalog copy
          setCatalogProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
        }

        // Write inventory ledger audit log
        await createInventoryLog({
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          branch_id: activeBranch.id,
          branch_name: activeBranch.name,
          quantity: item.quantity,
          type: 'in',
          description: `Stock-In Purchase cargo received from ${matchedSupplier.company_name} (PO Ref: ${newPO.po_no})`,
          reference_id: newPO.id,
          created_at: new Date().toISOString()
        });
      }

      // 4. Update Supplier ledger outstanding total due
      const dueFromThisPO = Math.max(0, totalCost - stockInPaidAmount);
      if (dueFromThisPO > 0) {
        const updatedSupplier = { ...matchedSupplier, total_due: matchedSupplier.total_due + dueFromThisPO };
        await updateSupplier(updatedSupplier);
        setSuppliers(suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
      }

      // 5. Update local states
      setPurchasesList([newPO, ...purchasesList]);
      setPurchaseItemsList([...insertedItems, ...purchaseItemsList]);
      setProductStocks(updatedStocks);

      // 6. Reset fields
      setStockInSupplierId('');
      setStockInItems([]);
      setStockInPaidAmount(0);
      setStockInPoNo('');

      setStatusMsg(`Success! Cargo purchase ${newPO.po_no} processed. Stock levels replenished.`);
      setTimeout(() => setStatusMsg(null), 4000);
      setActiveTab('orders'); // Go back to cargo PO log list
    } catch (err: any) {
      console.error(err);
      alert(`Error processing Stock-In: ${err.message || 'Verification failure'}`);
    }
  };

  return (
    <div className="space-y-6" id="purchasing-module-root">
      {/* Tab select header */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-zinc-900 border border-zinc-800 p-2 rounded-2xl gap-2 shadow-lg">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Wholesale Suppliers (CRM)
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            Cargo Purchase Orders (PO)
          </button>
          <button
            onClick={() => setActiveTab('stock_in')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'stock_in'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            New Purchase (Stock-In)
          </button>
        </div>

        {user.role === 'super_admin' || user.role === 'inventory_manager' ? (
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'suppliers' ? (
              <>
                <button
                  onClick={handleExportSuppliers}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700"
                  title="Export Suppliers to CSV/Excel"
                >
                  <FileDown className="w-4 h-4 text-cyan-400" />
                  Export
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <FileUp className="w-4 h-4" />
                  Import Excel
                </button>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Add Supplier
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowOrderModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                Raise Purchase PO
              </button>
            )}
          </div>
        ) : null}
      </div>

      {statusMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {activeTab === 'suppliers' ? (
        /* Wholesale Suppliers list panel */
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-800 pb-4 gap-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              Wholesale Distributors & Supplier Registry ({suppliers.length})
            </h4>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl pl-8 pr-3 py-2 text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {filteredSuppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold text-left">
                    <th className="pb-3 text-left">Company Name</th>
                    <th className="pb-3 text-left">Agent Contact</th>
                    <th className="pb-3 text-left">Email Address</th>
                    <th className="pb-3 text-left">Phone Link</th>
                    <th className="pb-3 text-left">Dispatch Address</th>
                    <th className="pb-3 text-right">Outstanding Due</th>
                    <th className="pb-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredSuppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-bold text-white">{sup.company_name}</td>
                      <td className="py-3.5 text-slate-300">{sup.contact_person}</td>
                      <td className="py-3.5 font-mono text-cyan-400">{sup.email}</td>
                      <td className="py-3.5 font-mono text-slate-300">{sup.phone}</td>
                      <td className="py-3.5 text-slate-400">{sup.address}</td>
                      <td className="py-3.5 text-right font-black text-emerald-400">
                        Rs. {sup.total_due.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingSupplier(sup)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/50"
                          title="Edit Supplier Profile"
                        >
                          <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <Truck className="w-10 h-10 text-slate-600" />
              <div>
                <p className="font-bold text-slate-200 text-sm">No Suppliers Registered in Registry</p>
                <p className="text-slate-400 text-xs mt-1 max-w-sm">
                  Import your vendor catalog from Excel/CSV or manually add a new supplier ledger.
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <FileUp className="w-4 h-4" /> Import from Excel
                </button>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" /> Add Supplier
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'orders' ? (
        /* Cargo Purchase Orders list panel */
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4" id="cargo-purchases-log-list">
          <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <FolderSync className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            Cargo Procurement Workflow Logs (Target Branch: {activeBranch?.name})
          </h4>

          {filteredPurchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold text-left uppercase text-[10px] tracking-wider">
                    <th className="pb-3">PO Code</th>
                    <th className="pb-3 text-left">Supplier Link</th>
                    <th className="pb-3 text-left">Receiving Hub</th>
                    <th className="pb-3 text-right">Value Order</th>
                    <th className="pb-3 text-center">Receipt Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredPurchases.map(po => (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono font-bold text-cyan-400">{po.po_no}</td>
                      <td className="py-3.5 font-bold text-white">{po.supplier_name}</td>
                      <td className="py-3.5 text-slate-300">{po.branch_name}</td>
                      <td className="py-3.5 text-right font-black text-white">Rs. {po.total_amount.toLocaleString()}</td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          po.status === 'received' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <Clipboard className="w-8 h-8 text-slate-600" />
              No active purchase orders issued.
            </div>
          )}
        </div>
      ) : (
        /* Direct Purchase Stock-In Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="direct-stock-in-dashboard">
          {/* Form Side */}
          <div className="lg:col-span-5 space-y-5">
            {/* Supplier & Header */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                1. Select Wholesaler & Reference
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 block font-bold mb-1.5 text-xs">
                    Choose Supplier:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={stockInSupplierId}
                      onChange={(e) => setStockInSupplierId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2.5 rounded-xl outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.company_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowSupplierModal(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
                      title="Add New Supplier"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block font-bold mb-1.5 text-xs">
                    Supplier Bill/Invoice Ref No:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-991"
                    value={stockInPoNo}
                    onChange={(e) => setStockInPoNo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block font-bold mb-1 text-xs">
                    Receiving Warehouse Hub:
                  </label>
                  <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl text-xs text-slate-300 font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>{activeBranch?.name || 'Main branch'} ({activeBranch?.location || 'Unconfigured Location'})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Add Hardware Items Form */}
            <form onSubmit={handleAddStockInItem} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. Select Hardware Item to Stock In
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 block font-bold mb-1.5 text-xs">
                    Choose Hardware Product:
                  </label>
                  <select
                    value={currentStockInProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setCurrentStockInProductId(pid);
                      const prod = catalogProducts.find(p => p.id === pid);
                      if (prod) {
                        setCurrentStockInUnitCost(prod.cost_price || 0);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2.5 rounded-xl outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose Product --</option>
                    {catalogProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} [{p.sku}]</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block font-bold mb-1.5 text-xs">
                      Quantity to Stock In:
                    </label>
                    <input
                      type="number"
                      value={currentStockInQty || ''}
                      onChange={(e) => setCurrentStockInQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                      placeholder="e.g. 10"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block font-bold mb-1.5 text-xs">
                      Purchase Cost Price (Rs.):
                    </label>
                    <input
                      type="number"
                      value={currentStockInUnitCost || ''}
                      onChange={(e) => setCurrentStockInUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs rounded-xl text-white outline-none focus:border-indigo-500 font-bold text-emerald-400 font-mono"
                      placeholder="Rs. Unit Price"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/30 font-extrabold py-2.5 rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Item to Purchase list
                </button>
              </div>
            </form>
          </div>

          {/* Table / Receipt Basket Side */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl h-full flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-indigo-400" />
                    Purchase Cargo Invoice List
                  </h4>
                  <span className="bg-slate-950 px-3 py-1 rounded-full text-[10px] text-indigo-400 font-mono font-bold">
                    {stockInItems.length} Items Added
                  </span>
                </div>

                {stockInItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold text-left uppercase text-[9px] tracking-wider">
                          <th className="pb-2">Hardware Details</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-right">Cost Price</th>
                          <th className="pb-2 text-right">Total Price</th>
                          <th className="pb-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 text-slate-300">
                        {stockInItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/20">
                            <td className="py-2.5 pr-2">
                              <p className="font-bold text-white text-xs">{item.product_name}</p>
                              <span className="font-mono text-[9px] text-slate-400">{item.sku}</span>
                            </td>
                            <td className="py-2.5 text-center font-bold text-slate-200">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 text-right font-mono text-slate-400">
                              Rs. {item.unit_cost.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-white">
                              Rs. {item.total.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveStockInItem(item.product_id)}
                                className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remove Item"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                    <ShoppingBag className="w-8 h-8 text-slate-700" />
                    <div>
                      <p className="font-bold text-slate-300 text-xs">Purchase list is empty</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Choose hardware products on the left and add them here to stock-in.</p>
                    </div>
                  </div>
                )}
              </div>

              {stockInItems.length > 0 && (
                <div className="border-t border-slate-850 pt-4 space-y-4">
                  {/* Totals Section */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-slate-400 block mb-1 text-[10px]">Total Purchase Cost:</span>
                        <span className="text-base font-black text-white font-mono">
                          Rs. {stockInItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1 text-[10px]">Due to Supplier Ledger:</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">
                          Rs. {Math.max(0, stockInItems.reduce((sum, item) => sum + item.total, 0) - stockInPaidAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 bg-slate-950/30 p-4 rounded-2xl border border-slate-800">
                      <div>
                        <label className="text-slate-400 block font-bold mb-1 text-[11px]">
                          Amount Paid Now (Rs.):
                        </label>
                        <input
                          type="number"
                          value={stockInPaidAmount || ''}
                          onChange={(e) => setStockInPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-slate-950 border border-slate-850 p-2 text-xs rounded-lg text-emerald-400 font-mono font-bold outline-none focus:border-indigo-500"
                          placeholder="e.g. 50000"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Any unpaid amount will be added to Supplier Ledger due balance.
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDirectPurchase}
                    className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> Save Purchase & replenish branch stock
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / CSV SUPPLIER IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-2xl w-full space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-extrabold text-white">Import Suppliers from Excel / CSV</h4>
              </div>
              <button 
                onClick={() => { setShowImportModal(false); setParsedSuppliers([]); setImportFilename(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: File selection & template download */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <p className="font-bold text-white">Need a spreadsheet format?</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Download our pre-formatted Excel CSV supplier template.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSupplierTemplate}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/60 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleSupplierFileSelect}
                  accept=".csv, .xlsx, .xls, .pdf, .txt"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto transition-colors" />
                <div>
                  <p className="text-xs font-bold text-white">Click to Upload Supplier File (PDF, Excel, CSV)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF documents, .CSV and Excel spreadsheets</p>
                </div>
                {importFilename && (
                  <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[11px] font-mono px-3 py-1 rounded-full border border-emerald-500/30 font-bold">
                    File selected: {importFilename}
                  </span>
                )}
              </div>
            </div>

            {/* Parsed Preview Table */}
            {parsedSuppliers.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Validated {parsedSuppliers.length} supplier records
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">Ready for database import</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/80 p-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-left font-bold text-[10px] uppercase">
                        <th className="p-2">Company</th>
                        <th className="p-2">Contact</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2 text-right">Outstanding Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedSuppliers.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-2 font-bold text-white">{s.company_name}</td>
                          <td className="p-2 text-slate-300">{s.contact_person}</td>
                          <td className="p-2 font-mono text-cyan-400">{s.phone}</td>
                          <td className="p-2 text-right font-black text-emerald-400">Rs. {s.total_due.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImportSuppliers}
                  className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg text-xs uppercase tracking-wider cursor-pointer"
                >
                  Confirm & Import {parsedSuppliers.length} Suppliers into Database
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER FORM DIALOG */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-extrabold text-white flex justify-between items-center border-b border-slate-800 pb-3">
              <span>Register New Supplier</span>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                <X className="w-4 h-4" />
              </button>
            </h4>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Company / Wholesaler Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Lanka Tech Distributors Ltd"
                  value={supCompany}
                  onChange={(e) => setSupCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Supplier Brand Label / Trade Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Lanka Tech"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Contact Person:</label>
                  <input
                    type="text"
                    placeholder="e.g. Mohamed Shazni"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Mobile Phone:</label>
                  <input
                    type="text"
                    placeholder="+94 11 445 4455"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  placeholder="sales@supplier.com"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Office / Warehouse Address:</label>
                <textarea
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  placeholder="Address details"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Register Supplier Ledger Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CARGO PURCHASE ORDERS FORM DIALOG */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-extrabold text-white flex justify-between items-center border-b border-slate-800 pb-3">
              <span>Issue Procurement Purchase PO</span>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                <X className="w-4 h-4" />
              </button>
            </h4>

            <form onSubmit={handleCreateOrder} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Choose Wholesaler Partner:</label>
                <select
                  value={targetSupplierId}
                  onChange={(e) => setTargetSupplierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">-- Choose Supplier Ledger --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Choose Catalog Hardware Item:</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">-- Choose Hardware SKU --</option>
                  {catalogProducts.filter(p => {
                    if (!activeBranch) return true;
                    // Only list products that exist (have a stock record) in the active branch
                    return productStocks.some(stk => stk.product_id === p.id && stk.branch_id === activeBranch.id);
                  }).map(p => (
                    <option key={p.id} value={p.id}>{p.name} [{p.sku}]</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Quantity Order:</label>
                  <input
                    type="number"
                    value={orderQty || ''}
                    onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl outline-none focus:border-indigo-500 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Unit Cost (LKR):</label>
                  <input
                    type="number"
                    value={orderUnitCost || ''}
                    onChange={(e) => setOrderUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl outline-none focus:border-indigo-500 font-bold"
                    placeholder="Rs. LKR"
                    required
                  />
                </div>
              </div>

              <div className="border border-indigo-500/30 bg-indigo-500/10 p-3 rounded-xl text-center font-bold text-indigo-300">
                Total PO Quote: Rs. {(orderQty * orderUnitCost).toLocaleString()} LKR
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Log Order to Pending Cargo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER PROFILE MODAL */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-extrabold text-white">Edit Supplier Details</h4>
              </div>
              <button onClick={() => setEditingSupplier(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Company / Wholesaler Name:</label>
                <input
                  type="text"
                  value={editingSupplier.company_name}
                  onChange={(e) => setEditingSupplier({ 
                    ...editingSupplier, 
                    company_name: e.target.value,
                    name: e.target.value 
                  })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Contact Person:</label>
                  <input
                    type="text"
                    value={editingSupplier.contact_person}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Phone Number:</label>
                  <input
                    type="text"
                    value={editingSupplier.phone}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  value={editingSupplier.email}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Office / Warehouse Address:</label>
                <textarea
                  value={editingSupplier.address}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Outstanding Balance Due (LKR):</label>
                <input
                  type="number"
                  value={editingSupplier.total_due}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, total_due: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold text-emerald-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Save Supplier Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
