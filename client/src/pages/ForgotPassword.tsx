import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../components/common/Toast';
import { Layers, ArrowLeft, Mail, ExternalLink } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setSubmitted(true);
      if (res.resetUrl) {
        setResetUrl(res.resetUrl);
      }
      addToast({ type: 'success', message: res.message });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Request failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Reset Password
          </h1>
          <p className="text-xs text-slate-400">
            Enter your email to receive password reset instructions
          </p>
        </div>

        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                A password reset link has been dispatched to <strong>{email}</strong>.
              </div>

              {resetUrl && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Direct Reset Link:
                  </div>
                  <a
                    href={resetUrl}
                    className="text-xs text-indigo-400 hover:underline flex items-center gap-1 break-all"
                  >
                    <span>{resetUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus-within:border-indigo-500">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="email"
                    required
                    placeholder="user@simplera.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50"
              >
                <span>{isLoading ? 'Sending...' : 'Send Reset Link'}</span>
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
