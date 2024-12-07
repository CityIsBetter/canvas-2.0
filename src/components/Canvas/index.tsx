"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const Stage = dynamic(() => import('react-konva').then((mod) => mod.Stage), {
  ssr: false,
});

const Layer = dynamic(() => import('react-konva').then((mod) => mod.Layer), {
  ssr: false,
});

const Line = dynamic(() => import('react-konva').then((mod) => mod.Line), {
  ssr: false,
});
import io from 'socket.io-client';
import { 
  Paintbrush, 
  Eraser, 
  PaletteIcon, 
  Trash2, 
  Sliders 
} from 'lucide-react';
import Konva from 'konva';

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
  setTool: (tool: string) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setIsColorPickerOpen: (open: boolean) => void;
  clearCanvas: () => void;
}> = ({
  tool, 
  color, 
  strokeWidth, 
  isColorPickerOpen,
  setTool, 
  setColor, 
  setStrokeWidth, 
  setIsColorPickerOpen, 
  clearCanvas
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
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const stageRef = useRef<Konva.Stage>(null);
  const socketRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile and prevent default touch behaviors
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Prevent default touch behaviors
    const preventDefaults = (e: TouchEvent) => {
      e.preventDefault();
    };

    document.addEventListener('touchstart', preventDefaults, { passive: false });
    document.addEventListener('touchmove', preventDefaults, { passive: false });
    document.addEventListener('touchend', preventDefaults, { passive: false });

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('touchstart', preventDefaults);
      document.removeEventListener('touchmove', preventDefaults);
      document.removeEventListener('touchend', preventDefaults);
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

  // Prevent default touch move behavior and browser zoom
  useEffect(() => {
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.touchAction = 'auto';
    };
  }, []);

  const getPointerPosition = useCallback(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!stageRef.current) return null;
    
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    
    if (!pointerPos) return null;

    return {
      x: (pointerPos.x - canvasPosition.x) / canvasScale,
      y: (pointerPos.y - canvasPosition.y) / canvasScale
    };
  }, [canvasPosition, canvasScale]);

  const handleMouseDown = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const pos = getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setLines((prevLines) => [
      ...prevLines,
      { 
        tool, 
        points: [pos.x, pos.y], 
        color, 
        strokeWidth 
      }
    ]);

    // For mobile, store initial touch position for potential panning
    const touchPos = e.evt || e.touches?.[0];
    if (touchPos) {
      lastPositionRef.current = { 
        x: touchPos.clientX || touchPos.pageX, 
        y: touchPos.clientY || touchPos.pageY 
      };
    }
  };

  const handleMouseMove = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const pos = getPointerPosition();
    if (!isDrawing || !pos) return;

    // For touch devices, check if it's a drawing or panning action
    const touchPos = e.evt || e.touches?.[0];
    if (isMobile && touchPos) {
      const currentPos = { 
        x: touchPos.clientX || touchPos.pageX, 
        y: touchPos.clientY || touchPos.pageY 
      };

      // Determine if it's a pan or draw based on movement
      const deltaX = Math.abs(currentPos.x - lastPositionRef.current.x);
      const deltaY = Math.abs(currentPos.y - lastPositionRef.current.y);

      // If movement is significant, consider it a pan
      if (deltaX > 10 || deltaY > 10) {
        // Pan the canvas
        setCanvasPosition(prev => ({
          x: prev.x + (currentPos.x - lastPositionRef.current.x),
          y: prev.y + (currentPos.y - lastPositionRef.current.y)
        }));
        lastPositionRef.current = currentPos;
        return;
      }
    }

    // Drawing logic
    setLines((prevLines) => {
      const newLines = [...prevLines];
      const lastLine = newLines[newLines.length - 1];
      
      if (lastLine) {
        lastLine.points = [...lastLine.points, pos.x, pos.y];
        newLines[newLines.length - 1] = lastLine;
      }
      
      return newLines;
    });

    // Emit drawing data to other clients
    socketRef.current?.emit('drawing', lines[lines.length - 1]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    setLines([]);
    socketRef.current?.emit('clear-canvas');
  };

  // Pinch to zoom for mobile
  const handleWheel = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    setCanvasScale(newScale);
    setCanvasPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  };

  return (
    <>
      <DrawingToolbar 
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        isColorPickerOpen={isColorPickerOpen}
        setTool={setTool}
        setColor={setColor}
        setStrokeWidth={setStrokeWidth}
        setIsColorPickerOpen={setIsColorPickerOpen}
        clearCanvas={clearCanvas}
      />

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <Stage
          width={window.innerWidth - 40}
          height={window.innerHeight - 250}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onWheel={handleWheel}
          x={canvasPosition.x}
          y={canvasPosition.y}
          scaleX={canvasScale}
          scaleY={canvasScale}
          ref={stageRef}
          className="bg-white touch-none"
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </>
  );
}