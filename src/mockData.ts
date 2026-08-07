import { 
  Branch, User, ProductCategory, Brand, Product, ProductStock, Customer, 
  Invoice, InvoiceItem, RepairJob, RepairUpdate, Supplier, PurchaseOrder, 
  PurchaseItem, Expense, InventoryLog, SystemNotification, CompanySetting, 
  UserRole, PaymentMethod, PaymentStatus, SplitPaymentDetail, RepairStatus, WarrantyPeriod
} from './types';

// Let's generate a list of branches
const DEFAULT_BRANCHES: Branch[] = [
  { id: 'b-banbalapitiya', name: 'Banbalapitiya Branch', location: 'No. 320, Galle Road, Banbalapitiya', code: 'BAN-01', phone: '+94 11 258 1234', email: 'banbalapitiya@majestic.com', created_at: '2026-01-10T08:00:00Z' },
  { id: 'b-dematagoda', name: 'Dematagoda Branch', location: 'No. 54, Baseline Road, Dematagoda', code: 'DEM-02', phone: '+94 11 268 5678', email: 'dematagoda@majestic.com', created_at: '2026-01-15T08:00:00Z' }
];

// Default Categories
const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: 'cat-laptops', name: 'Laptops', code: 'LPT' },
  { id: 'cat-desktops', name: 'Desktops', code: 'DSK' },
  { id: 'cat-ram', name: 'RAM Memory', code: 'RAM' },
  { id: 'cat-storage', name: 'Storage (SSD/HDD)', code: 'STG' },
  { id: 'cat-gpu', name: 'Graphics Cards', code: 'GPU' },
  { id: 'cat-motherboards', name: 'Motherboards', code: 'MBD' },
  { id: 'cat-printers', name: 'Printers', code: 'PRN' },
  { id: 'cat-accessories', name: 'Accessories', code: 'ACC' },
  { id: 'cat-mobile', name: 'Mobile Phones', code: 'MOB' }
];

// Default Brands
const DEFAULT_BRANDS: Brand[] = [
  { id: 'br-asus', name: 'ASUS' },
  { id: 'br-hp', name: 'HP' },
  { id: 'br-corsair', name: 'Corsair' },
  { id: 'br-samsung', name: 'Samsung' },
  { id: 'br-nvidia', name: 'Nvidia' },
  { id: 'br-gigabyte', name: 'Gigabyte' },
  { id: 'br-epson', name: 'Epson' },
  { id: 'br-majestic', name: 'Majestic Custom' },
  { id: 'br-apple', name: 'Apple' },
  { id: 'br-xiaomi', name: 'Xiaomi' },
  { id: 'br-oppo', name: 'Oppo' },
  { id: 'br-vivo', name: 'Vivo' }
];

// Default Users representing different RBAC levels & Branches
const DEFAULT_USERS: User[] = [
  {
    id: 'u-abi',
    email: 'abi@majestic.com',
    username: 'abi',
    name: 'abi',
    role: 'super_admin',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    active: true,
    permissions: ['all'],
    created_at: '2026-06-01T00:00:00Z',
    password: 'abi2026'
  }
];

// Default Products in Catalog (Empty demo products as requested)
const DEFAULT_PRODUCTS: Product[] = [];

// Branchwise Quantity mapping
const DEFAULT_PRODUCT_STOCKS: ProductStock[] = [];

// Default Customers
const DEFAULT_CUSTOMERS: Customer[] = [];

// Default Suppliers
const DEFAULT_SUPPLIERS: Supplier[] = [];

// Default Setting
const DEFAULT_SETTING: CompanySetting = {
  id: 'setting-1',
  company_name: 'Majestic Computers',
  address: 'No. 45, Galle Road, Colombo 03, Sri Lanka',
  phone: '+94 11 234 5678',
  email: 'support@majesticcomputers.com',
  website: 'https://www.majesticcomputers.lk',
  tax_enabled: true,
  tax_rate: 15, // 15% VAT
  currency_symbol: 'Rs.',
  terms_conditions: 'Thank you for your business. Warranty covers manufacturing bugs. Physical locks and burned chips are out of warranty scopes.'
};

// Default Invoices / Invoicing seeds
const DEFAULT_INVOICES: Invoice[] = [];

const DEFAULT_INVOICE_ITEMS: InvoiceItem[] = [];

// Default Repair Tickets
const DEFAULT_REPAIRS: RepairJob[] = [];

const DEFAULT_REPAIR_UPDATES: RepairUpdate[] = [];

// Default Expenses
const DEFAULT_EXPENSES: Expense[] = [];

// Default Purchase Orders (POs) from suppliers
const DEFAULT_PURCHASES: PurchaseOrder[] = [];

const DEFAULT_PURCHASE_ITEMS: PurchaseItem[] = [];

// Default Notifications
const DEFAULT_NOTIFICATIONS: SystemNotification[] = [];

// Inventory Logs
const DEFAULT_INVENTORY_LOGS: InventoryLog[] = [];


// Database Engine class holding the operational state
class MockDatabase {
  constructor() {
    // Automatically purge old mock trial data once to ensure a clean slate
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('majestic_erp_cleared_trial_v4')) {
        localStorage.removeItem('majestic_erp_branches');
        localStorage.removeItem('majestic_erp_users');
        localStorage.removeItem('majestic_erp_categories');
        localStorage.removeItem('majestic_erp_brands');
        localStorage.removeItem('majestic_erp_products');
        localStorage.removeItem('majestic_erp_stocks');
        localStorage.removeItem('majestic_erp_customers');
        localStorage.removeItem('majestic_erp_suppliers');
        localStorage.removeItem('majestic_erp_invoices');
        localStorage.removeItem('majestic_erp_invoice_items');
        localStorage.removeItem('majestic_erp_repairs');
        localStorage.removeItem('majestic_erp_repair_updates');
        localStorage.removeItem('majestic_erp_expenses');
        localStorage.removeItem('majestic_erp_purchases');
        localStorage.removeItem('majestic_erp_purchase_items');
        localStorage.removeItem('majestic_erp_notifications');
        localStorage.removeItem('majestic_erp_inventory_logs');
        localStorage.removeItem('majestic_erp_setting');
        localStorage.removeItem('majestic_erp_session_user');
        localStorage.setItem('majestic_erp_cleared_trial_v4', 'true');
      }
    } catch (e) {
      console.error(e);
    }
  }

  private getStorage<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(`majestic_erp_${key}`);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`majestic_erp_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error("Local storage set failed: ", e);
    }
  }

  // Schema state fields
  public getBranches(): Branch[] { return this.getStorage('branches', DEFAULT_BRANCHES); }
  public saveBranches(data: Branch[]) { this.setStorage('branches', data); }

  public getUsers(): User[] {
    let users = this.getStorage<User[]>('users', DEFAULT_USERS);
    
    // Self-healing: ensure 'abi' with password 'abi2026' is active and matches correctly
    const abiUser = users.find(u => u.username === 'abi');
    if (!abiUser) {
      users = [...DEFAULT_USERS, ...users];
      this.saveUsers(users);
    } else if (abiUser.password !== 'abi2026') {
      abiUser.password = 'abi2026';
      abiUser.name = 'abi';
      abiUser.email = 'abi@majestic.com';
      this.saveUsers(users);
    }
    return users;
  }
  public saveUsers(data: User[]) { this.setStorage('users', data); }

  public getCategories(): ProductCategory[] { 
    const cats = this.getStorage('categories', DEFAULT_CATEGORIES);
    if (!cats.some(c => c.name === 'Mobile Phones')) {
      const newCats = [...cats, { id: 'cat-mobile', name: 'Mobile Phones', code: 'MOB' }];
      this.saveCategories(newCats);
      return newCats;
    }
    return cats;
  }
  public saveCategories(data: ProductCategory[]) { this.setStorage('categories', data); }

  public getBrands(): Brand[] { 
    const brands = this.getStorage('brands', DEFAULT_BRANDS);
    if (!brands.some(b => b.name === 'Apple')) {
      const newBrands = [...brands, { id: 'br-apple', name: 'Apple' }, { id: 'br-xiaomi', name: 'Xiaomi' }, { id: 'br-oppo', name: 'Oppo' }, { id: 'br-vivo', name: 'Vivo' }];
      this.saveBrands(newBrands);
      return newBrands;
    }
    return brands;
  }
  public saveBrands(data: Brand[]) { this.setStorage('brands', data); }

  public getProducts(): Product[] { return this.getStorage('products', DEFAULT_PRODUCTS); }
  public saveProducts(data: Product[]) { this.setStorage('products', data); }

  public getProductStocks(): ProductStock[] { return this.getStorage('stocks', DEFAULT_PRODUCT_STOCKS); }
  public saveProductStocks(data: ProductStock[]) { this.setStorage('stocks', data); }

  public getCustomers(): Customer[] { return this.getStorage('customers', DEFAULT_CUSTOMERS); }
  public saveCustomers(data: Customer[]) { this.setStorage('customers', data); }

  public getSuppliers(): Supplier[] { return this.getStorage('suppliers', DEFAULT_SUPPLIERS); }
  public saveSuppliers(data: Supplier[]) { this.setStorage('suppliers', data); }

  public getInvoices(): Invoice[] { return this.getStorage('invoices', DEFAULT_INVOICES); }
  public saveInvoices(data: Invoice[]) { this.setStorage('invoices', data); }

  public getInvoiceItems(): InvoiceItem[] { return this.getStorage('invoice_items', DEFAULT_INVOICE_ITEMS); }
  public saveInvoiceItems(data: InvoiceItem[]) { this.setStorage('invoice_items', data); }

  public getRepairs(): RepairJob[] { return this.getStorage('repairs', DEFAULT_REPAIRS); }
  public saveRepairs(data: RepairJob[]) { this.setStorage('repairs', data); }

  public getRepairUpdates(): RepairUpdate[] { return this.getStorage('repair_updates', DEFAULT_REPAIR_UPDATES); }
  public saveRepairUpdates(data: RepairUpdate[]) { this.setStorage('repair_updates', data); }

  public getExpenses(): Expense[] { return this.getStorage('expenses', DEFAULT_EXPENSES); }
  public saveExpenses(data: Expense[]) { this.setStorage('expenses', data); }

  public getPurchases(): PurchaseOrder[] { return this.getStorage('purchases', DEFAULT_PURCHASES); }
  public savePurchases(data: PurchaseOrder[]) { this.setStorage('purchases', data); }

  public getPurchaseItems(): PurchaseItem[] { return this.getStorage('purchase_items', DEFAULT_PURCHASE_ITEMS); }
  public savePurchaseItems(data: PurchaseItem[]) { this.setStorage('purchase_items', data); }

  public getNotifications(): SystemNotification[] { return this.getStorage('notifications', DEFAULT_NOTIFICATIONS); }
  public saveNotifications(data: SystemNotification[]) { this.setStorage('notifications', data); }

  public getInventoryLogs(): InventoryLog[] { return this.getStorage('inventory_logs', DEFAULT_INVENTORY_LOGS); }
  public saveInventoryLogs(data: InventoryLog[]) { this.setStorage('inventory_logs', data); }

  public getSetting(): CompanySetting { return this.getStorage('setting', DEFAULT_SETTING); }
  public saveSetting(data: CompanySetting) { this.setStorage('setting', data); }

  // Current session management user
  public getSession(): User | null {
    const session = this.getStorage<User | null>('session_user', DEFAULT_USERS[0]);
    if (session) {
      const users = this.getUsers();
      const isValid = users.some(u => u.username === session.username || u.id === session.id);
      if (isValid) return session;
    }
    return DEFAULT_USERS[0]; // fallback to super admin 'abi'
  }
  public saveSession(user: User | null) {
    this.setStorage('session_user', user);
  }

  // Restore defaults
  public resetToDefaults() {
    localStorage.removeItem('majestic_erp_branches');
    localStorage.removeItem('majestic_erp_users');
    localStorage.removeItem('majestic_erp_categories');
    localStorage.removeItem('majestic_erp_brands');
    localStorage.removeItem('majestic_erp_products');
    localStorage.removeItem('majestic_erp_stocks');
    localStorage.removeItem('majestic_erp_customers');
    localStorage.removeItem('majestic_erp_suppliers');
    localStorage.removeItem('majestic_erp_invoices');
    localStorage.removeItem('majestic_erp_invoice_items');
    localStorage.removeItem('majestic_erp_repairs');
    localStorage.removeItem('majestic_erp_repair_updates');
    localStorage.removeItem('majestic_erp_expenses');
    localStorage.removeItem('majestic_erp_purchases');
    localStorage.removeItem('majestic_erp_purchase_items');
    localStorage.removeItem('majestic_erp_notifications');
    localStorage.removeItem('majestic_erp_inventory_logs');
    localStorage.removeItem('majestic_erp_setting');
    this.saveSession(DEFAULT_USERS[0]); // Reset logged-in user to abi
    window.location.reload();
  }

  // Quick helper to search products barcode or query
  public lookupProduct(query: string, branchId: string) {
    const products = this.getProducts();
    const stocks = this.getProductStocks();
    const cleanQ = query.toLowerCase();

    return products
      .map(p => {
        const stock = stocks.find(s => s.product_id === p.id && s.branch_id === branchId);
        return {
          ...p,
          stock: stock ? stock.quantity : 0,
          min_stock_alert: stock ? stock.min_stock_alert : 2,
        };
      })
      .filter(p => p.sku.toLowerCase().includes(cleanQ) || 
                   p.name.toLowerCase().includes(cleanQ) || 
                   p.barcode.includes(cleanQ));
  }

  // Process POS checkout
  public processSale(params: {
    branchId: string;
    customerName: string;
    customerPhone?: string;
    customerId?: string;
    items: { productId: string; quantity: number; discount: number; sellingPrice: number }[];
    discount: number; // overall
    paymentMethod: PaymentMethod;
    paidAmount: number;
    splitDetails?: SplitPaymentDetail;
    cashierName: string;
    notes?: string;
  }): Invoice {
    const branches = this.getBranches();
    const activeBranch = branches.find(b => b.id === params.branchId) || branches[0];
    const invoices = this.getInvoices();
    const invoiceItems = this.getInvoiceItems();
    const stocks = this.getProductStocks();
    const products = this.getProducts();
    const settings = this.getSetting();
    const logs = this.getInventoryLogs();
    const notifs = this.getNotifications();

    // Auto Invoice number e.g. MAJ-COL-0005
    const branchCode = activeBranch.code.substring(0, 3).toUpperCase();
    const branchSalesCount = invoices.filter(inv => inv.branch_id === params.branchId).length + 1;
    const invNo = `MAJ-${branchCode}-${String(branchSalesCount).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    params.items.forEach(itm => {
      subtotal += (itm.sellingPrice - itm.discount) * itm.quantity;
    });

    const discountedSubtotal = Math.max(0, subtotal - params.discount);
    const isTaxEnabled = settings.tax_enabled !== false;
    const taxRate = isTaxEnabled ? settings.tax_rate : 0;
    const tax = Math.round(discountedSubtotal * (taxRate / 100));
    const total = discountedSubtotal + tax;

    let paymentStatus: PaymentStatus = 'paid';
    if (params.paidAmount < total) {
      paymentStatus = params.paidAmount > 0 ? 'partially_paid' : 'unpaid';
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoice_no: invNo,
      branch_id: params.branchId,
      branch_name: activeBranch.name,
      customer_id: params.customerId,
      customer_name: params.customerName || 'Walk-In Customer',
      customer_phone: params.customerPhone,
      subtotal,
      discount: params.discount,
      tax,
      total,
      payment_method: params.paymentMethod,
      payment_status: paymentStatus,
      paid_amount: params.paidAmount,
      split_payment_details: params.splitDetails,
      refund_status: 'none',
      created_by_name: params.cashierName,
      notes: params.notes,
      created_at: new Date().toISOString()
    };

    // 1. Save invoice
    this.saveInvoices([newInvoice, ...invoices]);

    // 2. Save items & Stock adjust
    const updatedStocks = [...stocks];
    const newItems: InvoiceItem[] = [];
    const newLogs: InventoryLog[] = [];

    params.items.forEach((itm, idx) => {
      const prod = products.find(p => p.id === itm.productId)!;
      const invItm: InvoiceItem = {
        id: `it-${Date.now()}-${idx}`,
        invoice_id: newInvoice.id,
        product_id: itm.productId,
        product_name: prod.name,
        sku: prod.sku,
        unit_price: itm.sellingPrice,
        quantity: itm.quantity,
        discount: itm.discount,
        total: (itm.sellingPrice - itm.discount) * itm.quantity
      };
      newItems.push(invItm);

      // Decrement stock record
      const stockIdx = updatedStocks.findIndex(s => s.product_id === itm.productId && s.branch_id === params.branchId);
      if (stockIdx !== -1) {
        const oldQty = updatedStocks[stockIdx].quantity;
        const newQty = Math.max(0, oldQty - itm.quantity);
        updatedStocks[stockIdx].quantity = newQty;

        // Check low stock triggers
        if (newQty <= updatedStocks[stockIdx].min_stock_alert) {
          const warnText = `${prod.name} is low on stock (${newQty} left) in ${activeBranch.name}.`;
          notifs.unshift({
            id: `not-${Date.now()}-${idx}`,
            title: 'Critical Low Stock Warning',
            message: warnText,
            type: newQty === 0 ? 'error' : 'warning',
            branch_id: params.branchId,
            read: false,
            created_at: new Date().toISOString()
          });
        }
      }

      // Add audit logs
      newLogs.push({
        id: `log-${Date.now()}-${idx}`,
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        branch_id: params.branchId,
        branch_name: activeBranch.name,
        quantity: itm.quantity,
        type: 'out',
        description: `Sold to ${newInvoice.customer_name} under invoice ${newInvoice.invoice_no}`,
        reference_id: newInvoice.id,
        created_at: new Date().toISOString()
      });
    });

    this.saveInvoiceItems([...newItems, ...invoiceItems]);
    this.saveProductStocks(updatedStocks);
    this.saveInventoryLogs([...newLogs, ...logs]);
    this.saveNotifications(notifs);

    // Update customer loyalty points if customer exists
    if (params.customerId) {
      const custs = this.getCustomers();
      const cIdx = custs.findIndex(c => c.id === params.customerId);
      if (cIdx !== -1) {
        // Rs 1000 = 1 loyalty point
        const gainedPoints = Math.floor(total / 1000);
        custs[cIdx].loyalty_points += gainedPoints;
        this.saveCustomers(custs);
      }
    }

    return newInvoice;
  }

  // Create new repair ticket
  public createRepairJob(params: {
    branchId: string;
    customerName: string;
    customerPhone: string;
    deviceType: string;
    brand: string;
    model: string;
    serialNumber: string;
    problemDesc: string;
    accessories: string[];
    technicianId?: string;
    estimatedCost: number;
    notes?: string;
    signatureData?: string;
    createdBy: string;
  }): RepairJob {
    const branches = this.getBranches();
    const branch = branches.find(b => b.id === params.branchId) || branches[0];
    const repairs = this.getRepairs();
    const updates = this.getRepairUpdates();

    const branchCode = branch.code.substring(0, 3).toUpperCase();
    const count = repairs.filter(r => r.branch_id === params.branchId).length + 1;
    const ticketNo = `TK-${branchCode}-${1000 + count}`;

    const users = this.getUsers();
    const tech = users.find(u => u.id === params.technicianId);

    const newJob: RepairJob = {
      id: `rep-${Date.now()}`,
      ticket_no: ticketNo,
      branch_id: params.branchId,
      branch_name: branch.name,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      device_type: params.deviceType,
      brand: params.brand,
      model: params.model,
      serial_number: params.serialNumber,
      problem_desc: params.problemDesc,
      accessories: params.accessories,
      technician_id: params.technicianId,
      technician_name: tech ? tech.name : 'Unassigned',
      estimated_cost: params.estimatedCost,
      actual_cost: 0,
      status: 'received',
      warranty_period: 'none',
      notes: params.notes,
      signature_data: params.signatureData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const firstUpdate: RepairUpdate = {
      id: `ru-${Date.now()}`,
      repair_id: newJob.id,
      status: 'received',
      notes: 'Job ticket registered with accessories: ' + params.accessories.join(', '),
      updated_by_name: params.createdBy,
      updated_at: new Date().toISOString()
    };

    this.saveRepairs([newJob, ...repairs]);
    this.saveRepairUpdates([firstUpdate, ...updates]);

    return newJob;
  }

  // Update repair status
  public updateRepairStatus(
    repairId: string, 
    status: RepairStatus, 
    notes: string, 
    cost: number, 
    warranty: WarrantyPeriod,
    updatedBy: string
  ): RepairJob {
    const repairs = this.getRepairs();
    const updates = this.getRepairUpdates();
    const idx = repairs.findIndex(r => r.id === repairId);
    if (idx === -1) throw new Error('Repair job not found');

    const job = repairs[idx];
    const oldStatus = job.status;
    job.status = status;
    job.notes = notes;
    job.warranty_period = warranty;
    if (cost > 0) job.actual_cost = cost;
    job.updated_at = new Date().toISOString();

    const newUpdate: RepairUpdate = {
      id: `ru-${Date.now()}`,
      repair_id: repairId,
      status: status,
      notes: notes,
      updated_by_name: updatedBy,
      updated_at: new Date().toISOString()
    };

    repairs[idx] = job;
    this.saveRepairs(repairs);
    this.saveRepairUpdates([newUpdate, ...updates]);

    // Send mock notification
    const notifs = this.getNotifications();
    notifs.unshift({
      id: `not-${Date.now()}`,
      title: 'Repair Status Updated',
      message: `Repair Ticket ${job.ticket_no} changed from "${oldStatus}" to "${status}" by ${updatedBy}.`,
      type: 'info',
      branch_id: job.branch_id,
      read: false,
      created_at: new Date().toISOString()
    });
    this.saveNotifications(notifs);

    return job;
  }

  // Stock transfer between branches
  public transferStock(
    productId: string,
    fromBranchId: string,
    toBranchId: string,
    quantity: number,
    remarks: string,
    operator: string
  ) {
    const products = this.getProducts();
    const prod = products.find(p => p.id === productId);
    if (!prod) throw new Error('Product not found');

    const stocks = this.getProductStocks();
    const fromIdx = stocks.findIndex(s => s.product_id === productId && s.branch_id === fromBranchId);
    const toIdx = stocks.findIndex(s => s.product_id === productId && s.branch_id === toBranchId);

    if (fromIdx === -1 || stocks[fromIdx].quantity < quantity) {
      throw new Error('Insufficient stock in source branch');
    }

    const branches = this.getBranches();
    const fromBranch = branches.find(b => b.id === fromBranchId)!;
    const toBranch = branches.find(b => b.id === toBranchId)!;

    // Adjust quantities
    stocks[fromIdx].quantity -= quantity;
    if (toIdx !== -1) {
      stocks[toIdx].quantity += quantity;
    } else {
      // Create new branch stock row
      stocks.push({
        id: `ps-${Date.now()}`,
        product_id: productId,
        branch_id: toBranchId,
        quantity: quantity,
        min_stock_alert: 2
      });
    }

    this.saveProductStocks(stocks);

    // Create logs
    const logs = this.getInventoryLogs();
    const refId = `tx-${Date.now()}`;
    const newLogs: InventoryLog[] = [
      {
        id: `log-${Date.now()}-out`,
        product_id: productId,
        product_name: prod.name,
        sku: prod.sku,
        branch_id: fromBranchId,
        branch_name: fromBranch.name,
        quantity: quantity,
        type: 'transfer_out',
        description: `Transferred ${quantity} items to ${toBranch.name}. Remarks: ${remarks}`,
        reference_id: refId,
        created_at: new Date().toISOString()
      },
      {
        id: `log-${Date.now()}-in`,
        product_id: productId,
        product_name: prod.name,
        sku: prod.sku,
        branch_id: toBranchId,
        branch_name: toBranch.name,
        quantity: quantity,
        type: 'transfer_in',
        description: `Received ${quantity} items from ${fromBranch.name}. Remarks: ${remarks}`,
        reference_id: refId,
        created_at: new Date().toISOString()
      }
    ];

    this.saveInventoryLogs([...newLogs, ...logs]);

    // Send notifications
    const notifs = this.getNotifications();
    notifs.unshift({
      id: `not-${Date.now()}`,
      title: 'Branch Stock Transfer',
      message: `${operator} transferred ${quantity}x ${prod.name} from ${fromBranch.name} to ${toBranch.name}.`,
      type: 'success',
      branch_id: toBranchId,
      read: false,
      created_at: new Date().toISOString()
    });
    this.saveNotifications(notifs);

    return true;
  }
}

export const db = new MockDatabase();
