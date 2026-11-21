import React, { useState } from 'react';
import { DocumentVersion } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';
import { 
  History, 
  RotateCcw, 
  Eye, 
  Plus, 
  X, 
  Clock, 
  User, 
  FileCode,
  Layers
} from 'lucide-react';

interface VersionTimelineProps {
  documentId: string;
  documentType: 'code' | 'whiteboard';
  versions: DocumentVersion[];
  isViewer: boolean;
  isOpen: boolean;
  onClose: () => void;
  onVersionRestored: (version: any) => void;
  onSnapshotCreated: (version: DocumentVersion) => void;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
  documentId,
  documentType,
  versions,
  isViewer,
  isOpen,
  onClose,
  onVersionRestored,
  onSnapshotCreated,
}) => {
  const { addToast } = useToast();
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await api.createSnapshot(documentId, snapshotDesc || undefined);
      addToast({ type: 'success', message: res.message });
      onSnapshotCreated(res.version);
      setSnapshotDesc('');
      setShowCreateForm(false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create snapshot.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (version: DocumentVersion) => {
    if (isViewer) {
      addToast({ type: 'error', message: 'Viewers cannot restore versions.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to restore document to Version ${version.version_number}? A new snapshot will be created preserving full history.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await api.restoreVersion(documentId, version.id);
      addToast({ type: 'success', message: res.message });
      onVersionRestored(res);
      setPreviewVersion(null);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to restore version.' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col h-full shadow-2xl z-30 shrink-0 animate-in slide-in-from-right">
        {/* Header */}
        <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
            <History className="w-4 h-4 text-indigo-400" />
            <span>Version Timeline</span>
            <span className="text-[11px] font-normal text-slate-400">({versions.length})</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action button */}
        {!isViewer && (
          <div className="p-3 border-b border-slate-800 bg-slate-900/30">
            {showCreateForm ? (
              <form onSubmit={handleCreateSnapshot} className="space-y-2">
                <input
                  type="text"
                  placeholder="Snapshot label (e.g., Sprint demo)..."
                  value={snapshotDesc}
                  onChange={(e) => setSnapshotDesc(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    Save Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save Manual Milestone</span>
              </button>
            )}
          </div>
        )}

        {/* Timeline Version List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {versions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No version snapshots recorded yet. Changes will auto-save snapshots every 30s or 50 edits.
            </div>
          ) : (
            versions.map((ver, idx) => (
              <div
                key={ver.id}
                className="relative pl-6 pb-2 border-l border-slate-800 last:border-none group"
              >
                {/* Timeline node icon */}
                <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-indigo-500 group-hover:scale-125 transition-transform flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-indigo-400">
                      Version {ver.version_number}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-200 font-medium line-clamp-2 mb-2">
                    {ver.description || `Snapshot v${ver.version_number}`}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                    <div className="flex items-center gap-1 truncate pr-1">
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{ver.author_name || 'System'}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-500">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => setPreviewVersion(ver)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      <Eye className="w-3 h-3 text-indigo-400" />
                      <span>Preview</span>
                    </button>

                    {!isViewer && (
                      <button
                        onClick={() => handleRestore(ver)}
                        disabled={isRestoring}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-[11px] text-indigo-300 border border-indigo-500/30 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3 text-indigo-400" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Version Preview Modal */}
      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in-50">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col text-slate-100 overflow-hidden">
            <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                {documentType === 'code' ? (
                  <FileCode className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Layers className="w-5 h-5 text-indigo-400" />
                )}
                <div>
                  <div className="font-semibold text-sm text-white">
                    Previewing Version {previewVersion.version_number} (Read Only)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Saved by {previewVersion.author_name} on {new Date(previewVersion.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isViewer && (
                  <button
                    onClick={() => handleRestore(previewVersion)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore This Version</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewVersion(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-950/70 font-mono text-xs">
              {documentType === 'code' ? (
                <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                  {previewVersion.content}
                </pre>
              ) : (
                <div className="text-slate-300">
                  <div className="text-xs text-slate-400 mb-2 font-sans">
                    Whiteboard Vector Objects ({(() => {
                      try { return JSON.parse(previewVersion.content).length; } catch { return 0; }
                    })()} elements):
                  </div>
                  <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300 max-h-96 overflow-auto">
                    {previewVersion.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
