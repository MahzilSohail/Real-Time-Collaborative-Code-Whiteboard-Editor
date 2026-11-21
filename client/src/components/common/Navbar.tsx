import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  Code2, 
  Layers, 
  LogOut, 
  User as UserIcon, 
  Mail, 
  Plus, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  onCreateClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreateClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);

  useEffect(() => {
    if (showMailbox) {
      api.getEmailHistory().then((res) => setRecentEmails(res.emails || [])).catch(() => {});
    }
  }, [showMailbox]);

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand Logo */}
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-slate-100 font-bold tracking-tight text-lg group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            CollabSpace
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Realtime
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            Dashboard
          </Link>
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50"
          >
            <Plus className="w-4 h-4" />
            <span>New Document</span>
          </button>
        )}

        {/* Email Notification / Outbox preview for testing invites */}
        <div className="relative">
          <button
            onClick={() => setShowMailbox(!showMailbox)}
            title="Recent Sent Emails & Invitations"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors relative"
          >
            <Mail className="w-4 h-4" />
            {recentEmails.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950"></span>
            )}
          </button>

          {showMailbox && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-3 z-50 text-slate-200 animate-in fade-in-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="font-semibold text-xs tracking-wider uppercase text-slate-400">
                  Email Dispatch Log
                </span>
                <span className="text-xs text-slate-500">Live invites & resets</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {recentEmails.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No emails dispatched yet. Invite collaborators or test forgot password to view records here.
                  </div>
                ) : (
                  recentEmails.map((mail) => (
                    <div key={mail.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between font-medium text-slate-300 mb-1">
                        <span className="truncate pr-2">{mail.subject}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mb-1.5">To: {mail.to}</div>
                      {mail.previewUrl && (
                        <a
                          href={mail.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                        >
                          View Ethereal Email Preview <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-inner"
                style={{ backgroundColor: user.color || '#6366f1' }}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-lg object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-200 max-w-[120px] truncate">
                {user.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-1.5 z-50 animate-in fade-in-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="font-semibold text-xs text-slate-200">{user.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>Profile Settings</span>
                </Link>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
