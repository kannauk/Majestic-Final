  import { globalPrintHTML } from '../utils/printHelper';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Landmark, DollarSign, ArrowUpRight, ArrowDownRight, Plus, 
  HelpCircle, Calendar, MapPin, Scale, RefreshCcw, CheckCircle, Flame,
  FileSpreadsheet, Download, Upload, FileUp, FileDown, Edit, Trash2, ShieldCheck,
  Printer, Search, User as UserIcon, ShoppingBag, Briefcase, Layers, TrendingDown, Check
} from 'lucide-react';
import { User, Branch, Expense, Invoice, Supplier, Customer, SupplierPayment, CustomerReceipt } from '../types';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../services/expenses';
import { getBranches } from '../services/branches';
import { getSetting } from '../services/settings';
import { getInvoices, updateInvoice } from '../services/invoices';
import { getSuppliers, updateSupplier } from '../services/suppliers';
import { getCustomers, updateCustomer } from '../services/customers';
import { getSupplierPayments, createSupplierPayment } from '../services/supplierPayments';
import { getCustomerReceipts, createCustomerReceipt } from '../services/customerReceipts';
import { exportToCSV, parseCSV } from '../utils/excelHelper';
import SupervisorAuthModal from './SupervisorAuthModal';

interface ParsedFinancialRow {
  date: string;
  category: string;
  branchId: string;
  branchName: string;
  description: string;
  amount: number;
  recordedBy: string;
  status: 'valid' | 'invalid';
  reason?: string;
}

interface ParsedPaymentRow {
  date: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  status: 'valid' | 'invalid';
  reason?: string;
}

interface ParsedReceiptRow {
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string;
  notes: string;
  invoiceId?: string;
  invoiceNo?: string;
  status: 'valid' | 'invalid';
  reason?: string;
}

interface FinancialsProps {
  user: User;
  activeBranch: Branch | null;
}

export default function Financials({ user, activeBranch }: FinancialsProps) {
  const [companyName, setCompanyName] = useState('MAJESTIC COMPUTERS');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'excel'>('dashboard');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // Excel Import States
  const [dragOver, setDragOver] = useState(false);
  const [importType, setImportType] = useState<'expenses' | 'supplier_payments' | 'customer_receipts'>('expenses');
  const [parsedFinRows, setParsedFinRows] = useState<ParsedFinancialRow[]>([]);
  const [parsedPayments, setParsedPayments] = useState<ParsedPaymentRow[]>([]);
  const [parsedReceipts, setParsedReceipts] = useState<ParsedReceiptRow[]>([]);
  const [importFilename, setImportFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expCategory, setExpCategory] = useState('Utility Bills');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDesc, setExpDesc] = useState('');

  // Daily Closing Wizard Tracker
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [drawerCashCount, setDrawerCashCount] = useState<number>(0);
  const [drawerCardCount, setDrawerCardCount] = useState<number>(0);
  const [isStatementClosedForToday, setIsStatementClosedForToday] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Dynamic values
  const [branches, setBranches] = useState<Branch[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [customerReceipts, setCustomerReceipts] = useState<CustomerReceipt[]>([]);

  // Navigation tab within Financials
  const [subSection, setSubSection] = useState<'expenses' | 'supplier_payments' | 'customer_receipts' | 'outstanding_report'>('expenses');

  // States for logging Supplier Payment
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // States for logging Customer Receipt
  const [recCustomerId, setRecCustomerId] = useState('');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recMethod, setRecMethod] = useState('cash');
  const [recNotes, setRecNotes] = useState('');
  const [recRef, setRecRef] = useState('');
  const [recDate, setRecDate] = useState(new Date().toISOString().split('T')[0]);
  const [recInvoiceId, setRecInvoiceId] = useState('');

  // Active print receipt state (for vouchers)
  const [activePrintVoucher, setActivePrintVoucher] = useState<{
    type: 'supplier' | 'customer';
    data: any;
  } | null>(null);

  // Search/Filter states
  const [paySearchTerm, setPaySearchTerm] = useState('');
  const [recSearchTerm, setRecSearchTerm] = useState('');
  const [outSearchTerm, setOutSearchTerm] = useState('');

  useEffect(() => {
    Promise.all([
      getBranches(),
      getInvoices(),
      getExpenses(),
      getSuppliers(),
      getCustomers(),
      getSupplierPayments(),
      getCustomerReceipts()
    ]).then(([b, i, e, s, c, sp, cr]) => {
      setBranches(b);
      setInvoices(i);
      setExpensesList(e);
      setSuppliers(s);
      setCustomers(c);
      setSupplierPayments(sp);
      setCustomerReceipts(cr);
    }).catch(console.error);
  }, []);

  // Editing & Deleting Expense States with Gated Authentication
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editCategory, setEditCategory] = useState('Utility Bills');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDesc, setEditDesc] = useState('');
  
  // Supervisor verification state
  const [authAction, setAuthAction] = useState<{ type: 'edit' | 'delete'; expense: Expense } | null>(null);

  // Filter systems
  const activeBranchId = user.role !== 'super_admin' ? user.branch_id : (activeBranch?.id || null);

  const branchInvoicesFiltered = useMemo(() => {
    return activeBranchId ? invoices.filter(i => i.branch_id === activeBranchId) : invoices;
  }, [invoices, activeBranchId]);

  const branchExpensesFiltered = useMemo(() => {
    return activeBranchId ? expensesList.filter(e => e.branch_id === activeBranchId) : expensesList;
  }, [expensesList, activeBranchId]);

  // Compute stats
  const totals = useMemo(() => {
    // Math of incomes
    let salesTotalEarned = 0;
    let cardTallyExpected = 0;
    let cashTallyExpected = 0;
    let bankTallyExpected = 0;

    branchInvoicesFiltered.forEach(inv => {
      if (inv.refund_status !== 'fully_refunded') {
        salesTotalEarned += inv.total;
        
        if (inv.payment_method === 'cash') {
          cashTallyExpected += inv.total;
        } else if (inv.payment_method === 'card') {
          cardTallyExpected += inv.total;
        } else if (inv.payment_method === 'bank_transfer') {
          bankTallyExpected += inv.total;
        } else if (inv.payment_method === 'split' && inv.split_payment_details) {
          cashTallyExpected += inv.split_payment_details.cash;
          cardTallyExpected += inv.split_payment_details.card;
          bankTallyExpected += inv.split_payment_details.bank;
        }
      }
    });

    // Expenses total
    let totalExpensesPaid = 0;
    branchExpensesFiltered.forEach(e => {
      totalExpensesPaid += e.amount;
    });

    const netProfitAndLoss = Math.max(-totalExpensesPaid, salesTotalEarned - totalExpensesPaid);

    return {
      salesEarned: salesTotalEarned,
      cashTally: cashTallyExpected,
      cardTally: cardTallyExpected,
      bankTally: bankTallyExpected,
      expensesPaid: totalExpensesPaid,
      profitAndLoss: netProfitAndLoss
    };
  }, [branchInvoicesFiltered, branchExpensesFiltered]);

  // Submit expense
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || !expDesc || !activeBranch) {
      alert('Fill all required expense amount and description notes.');
      return;
    }

    try {
      const newExp = await createExpense({
        category: expCategory,
        amount: expAmount,
        description: expDesc,
        branch_id: activeBranch.id,
        branch_name: activeBranch.name,
        expense_date: new Date().toISOString().split('T')[0],
        recorded_by_name: user.name
      });

      setExpensesList(prev => [newExp, ...prev]);
      setShowExpenseModal(false);
      setExpAmount(0);
      setExpDesc('');

      setStatusMsg(`Recorded expense Rs. ${newExp.amount.toLocaleString()} LKR under Category "${newExp.category}".`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to record expense.');
    }
  };

  // Start Edit action
  const handleStartEditExpense = (exp: Expense) => {
    // Check if the current user has direct permissions
    const hasPermission = user.role === 'super_admin' || (user.role === 'branch_admin' && user.branch_id === exp.branch_id);
    
    if (hasPermission) {
      // Auto-authorize!
      setEditingExpense(exp);
      setEditCategory(exp.category);
      setEditAmount(exp.amount);
      setEditDesc(exp.description);
    } else {
      // Request supervisor override
      setAuthAction({ type: 'edit', expense: exp });
    }
  };

  // Start Delete action
  const handleStartDeleteExpense = (exp: Expense) => {
    // Check if the current user has direct permissions
    const hasPermission = user.role === 'super_admin' || (user.role === 'branch_admin' && user.branch_id === exp.branch_id);
    
    if (hasPermission) {
      executeDeleteExpense(exp);
    } else {
      // Request supervisor override
      setAuthAction({ type: 'delete', expense: exp });
    }
  };

  const executeDeleteExpense = async (exp: Expense, authorizedBy?: string) => {
    const confirmationText = authorizedBy 
      ? `Supervisor Approved! Are you sure you want to delete this expense transaction: "Rs. ${exp.amount.toLocaleString()} - ${exp.description}"?`
      : `Are you sure you want to delete this expense transaction: "Rs. ${exp.amount.toLocaleString()} - ${exp.description}"?`;
      
    if (confirm(confirmationText)) {
      try {
        await deleteExpense(exp.id);
        setExpensesList(prev => prev.filter(e => e.id !== exp.id));
        
        const authNotice = authorizedBy ? ` (Authorized by Manager: ${authorizedBy})` : '';
        setStatusMsg(`Successfully deleted expense Rs. ${exp.amount.toLocaleString()}${authNotice}.`);
        setTimeout(() => setStatusMsg(null), 3000);
      } catch (err) {
        console.error(err);
        alert('Failed to delete expense.');
      }
    }
  };

  const handleAuthSuccess = (authorizedBy: string) => {
    if (!authAction) return;
    
    const exp = authAction.expense;
    if (authAction.type === 'edit') {
      // Open the edit modal
      setEditingExpense(exp);
      setEditCategory(exp.category);
      setEditAmount(exp.amount);
      setEditDesc(exp.description);
      
      // Let the user know they are authorized by the manager
      setStatusMsg(`Supervisor authorization granted by ${authorizedBy} for editing.`);
      setTimeout(() => setStatusMsg(null), 3000);
    } else if (authAction.type === 'delete') {
      // Execute deletion with authorized notice
      executeDeleteExpense(exp, authorizedBy);
    }
    
    // Clear authorization action state
    setAuthAction(null);
  };

  const handleSaveEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    
    try {
      const updatedData: Expense = {
        ...editingExpense,
        category: editCategory,
        amount: editAmount,
        description: editDesc
      };

      const updated = await updateExpense(updatedData);
      setExpensesList(prev => prev.map(exp => exp.id === updated.id ? updated : exp));
      setEditingExpense(null);
      
      setStatusMsg(`Successfully updated expense transaction details.`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update expense.');
    }
  };

  // Submit closing
  const handleClosingSummarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsStatementClosedForToday(true);
    setShowClosingModal(false);

    alert(`CLOSING STATEMENT FILED SUCCESSFULLY ON CURRENT TERMINAL!\n\n` + 
          `Registered closing cash Rs. ${drawerCashCount.toLocaleString()}\n` +
          `Expected Cash Rs. ${totals.cashTally.toLocaleString()}\n` +
          `Discrepancy: Rs. ${(drawerCashCount - totals.cashTally).toLocaleString()} LKR\n\n` +
          `Closed by Terminal operator ${user.name}. Daily totals archived successfully.`);
  };

  // --- SUPPLIER PAYMENTS & CUSTOMER RECEIPTS CORE LOGIC ---

  const handleSaveSupplierPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paySupplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (payAmount <= 0) {
      alert('Payment amount must be greater than 0.');
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === paySupplierId);
    if (!matchedSupplier) return;

    try {
      const loggedPay = await createSupplierPayment({
        supplier_id: paySupplierId,
        supplier_name: matchedSupplier.company_name,
        branch_id: activeBranch?.id || branches[0]?.id || 'main',
        branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
        amount: payAmount,
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes || `Payment made to supplier ${matchedSupplier.company_name}`,
        reference_no: payRef || `PAY-SUP-${Date.now().toString().slice(-6)}`,
        recorded_by_name: user.name
      });

      const updatedSup = {
        ...matchedSupplier,
        total_due: Math.max(0, matchedSupplier.total_due - payAmount)
      };
      await updateSupplier(updatedSup);

      const expenseDesc = `Supplier Payment to ${matchedSupplier.company_name} (Ref: ${loggedPay.reference_no})`;
      const newExp = await createExpense({
        category: 'Supplier Payments',
        amount: payAmount,
        description: expenseDesc,
        branch_id: activeBranch?.id || branches[0]?.id || 'main',
        branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
        expense_date: payDate,
        recorded_by_name: user.name
      });

      setSuppliers(prev => prev.map(s => s.id === paySupplierId ? updatedSup : s));
      setSupplierPayments(prev => [loggedPay, ...prev]);
      setExpensesList(prev => [newExp, ...prev]);

      setStatusMsg(`Successfully processed payment of Rs. ${payAmount.toLocaleString()} to ${matchedSupplier.company_name}. Supplier outstanding updated.`);
      
      setActivePrintVoucher({
        type: 'supplier',
        data: loggedPay
      });

      setPaySupplierId('');
      setPayAmount(0);
      setPayNotes('');
      setPayRef('');

      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Failed to register supplier payment.');
    }
  };

  const handleSaveCustomerReceipt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (recAmount <= 0) {
      alert('Receipt amount must be greater than 0.');
      return;
    }

    const matchedCustomer = customers.find(c => c.id === recCustomerId);
    if (!matchedCustomer) return;

    try {
      const loggedRec = await createCustomerReceipt({
        customer_id: recCustomerId,
        customer_name: matchedCustomer.name,
        branch_id: activeBranch?.id || branches[0]?.id || 'main',
        branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
        amount: recAmount,
        payment_method: recMethod,
        payment_date: recDate,
        notes: recNotes || `Payment received from customer ${matchedCustomer.name}`,
        reference_no: recRef || `REC-CUST-${Date.now().toString().slice(-6)}`,
        recorded_by_name: user.name
      });

      const updatedCust = {
        ...matchedCustomer,
        credit_balance: Math.max(0, (matchedCustomer.credit_balance || 0) - recAmount)
      };
      await updateCustomer(updatedCust);

      if (recInvoiceId) {
        const matchedInvoice = invoices.find(inv => inv.id === recInvoiceId);
        if (matchedInvoice) {
          const newPaidAmount = Math.min(matchedInvoice.total, (matchedInvoice.paid_amount || 0) + recAmount);
          const newPaymentStatus = newPaidAmount >= matchedInvoice.total ? 'paid' : 'partially_paid';
          const updatedInv = {
            ...matchedInvoice,
            paid_amount: newPaidAmount,
            payment_status: newPaymentStatus as any
          };
          await updateInvoice(updatedInv);
          setInvoices(prev => prev.map(i => i.id === recInvoiceId ? updatedInv : i));
        }
      }

      setCustomers(prev => prev.map(c => c.id === recCustomerId ? updatedCust : c));
      setCustomerReceipts(prev => [loggedRec, ...prev]);

      setStatusMsg(`Successfully collected receipt of Rs. ${recAmount.toLocaleString()} from ${matchedCustomer.name}. Customer outstanding balance updated.`);

      setActivePrintVoucher({
        type: 'customer',
        data: loggedRec
      });

      setRecCustomerId('');
      setRecAmount(0);
      setRecNotes('');
      setRecRef('');
      setRecInvoiceId('');

      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Failed to register customer receipt.');
    }
  };

  const triggerPrintVoucher = (type: 'supplier' | 'customer', data: any) => {


    const title = type === 'supplier' ? 'Supplier Payment Voucher' : 'Customer Receipt Voucher';
    const amountLabel = type === 'supplier' ? 'Paid Amount' : 'Received Amount';
    const partyLabel = type === 'supplier' ? 'Supplier Details' : 'Customer Details';
    const partyName = type === 'supplier' ? data.supplier_name : data.customer_name;

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #111; }
            .subtitle { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; margin-top: 5px; }
            .voucher-title { font-size: 18px; font-weight: 700; color: #333; margin-top: 15px; text-decoration: underline; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
            .meta-item { font-size: 13px; }
            .meta-label { color: #666; font-weight: bold; margin-bottom: 4px; }
            .meta-value { font-weight: 700; color: #111; font-family: monospace; }
            .amount-box { text-align: center; margin: 40px 0; padding: 25px; border: 2px dashed #4f46e5; border-radius: 12px; background: #f5f3ff; }
            .amount-box h2 { margin: 0; font-size: 14px; color: #4f46e5; text-transform: uppercase; }
            .amount-val { font-size: 32px; font-weight: 900; color: #111; font-family: monospace; margin-top: 10px; }
            .notes-section { font-size: 13px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; }
            .notes-title { font-weight: bold; color: #555; margin-bottom: 6px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 80px; text-align: center; font-size: 12px; }
            .signature-line { border-top: 1px solid #ccc; width: 180px; margin: 0 auto 8px auto; }
            @media print {
              body { padding: 20px; }
              .amount-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div class="subtitle">ERP ENGINE - FINANCIAL LEDGERS</div>
            <div class="voucher-title">${title}</div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Voucher / Ref No:</div>
              <div class="meta-value">${data.reference_no}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Payment Date:</div>
              <div class="meta-value">${data.payment_date || data.created_at?.slice(0, 10)}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Branch Hub:</div>
              <div class="meta-value">${data.branch_name}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">${partyLabel}:</div>
              <div class="meta-value">${partyName}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Payment Mode:</div>
              <div class="meta-value" style="text-transform: uppercase;">${data.payment_method}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Authorized Operator:</div>
              <div class="meta-value">${data.recorded_by_name}</div>
            </div>
          </div>

          <div class="amount-box">
            <h2>${amountLabel} (LKR / Rs.)</h2>
            <div class="amount-val">Rs. ${data.amount.toLocaleString()}</div>
          </div>

          <div class="notes-section">
            <div class="notes-title">Additional Remarks & Ledger Narration:</div>
            <div style="color: #444; font-style: italic;">${data.notes || 'No remarks provided.'}</div>
          </div>

          <div class="signatures">
            <div>
              <div class="signature-line"></div>
              <div>Prepared / Processed By</div>
            </div>
            <div>
              <div class="signature-line"></div>
              <div>Supplier / Client Signature</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    globalPrintHTML(html);
  };

  const triggerPrintOutstandingReport = () => {


    const totalSuppliersDue = suppliers.reduce((sum, s) => sum + (s.total_due || 0), 0);
    const totalCustomersOutstanding = customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0);
    const netOutstanding = totalCustomersOutstanding - totalSuppliersDue;

    const tableRows = [
      ...suppliers.filter(s => s.total_due > 0).map(s => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; color: #e11d48; font-weight: bold;">Supplier Dues</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${s.company_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${s.phone}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; color: #e11d48; font-weight: bold;">Rs. ${s.total_due.toLocaleString()}</td>
        </tr>
      `),
      ...customers.filter(c => c.credit_balance > 0).map(c => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; color: #16a34a; font-weight: bold;">Customer Outstanding</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${c.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${c.phone}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; color: #16a34a; font-weight: bold;">Rs. ${c.credit_balance.toLocaleString()}</td>
        </tr>
      `)
    ].join('\n');

    const html = `
      <html>
        <head>
          <title>Outstanding Ledger Dues Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #111; }
            .subtitle { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; margin-top: 5px; }
            .report-title { font-size: 18px; font-weight: 700; color: #111; margin-top: 15px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 35px; }
            .stat-card { padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .stat-label { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #666; }
            .stat-val { font-size: 20px; font-weight: 800; font-family: monospace; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 20px; }
            th { background: #f5f5f5; padding: 12px 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
            tr:hover { background: #fafafa; }
            .footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 11px; text-align: center; color: #888; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div class="subtitle">ERP ENGINE - SYSTEM AUDITING</div>
            <div class="report-title">Outstanding Ledger Balances Report</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Report Generated: ${new Date().toLocaleString()}</div>
          </div>

          <div class="grid-3">
            <div class="stat-card" style="background-color: #fef2f2; border-color: #fecaca;">
              <div class="stat-label" style="color: #991b1b;">Total Supplier Dues (To Pay)</div>
              <div class="stat-val" style="color: #b91c1c;">Rs. ${totalSuppliersDue.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
              <div class="stat-label" style="color: #166534;">Total Customer Outstanding (To Collect)</div>
              <div class="stat-val" style="color: #15803d;">Rs. ${totalCustomersOutstanding.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background-color: #f0f9ff; border-color: #bae6fd;">
              <div class="stat-label" style="color: #075985;">Net Outstanding Flow</div>
              <div class="stat-val" style="color: #0369a1; font-weight: 900;">Rs. ${netOutstanding.toLocaleString()}</div>
            </div>
          </div>

          <table border="0">
            <thead>
              <tr>
                <th style="width: 25%;">Ledger Group</th>
                <th style="width: 35%;">Supplier Company / Client Name</th>
                <th style="width: 20%;">Mobile Phone</th>
                <th style="text-align: right; width: 20%;">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || `<tr><td colspan="4" style="text-align: center; padding: 40px; color: #888;">No outstanding balances on ledger records.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            Confidential Internal ERP System Audit Document. Do not distribute without authorization.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    globalPrintHTML(html);
  };

  const handleExportSupplierPayments = () => {
    const headers = ['Voucher No', 'Supplier Name', 'Branch', 'Amount (Rs)', 'Payment Method', 'Payment Date', 'Notes', 'Recorded By'];
    const rows = supplierPayments.map(p => [
      p.reference_no,
      p.supplier_name,
      p.branch_name,
      p.amount,
      p.payment_method,
      p.payment_date,
      p.notes || '',
      p.recorded_by_name
    ]);
    exportToCSV(headers, rows, 'Majestic_Supplier_Payments.csv');
  };

  const handleExportCustomerReceipts = () => {
    const headers = ['Receipt No', 'Customer Name', 'Branch', 'Amount (Rs)', 'Payment Method', 'Receipt Date', 'Notes', 'Recorded By'];
    const rows = customerReceipts.map(r => [
      r.reference_no,
      r.customer_name,
      r.branch_name,
      r.amount,
      r.payment_method,
      r.payment_date,
      r.notes || '',
      r.recorded_by_name
    ]);
    exportToCSV(headers, rows, 'Majestic_Customer_Receipts.csv');
  };

  const handleExportOutstandingReport = () => {
    const headers = ['Ledger Type', 'Company / Client Name', 'Mobile Phone', 'Email Address', 'Total Outstanding Dues (Rs)'];
    const rows: any[][] = [];
    
    suppliers.forEach(s => {
      if (s.total_due > 0) {
        rows.push(['Supplier', s.company_name, s.phone, s.email, s.total_due]);
      }
    });

    customers.forEach(c => {
      if (c.credit_balance > 0) {
        rows.push(['Customer', c.name, c.phone, c.email, c.credit_balance]);
      }
    });

    exportToCSV(headers, rows, 'Majestic_Outstanding_Balances_Report.csv');
  };

  const downloadSupplierPaymentsTemplate = () => {
    const headers = ['Payment Date', 'Supplier Company Name', 'Amount Paid', 'Payment Method', 'Reference No', 'Notes'];
    const rows = [
      ['2026-07-01', 'Abans Wholesale Ltd', '250000', 'bank_transfer', 'PAY-ABANS-9021', 'Part payment for cargo PO-1029'],
      ['2026-07-02', 'Singhagiri Distributors', '120000', 'cash', 'PAY-SINGHA-121', 'Settled remaining ledger dues']
    ];
    exportToCSV(headers, rows, 'Majestic_Supplier_Payments_Import_Template.csv');
  };

  const downloadCustomerReceiptsTemplate = () => {
    const headers = ['Receipt Date', 'Customer Name', 'Amount Received', 'Payment Method', 'Reference No', 'Notes', 'Invoice No'];
    const rows = [
      ['2026-07-01', 'John Doe', '50000', 'cash', 'REC-CUST-9901', 'Advance payment for notebook sale', 'INV-2026-002'],
      ['2026-07-02', 'Nimal Silva', '30000', 'bank_transfer', 'REC-CUST-9902', 'Settled outstanding invoice dues', '']
    ];
    exportToCSV(headers, rows, 'Majestic_Customer_Receipts_Import_Template.csv');
  };

  // --- EXCEL ACCOUNTS BULK SYNC LOGIC ---


  const exportLedgerBalancesToExcel = () => {
    const headers = [
      'Account Code',
      'Account Head Name',
      'Account Type',
      'Current Balance (LKR)',
      'Branch Context',
      'Branch ID'
    ];

    const branchName = activeBranch ? activeBranch.name : 'Enterprise Global';
    const branchId = activeBranch ? activeBranch.id : 'all';

    const rows = [
      ['ACC-1010', 'Cash on Hand (Tills)', 'Asset / Cash', totals.cashTally, branchName, branchId],
      ['ACC-1020', 'Credit Card Settlement clearing', 'Asset / Cash Equivalent', totals.cardTally, branchName, branchId],
      ['ACC-1030', 'Bank Transfer Settlement Account', 'Asset / Cash Equivalent', totals.bankTally, branchName, branchId],
      ['ACC-3010', 'Gross Revenue (POS Sales)', 'Revenue', totals.salesEarned, branchName, branchId],
      ['ACC-4010', 'Filing Showroom Expenses', 'Expense', totals.expensesPaid, branchName, branchId],
      ['ACC-9999', 'Nett Operating Profit Margin', 'Equity / Retained Earnings', totals.profitAndLoss, branchName, branchId]
    ];

    exportToCSV(headers, rows, `Majestic_General_Ledger_Balances_${branchId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportExpensesToExcel = () => {
    const headers = [
      'Filing Date',
      'Category Group',
      'Branch Context',
      'Branch ID',
      'Expense Descriptions',
      'Debit Amount (LKR)',
      'Recorded Admin'
    ];

    const rows = branchExpensesFiltered.map(exp => [
      exp.expense_date,
      exp.category,
      exp.branch_name,
      exp.branch_id,
      exp.description,
      exp.amount,
      exp.recorded_by_name
    ]);

    const branchId = activeBranch ? activeBranch.id : 'all';
    exportToCSV(headers, rows, `Majestic_Expenses_Ledger_${branchId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadExpensesTemplate = () => {
    const headers = [
      'Filing Date',
      'Category Group',
      'Branch Name or ID',
      'Expense Descriptions',
      'Debit Amount',
      'Recorded Admin'
    ];

    const rows = [
      ['2026-06-25', 'Utility Bills', 'b-banbalapitiya', 'Showroom internet & fiber router lease May', '48000', 'operator'],
      ['2026-06-26', 'Rent', 'Colombo Branch', 'Colombo head showroom floor space monthly lease', '120000', 'manager']
    ];

    exportToCSV(headers, rows, 'Majestic_Expense_Ledger_Import_Template.csv');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImportFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        if (importType === 'expenses') {
          parseAndValidateFinancials(text);
        } else if (importType === 'supplier_payments') {
          parseAndValidateSupplierPayments(text);
        } else if (importType === 'customer_receipts') {
          parseAndValidateCustomerReceipts(text);
        }
      }
    };
    reader.readAsText(file);
  };

  const parseAndValidateFinancials = (csvText: string) => {
    try {
      const grid = parseCSV(csvText);
      if (grid.length < 2) {
        alert('Empty spreadsheet or invalid headers');
        return;
      }

      const rawHeaders = grid[0].map(h => h.toLowerCase().trim());
      
      let dateIdx = rawHeaders.findIndex(h => h.includes('date') || h.includes('time'));
      let catIdx = rawHeaders.findIndex(h => h.includes('category') || h.includes('group'));
      let branchIdx = rawHeaders.findIndex(h => h.includes('branch') || h.includes('location'));
      let descIdx = rawHeaders.findIndex(h => h.includes('desc') || h.includes('note') || h.includes('detail'));
      let amountIdx = rawHeaders.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('cash') || h.includes('cost'));
      let adminIdx = rawHeaders.findIndex(h => h.includes('admin') || h.includes('recorded') || h.includes('by') || h.includes('operator'));

      if (dateIdx === -1) dateIdx = 0;
      if (catIdx === -1) catIdx = 1;
      if (branchIdx === -1) branchIdx = 2;
      if (descIdx === -1) descIdx = 3;
      if (amountIdx === -1) amountIdx = 4;
      if (adminIdx === -1) adminIdx = 5;

      const validated: ParsedFinancialRow[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.length === 0 || row.every(cell => cell === '')) continue;

        const rawDate = row[dateIdx]?.trim() || new Date().toISOString().split('T')[0];
        const rawCat = row[catIdx]?.trim() || 'Utility Bills';
        const rawBranchStr = row[branchIdx]?.trim() || '';
        const rawDesc = row[descIdx]?.trim() || 'Imported expense transaction';
        const rawAmount = parseFloat(row[amountIdx]) >= 0 ? parseFloat(row[amountIdx]) : 0;
        const rawAdmin = row[adminIdx]?.trim() || user.name;

        if (rawAmount <= 0) {
          validated.push({
            date: rawDate,
            category: rawCat,
            branchId: '',
            branchName: rawBranchStr,
            description: rawDesc,
            amount: rawAmount,
            recordedBy: rawAdmin,
            status: 'invalid',
            reason: 'Debit amount must be positive'
          });
          continue;
        }

        let branchMatch = branches.find(b => 
          b.id.toLowerCase() === rawBranchStr.toLowerCase() || 
          b.name.toLowerCase() === rawBranchStr.toLowerCase() || 
          b.code.toLowerCase() === rawBranchStr.toLowerCase()
        );

        if (!branchMatch) {
          branchMatch = activeBranch || branches[0];
        }

        validated.push({
          date: rawDate,
          category: rawCat,
          branchId: branchMatch.id,
          branchName: branchMatch.name,
          description: rawDesc,
          amount: rawAmount,
          recordedBy: rawAdmin,
          status: 'valid'
        });
      }

      setParsedFinRows(validated);
    } catch (err: any) {
      alert(`Spreadsheet parsing error: ${err.message}`);
    }
  };

  const parseAndValidateSupplierPayments = (csvText: string) => {
    try {
      const grid = parseCSV(csvText);
      if (grid.length < 2) {
        alert('Empty spreadsheet or invalid headers');
        return;
      }
      const rawHeaders = grid[0].map(h => h.toLowerCase().trim());
      
      let dateIdx = rawHeaders.findIndex(h => h.includes('date'));
      let supIdx = rawHeaders.findIndex(h => h.includes('supplier') || h.includes('company'));
      let amtIdx = rawHeaders.findIndex(h => h.includes('amount') || h.includes('paid'));
      let methodIdx = rawHeaders.findIndex(h => h.includes('method') || h.includes('mode'));
      let refIdx = rawHeaders.findIndex(h => h.includes('ref') || h.includes('no') || h.includes('voucher'));
      let notesIdx = rawHeaders.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('narration'));

      if (dateIdx === -1) dateIdx = 0;
      if (supIdx === -1) supIdx = 1;
      if (amtIdx === -1) amtIdx = 2;
      if (methodIdx === -1) methodIdx = 3;
      if (refIdx === -1) refIdx = 4;
      if (notesIdx === -1) notesIdx = 5;

      const validated: ParsedPaymentRow[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.length === 0 || row.every(cell => cell === '')) continue;

        const rawDate = row[dateIdx]?.trim() || new Date().toISOString().split('T')[0];
        const rawSupName = row[supIdx]?.trim() || '';
        const rawAmount = parseFloat(row[amtIdx]?.replace(/[^0-9.]/g, '')) || 0;
        const rawMethod = row[methodIdx]?.trim().toLowerCase() || 'cash';
        const rawRef = row[refIdx]?.trim() || `PAY-SUP-IMP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const rawNotes = row[notesIdx]?.trim() || '';

        if (!rawSupName) {
          validated.push({
            date: rawDate,
            supplierId: '',
            supplierName: 'Unknown',
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            status: 'invalid',
            reason: 'Supplier name cannot be empty'
          });
          continue;
        }

        const matchedSup = suppliers.find(s => 
          s.company_name.toLowerCase() === rawSupName.toLowerCase() || 
          s.name.toLowerCase() === rawSupName.toLowerCase()
        );

        if (!matchedSup) {
          validated.push({
            date: rawDate,
            supplierId: '',
            supplierName: rawSupName,
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            status: 'invalid',
            reason: 'Supplier company name not found in CRM'
          });
          continue;
        }

        if (rawAmount <= 0) {
          validated.push({
            date: rawDate,
            supplierId: matchedSup.id,
            supplierName: matchedSup.company_name,
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            status: 'invalid',
            reason: 'Amount must be greater than zero'
          });
          continue;
        }

        validated.push({
          date: rawDate,
          supplierId: matchedSup.id,
          supplierName: matchedSup.company_name,
          amount: rawAmount,
          paymentMethod: rawMethod,
          referenceNo: rawRef,
          notes: rawNotes,
          status: 'valid'
        });
      }

      setParsedPayments(validated);
    } catch (err: any) {
      alert(`Spreadsheet parsing error: ${err.message}`);
    }
  };

  const parseAndValidateCustomerReceipts = (csvText: string) => {
    try {
      const grid = parseCSV(csvText);
      if (grid.length < 2) {
        alert('Empty spreadsheet or invalid headers');
        return;
      }
      const rawHeaders = grid[0].map(h => h.toLowerCase().trim());
      
      let dateIdx = rawHeaders.findIndex(h => h.includes('date'));
      let custIdx = rawHeaders.findIndex(h => h.includes('customer') || h.includes('client') || h.includes('name'));
      let amtIdx = rawHeaders.findIndex(h => h.includes('amount') || h.includes('received'));
      let methodIdx = rawHeaders.findIndex(h => h.includes('method') || h.includes('mode'));
      let refIdx = rawHeaders.findIndex(h => h.includes('ref') || h.includes('no') || h.includes('receipt'));
      let notesIdx = rawHeaders.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('narration'));
      let invIdx = rawHeaders.findIndex(h => h.includes('invoice'));

      if (dateIdx === -1) dateIdx = 0;
      if (custIdx === -1) custIdx = 1;
      if (amtIdx === -1) amtIdx = 2;
      if (methodIdx === -1) methodIdx = 3;
      if (refIdx === -1) refIdx = 4;
      if (notesIdx === -1) notesIdx = 5;
      if (invIdx === -1) invIdx = 6;

      const validated: ParsedReceiptRow[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.length === 0 || row.every(cell => cell === '')) continue;

        const rawDate = row[dateIdx]?.trim() || new Date().toISOString().split('T')[0];
        const rawCustName = row[custIdx]?.trim() || '';
        const rawAmount = parseFloat(row[amtIdx]?.replace(/[^0-9.]/g, '')) || 0;
        const rawMethod = row[methodIdx]?.trim().toLowerCase() || 'cash';
        const rawRef = row[refIdx]?.trim() || `REC-CUST-IMP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const rawNotes = row[notesIdx]?.trim() || '';
        const rawInvNo = row[invIdx]?.trim() || '';

        if (!rawCustName) {
          validated.push({
            date: rawDate,
            customerId: '',
            customerName: 'Unknown',
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            invoiceNo: rawInvNo,
            status: 'invalid',
            reason: 'Customer name cannot be empty'
          });
          continue;
        }

        const matchedCust = customers.find(c => 
          c.name.toLowerCase() === rawCustName.toLowerCase() || 
          (c.phone && c.phone === rawCustName)
        );

        if (!matchedCust) {
          validated.push({
            date: rawDate,
            customerId: '',
            customerName: rawCustName,
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            invoiceNo: rawInvNo,
            status: 'invalid',
            reason: 'Customer not found in CRM database'
          });
          continue;
        }

        if (rawAmount <= 0) {
          validated.push({
            date: rawDate,
            customerId: matchedCust.id,
            customerName: matchedCust.name,
            amount: rawAmount,
            paymentMethod: rawMethod,
            referenceNo: rawRef,
            notes: rawNotes,
            invoiceNo: rawInvNo,
            status: 'invalid',
            reason: 'Amount must be greater than zero'
          });
          continue;
        }

        let linkedInvoiceId = '';
        if (rawInvNo) {
          const matchedInv = invoices.find(inv => 
            inv.invoice_no.toLowerCase() === rawInvNo.toLowerCase() || 
            inv.id === rawInvNo
          );
          if (matchedInv) {
            linkedInvoiceId = matchedInv.id;
          }
        }

        validated.push({
          date: rawDate,
          customerId: matchedCust.id,
          customerName: matchedCust.name,
          amount: rawAmount,
          paymentMethod: rawMethod,
          referenceNo: rawRef,
          notes: rawNotes,
          invoiceId: linkedInvoiceId,
          invoiceNo: rawInvNo,
          status: 'valid'
        });
      }

      setParsedReceipts(validated);
    } catch (err: any) {
      alert(`Spreadsheet parsing error: ${err.message}`);
    }
  };

  const commitFinancialsImport = async () => {
    if (parsedFinRows.length === 0) return;

    try {
      let importedCount = 0;

      for (const row of parsedFinRows) {
        if (row.status === 'invalid') continue;

        const newExp = await createExpense({
          category: row.category,
          amount: row.amount,
          description: row.description,
          branch_id: row.branchId,
          branch_name: row.branchName,
          expense_date: row.date,
          recorded_by_name: row.recordedBy
        });

        setExpensesList(prev => [newExp, ...prev]);
        importedCount++;
      }

      setStatusMsg(`Successfully imported ${importedCount} accounts expense transactions from Excel! Balances updated.`);
      setParsedFinRows([]);
      setImportFilename('');
      setActiveSection('dashboard');
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Failed to import financial rows.');
    }
  };

  const commitSupplierPaymentsImport = async () => {
    if (parsedPayments.length === 0) return;
    try {
      let importedCount = 0;
      const suppliersCopy = [...suppliers];

      for (const row of parsedPayments) {
        if (row.status === 'invalid') continue;

        const matchedSupplier = suppliersCopy.find(s => s.id === row.supplierId);
        if (!matchedSupplier) continue;

        const loggedPay = await createSupplierPayment({
          supplier_id: row.supplierId,
          supplier_name: row.supplierName,
          branch_id: activeBranch?.id || branches[0]?.id || 'main',
          branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
          amount: row.amount,
          payment_method: row.paymentMethod,
          payment_date: row.date,
          notes: row.notes || `Bulk imported payment to ${row.supplierName}`,
          reference_no: row.referenceNo,
          recorded_by_name: user.name
        });

        matchedSupplier.total_due = Math.max(0, matchedSupplier.total_due - row.amount);
        await updateSupplier(matchedSupplier);

        await createExpense({
          category: 'Supplier Payments',
          amount: row.amount,
          description: `Supplier Payment (Import Ref: ${row.referenceNo})`,
          branch_id: activeBranch?.id || branches[0]?.id || 'main',
          branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
          expense_date: row.date,
          recorded_by_name: user.name
        });

        setSupplierPayments(prev => [loggedPay, ...prev]);
        importedCount++;
      }

      setSuppliers(suppliersCopy);
      setStatusMsg(`Successfully bulk imported ${importedCount} supplier payments from Excel! CRM outstanding ledger values refreshed.`);
      setParsedPayments([]);
      setImportFilename('');
      setActiveSection('dashboard');
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error committing supplier payments import.');
    }
  };

  const commitCustomerReceiptsImport = async () => {
    if (parsedReceipts.length === 0) return;
    try {
      let importedCount = 0;
      const customersCopy = [...customers];

      for (const row of parsedReceipts) {
        if (row.status === 'invalid') continue;

        const matchedCust = customersCopy.find(c => c.id === row.customerId);
        if (!matchedCust) continue;

        const loggedRec = await createCustomerReceipt({
          customer_id: row.customerId,
          customer_name: row.customerName,
          branch_id: activeBranch?.id || branches[0]?.id || 'main',
          branch_name: activeBranch?.name || branches[0]?.name || 'Main Hub',
          amount: row.amount,
          payment_method: row.paymentMethod,
          payment_date: row.date,
          notes: row.notes || `Bulk imported receipt from ${row.customerName}`,
          reference_no: row.referenceNo,
          recorded_by_name: user.name
        });

        matchedCust.credit_balance = Math.max(0, (matchedCust.credit_balance || 0) - row.amount);
        await updateCustomer(matchedCust);

        if (row.invoiceId) {
          const matchedInv = invoices.find(inv => inv.id === row.invoiceId);
          if (matchedInv) {
            const newPaidAmount = Math.min(matchedInv.total, (matchedInv.paid_amount || 0) + row.amount);
            const newPaymentStatus = newPaidAmount >= matchedInv.total ? 'paid' : 'partially_paid';
            const updatedInv = {
              ...matchedInv,
              paid_amount: newPaidAmount,
              payment_status: newPaymentStatus as any
            };
            await updateInvoice(updatedInv);
            setInvoices(prev => prev.map(i => i.id === row.invoiceId ? updatedInv : i));
          }
        }

        setCustomerReceipts(prev => [loggedRec, ...prev]);
        importedCount++;
      }

      setCustomers(customersCopy);
      setStatusMsg(`Successfully bulk imported ${importedCount} customer receipts from Excel! Customer outstanding values updated.`);
      setParsedReceipts([]);
      setImportFilename('');
      setActiveSection('dashboard');
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error committing customer receipts import.');
    }
  };


  return (
    <div className="space-y-6" id="financials-module-root">
      {/* Title Header with Closing actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-2xl bg-zinc-50 border border-zinc-205">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-1.5 font-sans">
            <Landmark className="w-5 h-5 text-indigo-650" />
            Financial Ledgers & Cash Flow Audits
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Reconcile POS tills, file company utilities expenses and track profit balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
          <button
            onClick={() => setActiveSection(activeSection === 'excel' ? 'dashboard' : 'excel')}
            className={`text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm uppercase tracking-wider cursor-pointer ${
              activeSection === 'excel'
                ? 'bg-emerald-600 hover:bg-emerald-750 text-white'
                : 'bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            {activeSection === 'excel' ? 'Show Ledger' : 'Excel Bulk Sync'}
          </button>

          <button
            onClick={() => setShowClosingModal(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm uppercase tracking-wider"
          >
            <RefreshCcw className="w-4 h-4" />
            Daily Tills Closing
          </button>
          
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-red-600 hover:bg-red-705 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-755 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {activeSection === 'dashboard' ? (
        <>
          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap border-b border-zinc-200 gap-1 mb-6" id="financials-tabs">
            <button
              type="button"
              onClick={() => setSubSection('expenses')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                subSection === 'expenses'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Showroom Expenses
            </button>
            <button
              type="button"
              onClick={() => setSubSection('supplier_payments')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                subSection === 'supplier_payments'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Supplier Payments
            </button>
            <button
              type="button"
              onClick={() => setSubSection('customer_receipts')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                subSection === 'customer_receipts'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Customer Receipts
            </button>
            <button
              type="button"
              onClick={() => setSubSection('outstanding_report')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                subSection === 'outstanding_report'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Outstanding Report
            </button>
          </div>

          {/* SHOWROOM EXPENSES MODULE */}
          {subSection === 'expenses' && (
            <>
              {/* Grid displays cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" id="finances-overview-cards">
                {/* Total Inflow Sales */}
                <div className="bg-white p-5 border rounded-2xl shadow-sm flex flex-col justify-between hover:border-zinc-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Gross Sales Inflow</span>
                      <h3 className="text-3xl font-extrabold text-zinc-900 mt-2">Rs. {totals.salesEarned.toLocaleString()}</h3>
                    </div>
                    <div className="p-2.5 bg-green-50 rounded-xl text-green-600 shrink-0">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex gap-4 border-t border-zinc-100 pt-3 mt-4 text-[10px] text-zinc-500">
                    <div>Cash expected: <strong className="text-zinc-800 font-bold block mt-0.5">Rs. {totals.cashTally.toLocaleString()}</strong></div>
                    <div>Card expected: <strong className="text-zinc-800 font-bold block mt-0.5">Rs. {totals.cardTally.toLocaleString()}</strong></div>
                  </div>
                </div>

                {/* Expenses total recorded Outflow */}
                <div className="bg-white p-5 border rounded-2xl shadow-sm flex flex-col justify-between hover:border-zinc-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Showroom Outflow (Expenses)</span>
                      <h3 className="text-3xl font-extrabold text-red-650 mt-2">Rs. {totals.expensesPaid.toLocaleString()}</h3>
                    </div>
                    <div className="p-2.5 bg-red-50 rounded-xl text-red-600 shrink-0">
                      <ArrowDownRight className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-405 leading-relaxed mt-4">
                    Utility bills, salary disbursements and physical rent lease charges entered under selected branch context channels.
                  </p>
                </div>

                {/* Nett Profit & Loss balance card */}
                <div className="bg-white p-5 border rounded-2xl shadow-sm flex flex-col justify-between hover:border-zinc-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Showroom Nett Profit Ratio</span>
                      <h3 className="text-3xl font-extrabold text-indigo-650 mt-2">Rs. {totals.profitAndLoss.toLocaleString()}</h3>
                    </div>
                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-650 shrink-0">
                      <Scale className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold mt-4">
                    <CheckCircle className="w-4 h-4" />
                    <span>Positive Operating Gross Margin Balance</span>
                  </div>
                </div>
              </div>

              {/* Split details of Expense log lists */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Expense breakdown list (8 Cols) */}
                <div className="lg:col-span-8 bg-white border p-5 rounded-2xl shadow-sm space-y-4" id="expense-records-table">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 pb-3">
                    <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                      Filing Expense Ledger Logs
                    </h4>
                    <div className="flex gap-1.5">
                      <button
                        onClick={exportExpensesToExcel}
                        className="text-[10.5px] font-bold px-2.5 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 flex items-center gap-1 text-zinc-700 shadow-sm transition-all"
                      >
                        <Download className="w-3 h-3 text-indigo-505" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-left">
                          <th className="pb-3 text-left">Filing Date</th>
                          <th className="pb-3 text-left">Category Group</th>
                          <th className="pb-3 text-left font-serif">Branch Context</th>
                          <th className="pb-3 text-left">Expense Descriptions</th>
                          <th className="pb-3 text-left">Recorded Admin</th>
                          <th className="pb-3 text-right">Debit amount</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-705">
                        {branchExpensesFiltered.map(exp => (
                          <tr key={exp.id} className="hover:bg-zinc-50/50">
                            <td className="py-2.5 font-mono text-zinc-500">{exp.expense_date}</td>
                            <td className="py-2.5 font-bold text-zinc-800">{exp.category}</td>
                            <td className="py-2.5 font-semibold text-indigo-650">{exp.branch_name}</td>
                            <td className="py-2.5 text-zinc-650 font-normal">{exp.description}</td>
                            <td className="py-2.5 text-zinc-450">{exp.recorded_by_name}</td>
                            <td className="py-2.5 text-right font-bold text-red-650">
                              Rs. {exp.amount.toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleStartEditExpense(exp)}
                                className="p-1 text-zinc-400 hover:text-indigo-650 hover:bg-zinc-100 rounded transition-colors inline-flex items-center cursor-pointer"
                                title="Edit Ledger Record"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartDeleteExpense(exp)}
                                className="p-1 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded transition-colors inline-flex items-center cursor-pointer"
                                title="Delete Ledger Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {branchExpensesFiltered.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-zinc-400">
                              No expenses recorded in the selected branch context.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operating closing log helper (4 Cols) */}
                <div className="lg:col-span-4 bg-white border p-5 rounded-2xl shadow-sm space-y-3.5" id="pos-reconciliation-card">
                  <h4 className="text-sm font-semibold text-zinc-950 flex items-center gap-1 px-1">
                    <Scale className="w-4 h-4 text-indigo-505" />
                    Tills Reconciliation
                  </h4>
                  <p className="text-xs text-zinc-600 pl-1">
                    Current system expected cash reserves across active checkout registers:
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between bg-zinc-50 p-2.5 border rounded-xl">
                      <span className="text-zinc-650">Expected cash:</span>
                      <strong className="text-zinc-900 font-bold">Rs. {totals.cashTally.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between bg-zinc-50 p-2.5 border rounded-xl">
                      <span className="text-zinc-650">Expected card card:</span>
                      <strong className="text-zinc-900 font-bold">Rs. {totals.cardTally.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between bg-zinc-50 p-2.5 border rounded-xl">
                      <span className="text-zinc-650">On-Hold Bank Transfers:</span>
                      <strong className="text-zinc-900 font-bold">Rs. {totals.bankTally.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between bg-indigo-50/50 p-2.5 border border-indigo-100 rounded-xl">
                      <span className="text-indigo-900 font-bold">Total Drawer expected:</span>
                      <span className="text-indigo-650 font-black">Rs. {(totals.cashTally + totals.cardTally).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-505 leading-relaxed bg-zinc-50 p-2 rounded-xl mt-2 select-none">
                    *Ensure physical coins, checks and cards print receipts tally with expected values before filing closing statements.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* SUPPLIER PAYMENTS LEDGER */}
          {subSection === 'supplier_payments' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="finances-supplier-payments-container">
              {/* Log Payment Form */}
              <div className="lg:col-span-4 bg-white border rounded-2xl p-5 shadow-sm space-y-4 h-fit">
                <div className="border-b pb-3">
                  <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    Record Supplier Payment
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Disburse cash/bank settlements and update ledger dues.</p>
                </div>

                <form onSubmit={handleSaveSupplierPayment} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Select Supplier:</label>
                    <select
                      value={paySupplierId}
                      onChange={(e) => {
                        setPaySupplierId(e.target.value);
                        const matched = suppliers.find(s => s.id === e.target.value);
                        if (matched) {
                          setPayAmount(matched.total_due);
                        }
                      }}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-semibold text-zinc-800"
                      required
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.company_name} (Due: Rs. {sup.total_due.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-500 font-bold block mb-1">Payment Date:</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-semibold text-zinc-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 font-bold block mb-1">Method:</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-semibold text-zinc-850"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Credit Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Amount Paid (Rs.):</label>
                    <input
                      type="number"
                      value={payAmount || ''}
                      onChange={(e) => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-bold font-mono"
                      placeholder="Enter Rs. LKR"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Reference No / Receipt No:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="e.g. VOUCH-0129"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setPayRef(`PAY-SUP-${Date.now().toString().slice(-6)}`)}
                        className="px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 transition-all font-semibold"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Notes / Narration:</label>
                    <textarea
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Provide additional details regarding payment..."
                      rows={2.5}
                      className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-md mt-2 cursor-pointer"
                  >
                    Post Payment Voucher
                  </button>
                </form>
              </div>

              {/* Payments List Table */}
              <div className="lg:col-span-8 bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Disbursement History</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Showing compiled ledger of supplier settlement payouts.</p>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleExportSupplierPayments}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-650" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        

                        const tableRows = supplierPayments.map(p => `
                          <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.payment_date}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${p.supplier_name}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${p.reference_no}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-transform: uppercase;">${p.payment_method}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">Rs. ${p.amount.toLocaleString()}</td>
                          </tr>
                        `).join('\n');

                        const html = `
                          <html>
                            <head>
                              <title>Supplier Settlement Payments Audit</title>
                              <style>
                                body { font-family: sans-serif; padding: 40px; }
                                h1 { text-align: center; font-size: 20px; text-transform: uppercase; margin-bottom: 4px; }
                                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
                                th { background: #f5f5f5; padding: 10px; border-bottom: 2px solid #ddd; text-align: left; }
                              </style>
                            </head>
                            <body>
                              <h1>${companyName}</h1>
                              <div style="text-align: center; font-size: 11px; color: #555;">Supplier Settlement Payments Audit History - Generated: ${new Date().toLocaleString()}</div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Supplier Name</th>
                                    <th>Voucher Ref No</th>
                                    <th>Payment Method</th>
                                    <th style="text-align: right;">Amount Paid</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 30px;">No payment logs in current statement.</td></tr>'}
                                </tbody>
                              </table>

                            </body>
                          </html>
                        `;
                        globalPrintHTML(html);
                      }}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-505" />
                      Print List
                    </button>
                  </div>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={paySearchTerm}
                    onChange={(e) => setPaySearchTerm(e.target.value)}
                    placeholder="Search payments by supplier name, reference no, notes..."
                    className="w-full bg-zinc-50 hover:bg-zinc-100/50 border border-zinc-200 focus:border-zinc-300 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none transition-all"
                  />
                </div>

                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b text-zinc-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Payment Date</th>
                        <th className="p-3">Supplier Name</th>
                        <th className="p-3">Reference / Ref No</th>
                        <th className="p-3">Payment Method</th>
                        <th className="p-3 text-right">Amount Paid</th>
                        <th className="p-3 text-right">Receipt Voucher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-zinc-700 font-sans">
                      {supplierPayments
                        .filter(p => 
                          p.supplier_name.toLowerCase().includes(paySearchTerm.toLowerCase()) ||
                          p.reference_no.toLowerCase().includes(paySearchTerm.toLowerCase()) ||
                          (p.notes && p.notes.toLowerCase().includes(paySearchTerm.toLowerCase()))
                        )
                        .map((pay, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/40 font-sans">
                            <td className="p-3 font-mono text-zinc-500">{pay.payment_date}</td>
                            <td className="p-3 font-bold">{pay.supplier_name}</td>
                            <td className="p-3 font-mono text-zinc-500">{pay.reference_no}</td>
                            <td className="p-3 capitalize font-semibold">{pay.payment_method.replace('_', ' ')}</td>
                            <td className="p-3 text-right font-extrabold text-red-650">-Rs. {pay.amount.toLocaleString()}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => triggerPrintVoucher('supplier', pay)}
                                className="px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-650 rounded border transition-all text-zinc-600 cursor-pointer"
                              >
                                Print Voucher
                              </button>
                            </td>
                          </tr>
                        ))}
                      {supplierPayments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-zinc-400">
                            No supplier payments recorded. Log a payment on the left panel or sync via Excel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER RECEIPTS LEDGER */}
          {subSection === 'customer_receipts' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="finances-customer-receipts-container">
              {/* Log Receipt Form */}
              <div className="lg:col-span-4 bg-white border rounded-2xl p-5 shadow-sm space-y-4 h-fit">
                <div className="border-b pb-3">
                  <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    Record Customer Receipt
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Process incoming accounts receivables and update customer balances.</p>
                </div>

                <form onSubmit={handleSaveCustomerReceipt} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Select Customer:</label>
                    <select
                      value={recCustomerId}
                      onChange={(e) => {
                        setRecCustomerId(e.target.value);
                        const matched = customers.find(c => c.id === e.target.value);
                        if (matched) {
                          setRecAmount(matched.credit_balance || 0);
                        }
                        setRecInvoiceId('');
                      }}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-semibold text-zinc-800"
                      required
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(cust => (
                        <option key={cust.id} value={cust.id}>
                          {cust.name} (Outstanding: Rs. {(cust.credit_balance || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {recCustomerId && (
                    <div>
                      <label className="text-zinc-500 font-bold block mb-1">Link to Unpaid Invoice (Optional):</label>
                      <select
                        value={recInvoiceId}
                        onChange={(e) => {
                          setRecInvoiceId(e.target.value);
                          const matchedInvoice = invoices.find(inv => inv.id === e.target.value);
                          if (matchedInvoice) {
                            const remaining = matchedInvoice.total - (matchedInvoice.paid_amount || 0);
                            setRecAmount(remaining);
                          }
                        }}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none text-zinc-700"
                      >
                        <option value="">-- Direct payment to credit ledger --</option>
                        {invoices
                          .filter(inv => inv.customer_id === recCustomerId && inv.payment_status !== 'paid')
                          .map(inv => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_no} (Total: Rs. {inv.total.toLocaleString()} - Due: Rs. {(inv.total - (inv.paid_amount || 0)).toLocaleString()})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-500 font-bold block mb-1">Receipt Date:</label>
                      <input
                        type="date"
                        value={recDate}
                        onChange={(e) => setRecDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 font-bold block mb-1">Method:</label>
                      <select
                        value={recMethod}
                        onChange={(e) => setRecMethod(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-semibold"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Credit Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Amount Received (Rs.):</label>
                    <input
                      type="number"
                      value={recAmount || ''}
                      onChange={(e) => setRecAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-bold font-mono"
                      placeholder="Enter Rs. LKR"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Reference No / Receipt No:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={recRef}
                        onChange={(e) => setRecRef(e.target.value)}
                        placeholder="e.g. REC-0129"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setRecRef(`REC-CUST-${Date.now().toString().slice(-6)}`)}
                        className="px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 transition-all font-semibold"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 font-bold block mb-1">Notes / Remarks:</label>
                    <textarea
                      value={recNotes}
                      onChange={(e) => setRecNotes(e.target.value)}
                      placeholder="Remarks..."
                      rows={2.5}
                      className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-755 text-white font-extrabold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-md mt-2 cursor-pointer"
                  >
                    Post Receipt Voucher
                  </button>
                </form>
              </div>

              {/* Receipts List Table */}
              <div className="lg:col-span-8 bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Collection History</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Showing compiled ledger of customer payment collection records.</p>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleExportCustomerReceipts}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-650" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        

                        const tableRows = customerReceipts.map(r => `
                          <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.payment_date}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${r.customer_name}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${r.reference_no}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-transform: uppercase;">${r.payment_method}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">Rs. ${r.amount.toLocaleString()}</td>
                          </tr>
                        `).join('\n');

                        const html = `
                          <html>
                            <head>
                              <title>Customer Payment Collections History</title>
                              <style>
                                body { font-family: sans-serif; padding: 40px; }
                                h1 { text-align: center; font-size: 20px; text-transform: uppercase; margin-bottom: 4px; }
                                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
                                th { background: #f5f5f5; padding: 10px; border-bottom: 2px solid #ddd; text-align: left; }
                              </style>
                            </head>
                            <body>
                              <h1>${companyName}</h1>
                              <div style="text-align: center; font-size: 11px; color: #555;">Customer Payment Collections Audit History - Generated: ${new Date().toLocaleString()}</div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Customer Name</th>
                                    <th>Receipt No</th>
                                    <th>Payment Method</th>
                                    <th style="text-align: right;">Amount Collected</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 30px;">No receipts logs in current statement.</td></tr>'}
                                </tbody>
                              </table>
                              <script>
                                window.onload = function() { window.print(); setTimeout(() => { window.parent.document.body.removeChild(window.frameElement); }, 1000); };
                              </script>
                            </body>
                          </html>
                        `;
                        globalPrintHTML(html);
                      }}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-505" />
                      Print List
                    </button>
                  </div>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={recSearchTerm}
                    onChange={(e) => setRecSearchTerm(e.target.value)}
                    placeholder="Search receipts by customer name, reference no, notes..."
                    className="w-full bg-zinc-50 hover:bg-zinc-100/50 border border-zinc-200 focus:border-zinc-300 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none transition-all"
                  />
                </div>

                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b text-zinc-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Receipt Date</th>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">Receipt / Ref No</th>
                        <th className="p-3">Payment Method</th>
                        <th className="p-3 text-right">Amount Received</th>
                        <th className="p-3 text-right">Receipt Voucher</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-zinc-700 font-sans">
                      {customerReceipts
                        .filter(r => 
                          r.customer_name.toLowerCase().includes(recSearchTerm.toLowerCase()) ||
                          r.reference_no.toLowerCase().includes(recSearchTerm.toLowerCase()) ||
                          (r.notes && r.notes.toLowerCase().includes(recSearchTerm.toLowerCase()))
                        )
                        .map((rec, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/40">
                            <td className="p-3 font-mono text-zinc-500">{rec.payment_date}</td>
                            <td className="p-3 font-bold">{rec.customer_name}</td>
                            <td className="p-3 font-mono text-zinc-500">{rec.reference_no}</td>
                            <td className="p-3 capitalize font-semibold">{rec.payment_method.replace('_', ' ')}</td>
                            <td className="p-3 text-right font-extrabold text-green-600">+Rs. {rec.amount.toLocaleString()}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => triggerPrintVoucher('customer', rec)}
                                className="px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-650 rounded border transition-all text-zinc-600 cursor-pointer"
                              >
                                Print Voucher
                              </button>
                            </td>
                          </tr>
                        ))}
                      {customerReceipts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-zinc-400">
                            No customer receipts recorded. Collect a payment on the left panel or sync via Excel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* OUTSTANDING BALANCES REPORT */}
          {subSection === 'outstanding_report' && (
            <div className="space-y-6" id="finances-outstanding-report-container">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest block">Total Payables (To Suppliers)</span>
                    <strong className="text-xl md:text-2xl font-black text-red-800 font-mono block mt-2">
                      Rs. {suppliers.reduce((sum, s) => sum + (s.total_due || 0), 0).toLocaleString()}
                    </strong>
                  </div>
                  <p className="text-[10px] text-red-500 mt-2">Ledger accounts requiring active outward cash dispatch.</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Total Receivables (From Customers)</span>
                    <strong className="text-xl md:text-2xl font-black text-emerald-800 font-mono block mt-2">
                      Rs. {customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0).toLocaleString()}
                    </strong>
                  </div>
                  <p className="text-[10px] text-emerald-500 mt-2">Ledger collections due from wholesale POS or credit accounts.</p>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">Net Cash Realization Position</span>
                    <strong className="text-xl md:text-2xl font-black text-indigo-800 font-mono block mt-2">
                      Rs. {(
                        customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0) -
                        suppliers.reduce((sum, s) => sum + (s.total_due || 0), 0)
                      ).toLocaleString()}
                    </strong>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-2">Expected capital flow after reconciling payables and collections.</p>
                </div>
              </div>

              {/* Master Ledger List */}
              <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Outstanding Ledger Balances</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Consolidated, real-time balances statement of suppliers and credit customers.</p>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleExportOutstandingReport}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-650" />
                      Export CSV Report
                    </button>
                    <button
                      onClick={triggerPrintOutstandingReport}
                      className="flex-1 sm:flex-none text-[10.5px] font-bold px-3 py-2 border rounded-xl bg-white hover:bg-zinc-50 flex items-center justify-center gap-1 text-zinc-700 shadow-sm transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-505" />
                      Print Audit
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={outSearchTerm}
                    onChange={(e) => setOutSearchTerm(e.target.value)}
                    placeholder="Filter ledger by name, contact info, or ledger type..."
                    className="w-full bg-zinc-50 hover:bg-zinc-100/50 border border-zinc-200 focus:border-zinc-300 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none transition-all"
                  />
                </div>

                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-zinc-50 border-b text-zinc-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Ledger Type</th>
                        <th className="p-3">Entity / Client Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Email Address</th>
                        <th className="p-3 text-right">Outstanding Balance</th>
                        <th className="p-3 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-zinc-700">
                      {[
                        ...suppliers
                          .filter(s => s.total_due > 0)
                          .map(s => ({
                            type: 'Supplier (Payable)',
                            name: s.company_name,
                            phone: s.phone,
                            email: s.email,
                            balance: s.total_due,
                            isSupplier: true,
                            originalObj: s
                          })),
                        ...customers
                          .filter(c => (c.credit_balance || 0) > 0)
                          .map(c => ({
                            type: 'Customer (Receivable)',
                            name: c.name,
                            phone: c.phone || 'N/A',
                            email: c.email || 'N/A',
                            balance: c.credit_balance || 0,
                            isSupplier: false,
                            originalObj: c
                          }))
                      ]
                        .filter(item => 
                          item.name.toLowerCase().includes(outSearchTerm.toLowerCase()) ||
                          item.type.toLowerCase().includes(outSearchTerm.toLowerCase()) ||
                          (item.phone && item.phone.includes(outSearchTerm)) ||
                          (item.email && item.email.toLowerCase().includes(outSearchTerm.toLowerCase()))
                        )
                        .map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/40">
                            <td className="p-3">
                              <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                item.isSupplier 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="p-3 font-bold">{item.name}</td>
                            <td className="p-3 font-mono text-zinc-500">{item.phone}</td>
                            <td className="p-3 text-zinc-500">{item.email}</td>
                            <td className={`p-3 text-right font-black text-sm font-mono ${
                              item.isSupplier ? 'text-red-600' : 'text-green-600'
                            }`}>
                              Rs. {item.balance.toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              {item.isSupplier ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaySupplierId(item.originalObj.id);
                                    setPayAmount(item.balance);
                                    setSubSection('supplier_payments');
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold uppercase bg-red-650 hover:bg-red-750 text-white rounded transition-all shadow-xs cursor-pointer"
                                >
                                  Disburse Pay
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecCustomerId(item.originalObj.id);
                                    setRecAmount(item.balance);
                                    setSubSection('customer_receipts');
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-750 text-white rounded transition-all shadow-xs cursor-pointer"
                                >
                                  Collect Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      {suppliers.filter(s => s.total_due > 0).length === 0 && 
                       customers.filter(c => (c.credit_balance || 0) > 0).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-zinc-400">
                            Excellent! There are no outstanding payables or receivables on current ledger statements.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Excel bulk Sync Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="financials-excel-sync">
          {/* Controls Panel (5 cols) */}
          <div className="lg:col-span-5 bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b pb-3.5">
              <h4 className="text-sm font-semibold text-zinc-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                Financial spreadsheet syncing
              </h4>
              <p className="text-[11px] text-zinc-500 mt-1">
                Reconcile account heads and upload utility or operational expenses in bulk using standard Excel sheets.
              </p>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-zinc-50 p-3 rounded-xl border border-dashed text-[11px] text-zinc-600 leading-relaxed">
                <span className="font-bold text-zinc-800 block mb-1">📊 General Ledger & Outflow Syncing:</span>
                1. Use **Export Balances** to generate a general ledger spreadsheet of current cash on hand, bank cleared values, and operating revenue.<br/>
                2. Bulk import allows you to sync multiple expenses or ledger debits at once. All operations are appended immediately to show in reports.
              </div>

              <div className="pt-2">
                <span className="font-bold text-zinc-800 block mb-2 uppercase text-[10px] tracking-wider text-zinc-400">Export options:</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportLedgerBalancesToExcel}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-[11px]"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    Export Ledger Balances (GL)
                  </button>

                  <button
                    onClick={exportExpensesToExcel}
                    className="w-full bg-white hover:bg-zinc-50 border text-zinc-700 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-[11px]"
                  >
                    <Download className="w-4 h-4 text-indigo-505" />
                    Export Expense Transaction Ledger
                  </button>

                  <button
                    onClick={downloadExpensesTemplate}
                    className="w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-600 font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[10.5px]"
                  >
                    Download Expense Template
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Dropzone (7 cols) */}
          <div className="lg:col-span-7 bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-semibold text-zinc-950 flex items-center gap-1.5 border-b pb-3">
              <Upload className="w-4.5 h-4.5 text-indigo-500" />
              Upload Financial Excel File
            </h4>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                dragOver 
                  ? 'border-indigo-500 bg-indigo-50/40' 
                  : importFilename 
                  ? 'border-emerald-400 bg-emerald-50/10' 
                  : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv"
                className="hidden"
              />
              <FileUp className={`w-9 h-9 mb-2.5 ${importFilename ? 'text-emerald-500' : 'text-zinc-400 animate-pulse'}`} />
              {importFilename ? (
                <div>
                  <span className="font-bold text-xs text-zinc-800 block">Loaded: {importFilename}</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Click or drag another file to replace</span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-xs text-zinc-800 block">Drag and drop expense Excel/CSV here</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Supports standard Excel .csv format</span>
                </div>
              )}
            </div>

            {/* Preview of Parsed Rows */}
            {parsedFinRows.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center bg-zinc-50 p-2.5 border rounded-xl">
                  <div className="text-xs">
                    <span className="font-bold text-zinc-800">{parsedFinRows.length} Rows</span> parsed & ready.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setParsedFinRows([]); setImportFilename(''); }}
                      className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Clear
                    </button>
                    <button
                      onClick={commitFinancialsImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all uppercase tracking-wider font-extrabold"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Commit Ledger Debits
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-zinc-50 text-zinc-500 font-bold border-b text-[10px]">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Branch Context</th>
                        <th className="p-2 text-right">Debit Amount</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-zinc-700">
                      {parsedFinRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/40 font-sans">
                          <td className="p-2 font-mono text-zinc-500">{row.date}</td>
                          <td className="p-2 font-bold">{row.category}</td>
                          <td className="p-2 truncate max-w-[120px]">{row.branchName}</td>
                          <td className="p-2 text-right font-bold text-red-600">-Rs. {row.amount.toLocaleString()}</td>
                          <td className="p-2 text-right">
                            {row.status === 'valid' ? (
                              <span className="bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Valid Sync</span>
                            ) : (
                              <span className="bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded font-bold uppercase" title={row.reason}>Error</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 flex justify-between items-center border-b border-zinc-100 pb-3">
              <span>File Showroom Expense Debit</span>
              <button onClick={() => setShowExpenseModal(false)} className="text-zinc-400 font-bold hover:text-zinc-900 text-xs">Close</button>
            </h4>

            <form onSubmit={handleRecordExpense} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expense category:</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none font-semibold text-zinc-800"
                >
                  <option value="Utility Bills">Showroom Electricity / Water</option>
                  <option value="Rent">Property Land lease / Rent</option>
                  <option value="Salaries">Staff Salary / bonuses</option>
                  <option value="Courier Charges">Dispatch shipping / Courier costs</option>
                  <option value="Office Stationary">Stationary & prints materials</option>
                  <option value="Marketing">Wholesale flyers advertising</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expense Quantity / Amount: (LKR)</label>
                <input
                  type="number"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 font-bold outline-none font-mono"
                  placeholder="Rs. LKR"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expenses Description Notes:</label>
                <textarea
                  placeholder="Notes (e.g. Electricity bill Colombo shop month May 2026)"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  rows={2.5}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-650 hover:bg-red-705 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-md"
              >
                File Expense Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DAILY closing MODAL */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 flex justify-between items-center border-b border-zinc-100 pb-3">
              <span>Staff Daily Closing Statement</span>
              <button onClick={() => setShowClosingModal(false)} className="text-zinc-400 font-bold hover:text-zinc-900 text-xs">Cancel</button>
            </h4>

            <form onSubmit={handleClosingSummarySubmit} className="space-y-4 text-xs">
              <p className="text-zinc-550 leading-relaxed text-[11.5px] bg-indigo-50 p-2 rounded-xl text-center font-bold">
                Enter exact physically counted currency from your showroom drawers.
              </p>

              <div>
                <label className="text-zinc-505 block mb-1">Physically counted hand Cash: (LKR)</label>
                <input
                  type="number"
                  value={drawerCashCount || ''}
                  onChange={(e) => setDrawerCashCount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none font-bold"
                  placeholder="Count Rs."
                  required
                />
              </div>

              <div>
                <label className="text-zinc-505 block mb-1">Credit Card slips total: (LKR)</label>
                <input
                  type="number"
                  value={drawerCardCount || ''}
                  onChange={(e) => setDrawerCardCount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none font-bold"
                  placeholder="Slips Rs."
                  required
                />
              </div>

              <div className="space-y-1.5 bg-zinc-50 p-2.5 border border-dashed rounded-xl">
                <span className="text-[10px] text-zinc-455 uppercase block">Discrepancy Checks:</span>
                <div className="flex justify-between">
                  <span>Logged Expected Cash:</span>
                  <span>Rs. {totals.cashTally.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900 border-t pt-1">
                  <span>Cash Difference:</span>
                  <span className={drawerCashCount - totals.cashTally < 0 ? 'text-red-500' : 'text-green-600'}>
                    Rs. {(drawerCashCount - totals.cashTally).toLocaleString()} LKR
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-950 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all"
              >
                Verify & Lock Closing Ledger
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="edit-expense-modal">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 flex justify-between items-center border-b border-zinc-100 pb-3">
              <span>Edit Showroom Expense Details</span>
              <button onClick={() => setEditingExpense(null)} className="text-zinc-400 font-bold hover:text-zinc-900 text-xs">Close</button>
            </h4>

            <form onSubmit={handleSaveEditExpense} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expense category:</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none font-semibold text-zinc-800"
                >
                  <option value="Utility Bills">Showroom Electricity / Water</option>
                  <option value="Rent">Property Land lease / Rent</option>
                  <option value="Salaries">Staff Salary / bonuses</option>
                  <option value="Courier Charges">Dispatch shipping / Courier costs</option>
                  <option value="Office Stationary">Stationary & prints materials</option>
                  <option value="Marketing">Wholesale flyers advertising</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expense Quantity / Amount: (LKR)</label>
                <input
                  type="number"
                  value={editAmount || ''}
                  onChange={(e) => setEditAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 font-bold outline-none font-mono"
                  placeholder="Rs. LKR"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-500 font-bold block mb-1">Expenses Description Notes:</label>
                <textarea
                  placeholder="Notes"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2.5}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 rounded-xl outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-md"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUPERVISOR OVERRIDE VERIFICATION GATED AUTHENTICATION MODAL */}
      <SupervisorAuthModal
        isOpen={!!authAction}
        onClose={() => setAuthAction(null)}
        onSuccess={handleAuthSuccess}
        actionLabel={authAction ? `${authAction.type} expense record (${authAction.expense.category} - Rs. ${authAction.expense.amount.toLocaleString()})` : ''}
      />
    </div>
  );
}
