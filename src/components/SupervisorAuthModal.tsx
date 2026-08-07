import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound, X, CheckCircle } from 'lucide-react';
import { getUsers } from '../services/users';
import { UserRole } from '../types';

interface SupervisorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authorizedByName: string) => void;
  actionLabel: string;
  requiredRoles?: UserRole[];
}

export default function SupervisorAuthModal({
  isOpen,
  onClose,
  onSuccess,
  actionLabel,
  requiredRoles = ['super_admin', 'branch_admin']
}: SupervisorAuthModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Please fill in both username/email and security pin/password.');
      return;
    }

    try {
      const users = await getUsers();
      // Find matching manager
      const matched = users.find(u => 
        (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()) &&
        u.password === password
      );

      if (!matched) {
        setError('Invalid username or password.');
        return;
      }

      // Verify role level authentication
      if (!requiredRoles.includes(matched.role)) {
        setError(`Access Denied: User "${matched.name}" does not possess sufficient authority level (${requiredRoles.map(r => r.replace('_', ' ')).join('/')} required).`);
        return;
      }

      // Auth succeeded!
      onSuccess(matched.name);
      // Reset state
      setUsername('');
      setPassword('');
      setError(null);
    } catch (err) {
      console.error('Supervisor auth error:', err);
      setError('Authentication failed. Please check connection.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in" id="supervisor-auth-modal">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-zinc-200">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-xl text-amber-600">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 leading-tight">Supervisor Verification</h4>
              <p className="text-[10px] text-zinc-400">High-privilege authorization requested</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-zinc-400 font-bold hover:text-zinc-900 hover:bg-zinc-100 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-zinc-650">
          <p className="leading-normal">
            You are attempting to <strong className="text-zinc-900">{actionLabel}</strong>. 
            This operation requires authorization from a manager or system administrator.
          </p>
          <div className="bg-amber-50/60 border border-amber-100 p-2.5 rounded-xl text-[10.5px] leading-relaxed text-amber-700 flex gap-2">
            <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Please request an authorized manager to enter their credentials below to override and approve this transaction.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 font-bold rounded-xl text-[11px] leading-tight">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="text-zinc-500 font-bold block mb-1">Manager Username or Email:</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-1.5 outline-none font-semibold text-zinc-800"
                placeholder="e.g. abi"
                required
              />
              <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-2" />
            </div>
          </div>

          <div>
            <label className="text-zinc-500 font-bold block mb-1">Manager Access Password:</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-1.5 outline-none font-semibold text-zinc-800 tracking-wider"
                placeholder="••••"
                required
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-900 hover:bg-zinc-850 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Authorize Transaction
          </button>
        </form>
      </div>
    </div>
  );
}
