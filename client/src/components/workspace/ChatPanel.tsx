import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { MessageSquare, Send, X, Smile } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSendMessage: (content: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  isOpen,
  onToggle,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col h-full shadow-2xl z-30 shrink-0">
      {/* Header */}
      <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>Session Chat</span>
          <span className="text-[11px] font-normal text-slate-400">({messages.length})</span>
        </div>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            No messages yet in this document session. Send a greeting to start collaborating!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {!isMe && (
                    <div
                      className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: msg.user_color || '#6366f1' }}
                    >
                      {msg.user_name ? msg.user_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-slate-400">
                    {isMe ? 'You' : msg.user_name}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-200 rounded-tl-none border border-slate-700/50'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-indigo-500">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
