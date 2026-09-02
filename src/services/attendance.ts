import { supabase } from '../lib/supabaseClient';
import { AttendanceLog, Branch, User } from '../types';

/**
 * Calculates distance in meters between two GPS coordinates using the Haversine formula
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Rounded to 1 decimal place
}

// In-memory fallback stores for offline or demo mode
let inMemoryAttendanceLogs: AttendanceLog[] = [
  {
    id: 'att-log-1',
    user_id: 'u-abi',
    user_name: 'abi',
    branch_id: 'b-banbalapitiya',
    branch_name: 'Banbalapitiya Branch',
    type: 'in',
    status: 'approved',
    latitude: 6.8925,
    longitude: 79.8558,
    distance_meters: 2.1,
    radius_meters: 5,
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  }
];

export interface StaffAttendanceInfo {
  user: User;
  branch: Branch | null;
  lastLog: AttendanceLog | null;
}

/**
 * Looks up a staff member and their branch using their private attendance token
 */
export const getStaffByAttendanceToken = async (
  token: string
): Promise<StaffAttendanceInfo | null> => {
  if (!token || !token.trim()) return null;
  const cleanToken = token.trim();

  if (!supabase) {
    // In-memory fallback
    const { getUsers } = await import('./users');
    const { getBranches } = await import('./branches');
    const users = await getUsers();
    const branches = await getBranches();

    // Match either exact token or fallback token for demo
    const user = users.find(
      u => u.attendance_token === cleanToken || (cleanToken === 'demo-token' && u.username === 'abi')
    );
    if (!user) return null;

    const branch = branches.find(b => b.id === user.branch_id) || null;
    const userLogs = inMemoryAttendanceLogs.filter(l => l.user_id === user.id);
    const lastLog = userLogs.length > 0 ? userLogs[0] : null;

    return { user, branch, lastLog };
  }

  try {
    // 1. Fetch user by attendance token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('attendance_token', cleanToken)
      .maybeSingle();

    if (userError || !user) {
      return null;
    }

    // 2. Fetch associated branch
    let branch: Branch | null = null;
    if (user.branch_id) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .eq('id', user.branch_id)
        .maybeSingle();
      branch = branchData || null;
    }

    // 3. Fetch user's latest attendance log
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastLog = logs && logs.length > 0 ? (logs[0] as AttendanceLog) : null;

    return {
      user: user as User,
      branch,
      lastLog
    };
  } catch (err) {
    console.error('Error fetching staff by attendance token:', err);
    return null;
  }
};

/**
 * Records an attendance log (IN or OUT, approved or denied)
 */
export const recordAttendanceLog = async (
  log: Omit<AttendanceLog, 'id' | 'created_at'>
): Promise<AttendanceLog> => {
  const newLog: AttendanceLog = {
    ...log,
    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    created_at: new Date().toISOString()
  };

  if (!supabase) {
    inMemoryAttendanceLogs.unshift(newLog);
    return newLog;
  }

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert([log])
      .select()
      .single();

    if (error) {
      console.error('Supabase error inserting attendance log, using local fallback:', error);
      inMemoryAttendanceLogs.unshift(newLog);
      return newLog;
    }

    return data as AttendanceLog;
  } catch (err) {
    console.error('Error recording attendance log:', err);
    inMemoryAttendanceLogs.unshift(newLog);
    return newLog;
  }
};

/**
 * Fetches attendance logs with optional branch and date filtering
 */
export const getAttendanceLogs = async (
  branchId?: string,
  dateFilter?: string
): Promise<AttendanceLog[]> => {
  if (!supabase) {
    let filtered = [...inMemoryAttendanceLogs];
    if (branchId && branchId !== 'all') {
      filtered = filtered.filter(l => l.branch_id === branchId);
    }
    if (dateFilter) {
      filtered = filtered.filter(l => l.created_at.startsWith(dateFilter));
    }
    return filtered;
  }

  try {
    let query = supabase
      .from('attendance_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    if (dateFilter) {
      // Start and end of specified date in ISO
      const start = `${dateFilter}T00:00:00.000Z`;
      const end = `${dateFilter}T23:59:59.999Z`;
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching attendance logs from Supabase:', error);
      return inMemoryAttendanceLogs;
    }

    return (data || []) as AttendanceLog[];
  } catch (err) {
    console.error('Failed to get attendance logs:', err);
    return inMemoryAttendanceLogs;
  }
};

/**
 * Regenerates the private attendance token for a staff user
 */
export const regenerateAttendanceToken = async (userId: string): Promise<string> => {
  const newToken = crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

  if (!supabase) {
    const { getUsers } = await import('./users');
    const users = await getUsers();
    const target = users.find(u => u.id === userId);
    if (target) {
      target.attendance_token = newToken;
    }
    return newToken;
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ attendance_token: newToken })
      .eq('id', userId);

    if (error) throw error;
    return newToken;
  } catch (err) {
    console.error('Error regenerating attendance token:', err);
    throw err;
  }
};
