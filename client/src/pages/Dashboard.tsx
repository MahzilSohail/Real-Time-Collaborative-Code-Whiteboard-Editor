import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentItem, DocumentType } from '../types';
import { api } from '../services/api';
import { Navbar } from '../components/common/Navbar';
import { useToast } from '../components/common/Toast';
import { SUPPORTED_LANGUAGES } from '../data/languageTemplates';
import { 
  Code2, 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  MoreVertical, 
  Copy, 
  Trash2, 
  Edit3, 
  Share2, 
  Users, 
  ExternalLink,
  X
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [ownedDocs, setOwnedDocs] = useState<DocumentItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'shared'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'code' | 'whiteboard'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DocumentType>('code');
  const [newLang, setNewLang] = useState('javascript');
  const [isCreating, setIsCreating] = useState(false);

  // Rename modal
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Active dropdown menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDocuments();
      setOwnedDocs(res.owned || []);
      setSharedDocs(res.shared || []);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to load documents.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await api.createDocument({
        title: newTitle.trim() || undefined as any,
        type: newType,
        language: newType === 'code' ? newLang : undefined,
      });
      addToast({ type: 'success', message: 'Document created successfully!' });
      setShowCreateModal(false);
      setNewTitle('');
      navigate(`/workspace/${res.document.id}`);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create document.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicate = async (doc: DocumentItem) => {
    try {
      const res = await api.duplicateDocument(doc.id);
      addToast({ type: 'success', message: 'Document duplicated!' });
      loadDocuments();
      setActiveMenuId(null);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to duplicate.' });
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editTitle.trim()) return;

    try {
      await api.updateDocument(editingDoc.id, { title: editTitle.trim() });
      addToast({ type: 'success', message: 'Document renamed.' });
      setEditingDoc(null);
      loadDocuments();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to rename.' });
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteDocument(doc.id);
      addToast({ type: 'info', message: 'Document deleted.' });
      loadDocuments();
      setActiveMenuId(null);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete.' });
    }
  };

  // Filtered & Sorted documents
  const displayedDocs = useMemo(() => {
    let list: DocumentItem[] = [];
    if (activeTab === 'all') {
      list = [...ownedDocs, ...sharedDocs];
    } else if (activeTab === 'owned') {
      list = ownedDocs;
    } else {
      list = sharedDocs;
    }

    if (typeFilter !== 'all') {
      list = list.filter((d) => d.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) => d.title.toLowerCase().includes(q) || (d.owner_name && d.owner_name.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'updated') return b.updated_at - a.updated_at;
      if (sortBy === 'created') return b.created_at - a.created_at;
      return a.title.localeCompare(b.title);
    });

    return list;
  }, [ownedDocs, sharedDocs, activeTab, typeFilter, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col" onClick={() => setActiveMenuId(null)}>
      <Navbar onCreateClick={() => setShowCreateModal(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              Workspaces & Documents
            </h1>
            <p className="text-xs text-slate-400">
              Manage your real-time collaborative code editors and whiteboard canvases.
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:shadow-indigo-600/50"
          >
            <Plus className="w-4 h-4" />
            <span>Create Document</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          {/* Tabs: All / Owned / Shared */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({ownedDocs.length + sharedDocs.length})
            </button>
            <button
              onClick={() => setActiveTab('owned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'owned'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Documents ({ownedDocs.length})
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'shared'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Shared with Me ({sharedDocs.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus-within:border-indigo-500 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-36 sm:w-48"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="code">Code Editors</option>
              <option value="whiteboard">Whiteboards</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="updated">Recently Modified</option>
              <option value="created">Recently Created</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : displayedDocs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No documents found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
              {searchQuery
                ? 'No documents matched your search filter. Try clearing the query.'
                : 'Create your first collaborative code editor or vector whiteboard to get started.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedDocs.map((doc) => {
              const isOwner = doc.role === 'owner';
              const isMenuOpen = activeMenuId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/workspace/${doc.id}`)}
                  className="group relative p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-indigo-500/50 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Type Icon & Role Badge & Dropdown */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                            doc.type === 'code'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {doc.type === 'code' ? (
                            <Code2 className="w-4 h-4" />
                          ) : (
                            <Layers className="w-4 h-4" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                          {doc.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                            doc.role === 'owner'
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              : doc.role === 'editor'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {doc.role}
                        </span>

                        {/* 3-dots Menu Button */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(isMenuOpen ? null : doc.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl p-1 z-30 text-xs">
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    setEditingDoc(doc);
                                    setEditTitle(doc.title);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-left"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Rename</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDuplicate(doc)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-left"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Duplicate</span>
                              </button>

                              {isOwner && (
                                <button
                                  onClick={() => handleDelete(doc)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Document Title */}
                    <h3 className="font-semibold text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-1 mb-1">
                      {doc.title}
                    </h3>

                    {/* Metadata & Creator */}
                    <div className="text-[11px] text-slate-500 mb-4">
                      {doc.owner_name && (
                        <span>By {doc.owner_name} • </span>
                      )}
                      <span>
                        {doc.type === 'code' ? doc.language.toUpperCase() : 'VECTOR CANVAS'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Footer Details */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{doc.collaborator_count || 1}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Create New Document</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Document Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType('code')}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                      newType === 'code'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-md'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Code2 className="w-6 h-6 mb-1 text-indigo-400" />
                    <span className="font-semibold text-xs">Code Editor</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Monaco syntax engine</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('whiteboard')}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                      newType === 'whiteboard'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-6 h-6 mb-1 text-emerald-400" />
                    <span className="font-semibold text-xs">Whiteboard</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Interactive vector canvas</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder={newType === 'code' ? 'e.g. Auth Controller' : 'e.g. System Architecture'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Language selection for code */}
              {newType === 'code' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Initial Language
                  </label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.ext})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50 mt-2"
              >
                {isCreating ? 'Creating Workspace...' : 'Create & Open'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rename Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-slate-100">
            <h3 className="text-base font-bold text-white mb-4">Rename Document</h3>
            <form onSubmit={handleRename} className="space-y-4">
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
