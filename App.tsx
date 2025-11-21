import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, SoftShadows } from '@react-three/drei';
import { Vector3 } from 'three';
import Avatar from './components/Avatar';
import Blackboard from './components/Blackboard';
import InteractiveShapes from './components/InteractiveShapes';
import { analyzeBlackboard } from './services/gemini';
import { AvatarState, Stroke, GeometricShape } from './types';

export default function App() {
  const [avatarState, setAvatarState] = useState<AvatarState>(AvatarState.IDLE);
  const [ikTarget, setIkTarget] = useState<Vector3 | null>(null);
  const [lookAtTarget, setLookAtTarget] = useState<Vector3 | null>(null);
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [aiThinking, setAiThinking] = useState(false);
  const [aiText, setAiText] = useState("");
  
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  const [shapes, setShapes] = useState<GeometricShape[]>([
      { id: '1', type: 'cube', position: [-3, 0.5, 1], color: '#ef4444' },
      { id: '2', type: 'pyramid', position: [-2, 0.5, 1], color: '#3b82f6' },
  ]);

  // Parse AI Text for Action Tags (e.g. [[GRAPH: x^2]])
  useEffect(() => {
      if (!aiText) return;

      const graphMatch = aiText.match(/\[\[GRAPH:\s*(.*?)\]\]/);
      if (graphMatch) {
          const funcStr = graphMatch[1];
          
          // Wait for the avatar to "finish writing" before spawning
          const delay = Math.min(aiText.length * 30, 1500); 
          
          const timer = setTimeout(() => {
              addGraphShape(funcStr);
          }, delay);
          
          return () => clearTimeout(timer);
      }
  }, [aiText]);

  const handleAskAI = async () => {
    if (!canvasRef.current) return;
    setAvatarState(AvatarState.THINKING);
    setAiThinking(true);
    setAiText(""); 
    // Move hand to chin for "Thinking" pose
    setIkTarget(new Vector3(0.5, 1.8, 0.2)); 
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    
    const response = await analyzeBlackboard(dataUrl, "Look at the handwritten math. Solve it or plot it.");
    
    setAiThinking(false);
    setAvatarState(AvatarState.WRITING);
    
    // Remove the tag from the display text so it looks clean on board
    const displayText = response.replace(/\[\[GRAPH:.*?\]\]/g, '').trim();
    setAiText(displayText);
  };

  const addGraphShape = (funcStr: string) => {
      const newShape: GeometricShape = {
          id: Date.now().toString(),
          type: 'graph',
          position: [0, 1, 1.5], // Spawns in front of board, center
          color: '#10b981',
          label: funcStr
      };
      setShapes(prev => [...prev, newShape]);
      
      // Make Avatar look at the new creation and reach for it briefly
      setLookAtTarget(new Vector3(0, 1, 1.5));
      setIkTarget(new Vector3(0, 1, 1.5));
      setAvatarState(AvatarState.GRABBING);
      
      setTimeout(() => {
          setAvatarState(AvatarState.IDLE);
          setIkTarget(null);
      }, 1500);
  };

  const clearBoard = () => {
    setStrokes([]);
    setAiText("");
    setAvatarState(AvatarState.IDLE);
    setIkTarget(null);
  };

  const mapWorldToUV = (point: Vector3) => {
      const u = (point.x + 4) / 8;
      const v = (point.y + 2) / 4; 
      return { u, v };
  }

  const onBoardPointerDown = (point: Vector3) => {
      setOrbitEnabled(false); // DISABLE ORBIT TO DRAW
      const { u, v } = mapWorldToUV(point);
      
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          setAvatarState(AvatarState.WRITING);
          
          const writeTarget = point.clone();
          writeTarget.z = -1.8; 
          setIkTarget(writeTarget);
          setLookAtTarget(point);
          
          const newStroke: Stroke = {
              points: [{ x: u, y: v, z: 0 }],
              color: 'white'
          };
          setCurrentStroke(newStroke);
      }
  };

  const onBoardPointerMove = (point: Vector3) => {
      // Always look at cursor if near board
      if (point.z < 2) setLookAtTarget(point);

      if (avatarState === AvatarState.WRITING && currentStroke) {
          const writeTarget = point.clone();
          writeTarget.z = -1.8;
          setIkTarget(writeTarget);
          
          const { u, v } = mapWorldToUV(point);
          
          // Allow slight out of bounds while dragging to keep stroke continuous
          if (u >= -0.1 && u <= 1.1 && v >= -0.1 && v <= 1.1) {
            setCurrentStroke(prev => prev ? {
                ...prev,
                points: [...prev.points, { x: u, y: v, z: 0 }]
            } : null);
          }
      } 
  };

  const onBoardPointerUp = () => {
      setOrbitEnabled(true); // RE-ENABLE ORBIT
      if (avatarState === AvatarState.WRITING && currentStroke) {
          setStrokes(prev => [...prev, currentStroke]);
          setCurrentStroke(null);
      }
      if (!aiText) {
          setAvatarState(AvatarState.IDLE);
          setIkTarget(null);
      }
  };
  
  const handleAIWritePos = (pos: Vector3) => {
      if (avatarState !== AvatarState.WRITING) setAvatarState(AvatarState.WRITING);
      const aiTarget = pos.clone();
      aiTarget.z = -1.8; 
      setIkTarget(aiTarget);
      setLookAtTarget(pos);
  };

  const onShapeDragStart = (pos: Vector3) => {
      setOrbitEnabled(false);
      setAvatarState(AvatarState.GRABBING);
      setIkTarget(pos);
      setLookAtTarget(pos);
  };
  const onShapeDragMove = (pos: Vector3) => {
      setIkTarget(pos);
      setLookAtTarget(pos);
  };
  const onShapeDragEnd = () => {
      setOrbitEnabled(true);
      setAvatarState(AvatarState.IDLE);
      setIkTarget(null);
  };

  return (
    <div className="w-full h-screen relative bg-slate-50 overflow-hidden cursor-crosshair">
      <Canvas shadows dpr={[1, 1.5]} className="w-full h-full">
        <color attach="background" args={['#f8fafc']} />
        <PerspectiveCamera makeDefault position={[0, 1.5, 8]} fov={45} />
        
        {/* Bright Classroom Lighting */}
        <ambientLight intensity={0.7} />
        <spotLight 
            position={[5, 8, 5]} 
            angle={0.5} 
            penumbra={0.5} 
            intensity={1.2} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
        />
        <pointLight position={[-4, 5, 2]} intensity={0.5} color="#e0f2fe" />
        <Environment preset="city" />
        <SoftShadows size={10} focus={0} samples={10} />

        <group position={[0, -2.0, 0]}>
            <Avatar 
                targetPosition={ikTarget} 
                state={avatarState} 
                lookAtTarget={lookAtTarget}
            />
            
            <Blackboard 
                strokes={currentStroke ? [...strokes, currentStroke] : strokes}
                isDrawing={avatarState === AvatarState.WRITING}
                onPointerMove={onBoardPointerMove}
                onPointerDown={onBoardPointerDown}
                onPointerUp={onBoardPointerUp}
                setCanvasRef={(el) => canvasRef.current = el}
                aiText={aiText}
                onAIWritePos={handleAIWritePos}
            />

            <InteractiveShapes 
                shapes={shapes}
                onDragStart={onShapeDragStart}
                onDragMove={onShapeDragMove}
                onDragEnd={onShapeDragEnd}
            />
            
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            
            <ContactShadows opacity={0.4} scale={20} blur={2.5} far={2.5} resolution={512} color="#0f172a" />
        </group>

        <OrbitControls 
            enabled={orbitEnabled}
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minAzimuthAngle={-Math.PI / 4} 
            maxAzimuthAngle={Math.PI / 4}
            enablePan={false}
            maxDistance={12}
            minDistance={4}
            target={[0, 1.0, 0]}
        />
      </Canvas>

      {/* UI Layer */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 max-w-xs select-none z-10">
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl text-slate-800 border border-slate-200 shadow-xl">
              <h2 className="font-bold text-xl mb-1 text-indigo-600 flex items-center gap-2">
                  <span>👨‍🏫</span> AI Teacher
              </h2>
              
              <div className="text-xs text-slate-500 mb-5 space-y-2.5 font-medium mt-4">
                  <div className="flex items-center gap-3 group">
                      <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center text-green-600 border border-green-200">✎</div>
                      <span>Draw on the board</span>
                  </div>
                  <div className="flex items-center gap-3 group">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">✋</div>
                      <span>Drag & Drop shapes</span>
                  </div>
              </div>

              <div className="flex gap-3 mt-2">
                  <button 
                    onClick={handleAskAI}
                    disabled={aiThinking}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex justify-center items-center gap-2 text-white
                        ${aiThinking 
                            ? 'bg-slate-400 cursor-wait' 
                            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-200'}`}
                  >
                      {aiThinking ? 'Thinking...' : 'Analyze Board'}
                  </button>
                  <button 
                    onClick={clearBoard}
                    className="px-4 py-3 bg-white hover:bg-red-50 text-slate-600 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-xl font-bold transition-all active:scale-95"
                  >
                      Clean
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
}