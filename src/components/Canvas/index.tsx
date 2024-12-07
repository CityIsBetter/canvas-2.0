"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { 
  Paintbrush, 
  Eraser, 
  PaletteIcon, 
  Trash2, 
  Sliders,
  ZoomIn,
  ZoomOut,
  Hand
} from 'lucide-react';

// Types
interface DrawingLine {
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

// Toolbar Component
const DrawingToolbar: React.FC<{
  tool: string;
  color: string;
  strokeWidth: number;
  isColorPickerOpen: boolean;
  canvasScale: number;
  setTool: (tool: string) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setIsColorPickerOpen: (open: boolean) => void;
  clearCanvas: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}> = ({
  tool, 
  color, 
  strokeWidth, 
  isColorPickerOpen,
  canvasScale,
  setTool, 
  setColor, 
  setStrokeWidth, 
  setIsColorPickerOpen, 
  clearCanvas,
  zoomIn,
  zoomOut
}) => {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-4 bg-white shadow-md rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
      {/* Tool Selection */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setTool('pen')}
          className={`p-2 rounded-full transition-all duration-300 ${
            tool === 'pen' 
              ? 'bg-blue-500 text-white' 
              : 'hover:bg-blue-100 text-gray-600'
          }`}
          title="Pen Tool"
        >
          <Paintbrush className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setTool('eraser')}
          className={`p-2 rounded-full transition-all duration-300 ${
            tool === 'eraser' 
              ? 'bg-red-500 text-white' 
              : 'hover:bg-red-100 text-gray-600'
          }`}
          title="Eraser Tool"
        >
          <Eraser className="w-5 h-5" />
        </button>
        {/* <button 
          onClick={() => setTool('hand')}
          className={`p-2 rounded-full transition-all duration-300 ${
            tool === 'hand' 
              ? 'bg-green-500 text-white' 
              : 'hover:bg-green-100 text-gray-600'
          }`}
          title="Pan Tool"
        >
          <Hand className="w-5 h-5" />
        </button> */}
      </div>

      {/* Color Picker */}
      <div className="flex items-center justify-center">
        <button 
          onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
          className="p-2 rounded-full cursor-default"
          title="Color Picker"
        >
          <PaletteIcon className="w-5 h-5 text-gray-600" />
        </button>
        <input 
          type="color" 
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsColorPickerOpen(false);
          }}
          className="w-12 z-10 cursor-pointer"
        />
      </div>

      {/* Stroke Width */}
      <div className="flex items-center space-x-2">
        <Sliders className="w-4 h-4 text-gray-600" />
        <input 
          type="range" 
          min="1" 
          max="20" 
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Zoom Controls */}
      {/* <div className="flex items-center space-x-2">
        <button 
          onClick={zoomOut}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm text-black">{Math.round(canvasScale * 100)}%</span>
        <button 
          onClick={zoomIn}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div> */}

      {/* Clear Canvas */}
      <button 
        onClick={clearCanvas}
        className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all duration-300"
      >
        <Trash2 className="w-5 h-5" />
        <span>Clear</span>
      </button>
    </div>
  );
};

// Main Canvas Drawing Component
export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Zoom and Pan State
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const lastPositionRef = useRef<{x: number, y: number} | null>(null);

  // Socket State
  const socketRef = useRef<any>(null);

  // Resize canvas to window size
  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({
        width: window.innerWidth - 40,
        height: window.innerHeight - 250
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Socket connection effect
  useEffect(() => {
    socketRef.current = io('https://canva-backend-n71m.onrender.com', {
      transports: ['websocket']
    });

    socketRef.current.on('canvas-state', (initialState: DrawingLine[]) => {
      setLines(initialState);
    });

    socketRef.current.on('draw-data', (data: DrawingLine) => {
      setLines((prevLines) => [...prevLines, data]);
    });

    socketRef.current.on('canvas-cleared', () => {
      setLines([]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Render lines when canvas size or lines change
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    
    if (!canvas || !context) return;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    context.save();

    // Apply scaling and translation
    context.translate(canvasOffset.x, canvasOffset.y);
    context.scale(canvasScale, canvasScale);

    // Redraw all lines
    lines.forEach(line => {
      context.beginPath();
      context.strokeStyle = line.color;
      context.lineWidth = line.strokeWidth / canvasScale;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalCompositeOperation = line.tool === 'eraser' 
        ? 'destination-out' 
        : 'source-over';

      for (let i = 0; i < line.points.length; i += 2) {
        const x = line.points[i];
        const y = line.points[i + 1];

        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      
      context.stroke();
    });

    // Restore context
    context.restore();
  }, [lines, canvasSize, canvasScale, canvasOffset]);

  // Get canvas coordinates
  const getCanvasCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      const touch = (e as React.TouchEvent).touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      const mouse = e as React.MouseEvent;
      clientX = mouse.clientX;
      clientY = mouse.clientY;
    }

    // Adjust for canvas scaling and offset
    const x = (clientX - rect.left - canvasOffset.x) / canvasScale;
    const y = (clientY - rect.top - canvasOffset.y) / canvasScale;

    return { x, y };
  }, [canvasScale, canvasOffset]);

  // Start drawing or panning
  const startInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
  
    // Consistent way to get initial position for both mouse and touch events
    const initialPos = {
      x: 'touches' in e 
        ? (e as React.TouchEvent).touches[0].clientX 
        : (e as React.MouseEvent).clientX,
      y: 'touches' in e 
        ? (e as React.TouchEvent).touches[0].clientY 
        : (e as React.MouseEvent).clientY
    };
  
    // Always set last position, even for drawing
    lastPositionRef.current = initialPos;
  
    if (tool === 'hand') {
      // Prepare for panning
      setIsDrawing(true);
      return;
    }
  
    // Start drawing
    setIsDrawing(true);
    setLines(prev => [
      ...prev, 
      { 
        tool, 
        points: [coords.x, coords.y], 
        color, 
        strokeWidth 
      }
    ]);
  }, [tool, color, strokeWidth, getCanvasCoordinates]);

  // Draw or pan
  const continueInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCanvasCoordinates(e);
    
    // Ensure we have both coords and last position
    const currentPos = {
      x: 'touches' in e 
        ? (e as React.TouchEvent).touches[0].clientX 
        : (e as React.MouseEvent).clientX,
      y: 'touches' in e 
        ? (e as React.TouchEvent).touches[0].clientY 
        : (e as React.MouseEvent).clientY
    };
  
    // Defensive check for last position
    if (!lastPositionRef.current) {
      lastPositionRef.current = currentPos;
      return;
    }
  
    if (tool === 'hand') {
      // Panning with robust null checking
      setCanvasOffset(prev => ({
        x: prev.x + (currentPos.x - lastPositionRef.current!.x),
        y: prev.y + (currentPos.y - lastPositionRef.current!.y)
      }));
      
      // Update last position
      lastPositionRef.current = currentPos;
      return;
    }

    // Drawing logic
    if (!coords) return;

    setLines(prev => {
      const newLines = [...prev];
      const lastLine = newLines[newLines.length - 1];
      
      if (lastLine) {
        lastLine.points = [...lastLine.points, coords.x, coords.y];
        newLines[newLines.length - 1] = lastLine;
      }
      
      return newLines;
    });

    socketRef.current?.emit('drawing', lines[lines.length - 1]);
    lastPositionRef.current = currentPos;
  }, [isDrawing, tool, lines, getCanvasCoordinates]);

  // Stop drawing or panning
  const stopInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    lastPositionRef.current = null;
  }, []);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setCanvasScale(prev => Math.min(prev * 1.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setCanvasScale(prev => Math.max(prev / 1.2, 0.5));
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    // Determine zoom direction
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    
    // Calculate new scale
    const newScale = canvasScale * delta;
    
    // Limit zoom
    const limitedScale = Math.min(Math.max(newScale, 0.5), 3);
    
    // Update scale
    setCanvasScale(limitedScale);
  }, [canvasScale]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setLines([]);
    socketRef.current?.emit('clear-canvas');
  }, []);

  return (
    <>
      <DrawingToolbar 
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        isColorPickerOpen={isColorPickerOpen}
        canvasScale={canvasScale}
        setTool={setTool}
        setColor={setColor}
        setStrokeWidth={setStrokeWidth}
        setIsColorPickerOpen={setIsColorPickerOpen}
        clearCanvas={clearCanvas}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
      />

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="bg-white touch-none"
          onMouseDown={startInteraction}
          onMouseMove={continueInteraction}
          onMouseUp={stopInteraction}
          onMouseOut={stopInteraction}
          onTouchStart={startInteraction}
          onTouchMove={continueInteraction}
          onTouchEnd={stopInteraction}
        />
      </div>
    </>
  );
}