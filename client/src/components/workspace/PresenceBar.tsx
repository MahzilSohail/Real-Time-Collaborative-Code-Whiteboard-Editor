import React from 'react';
import { ActiveUser } from '../../types';
import { Users, Wifi } from 'lucide-react';

interface PresenceBarProps {
  users: ActiveUser[];
  currentUserId?: string;
  isOnline: boolean;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ users, currentUserId, isOnline }) => {
  return (
    <div className="flex items-center gap-3">
      {/* Real-time status indicator */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
        <span
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
          }`}
        />
        <span className="text-slate-400 text-[11px]">
          {isOnline ? 'Live < 30ms' : 'Disconnected'}
        </span>
      </div>

      {/* Collaborators online stack */}
      <div className="flex items-center -space-x-2 overflow-hidden py-1">
        {users.slice(0, 6).map((u) => {
          const isMe = u.userId === currentUserId;
          return (
            <div
              key={u.socketId}
              title={`${u.name} (${u.role})${isMe ? ' - You' : ''}`}
              className="relative group transition-transform hover:scale-110 hover:z-20 cursor-default"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ring-2 ring-slate-950 shadow-md"
                style={{ backgroundColor: u.color }}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 text-white text-[11px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-50">
                <span className="font-semibold">{u.name} {isMe && '(You)'}</span>
                <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
              </div>
            </div>
          );
        })}

        {users.length > 6 && (
          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-medium text-[11px] flex items-center justify-center ring-2 ring-slate-950 shadow-md">
            +{users.length - 6}
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-medium">
        <Users className="w-3.5 h-3.5" />
        <span>{users.length} online</span>
      </div>
    </div>
  );
};
