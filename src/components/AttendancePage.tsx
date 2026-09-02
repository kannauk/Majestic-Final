import React, { useState, useEffect } from 'react';
import { 
  MapPin, Clock, CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, ShieldCheck, Navigation, ArrowRight, ArrowLeft,
  Building2, User as UserIcon, Radio, Sparkles
} from 'lucide-react';
import { 
  getStaffByAttendanceToken, 
  recordAttendanceLog, 
  calculateHaversineDistanceMeters,
  StaffAttendanceInfo 
} from '../services/attendance';
import majesticLogo from '../assets/images/majestic_logo_1780307785802.png';

interface AttendancePageProps {
  token: string;
}

export default function AttendancePage({ token }: AttendancePageProps) {
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffAttendanceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Punch Processing State
  const [punchingType, setPunchingType] = useState<'in' | 'out' | null>(null);
  const [punchResult, setPunchResult] = useState<{
    status: 'approved' | 'denied';
    message: string;
    distance?: number;
    radius?: number;
    timestamp: string;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch staff member by token
  const loadStaffInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffByAttendanceToken(token);
      if (!data) {
        setError('Invalid or expired attendance link. Please contact your Branch Administrator to issue a valid link.');
      } else {
        setStaffInfo(data);
      }
    } catch (err: any) {
      console.error('Failed to load staff info:', err);
      setError('Failed to connect to the attendance service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadStaffInfo();
    } else {
      setError('No attendance token provided in URL.');
      setLoading(false);
    }
  }, [token]);

  // Determine current attendance status:
  // If last log is 'in' and approved -> Checked In
  // Otherwise -> Not Checked In / Checked Out
  const isCurrentlyCheckedIn = staffInfo?.lastLog?.type === 'in' && staffInfo?.lastLog?.status === 'approved';

  // Handle Geolocation Punch (IN or OUT)
  const handlePunch = (type: 'in' | 'out') => {
    if (!staffInfo) return;
    setGeoError(null);
    setPunchResult(null);

    // Validate branch location setup
    const branch = staffInfo.branch;
    if (!branch) {
      setGeoError('No branch assigned to your staff profile. Please contact your Branch Admin.');
      return;
    }

    if (branch.latitude === undefined || branch.latitude === null || branch.longitude === undefined || branch.longitude === null) {
      setGeoError(`Branch location coordinates for "${branch.name}" have not been configured yet. Please ask your Branch Admin to set GPS coordinates in ERP Settings.`);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser or device. Please use a device with GPS enabled.');
      return;
    }

    setPunchingType(type);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const branchLat = Number(branch.latitude);
          const branchLng = Number(branch.longitude);
          const allowedRadius = branch.attendance_radius_meters && branch.attendance_radius_meters > 0 
            ? branch.attendance_radius_meters 
            : 5;

          // Calculate distance using Haversine formula
          const distanceMeters = calculateHaversineDistanceMeters(userLat, userLng, branchLat, branchLng);
          const isWithinRadius = distanceMeters <= allowedRadius;

          const status: 'approved' | 'denied' = isWithinRadius ? 'approved' : 'denied';

          // Save row to attendance_logs (both approved and denied for audit)
          const savedLog = await recordAttendanceLog({
            user_id: staffInfo.user.id,
            user_name: staffInfo.user.name || staffInfo.user.username,
            branch_id: branch.id,
            branch_name: branch.name,
            type,
            status,
            latitude: userLat,
            longitude: userLng,
            distance_meters: distanceMeters,
            radius_meters: allowedRadius
          });

          // Update local state if approved
          if (isWithinRadius) {
            setStaffInfo(prev => prev ? { ...prev, lastLog: savedLog } : null);
            setPunchResult({
              status: 'approved',
              message: `Successfully Checked ${type.toUpperCase()}! Your location was verified within ${distanceMeters}m of ${branch.name}.`,
              distance: distanceMeters,
              radius: allowedRadius,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
          } else {
            setPunchResult({
              status: 'denied',
              message: `You're ${distanceMeters}m away from ${branch.name}. You must be within ${allowedRadius}m to record attendance.`,
              distance: distanceMeters,
              radius: allowedRadius,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
          }
        } catch (recordErr: any) {
          console.error('Error saving attendance log:', recordErr);
          setGeoError('Failed to record attendance to server. Please retry.');
        } finally {
          setPunchingType(null);
        }
      },
      (positionError) => {
        setPunchingType(null);
        console.error('Geolocation error:', positionError);
        let msg = 'Unable to retrieve your location.';
        if (positionError.code === positionError.PERMISSION_DENIED) {
          msg = 'Location access was denied. Please allow location permissions in your browser settings to verify your attendance.';
        } else if (positionError.code === positionError.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable. Please ensure your device GPS/Location is enabled and try again.';
        } else if (positionError.code === positionError.TIMEOUT) {
          msg = 'Location request timed out. Please check your GPS signal and tap to retry.';
        }
        setGeoError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#090A0C] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden selection:bg-orange-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card container */}
      <div className="w-full max-w-md bg-[#12141A] border border-[#1F242D] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F242D]">
          <div className="flex items-center gap-3">
            <img 
              src={majesticLogo} 
              alt="Majestic Computers" 
              className="w-10 h-10 object-cover rounded-xl shadow-md border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase leading-none">
                Majestic <span className="text-zinc-400">Computers</span>
              </h1>
              <p className="text-[10px] font-bold tracking-widest text-[#00E5FF] uppercase leading-none mt-1">
                Geo Attendance Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1A1D24] text-zinc-300 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-zinc-700/50">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>GPS Active</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-xs font-semibold text-zinc-400">Verifying staff credentials...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Access Link Invalid</h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">{error}</p>
            </div>
            <button
              onClick={loadStaffInfo}
              className="mt-2 flex items-center gap-2 bg-[#1E222B] hover:bg-[#282D39] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
          </div>
        ) : staffInfo ? (
          /* Staff Attendance Main View */
          <div className="space-y-6">
            
            {/* Staff & Branch Profile Banner */}
            <div className="bg-[#181B22] border border-[#232936] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-black text-sm shadow-md">
                    {staffInfo.user.name ? staffInfo.user.name.charAt(0).toUpperCase() : staffInfo.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white leading-tight">
                      {staffInfo.user.name || staffInfo.user.username}
                    </h2>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <UserIcon className="w-3 h-3 text-orange-400 inline" />
                      <span className="capitalize">{staffInfo.user.role.replace('_', ' ')}</span>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                  isCurrentlyCheckedIn
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isCurrentlyCheckedIn ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                  {isCurrentlyCheckedIn ? 'Checked In' : 'Not Checked In'}
                </div>
              </div>

              {/* Branch Details */}
              <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                  <span className="truncate max-w-[200px]">{staffInfo.branch?.name || 'No Branch Assigned'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>Radius: {staffInfo.branch?.attendance_radius_meters || 5}m</span>
                </div>
              </div>
            </div>

            {/* Live Clock & Date */}
            <div className="text-center py-2 space-y-1">
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs text-zinc-400 font-medium flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>
                  {currentTime.toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            </div>

            {/* Geo Error / Notification Banner */}
            {geoError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{geoError}</div>
              </div>
            )}

            {/* Punch Result Feedback Card */}
            {punchResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 animate-in zoom-in-95 duration-200 ${
                punchResult.status === 'approved'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center justify-between font-black text-sm">
                  <span className="flex items-center gap-1.5">
                    {punchResult.status === 'approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    {punchResult.status === 'approved' ? 'Attendance Approved' : 'Attendance Denied (Out of Range)'}
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{punchResult.timestamp}</span>
                </div>
                <p className="text-[11.5px] leading-relaxed opacity-90">{punchResult.message}</p>
                {punchResult.distance !== undefined && (
                  <div className="pt-1 text-[10.5px] flex items-center gap-2 opacity-80">
                    <span>Measured Distance: <strong>{punchResult.distance}m</strong></span>
                    <span>•</span>
                    <span>Allowed: <strong>≤ {punchResult.radius}m</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Two Big Punch Buttons: IN and OUT */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* CHECK IN BUTTON */}
              <button
                type="button"
                onClick={() => handlePunch('in')}
                disabled={punchingType !== null || isCurrentlyCheckedIn}
                className={`py-5 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-black transition-all cursor-pointer shadow-lg active:scale-95 ${
                  isCurrentlyCheckedIn
                    ? 'bg-zinc-800/40 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                    : punchingType === 'in'
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-950/50 hover:shadow-emerald-900/50'
                }`}
              >
                {punchingType === 'in' ? (
                  <>
                    <RefreshCw className="w-7 h-7 animate-spin" />
                    <span className="text-xs uppercase tracking-wider">Locating GPS...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-7 h-7" />
                    <span className="text-sm sm:text-base uppercase tracking-wider">PUNCH IN</span>
                    <span className="text-[10px] font-medium opacity-80">Start Shift</span>
                  </>
                )}
              </button>

              {/* CHECK OUT BUTTON */}
              <button
                type="button"
                onClick={() => handlePunch('out')}
                disabled={punchingType !== null || !isCurrentlyCheckedIn}
                className={`py-5 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-black transition-all cursor-pointer shadow-lg active:scale-95 ${
                  !isCurrentlyCheckedIn
                    ? 'bg-zinc-800/40 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                    : punchingType === 'out'
                    ? 'bg-orange-600 text-white animate-pulse'
                    : 'bg-gradient-to-br from-orange-600 to-rose-700 hover:from-orange-500 hover:to-rose-600 text-white shadow-orange-950/50 hover:shadow-orange-900/50'
                }`}
              >
                {punchingType === 'out' ? (
                  <>
                    <RefreshCw className="w-7 h-7 animate-spin" />
                    <span className="text-xs uppercase tracking-wider">Locating GPS...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-7 h-7" />
                    <span className="text-sm sm:text-base uppercase tracking-wider">PUNCH OUT</span>
                    <span className="text-[10px] font-medium opacity-80">End Shift</span>
                  </>
                )}
              </button>

            </div>

            {/* Verification Note */}
            <div className="pt-2 text-center">
              <p className="text-[10.5px] text-zinc-500 leading-relaxed flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Geofenced punch verifies your real-time presence at the branch showroom.</span>
              </p>
            </div>

          </div>
        ) : null}

        {/* Footer info */}
        <div className="pt-4 border-t border-[#1F242D] text-center text-[10px] text-zinc-600">
          Majestic Computers ERP &bull; Geolocation Attendance System
        </div>

      </div>
    </div>
  );
}
