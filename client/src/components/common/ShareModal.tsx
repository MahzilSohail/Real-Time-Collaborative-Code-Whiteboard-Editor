import React, { useState } from 'react';
import { Collaborator, AccessLevel } from '../../types';
import { api } from '../../services/api';
import { useToast } from './Toast';
import { copyToClipboard } from '../../utils/clipboard';
import { 
  X, 
  Copy, 
  Check, 
  UserPlus, 
  Shield, 
  Trash2, 
  Link as LinkIcon,
  Globe,
  Lock,
  Eye
} from 'lucide-react';

interface ShareModalProps {
  documentId: string;
  documentTitle: string;
  isOwner: boolean;
  accessLevel?: AccessLevel;
  collaborators: Collaborator[];
  onClose: () => void;
  onCollaboratorsUpdated: (collabs: Collaborator[]) => void;
  onAccessLevelUpdated?: (level: AccessLevel) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  documentId,
  documentTitle,
  isOwner,
  accessLevel = 'link_edit',
  collaborators,
  onClose,
  onCollaboratorsUpdated,
  onAccessLevelUpdated,
}) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [currentAccess, setCurrentAccess] = useState<AccessLevel>(accessLevel);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Canonical share URL using exact current origin (works seamlessly on localhost and live production domain)
  const shareUrl = `${window.location.origin}/workspace/${documentId}`;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    setCopied(true);
    addToast({
      type: success ? 'success' : 'info',
      message: success ? 'Workspace link copied to clipboard!' : 'Link selected! Press Ctrl+C to copy.'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccessChange = async (newLevel: AccessLevel) => {
    try {
      await api.updateAccessLevel(documentId, newLevel);
      setCurrentAccess(newLevel);
      if (onAccessLevelUpdated) onAccessLevelUpdated(newLevel);
      addToast({ type: 'success', message: 'Access settings updated.' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update access level.' });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      addToast({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.shareDocument(documentId, { email, role });
      addToast({ type: 'success', message: res.message });
      setEmail('');
      onCollaboratorsUpdated(res.collaborators);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to share document.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: 'editor' | 'viewer') => {
    try {
      await api.updateCollaboratorRole(documentId, targetUserId, newRole);
      const updated = collaborators.map((c) =>
        c.user_id === targetUserId ? { ...c, role: newRole } : c
      );
      onCollaboratorsUpdated(updated);
      addToast({ type: 'success', message: `Collaborator updated to ${newRole}.` });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update role.' });
    }
  };

  const handleRemove = async (targetUserId: string) => {
    try {
      await api.removeCollaborator(documentId, targetUserId);
      const updated = collaborators.filter((c) => c.user_id !== targetUserId);
      onCollaboratorsUpdated(updated);
      addToast({ type: 'info', message: 'Collaborator removed.' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to remove collaborator.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          Share "{documentTitle}"
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          Manage general link permissions or invite specific teammates.
        </p>

        {/* General Access Selector */}
        <div className="mb-5 p-3.5 rounded-xl bg-slate-950 border border-slate-800/90">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              {currentAccess === 'link_edit' ? (
                <Globe className="w-4 h-4 text-emerald-400" />
              ) : currentAccess === 'link_view' ? (
                <Eye className="w-4 h-4 text-indigo-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span>General Link Access</span>
            </div>

            {isOwner ? (
              <select
                value={currentAccess}
                onChange={(e) => handleAccessChange(e.target.value as AccessLevel)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="link_edit">Anyone with link can edit</option>
                <option value="link_view">Anyone with link can view</option>
                <option value="restricted">Restricted (Invited only)</option>
              </select>
            ) : (
              <span className="text-xs font-medium text-slate-400 capitalize">
                {currentAccess === 'link_edit'
                  ? 'Anyone can edit'
                  : currentAccess === 'link_view'
                  ? 'Anyone can view'
                  : 'Restricted'}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {currentAccess === 'link_edit' && 'Anyone on the web who has this link can edit directly without invitation.'}
            {currentAccess === 'link_view' && 'Anyone with this link can view in real-time.'}
            {currentAccess === 'restricted' && 'Only people explicitly invited below can open this link.'}
          </div>
        </div>

        {/* Direct Link Copy */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Shareable Workspace URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 group hover:border-slate-700 transition-colors">
              <LinkIcon className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => {
                  e.currentTarget.select();
                  handleCopyLink();
                }}
                className="bg-transparent border-none outline-none w-full text-slate-200 cursor-pointer select-all font-mono text-[11px]"
                title="Click anywhere to copy link"
              />
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-sm shrink-0 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Invite by Email */}
        {isOwner && (
          <form onSubmit={handleInvite} className="mb-5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Invite by Email
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="colleague@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors disabled:opacity-50 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>
            </div>
          </form>
        )}

        {/* Collaborators List */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Active Collaborators ({collaborators.length})
          </label>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {collaborators.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center bg-slate-950/40 rounded-xl border border-slate-800/50">
                No external collaborators yet. Share the link or invite teammates above!
              </div>
            ) : (
              collaborators.map((c) => (
                <div
                  key={c.id || c.user_id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                      style={{ backgroundColor: c.color || '#6366f1' }}
                    >
                      {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-slate-200 truncate">{c.name || c.email}</div>
                      <div className="text-[11px] text-slate-500 truncate">{c.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner ? (
                      <>
                        <select
                          value={c.role}
                          onChange={(e) => handleRoleChange(c.user_id, e.target.value as any)}
                          className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300 focus:outline-none"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemove(c.user_id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove collaborator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {c.role}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
