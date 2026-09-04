import { globalPrint } from '../utils/printHelper';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { 
  Search, Barcode, Trash2, Plus, Minus, CreditCard, Banknote, 
  RefreshCcw, AlertCircle, ShoppingCart, User as UserIcon, 
  Percent, Grid, Printer, Mail, Download, History, Tag, FileText, Landmark,
  MessageCircle, Image as ImageIcon, Share2, Copy,
  FileSpreadsheet, FileUp, FileDown, X, Users, UserPlus, CheckCircle, Upload, Pencil,
  Eye, EyeOff, PackageX, MapPin, CornerUpLeft, Clock, Calendar, ArrowRight, FileCheck, Send, Check, RotateCcw,
  Loader2
} from 'lucide-react';
import { User, Branch, Product, ProductStock, Customer, PaymentMethod, Invoice, SplitPaymentDetail, Quotation, QuotationItem } from '../types';
import { exportToCSV, parseCSV } from '../utils/excelHelper';
import { extractTextFromPDF } from '../utils/pdfHelper';
import SupervisorAuthModal from './SupervisorAuthModal';
import QuotationPrintModal from './QuotationPrintModal';
import { getCustomers, createCustomer, updateCustomer } from '../services/customers';
import { getProducts } from '../services/products';
import { getProductStocks } from '../services/productStocks';
import { getSetting } from '../services/settings';
import { getInvoices, updateInvoice, modifyInvoice, processSalesReturn, voidSalesInvoice, permanentlyDeleteSalesInvoice, isUserAdmin } from '../services/invoices';
import { getQuotations, createQuotation, updateQuotation, updateQuotationStatus, deleteQuotation } from '../services/quotations';
import { updateProductStock } from '../services/productStocks';
import { processSale } from '../services/sales';
import { supabase } from '../lib/supabaseClient';

function convertNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  function convertChunk(n: number): string {
    let parts: string[] = [];
    if (n >= 100) {
      parts.push(ones[Math.floor(n / 100)] + ' Hundred');
      n %= 100;
    }
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)]);
      n %= 10;
    }
    if (n > 0) {
      parts.push(ones[n]);
    }
    return parts.join(' ');
  }

  let words = '';
  let scaleIndex = 0;
  
  const mainNum = Math.floor(num);
  const cents = Math.round((num - mainNum) * 100);

  let temp = mainNum;
  let chunks: string[] = [];
  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkStr = convertChunk(chunk);
      chunks.unshift(chunkStr + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : ''));
    }
    temp = Math.floor(temp / 1000);
    scaleIndex++;
  }
  
  words = chunks.join(' ');
  
  if (cents > 0) {
    words += ` and Cents ${convertChunk(cents)}`;
  }
  
  return words.trim();
}

interface POSProps {
  user: User;
  activeBranch: Branch | null;
  branches?: Branch[];
  onBranchChange?: (branchId: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // Item discount
  unitPrice?: number; // Custom editable sales price during billing
}

export default function POS({ user, activeBranch, branches, onBranchChange }: POSProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'checkout' | 'history' | 'quotations'>('checkout');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const isProcessingSaleRef = useRef(false);

  // Sales Quotation Management states
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showQuotationPrintModal, setShowQuotationPrintModal] = useState(false);
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<string>('all');
  const [quotationValidityDays, setQuotationValidityDays] = useState<number>(14);
  const [quotationNotesInput, setQuotationNotesInput] = useState('');
  const [showSaveQuotationModal, setShowSaveQuotationModal] = useState(false);
  const [quotationToastMsg, setQuotationToastMsg] = useState<string | null>(null);

  // WhatsApp Quotation states
  const [showWhatsAppQuotationDialog, setShowWhatsAppQuotationDialog] = useState(false);
  const [whatsappQuotationPhone, setWhatsappQuotationPhone] = useState('');
  const [whatsappQuotationMessage, setWhatsappQuotationMessage] = useState('');
  const [isGeneratingQuotationImage, setIsGeneratingQuotationImage] = useState(false);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Customer CRM & Excel Import states
  const [showCustomerCRMModal, setShowCustomerCRMModal] = useState(false);
  const [showImportCustomerModal, setShowImportCustomerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [parsedCustomers, setParsedCustomers] = useState<Customer[]>([]);
  const [customerImportFilename, setCustomerImportFilename] = useState('');
  const [customerStatusMsg, setCustomerStatusMsg] = useState<string | null>(null);
  const customerFileInputRef = useRef<HTMLInputElement>(null);

  // New Customer Form Fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custCredit, setCustCredit] = useState<number>(0);
  const [custNotes, setCustNotes] = useState('');

  // Loaded data
  const [categories, setCategories] = useState<any[]>([]); // Need to create categories service
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [companySetting, setCompanySetting] = useState<any>(null); // Need proper type
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([
      getCustomers(),
      getProducts(),
      getProductStocks(),
      getSetting(),
      getInvoices(),
      getQuotations(),
      import('../services/categories').then(s => s.getCategories()),
      import('../services/brands').then(s => s.getBrands())
    ]).then(([c, p, ps, s, i, qts, cats, brands]) => {
      console.log('Products fetched:', p);
      console.log('Active branch:', activeBranch);
      setCustomers(c);
      setAllProducts(p);
      setProductStocks(ps);
      setCompanySetting(s);
      setCategories(cats);
      setInvoices(activeBranch ? i.filter(inv => inv.branch_id === activeBranch.id) : i);
      setQuotations(activeBranch ? qts.filter(q => q.branch_id === activeBranch.id) : qts);
    }).catch(console.error);
  }, [refreshKey, activeBranch]);

  // Handle Save Customer Edit
  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      const updatedCust = await updateCustomer(editingCustomer);
      const updatedCusts = customers.map(c => c.id === updatedCust.id ? updatedCust : c);
      setCustomers(updatedCusts);
      setCustomerStatusMsg(`Customer profile for "${updatedCust.name}" updated successfully.`);
      setEditingCustomer(null);
      setTimeout(() => setCustomerStatusMsg(null), 3500);
    } catch (error) {
      console.error(error);
      setCustomerStatusMsg(`Failed to update customer: ${error}`);
    }
  };

  // Download Customer CSV Template
  const handleDownloadCustomerTemplate = () => {
    const headers = ['Full Name', 'Phone Number', 'Email Address', 'Company Name', 'Credit Balance', 'Loyalty Points', 'Notes'];
    const sampleRows = [
      ['Kumar Sangakkara', '+94 77 123 4567', 'kumar@sanga.lk', 'Sanga Cricket Legends', '0', '450', 'VIP Customer'],
      ['Mahela Jayawardene', '+94 77 765 4321', 'mahela@legends.lk', 'Wayamba Softwares', '45000', '800', 'Corporate client']
    ];
    exportToCSV(headers, sampleRows, 'Majestic_Customers_Import_Template.csv');
  };

  // Export Customers to CSV
  const handleExportCustomers = () => {
    const headers = ['Full Name', 'Phone Number', 'Email Address', 'Company Name', 'Credit Balance (LKR)', 'Loyalty Points', 'Notes', 'Created At'];
    const rows = customers.map(c => [
      c.name,
      c.phone,
      c.email,
      c.company_name || '',
      c.credit_balance,
      c.loyalty_points,
      c.notes || '',
      c.created_at
    ]);
    exportToCSV(headers, rows, `Majestic_Customer_Registry_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Handle Customer File Select (CSV, Excel, PDF)
  const handleCustomerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomerImportFilename(file.name);
      if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const text = await extractTextFromPDF(file);
          if (text) {
            parseAndValidateCustomers(text);
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
            parseAndValidateCustomers(text);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const parseAndValidateCustomers = (csvText: string) => {
    try {
      const grid = parseCSV(csvText);
      if (grid.length < 2) {
        alert('File is empty or missing customer data rows.');
        return;
      }

      const headers = grid[0].map(h => h.toLowerCase().trim());

      let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('customer') || h.includes('full'));
      let phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
      let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
      let companyIdx = headers.findIndex(h => h.includes('company') || h.includes('business') || h.includes('firm'));
      let creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('balance') || h.includes('due'));
      let pointsIdx = headers.findIndex(h => h.includes('point') || h.includes('loyalty') || h.includes('reward'));
      let notesIdx = headers.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('info'));

      if (nameIdx === -1) nameIdx = 0;
      if (phoneIdx === -1) phoneIdx = 1;
      if (emailIdx === -1) emailIdx = 2;
      if (companyIdx === -1) companyIdx = 3;
      if (creditIdx === -1) creditIdx = 4;
      if (pointsIdx === -1) pointsIdx = 5;
      if (notesIdx === -1) notesIdx = 6;

      const parsedList: Customer[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

        const name = row[nameIdx]?.trim() || `Customer #${i}`;
        const phone = row[phoneIdx]?.trim() || '+94 77 000 0000';
        const email = row[emailIdx]?.trim() || '';
        const company = row[companyIdx]?.trim() || '';
        const credit = parseFloat(row[creditIdx]?.replace(/[^0-9.-]+/g, '')) || 0;
        const points = parseInt(row[pointsIdx]?.replace(/[^0-9]+/g, '')) || 0;
        const notes = row[notesIdx]?.trim() || 'Imported via Excel spreadsheet';

        parsedList.push({
          id: `c-imp-${Date.now()}-${i}`,
          name: name,
          phone: phone,
          email: email,
          company_name: company || undefined,
          credit_balance: Math.max(0, credit),
          loyalty_points: Math.max(0, points),
          notes: notes,
          created_at: new Date().toISOString()
        });
      }

      if (parsedList.length === 0) {
        alert('No valid customer records found in spreadsheet.');
        return;
      }

      setParsedCustomers(parsedList);
    } catch (err) {
      console.error(err);
      alert('Failed to parse customer Excel/CSV file. Please check format.');
    }
  };

  const handleConfirmImportCustomers = async () => {
    if (parsedCustomers.length === 0) return;

    try {
      let importedCount = 0;
      for (const cust of parsedCustomers) {
        const created = await createCustomer({
          name: cust.name,
          phone: cust.phone,
          email: cust.email || `${cust.phone.replace(/[^0-9]+/g, '')}@customer.lk`,
          company_name: cust.company_name,
          credit_balance: cust.credit_balance || 0,
          loyalty_points: cust.loyalty_points || 0,
          notes: cust.notes
        });
        setCustomers(prev => [created, ...prev]);
        importedCount++;
      }

      setCustomerStatusMsg(`Successfully imported ${importedCount} customer records into Supabase!`);
      setShowImportCustomerModal(false);
      setParsedCustomers([]);
      setCustomerImportFilename('');

      setTimeout(() => setCustomerStatusMsg(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to import customers.');
    }
  };

  const handleCreateSingleCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      alert('Please fill customer full name and mobile phone number.');
      return;
    }

    try {
      const created = await createCustomer({
        name: custName,
        phone: custPhone,
        email: custEmail || `${custPhone.replace(/[^0-9]+/g, '')}@customer.lk`,
        company_name: custCompany || undefined,
        credit_balance: custCredit || 0,
        loyalty_points: 0,
        notes: custNotes || undefined
      });

      setCustomers(prev => [created, ...prev]);
      setSelectedCustomerId(created.id); // Auto-select newly created customer

      // Reset
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustCompany('');
      setCustCredit(0);
      setCustNotes('');
      setShowAddCustomerModal(false);

      setCustomerStatusMsg(`Customer profile "${created.name}" registered and selected!`);
      setTimeout(() => setCustomerStatusMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Failed to create customer.');
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const q = customerSearchQuery.toLowerCase().trim();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company_name && c.company_name.toLowerCase().includes(q))
    );
  }, [customers, customerSearchQuery]);
  
  // Custom discounts & payment triggers
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [billingNote, setBillingNote] = useState<string>('');
  
  // Split payment allocations
  const [cashSplit, setCashSplit] = useState<number>(0);
  const [cardSplit, setCardSplit] = useState<number>(0);
  const [bankSplit, setBankSplit] = useState<number>(0);

  // Print modal handles
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<string | null>(null); // 'thermal' | 'a4' | 'a4-half' | 'a5' | null
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const invoiceBranchInfo = useMemo(() => {
    if (!selectedInvoice) return { address: companySetting?.address || '', phone: companySetting?.phone || '' };
    const invBranch = branches?.find(b => b.id === selectedInvoice.branch_id || b.name === selectedInvoice.branch_name);
    return {
      address: invBranch?.location || companySetting?.address || '',
      phone: invBranch?.phone || companySetting?.phone || ''
    };
  }, [selectedInvoice, branches, companySetting]);

  // Admin Invoice Edit states
  const [adminEditingInvoice, setAdminEditingInvoice] = useState<Invoice | null>(null);
  const [adminEditCustName, setAdminEditCustName] = useState('');
  const [adminEditCustPhone, setAdminEditCustPhone] = useState('');
  const [adminEditPaymentMethod, setAdminEditPaymentMethod] = useState<PaymentMethod>('cash');
  const [adminEditPaidAmount, setAdminEditPaidAmount] = useState<number>(0);
  const [adminEditOverallDiscount, setAdminEditOverallDiscount] = useState<number>(0);
  const [adminEditItems, setAdminEditItems] = useState<{
    product_id: string;
    product_name: string;
    sku: string;
    unit_price: number;
    quantity: number;
    discount: number;
  }[]>([]);
  const [adminEditSearch, setAdminEditSearch] = useState('');
  const [adminEditError, setAdminEditError] = useState('');
  const [adminEditSuccess, setAdminEditSuccess] = useState('');

  const adminEditCalculated = useMemo(() => {
    if (!adminEditingInvoice) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = adminEditItems.reduce((sum, item) => sum + (item.unit_price - item.discount) * item.quantity, 0);
    const discounted = Math.max(0, subtotal - adminEditOverallDiscount);
    const taxRate = companySetting?.tax_rate || 0;
    const taxEnabled = companySetting?.tax_enabled !== false;
    const tax = taxEnabled ? Math.round(discounted * (taxRate / 100)) : 0;
    const total = discounted + tax;
    return { subtotal, tax, total };
  }, [adminEditingInvoice, adminEditItems, adminEditOverallDiscount, companySetting]);

  const handleStartAdminEdit = (inv: Invoice) => {
    setAdminEditingInvoice(inv);
    setAdminEditCustName(inv.customer_name);
    setAdminEditCustPhone(inv.customer_phone || '');
    setAdminEditPaymentMethod(inv.payment_method);
    setAdminEditPaidAmount(inv.paid_amount);
    setAdminEditOverallDiscount(inv.discount);
    setAdminEditItems((inv.invoice_items || []).map(itm => ({
      product_id: itm.product_id,
      product_name: itm.product_name,
      sku: itm.sku,
      unit_price: itm.unit_price,
      quantity: itm.quantity,
      discount: itm.discount
    })));
    setAdminEditSearch('');
    setAdminEditError('');
    setAdminEditSuccess('');
  };

  const handleAddProductToAdminEdit = (prod: Product) => {
    const existing = adminEditItems.find(itm => itm.product_id === prod.id);
    if (existing) {
      setAdminEditItems(adminEditItems.map(itm => 
        itm.product_id === prod.id ? { ...itm, quantity: itm.quantity + 1 } : itm
      ));
    } else {
      setAdminEditItems([...adminEditItems, {
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        unit_price: prod.selling_price,
        quantity: 1,
        discount: 0
      }]);
    }
  };

  const handleSaveAdminEdit = async () => {
    if (!adminEditingInvoice) return;
    if (adminEditCustName.trim() === '') {
      setAdminEditError('Customer name cannot be empty.');
      return;
    }
    if (adminEditItems.length === 0) {
      setAdminEditError('Invoice must contain at least one product.');
      return;
    }
    const { subtotal, tax, total } = adminEditCalculated;
    if (total <= 0) {
      setAdminEditError('Total billing amount must be greater than zero.');
      return;
    }

    let paymentStatus = 'paid';
    if (adminEditPaidAmount < total) {
      paymentStatus = adminEditPaidAmount > 0 ? 'partially_paid' : 'unpaid';
    }

    try {
      setAdminEditError('');
      setAdminEditSuccess('Saving modifications and reconciling inventory...');
      const updatedInv = await modifyInvoice(
        adminEditingInvoice.id,
        adminEditingInvoice.branch_id,
        {
          customer_name: adminEditCustName,
          customer_phone: adminEditCustPhone,
          payment_method: adminEditPaymentMethod,
          paid_amount: adminEditPaidAmount,
          discount: adminEditOverallDiscount,
          subtotal,
          tax,
          total,
          payment_status: paymentStatus
        },
        adminEditItems
      );

      // Update local state list of invoices
      setInvoices(prev => prev.map(inv => inv.id === adminEditingInvoice.id ? updatedInv : inv));
      setAdminEditSuccess('Invoice updated successfully!');
      
      // Re-trigger global refresh for stock info
      setRefreshKey(prev => prev + 1);

      // Close modal after delay
      setTimeout(() => {
        setAdminEditingInvoice(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setAdminEditError(err.message || 'Failed to modify invoice.');
      setAdminEditSuccess('');
    }
  };

  // Admin Sales Return states
  const [adminReturningInvoice, setAdminReturningInvoice] = useState<Invoice | null>(null);
  const [adminReturnItems, setAdminReturnItems] = useState<{
    item_id: string;
    product_id: string;
    product_name: string;
    sku: string;
    unit_price: number;
    discount: number;
    purchased_qty: number;
    return_qty: number;
  }[]>([]);
  const [adminReturnReason, setAdminReturnReason] = useState('');
  const [adminReturnRefundOverride, setAdminReturnRefundOverride] = useState<number | null>(null);
  const [adminReturnError, setAdminReturnError] = useState('');
  const [adminReturnSuccess, setAdminReturnSuccess] = useState('');

  const adminReturnCalculated = useMemo(() => {
    if (!adminReturningInvoice) return { refundAmount: 0 };
    const returnedSumBeforeOverallDiscount = adminReturnItems.reduce((sum, item) => {
      return sum + (item.unit_price - item.discount) * item.return_qty;
    }, 0);

    const isAllReturned = adminReturnItems.every(itm => itm.return_qty === itm.purchased_qty);
    if (isAllReturned) {
      return { refundAmount: adminReturningInvoice.total };
    }

    const originalSubtotal = adminReturningInvoice.subtotal || 1;
    const proportion = Math.min(1, returnedSumBeforeOverallDiscount / originalSubtotal);
    const refundAmount = Math.round(proportion * adminReturningInvoice.total);

    return { refundAmount };
  }, [adminReturningInvoice, adminReturnItems]);

  const handleStartSalesReturn = (inv: Invoice) => {
    setAdminReturningInvoice(inv);
    setAdminReturnItems((inv.invoice_items || []).map(itm => ({
      item_id: itm.id,
      product_id: itm.product_id,
      product_name: itm.product_name,
      sku: itm.sku,
      unit_price: itm.unit_price,
      discount: itm.discount,
      purchased_qty: itm.quantity,
      return_qty: 0
    })));
    setAdminReturnReason('');
    setAdminReturnRefundOverride(null);
    setAdminReturnError('');
    setAdminReturnSuccess('');
  };

  const handleConfirmSalesReturn = async () => {
    if (!adminReturningInvoice) return;
    const itemsToReturn = adminReturnItems.filter(itm => itm.return_qty > 0);
    if (itemsToReturn.length === 0) {
      setAdminReturnError('Please specify at least one product with a return quantity greater than 0.');
      return;
    }

    const calculatedRefund = adminReturnCalculated.refundAmount;
    const finalRefundAmount = adminReturnRefundOverride !== null ? adminReturnRefundOverride : calculatedRefund;

    try {
      setAdminReturnError('');
      setAdminReturnSuccess('Processing return & replenishing inventory...');

      const updatedInv = await processSalesReturn(
        adminReturningInvoice.id,
        adminReturningInvoice.branch_id,
        itemsToReturn.map(itm => ({
          item_id: itm.item_id,
          product_id: itm.product_id,
          product_name: itm.product_name,
          return_qty: itm.return_qty
        })),
        finalRefundAmount,
        companySetting?.tax_rate || 0,
        companySetting?.tax_enabled !== false
      );

      setInvoices(prev => prev.map(inv => inv.id === adminReturningInvoice.id ? updatedInv : inv));
      setAdminReturnSuccess('Sales Return processed successfully!');
      setRefreshKey(prev => prev + 1);

      setTimeout(() => {
        setAdminReturningInvoice(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setAdminReturnError(err.message || 'Failed to process sales return.');
      setAdminReturnSuccess('');
    }
  };

  // Admin Invoice Delete / Void States & Handlers
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleteInvoiceReason, setDeleteInvoiceReason] = useState('');
  const [deleteInvoiceMode, setDeleteInvoiceMode] = useState<'void' | 'permanent'>('void');
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);

  const handleStartDeleteInvoice = (inv: Invoice) => {
    if (!isUserAdmin(user)) {
      alert('Access Denied: Only Admin users (Super Admin / Branch Admin) can delete or void sales invoices.');
      return;
    }
    const isAlreadyVoid = inv.status === 'void' || inv.status === 'deleted';
    setInvoiceToDelete(inv);
    setDeleteInvoiceMode(isAlreadyVoid ? 'permanent' : 'void');
    setDeleteInvoiceReason(isAlreadyVoid ? 'Permanently removing voided invoice record' : 'Customer cancellation / Billing correction');
    setDeleteInvoiceError(null);
    setShowDeleteInvoiceModal(true);
  };

  const handleConfirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeletingInvoice(true);
    setDeleteInvoiceError(null);

    try {
      if (deleteInvoiceMode === 'permanent') {
        await permanentlyDeleteSalesInvoice(
          invoiceToDelete.id,
          { id: user.id, name: user.name, role: user.role, permissions: user.permissions }
        );

        // Remove from local invoice state
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));

        // If this invoice is currently open in print/preview modal, close it
        if (selectedInvoice && selectedInvoice.id === invoiceToDelete.id) {
          setSelectedInvoice(null);
          setShowPrintModal(null);
        }
      } else {
        const updatedInvoice = await voidSalesInvoice(
          invoiceToDelete.id,
          { id: user.id, name: user.name, role: user.role, permissions: user.permissions },
          deleteInvoiceReason.trim() || 'Administrative void'
        );

        // Update local invoice state
        setInvoices(prev => prev.map(inv => inv.id === invoiceToDelete.id ? updatedInvoice : inv));

        // If this invoice is open in print/preview modal, update it
        if (selectedInvoice && selectedInvoice.id === invoiceToDelete.id) {
          setSelectedInvoice(updatedInvoice);
        }
      }

      // Refresh product stocks and products
      getProductStocks().then(setProductStocks).catch(console.error);
      getProducts().then(setAllProducts).catch(console.error);

      setShowDeleteInvoiceModal(false);
      setInvoiceToDelete(null);
      setDeleteInvoiceReason('');
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      setDeleteInvoiceError(err.message || 'Failed to delete/void sales invoice.');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  // WhatsApp states
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Helper to format & prepare WhatsApp Bill text
  const prepareWhatsAppBill = (inv: Invoice) => {
    const items = inv.invoice_items || [];
    
    const itemLines = items.map(item => `• ${item.product_name} x${item.quantity} = Rs. ${((item.unit_price - item.discount) * item.quantity).toLocaleString()}`).join('\n');
    
    const text = `*MAJESTIC POS - INVOICE*
📄 *Invoice No:* ${inv.invoice_no}
📅 *Date:* ${inv.created_at.split('T')[0]}
👤 *Customer:* ${inv.customer_name}

*Purchased Items:*
${itemLines}

───────────────
💰 *Subtotal:* Rs. ${inv.subtotal.toLocaleString()}
🏷️ *Discount:* Rs. ${inv.discount.toLocaleString()}
💵 *Nett Total:* Rs. ${inv.total.toLocaleString()} LKR
💳 *Payment Method:* ${inv.payment_method.toUpperCase()}

Thank you for your business!`;

    setWhatsappPhone(inv.customer_phone || '');
    setWhatsappMessage(text);
    setShowWhatsAppDialog(true);
  };

  // Capture original bill image using html2canvas & share directly to installed WhatsApp
  const sendWhatsAppImage = async () => {
    if (!whatsappPhone.trim()) {
      alert('Please enter a WhatsApp mobile number.');
      return;
    }
    let cleanNum = whatsappPhone.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '94' + cleanNum.substring(1);
    }

    setIsGeneratingImage(true);

    let targetId = 'a4-invoice-display-area';
    if (showPrintModal === 'thermal') targetId = 'thermal-receipt-display-area';
    else if (showPrintModal === 'a4-half') targetId = 'a4-half-invoice-display-area';
    else if (showPrintModal === 'a5') targetId = 'a5-invoice-display-area';

    const element = document.getElementById(targetId);

    try {
      let imageBlob: Blob | null = null;
      let imageFile: File | null = null;

      if (element) {
        const canvas = await html2canvas(element, { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff' 
        });
        imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (imageBlob && selectedInvoice) {
          imageFile = new File([imageBlob], `Invoice-${selectedInvoice.invoice_no}.png`, { type: 'image/png' });
        }
      }

      // Option A: Try native Web Share API with image File (Directly opens WhatsApp on mobile/tablets or supporting browsers with attached image)
      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        try {
          await navigator.share({
            files: [imageFile],
            title: `Invoice ${selectedInvoice?.invoice_no}`,
            text: whatsappMessage,
          });
          setIsGeneratingImage(false);
          setShowWhatsAppDialog(false);
          return;
        } catch (err) {
          console.log('Native share cancelled or failed, falling back to app scheme:', err);
        }
      }

      // Option B: Copy Image to Clipboard & download file, then launch installed WhatsApp app!
      if (imageBlob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': imageBlob })
          ]);
          alert('📋 Bill Image copied to clipboard!\n\nWhen WhatsApp opens, press Ctrl+V (Paste) to send the image directly to your customer.');
        } catch (e) {
          console.log('Clipboard write not permitted, proceeding with auto-download:', e);
        }

        // Auto-download bill image as fallback
        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${selectedInvoice?.invoice_no || 'Bill'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Launch native installed WhatsApp app via protocol scheme
      const appUrl = `whatsapp://send?phone=${cleanNum}&text=${encodeURIComponent(whatsappMessage)}`;
      const webUrl = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(whatsappMessage)}`;

      // Try opening installed WhatsApp desktop or mobile app
      window.location.href = appUrl;

      // Fallback to web link if installed app isn't registered
      setTimeout(() => {
        window.open(webUrl, '_blank');
      }, 1200);

    } catch (err) {
      console.error('Error generating bill image for WhatsApp:', err);
      // Fallback to text link
      const url = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(whatsappMessage)}`;
      window.open(url, '_blank');
    } finally {
      setIsGeneratingImage(false);
      setShowWhatsAppDialog(false);
    }
  };

  const sendWhatsAppMessage = () => {
    if (!whatsappPhone.trim()) {
      alert('Please enter a WhatsApp mobile number.');
      return;
    }
    let cleanNum = whatsappPhone.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '94' + cleanNum.substring(1);
    }

    // Try opening installed WhatsApp app protocol scheme first
    const appUrl = `whatsapp://send?phone=${cleanNum}&text=${encodeURIComponent(whatsappMessage)}`;
    const webUrl = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(whatsappMessage)}`;

    window.location.href = appUrl;
    setTimeout(() => {
      window.open(webUrl, '_blank');
    }, 1200);

    setShowWhatsAppDialog(false);
  };

  const downloadBillImage = async () => {
    let targetId = 'a4-invoice-display-area';
    if (showPrintModal === 'thermal') targetId = 'thermal-receipt-display-area';
    else if (showPrintModal === 'a4-half') targetId = 'a4-half-invoice-display-area';
    else if (showPrintModal === 'a5') targetId = 'a5-invoice-display-area';

    const element = document.getElementById(targetId);
    if (!element) return;

    try {
      setIsGeneratingImage(true);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (imageBlob) {
        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${selectedInvoice?.invoice_no || 'Bill'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading bill image:', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Form errors
  const [errorText, setErrorText] = useState<string | null>(null);
  
  // Supervisor override gating state
  const [authRefundInvoice, setAuthRefundInvoice] = useState<Invoice | null>(null);

  // Filter zero stock toggle (default true)
  const [hideZeroStock, setHideZeroStock] = useState<boolean>(true);

  // Read available branch stock for each product (filter out products that don't belong to active branch)
  const productsWithStock = useMemo(() => {
    const list: any[] = [];
    allProducts.forEach(p => {
      if (activeBranch) {
        const matchingStocks = productStocks.filter(s => s.product_id === p.id && s.branch_id === activeBranch.id);
        if (matchingStocks.length > 0) {
          const branchQty = matchingStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
          list.push({
            ...p,
            stock: branchQty
          });
        }
      } else {
        list.push({
          ...p,
          stock: 0
        });
      }
    });
    return list;
  }, [allProducts, productStocks, activeBranch, refreshKey]);

  // Filter catalog list
  const filteredProducts = useMemo(() => {
    return productsWithStock.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      const cleanQ = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(cleanQ) || 
                            p.sku.toLowerCase().includes(cleanQ) || 
                            p.barcode.includes(cleanQ);
      const matchesStock = hideZeroStock ? p.stock > 0 : true;
      return matchesCategory && matchesSearch && matchesStock;
    });
  }, [productsWithStock, selectedCategory, searchQuery, hideZeroStock]);

  // Filter sales quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesStatus = quotationStatusFilter === 'all' || q.status === quotationStatusFilter;
      const cleanQ = quotationSearchQuery.toLowerCase();
      const matchesSearch = q.quotation_no.toLowerCase().includes(cleanQ) ||
                            q.customer_name.toLowerCase().includes(cleanQ) ||
                            (q.customer_phone && q.customer_phone.includes(cleanQ)) ||
                            (q.notes && q.notes.toLowerCase().includes(cleanQ)) ||
                            (q.quotation_items && q.quotation_items.some(i => i.product_name.toLowerCase().includes(cleanQ)));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, quotationStatusFilter, quotationSearchQuery]);

  // Cart operations
  const addToCart = (product: Product & { stock: number }) => {
    if (product.stock === 0) {
      setErrorText(`Sorry, ${product.name} is out of stock in this branch.`);
      setTimeout(() => setErrorText(null), 3000);
      return;
    }

    const existIdx = cart.findIndex(item => item.product.id === product.id);
    if (existIdx !== -1) {
      const currentQty = cart[existIdx].quantity;
      if (currentQty >= product.stock) {
        setErrorText(`Cannot exceed available batch stock (${product.stock} units)`);
        setTimeout(() => setErrorText(null), 3000);
        return;
      }
      const updated = [...cart];
      updated[existIdx].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  };

  const updateQuantity = (idx: number, change: number) => {
    const updated = [...cart];
    const item = updated[idx];
    const stockRow = productStocks.find(s => s.product_id === item.product.id && s.branch_id === activeBranch?.id);
    const maxStock = stockRow ? stockRow.quantity : 0;

    const newQty = item.quantity + change;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else if (newQty > maxStock) {
      setErrorText(`Maximum stock storage reached (${maxStock} units)`);
      setTimeout(() => setErrorText(null), 2500);
      return;
    } else {
      item.quantity = newQty;
    }
    setCart(updated);
  };

  const updateItemDiscount = (idx: number, stringAmount: string) => {
    const val = parseFloat(stringAmount) || 0;
    const updated = [...cart];
    updated[idx].discount = Math.max(0, val);
    setCart(updated);
  };

  const updateItemPrice = (idx: number, stringAmount: string) => {
    const updated = [...cart];
    if (stringAmount === '') {
      updated[idx].unitPrice = 0;
    } else {
      const val = parseFloat(stringAmount);
      updated[idx].unitPrice = isNaN(val) ? 0 : Math.max(0, val);
    }
    setCart(updated);
  };

  const resetItemPriceToDefault = (idx: number) => {
    const updated = [...cart];
    delete updated[idx].unitPrice;
    setCart(updated);
  };

  const getItemUnitPrice = (item: CartItem): number => {
    return typeof item.unitPrice === 'number' && !isNaN(item.unitPrice) ? item.unitPrice : item.product.selling_price;
  };

  const removeFromCart = (idx: number) => {
    const updated = [...cart];
    updated.splice(idx, 1);
    setCart(updated);
  };

  // Calculations for bill
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (getItemUnitPrice(item) - item.discount) * item.quantity, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    if (!companySetting || companySetting.tax_enabled === false) return 0;
    const discounted = Math.max(0, subtotal - overallDiscount);
    return Math.round(discounted * ((companySetting.tax_rate || 0) / 100));
  }, [subtotal, overallDiscount, companySetting]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - overallDiscount + taxAmount);
  }, [subtotal, overallDiscount, taxAmount]);

  // Clear fields
  const resetPOS = () => {
    setCart([]);
    setSelectedCustomerId('');
    setGuestName('');
    setGuestPhone('');
    setOverallDiscount(0);
    setPaidAmount(0);
    setPaymentMethod('cash');
    setCashSplit(0);
    setCardSplit(0);
    setBankSplit(0);
    setBillingNote('');
  };

  // Trigger barcode search manually
  const simulateBarcodeScan = (barcode: string) => {
    const matched = productsWithStock.find(p => p.barcode === barcode);
    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    } else {
      setErrorText(`Barcode ${barcode} not found in localized store index.`);
      setTimeout(() => setErrorText(null), 3000);
    }
  };

  // Checkout call
  const handleCheckout = async () => {
    // 1. Guard against duplicate submissions if already processing
    if (isProcessingSale || isProcessingSaleRef.current) {
      return;
    }

    if (cart.length === 0) {
      setErrorText('Retail POS basket is empty.');
      return;
    }
    if (!activeBranch) {
      setErrorText('No active showroom branch set.');
      return;
    }

    if (totalAmount <= 0) {
      setErrorText('Zero billing is not allowed. Total amount must be greater than zero.');
      return;
    }

    const checkoutCustomer = customers.find(c => c.id === selectedCustomerId);
    const customerName = checkoutCustomer ? checkoutCustomer.name : (guestName || 'Guest Walk-In');
    const customerPhone = checkoutCustomer ? checkoutCustomer.phone : guestPhone;

    // Validate payment amount
    if (paymentMethod !== 'split' && paidAmount < totalAmount) {
      setErrorText(`Outstanding payment. Amount paid (Rs. ${paidAmount}) cannot be less than total bills (Rs. ${totalAmount}).`);
      return;
    }

    let splitDetails: SplitPaymentDetail | undefined;
    if (paymentMethod === 'split') {
      const totalSplitAlloc = cashSplit + cardSplit + bankSplit;
      if (totalSplitAlloc < totalAmount) {
        setErrorText(`Incomplete Split payment allocation. Split total (Rs. ${totalSplitAlloc}) is lower than checkout invoice total (Rs. ${totalAmount})`);
        return;
      }
      splitDetails = { cash: cashSplit, card: cardSplit, bank: bankSplit };
    }

    // Set lock immediately to block rapid repeat clicks
    isProcessingSaleRef.current = true;
    setIsProcessingSale(true);
    setErrorText(null);

    try {
      const checkoutRequestId = `pos-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const itemsParam = cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        discount: item.discount,
        sellingPrice: getItemUnitPrice(item)
      }));

      const finalInv = await processSale({
        requestId: checkoutRequestId,
        branchId: activeBranch.id,
        customerName,
        customerPhone,
        customerId: selectedCustomerId || undefined,
        items: itemsParam,
        discount: overallDiscount,
        paymentMethod,
        paidAmount: paymentMethod === 'split' ? (cashSplit + cardSplit + bankSplit) : paidAmount,
        splitDetails,
        cashierName: user.name,
        notes: billingNote
      });

      // Clear the cart immediately so the bill cannot be re-submitted
      resetPOS();
      setInvoices(prev => [finalInv, ...prev.filter(inv => inv.id !== finalInv.id)]);
      setSelectedInvoice(finalInv);
      setShowPrintModal('thermal'); // Default show thermal receipt instantly for instant physical operations
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      console.error('POS checkout error:', e);
      setErrorText(e.message || 'Payment processing failed. Please try again.');
    } finally {
      isProcessingSaleRef.current = false;
      setIsProcessingSale(false);
    }
  };

  // Refund execution
  const processRefund = async (invoiceId: string, authorizedBy?: string) => {
    try {
      const targetInv = invoices.find(i => i.id === invoiceId);
      if (!targetInv) return;

      const updatedInv = {
        ...targetInv,
        refund_status: 'fully_refunded' as const,
        payment_status: 'unpaid' as const,
        refunded_amount: targetInv.total
      };

      await updateInvoice(updatedInv);

      // Increase stock again based on items
      const invItems = targetInv.invoice_items || [];
      for (const item of invItems) {
        const { data: stockRecords } = await supabase
          .from('product_stocks')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('branch_id', activeBranch?.id || null);

        if (stockRecords && stockRecords.length > 0) {
          const stk = stockRecords[0];
          stk.quantity += item.quantity;
          await updateProductStock(stk);
        }
      }

      setInvoices(prev => prev.map(i => i.id === invoiceId ? updatedInv : i));
      setActiveTab('history');
      setRefreshKey(prev => prev + 1);
      const authMessage = authorizedBy ? ` (Authorized by Manager: ${authorizedBy})` : '';
      setErrorText(`Invoice successfully refunded. Inventory stock replenished.${authMessage}`);
      setTimeout(() => setErrorText(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to process refund.');
    }
  };

  // Start refund verification check
  const handleStartRefund = (inv: Invoice) => {
    const hasPermission = user.role === 'super_admin' || (user.role === 'branch_admin' && user.branch_id === inv.branch_id);
    
    if (hasPermission) {
      if (confirm(`Are you sure you want to refund invoice ${inv.invoice_no}? Stock will be restored.`)) {
        processRefund(inv.id);
      }
    } else {
      setAuthRefundInvoice(inv);
    }
  };

  const handleAuthRefundSuccess = (authorizedBy: string) => {
    if (!authRefundInvoice) return;
    
    if (confirm(`Supervisor Approved! Refund invoice ${authRefundInvoice.invoice_no}? Stock will be restored.`)) {
      processRefund(authRefundInvoice.id, authorizedBy);
    }
    setAuthRefundInvoice(null);
  };

  // Quotation Management Handlers
  const handleOpenSaveQuotationModal = () => {
    if (cart.length === 0) {
      setErrorText('Please add at least one product to the sales basket before generating a quotation.');
      setTimeout(() => setErrorText(null), 3500);
      return;
    }
    setShowSaveQuotationModal(true);
  };

  const handleCreateQuotation = async () => {
    if (cart.length === 0) return;

    const selectedCust = customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCust?.name || guestName.trim() || 'Valued Customer';
    const customerPhone = selectedCust?.phone || guestPhone.trim() || undefined;
    const customerEmail = selectedCust?.email || undefined;

    const days = quotationValidityDays || 14;
    const validUntilDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    try {
      const newQuote = await createQuotation({
        branch_id: activeBranch?.id || 'b-colombo',
        branch_name: activeBranch?.name || 'Colombo Showroom',
        customer_id: selectedCust?.id || undefined,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        subtotal: subtotal,
        discount: overallDiscount,
        tax: taxAmount,
        total: totalAmount,
        valid_until: validUntilDate,
        created_by_name: user.name,
        notes: quotationNotesInput.trim() || billingNote.trim() || undefined,
        terms_conditions: '1. Prices are valid for 14 days from quotation issue date.\n2. Official hardware warranty applies upon finalized purchase.\n3. Goods subject to showroom stock availability on confirmation.',
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          sku: item.product.sku,
          unit_price: getItemUnitPrice(item),
          quantity: item.quantity,
          discount: item.discount || 0
        }))
      });

      setQuotations(prev => [newQuote, ...prev]);
      setSelectedQuotation(newQuote);
      setShowQuotationPrintModal(true);
      setShowSaveQuotationModal(false);
      setQuotationNotesInput('');
      setQuotationToastMsg(`Quotation "${newQuote.quotation_no}" generated successfully!`);
      setTimeout(() => setQuotationToastMsg(null), 4000);
    } catch (err: any) {
      console.error('Error creating quotation:', err);
      alert('Failed to create quotation: ' + (err.message || err));
    }
  };

  const handleConvertQuotationToCart = async (q: Quotation) => {
    const loadedItems: CartItem[] = (q.quotation_items || []).map(qi => {
      const matchedProd = allProducts.find(p => p.id === qi.product_id);
      return {
        product: matchedProd || {
          id: qi.product_id,
          name: qi.product_name,
          sku: qi.sku,
          selling_price: qi.unit_price,
          cost_price: qi.unit_price * 0.8,
          category_id: 'cat-gen',
          warranty_period: '1-Year',
          description: '',
          barcode: '',
          created_at: new Date().toISOString()
        },
        quantity: qi.quantity,
        discount: qi.discount || 0,
        unitPrice: qi.unit_price
      };
    });

    setCart(loadedItems);
    setOverallDiscount(q.discount || 0);

    if (q.customer_id) {
      setSelectedCustomerId(q.customer_id);
      setGuestName('');
      setGuestPhone('');
    } else {
      setSelectedCustomerId('');
      setGuestName(q.customer_name);
      setGuestPhone(q.customer_phone || '');
    }

    if (q.notes) {
      setBillingNote(`Quote Ref: ${q.quotation_no} - ${q.notes}`);
    }

    try {
      await updateQuotationStatus(q.id, 'converted');
      setQuotations(prev => prev.map(item => item.id === q.id ? { ...item, status: 'converted' } : item));
    } catch (e) {
      console.warn('Could not update quotation status:', e);
    }

    setActiveTab('checkout');
    setQuotationToastMsg(`Quotation ${q.quotation_no} loaded into POS checkout basket!`);
    setTimeout(() => setQuotationToastMsg(null), 4000);
  };

  const handleUpdateQuotationStatus = async (id: string, status: any) => {
    try {
      await updateQuotationStatus(id, status);
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    } catch (err) {
      console.error(err);
      alert('Failed to update quotation status');
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sales quotation?')) return;
    try {
      await deleteQuotation(id);
      setQuotations(prev => prev.filter(q => q.id !== id));
      setQuotationToastMsg('Quotation deleted successfully.');
      setTimeout(() => setQuotationToastMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to delete quotation');
    }
  };

  const prepareWhatsAppQuotation = (q: Quotation) => {
    const items = q.quotation_items || [];
    const itemLines = items.map(item => `• ${item.product_name} x${item.quantity} = Rs. ${((item.unit_price - item.discount) * item.quantity).toLocaleString()}`).join('\n');
    
    const text = `*MAJESTIC COMPUTERS - SALES QUOTATION*
📄 *Quotation No:* ${q.quotation_no}
📅 *Date:* ${q.created_at.split('T')[0]}
⏳ *Valid Until:* ${q.valid_until ? q.valid_until.split('T')[0] : '14 Days'}
👤 *Customer:* ${q.customer_name}

*Quoted Hardware Specification:*
${itemLines}

───────────────
💰 *Subtotal:* Rs. ${q.subtotal.toLocaleString()}
🏷️ *Discount:* Rs. ${q.discount.toLocaleString()}
💵 *Total Quoted Value:* Rs. ${q.total.toLocaleString()} LKR

*Terms & Conditions:*
${q.terms_conditions || '1-Year Hardware Warranty. Stock subject to showroom availability.'}

Thank you for choosing Majestic Computers!`;

    setWhatsappQuotationPhone(q.customer_phone || '');
    setWhatsappQuotationMessage(text);
    setSelectedQuotation(q);
    setShowWhatsAppQuotationDialog(true);
  };

  const sendWhatsAppQuotationMessage = () => {
    if (!whatsappQuotationPhone.trim()) {
      alert('Please enter a WhatsApp phone number.');
      return;
    }
    let cleanNum = whatsappQuotationPhone.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '94' + cleanNum.substring(1);
    }

    const appUrl = `whatsapp://send?phone=${cleanNum}&text=${encodeURIComponent(whatsappQuotationMessage)}`;
    const webUrl = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(whatsappQuotationMessage)}`;

    window.location.href = appUrl;
    setTimeout(() => {
      window.open(webUrl, '_blank');
    }, 1200);

    setShowWhatsAppQuotationDialog(false);
  };

  const handlePrint = (elementId: string, format: string, orientationOverride?: 'portrait' | 'landscape') => {
    const orientation = orientationOverride || printOrientation;
    let printStyle = '';
    
    const commonPrintCSS = `
      @media print {
        html, body {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        * {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
          border-color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: 'Courier New', Courier, monospace !important;
        }
        img { filter: grayscale(100%) contrast(1000%) !important; max-width: 100px; height: auto; }
        svg { stroke: #000000 !important; fill: none !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        th, td { 
          background-color: #ffffff !important; 
          color: #000000 !important; 
        }
      }
    `;

    if (format === 'thermal') {
      printStyle = `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { width: 80mm; padding: 2mm; margin: 0; }
        }
      `;
    } else if (format === 'a5') {
      printStyle = `
        @media print {
          @page { size: 148.5mm 210mm portrait; margin: 4mm; }
          body { width: 148.5mm; padding: 4mm; margin: 0; }
          th { border-bottom: 2px solid #000000 !important; font-size: 13px !important; font-weight: bold !important; }
          td { border-bottom: 1px dashed #000000 !important; font-size: 13px !important; font-weight: bold !important; }
        }
      `;
    } else if (format === 'a4-half') {
      // Continuous / Dot Matrix Half Sheet (8.5" x 5.5" / 210mm x 140mm)
      // When orientation is portrait (standard feed): size: auto ensures NO 90-degree browser rotation!
      if (orientation === 'landscape') {
        printStyle = `
          @media print {
            @page { size: landscape; margin: 4mm; }
            body { 
              width: 100% !important;
              margin: 0 !important; 
              padding: 0 !important;
            }
            #a4-half-invoice-display-area,
            #a4-half-quotation-display-area {
              width: 200mm !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4mm 8mm !important;
              box-sizing: border-box !important;
            }
          }
        `;
      } else {
        printStyle = `
          @media print {
            @page { 
              size: auto; /* Portrait feed across continuous paper - NO 90-degree sideways rotation */
              margin: 0mm; 
            }
            body { 
              width: 100% !important;
              margin: 0 !important; 
              padding: 0 !important;
            }
            #a4-half-invoice-display-area,
            #a4-half-quotation-display-area {
              width: 200mm !important;
              max-width: 100% !important;
              min-height: 130mm !important;
              max-height: 138mm !important; /* Fits standard 5.5 inch continuous page tear-off */
              margin: 0 auto !important;
              padding: 4mm 8mm !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
            }
          }
        `;
      }
    } else {
      printStyle = `
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { padding: 12px; width: 100%; }
        }
      `;
    }

    const resetOuterBoxStyle = `
      @media print {
        #thermal-receipt-display-area,
        #thermal-quotation-display-area,
        #a4-invoice-display-area,
        #a4-quotation-display-area,
        #a4-half-invoice-display-area,
        #a4-half-quotation-display-area,
        #a5-invoice-display-area,
        #a5-quotation-display-area {
          border: none !important;
          border-width: 0px !important;
          margin: 0 auto !important;
        }
      }
    `;

    globalPrint(elementId, commonPrintCSS + '\n' + printStyle + '\n' + resetOuterBoxStyle);
  };

  return (
    <div className="space-y-6" id="pos-module-root">
      {/* Quotation Toast Message */}
      {quotationToastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{quotationToastMsg}</span>
          </div>
          <button onClick={() => setQuotationToastMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-extrabold">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Switcher Header */}
      <div className="flex flex-wrap justify-between items-center bg-zinc-50 border border-zinc-200/80 p-2 rounded-2xl gap-2">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'checkout'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Interactive POS Screen
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <History className="w-4 h-4" />
            Showroom Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('quotations')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'quotations'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-300" />
            Sales Quotations ({quotations.length})
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-600 bg-white border border-zinc-200 px-3 py-1.5 rounded-xl shadow-xs">
          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Showing Branch Stock For:</span>
          {user.role === 'super_admin' && branches && branches.length > 0 && onBranchChange ? (
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => onBranchChange(e.target.value)}
              className="bg-zinc-100 border border-zinc-250 text-zinc-900 rounded-lg px-2 py-0.5 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-xs"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          ) : (
            <span className="text-amber-600 font-extrabold uppercase">{activeBranch?.name || 'Main Branch'} ({activeBranch?.code || 'HQ'})</span>
          )}
        </div>
      </div>

      {errorText && (
        <div className="bg-red-50 border border-red-100 text-red-750 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-550 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {activeTab === 'checkout' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pos-screen-layout">
          {/* Left Column - Product Finder Catalog (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Filtering Box & Category Tabs */}
            <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by Laptop name, RAM, parts, barcode or SKU SKU code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-250 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Quick SKU scan barcodes */}
              <div className="flex flex-wrap gap-2 items-center text-[10px] text-zinc-500 bg-zinc-50 p-2 rounded-xl">
                <Barcode className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Simulate Laser Scans on item shelves:</span>
                <button 
                  onClick={() => simulateBarcodeScan('889349120491')}
                  className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded transition-colors font-mono"
                >
                  [Asus ROG Laptop]
                </button>
                <button 
                  onClick={() => simulateBarcodeScan('887276451551')}
                  className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded transition-colors font-mono"
                >
                  [Samsung Gen4 SSD]
                </button>
                <button 
                  onClick={() => simulateBarcodeScan('010343961204')}
                  className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-2 py-0.5 rounded transition-colors font-mono"
                >
                  [Epson Desk Printer]
                </button>
              </div>

              {/* Categories scrollbar & Stock Filter Toggle */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1 scrollbar-thin items-center">
                <button
                  type="button"
                  onClick={() => setHideZeroStock(!hideZeroStock)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5 border ${
                    hideZeroStock
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                  }`}
                  title={hideZeroStock ? 'Zero stock items are hidden. Click to show.' : 'Showing all items including zero stock.'}
                >
                  {hideZeroStock ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Hiding 0 Stock</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Showing 0 Stock</span>
                    </>
                  )}
                </button>

                <div className="h-4 w-px bg-zinc-200 shrink-0 mx-0.5" />

                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                    selectedCategory === 'all'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                  }`}
                >
                  All Tech Ware
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                      selectedCategory === c.id
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="products-catalog-grid">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-zinc-200 p-6 space-y-2">
                  <PackageX className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-600">No available items found</p>
                  <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                    {hideZeroStock 
                      ? "Zero stock items are currently hidden. Toggle 'Hiding 0 Stock' above or adjust search query." 
                      : "No products matched your selected category or search filter."}
                  </p>
                  {hideZeroStock && (
                    <button
                      type="button"
                      onClick={() => setHideZeroStock(false)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Show Zero Stock Items
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                        <span>{p.sku}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          p.stock > 3 ? 'bg-green-50 text-green-600' : p.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {activeBranch ? `${activeBranch.code} Stock:` : 'Stock:'} {p.stock}
                        </span>
                      </div>
                      <h5 className="text-[12px] font-bold text-zinc-900 group-hover:text-indigo-600 tracking-tight leading-4 line-clamp-2">
                        {p.name}
                      </h5>
                    </div>
                    
                    <div className="flex items-end justify-between border-t border-zinc-50 pt-2">
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-light">Selling Value</span>
                        <span className="text-sm font-extrabold text-zinc-900">
                          Rs. {p.selling_price.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-zinc-100 p-1.5 rounded-full group-hover:bg-indigo-50 transition-colors">
                        <Plus className="w-4 h-4 text-zinc-550 group-hover:text-indigo-650" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - Active Cart Checkouts (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-zinc-200 p-5 shadow-sm h-fit flex flex-col space-y-4" id="checkout-basket-container">
            <h4 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-indigo-500" />
                Active Sales Basket
              </span>
              <button 
                onClick={resetPOS}
                className="text-zinc-450 hover:text-red-500 p-1 rounded hover:bg-red-50 text-[11px] font-medium transition-colors"
              >
                Reset Basket
              </button>
            </h4>

            {/* CRM Customer selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-700 block">Select Customer Profile / Guest:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowImportCustomerModal(true)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 transition-all border border-emerald-200 cursor-pointer"
                    title="Import Customers from Excel or CSV"
                  >
                    <FileUp className="w-3 h-3 text-emerald-600" />
                    Excel Import
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerCRMModal(true)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 transition-all border border-indigo-200 cursor-pointer"
                    title="View Customer CRM Registry"
                  >
                    <Users className="w-3 h-3 text-indigo-600" />
                    CRM
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    title="Add New Customer"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>

              {customerStatusMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in duration-300">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{customerStatusMsg}</span>
                </div>
              )}

              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setGuestName('');
                  setGuestPhone('');
                }}
                className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="">Guest Walk-In Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone} - Pts: {c.loyalty_points})</option>
                ))}
              </select>

              {!selectedCustomerId && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Guest Mobile"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1" id="cart-item-list">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  Sales basket is currently empty.<br />Add catalog hardware from the left panel.
                </div>
              ) : (
                cart.map((item, idx) => {
                  const currentPrice = getItemUnitPrice(item);
                  const isPriceModified = typeof item.unitPrice === 'number' && item.unitPrice !== item.product.selling_price;
                  const lineTotal = Math.max(0, (currentPrice - item.discount) * item.quantity);

                  return (
                    <div key={idx} className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2.5 text-xs hover:border-zinc-300 transition-all shadow-2xs">
                      {/* Top row: Title, SKU, Status & Remove Button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-zinc-900 truncate tracking-tight text-[13px]">{item.product.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                            <span className="font-mono bg-zinc-200/70 text-zinc-700 px-1.5 py-0.2 rounded font-semibold">{item.product.sku}</span>
                            <span>•</span>
                            <span className={isPriceModified ? "line-through text-zinc-400 font-medium" : "text-zinc-600 font-medium"}>
                              Catalog: Rs. {item.product.selling_price.toLocaleString()}
                            </span>
                            {isPriceModified && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                                Custom Rate
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remove item from basket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Middle Box: Editable Unit Selling Price & Line Total */}
                      <div className="bg-white p-2.5 rounded-xl border border-zinc-200 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-bold text-zinc-700 flex items-center gap-1" title="Type to change unit price">
                            <Pencil className="w-3 h-3 text-indigo-600" />
                            <span>Billing Unit Price (Rs.):</span>
                          </label>
                          {isPriceModified && (
                            <button
                              type="button"
                              onClick={() => resetItemPriceToDefault(idx)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                              title="Reset back to catalog price"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset Default</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold pointer-events-none">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice !== undefined ? (item.unitPrice === 0 ? '' : item.unitPrice) : item.product.selling_price}
                              onChange={(e) => updateItemPrice(idx, e.target.value)}
                              className={`w-full bg-zinc-50 border ${
                                isPriceModified ? 'border-amber-400 bg-amber-50/40 text-amber-950 font-bold ring-1 ring-amber-300' : 'border-zinc-250 text-zinc-900 font-bold'
                              } text-sm pl-8 pr-2.5 py-1.5 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-mono tracking-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                              placeholder="0.00"
                              title="Enter unit selling price"
                            />
                          </div>

                          <div className="text-right shrink-0 pl-1">
                            <span className="text-[9px] text-zinc-400 block font-normal leading-tight">Line Total</span>
                            <span className="font-extrabold text-zinc-900 text-sm font-mono whitespace-nowrap">
                              Rs. {lineTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Qty stepper & Item Discount */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {/* Qty Stepper */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-bold">Qty:</span>
                          <div className="flex items-center border border-zinc-250 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button 
                              type="button"
                              onClick={() => updateQuantity(idx, -1)}
                              className="p-1.5 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer"
                              title="Decrease Quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 font-bold text-zinc-800 text-xs min-w-[24px] text-center font-mono">{item.quantity}</span>
                            <button 
                              type="button"
                              onClick={() => updateQuantity(idx, 1)}
                              className="p-1.5 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer"
                              title="Increase Quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Item Discount */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-0.5">
                            <Tag className="w-3 h-3 text-amber-500" />
                            <span>Disc:</span>
                          </span>
                          <div className="relative w-24">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold pointer-events-none">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.discount || ''}
                              onChange={(e) => updateItemDiscount(idx, e.target.value)}
                              className="w-full bg-white border border-zinc-250 text-xs pl-6 pr-1.5 py-1 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-right text-zinc-700 font-semibold font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Discount per unit"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Invoicing summary calculations */}
            <div className="border-t border-zinc-100 pt-3 space-y-1.5 text-xs text-zinc-605">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-zinc-800">Rs. {subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-zinc-500">
                  <Percent className="w-3.5 h-3.5" />
                  Showroom Promo Discount:
                </span>
                <input
                  type="number"
                  value={overallDiscount || ''}
                  onChange={(e) => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 bg-zinc-50 border border-zinc-200 rounded text-right text-xs px-1.5 py-0.5 font-semibold text-zinc-850"
                  placeholder="Rs. LKR"
                />
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Sales VAT {companySetting?.tax_enabled !== false ? `(${companySetting?.tax_rate}%)` : '(Disabled)'}:</span>
                <span>Rs. {taxAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between border-t border-zinc-250 pt-2 text-sm font-extrabold text-zinc-900 bg-zinc-50 p-2.5 rounded-xl">
                <span>Total Bills:</span>
                <span className="text-indigo-650">Rs. {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment inputs */}
            <div className="space-y-2 bg-indigo-50/45 border border-indigo-100/60 p-3.5 rounded-2xl">
              <label className="text-[11px] font-bold text-indigo-900 block">Choose Payment Method:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'bank_transfer', label: 'Bank', icon: Landmark },
                  { id: 'split', label: 'Split', icon: Grid }
                ].map(meth => {
                  const Icon = meth.icon;
                  return (
                    <button
                      key={meth.id}
                      onClick={() => {
                        setPaymentMethod(meth.id as PaymentMethod);
                        if (meth.id !== 'split') {
                          setPaidAmount(totalAmount);
                        } else {
                          setCashSplit(Math.round(totalAmount / 2));
                          setCardSplit(Math.round(totalAmount / 2));
                          setBankSplit(0);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-[11px] font-bold uppercase transition-all ${
                        paymentMethod === meth.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white hover:bg-zinc-150 border-zinc-200 text-zinc-650'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{meth.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Input for single non-split payments */}
              {paymentMethod !== 'split' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-600 mt-2">
                    <span>Tendered / Paid Cashier Amount:</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">Rs.</span>
                    <input
                      type="number"
                      value={paidAmount || ''}
                      onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-white border border-zinc-200 text-xs font-bold rounded-xl pl-9 pr-3 py-1.5 text-zinc-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {paidAmount > totalAmount && (
                    <div className="text-[11px] font-semibold text-green-700 text-right mt-1.5">
                      Change back: Rs. {(paidAmount - totalAmount).toLocaleString()} LKR
                    </div>
                  )}
                </div>
              ) : (
                /* Inputs for Split allocations */
                <div className="space-y-2 mt-2 bg-white rounded-xl p-3 border border-indigo-100">
                  <span className="text-[10px] font-bold text-zinc-550 block bg-zinc-50 p-1 rounded text-center">
                    Split Breakdown Allocations:
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-600">Cash split:</span>
                      <input 
                        type="number"
                        value={cashSplit || ''}
                        onChange={(e) => setCashSplit(parseFloat(e.target.value) || 0)}
                        className="w-24 border border-zinc-200 px-2 py-0.5 rounded text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-600">Card split:</span>
                      <input 
                        type="number"
                        value={cardSplit || ''}
                        onChange={(e) => setCardSplit(parseFloat(e.target.value) || 0)}
                        className="w-24 border border-zinc-200 px-2 py-0.5 rounded text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-600">Bank split:</span>
                      <input 
                        type="number"
                        value={bankSplit || ''}
                        onChange={(e) => setBankSplit(parseFloat(e.target.value) || 0)}
                        className="w-24 border border-zinc-200 px-2 py-0.5 rounded text-right"
                      />
                    </div>
                    <div className="border-t border-zinc-150 pt-1.5 flex justify-between text-[11px] font-bold text-indigo-705">
                      <span>Total Allocated:</span>
                      <span>Rs. {(cashSplit + cardSplit + bankSplit).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Billing Note */}
            <div className="space-y-1 bg-zinc-50 border border-zinc-200 p-3 rounded-2xl">
              <label className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Billing Note / Order Remarks:</span>
              </label>
              <textarea
                value={billingNote}
                onChange={(e) => setBillingNote(e.target.value)}
                placeholder="Enter custom remarks or note for this invoice..."
                className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-850 outline-none focus:border-zinc-350 focus:ring-1 focus:ring-zinc-150 h-16 resize-none"
                maxLength={500}
              />
            </div>

            {/* Checkout & Quotation Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenSaveQuotationModal}
                disabled={isProcessingSale || cart.length === 0}
                className="w-full bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed text-amber-900 border border-amber-300 font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                title="Generate quotation without deducting inventory"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-700" />
                <span>Save As Quotation</span>
              </button>

              <button
                type="button"
                id="pos-complete-sale-btn"
                onClick={handleCheckout}
                disabled={isProcessingSale || cart.length === 0 || totalAmount <= 0}
                className={`w-full font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${
                  isProcessingSale
                    ? 'bg-zinc-800 text-zinc-200 cursor-not-allowed shadow-inner opacity-90'
                    : cart.length === 0 || totalAmount <= 0
                    ? 'bg-zinc-250 text-zinc-400 cursor-not-allowed shadow-none'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer shadow-md'
                }`}
                title={isProcessingSale ? 'Processing and saving bill...' : 'Complete sale and generate invoice receipt'}
              >
                {isProcessingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span>Saving Bill...</span>
                  </>
                ) : (
                  <span>Complete Sale & Issue Bill</span>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'history' ? (
        /* Invoice transactions Log screen (History Tab) */
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm space-y-4" id="invoice-history-panel">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-100">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" />
              Recent Bills Log ({activeBranch?.name})
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-left uppercase text-[10px]">
                  <th className="pb-3 text-left">Invoice No</th>
                  <th className="pb-3 text-left">Customer Profile</th>
                  <th className="pb-3 text-center">Payment System</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Invoice value</th>
                  <th className="pb-3 text-right">Created at</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {invoices.map(inv => {
                  const isVoid = inv.status === 'void' || inv.status === 'deleted';
                  return (
                    <tr key={inv.id} className={`hover:bg-zinc-50/50 transition-colors ${isVoid ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3 font-semibold font-mono text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          <span className={isVoid ? 'line-through text-zinc-400' : ''}>{inv.invoice_no}</span>
                          {isVoid && (
                            <span className="text-[9px] font-black uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                              VOIDED
                            </span>
                          )}
                        </div>
                        {isVoid && inv.void_reason && (
                          <div className="text-[9.5px] text-rose-700 font-sans mt-0.5 max-w-xs">
                            Voided by {inv.voided_by || 'Admin'}: {inv.void_reason}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <div className={`font-semibold ${isVoid ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{inv.customer_name}</div>
                        {inv.customer_phone && <div className="text-[10px] text-zinc-400 mt-0.5">{inv.customer_phone}</div>}
                        {inv.notes && (
                          <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 mt-1 font-sans max-w-xs block">
                            <strong>Note:</strong> {inv.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-medium uppercase bg-zinc-100 px-2.5 py-1 rounded text-[10px]">
                          {inv.payment_method === 'bank_transfer' ? 'Bank' : inv.payment_method}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {isVoid ? (
                          <span className="text-[10px] bg-rose-100 text-rose-750 px-2 py-0.5 rounded font-extrabold uppercase border border-rose-200">
                            VOIDED
                          </span>
                        ) : inv.refund_status === 'fully_refunded' ? (
                          <span className="text-[10px] bg-red-100 text-red-750 px-2 py-0.5 rounded font-extrabold uppercase">
                            Refunded
                          </span>
                        ) : (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            inv.payment_status === 'paid' ? 'bg-green-100 text-green-755' : 'bg-amber-100 text-amber-705'
                          }`}>
                            {inv.payment_status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-extrabold text-zinc-900">
                        <span className={isVoid ? 'line-through text-zinc-400' : ''}>
                          Rs. {inv.total.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 text-right text-zinc-540">{inv.created_at.split('T')[0]}</td>
                      <td className="py-3 text-right space-x-1 whitespace-nowrap">
                        {/* WhatsApp trigger */}
                        <button
                          onClick={() => prepareWhatsAppBill(inv)}
                          title="Send Bill via WhatsApp"
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                        >
                          <MessageCircle className="w-4 h-4 inline" />
                        </button>

                        {/* Print receipts trigger */}
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setShowPrintModal('thermal');
                          }}
                          title="Print 80mm Custom Receipt"
                          className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                        >
                          <Printer className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setShowPrintModal('a4');
                          }}
                          title="Corporate A4 Bill Layout"
                          className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors text-[11px]"
                        >
                          A4
                        </button>

                        {/* Refund Trigger (Only if active and not refunded) */}
                        {!isVoid && inv.refund_status !== 'fully_refunded' && (
                          <button
                            onClick={() => handleStartRefund(inv)}
                            className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 rounded transition-colors"
                            title="Authorize Gated Refund"
                          >
                            <RefreshCcw className="w-3.5 h-3.5 inline" />
                          </button>
                        )}

                        {/* Admin Modify Invoice Trigger (Only if active) */}
                        {isUserAdmin(user) && !isVoid && (
                          <button
                            onClick={() => handleStartAdminEdit(inv)}
                            className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 rounded transition-colors"
                            title="Modify Invoice (Admin)"
                          >
                            <Pencil className="w-3.5 h-3.5 inline" />
                          </button>
                        )}

                        {/* Admin Sales Return Trigger (Only if active) */}
                        {isUserAdmin(user) && !isVoid && inv.refund_status !== 'fully_refunded' && (
                          <button
                            onClick={() => handleStartSalesReturn(inv)}
                            className="p-1 text-zinc-400 hover:text-orange-600 hover:bg-zinc-100 rounded transition-colors"
                            title="Admin Sales Return (Granular)"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5 inline" />
                          </button>
                        )}

                        {/* Admin Delete / Void Invoice Trigger (ADMIN ONLY) */}
                        {isUserAdmin(user) && (
                          <button
                            onClick={() => handleStartDeleteInvoice(inv)}
                            className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title={isVoid ? 'Permanently Delete / Purge Invoice Record (Admin)' : 'Delete / Void Sales Invoice & Restore Stock (Admin)'}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sales Quotations Management Tab */
        <div className="space-y-4" id="quotations-dashboard-panel">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Quotations</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-zinc-900">{quotations.length}</span>
                <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-lg">Showroom</span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Quoted Pipeline Value</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-indigo-600">
                  Rs. {quotations.reduce((sum, q) => sum + (q.total || 0), 0).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-500 font-medium">LKR</span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Active / Pending</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-amber-600">
                  {quotations.filter(q => q.status === 'pending' || q.status === 'sent').length}
                </span>
                <span className="text-xs text-amber-700 font-semibold">Under Consideration</span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Converted to Sales</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-emerald-600">
                  {quotations.filter(q => q.status === 'converted' || q.status === 'accepted').length}
                </span>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                  {quotations.length > 0
                    ? Math.round((quotations.filter(q => q.status === 'converted' || q.status === 'accepted').length / quotations.length) * 100)
                    : 0}% Success
                </span>
              </div>
            </div>
          </div>

          {/* Quotations Main Panel */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-bold text-zinc-900">
                  Showroom Sales Quotations ({activeBranch?.name || 'All Branches'})
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const headers = ['Quotation No', 'Date', 'Valid Until', 'Customer Name', 'Phone', 'Email', 'Branch', 'Subtotal (LKR)', 'Discount (LKR)', 'Total (LKR)', 'Status', 'Items Count'];
                    const rows = quotations.map(q => [
                      q.quotation_no,
                      q.created_at.split('T')[0],
                      q.valid_until || '14 Days',
                      q.customer_name,
                      q.customer_phone || '',
                      q.customer_email || '',
                      q.branch_name,
                      q.subtotal,
                      q.discount,
                      q.total,
                      q.status,
                      q.quotation_items?.length || 0
                    ]);
                    exportToCSV(headers, rows, `Quotations_${activeBranch?.name || 'Showroom'}_${new Date().toISOString().split('T')[0]}.csv`);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <FileDown className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('checkout')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Quote in POS</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by quote number, customer name, phone, item name, notes..."
                  value={quotationSearchQuery}
                  onChange={(e) => setQuotationSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={quotationStatusFilter}
                  onChange={(e) => setQuotationStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                >
                  <option value="all">All Quotation Statuses</option>
                  <option value="pending">Pending / Draft</option>
                  <option value="sent">Sent to Customer</option>
                  <option value="accepted">Customer Accepted</option>
                  <option value="converted">Converted to Invoice</option>
                  <option value="rejected">Rejected / Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            {/* Quotations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-left uppercase text-[10px]">
                    <th className="pb-3 text-left">Quote No</th>
                    <th className="pb-3 text-left">Customer Profile</th>
                    <th className="pb-3 text-left">Quoted Specifications</th>
                    <th className="pb-3 text-center">Validity & Date</th>
                    <th className="pb-3 text-right">Quoted Total</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        <div className="max-w-sm mx-auto space-y-2">
                          <FileSpreadsheet className="w-8 h-8 text-zinc-300 mx-auto" />
                          <p className="text-xs font-semibold text-zinc-600">No sales quotations found matching criteria.</p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('checkout')}
                            className="text-amber-600 hover:text-amber-700 font-bold text-xs underline"
                          >
                            Add products to basket and generate a new quotation
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map(q => {
                      const isExpired = q.valid_until && new Date(q.valid_until).getTime() < Date.now();
                      const statusColor = 
                        q.status === 'converted' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        q.status === 'accepted' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        q.status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        q.status === 'rejected' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                        isExpired ? 'bg-zinc-100 text-zinc-600 border-zinc-200' :
                        'bg-amber-100 text-amber-800 border-amber-200';

                      return (
                        <tr key={q.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-3 font-semibold font-mono text-zinc-900">
                            <div className="flex items-center gap-1">
                              <span>{q.quotation_no}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 block font-sans">
                              {q.branch_name}
                            </span>
                          </td>

                          <td className="py-3">
                            <div className="font-bold text-zinc-900">{q.customer_name}</div>
                            {q.customer_phone && <div className="text-[10px] text-zinc-500">{q.customer_phone}</div>}
                            {q.customer_email && <div className="text-[10px] text-zinc-400">{q.customer_email}</div>}
                            {q.notes && (
                              <div className="text-[10px] text-amber-900 bg-amber-50/90 border border-amber-200 rounded px-1.5 py-0.5 mt-1 max-w-xs">
                                <strong>Note:</strong> {q.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 max-w-xs">
                            <div className="font-semibold text-zinc-800">
                              {(q.quotation_items || []).length} Item{(q.quotation_items || []).length !== 1 ? 's' : ''}:
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate" title={(q.quotation_items || []).map(i => `${i.product_name} (x${i.quantity})`).join(', ')}>
                              {(q.quotation_items || []).map(i => `${i.product_name} (x${i.quantity})`).join(', ')}
                            </div>
                          </td>

                          <td className="py-3 text-center">
                            <div className="text-[11px] font-semibold text-zinc-800">
                              {q.created_at.split('T')[0]}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              Valid: {q.valid_until ? q.valid_until.split('T')[0] : '14 Days'}
                            </div>
                            {isExpired && q.status === 'pending' && (
                              <span className="text-[9px] font-extrabold text-red-600 uppercase tracking-tight block mt-0.5">
                                [Expired]
                              </span>
                            )}
                          </td>

                          <td className="py-3 text-right font-extrabold text-zinc-900">
                            Rs. {q.total.toLocaleString()}
                            {q.discount > 0 && (
                              <span className="block text-[10px] text-emerald-600 font-medium">
                                -Rs. {q.discount.toLocaleString()} disc
                              </span>
                            )}
                          </td>

                          <td className="py-3 text-center">
                            <select
                              value={q.status}
                              onChange={(e) => handleUpdateQuotationStatus(q.id, e.target.value)}
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none ${statusColor}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="sent">Sent</option>
                              <option value="accepted">Accepted</option>
                              <option value="converted">Converted</option>
                              <option value="rejected">Rejected</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>

                          <td className="py-3 text-right space-x-1 whitespace-nowrap">
                            {/* Print / Preview */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedQuotation(q);
                                setShowQuotationPrintModal(true);
                              }}
                              title="Print / Preview Quotation Formats (A4-Half, A4, Thermal, A5)"
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                            >
                              <Printer className="w-3.5 h-3.5 inline" />
                              <span>Print</span>
                            </button>

                            {/* Convert to POS Cart */}
                            <button
                              type="button"
                              onClick={() => handleConvertQuotationToCart(q)}
                              title="Load items from this quotation directly into POS checkout basket"
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 inline" />
                              <span>To POS</span>
                            </button>

                            {/* WhatsApp Quote */}
                            <button
                              type="button"
                              onClick={() => prepareWhatsAppQuotation(q)}
                              title="Transmit Quotation via WhatsApp"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 inline" />
                            </button>

                            {/* Delete Quote */}
                            <button
                              type="button"
                              onClick={() => handleDeleteQuotation(q.id)}
                              title="Delete Quotation"
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RETAIL BILL PRINTING PREVIEWS MODAL LAYER */}
      {showPrintModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex flex-col space-y-2 border-b border-zinc-100 pb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest">
                  Billing Output System
                </span>
                <button
                  onClick={() => {
                    setSelectedInvoice(null);
                    setShowPrintModal(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-900 text-xs font-semibold"
                >
                  Close Previews
                </button>
              </div>
              <div className="flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-xl">
                {[
                  { key: 'a4-half', label: 'A4 Half (Landscape)' },
                  { key: 'thermal', label: '80mm Thermal' },
                  { key: 'a4', label: 'Standard A4' },
                  { key: 'a5', label: 'A5 Portrait' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setShowPrintModal(tab.key)}
                    className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-all text-center whitespace-nowrap ${
                      showPrintModal === tab.key
                        ? 'bg-white text-indigo-650 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Orientation selector for printer drivers */}
              <div className="flex items-center justify-between pt-1 px-1">
                <span className="text-[10px] font-semibold text-zinc-500">Feed Orientation:</span>
                <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-2 py-0.5 rounded transition-all ${printOrientation === 'portrait' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                    title="Recommended for tractor continuous paper - prints straight without 90 degree sideways rotation"
                  >
                    Standard Feed (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-2 py-0.5 rounded transition-all ${printOrientation === 'landscape' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                    title="Rotates page 90 degrees for landscape-oriented feeds"
                  >
                    Landscape (Rotated 90°)
                  </button>
                </div>
              </div>

              {showPrintModal === 'a4-half' && (
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 text-[10px] text-amber-900 leading-tight">
                  <strong>💡 Dot Matrix Continuous Paper Tip:</strong> <em>Standard Feed (Portrait)</em> is active to prevent 90° sideways rotation on continuous tractor roll paper. In the browser print dialog, set Margins to <em>&quot;None&quot;</em> or <em>&quot;Default&quot;</em>.
                </div>
              )}
            </div>

            {/* RENDER DYNAMIC VISUAL FORMATS */}
            <div className="border border-zinc-200 rounded-2xl p-4 overflow-y-auto max-h-[420px] bg-zinc-50 flex justify-center">
              {showPrintModal === 'thermal' && (
                /* Thermal 80mm styled widget */
                <div className="w-[80mm] bg-white p-4 border border-zinc-300 shadow-sm text-[11px] font-mono leading-relaxed text-zinc-805 flex flex-col items-center select-none" id="thermal-receipt-display-area">
                  <div className="font-extrabold text-center uppercase tracking-wide text-xs">{companySetting.company_name}</div>
                  <div className="text-center text-[10px] text-zinc-500 mt-0.5">{selectedInvoice.branch_name}</div>
                  <div className="text-center text-[9px] text-zinc-500">{invoiceBranchInfo.address}</div>
                  <div className="text-center text-[9px] text-zinc-500">Tel: {invoiceBranchInfo.phone}</div>
                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full space-y-0.5 text-[9px]">
                    <div><strong>Bill Date:</strong> {selectedInvoice.created_at.replace('T', ' ').substring(0, 19)}</div>
                    <div><strong>Bill No:</strong> {selectedInvoice.invoice_no}</div>
                    <div><strong>Customer:</strong> {selectedInvoice.customer_name}</div>
                    <div><strong>Salesperson:</strong> {selectedInvoice.created_by_name}</div>
                  </div>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  {/* Items list */}
                  <table className="w-full text-[9px]">
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr className="border-b border-zinc-200">
                        <th className="text-left font-bold pb-1">Item Description</th>
                        <th className="text-center font-bold pb-1">Qty</th>
                        <th className="text-right font-bold pb-1">Price</th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      {/* Read items from invoice items */}
                      {(selectedInvoice?.invoice_items || []).map((item, index) => (
                        <tr key={index} className="border-b border-zinc-100 mt-1">
                          <td className="py-1">
                            <div className="font-bold text-zinc-900">{item.product_name}</div>
                            {item.sku && <div className="text-[8px] text-zinc-500 font-mono">SKU: {item.sku}</div>}
                            {item.quantity > 1 && (
                              <div className="text-[8px] text-zinc-600">
                                @ Rs. {(item.unit_price - item.discount).toLocaleString()} each
                              </div>
                            )}
                            {item.discount > 0 && <div className="text-[8px] text-zinc-500">-Rs. {item.discount} item discount</div>}
                          </td>
                          <td className="py-1 text-center font-semibold">{item.quantity}</td>
                          <td className="py-1 text-right font-bold">Rs. {((item.unit_price - item.discount) * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />

                  <div className="w-full space-y-1 text-[10px]" id="receipt-totals-section">
                    <div className="flex justify-between">
                      <span>Total Gross:</span>
                      <span>Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Overall Disc:</span>
                        <span>-Rs. {selectedInvoice.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax GST/VAT:</span>
                      <span>Rs. {selectedInvoice.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs border-t border-zinc-200 pt-1.5 leading-none">
                      <span>Nett Bill:</span>
                      <span>Rs. {selectedInvoice.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[9px] pt-1">
                      <span>Tendered Method:</span>
                      <span className="uppercase font-bold">{selectedInvoice.payment_method}</span>
                    </div>
                  </div>

                  {selectedInvoice.notes && (
                    <>
                      <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                      <div className="w-full text-left text-[9px] bg-zinc-50 p-1.5 rounded">
                        <strong>Note:</strong> {selectedInvoice.notes}
                      </div>
                    </>
                  )}

                  <div className="w-full border-t border-dashed border-zinc-300 my-3" />
                  <div className="text-[9px] text-center font-bold">WARRANTY COVERS INTERNAL FAULTS ONLY</div>
                  <div className="text-[9px] text-center italic mt-1 text-zinc-455">&quot;Majestic Service First&quot;</div>
                </div>
              )}

              {showPrintModal === 'a4' && (
                /* Corporate A4 styled layout */
                <div className="w-full bg-white p-6 border border-zinc-300 shadow-sm text-xs leading-relaxed text-zinc-800 flex flex-col space-y-4" id="a4-invoice-display-area">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-tight">{companySetting.company_name}</h3>
                      <p className="text-[9px] text-zinc-500 mt-1">{selectedInvoice.branch_name}</p>
                      <p className="text-[9px] text-zinc-500">{invoiceBranchInfo.address}</p>
                      <p className="text-[9px] text-zinc-505">Web: {companySetting.website}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-indigo-650 font-black uppercase text-lg leading-none">INVOICE</h4>
                      <p className="font-mono text-xs font-semibold text-zinc-650 mt-2">No: {selectedInvoice.invoice_no}</p>
                      <p className="text-[9px] text-zinc-505">Date: {selectedInvoice.created_at.split('T')[0]}</p>
                    </div>
                  </div>

                  <div className="border-t border-b border-zinc-150 py-3 grid grid-cols-2 gap-4 text-[10px]">
                    <div>
                      <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Invoiced Customer Profile:</div>
                      <p className="text-zinc-900 font-bold text-xs">{selectedInvoice.customer_name}</p>
                      {selectedInvoice.customer_phone && <p className="text-zinc-550 mt-1">Mobile: {selectedInvoice.customer_phone}</p>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Billing Agent:</div>
                      <p className="text-zinc-900 font-semibold">{selectedInvoice.created_by_name}</p>
                      <p className="text-zinc-505 uppercase text-[9px] font-bold">Showroom POS: {selectedInvoice.payment_method}</p>
                    </div>
                  </div>

                  <table className="invoice-table w-full text-xs text-left text-zinc-600">
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr className="border-b-2 border-zinc-200 font-bold text-[9px] uppercase text-zinc-500">
                        <th className="pb-1.5 text-left">SKU Sku</th>
                        <th className="pb-1.5 text-left">Hardware Description</th>
                        <th className="pb-1.5 text-center">Unit Price</th>
                        <th className="pb-1.5 text-center">Quantity</th>
                        <th className="pb-1.5 text-right">Amnt Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(selectedInvoice?.invoice_items || []).map((item, index) => (
                        <tr key={index} className="text-[10.5px]">
                          <td className="py-2.5 font-mono text-zinc-900">{item.sku}</td>
                          <td className="py-2.5 font-semibold text-zinc-850">{item.product_name}</td>
                          <td className="py-2.5 text-center">Rs. {item.unit_price.toLocaleString()}</td>
                          <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 text-right font-bold text-zinc-905">
                            Rs. {((item.unit_price - item.discount) * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between pt-4" id="a4-totals-grid-section">
                    <div className="max-w-[50%] text-[9px] text-zinc-500">
                      <p className="font-bold uppercase tracking-wider text-zinc-650 text-[8px] mb-1">Warranty policy Terms:</p>
                      <p>{companySetting.terms_conditions}</p>
                      {selectedInvoice.notes && (
                        <div className="mt-3 p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] text-zinc-700 text-left">
                          <p className="font-bold text-zinc-650 uppercase text-[8px] tracking-wider mb-0.5">Order Remarks / Note:</p>
                          <p>{selectedInvoice.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="w-48 text-right space-y-1.5 text-[11px] font-semibold text-zinc-605">
                      <div className="flex justify-between">
                        <span>Items Total:</span>
                        <span>Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                      </div>
                      {selectedInvoice.discount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Discount promo:</span>
                          <span>-Rs. {selectedInvoice.discount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>VAT Goods tax {companySetting?.tax_enabled !== false ? `(${companySetting?.tax_rate}%)` : '(Disabled)'}:</span>
                        <span>Rs. {selectedInvoice.tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs text-zinc-900 border-t-2 border-zinc-200 pt-1.5">
                        <span>Nett Amount:</span>
                        <span>Rs. {selectedInvoice.total.toLocaleString()} LKR</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showPrintModal === 'a4-half' && (
                /* Corporate A4 Half Sheet (Landscape) styled layout matching majestic computers format */
                <div 
                  id="a4-half-invoice-display-area"
                  style={{
                    fontFamily: "'Courier New', monospace",
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    width: '210mm',
                    minHeight: '148.5mm',
                    padding: '8mm 12mm',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    {/* Top Header */}
                    <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{"<< RETAIL INVOICE >>"}</div>
                      <div style={{ fontSize: '22px', fontWeight: '900', margin: '5px 0', color: '#000000' }}>
                        {companySetting.company_name}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {invoiceBranchInfo.address}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        Tel: {invoiceBranchInfo.phone}
                      </div>
                    </div>

                    {/* Customer and Invoice Details Grid */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', lineHeight: '1.5', color: '#000000' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div>Customer Details:</div>
                        <div>{selectedInvoice.customer_name || 'Cash'}</div>
                        {selectedInvoice.customer_phone && (
                          <div>Tel: {selectedInvoice.customer_phone}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Invoice No:</span>
                          <span>{selectedInvoice.invoice_no}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Date:</span>
                          <span>
                            {(() => {
                              try {
                                const d = new Date(selectedInvoice.created_at);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}-${month}-${year}`;
                              } catch (e) {
                                return selectedInvoice.created_at.split('T')[0];
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div style={{ marginTop: '10px' }}>
                      <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>
                        <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          <tr style={{ borderTop: '2px solid black', borderBottom: '2px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '6%', backgroundColor: '#ffffff', color: '#000000' }}>S.N.</th>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '49%', backgroundColor: '#ffffff', color: '#000000' }}>Description of Goods</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Qty.</th>
                            <th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Unit</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Price</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '15%', backgroundColor: '#ffffff', color: '#000000' }}>Amount(Rs.)</th>
                          </tr>
                        </thead>
                        <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          {(selectedInvoice?.invoice_items || []).map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000', verticalAlign: 'top', lineHeight: '1.4' }}>
                              <td style={{ padding: '8px 0', textAlign: 'left', backgroundColor: '#ffffff', color: '#000000' }}>{index + 1}.</td>
                              <td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', backgroundColor: '#ffffff', color: '#000000' }}>{item.product_name.toUpperCase()}</td>
                              <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{item.quantity.toFixed(2)}</td>
                              <td style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', backgroundColor: '#ffffff', color: '#000000' }}>Pcs.</td>
                              <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                                {(item.unit_price - item.discount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              </td>
                              <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                                {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total Area */}
                    <div style={{ width: '100%', marginTop: '5px', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>
                      <div style={{ borderTop: '3px solid black', paddingTop: '10px', paddingBottom: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ width: '55%', textAlign: 'right', paddingRight: '20px', fontSize: '18px', fontWeight: '900' }}>Grand Total</div>
                        
                        <div style={{ width: '10%', textAlign: 'right', borderBottom: '2px solid black', paddingBottom: '2px', fontSize: '16px' }}>
                          {(() => {
                            const totQty = (selectedInvoice?.invoice_items || []).reduce((acc, item) => acc + item.quantity, 0);
                            return totQty.toFixed(2);
                          })()}
                        </div>
                        
                        <div style={{ width: '20%' }}></div>
                        
                        <div style={{ width: '15%', textAlign: 'right', borderBottom: '4px double black', paddingBottom: '2px', fontSize: '18px', fontWeight: '900' }}>
                          {selectedInvoice.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </div>
                      </div>
                    </div>

                    {/* Amount in words */}
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', color: '#000000', backgroundColor: '#ffffff' }}>
                      <div>LKR {convertNumberToWords(selectedInvoice.total)} Only</div>
                    </div>

                    {selectedInvoice.notes && (
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px', color: '#000000', backgroundColor: '#ffffff' }}>
                        <div>Note: {selectedInvoice.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Area - Terms & Conditions | Receiver Signature */}
                  <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>
                    <div style={{ width: '50%' }}>
                      <div style={{ textDecoration: 'underline', marginBottom: '8px' }}>Terms & Conditions</div>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0, lineHeight: '1.5' }}>
                        <li>Once Goods Sold Cash Not Refund.</li>
                        <li>Acceseries Warranty will be claim with in 48 hours.</li>
                      </ul>
                    </div>
                    <div style={{ width: '50%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '15px' }}>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Receiver's Signature
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Company Signature
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {showPrintModal === 'a5' && (
                /* Corporate A5 Portrait styled layout */
                <div 
                  id="a5-invoice-display-area"
                  style={{
                    fontFamily: "'Courier New', monospace",
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    width: '148.5mm',
                    minHeight: '210mm',
                    padding: '5mm',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    {/* Top Header */}
                    <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{"<< RETAIL INVOICE >>"}</div>
                      <div style={{ fontSize: '22px', fontWeight: '900', margin: '5px 0', color: '#000000' }}>
                        {companySetting.company_name}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {invoiceBranchInfo.address}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        Tel: {invoiceBranchInfo.phone}
                      </div>
                    </div>

                    {/* Customer and Invoice Details Grid */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', lineHeight: '1.5', color: '#000000' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div>Customer Details:</div>
                        <div>{selectedInvoice.customer_name || 'Cash'}</div>
                        {selectedInvoice.customer_phone && (
                          <div>Tel: {selectedInvoice.customer_phone}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Invoice No:</span>
                          <span>{selectedInvoice.invoice_no}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Date:</span>
                          <span>
                            {(() => {
                              try {
                                const d = new Date(selectedInvoice.created_at);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}-${month}-${year}`;
                              } catch (e) {
                                return selectedInvoice.created_at.split('T')[0];
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div style={{ marginTop: '10px' }}>
                      <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>
                        <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          <tr style={{ borderTop: '2px solid black', borderBottom: '2px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '8%' }}>S.N.</th>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '47%' }}>Description</th>
                            <th style={{ padding: '8px 0', textAlign: 'center', width: '15%' }}>Qty.</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '15%' }}>Price</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '15%' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          {(selectedInvoice?.invoice_items || []).map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000', verticalAlign: 'top', lineHeight: '1.4' }}>
                              <td style={{ padding: '8px 0', textAlign: 'left', backgroundColor: '#ffffff', color: '#000000' }}>{index + 1}.</td>
                              <td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', maxWidth: '140px' }}>{item.product_name.toUpperCase()}</td>
                              <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantity.toFixed(2)}</td>
                              <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                                {(item.unit_price - item.discount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              </td>
                              <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                                {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total Area */}
                    <div style={{ width: '100%', marginTop: '5px', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>
                      <div style={{ borderTop: '3px solid black', paddingTop: '10px', paddingBottom: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ width: '55%', textAlign: 'right', paddingRight: '20px', fontSize: '18px', fontWeight: '900' }}>Grand Total</div>
                        <div style={{ width: '15%', textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '2px', fontSize: '16px' }}>
                          {(() => {
                            const totQty = (selectedInvoice?.invoice_items || []).reduce((acc, item) => acc + item.quantity, 0);
                            return totQty.toFixed(2);
                          })()}
                        </div>
                        <div style={{ width: '15%' }}></div>
                        <div style={{ width: '15%', textAlign: 'right', borderBottom: '4px double black', paddingBottom: '2px', fontSize: '18px', fontWeight: '900' }}>
                          {selectedInvoice.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </div>
                      </div>
                    </div>

                    {/* Amount in words */}
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', color: '#000000', backgroundColor: '#ffffff' }}>
                      <div>LKR {convertNumberToWords(selectedInvoice.total)} Only</div>
                    </div>

                    {selectedInvoice.notes && (
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px', color: '#000000', backgroundColor: '#ffffff' }}>
                        <div>Note: {selectedInvoice.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Area - Terms & Conditions | Receiver Signature */}
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#000000', paddingTop: '30px' }}>
                    <div style={{ width: '50%' }}>
                      <div style={{ textDecoration: 'underline', marginBottom: '8px' }}>Terms & Conditions</div>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0, lineHeight: '1.5' }}>
                        <li>Once Goods Sold Cash Not Refund.</li>
                        <li>Warranty claim within 48 hours.</li>
                      </ul>
                    </div>
                    <div style={{ width: '50%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '15px' }}>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Receiver's Sign
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Company Sign
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                    </div>

            {/* TRIGGER CONTROLS: PRINT, WHATSAPP, DOWNLOAD PDF, EMAIL */}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-3">
              <button
                onClick={() => {
                  let targetId = 'a4-invoice-display-area';
                  if (showPrintModal === 'thermal') targetId = 'thermal-receipt-display-area';
                  else if (showPrintModal === 'a4-half') targetId = 'a4-half-invoice-display-area';
                  else if (showPrintModal === 'a5') targetId = 'a5-invoice-display-area';
                  handlePrint(targetId, showPrintModal, printOrientation);
                }}
                className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md animate-pulse"
                title="Send directly to system physical printer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Now
              </button>

              <button
                onClick={() => {
                  if (selectedInvoice) {
                    prepareWhatsAppBill(selectedInvoice);
                  }
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm"
                title="Send bill directly via WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Bill
              </button>

              <button
                onClick={() => {
                  alert('Generating PDF payload wrapper... Document auto-saved into device disk (Mock Download Complete)');
                }}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
              <button
                onClick={() => {
                  const cust = customers.find(c => c.id === selectedInvoice.customer_id);
                  setRecipientEmail(cust?.email || 'customer@gmail.com');
                  setShowEmailDialog(true);
                }}
                className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-705 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              >
                <Mail className="w-3.5 h-3.5" />
                Email Client
              </button>

              {/* Admin Quick Delete Trigger inside preview */}
              {isUserAdmin(user) && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedInvoice) {
                      handleStartDeleteInvoice(selectedInvoice);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Delete or Void this sales invoice (Admin Only)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP DIALOG */}
      {showWhatsAppDialog && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 border border-zinc-150 my-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-black text-zinc-900">Send Invoice via WhatsApp App</h5>
                  <p className="text-[10px] text-zinc-500">Send original bill image or text directly to customer WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWhatsAppDialog(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Notice Banner */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-950">
              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="font-bold block">Original Bill Image Ready:</strong>
                Clicking <strong>Send Original Bill Image</strong> below converts the exact active bill format into a high-res PNG image and launches your device's installed WhatsApp application!
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase block mb-1">
                  WhatsApp Mobile Number:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0771234567 or 94771234567"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase block mb-1">
                  Message Summary Text:
                </label>
                <textarea
                  rows={6}
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[11px] font-mono leading-relaxed text-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-100 pt-3">
              {/* PRIMARY ACTION: SEND ORIGINAL BILL IMAGE */}
              <button
                disabled={isGeneratingImage}
                onClick={sendWhatsAppImage}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                {isGeneratingImage ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Rendering Bill Image & Launching WhatsApp...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    <span>Send Original Bill Image via Installed WhatsApp</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={sendWhatsAppMessage}
                  className="flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold py-2 px-3 rounded-xl text-[11px] transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Text Only Summary
                </button>

                <button
                  type="button"
                  onClick={downloadBillImage}
                  className="flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold py-2 px-3 rounded-xl text-[11px] transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  Save Image (PNG)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL DIALOG */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h5 className="text-sm font-bold text-zinc-900">Transmit Bill Invoice Email</h5>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">To Mailbox:</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEmailDialog(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-500 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  alert(`Invoice email queued successfully into branch CRM relay. Sent to address: ${recipientEmail}`);
                  setShowEmailDialog(false);
                }}
                className="bg-indigo-600 text-white px-3.5 py-1.5 hover:bg-indigo-705 rounded-xl text-xs font-bold transition-all"
              >
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CRM REGISTRY MODAL */}
      {showCustomerCRMModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-4xl w-full space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">Customer CRM Registry ({customers.length})</h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportCustomers}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  title="Export Customers to CSV"
                >
                  <FileDown className="w-4 h-4 text-cyan-400" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCustomerCRMModal(false); setShowImportCustomerModal(true); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <FileUp className="w-4 h-4" />
                  Import Excel
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCustomerCRMModal(false); setShowAddCustomerModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Customer
                </button>
                <button 
                  onClick={() => setShowCustomerCRMModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search customers by name, phone, email, or company..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>

            {filteredCustomers.length > 0 ? (
              <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/60 p-2">
                <table className="w-full text-xs">
                  <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                    <tr className="border-b border-slate-800 text-slate-400 text-left font-bold text-[10px] uppercase">
                      <th className="p-2.5">Customer Name</th>
                      <th className="p-2.5">Mobile Phone</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Company</th>
                      <th className="p-2.5 text-center">Loyalty Points</th>
                      <th className="p-2.5 text-right">Credit Balance</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 font-bold text-white">{c.name}</td>
                        <td className="p-2.5 font-mono text-slate-300">{c.phone}</td>
                        <td className="p-2.5 font-mono text-cyan-400">{c.email || 'N/A'}</td>
                        <td className="p-2.5 text-slate-400">{c.company_name || '-'}</td>
                        <td className="p-2.5 text-center font-bold text-amber-400">{c.loyalty_points || 0} pts</td>
                        <td className="p-2.5 text-right font-black text-emerald-400">Rs. {(c.credit_balance || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-center flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setShowCustomerCRMModal(false);
                            }}
                            className="bg-indigo-600/80 hover:bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            Select for Sale
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCustomer(c)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/50"
                            title="Edit Customer Profile"
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
                <Users className="w-10 h-10 text-slate-600" />
                <div>
                  <p className="font-bold text-slate-200 text-sm">No Customer Profiles Found</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm">
                    Import your customer database from an Excel or CSV file or register a new customer profile.
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setShowCustomerCRMModal(false); setShowImportCustomerModal(true); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <FileUp className="w-4 h-4" /> Import from Excel
                  </button>
                  <button
                    onClick={() => { setShowCustomerCRMModal(false); setShowAddCustomerModal(true); }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <UserPlus className="w-4 h-4" /> Add Customer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXCEL / CSV CUSTOMER IMPORT MODAL */}
      {showImportCustomerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-2xl w-full space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-extrabold text-white">Import Customers from Excel / CSV</h4>
              </div>
              <button 
                onClick={() => { setShowImportCustomerModal(false); setParsedCustomers([]); setCustomerImportFilename(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: File selection & template download */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <p className="font-bold text-white">Need a customer spreadsheet format?</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Download our pre-formatted Excel CSV customer template.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCustomerTemplate}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <div 
                onClick={() => customerFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/60 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
              >
                <input 
                  type="file"
                  ref={customerFileInputRef}
                  onChange={handleCustomerFileSelect}
                  accept=".csv, .xlsx, .xls, .pdf, .txt"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto transition-colors" />
                <div>
                  <p className="text-xs font-bold text-white">Click to Upload Customer File (PDF, Excel, CSV)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF documents, .CSV and Excel spreadsheets</p>
                </div>
                {customerImportFilename && (
                  <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[11px] font-mono px-3 py-1 rounded-full border border-emerald-500/30 font-bold">
                    File selected: {customerImportFilename}
                  </span>
                )}
              </div>
            </div>

            {/* Parsed Preview Table */}
            {parsedCustomers.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Validated {parsedCustomers.length} customer records
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">Ready for database import</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/80 p-2">
                  <table className="w-full text-xs">
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr className="border-b border-slate-800 text-slate-400 text-left font-bold text-[10px] uppercase">
                        <th className="p-2">Name</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Email</th>
                        <th className="p-2 text-right">Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedCustomers.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-2 font-bold text-white">{c.name}</td>
                          <td className="p-2 font-mono text-slate-300">{c.phone}</td>
                          <td className="p-2 font-mono text-cyan-400">{c.email || '-'}</td>
                          <td className="p-2 text-right font-black text-emerald-400">Rs. {(c.credit_balance || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImportCustomers}
                  className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg text-xs uppercase tracking-wider cursor-pointer"
                >
                  Confirm & Import {parsedCustomers.length} Customers into Database
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE SINGLE CUSTOMER FORM DIALOG */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-extrabold text-white flex justify-between items-center border-b border-slate-800 pb-3">
              <span>Register New Customer Profile</span>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white text-xs p-1">
                <X className="w-4 h-4" />
              </button>
            </h4>

            <form onSubmit={handleCreateSingleCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Customer Full Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Kumar Sangakkara"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Mobile Phone:</label>
                  <input
                    type="text"
                    placeholder="+94 77 123 4567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Company / Firm:</label>
                  <input
                    type="text"
                    placeholder="e.g. Sanga Legends"
                    value={custCompany}
                    onChange={(e) => setCustCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  placeholder="kumar@customer.lk"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Initial Outstanding Credit (LKR):</label>
                <input
                  type="number"
                  placeholder="0"
                  value={custCredit || ''}
                  onChange={(e) => setCustCredit(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Notes / Special Instructions:</label>
                <textarea
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  placeholder="e.g. VIP client, requests duplicate invoice..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Register & Select Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUPERVISOR OVERRIDE GATED REFUND VERIFICATION */}
      <SupervisorAuthModal
        isOpen={!!authRefundInvoice}
        onClose={() => setAuthRefundInvoice(null)}
        onSuccess={handleAuthRefundSuccess}
        actionLabel={authRefundInvoice ? `refund POS invoice #${authRefundInvoice.invoice_no} (Rs. ${authRefundInvoice.total.toLocaleString()})` : ''}
      />

      {/* EDIT CUSTOMER PROFILE MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-extrabold text-white">Modify Customer Profile</h4>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Full Name / Customer Name:</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Mobile Phone:</label>
                  <input
                    type="text"
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Company / Organization:</label>
                  <input
                    type="text"
                    value={editingCustomer.company_name || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, company_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Credit Balance (LKR):</label>
                  <input
                    type="number"
                    value={editingCustomer.credit_balance || 0}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, credit_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Loyalty Points:</label>
                  <input
                    type="number"
                    value={editingCustomer.loyalty_points || 0}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, loyalty_points: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold text-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Customer Notes / CRM History:</label>
                <textarea
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Save Customer Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN INVOICE EDIT MODAL */}
      {adminEditingInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-white">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-extrabold flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-400" />
                  <span>Modify POS Invoice - {adminEditingInvoice.invoice_no}</span>
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1">Branch: {adminEditingInvoice.branch_name}</p>
              </div>
              <button 
                onClick={() => setAdminEditingInvoice(null)} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminEditError && (
              <div className="bg-red-900/40 border border-red-500 text-red-200 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{adminEditError}</span>
              </div>
            )}

            {adminEditSuccess && (
              <div className="bg-emerald-900/40 border border-emerald-500 text-emerald-200 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{adminEditSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer and billing fields */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <h5 className="font-bold text-indigo-400 text-[11px] uppercase tracking-wider">Client & Bill Details</h5>
                
                <div>
                  <label className="text-zinc-400 block font-semibold mb-1">Customer Name:</label>
                  <input
                    type="text"
                    value={adminEditCustName}
                    onChange={(e) => setAdminEditCustName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block font-semibold mb-1">Customer Phone:</label>
                  <input
                    type="text"
                    value={adminEditCustPhone}
                    onChange={(e) => setAdminEditCustPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 block font-semibold mb-1">Payment Method:</label>
                    <select
                      value={adminEditPaymentMethod}
                      onChange={(e) => setAdminEditPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 uppercase font-bold"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="split">Split Payment</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 block font-semibold mb-1">Paid Amount (LKR):</label>
                    <input
                      type="number"
                      value={adminEditPaidAmount || 0}
                      onChange={(e) => setAdminEditPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block font-semibold mb-1">Showroom Promo Discount (LKR):</label>
                  <input
                    type="number"
                    value={adminEditOverallDiscount || 0}
                    onChange={(e) => setAdminEditOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold text-red-400 font-mono"
                  />
                </div>
              </div>

              {/* Add products subsection */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-cyan-400 text-[11px] uppercase tracking-wider mb-2">Add New Product to Bill</h5>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search product by name, SKU or barcode..."
                      value={adminEditSearch}
                      onChange={(e) => setAdminEditSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 pl-9 pr-4 py-2.5 rounded-xl text-white text-xs outline-none focus:border-cyan-500"
                    />
                  </div>

                  {adminEditSearch.trim() !== '' && (
                    <div className="mt-2 bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 max-h-48 overflow-y-auto">
                      {allProducts.filter(p => 
                        p.name.toLowerCase().includes(adminEditSearch.toLowerCase()) || 
                        p.sku.toLowerCase().includes(adminEditSearch.toLowerCase()) || 
                        (p.barcode && p.barcode.toLowerCase().includes(adminEditSearch.toLowerCase()))
                      ).slice(0, 5).map(prod => {
                        const stock = productStocks.find(ps => ps.product_id === prod.id && ps.branch_id === adminEditingInvoice.branch_id);
                        const qty = stock ? stock.quantity : 0;
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => {
                              handleAddProductToAdminEdit(prod);
                              setAdminEditSearch('');
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex justify-between items-center transition-colors"
                          >
                            <div>
                              <p className="font-bold text-white">{prod.name}</p>
                              <p className="text-[10px] text-zinc-400">SKU: {prod.sku} | Price: Rs. {prod.selling_price.toLocaleString()}</p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${qty > 0 ? 'bg-indigo-950 text-indigo-300' : 'bg-red-950 text-red-400'}`}>
                              Stock: {qty}
                            </span>
                          </button>
                        );
                      })}
                      {allProducts.filter(p => 
                        p.name.toLowerCase().includes(adminEditSearch.toLowerCase()) || 
                        p.sku.toLowerCase().includes(adminEditSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-3 text-center text-zinc-500 text-xs">No matching products found.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Items Subtotal:</span>
                    <span className="font-mono text-white font-bold">Rs. {adminEditCalculated.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Overall Discount:</span>
                    <span className="font-mono text-red-400 font-bold">-Rs. {adminEditOverallDiscount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>VAT Goods Tax:</span>
                    <span className="font-mono text-white font-bold">Rs. {adminEditCalculated.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-dashed border-slate-800 font-extrabold text-white">
                    <span className="text-cyan-400">Nett Total Amount:</span>
                    <span className="font-mono text-indigo-400 text-base">Rs. {adminEditCalculated.total.toLocaleString()} LKR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill Items list table */}
            <div className="space-y-2">
              <h5 className="font-bold text-zinc-300 text-xs uppercase tracking-wider">Invoice Items List</h5>
              <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                    <tr className="bg-slate-900 text-zinc-400 font-bold uppercase text-[9px] border-b border-slate-800">
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Unit Price</th>
                      <th className="p-3 text-center">Item Discount</th>
                      <th className="p-3 text-center">Quantity</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-zinc-300">
                    {adminEditItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-3">
                          <p className="font-bold text-white">{item.product_name}</p>
                          <p className="text-[9px] text-zinc-400 font-mono">{item.sku}</p>
                        </td>
                        <td className="p-3 text-center font-mono">
                          Rs. {item.unit_price.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            value={item.discount || ''}
                            onChange={(e) => {
                              const disc = Math.max(0, parseFloat(e.target.value) || 0);
                              setAdminEditItems(adminEditItems.map((itm, i) => 
                                i === idx ? { ...itm, discount: disc } : itm
                              ));
                            }}
                            className="w-20 bg-slate-900 border border-slate-800 p-1.5 rounded-lg text-center text-red-400 text-xs font-bold outline-none"
                            placeholder="Rs. LKR"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setAdminEditItems(adminEditItems.map((itm, i) => 
                                    i === idx ? { ...itm, quantity: itm.quantity - 1 } : itm
                                  ));
                                }
                              }}
                              className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const qty = Math.max(1, parseFloat(e.target.value) || 1);
                                setAdminEditItems(adminEditItems.map((itm, i) => 
                                  i === idx ? { ...itm, quantity: qty } : itm
                                ));
                              }}
                              className="w-12 bg-slate-900 border border-slate-800 p-1 rounded-lg text-center font-bold text-xs text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setAdminEditItems(adminEditItems.map((itm, i) => 
                                  i === idx ? { ...itm, quantity: itm.quantity + 1 } : itm
                                ));
                              }}
                              className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-white font-mono">
                          Rs. {((item.unit_price - item.discount) * item.quantity).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAdminEditItems(adminEditItems.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 text-xs">
              <button
                type="button"
                onClick={() => setAdminEditingInvoice(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdminEdit}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold rounded-xl transition-all shadow-lg uppercase tracking-wider cursor-pointer"
              >
                Save Modifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN SALES RETURN MODAL */}
      {adminReturningInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-white">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-extrabold flex items-center gap-2 text-orange-400">
                  <CornerUpLeft className="w-4 h-4" />
                  <span>Admin Sales Return & Inventory Replenish</span>
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Invoice No: <span className="font-mono font-bold text-white">{adminReturningInvoice.invoice_no}</span> | Branch: {adminReturningInvoice.branch_name}
                </p>
              </div>
              <button 
                onClick={() => setAdminReturningInvoice(null)} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error/Success Feedbacks */}
            {adminReturnError && (
              <div className="p-3 bg-red-950/50 border border-red-850 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{adminReturnError}</span>
              </div>
            )}
            {adminReturnSuccess && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-850 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{adminReturnSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column: Return Reason and Refund Override */}
              <div className="md:col-span-1 space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <h5 className="font-extrabold text-xs text-orange-400 uppercase tracking-wider">Return Configuration</h5>
                
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Reason for Return</label>
                  <textarea
                    value={adminReturnReason}
                    onChange={(e) => setAdminReturnReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 p-2 rounded-xl text-xs text-white outline-none focus:border-orange-500 h-20 resize-none"
                    placeholder="e.g., Damaged item, customer change of mind, incorrect sizing..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Override Refund Amount (LKR)</label>
                  <input
                    type="number"
                    value={adminReturnRefundOverride !== null ? adminReturnRefundOverride : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0);
                      setAdminReturnRefundOverride(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-850 p-2.5 rounded-xl text-xs text-orange-400 font-bold outline-none focus:border-orange-500"
                    placeholder={`Leave blank to use calc (Rs. ${adminReturnCalculated.refundAmount.toLocaleString()})`}
                  />
                  <p className="text-[9px] text-zinc-500 font-normal leading-normal">
                    If blank, the system automatically uses the proportional value: <span className="font-bold">Rs. {adminReturnCalculated.refundAmount.toLocaleString()} LKR</span>.
                  </p>
                </div>

                <div className="border-t border-slate-850 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Invoice Original:</span>
                    <span className="font-mono text-white font-bold">Rs. {adminReturningInvoice.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Already Refunded:</span>
                    <span className="font-mono text-red-400 font-bold">Rs. {(adminReturningInvoice.refunded_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-dashed border-slate-850 font-extrabold text-white">
                    <span className="text-orange-400">Final Refund:</span>
                    <span className="font-mono text-orange-400 text-base">
                      Rs. {(adminReturnRefundOverride !== null ? adminReturnRefundOverride : adminReturnCalculated.refundAmount).toLocaleString()} LKR
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Items return qty selector */}
              <div className="md:col-span-2 space-y-2">
                <h5 className="font-extrabold text-xs text-zinc-300 uppercase tracking-wider">Select Quantities to Return</h5>
                <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr className="bg-slate-900 text-zinc-400 font-bold uppercase text-[9px] border-b border-slate-800">
                        <th className="p-3">Product Name</th>
                        <th className="p-3 text-center">Price (Nett)</th>
                        <th className="p-3 text-center">Purchased</th>
                        <th className="p-3 text-center">Return Qty</th>
                        <th className="p-3 text-right">Refund Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-zinc-300">
                      {adminReturnItems.map((item, idx) => {
                        const nettPrice = item.unit_price - item.discount;
                        const subtotalRefund = nettPrice * item.return_qty;
                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-3">
                              <p className="font-bold text-white">{item.product_name}</p>
                              <p className="text-[9px] text-zinc-400 font-mono">{item.sku}</p>
                            </td>
                            <td className="p-3 text-center font-mono">
                              Rs. {nettPrice.toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-bold text-zinc-400">
                              {item.purchased_qty}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminReturnItems(adminReturnItems.map((itm, i) => 
                                      i === idx ? { ...itm, return_qty: Math.max(0, itm.return_qty - 1) } : itm
                                    ));
                                  }}
                                  className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.purchased_qty}
                                  value={item.return_qty}
                                  onChange={(e) => {
                                    const val = Math.min(item.purchased_qty, Math.max(0, parseInt(e.target.value) || 0));
                                    setAdminReturnItems(adminReturnItems.map((itm, i) => 
                                      i === idx ? { ...itm, return_qty: val } : itm
                                    ));
                                  }}
                                  className="w-12 bg-slate-900 border border-slate-800 p-1 rounded-lg text-center font-bold text-xs text-white outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminReturnItems(adminReturnItems.map((itm, i) => 
                                      i === idx ? { ...itm, return_qty: Math.min(itm.purchased_qty, itm.return_qty + 1) } : itm
                                    ));
                                  }}
                                  className="p-1 bg-slate-900 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold text-orange-400 font-mono">
                              Rs. {subtotalRefund.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 text-xs">
              <button
                type="button"
                onClick={() => setAdminReturningInvoice(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSalesReturn}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold rounded-xl transition-all shadow-lg uppercase tracking-wider cursor-pointer"
              >
                Confirm Sales Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALES QUOTATION PRINT MODAL LAYER */}
      {showQuotationPrintModal && selectedQuotation && (
        <QuotationPrintModal
          quotation={selectedQuotation}
          companySetting={companySetting}
          branchInfo={{
            address: activeBranch?.location || companySetting?.address || '123 Tech Avenue, Colombo 03',
            phone: activeBranch?.phone || companySetting?.phone || '+94 11 234 5678',
          }}
          onClose={() => setShowQuotationPrintModal(false)}
          onPrint={(elementId, format, orientation) => handlePrint(elementId, format, orientation as 'portrait' | 'landscape')}
          onShareWhatsApp={(q) => prepareWhatsAppQuotation(q)}
        />
      )}

      {/* SAVE / CONFIGURE SALES QUOTATION MODAL */}
      {showSaveQuotationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-extrabold text-zinc-900">
                  Generate Formal Sales Quotation
                </h3>
              </div>
              <button
                onClick={() => setShowSaveQuotationModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Summary card */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between font-semibold text-amber-900">
                  <span>Customer:</span>
                  <span>
                    {customers.find(c => c.id === selectedCustomerId)?.name || guestName || 'Walk-in / Valued Client'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Branch:</span>
                  <span>{activeBranch?.name}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Basket Items:</span>
                  <span>{cart.length} item(s)</span>
                </div>
                <div className="border-t border-amber-200/60 pt-2 flex justify-between font-extrabold text-zinc-900 text-sm">
                  <span>Quoted Net Total:</span>
                  <span className="text-amber-700">Rs. {totalAmount.toLocaleString()} LKR</span>
                </div>
              </div>

              {/* Quotation Validity */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 block">
                  Quotation Validity Duration:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 60].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setQuotationValidityDays(days)}
                      className={`py-2 text-center rounded-xl font-bold border transition-all cursor-pointer ${
                        quotationValidityDays === days
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Quotation Notes / Scope */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 block">
                  Custom Quotation Remarks / Project Scope:
                </label>
                <textarea
                  value={quotationNotesInput}
                  onChange={(e) => setQuotationNotesInput(e.target.value)}
                  placeholder="e.g. Special enterprise bulk pricing quotation, valid for PO issuance..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 h-20 resize-none"
                  maxLength={500}
                />
              </div>

              <div className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl">
                ℹ️ Generating a quotation <strong>does not deduct physical showroom inventory</strong>. It reserves quotation pricing and specs for the client.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowSaveQuotationModal(false)}
                className="px-4 py-2.5 rounded-xl text-zinc-600 hover:bg-zinc-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateQuotation}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Issue & Print Quotation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP TRANSMISSION MODAL FOR QUOTATIONS */}
      {showWhatsAppQuotationDialog && selectedQuotation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900">Transmit Quote via WhatsApp</h3>
                  <p className="text-[10px] text-zinc-500">Quotation #{selectedQuotation.quotation_no}</p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppQuotationDialog(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700">Client WhatsApp Phone Number:</label>
                <input
                  type="text"
                  value={whatsappQuotationPhone}
                  onChange={(e) => setWhatsappQuotationPhone(e.target.value)}
                  placeholder="e.g. 0771234567 or +94771234567"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700">Message Preview:</label>
                <textarea
                  value={whatsappQuotationMessage}
                  onChange={(e) => setWhatsappQuotationMessage(e.target.value)}
                  rows={8}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[11px] font-mono text-zinc-800 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowWhatsAppQuotationDialog(false)}
                className="px-4 py-2 rounded-xl text-zinc-600 hover:bg-zinc-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendWhatsAppQuotationMessage}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send to WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN-ONLY SALES INVOICE DELETE / VOID CONFIRMATION MODAL */}
      {showDeleteInvoiceModal && invoiceToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 border border-rose-100 my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h5 className="text-base font-black text-zinc-900">Delete Sales Invoice?</h5>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Admin Authorization Required
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (!isDeletingInvoice) {
                    setShowDeleteInvoiceModal(false);
                    setInvoiceToDelete(null);
                    setDeleteInvoiceReason('');
                    setDeleteInvoiceError(null);
                  }
                }}
                disabled={isDeletingInvoice}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-bold p-1 rounded-lg disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {/* Warning & Mode Selector */}
            <div className="space-y-2">
              <div className="flex bg-zinc-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDeleteInvoiceMode('void')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    deleteInvoiceMode === 'void'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Void & Reverse Sale (Restores Stock)
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteInvoiceMode('permanent')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    deleteInvoiceMode === 'permanent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Permanently Delete (Purge Record)
                </button>
              </div>

              <div className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 border ${
                deleteInvoiceMode === 'permanent' 
                  ? 'bg-rose-50 border-rose-200 text-rose-950' 
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                  deleteInvoiceMode === 'permanent' ? 'text-rose-600' : 'text-amber-600'
                }`} />
                <div className="leading-relaxed">
                  {deleteInvoiceMode === 'permanent' ? (
                    <span><strong>Permanent Purge:</strong> This will completely remove Invoice <strong>#{invoiceToDelete.invoice_no}</strong> from the database. Sold quantities will be restored back to branch stock automatically.</span>
                  ) : (
                    <span><strong>Void & Reverse:</strong> This marks Invoice <strong>#{invoiceToDelete.invoice_no}</strong> as void, reverses the revenue from dashboards, and restores all items back to stock inventory.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Details Card */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Invoice Number:</span>
                <span className="font-mono font-extrabold text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                  {invoiceToDelete.invoice_no}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Customer Name:</span>
                <span className="font-bold text-zinc-900">
                  {invoiceToDelete.customer_name || 'Cash Customer'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-medium">Total Amount:</span>
                <span className="font-extrabold text-rose-600 text-sm">
                  Rs. {invoiceToDelete.total.toLocaleString()} LKR
                </span>
              </div>

              {invoiceToDelete.invoice_items && invoiceToDelete.invoice_items.length > 0 && (
                <div className="pt-2 border-t border-zinc-200">
                  <span className="text-[11px] font-bold text-zinc-700 block mb-1">
                    Stock Restoration Breakdown:
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {invoiceToDelete.invoice_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] text-zinc-600 bg-white px-2 py-1 rounded border border-zinc-150">
                        <span className="font-medium truncate max-w-[200px]">{item.product_name}</span>
                        <span className="font-bold text-emerald-700">+{item.quantity} restored</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reason Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Deletion / Void Reason:</span>
                <span className="text-[10px] text-zinc-400 font-normal">Audit Log</span>
              </label>

              {/* Quick Select Reason Tags */}
              <div className="flex flex-wrap gap-1">
                {[
                  'Customer order cancelled',
                  'Incorrect billing / item error',
                  'Duplicate invoice entered',
                  'Payment cancelled'
                ].map((quickReason) => (
                  <button
                    key={quickReason}
                    type="button"
                    onClick={() => setDeleteInvoiceReason(quickReason)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all ${
                      deleteInvoiceReason === quickReason
                        ? 'bg-rose-600 text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {quickReason}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={deleteInvoiceReason}
                onChange={(e) => setDeleteInvoiceReason(e.target.value)}
                placeholder="Enter reason for deleting this invoice..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none font-medium"
              />
            </div>

            {deleteInvoiceError && (
              <div className="p-2.5 bg-rose-100 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteInvoiceError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={isDeletingInvoice}
                onClick={() => {
                  setShowDeleteInvoiceModal(false);
                  setInvoiceToDelete(null);
                  setDeleteInvoiceReason('');
                  setDeleteInvoiceError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingInvoice}
                onClick={handleConfirmDeleteInvoice}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isDeletingInvoice ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing & Restoring Stock...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteInvoiceMode === 'permanent' ? 'Permanently Delete' : 'Confirm & Void Invoice'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
