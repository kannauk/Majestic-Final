import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Clock, CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, Copy, Check, ExternalLink, ShieldAlert,
  Search, Filter, Calendar, Users, Building2, Radio,
  Send, ArrowRight, ArrowLeft, Download, ShieldCheck, Key
} from 'lucide-react';
import { User, Branch, AttendanceLog } from '../types';
import { getAttendanceLogs, regenerateAttendanceToken } from '../services/attendance';
import { getUsers } from '../services/users';

interface GeoAttendanceProps {
  user: User;
  activeBranch: Branch | null;
  branches: Branch[];
}

export default function GeoAttendance({ user, activeBranch, branches }: GeoAttendanceProps) {
  const isSuperAdmin = user.role === 'super_admin';
  const isBranchAdmin = user.role === 'branch_admin';

  const [activeTab, setActiveTab] = useState<'logs' | 'staff_links'>('logs');

  // Logs state
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? 'all' : (user.branch_id || activeBranch?.id || 'all')
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0] // default to today
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'denied'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Staff Links state
  const [staffList, setStaffList] = useState<User[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffBranchFilter, setStaffBranchFilter] = useState<string>(
    isSuperAdmin ? 'all' : (user.branch_id || activeBranch?.id || 'all')
  );

  // Regenerate Token Modal State
  const [regenerateModalUser, setRegenerateModalUser] = useState<User | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // Fetch logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const branchFilter = isSuperAdmin ? (selectedBranchId === 'all' ? undefined : selectedBranchId) : user.branch_id;
      const data = await getAttendanceLogs(branchFilter, selectedDate || undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
      showToast('Failed to load attendance logs.', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch staff users
  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const allUsers = await getUsers();
      setStaffList(allUsers);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStaff();
  }, [selectedBranchId, selectedDate]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Role scoping: branch_admin only sees their branch
      if (!isSuperAdmin && user.branch_id && log.branch_id !== user.branch_id) {
        return false;
      }
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all' && log.type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = log.user_name?.toLowerCase().includes(query);
        const matchesBranch = log.branch_name?.toLowerCase().includes(query);
        if (!matchesName && !matchesBranch) return false;
      }
      return true;
    });
  }, [logs, isSuperAdmin, user.branch_id, statusFilter, typeFilter, searchQuery]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      // Role scoping
      if (!isSuperAdmin && user.branch_id && s.branch_id !== user.branch_id) {
        return false;
      }
      if (isSuperAdmin && staffBranchFilter !== 'all' && s.branch_id !== staffBranchFilter) {
        return false;
      }
      if (staffSearchQuery.trim()) {
        const query = staffSearchQuery.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(query);
        const matchesUsername = s.username?.toLowerCase().includes(query);
        const matchesEmail = s.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesUsername && !matchesEmail) return false;
      }
      return true;
    });
  }, [staffList, isSuperAdmin, user.branch_id, staffBranchFilter, staffSearchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPunches = filteredLogs.length;
    const approved = filteredLogs.filter(l => l.status === 'approved').length;
    const denied = filteredLogs.filter(l => l.status === 'denied').length;
    const currentlyIn = new Set(
      filteredLogs.filter(l => l.type === 'in' && l.status === 'approved').map(l => l.user_id)
    ).size;

    return { totalPunches, approved, denied, currentlyIn };
  }, [filteredLogs]);

  // Copy Attendance Link to clipboard
  const handleCopyLink = (staff: User) => {
    if (!staff.attendance_token) {
      showToast('Staff user does not have an active attendance token. Please regenerate.', 'error');
      return;
    }
    const origin = window.location.origin;
    const link = `${origin}/attend/${staff.attendance_token}`;
    navigator.clipboard.writeText(link);
    setCopiedTokenId(staff.id);
    showToast(`Attendance link for ${staff.name || staff.username} copied to clipboard!`);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Open WhatsApp with link
  const handleShareWhatsApp = (staff: User) => {
    if (!staff.attendance_token) return;
    const origin = window.location.origin;
    const link = `${origin}/attend/${staff.attendance_token}`;
    const branchName = branches.find(b => b.id === staff.branch_id)?.name || 'Majestic Computers';
    const text = encodeURIComponent(
      `Hello ${staff.name || staff.username},\n\nHere is your private Majestic Computers Staff Attendance Link for ${branchName}:\n${link}\n\nPlease bookmark this link on your mobile phone to punch in and out when at the branch showroom.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Confirm Regenerate Token
  const handleConfirmRegenerate = async () => {
    if (!regenerateModalUser) return;
    setIsRegenerating(true);
    try {
      const newToken = await regenerateAttendanceToken(regenerateModalUser.id);
      setStaffList(prev => prev.map(s => s.id === regenerateModalUser.id ? { ...s, attendance_token: newToken } : s));
      showToast(`Generated new private attendance token for ${regenerateModalUser.name || regenerateModalUser.username}. Previous link is now invalidated.`);
      setRegenerateModalUser(null);
    } catch (err: any) {
      console.error(err);
      showToast('Failed to regenerate token: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Export Attendance Logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs to export for the current filter selection.', 'error');
      return;
    }

    const headers = ['ID', 'Staff Name', 'Branch Name', 'Punch Type', 'Status', 'Distance (m)', 'Allowed Radius (m)', 'Latitude', 'Longitude', 'Timestamp'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.user_name || ''}"`,
      `"${l.branch_name || ''}"`,
      l.type.toUpperCase(),
      l.status.toUpperCase(),
      l.distance_meters,
      l.radius_meters,
      l.latitude,
      l.longitude,
      l.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Majestic_GeoAttendance_Logs_${selectedDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Attendance report CSV downloaded.');
  };

  return (
    <div className="space-y-6 pb-12" id="geo-attendance-module">
      
      {/* Toast Notification */}
      {notificationMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          notificationMsg.type === 'success' 
            ? 'bg-emerald-500 text-white border-emerald-400' 
            : 'bg-rose-600 text-white border-rose-500'
        }`}>
          {notificationMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#12141A] border border-[#1F242D] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#00E5FF] mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>High Precision Geolocation Punch</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-orange-500" />
            Staff Geolocation Attendance
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Geofenced physical presence verification with private staff punch tokens and automated distance validation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#181B22] border border-[#232936] p-1 rounded-2xl shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Attendance Logs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff_links')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'staff_links'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Staff Punch Links</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ATTENDANCE LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#12141A] border border-[#1F242D] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Punches</span>
              <div className="text-2xl font-black text-white">{stats.totalPunches}</div>
              <span className="text-[10px] text-zinc-500">In selected filter period</span>
            </div>

            <div className="bg-[#12141A] border border-[#1F242D] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Approved Punches</span>
              <div className="text-2xl font-black text-emerald-400">{stats.approved}</div>
              <span className="text-[10px] text-zinc-500">Verified within showroom radius</span>
            </div>

            <div className="bg-[#12141A] border border-[#1F242D] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Denied / Out of Range</span>
              <div className="text-2xl font-black text-rose-400">{stats.denied}</div>
              <span className="text-[10px] text-zinc-500">Attempted outside allowable radius</span>
            </div>

            <div className="bg-[#12141A] border border-[#1F242D] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-[#00E5FF] uppercase tracking-wider block">Active Staff Checked In</span>
              <div className="text-2xl font-black text-[#00E5FF]">{stats.currentlyIn}</div>
              <span className="text-[10px] text-zinc-500">Currently on active showroom shift</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search staff name or branch..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 font-semibold outline-none focus:border-orange-500 text-xs"
                  />
                </div>

                {/* Branch filter (Super Admin only) */}
                {isSuperAdmin && (
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-zinc-800 font-semibold outline-none focus:border-orange-500 text-xs"
                  >
                    <option value="all">All Branch Showrooms</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}

                {/* Date Picker */}
                <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-zinc-800 font-semibold outline-none text-xs"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="text-[10px] text-zinc-400 hover:text-zinc-700 font-bold ml-1"
                      title="Clear Date Filter"
                    >
                      All Time
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-zinc-800 font-semibold outline-none focus:border-orange-500 text-xs"
                >
                  <option value="all">All Verification Statuses</option>
                  <option value="approved">Approved Only</option>
                  <option value="denied">Denied Only</option>
                </select>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-zinc-800 font-semibold outline-none focus:border-orange-500 text-xs"
                >
                  <option value="all">All Types (IN & OUT)</option>
                  <option value="in">PUNCH IN Only</option>
                  <option value="out">PUNCH OUT Only</option>
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

            </div>
          </div>

          {/* Attendance Logs Table */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>Attendance Verification Trail ({filteredLogs.length})</span>
              </h3>
              <span className="text-[11px] text-zinc-500">
                {selectedDate ? `Date: ${selectedDate}` : 'All historic logs'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-100 text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Branch Hub</th>
                    <th className="py-3.5 px-4 text-center">Punch Action</th>
                    <th className="py-3.5 px-4 text-center">Verification Status</th>
                    <th className="py-3.5 px-4">GPS Distance vs Allowed Radius</th>
                    <th className="py-3.5 px-4">GPS Coordinates</th>
                    <th className="py-3.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                        <span>Loading geolocation attendance logs...</span>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-zinc-600">No attendance punches recorded</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Try selecting a different date or branch filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isApproved = log.status === 'approved';
                      const isTypeIn = log.type === 'in';
                      const dateObj = new Date(log.created_at);

                      return (
                        <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900">{log.user_name || 'Staff User'}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">ID: {log.user_id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-zinc-800">{log.branch_name || 'Showroom'}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isTypeIn 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-orange-100 text-orange-800 border border-orange-200'
                            }`}>
                              {isTypeIn ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                              <span>{isTypeIn ? 'IN' : 'OUT'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isApproved ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                              <span>{isApproved ? 'Approved' : 'Denied'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${
                                isApproved ? 'text-emerald-700' : 'text-rose-600'
                              }`}>
                                {log.distance_meters}m
                              </span>
                              <span className="text-zinc-400">/</span>
                              <span className="text-zinc-500 font-medium text-[11px]">
                                Allowed: ≤ {log.radius_meters || 5}m
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                            {log.latitude && log.longitude ? (
                              <span>{log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</span>
                            ) : (
                              <span className="text-zinc-400">N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-bold text-zinc-900">
                              {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {dateObj.toLocaleDateString()}
                            </div>
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

      {/* TAB 2: STAFF PRIVATE PUNCH LINKS */}
      {activeTab === 'staff_links' && (
        <div className="space-y-6">
          
          {/* Info Card */}
          <div className="bg-gradient-to-r from-orange-500/10 to-cyan-500/10 border border-orange-500/20 rounded-3xl p-5 text-xs text-zinc-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm">Private Staff Punch Links</h4>
              <p className="text-zinc-400 leading-relaxed">
                Each staff member receives a private, standalone attendance link tied to their unique token. 
                Staff can open this link on their mobile smartphone to punch IN and OUT without logging into the ERP system.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  placeholder="Search staff by name, username, or email..."
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 font-semibold outline-none focus:border-orange-500 text-xs"
                />
              </div>

              {isSuperAdmin && (
                <select
                  value={staffBranchFilter}
                  onChange={(e) => setStaffBranchFilter(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-zinc-800 font-semibold outline-none focus:border-orange-500 text-xs"
                >
                  <option value="all">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={fetchStaff}
              disabled={staffLoading}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Staff List"
            >
              <RefreshCw className={`w-4 h-4 ${staffLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Staff Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStaff.map(staff => {
              const staffBranch = branches.find(b => b.id === staff.branch_id);
              const attendanceLink = staff.attendance_token 
                ? `${window.location.origin}/attend/${staff.attendance_token}` 
                : '';
              const isCopied = copiedTokenId === staff.id;

              return (
                <div key={staff.id} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-zinc-300 transition-all">
                  
                  {/* Staff Info Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center font-black text-zinc-800 text-sm">
                        {staff.name ? staff.name.charAt(0).toUpperCase() : staff.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 text-sm leading-tight">{staff.name || staff.username}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="capitalize font-semibold text-orange-600">@{staff.username}</span>
                          <span>•</span>
                          <span className="capitalize">{staff.role.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-md block">
                        {staffBranch?.name || 'Colombo HQ'}
                      </span>
                    </div>
                  </div>

                  {/* Private Link Container */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <span>Private Attendance URL</span>
                      <span className="text-orange-600 font-mono">Token: {staff.attendance_token ? staff.attendance_token.slice(0, 8) + '...' : 'Missing'}</span>
                    </div>
                    <div className="font-mono text-[11px] text-zinc-800 bg-white p-2 rounded-lg border border-zinc-200 truncate select-all">
                      {attendanceLink || 'No token generated yet'}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100 text-xs">
                    
                    <div className="flex items-center gap-2">
                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(staff)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(staff)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer text-xs"
                        title="Share link via WhatsApp"
                      >
                        <Send className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>

                      {/* Test / Open Link */}
                      {attendanceLink && (
                        <a
                          href={attendanceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors inline-flex items-center"
                          title="Open Standalone Attendance Page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Regenerate Token Button */}
                    <button
                      type="button"
                      onClick={() => setRegenerateModalUser(staff)}
                      className="text-[11px] text-zinc-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-all font-semibold cursor-pointer"
                      title="Invalidate old link and issue new token"
                    >
                      Regenerate
                    </button>

                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* REGENERATE TOKEN CONFIRMATION MODAL */}
      {regenerateModalUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-zinc-900 text-base">Regenerate Attendance Token?</h4>
                <p className="text-[11px] text-zinc-500 font-medium">
                  For {regenerateModalUser.name || regenerateModalUser.username} (@{regenerateModalUser.username})
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Warning:</strong> Regenerating the attendance token will immediately invalidate the staff member's existing URL. You will need to share the newly generated link with them.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => setRegenerateModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleConfirmRegenerate}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isRegenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Confirm & Regenerate</span>
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
