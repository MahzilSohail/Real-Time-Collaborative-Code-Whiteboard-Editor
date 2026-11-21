import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WhiteboardElement } from '../../types';
import { 
  Pencil, 
  Square, 
  Circle, 
  ArrowRight, 
  Minus, 
  Type, 
  Eraser, 
  MousePointer, 
  RotateCcw, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Trash2, 
  Download, 
  Move
} from 'lucide-react';

interface WhiteboardProps {
  elements: WhiteboardElement[];
  isViewer: boolean;
  onElementsChange: (elements: WhiteboardElement[], action?: string) => void;
  onCursorChange?: (cursor: { x: number; y: number }) => void;
}

const COLOR_PALETTE = [
  '#ffffff', '#94a3b8', '#6366f1', '#3b82f6', 
  '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'
];

export const Whiteboard: React.FC<WhiteboardProps> = ({
  elements,
  isViewer,
  onElementsChange,
  onCursorChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tools state
  const [currentTool, setCurrentTool] = useState<
    'select' | 'pan' | 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser'
  >('pencil');
  const [currentColor, setCurrentColor] = useState<string>('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  // Dragging & drawing interaction refs
  const isInteracting = useRef(false);
  const isPanning = useRef(false);
  const isResizingRef = useRef(false);
  const startPanPos = useRef({ x: 0, y: 0 });
  const startDrawPos = useRef({ x: 0, y: 0 });
  const activeElementRef = useRef<WhiteboardElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Helper to push history
  const pushHistory = useCallback((newElements: WhiteboardElement[]) => {
    setUndoStack((prev) => [...prev.slice(-30), elements]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = () => {
    if (undoStack.length === 0 || isViewer) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, elements]);
    onElementsChange(previous, 'undo');
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || isViewer) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, elements]);
    onElementsChange(next, 'redo');
  };

  // Convert client screen mouse coordinates into world coordinates (accounting for pan & zoom)
  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: (clientX - pan.x) / zoom,
      y: (clientY - pan.y) / zoom,
    };
  };

  // Redraw canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle blueprint dot grid
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply pan & zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid points
    const gridSize = 40;
    const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize;
    const endX = startX + (canvas.width / zoom) + gridSize;
    const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize;
    const endY = startY + (canvas.height / zoom) + gridSize;

    ctx.fillStyle = '#1e293b';
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render all elements
    elements.forEach((el) => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.fill || el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const isSelected = el.id === selectedElementId;

      switch (el.type) {
        case 'pencil':
          if (el.points && el.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case 'rectangle':
          if (el.width !== undefined && el.height !== undefined) {
            ctx.beginPath();
            ctx.roundRect(el.x, el.y, el.width, el.height, 6);
            if (el.fill) {
              ctx.fillStyle = el.fill;
              ctx.fill();
            }
            ctx.stroke();

            if (el.text) {
              ctx.fillStyle = '#f8fafc';
              ctx.font = '14px -apple-system, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(el.text, el.x + el.width / 2, el.y + el.height / 2);
            }
          }
          break;

        case 'circle':
          if (el.width !== undefined && el.height !== undefined) {
            ctx.beginPath();
            const radiusX = Math.abs(el.width / 2);
            const radiusY = Math.abs(el.height / 2);
            const centerX = el.x + el.width / 2;
            const centerY = el.y + el.height / 2;
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            if (el.fill) {
              ctx.fillStyle = el.fill;
              ctx.fill();
            }
            ctx.stroke();
          }
          break;

        case 'line':
          if (el.endX !== undefined && el.endY !== undefined) {
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.endX, el.endY);
            ctx.stroke();
          }
          break;

        case 'arrow':
          if (el.endX !== undefined && el.endY !== undefined) {
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.endX, el.endY);
            ctx.stroke();

            // Draw arrowhead
            const angle = Math.atan2(el.endY - el.y, el.endX - el.x);
            const headLength = 14;
            ctx.beginPath();
            ctx.moveTo(el.endX, el.endY);
            ctx.lineTo(
              el.endX - headLength * Math.cos(angle - Math.PI / 6),
              el.endY - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(el.endX, el.endY);
            ctx.lineTo(
              el.endX - headLength * Math.cos(angle + Math.PI / 6),
              el.endY - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;

        case 'text':
        case 'note':
          ctx.font = `${el.fontSize || 16}px -apple-system, sans-serif`;
          ctx.fillStyle = el.color;
          ctx.fillText(el.text || 'Text', el.x, el.y);
          break;
      }

      // Draw bounding box if selected
      if (isSelected && !isViewer) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        const pad = 6;
        const w = el.width || 80;
        const h = el.height || 40;
        ctx.strokeRect(el.x - pad, el.y - pad, w + pad * 2, h + pad * 2);

        // Corner resize anchor
        ctx.setLineDash([]);
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(el.x + w + pad - 4, el.y + h + pad - 4, 8, 8);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [elements, pan, zoom, selectedElementId, isViewer]);

  // Handle canvas sizing and responsiveness
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [elements, pan, zoom, selectedElementId, renderCanvas]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);

    // Pan with Hand tool or Middle click
    if (currentTool === 'pan' || e.button === 1) {
      isPanning.current = true;
      startPanPos.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (isViewer) return;

    if (currentTool === 'select') {
      // First, check if clicked on the resize anchor of the currently selected element
      if (selectedElementId) {
        const selected = elements.find((el) => el.id === selectedElementId);
        if (selected && selected.width && selected.height) {
          const anchorX = selected.x + selected.width;
          const anchorY = selected.y + selected.height;
          if (Math.abs(coords.x - anchorX) <= 16 && Math.abs(coords.y - anchorY) <= 16) {
            isResizingRef.current = true;
            isInteracting.current = true;
            pushHistory(elements);
            return;
          }
        }
      }

      isResizingRef.current = false;

      // Find clicked element (reverse order to pick top-most)
      const found = [...elements].reverse().find((el) => {
        const w = el.width || 80;
        const h = el.height || 40;
        return (
          coords.x >= el.x &&
          coords.x <= el.x + w &&
          coords.y >= el.y &&
          coords.y <= el.y + h
        );
      });

      if (found) {
        setSelectedElementId(found.id);
        isInteracting.current = true;
        dragOffsetRef.current = { x: coords.x - found.x, y: coords.y - found.y };
        pushHistory(elements);
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    if (currentTool === 'eraser') {
      const remaining = elements.filter((el) => {
        const w = el.width || 80;
        const h = el.height || 40;
        const inside =
          coords.x >= el.x &&
          coords.x <= el.x + w &&
          coords.y >= el.y &&
          coords.y <= el.y + h;
        return !inside;
      });

      if (remaining.length !== elements.length) {
        pushHistory(elements);
        onElementsChange(remaining, 'erase');
      }
      return;
    }

    // Creating new element
    isInteracting.current = true;
    startDrawPos.current = coords;
    const newId = 'elem_' + Math.random().toString(36).substring(2, 9);

    let newElement: WhiteboardElement;

    if (currentTool === 'pencil') {
      newElement = {
        id: newId,
        type: 'pencil',
        x: coords.x,
        y: coords.y,
        color: currentColor,
        strokeWidth,
        points: [coords],
      };
    } else if (currentTool === 'rectangle') {
      newElement = {
        id: newId,
        type: 'rectangle',
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: currentColor,
        strokeWidth,
        fill: `${currentColor}22`,
      };
    } else if (currentTool === 'circle') {
      newElement = {
        id: newId,
        type: 'circle',
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: currentColor,
        strokeWidth,
        fill: `${currentColor}22`,
      };
    } else if (currentTool === 'arrow') {
      newElement = {
        id: newId,
        type: 'arrow',
        x: coords.x,
        y: coords.y,
        endX: coords.x,
        endY: coords.y,
        color: currentColor,
        strokeWidth,
      };
    } else if (currentTool === 'line') {
      newElement = {
        id: newId,
        type: 'line',
        x: coords.x,
        y: coords.y,
        endX: coords.x,
        endY: coords.y,
        color: currentColor,
        strokeWidth,
      };
    } else if (currentTool === 'text') {
      const textPrompt = window.prompt('Enter text note:');
      if (textPrompt) {
        newElement = {
          id: newId,
          type: 'text',
          x: coords.x,
          y: coords.y,
          color: currentColor,
          strokeWidth,
          text: textPrompt,
          fontSize: 16,
        };
        pushHistory(elements);
        onElementsChange([...elements, newElement], 'add');
      }
      isInteracting.current = false;
      return;
    } else {
      return;
    }

    activeElementRef.current = newElement;
    pushHistory(elements);
    onElementsChange([...elements, newElement], 'draw_start');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Broadcast live cursor
    if (onCursorChange) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        onCursorChange({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }

    if (isPanning.current) {
      setPan({
        x: e.clientX - startPanPos.current.x,
        y: e.clientY - startPanPos.current.y,
      });
      return;
    }

    if (!isInteracting.current || isViewer) return;
    const coords = getCanvasCoords(e);

    if (currentTool === 'select' && selectedElementId) {
      if (isResizingRef.current) {
        // Resize selected element smoothly
        const updated = elements.map((el) => {
          if (el.id === selectedElementId) {
            const newW = Math.max(30, coords.x - el.x);
            const newH = Math.max(30, coords.y - el.y);
            return { ...el, width: newW, height: newH };
          }
          return el;
        });
        onElementsChange(updated, 'resize');
        return;
      }

      // Move selected element
      const updated = elements.map((el) => {
        if (el.id === selectedElementId) {
          return {
            ...el,
            x: coords.x - dragOffsetRef.current.x,
            y: coords.y - dragOffsetRef.current.y,
          };
        }
        return el;
      });
      onElementsChange(updated, 'move');
      return;
    }

    if (activeElementRef.current) {
      const current = activeElementRef.current;

      if (current.type === 'pencil' && current.points) {
        current.points.push(coords);
      } else if (current.type === 'rectangle' || current.type === 'circle') {
        current.width = coords.x - startDrawPos.current.x;
        current.height = coords.y - startDrawPos.current.y;
      } else if (current.type === 'arrow' || current.type === 'line') {
        current.endX = coords.x;
        current.endY = coords.y;
      }

      const updated = elements.map((el) => (el.id === current.id ? { ...current } : el));
      onElementsChange(updated, 'draw_update');
    }
  };

  const handleMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (isInteracting.current) {
      isInteracting.current = false;
      isResizingRef.current = false;
      activeElementRef.current = null;
      onElementsChange(elements, 'draw_end');
    }
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.3, prev + delta), 3.0));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Delete selected
  const handleDeleteSelected = () => {
    if (!selectedElementId || isViewer) return;
    pushHistory(elements);
    const updated = elements.filter((el) => el.id !== selectedElementId);
    setSelectedElementId(null);
    onElementsChange(updated, 'delete');
  };

  // Clear all
  const handleClearCanvas = () => {
    if (isViewer) return;
    if (window.confirm('Clear all whiteboard elements?')) {
      pushHistory(elements);
      setSelectedElementId(null);
      onElementsChange([], 'clear');
    }
  };

  // Export PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full bg-[#0b0f19] relative select-none overflow-hidden">
      {/* Top Floating Whiteboard Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md">
        {/* Pointer / Select */}
        <button
          onClick={() => setCurrentTool('select')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'select'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Select & Move (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Pan Hand */}
        <button
          onClick={() => setCurrentTool('pan')}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'pan'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Hand / Pan Canvas (H or Hold Space)"
        >
          <Move className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Pencil */}
        <button
          onClick={() => setCurrentTool('pencil')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'pencil'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Freehand Pencil (P)"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Rectangle */}
        <button
          onClick={() => setCurrentTool('rectangle')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'rectangle'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Rectangle (R)"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Circle */}
        <button
          onClick={() => setCurrentTool('circle')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'circle'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Circle (C)"
        >
          <Circle className="w-4 h-4" />
        </button>

        {/* Arrow */}
        <button
          onClick={() => setCurrentTool('arrow')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'arrow'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Arrow (A)"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Line */}
        <button
          onClick={() => setCurrentTool('line')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'line'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Straight Line (L)"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Text */}
        <button
          onClick={() => setCurrentTool('text')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'text'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Text Note (T)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Eraser */}
        <button
          onClick={() => setCurrentTool('eraser')}
          disabled={isViewer}
          className={`p-2 rounded-xl transition-all ${
            currentTool === 'eraser'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Eraser (E)"
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Stroke Colors Dropdown/Palette */}
        {!isViewer && (
          <>
            <div className="flex items-center gap-1 px-1">
              {COLOR_PALETTE.slice(0, 5).map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-5 h-5 rounded-full border border-slate-700 transition-transform ${
                    currentColor === color ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="w-[1px] h-6 bg-slate-800 mx-0.5" />

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-1 px-1">
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                    strokeWidth === w
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Stroke: ${w}px`}
                >
                  {w === 2 ? '2px' : w === 4 ? '4px' : '8px'}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0 || isViewer}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0 || isViewer}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Bottom Left: Zoom & View Controls */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md text-xs">
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="px-2 py-1 rounded-lg text-slate-300 font-mono text-[11px] hover:bg-slate-800"
          title="Reset View"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Bottom Right: Delete & Export */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        {selectedElementId && !isViewer && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium shadow-xl backdrop-blur-md transition-all"
            title="Delete Selected Shape"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        )}

        {!isViewer && (
          <button
            onClick={handleClearCanvas}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium shadow-xl backdrop-blur-md transition-all"
          >
            Clear All
          </button>
        )}

        <button
          onClick={handleExportPNG}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium shadow-xl backdrop-blur-md transition-all"
          title="Download PNG Snapshot"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span>Export PNG</span>
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-full h-full block ${
          currentTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
      />
    </div>
  );
};
