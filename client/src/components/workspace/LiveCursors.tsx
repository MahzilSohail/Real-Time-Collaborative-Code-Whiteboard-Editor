import React from 'react';
import { MousePointer2 } from 'lucide-react';

interface RemoteCursor {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
}

interface LiveCursorsProps {
  cursors: RemoteCursor[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const LiveCursors: React.FC<LiveCursorsProps> = ({ cursors }) => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {cursors.map((c) => {
        if (!c.cursor || typeof c.cursor.x !== 'number' || typeof c.cursor.y !== 'number') {
          return null;
        }

        return (
          <div
            key={c.socketId}
            className="absolute transition-all duration-75 ease-out flex items-start gap-1"
            style={{
              transform: `translate3d(${c.cursor.x}px, ${c.cursor.y}px, 0)`,
            }}
          >
            {/* Custom SVG pointer */}
            <MousePointer2
              className="w-4 h-4 fill-current drop-shadow-md"
              style={{ color: c.color }}
            />
            {/* Name tag pill */}
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-lg whitespace-nowrap select-none"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};
