import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useToast } from '../components/common/Toast';
import { 
  DocumentItem, 
  Collaborator, 
  DocumentVersion, 
  ChatMessage, 
  ActiveUser, 
  WhiteboardElement 
} from '../types';

import { CodeEditor } from '../components/editor/CodeEditor';
import { Whiteboard } from '../components/whiteboard/Whiteboard';
import { PresenceBar } from '../components/workspace/PresenceBar';
import { LiveCursors } from '../components/workspace/LiveCursors';
import { ChatPanel } from '../components/workspace/ChatPanel';
import { VersionTimeline } from '../components/workspace/VersionTimeline';
import { ShareModal } from '../components/common/ShareModal';

import { 
  ArrowLeft, 
  Share2, 
  History, 
  MessageSquare, 
  Check, 
  Clock, 
  Code2, 
  Layers, 
  Wifi, 
  WifiOff, 
  AlertCircle 
} from 'lucide-react';

export const Workspace: React.FC = () => {
  const { id: docId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<any[]>([]);

  // Whiteboard parsed elements
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);

  // Network & Sync status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');

  // UI Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Workspace container ref
  const workspaceRef = useRef<HTMLDivElement>(null);
  const cursorThrottleRef = useRef<number>(0);
  const saveDebounceRef = useRef<any>(null);
  const offlinePendingRef = useRef<{
    hasPending: boolean;
    content?: string;
    language?: string;
    whiteboardElements?: WhiteboardElement[];
  }>({ hasPending: false });

  const isOwner = document?.role === 'owner';
  const isViewer = document?.role === 'viewer';

  // Load initial document data & versions
  const loadDocumentDetails = useCallback(async () => {
    if (!docId) return;
    try {
      const res = await api.getDocument(docId);
      setDocument(res.document);
      setCollaborators(res.collaborators || []);

      if (res.document.type === 'whiteboard') {
        try {
          const parsed = JSON.parse(res.document.content || '[]');
          setWhiteboardElements(Array.isArray(parsed) ? parsed : []);
        } catch {
          setWhiteboardElements([]);
        }
      }

      // Fetch version history
      const verRes = await api.getVersions(docId);
      setVersions(verRes.versions || []);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to load document.' });
      navigate('/dashboard');
    }
  }, [docId, navigate, addToast]);

  useEffect(() => {
    loadDocumentDetails();
  }, [loadDocumentDetails]);

  // Network offline/online listeners with automatic pending edits synchronization
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSaveStatus('saving');

      // Check for pending offline edits in memory or localStorage
      const pending = offlinePendingRef.current;
      const storedCode = docId ? localStorage.getItem(`offline_code_${docId}`) : null;
      const storedWb = docId ? localStorage.getItem(`offline_wb_${docId}`) : null;

      const codeToSync = pending.content || storedCode;
      const wbToSync = pending.whiteboardElements || (storedWb ? JSON.parse(storedWb) : null);

      if (pending.hasPending || codeToSync || wbToSync) {
        try {
          if (codeToSync && docId) {
            await api.updateDocument(docId, { content: codeToSync, language: pending.language });
            const socket = getSocket();
            socket.emit('code:change', { docId, content: codeToSync, language: pending.language });
            localStorage.removeItem(`offline_code_${docId}`);
          }
          if (wbToSync && docId) {
            const socket = getSocket();
            socket.emit('whiteboard:change', { elements: wbToSync, action: 'sync' });
            localStorage.removeItem(`offline_wb_${docId}`);
          }
          offlinePendingRef.current = { hasPending: false };
          setSaveStatus('saved');
          addToast({ type: 'success', message: 'Reconnected! Local offline changes synced to server.' });
        } catch (e) {
          console.error('Failed to sync offline edits:', e);
          setSaveStatus('saved');
        }
      } else {
        setSaveStatus('saved');
        addToast({ type: 'success', message: 'Connection restored. Synced with server.' });
        loadDocumentDetails();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('offline');
      addToast({ type: 'info', message: 'You are currently offline. Edits are safely stored locally and will sync on reconnect.' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, loadDocumentDetails, docId]);

  // Setup Real-time WebSocket connection
  useEffect(() => {
    if (!docId || !user) return;

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const joinRoom = () => {
      socket.emit('doc:join', { docId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.connect();
    }
    socket.on('connect', joinRoom);

    // Listen for presence updates
    socket.on('presence:update', (users: ActiveUser[]) => {
      setActiveUsers(users);
    });

    // Listen for peer cursor movements
    socket.on('cursor:update', (data: any) => {
      setRemoteCursors((prev) => {
        const filtered = prev.filter((c) => c.socketId !== data.socketId);
        return [...filtered, data];
      });
    });

    socket.on('cursor:remove', (data: { socketId: string }) => {
      setRemoteCursors((prev) => prev.filter((c) => c.socketId !== data.socketId));
    });

    // Listen for real-time code updates from peers
    socket.on('code:update', (data: { content: string; language: string; updatedBy: any }) => {
      setDocument((prev) => {
        if (!prev) return prev;
        return { ...prev, content: data.content, language: data.language };
      });
    });

    // Listen for real-time whiteboard updates from peers
    socket.on('whiteboard:update', (data: { elements: WhiteboardElement[]; action?: string }) => {
      setWhiteboardElements(data.elements);
    });

    // Listen for chat messages
    socket.on('chat:history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((count) => count + 1);
      }
    });

    // Listen for version restore reload
    socket.on('doc:reloaded', (data: { versionNumber: number; content: string; language: string; restoredBy: string }) => {
      setDocument((prev) => {
        if (!prev) return prev;
        return { ...prev, content: data.content, language: data.language };
      });

      if (document?.type === 'whiteboard') {
        try {
          setWhiteboardElements(JSON.parse(data.content || '[]'));
        } catch {}
      }

      // Refresh versions
      api.getVersions(docId).then((r) => setVersions(r.versions || []));
    });

    // Listen for toast notifications (User join, leave, restore)
    socket.on('notification:toast', (toastData: { type: string; message: string }) => {
      addToast({
        type: toastData.type === 'leave' ? 'info' : 'success',
        message: toastData.message,
      });
    });

    // Server-side forbidden handler
    socket.on('error:forbidden', (err: { message: string }) => {
      addToast({ type: 'error', message: err.message });
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.emit('doc:leave');
      socket.off('presence:update');
      socket.off('cursor:update');
      socket.off('cursor:remove');
      socket.off('code:update');
      socket.off('whiteboard:update');
      socket.off('chat:history');
      socket.off('chat:message');
      socket.off('doc:reloaded');
      socket.off('notification:toast');
      socket.off('error:forbidden');
    };
  }, [docId, user, addToast, isChatOpen, document?.type]);

  // Code change emitter
  const handleCodeChange = (newContent: string) => {
    if (isViewer || !document) return;

    setDocument((prev) => (prev ? { ...prev, content: newContent } : prev));

    if (!navigator.onLine || !isOnline) {
      setSaveStatus('offline');
      offlinePendingRef.current = {
        ...offlinePendingRef.current,
        hasPending: true,
        content: newContent,
        language: document.language,
      };
      try {
        localStorage.setItem(`offline_code_${document.id}`, newContent);
      } catch {}
      return;
    }

    setSaveStatus('saving');

    const socket = getSocket();
    socket.emit('code:change', {
      docId: document.id,
      content: newContent,
      language: document.language,
    });

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await api.updateDocument(document.id, { content: newContent, language: document.language });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to auto-save document:', err);
      }
    }, 800);
  };

  // Language change emitter
  const handleLanguageChange = async (newLang: string) => {
    if (isViewer || !document) return;

    setDocument((prev) => (prev ? { ...prev, language: newLang } : prev));
    setSaveStatus('saving');
    try {
      await api.updateDocument(document.id, { content: document.content, language: newLang });
      const socket = getSocket();
      socket.emit('code:change', {
        docId: document.id,
        content: document.content,
        language: newLang,
      });
      setSaveStatus('saved');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    }
  };

  // Whiteboard change emitter
  const handleWhiteboardChange = (elements: WhiteboardElement[], action?: string) => {
    if (isViewer) return;

    setWhiteboardElements(elements);

    if (!navigator.onLine || !isOnline) {
      setSaveStatus('offline');
      offlinePendingRef.current = {
        ...offlinePendingRef.current,
        hasPending: true,
        whiteboardElements: elements,
      };
      if (document?.id) {
        try {
          localStorage.setItem(`offline_wb_${document.id}`, JSON.stringify(elements));
        } catch {}
      }
      return;
    }

    setSaveStatus('saving');

    const socket = getSocket();
    socket.emit('whiteboard:change', {
      elements,
      action,
    });

    setTimeout(() => setSaveStatus('saved'), 800);
  };

  // Cursor movement emitter (throttled to 40ms for high performance & low network overhead)
  const handleCursorMove = (cursorData: any) => {
    const now = Date.now();
    if (now - cursorThrottleRef.current > 40) {
      cursorThrottleRef.current = now;
      const socket = getSocket();
      socket.emit('cursor:move', { cursor: cursorData });
    }
  };

  // Chat message sender
  const handleSendMessage = (text: string) => {
    const socket = getSocket();
    socket.emit('chat:send', { content: text });
  };

  // Document restore handler
  const handleVersionRestored = (res: any) => {
    setDocument(res.document);
    if (res.document.type === 'whiteboard') {
      try {
        setWhiteboardElements(JSON.parse(res.restoredContent || '[]'));
      } catch {}
    }

    // Refresh versions
    api.getVersions(docId!).then((r) => setVersions(r.versions || []));

    // Broadcast restore to peers
    const socket = getSocket();
    socket.emit('doc:restored', {
      versionNumber: res.newVersionNumber,
      content: res.restoredContent,
      language: res.restoredLanguage,
    });
  };

  if (!document) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <div className="text-xs text-slate-400">Loading collaborative workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden">
      {/* Top Workspace Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 truncate max-w-sm sm:max-w-md">
          <Link
            to="/dashboard"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              document.type === 'code'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {document.type === 'code' ? <Code2 className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </div>

          <div className="truncate">
            <div className="font-semibold text-sm text-white truncate flex items-center gap-2">
              <span>{document.title}</span>
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                  document.role === 'owner'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : document.role === 'editor'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {document.role}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              {saveStatus === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Auto-saving changes...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-slate-400 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  Synced real-time
                </span>
              )}
              {saveStatus === 'offline' && (
                <span className="text-rose-400 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Online Collaborators Presence */}
        <div className="hidden md:flex items-center">
          <PresenceBar
            users={activeUsers}
            currentUserId={user?.id}
            isOnline={isOnline}
          />
        </div>

        {/* Right: Workspace Actions */}
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Version History Toggle */}
          <button
            onClick={() => {
              setIsTimelineOpen(!isTimelineOpen);
              if (isChatOpen) setIsChatOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              isTimelineOpen
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Timeline</span>
            <span className="text-[10px] text-slate-400">({versions.length})</span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (isTimelineOpen) setIsTimelineOpen(false);
              setUnreadChatCount(0);
            }}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
              isChatOpen
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Canvas/Editor Area */}
      <div ref={workspaceRef} className="flex-1 flex overflow-hidden relative">
        {/* Live Cursors Overlay */}
        <LiveCursors
          cursors={remoteCursors}
          containerRef={workspaceRef}
        />

        {/* Editor or Whiteboard */}
        {document.type === 'code' ? (
          <CodeEditor
            content={document.content}
            language={document.language || 'javascript'}
            isViewer={isViewer}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            onCursorChange={handleCursorMove}
          />
        ) : (
          <Whiteboard
            elements={whiteboardElements}
            isViewer={isViewer}
            onElementsChange={handleWhiteboardChange}
            onCursorChange={handleCursorMove}
          />
        )}

        {/* Drawers */}
        <VersionTimeline
          documentId={document.id}
          documentType={document.type}
          versions={versions}
          isViewer={isViewer}
          isOpen={isTimelineOpen}
          onClose={() => setIsTimelineOpen(false)}
          onVersionRestored={handleVersionRestored}
          onSnapshotCreated={(newVer) => setVersions([newVer, ...versions])}
        />

        <ChatPanel
          messages={messages}
          currentUserId={user?.id}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(false)}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* Share Modal */}
      {isShareOpen && (
        <ShareModal
          documentId={document.id}
          documentTitle={document.title}
          isOwner={isOwner}
          accessLevel={document.access_level || 'link_edit'}
          collaborators={collaborators}
          onClose={() => setIsShareOpen(false)}
          onCollaboratorsUpdated={(updated) => setCollaborators(updated)}
          onAccessLevelUpdated={(lvl) => setDocument((prev) => (prev ? { ...prev, access_level: lvl } : prev))}
        />
      )}
    </div>
  );
};
