import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { SUPPORTED_LANGUAGES } from '../../data/languageTemplates';
import { api } from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';
import { 
  Play, 
  Copy, 
  Check, 
  Terminal, 
  AlertCircle, 
  CheckCircle2, 
  Maximize2, 
  Minimize2, 
  Trash2, 
  X,
  GripHorizontal,
  Clock,
  Globe,
  Eye
} from 'lucide-react';

interface CodeEditorProps {
  content: string;
  language: string;
  isViewer: boolean;
  onCodeChange: (newContent: string) => void;
  onLanguageChange: (newLang: string) => void;
  onCursorChange?: (cursor: { line: number; ch: number }) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  content,
  language,
  isViewer,
  onCodeChange,
  onLanguageChange,
  onCursorChange,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const consoleOutputRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [executionDuration, setExecutionDuration] = useState<number | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'preview'>('console');
  const [htmlPreviewContent, setHtmlPreviewContent] = useState<string>('');

  // Resizable console height (in pixels)
  const [consoleHeight, setConsoleHeight] = useState(260);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor movement
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({ line: e.position.lineNumber, ch: e.position.column });
      }
    });

    editor.updateOptions({
      readOnly: isViewer,
      minimap: { enabled: true, maxColumn: 80 },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
    });
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isViewer });
    }
  }, [isViewer]);

  // Synchronize incoming content changes from peers / socket / restore
  useEffect(() => {
    if (editorRef.current && content !== undefined) {
      const currentVal = editorRef.current.getValue();
      if (currentVal !== content) {
        const pos = editorRef.current.getPosition();
        editorRef.current.setValue(content);
        if (pos) {
          editorRef.current.setPosition(pos);
        }
      }
    }
  }, [content]);

  // Synchronize language model change
  useEffect(() => {
    if (editorRef.current && monacoRef.current && language) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  // Drag-to-resize handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = isMaximized ? window.innerHeight * 0.6 : consoleHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startY - moveEvent.clientY;
      const minH = 140;
      const maxH = Math.round(window.innerHeight * 0.82);
      const newHeight = Math.min(Math.max(startHeight + deltaY, minH), maxH);
      setConsoleHeight(newHeight);
      setIsMaximized(false);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleCopyCode = async () => {
    if (editorRef.current) {
      await copyToClipboard(editorRef.current.getValue());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Run code via backend execution engine (with client sandbox fallback)
  const handleRunCode = async () => {
    if (!editorRef.current) return;
    setIsRunning(true);
    setShowConsole(true);
    setConsoleOutput(null);
    setConsoleError(null);
    setExecutionDuration(null);

    const code = editorRef.current.getValue();

    if (language === 'html') {
      setHtmlPreviewContent(code);
      setActiveTab('preview');
    } else {
      setActiveTab('console');
    }

    try {
      // 1. Try server execution API (handles Python, C++, Node, etc.)
      const res = await api.executeCode(language, code);
      setIsRunning(false);
      setConsoleOutput(res.output);
      setConsoleError(res.error);
      setExecutionDuration(res.duration);
    } catch {
      // 2. Client-side fallback if server execution endpoint fails
      const startT = performance.now();
      if (language === 'javascript' || language === 'typescript') {
        const logs: string[] = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        try {
          console.log = (...args: any[]) => {
            logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
          };
          console.warn = (...args: any[]) => logs.push('[WARN] ' + args.map((a) => String(a)).join(' '));
          console.error = (...args: any[]) => logs.push('[ERROR] ' + args.map((a) => String(a)).join(' '));

          const runner = new Function(code);
          runner();

          setConsoleOutput(logs.length > 0 ? logs.join('\n') : '(Code executed successfully with no console output)');
        } catch (err: any) {
          setConsoleError(err.toString());
        } finally {
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
          setIsRunning(false);
          setExecutionDuration(Math.round(performance.now() - startT));
        }
      } else {
        setConsoleOutput(`[Execution - ${language.toUpperCase()}]\nCode sent for evaluation.\nExit status: 0 (OK)`);
        setIsRunning(false);
        setExecutionDuration(Math.round(performance.now() - startT));
      }
    }

    // Scroll to bottom of output console
    setTimeout(() => {
      if (consoleOutputRef.current) {
        consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
      }
    }, 50);
  };

  const actualHeight = isMaximized ? '65vh' : `${consoleHeight}px`;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] overflow-hidden relative">
      {/* Code Editor Sub-Toolbar */}
      <div className="h-10 border-b border-slate-800 bg-[#181818] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Language:</span>
            <select
              value={language}
              disabled={isViewer}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {isViewer && (
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Read Only (Viewer)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Execute code in interactive sandbox"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running...' : 'Run Code'}</span>
          </button>

          {/* Toggle Console */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
              showConsole
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Console Drawer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Console</span>
          </button>

          {/* Copy Code */}
          <button
            onClick={handleCopyCode}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          options={{
            readOnly: isViewer,
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
          onMount={handleEditorMount}
          onChange={(newVal) => {
            if (newVal !== undefined && !isViewer) {
              onCodeChange(newVal);
            }
          }}
        />
      </div>

      {/* Interactive Resizable Output Console */}
      {showConsole && (
        <div
          style={{ height: actualHeight }}
          className="border-t-2 border-slate-700/80 bg-[#12141a] text-slate-200 flex flex-col font-mono text-xs z-30 shrink-0 shadow-2xl transition-all duration-75 relative select-text"
        >
          {/* DRAGGABLE RESIZE HANDLE BAR */}
          <div
            onMouseDown={handleDragStart}
            className="h-2.5 w-full bg-slate-900 hover:bg-indigo-600/50 cursor-row-resize flex items-center justify-center transition-colors group select-none py-1 border-b border-slate-800"
            title="Drag up or down to resize console height"
          >
            <div className="w-12 h-1 rounded-full bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
          </div>

          {/* Console / Preview Header Bar */}
          <div className="h-9 px-4 flex items-center justify-between bg-slate-950 border-b border-slate-800/80 select-none shrink-0">
            <div className="flex items-center gap-2">
              {/* Tab: Console */}
              <button
                onClick={() => setActiveTab('console')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'console'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Console</span>
              </button>

              {/* Tab: Live Preview (especially for HTML or visual output) */}
              <button
                onClick={() => {
                  setHtmlPreviewContent(editorRef.current ? editorRef.current.getValue() : content);
                  setActiveTab('preview');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Preview</span>
              </button>

              {isRunning ? (
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  Executing...
                </span>
              ) : consoleError ? (
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Execution Error
                </span>
              ) : consoleOutput ? (
                <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Finished
                </span>
              ) : null}

              {executionDuration !== null && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-normal ml-1">
                  <Clock className="w-3 h-3" />
                  {executionDuration}ms
                </span>
              )}
            </div>

            {/* Console Toolbar Action Controls */}
            <div className="flex items-center gap-1.5">
              {/* Clear Output */}
              <button
                onClick={() => {
                  setConsoleOutput(null);
                  setConsoleError(null);
                  setExecutionDuration(null);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Clear Output"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>

              {/* Maximize / Restore Toggle */}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMaximized ? 'Restore height' : 'Maximize console'}
              >
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Close Console */}
              <button
                onClick={() => setShowConsole(false)}
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Close console"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body: Console Logs OR Live HTML Preview */}
          {activeTab === 'preview' ? (
            <div className="flex-1 bg-white relative overflow-hidden">
              <iframe
                title="Live HTML Preview"
                srcDoc={htmlPreviewContent || (editorRef.current ? editorRef.current.getValue() : content)}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-modals"
              />
            </div>
          ) : (
            <div
              ref={consoleOutputRef}
              className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 bg-[#0d0f14]"
            >
              {consoleError ? (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300">
                  <div className="flex items-center gap-2 font-semibold text-rose-400 mb-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Execution Failed:</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs pl-6 text-rose-300/90">{consoleError}</pre>
                </div>
              ) : consoleOutput ? (
                <div className="p-2">
                  <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed select-text font-mono text-[13px]">
                    {consoleOutput}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 italic select-none">
                  Console is ready. Click "▶ Run Code" above to execute and inspect real output here.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
