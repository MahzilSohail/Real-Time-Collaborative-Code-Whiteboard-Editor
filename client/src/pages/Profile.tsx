import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useToast } from '../components/common/Toast';
import { Navbar } from '../components/common/Navbar';
import { User, Palette, Image, Check, Save } from 'lucide-react';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
  '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6'
];

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [color, setColor] = useState(user?.color || '#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const res = await api.updateProfile({ name: name.trim(), avatar: avatar.trim() || undefined, color });
      updateUser(res.user);
      addToast({ type: 'success', message: 'Profile updated successfully!' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            User Profile Settings
          </h1>
          <p className="text-xs text-slate-400">
            Customize how you appear to teammates in real-time collaboration sessions.
          </p>
        </div>

        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Live Preview Avatar */}
            <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-xl ring-4 ring-slate-800"
                style={{ backgroundColor: color }}
              >
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  name ? name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div>
                <div className="font-semibold text-white text-base">{name || 'Your Name'}</div>
                <div className="text-xs text-slate-400">{user?.email}</div>
                <div className="text-[11px] text-slate-500 mt-1">Live collaborative cursor color</div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus-within:border-indigo-500">
                <User className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Avatar Image URL (Optional)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus-within:border-indigo-500">
                <Image className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Cursor & Presence Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Live Presence & Cursor Color
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-9 h-9 rounded-xl border border-slate-700 flex items-center justify-center transition-all ${
                      color === c ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
