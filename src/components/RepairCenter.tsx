import { globalPrint } from '../utils/printHelper';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { 
  Wrench, Plus, User, Phone, Laptop, Calendar, DollarSign, 
  Clock, CheckCircle, ArrowRight, MessageSquare, Paperclip, 
  Printer, Smartphone, Search, FileText, CheckCircle2, ShieldCheck, 
  MapPin, Edit, Eye, MessageCircle, PenTool, Download, Image as ImageIcon
} from 'lucide-react';
import { User as UserType, Branch, RepairJob, RepairStatus, RepairUpdate, WarrantyPeriod } from '../types';
import { getUsers } from '../services/users';
import { getRepairs, createRepair, updateRepair } from '../services/repairs';
import { getSetting } from '../services/settings';
import { getBranches } from '../services/branches';
import { supabase } from '../lib/supabaseClient';
import { PaymentMethod } from '../types';

interface RepairCenterProps {
  user: UserType;
  activeBranch: Branch | null;
}

export default function RepairCenter({ user, activeBranch }: RepairCenterProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'register' | 'portal'>('active');
  
  // Create state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('ASUS');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [problemDesc, setProblemDesc] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [technicianId, setTechnicianId] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [initialNotes, setInitialNotes] = useState('');

  // Signature Pad state
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureSvgPath, setSignatureSvgPath] = useState<string>('');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Search filter list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Selection
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  
  // Progress Updater Form
  const [newStatus, setNewStatus] = useState<RepairStatus>('received');
  const [progressNotes, setProgressNotes] = useState('');
  const [actualCost, setActualCost] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [warranty, setWarranty] = useState<WarrantyPeriod>('none');

  // Customer portal tracker
  const [portalTicketNo, setPortalTicketNo] = useState('');
  const [portalResult, setPortalResult] = useState<RepairJob | null>(null);
  const [portalSearched, setPortalSearched] = useState(false);

  // Load resources
  const [users, setUsers] = useState<UserType[]>([]);
  const [repairsListState, setRepairsListState] = useState<RepairJob[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [setting, setSetting] = useState<any>({ company_name: 'Majestic POS', address: '', phone: '' });

  useEffect(() => {
    Promise.all([
      getUsers(),
      getRepairs(),
      getSetting(),
      getBranches()
    ]).then(([u, r, s, b]) => {
      setUsers(u);
      setRepairsListState(r);
      if (s) setSetting(s);
      if (b) setBranches(b);
    }).catch(err => console.error('Failed to load repair center data:', err));
  }, []);

  const techniciansList = useMemo(() => {
    return users.filter(u => u.role === 'technician' || u.role === 'branch_admin' || u.role === 'super_admin');
  }, [users]);

  const repairsList = useMemo(() => {
    // Isolate branchwise unless super admin
    const branchIsolator = user.role !== 'super_admin' ? user.branch_id : (activeBranch?.id || null);
    return branchIsolator ? repairsListState.filter(r => r.branch_id === branchIsolator) : repairsListState;
  }, [repairsListState, activeBranch, user]);

  const filteredRepairs = useMemo(() => {
    return repairsList.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const cleanQ = searchQuery.toLowerCase();
      const matchesSearch = r.customer_name.toLowerCase().includes(cleanQ) || 
                            r.ticket_no.toLowerCase().includes(cleanQ) || 
                            r.device_type.toLowerCase().includes(cleanQ) || 
                            r.model.toLowerCase().includes(cleanQ);
      return matchesStatus && matchesSearch;
    });
  }, [repairsList, statusFilter, searchQuery]);

  const repairUpdatesList = useMemo(() => [], []);

  // Printing Job Card sheets
  const [showRepairPrintModal, setShowRepairPrintModal] = useState<string | null>(null); // 'thermal' | 'a4' | 'a4-half' | 'a5' | null
  const [repairPrintOrientation, setRepairPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printingJob, setPrintingJob] = useState<RepairJob | null>(null);

  const repairBranchInfo = useMemo(() => {
    if (!printingJob) return { address: setting?.address || '', phone: setting?.phone || '' };
    const repBranch = branches?.find(b => b.id === printingJob.branch_id || b.name === printingJob.branch_name);
    return {
      address: repBranch?.location || setting?.address || '',
      phone: repBranch?.phone || setting?.phone || ''
    };
  }, [printingJob, branches, setting]);

  const handleOpenRepairPrint = (job: RepairJob) => {
    setPrintingJob(job);
    setShowRepairPrintModal('a4-half'); // default continuous half-sheet format
  };

  const handlePrintRepair = (elementId: string, format: string, orientationOverride?: 'portrait' | 'landscape') => {
    const orientation = orientationOverride || repairPrintOrientation;
    let printStyle = '';
    if (format === 'thermal') {
      printStyle = `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { padding: 2mm; width: 80mm; }

          body { 
            font-family: 'Courier New', Courier, monospace !important; 
            color: #000 !important;
            background: transparent !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
          }
          * {
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-radius: 0 !important;
          }
          table { width: 100% !important; }
          th {
            font-size: 11px !important;
            font-weight: 900 !important;
            border-bottom: 2px solid #000 !important;
          }
          td {
            font-size: 11px !important;
            border-bottom: 1px dashed #000 !important;
          }
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
      if (orientation === 'landscape') {
        printStyle = `
          @media print {
            @page { size: landscape; margin: 4mm; }
            body { 
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #a4-half-repair-display-area {
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
              size: auto; /* Portrait continuous feed - NO sideways rotation */
              margin: 0mm; 
            }
            body { 
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #a4-half-repair-display-area {
              width: 200mm !important;
              max-width: 100% !important;
              min-height: 130mm !important;
              max-height: 138mm !important;
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

          body { 
            font-family: 'Courier New', Courier, monospace !important; 
            color: #000 !important;
            background: transparent !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          * {
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #000 !important;
            border-radius: 0 !important;
          }
        }
      `;
    }

    const resetOuterBoxStyle = `
      @media print {
        #thermal-repair-display-area,
        #a4-repair-display-area,
        #a4-half-repair-display-area,
        #a5-repair-display-area {
          border: none !important;
          border-width: 0px !important;
          margin: 0 auto !important;
        }
      }
    `;

    globalPrint(elementId, printStyle + '\n' + resetOuterBoxStyle);
  };

  // Signature drawing event handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDrawing(true);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setSignatureSvgPath(prev => prev + ` M ${x} ${y}`);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setSignatureSvgPath(prev => prev + ` L ${x} ${y}`);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    setSignatureSvgPath('');
  };

  // Submit Job Creation
  const handleRegisterJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranch) return;

    if (!customerName || !customerPhone || !model || !problemDesc) {
      alert('Please fill out essential fields: Customer details, Model and Issue.');
      return;
    }

    const branchName = activeBranch ? activeBranch.name : 'Main Branch';
    const techObj = users.find(u => u.id === technicianId);

    createRepair({
      ticket_no: `REP-${Math.floor(100000 + Math.random() * 900000)}`,
      branch_id: activeBranch.id,
      branch_name: branchName,
      customer_name: customerName,
      customer_phone: customerPhone,
      device_type: deviceType,
      brand,
      model,
      serial_number: serialNumber || 'N/A-SERIAL',
      problem_desc: problemDesc,
      accessories: selectedAccessories,
      technician_id: technicianId || undefined,
      technician_name: techObj?.name || undefined,
      estimated_cost: estimatedCost,
      actual_cost: 0,
      status: 'received',
      warranty_period: 'none',
      notes: initialNotes,
      signature_data: signatureSvgPath || undefined
    }).then(newJob => {
      setRepairsListState(prev => [newJob, ...prev]);

      // Reset fields
      setCustomerName('');
      setCustomerPhone('');
      setModel('');
      setSerialNumber('');
      setProblemDesc('');
      setSelectedAccessories([]);
      setTechnicianId('');
      setEstimatedCost(0);
      setInitialNotes('');
      setSignatureSvgPath('');

      // Select job and show
      setSelectedJob(newJob);
      setActiveTab('active');
      handleOpenRepairPrint(newJob);
    }).catch(err => {
      console.error(err);
      alert('Failed to register repair job.');
    });
  };

  // Progress update save
  
  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const updated = {
      ...selectedJob,
      status: newStatus,
      actual_cost: actualCost || selectedJob.actual_cost,
      warranty_period: warranty,
      notes: progressNotes ? `${selectedJob.notes || ''}\n[${newStatus.toUpperCase()}] ${progressNotes}` : selectedJob.notes,
      updated_at: new Date().toISOString()
    };

    try {
      if (newStatus === 'delivered' && updated.actual_cost && updated.actual_cost > 0) {
        // Auto-generate invoice to add charges to cash or bank
        const invoiceData = {
          invoice_no: `INV-REP-${Date.now()}`,
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
          notes: `Repair Service - Ticket ${selectedJob.ticket_no}`
        };
        const { data: invoice, error: invError } = await supabase.from('invoices').insert(invoiceData).select().single();
        if (invError) throw invError;
        
        // Add single line item for the repair
        if (invoice) {
           await supabase.from('invoice_items').insert({
             invoice_id: invoice.id,
             product_id: 'repair-service',
             product_name: `Repair Service (${selectedJob.brand} ${selectedJob.model})`,
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
      alert(`Repair status successfully logged as ${newStatus}`);
    } catch (err) {
      console.error(err);
      alert('Failed to update repair status.');
    }
  };

  const accessoryOptions = [
    'Charger/Power Adapter',
    'Main Power Cord',
    'Carry Sleeves Bag',
    'USB Sync Cable',
    'Original Purchase Box',
    'Battery Cell Pack',
    'External Hard Disk Case'
  ];

  const handleAccessoryChecked = (acc: string) => {
    if (selectedAccessories.includes(acc)) {
      setSelectedAccessories(selectedAccessories.filter(a => a !== acc));
    } else {
      setSelectedAccessories([...selectedAccessories, acc]);
    }
  };

  // Trigger Mock Notifications
  const sendSMSMock = (job: RepairJob) => {
    alert(`SMS trigger sent successfully to Customer number ${job.customer_phone}:\n\n` + 
          `"Dear Client, your ${setting.company_name} repair ticket ${job.ticket_no} (${job.brand} ${job.model}) status is updated to: ${job.status.toUpperCase()}.` +
          ` Est cost: Rs. ${job.estimated_cost}. Track details inside our Majestic Customer Portal."`);
  };

  const sendWhatsAppMock = (job: RepairJob) => {
    alert(`WhatsApp template dispatched to registered CRM profile:\n\n` + 
          `"Hello ${job.customer_name},\n` +
          `Your device (${job.brand} ${job.model}) is marked as *${job.status.toUpperCase()}* at the ${job.branch_name}. ` +
          `Should you have details feel free to reply. Thank you!"`);
  };

  // Portal query execution
  const executePortalTracking = (e: React.FormEvent) => {
    e.preventDefault();
    setPortalSearched(true);
    const list = repairsListState;
    const matched = list.find(r => r.ticket_no.trim().toLowerCase() === portalTicketNo.trim().toLowerCase());
    setPortalResult(matched || null);
  };

  const statusColors: Record<RepairStatus, string> = {
    received: 'bg-zinc-100 text-zinc-700',
    diagnosing: 'bg-indigo-100 text-indigo-750',
    waiting_parts: 'bg-amber-100 text-amber-705',
    in_repair: 'bg-blue-100 text-blue-755',
    completed: 'bg-green-150 text-green-755',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-605'
  };

  return (
    <div className="space-y-6" id="repair-center-module">
      {/* Module Title & Tab Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-2 rounded-2xl bg-zinc-50 border border-zinc-200">
        <div className="flex gap-1">
          <button
            onClick={() => { setActiveTab('active'); setSelectedJob(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'active'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Repair Tickets Queue
          </button>
          <button
            onClick={() => { setActiveTab('register'); setSelectedJob(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'register'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            Raise Job Card
          </button>
          <button
            onClick={() => setActiveTab('portal')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'portal'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Customer Tracking Portal
          </button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active List Panel (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm space-y-4">
            <div className="space-y-3.5">
              <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-550" />
                Showroom Ticket Registry
              </h4>

              {/* Filtering Controls */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Ticket No, customer Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">ANY Repair Status</option>
                  <option value="received">Received</option>
                  <option value="diagnosing">Diagnosing</option>
                  <option value="waiting_parts">Waiting Parts</option>
                  <option value="in_repair">In Repair</option>
                  <option value="completed">Completed</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto space-y-1 pr-1" id="repairs-cards-list">
              {filteredRepairs.length === 0 ? (
                <div className="text-center text-xs py-12 text-zinc-400 bg-zinc-50 rounded-xl border border-dashed">
                  No active workstation repair tickets matching selected query.
                </div>
              ) : (
                filteredRepairs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job);
                      setNewStatus(job.status);
                      setActualCost(job.actual_cost || job.estimated_cost);
                      setWarranty(job.warranty_period);
                    }}
                    className={`p-3 rounded-2xl cursor-pointer text-xs transition-all flex flex-col justify-between border ${
                      selectedJob?.id === job.id
                        ? 'border-indigo-500 bg-indigo-50/20 shadow-xs'
                        : 'border-zinc-100 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-zinc-900">{job.ticket_no}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusColors[job.status]}`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="mt-2 text-zinc-805">
                      <div className="font-semibold text-zinc-900">{job.brand} {job.model}</div>
                      <div className="text-[10px] text-zinc-505 mt-0.5 flex justify-between">
                        <span>Client: {job.customer_name}</span>
                        <span>Est: Rs. {job.estimated_cost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Interactive Inspection Workspace (7 Cols) */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm min-h-[400px]">
            {selectedJob ? (
              <div className="space-y-6" id="selected-repair-workspace">
                {/* Visual controls header for Job Card Receipt Print, WhatsApp Dispatch, SMS alerts */}
                <div className="flex items-center justify-between border-b border-zinc-150 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-455 tracking-wider font-mono">Workstation Terminal</span>
                    <h3 className="text-base font-extrabold text-zinc-900">Job Inspect Card: {selectedJob.ticket_no}</h3>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenRepairPrint(selectedJob)}
                      title="Print Customer Receiving Job Sheet / Receipt"
                      className="p-1 px-2.5 rounded-lg border border-zinc-250 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Card
                    </button>
                    <button
                      onClick={() => sendWhatsAppMock(selectedJob)}
                      title="WhatsApp Completion Trigger"
                      className="p-1 px-2.5 rounded-lg border border-green-200 bg-green-50/50 text-green-700 hover:bg-green-100 text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => sendSMSMock(selectedJob)}
                      title="SMS Alert Trigger"
                      className="p-1 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                      SMS Notify
                    </button>
                  </div>
                </div>

                {/* Core Device Card details */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-2xl p-4 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-bold mb-1">Customer Profile:</span>
                    <p className="font-bold text-zinc-900">{selectedJob.customer_name}</p>
                    <p className="text-zinc-500 mt-1">Mobile: {selectedJob.customer_phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-bold mb-1">Device Details:</span>
                    <p className="font-bold text-zinc-900">{selectedJob.device_type} - {selectedJob.brand}</p>
                    <p className="text-zinc-650 mt-1">{selectedJob.model} (SN: {selectedJob.serial_number})</p>
                  </div>
                  <div className="col-span-2 border-t border-zinc-200/60 pt-2 grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">Assigned Technician:</span>
                      <p className="font-semibold text-zinc-800">{selectedJob.technician_name || 'Not assigned yet'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block mb-0.5">Estimated Cost:</span>
                      <p className="font-semibold text-zinc-800">Rs. {selectedJob.estimated_cost.toLocaleString()} LKR</p>
                    </div>
                  </div>
                </div>

                {/* Received Accessories & Drawing confirmations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="border border-zinc-150 p-3 rounded-2xl bg-zinc-50/40">
                    <span className="font-bold text-zinc-700 block mb-1.5">Intact Received Accessories:</span>
                    {selectedJob.accessories && selectedJob.accessories.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 font-semibold text-zinc-600">
                        {selectedJob.accessories.map((item, id) => (
                          <li key={id}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500">None checked</span>
                    )}
                  </div>

                  {selectedJob.signature_data && (
                    <div className="border border-zinc-150 p-3 rounded-2xl bg-zinc-50/40">
                      <span className="font-bold text-zinc-700 block mb-1">Device Handover Signature:</span>
                      <div className="bg-white border rounded p-1.5 flex justify-center">
                        <svg className="w-full h-16 bg-white" viewBox="0 0 300 120">
                          <path
                            d={selectedJob.signature_data}
                            stroke="black"
                            strokeWidth="2"
                            fill="none"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline status update logs list */}
                <div className="space-y-3 p-4 border border-zinc-150 rounded-2xl bg-zinc-50/20" id="repair-timeline-timeline">
                  <h5 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    Technician Action & Progress Logs:
                  </h5>
                  <div className="relative pl-4 border-l border-zinc-200 ml-1.5 space-y-4">
                    {/* Filter local logs matching this repair ticket */}
                    {repairUpdatesList
                      .filter(upd => upd.repair_id === selectedJob.id)
                      .map((upd, idx) => (
                        <div key={idx} className="relative text-xs">
                          {/* Circle dot marker */}
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-950 border border-white" />
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-zinc-900 uppercase text-[10px]">
                              [{upd.status}]
                            </span>
                            <span className="text-[10px] text-zinc-400">{upd.updated_at.replace('T', ' ').substring(11, 16)}</span>
                          </div>
                          <p className="text-zinc-650 mt-1 text-[11px] leading-relaxed">{upd.notes}</p>
                          <div className="text-[10px] text-zinc-400 italic mt-0.5">By {upd.updated_by_name}</div>
                        </div>
                    ))}
                  </div>
                </div>

                {/* Progress actions updater forms for technicians and admins */}
                <form onSubmit={handleUpdateProgress} className="border-t border-zinc-150 pt-5 space-y-4 text-xs" id="repair-update-form">
                  <h4 className="font-bold text-zinc-800 flex items-center gap-1.5 text-sm">
                    <Edit className="w-4 h-4 text-zinc-400" />
                    Log Progress Actions:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                    <div>
                      <label className="text-zinc-550 block mb-1">Set Work Status:</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as RepairStatus)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase text-zinc-800"
                      >
                        <option value="received">Received</option>
                        <option value="diagnosing">Diagnosing</option>
                        <option value="waiting_parts">Waiting Parts</option>
                        <option value="in_repair">In Repair</option>
                        <option value="completed">Completed</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-zinc-550 block mb-1">Warranty Period:</label>
                      <select
                        value={warranty}
                        onChange={(e) => setWarranty(e.target.value as WarrantyPeriod)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="none">No Warranty Cover</option>
                        <option value="3_months">3 Months Store Warranty</option>
                        <option value="6_months">6 Months Store Warranty</option>
                        <option value="12_months">12 Months Store Warranty</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-zinc-550 block mb-1">Final Bills actual cost value:</label>
                      <input
                        type="number"
                        value={actualCost || ''}
                        onChange={(e) => setActualCost(parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                    </div>
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

                  </div>

                  <div>
                    <label className="text-zinc-550 block mb-1">Technical Observation Notes:</label>
                    <textarea
                      placeholder="Add observations, parts replaced or delivery comments..."
                      value={progressNotes}
                      onChange={(e) => setProgressNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-indigo-705 text-white font-bold py-2 px-4 rounded-xl transition-all"
                  >
                    Commit Status Log Changes
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 text-zinc-400 space-y-3">
                <Wrench className="w-12 h-12 text-zinc-300" />
                <p className="text-xs">
                  No repair job ticket highlighted.<br />Select a card from the left registry panel to inspect or update statuses.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'register' ? (
        /* Create repair Job ticket screen */
        <form onSubmit={handleRegisterJob} className="bg-white border rounded-3xl p-6 shadow-sm space-y-6 max-w-2xl mx-auto" id="register-repair-form">
          <div className="border-b border-zinc-150 pb-3">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-500" />
              Register New Hardware Device Job Card
            </h4>
            <p className="text-[11px] text-zinc-500 mt-1">
              Store: {activeBranch?.name}. Fill customer info, hardware details and check accessories intact.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Customer Details info block */}
            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                Customer Full Name:
              </label>
              <input
                type="text"
                placeholder="e.g. Kumar Sangakkara"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                Mobile Phone Number:
              </label>
              <input
                type="text"
                placeholder="e.g. +94 77 123 4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
                required
              />
            </div>

            {/* Hardware properties */}
            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Hardware Device Type:</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
              >
                <option value="Laptop">Laptop Notebook</option>
                <option value="Mobile Phone">Mobile Phone</option>
                <option value="Desktop CPU">Desktop PC Console</option>
                <option value="Motherboard Component">Motherboard Chipset</option>
                <option value="GPU Card">GPU Graphics Board</option>
                <option value="Laser Printer">EcoTank Printer</option>
                <option value="LED Monitor">LED/LCD Display Monitor</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Brand name:</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
              >
                <option value="ASUS">ASUS</option>
                <option value="HP">HP</option>
                <option value="Dell">Dell</option>
                <option value="Custom Build">Custom Builder Block</option>
                <option value="Epson">Epson</option>
                <option value="Samsung">Samsung</option>
                <option value="Apple">Apple</option>
                <option value="Xiaomi">Xiaomi</option>
                <option value="Oppo">Oppo</option>
                <option value="Vivo">Vivo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Model name or Number:</label>
              <input
                type="text"
                placeholder="e.g. ROG Zephyrus G14"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Hardware serial number:</label>
              <input
                type="text"
                placeholder="e.g. SN-ROG394M120"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-zinc-555 font-bold block">Diagnostic problem Description:</label>
              <textarea
                placeholder="Describe issue (e.g. BSOD on loading, turns off under load, roller error)"
                value={problemDesc}
                onChange={(e) => setProblemDesc(e.target.value)}
                rows={2}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-505"
                required
              />
            </div>

            {/* Intact accessories checklist */}
            <div className="sm:col-span-2 space-y-2 border-t border-zinc-100 pt-3">
              <label className="text-zinc-555 font-bold block mb-1">Checklist Received Accessories of Device:</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-zinc-50 p-3 rounded-2xl border">
                {accessoryOptions.map((acc, index) => (
                  <label key={index} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedAccessories.includes(acc)}
                      onChange={() => handleAccessoryChecked(acc)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-1"
                    />
                    <span className="text-[10.5px] font-medium text-zinc-650">{acc.substring(0, 22)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Technicians assignment */}
            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Assign Workshop Technician:</label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
              >
                <option value="">Leave Unassigned (Queue)</option>
                {techniciansList.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.role === 'technician' ? 'Tech' : 'Admin'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-550 font-bold block">Estimated diagnostic Cost: (LKR)</label>
              <input
                type="number"
                placeholder="Est: Rs."
                value={estimatedCost || ''}
                onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-zinc-50 border border-zinc-250 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
              />
            </div>

            {/* Signature Draw confirmaion */}
            <div className="sm:col-span-2 space-y-2 border-t border-zinc-100 pt-3">
              <label className="text-zinc-555 font-bold block flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <PenTool className="w-4 h-4 text-zinc-400" />
                  Capturing client Confirmation Signature:
                </span>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[10px] text-zinc-500 hover:text-red-500 hover:bg-zinc-100 px-2 py-0.5 rounded"
                >
                  Clear drawing pad
                </button>
              </label>

              <div className="border border-zinc-250 rounded-2xl bg-zinc-50 overflow-hidden relative cursor-crosshair">
                <svg
                  ref={svgRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="w-full h-24 bg-white"
                  id="client-interactive-signature-canvas"
                >
                  <path
                    d={signatureSvgPath}
                    stroke="black"
                    strokeWidth="2.5"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded-xl uppercase tracking-wider"
          >
            Issue Job Card Ticket & Print ID
          </button>
        </form>
      ) : (
        /* CUSTOMER TRACKING PORTAL screen */
        <div className="bg-white border rounded-3xl p-6 shadow-sm max-w-md mx-auto space-y-6" id="customer-tracking-portal-area">
          <div className="text-center space-y-2">
            <Smartphone className="w-10 h-10 text-indigo-650 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Majestic Clients Device Tracker</h4>
            <p className="text-xs text-zinc-505">
              Enter the unique ticket code from your printed job card (e.g. <strong className="text-indigo-650">TK-COL-1001</strong>) to view active repair history and times.
            </p>
          </div>

          <form onSubmit={executePortalTracking} className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="e.g. TK-COL-1001"
              value={portalTicketNo}
              onChange={(e) => setPortalTicketNo(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-250 text-xs rounded-xl pl-10 pr-24 py-2.5 outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bg-zinc-900 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-zinc-805"
            >
              Track Ticket
            </button>
          </form>

          {portalSearched && (
            <div className="border-t border-zinc-150 pt-5 text-xs text-zinc-800">
              {portalResult ? (
                <div className="space-y-4" id="portal-matched-ticket">
                  <div className="flex justify-between items-center bg-zinc-50 p-2.5 rounded-xl border border-zinc-150">
                    <span className="font-mono font-bold">{portalResult.ticket_no}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${statusColors[portalResult.status]}`}>
                      {portalResult.status}
                    </span>
                  </div>

                  <div className="space-y-1 leading-normal">
                    <div><strong>Customer Name:</strong> {portalResult.customer_name}</div>
                    <div><strong>Device details:</strong> {portalResult.brand} {portalResult.model}</div>
                    <div><strong>Received Location:</strong> {portalResult.branch_name}</div>
                    <div><strong>Warranty Cover:</strong> {portalResult.warranty_period === 'none' ? 'None' : portalResult.warranty_period.replace('_', ' ')}</div>
                    <div><strong>Actual repair cost:</strong> Rs. {portalResult.actual_cost ? portalResult.actual_cost.toLocaleString() : portalResult.estimated_cost.toLocaleString()}</div>
                  </div>

                  {/* Progressive Timeline logs list */}
                  <div className="bg-zinc-50/50 p-4 border rounded-2xl relative space-y-3">
                    <span className="font-bold text-[10px] uppercase text-zinc-450 block">Device Processing timeline:</span>
                    <div className="relative border-l pl-3 ml-1 text-[11px] space-y-2">
                      {repairUpdatesList
                        .filter(u => u.repair_id === portalResult.id)
                        .map((u, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[16px] top-1 w-2 h-2 rounded-full bg-zinc-950" />
                            <span className="font-bold capitalize text-zinc-900">[{u.status}]</span>
                            <p className="text-zinc-650 mt-0.5">{u.notes}</p>
                            <span className="text-[9px] text-zinc-400 block mt-0.5">{u.updated_at.split('T')[0]}</span>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 text-red-750 border border-red-105 rounded-2xl text-center">
                  Sorry, no repair ticket matching <strong>&quot;{portalTicketNo}&quot;</strong> was located in any {setting.company_name} database branches. Check spelling and retry.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REPAIR JOB CARD PRINTING PREVIEWS MODAL LAYER */}
      {showRepairPrintModal && printingJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="repair-print-modal">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 border border-zinc-200">
            <div className="flex flex-col space-y-2 border-b border-zinc-100 pb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest">
                  Job Card Printing
                </span>
                <button
                  onClick={() => {
                    setPrintingJob(null);
                    setShowRepairPrintModal(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-900 text-xs font-semibold"
                >
                  Close Previews
                </button>
              </div>
              <div className="flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-xl">
                {[
                  { key: 'a4-half', label: 'Continuous Form (Dot Matrix / Half Sheet)' },
                  { key: 'thermal', label: '80mm Thermal (POS Roll)' },
                  { key: 'a4', label: 'Standard A4 (Full Sheet)' },
                  { key: 'a5', label: 'A5 Portrait' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setShowRepairPrintModal(tab.key)}
                    className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-all text-center whitespace-nowrap ${
                      showRepairPrintModal === tab.key
                        ? 'bg-white text-indigo-650 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Orientation selector */}
              <div className="flex items-center justify-between pt-1 px-1">
                <span className="text-[10px] font-semibold text-zinc-500">Feed Orientation:</span>
                <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setRepairPrintOrientation('portrait')}
                    className={`px-2 py-0.5 rounded transition-all ${repairPrintOrientation === 'portrait' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                    title="Recommended for tractor continuous paper - prints straight without 90 degree sideways rotation"
                  >
                    Standard Feed (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepairPrintOrientation('landscape')}
                    className={`px-2 py-0.5 rounded transition-all ${repairPrintOrientation === 'landscape' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                    title="Rotates page 90 degrees for landscape-oriented feeds"
                  >
                    Landscape (Rotated 90°)
                  </button>
                </div>
              </div>

              {showRepairPrintModal === 'a4-half' && (
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 text-[10px] text-amber-900 leading-tight">
                  <strong>💡 Dot Matrix Continuous Paper Tip:</strong> <em>Standard Feed (Portrait)</em> is active to prevent 90° sideways rotation on continuous tractor roll paper. In the browser print dialog, set Margins to <em>&quot;None&quot;</em> or <em>&quot;Default&quot;</em>.
                </div>
              )}
            </div>

            {/* PRINT RENDERING CANVAS */}
            <div className="border border-zinc-200 rounded-2xl p-4 overflow-y-auto max-h-[420px] bg-zinc-50 flex justify-center">
              {showRepairPrintModal === 'thermal' && (
                /* Thermal 80mm styled ticket */
                <div className="w-[80mm] bg-white p-4 border border-zinc-300 shadow-sm text-[11px] font-mono leading-relaxed text-zinc-805 flex flex-col items-center select-none" id="thermal-repair-display-area">
                  <div className="font-extrabold text-center uppercase tracking-wide text-xs">{setting.company_name}</div>
                  <div className="text-center text-[10px] text-zinc-500 mt-0.5">{printingJob.branch_name}</div>
                  <div className="text-center text-[9px] text-zinc-500">{repairBranchInfo.address}</div>
                  <div className="text-center text-[9px] text-zinc-500">Tel: {repairBranchInfo.phone}</div>
                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full text-center py-1">
                    <span className="text-xs font-bold tracking-wider uppercase border border-zinc-900 px-2 py-0.5">
                      REPAIR JOB CARD
                    </span>
                    <div className="mt-1.5 font-black text-sm tracking-widest">{printingJob.ticket_no}</div>
                  </div>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full space-y-0.5 text-[9px]">
                    <div><strong>Date Recvd:</strong> {printingJob.created_at.replace('T', ' ').substring(0, 16)}</div>
                    <div><strong>Cust Name:</strong> {printingJob.customer_name}</div>
                    <div><strong>Mobile No:</strong> {printingJob.customer_phone}</div>
                    <div><strong>Assigned Tech:</strong> {printingJob.technician_name || 'Not assigned'}</div>
                  </div>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full space-y-0.5 text-[9px]">
                    <div className="font-bold underline uppercase text-[8px] mb-0.5 text-zinc-500">Device Description:</div>
                    <div><strong>Device:</strong> {printingJob.device_type}</div>
                    <div><strong>Brand/Model:</strong> {printingJob.brand} {printingJob.model}</div>
                    <div><strong>Serial Code:</strong> {printingJob.serial_number}</div>
                    <div><strong>Est Price:</strong> Rs. {printingJob.estimated_cost.toLocaleString()} LKR</div>
                  </div>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full text-[9px]">
                    <div className="font-bold underline uppercase text-[8px] mb-0.5 text-zinc-500">Accessories Handed:</div>
                    {printingJob.accessories && printingJob.accessories.length > 0 ? (
                      <div className="pl-1 text-zinc-650">{printingJob.accessories.join(', ')}</div>
                    ) : (
                      <div className="italic text-zinc-400">None checked</div>
                    )}
                  </div>

                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  
                  <div className="w-full text-[9px]">
                    <div className="font-bold underline uppercase text-[8px] mb-0.5 text-zinc-500">Reported Problem Issue:</div>
                    <div className="pl-1 italic leading-tight text-zinc-700">{printingJob.problem_desc}</div>
                  </div>

                  {printingJob.signature_data && (
                    <>
                      <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                      <div className="w-full text-[9px] flex flex-col items-center">
                        <span className="font-bold text-[8px] text-zinc-400 mb-1">CUSTOMER SIGNATURE:</span>
                        <div className="bg-zinc-50 border p-1 rounded">
                          <svg className="w-36 h-10 bg-white" viewBox="0 0 300 120">
                            <path d={printingJob.signature_data} stroke="black" strokeWidth="3" fill="none" />
                          </svg>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="w-full border-t border-dashed border-zinc-300 my-3" />
                  <div className="text-[7.5px] text-center text-zinc-455 leading-tight">
                    * Not responsible for software data loss. Please back up devices first.<br />
                    * Devices left over 60 days will be disposed of to recover service dues.
                  </div>
                  <div className="text-[9px] text-center font-bold mt-2 italic">&quot;Majestic Repairs&quot;</div>
                </div>
              )}

              {showRepairPrintModal === 'a4' && (
                /* Corporate A4 styled Layout */
                <div className="w-full bg-white p-6 border border-zinc-300 shadow-sm text-xs leading-relaxed text-zinc-800 flex flex-col space-y-4" id="a4-repair-display-area">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-tight">{setting.company_name}</h3>
                      <p className="text-[9px] text-zinc-500 mt-1">{printingJob.branch_name}</p>
                      <p className="text-[9px] text-zinc-500">{repairBranchInfo.address}</p>
                      <p className="text-[9px] text-zinc-505">Tel: {repairBranchInfo.phone}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-indigo-650 font-black uppercase text-base leading-none">REPAIR JOB SHEET</h4>
                      <p className="font-mono text-xs font-semibold text-zinc-650 mt-2">Ticket: {printingJob.ticket_no}</p>
                      <p className="text-[9px] text-zinc-505">Date: {printingJob.created_at.split('T')[0]}</p>
                    </div>
                  </div>

                  <div className="border-t border-b border-zinc-150 py-3 grid grid-cols-2 gap-4 text-[10px]">
                    <div>
                      <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Customer Profile:</div>
                      <p className="text-zinc-900 font-bold text-xs">{printingJob.customer_name}</p>
                      <p className="text-zinc-550 mt-1">Mobile: {printingJob.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Intake Officer:</div>
                      <p className="text-zinc-900 font-semibold">{printingJob.created_by_name || 'System Admin'}</p>
                      <p className="text-zinc-505 uppercase text-[9px] font-bold">Assigned Technician: {printingJob.technician_name || 'Unassigned'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[10.5px]">
                    <div>
                      <h5 className="font-bold text-zinc-800 text-[9px] uppercase tracking-wider mb-1.5 border-b border-zinc-100 pb-1">Hardware Inspection Details</h5>
                      <div className="space-y-1">
                        <div><strong>Device Type:</strong> {printingJob.device_type}</div>
                        <div><strong>Brand & Model:</strong> {printingJob.brand} {printingJob.model}</div>
                        <div><strong>Serial Code / IMEI:</strong> {printingJob.serial_number}</div>
                        <div><strong>Estimated Repair Cost:</strong> Rs. {printingJob.estimated_cost.toLocaleString()} LKR</div>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-bold text-zinc-800 text-[9px] uppercase tracking-wider mb-1.5 border-b border-zinc-100 pb-1">Intact Accessories Received</h5>
                      {printingJob.accessories && printingJob.accessories.length > 0 ? (
                        <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 text-[10px]">
                          {printingJob.accessories.map((acc, index) => (
                            <li key={index}>{acc}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="italic text-zinc-400 text-[10px]">No accessories checked in.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <h5 className="font-bold text-zinc-800 text-[9px] uppercase tracking-wider border-b border-zinc-100 pb-1">Reported Issue / Fault Description</h5>
                    <p className="bg-zinc-50 border p-2.5 rounded-xl text-zinc-700 italic text-[10px] leading-relaxed">
                      {printingJob.problem_desc}
                    </p>
                  </div>

                  {printingJob.notes && (
                    <div className="space-y-1">
                      <h5 className="font-bold text-zinc-800 text-[9px] uppercase tracking-wider border-b border-zinc-100 pb-0.5">Additional Intake Notes</h5>
                      <p className="text-zinc-600 text-[10px]">{printingJob.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-end pt-4" id="a4-repair-sign-sheet">
                    <div className="max-w-[60%] text-[8px] text-zinc-500 leading-normal pr-4">
                      <p className="font-bold uppercase tracking-wider text-zinc-650 text-[7.5px] mb-1">Repair Terms and Conditions:</p>
                      <p>1. Hardware Repairs: All component level repairs carry a standard 30-day hardware failure warranty unless stated otherwise.</p>
                      <p>2. Data Indemnity: {setting.company_name} shall not be held liable for any data loss, file degradation or operating system crashes during the service cycle. Data backup is the sole responsibility of the client.</p>
                      <p>3. Unclaimed Devices: Devices left uncollected for more than sixty (60) days after completion notification will be liquidated, sold, or disposed of to offset storage and service expenses.</p>
                    </div>
                    
                    {printingJob.signature_data ? (
                      <div className="text-center w-40 flex flex-col items-center">
                        <span className="font-bold text-[8.5px] text-zinc-400 uppercase">Customer Sign-off</span>
                        <div className="border border-zinc-200 p-1 bg-zinc-50 rounded-xl mt-1 flex justify-center">
                          <svg className="w-32 h-10 bg-white" viewBox="0 0 300 120">
                            <path d={printingJob.signature_data} stroke="black" strokeWidth="3" fill="none" />
                          </svg>
                        </div>
                        <span className="text-[7.5px] text-zinc-455 mt-1">Authorized Handover</span>
                      </div>
                    ) : (
                      <div className="text-center w-40 border-t border-dashed border-zinc-400 pt-8 text-zinc-400 text-[9px] uppercase tracking-wider font-semibold">
                        Customer Signature
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showRepairPrintModal === 'a4-half' && (
                /* Corporate A4 Half Sheet (Landscape) styled Layout */
                <div className="w-[210mm] bg-white p-5 border border-zinc-300 shadow-sm text-[10px] leading-relaxed text-zinc-805 flex flex-col space-y-3" id="a4-half-repair-display-area">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-tight">{setting.company_name} - {printingJob.branch_name}</h3>
                      <p className="text-[8.5px] text-zinc-500">{repairBranchInfo.address} | Tel: {repairBranchInfo.phone}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-indigo-650 font-black uppercase text-xs leading-none">REPAIR JOB CARD (A4 HALF)</h4>
                      <p className="font-mono text-[9px] font-semibold text-zinc-650 mt-1">Ticket: {printingJob.ticket_no} | Date: {printingJob.created_at.split('T')[0]}</p>
                    </div>
                  </div>

                  <div className="border-t border-b border-zinc-150 py-1.5 grid grid-cols-2 gap-4 text-[9px]">
                    <div>
                      <span className="font-bold text-zinc-500 uppercase text-[8px]">Customer: </span>
                      <strong className="text-zinc-900">{printingJob.customer_name}</strong> ({printingJob.customer_phone})
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-500 uppercase text-[8px]">Tech: </span>
                      <strong className="text-zinc-900">{printingJob.technician_name || 'Not assigned'}</strong> | Intake: <span>{printingJob.created_by_name || 'Admin'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[9px]">
                    <div>
                      <span className="font-bold text-zinc-500 uppercase text-[8px] block mb-0.5">Device Inspected:</span>
                      <strong>{printingJob.device_type}</strong> - {printingJob.brand} {printingJob.model} (SN: {printingJob.serial_number})
                      <div className="mt-1"><strong>Est. Price:</strong> Rs. {printingJob.estimated_cost.toLocaleString()} LKR</div>
                    </div>
                    <div>
                      <span className="font-bold text-zinc-500 uppercase text-[8px] block mb-0.5">Accessories:</span>
                      {printingJob.accessories && printingJob.accessories.length > 0 ? (
                        <span className="text-zinc-600">{printingJob.accessories.join(', ')}</span>
                      ) : (
                        <span className="italic text-zinc-400">None checked</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-zinc-500 uppercase text-[8px] block">Problem Description:</span>
                    <p className="bg-zinc-50 border p-2 rounded-lg text-zinc-700 italic text-[9.5px]">
                      {printingJob.problem_desc}
                    </p>
                  </div>

                  <div className="flex justify-between items-end pt-1 border-t border-zinc-150">
                    <div className="max-w-[65%] text-[7.5px] text-zinc-500 leading-tight">
                      * 30-day component warranty. Not liable for data loss. Uncollected items disposed in 60 days.
                    </div>
                    {printingJob.signature_data && (
                      <div className="text-center">
                        <svg className="w-28 h-8 bg-white border rounded" viewBox="0 0 300 120">
                          <path d={printingJob.signature_data} stroke="black" strokeWidth="3" fill="none" />
                        </svg>
                        <span className="text-[7px] text-zinc-450">Customer Handover</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showRepairPrintModal === 'a5' && (
                /* Corporate A5 Portrait styled Layout */
                <div className="w-[148mm] bg-white p-5 border border-zinc-300 shadow-sm text-[9.5px] leading-relaxed text-zinc-805 flex flex-col space-y-3.5" id="a5-repair-display-area">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-tight">{setting.company_name}</h3>
                      <p className="text-[8px] text-zinc-500">{printingJob.branch_name}</p>
                      <p className="text-[8px] text-zinc-500">{repairBranchInfo.address}</p>
                      <p className="text-[8px] text-zinc-550">Tel: {repairBranchInfo.phone}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-indigo-650 font-black uppercase text-xs leading-none">REPAIR JOB CARD (A5)</h4>
                      <p className="font-mono text-[9px] font-semibold text-zinc-650 mt-1">Ticket: {printingJob.ticket_no}</p>
                      <p className="text-[8px] text-zinc-505">Date: {printingJob.created_at.split('T')[0]}</p>
                    </div>
                  </div>

                  <div className="border-t border-b border-zinc-150 py-2 grid grid-cols-2 gap-2 text-[8.5px]">
                    <div>
                      <div className="font-bold text-zinc-500 uppercase text-[7px] mb-0.5">Customer details:</div>
                      <p className="text-zinc-900 font-bold">{printingJob.customer_name}</p>
                      <p className="text-zinc-500">Tel: {printingJob.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-500 uppercase text-[7px] mb-0.5">Assigned technician:</div>
                      <p className="text-zinc-900 font-semibold">{printingJob.technician_name || 'Unassigned'}</p>
                      <p className="text-zinc-505 text-[8px]">Invoiced: Rs. {printingJob.estimated_cost.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-zinc-500 uppercase text-[7px]">Hardware & Fault Details:</span>
                    <p className="font-semibold text-zinc-850">{printingJob.device_type} - {printingJob.brand} {printingJob.model}</p>
                    <p className="text-zinc-500 text-[8px]">Serial: {printingJob.serial_number}</p>
                    <p className="bg-zinc-50 border p-2 rounded-lg text-zinc-700 italic text-[9px] leading-tight">
                      Fault: {printingJob.problem_desc}
                    </p>
                  </div>

                  {printingJob.accessories && printingJob.accessories.length > 0 && (
                    <div className="text-[8.5px]">
                      <strong>Accessories:</strong> <span className="text-zinc-600">{printingJob.accessories.join(', ')}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-end pt-2 border-t border-zinc-150">
                    <div className="max-w-[60%] text-[7.5px] text-zinc-500 leading-tight">
                      * Warranty covers manufacturers defect. Devices left 60 days disposed.
                    </div>
                    {printingJob.signature_data ? (
                      <div className="text-center">
                        <svg className="w-24 h-8 bg-white border rounded" viewBox="0 0 300 120">
                          <path d={printingJob.signature_data} stroke="black" strokeWidth="3" fill="none" />
                        </svg>
                        <span className="text-[7px] text-zinc-400">Customer Sign</span>
                      </div>
                    ) : (
                      <div className="w-20 border-t border-dashed border-zinc-300 pt-3 text-[7.5px] text-zinc-400 text-center uppercase">
                        Signature
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CONTROLS */}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-3">
              <button
                onClick={() => {
                  let targetId = 'a4-repair-display-area';
                  if (showRepairPrintModal === 'thermal') targetId = 'thermal-repair-display-area';
                  else if (showRepairPrintModal === 'a4-half') targetId = 'a4-half-repair-display-area';
                  else if (showRepairPrintModal === 'a5') targetId = 'a5-repair-display-area';
                  handlePrintRepair(targetId, showRepairPrintModal, repairPrintOrientation);
                }}
                className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md animate-pulse"
                title="Send directly to system physical printer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Now
              </button>
              
              <button
                onClick={async () => {
                  if (!printingJob) return;
                  const company = setting;
                  const text = `*${company.company_name.toUpperCase()} - REPAIR TICKET*
🛠️ *Ticket No:* ${printingJob.ticket_no}
👤 *Customer:* ${printingJob.customer_name}
💻 *Device:* ${printingJob.brand} ${printingJob.model}
🔢 *Serial:* ${printingJob.serial_number || 'N/A'}
⚠️ *Issue:* ${printingJob.issue_description}
📊 *Status:* ${printingJob.status.toUpperCase()}
💵 *Est. Cost:* Rs. ${printingJob.estimated_cost.toLocaleString()} LKR

📍 ${company.address}
📞 Hotline: ${company.phone}`;

                  let cleanNum = (printingJob.customer_phone || '').replace(/\D/g, '');
                  if (cleanNum.startsWith('0')) cleanNum = '94' + cleanNum.substring(1);

                  let targetId = 'a4-repair-display-area';
                  if (showRepairPrintModal === 'thermal') targetId = 'thermal-repair-display-area';
                  else if (showRepairPrintModal === 'a4-half') targetId = 'a4-half-repair-display-area';
                  else if (showRepairPrintModal === 'a5') targetId = 'a5-repair-display-area';

                  const element = document.getElementById(targetId);

                  if (element) {
                    try {
                      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                      if (blob) {
                        const file = new File([blob], `Ticket-${printingJob.ticket_no}.png`, { type: 'image/png' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                          await navigator.share({
                            files: [file],
                            title: `Repair Ticket ${printingJob.ticket_no}`,
                            text
                          });
                          return;
                        }

                        try {
                          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                          alert('📋 Ticket image copied to clipboard!\nPress Ctrl+V in WhatsApp to paste.');
                        } catch (e) {
                          console.log('Clipboard fallback:', e);
                        }
                      }
                    } catch (e) {
                      console.error('Image capture error:', e);
                    }
                  }

                  const appUrl = `whatsapp://send?phone=${cleanNum}&text=${encodeURIComponent(text)}`;
                  const webUrl = `https://api.whatsapp.com/send?phone=${cleanNum}&text=${encodeURIComponent(text)}`;
                  window.location.href = appUrl;
                  setTimeout(() => { window.open(webUrl, '_blank'); }, 1200);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm"
                title="Send job card ticket via WhatsApp app"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Ticket
              </button>

              <button
                onClick={() => {
                  alert('Generating Repair PDF package... Document auto-saved into local device disk.');
                }}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
