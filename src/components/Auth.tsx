import React, { useState, useEffect } from 'react';
import { 
  Lock, Mail, ChevronRight
} from 'lucide-react';
import { User, Branch } from '../types';
import { getUsers } from '../services/users';
import { getBranches } from '../services/branches';
import majesticLogo from '../assets/images/majestic_logo_1780307785802.png';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [preloadedUsers, setPreloadedUsers] = useState<User[]>([]);

  useEffect(() => {
    Promise.all([
      getBranches(),
      getUsers()
    ]).then(([b, u]) => {
      setBranches(b.length > 0 ? b : [
        { id: 'b-banbalapitiya', name: 'Banbalapitiya Branch', location: 'No. 320, Galle Road, Banbalapitiya', code: 'BAN-01', phone: '+94 11 258 1234', email: 'banbalapitiya@majestic.com', created_at: '2026-01-10T08:00:00Z' },
        { id: 'b-dematagoda', name: 'Dematagoda Branch', location: 'No. 54, Baseline Road, Dematagoda', code: 'DEM-02', phone: '+94 11 268 5678', email: 'dematagoda@majestic.com', created_at: '2026-01-15T08:00:00Z' }
      ]);
      setPreloadedUsers(u.length > 0 ? u : [
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
          password: 'abi@2026'
        }
      ]);
    }).catch(() => {
      setBranches([
        { id: 'b-banbalapitiya', name: 'Banbalapitiya Branch', location: 'No. 320, Galle Road, Banbalapitiya', code: 'BAN-01', phone: '+94 11 258 1234', email: 'banbalapitiya@majestic.com', created_at: '2026-01-10T08:00:00Z' },
        { id: 'b-dematagoda', name: 'Dematagoda Branch', location: 'No. 54, Baseline Road, Dematagoda', code: 'DEM-02', phone: '+94 11 268 5678', email: 'dematagoda@majestic.com', created_at: '2026-01-15T08:00:00Z' }
      ]);
      setPreloadedUsers([
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
          password: 'abi@2026'
        }
      ]);
    });
  }, []);

  // Handle direct manual login click
  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      alert('Kindly fill in both your email address/username and system access password.');
      return;
    }

    const matched = preloadedUsers.find(
      u => u.email.toLowerCase().trim() === emailInput.toLowerCase().trim() ||
           u.username.toLowerCase().trim() === emailInput.toLowerCase().trim()
    );

    if (matched) {
      if (matched.password && matched.password !== passwordInput) {
        alert('Incorrect password. Please enter the correct password for your profile.');
        return;
      }
      // Trigger login callback
      onLoginSuccess(matched);
    } else {
      alert('Invalid staff credentials. Please check your username/email and password.');
    }
  };

  // Handle shortcut role-switches (POS ERP evaluation magic!)
  const handleShortcutLogin = (userObj: User) => {
    onLoginSuccess(userObj);
  };

  // Reset password workflow dispatch mockup
  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      alert('Fill in email first.');
      return;
    }
    setStatusMsg(`Security password recovery link transmitted to registered mailbox ${emailInput}. Check inbox/spam drawers.`);
    setTimeout(() => {
      setStatusMsg(null);
      setIsForgotPassword(false);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 border border-zinc-150" id="login-module-auth">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        {/* Visual Brand Icon */}
        <div className="mx-auto h-16 w-16 rounded-2xl bg-zinc-950 p-1 flex items-center justify-center scale-110 shadow-xl border border-zinc-200/50">
          <img 
            src={majesticLogo} 
            alt="Majestic Logo" 
            className="w-full h-full object-cover rounded-xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight font-sans">
          Majestic ERP Showroom Terminal
        </h2>
        <p className="text-xs text-zinc-500 font-medium">
          Sign In below to access point-of-sale desks, workshop repairs and inventory channels.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-6 border border-zinc-200/80 shadow-sm rounded-3xl space-y-6">
          
          {statusMsg && (
            <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-xs font-semibold text-indigo-755 leading-normal">
              {statusMsg}
            </div>
          )}

          {!isForgotPassword ? (
            /* Direct Email/Pass form */
            <form onSubmit={handleManualLogin} className="space-y-4 text-xs font-semibold text-zinc-700" id="manual-login-form">
              <div>
                <label className="text-zinc-500 block mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Staff Corporate Email / Username:
                </label>
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-505"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 items-center">
                  <label className="text-zinc-500 block flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    Access Code / Password:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[10px] text-indigo-650 hover:underline hover:text-indigo-755 font-bold"
                  >
                    Forgot Credentials?
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-indigo-505"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-950 font-bold hover:bg-zinc-800 text-white py-2.5 rounded-xl uppercase tracking-wider text-[11px] transition-all flex items-center justify-center gap-1 btn shadow-sm cursor-pointer"
              >
                <span>Authorize Credentials</span>
                <ChevronRight className="w-4 h-4 text-indigo-400" />
              </button>
            </form>
          ) : (
            /* Forgot password screen */
            <div className="space-y-4 text-xs font-semibold text-zinc-705" id="forgot-password-form">
              <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-indigo-900 space-y-1">
                <span className="font-extrabold uppercase text-[10px] tracking-wider block">Credential Recovery Center</span>
                <p className="text-[11px] font-medium leading-relaxed">
                  Enter your registered corporate email or username below to receive a password reset link.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                <div>
                  <label className="text-zinc-500 block mb-1">Corporate Email / Username:</label>
                  <input
                    type="text"
                    placeholder="e.g. staff@majestic.com or username"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-505"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                  >
                    Send Recovery Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 border text-zinc-700 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* System troubleshooter helper */}
          <div className="border-t border-zinc-150 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                if (confirm("Refresh terminal connection and reload data?")) {
                  window.location.reload();
                }
              }}
              className="text-[10px] text-zinc-400 hover:text-red-500 font-semibold tracking-wider uppercase transition-colors cursor-pointer"
            >
              ⚙️ Refresh Connection & Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
