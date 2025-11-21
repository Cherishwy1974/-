import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { Mesh, CanvasTexture, Vector3 } from 'three';
import { Stroke } from '../types';

interface BlackboardProps {
  strokes: Stroke[];
  isDrawing: boolean;
  onPointerMove: (point3D: Vector3) => void;
  onPointerDown: (point3D: Vector3) => void;
  onPointerUp: () => void;
  setCanvasRef: (canvas: HTMLCanvasElement) => void;
  aiText: string;
  onAIWritePos?: (pos: Vector3) => void;
}

const Blackboard: React.FC<BlackboardProps> = ({ 
    strokes, 
    onPointerMove, 
    onPointerDown, 
    onPointerUp,
    setCanvasRef,
    aiText,
    onAIWritePos
}) => {
  const meshRef = useRef<Mesh>(null);
  const [canvas] = useState(document.createElement('canvas'));
  const texture = useMemo(() => new CanvasTexture(canvas), [canvas]);
  
  const [displayedText, setDisplayedText] = useState("");
  const [charIndex, setCharIndex] = useState(0);

  // Physical Board Size
  const boardWidth = 8;
  const boardHeight = 4;

  useEffect(() => {
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawBackground(ctx);
    }
    setCanvasRef(canvas);
  }, [canvas, setCanvasRef]);

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#2b382f'; // Classic Dark Green School Board
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Chalk Dust effect
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for(let i=0; i<8000; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const s = Math.random() * 2;
          ctx.fillRect(x, y, s, s);
      }
  };

  useEffect(() => {
      if (aiText && aiText.length > charIndex) {
          const timeout = setTimeout(() => {
              setCharIndex(prev => prev + 1);
              setDisplayedText(aiText.substring(0, charIndex + 1));
          }, 40); 
          return () => clearTimeout(timeout);
      } else if (!aiText) {
          setCharIndex(0);
          setDisplayedText("");
      }
  }, [aiText, charIndex]);

  // Main Render Loop
  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw User Strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 1) return;
      
      // White Chalk
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 6; // Thicker for better visibility
      ctx.shadowColor = 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 4;
      
      ctx.beginPath();
      const p0 = stroke.points[0];
      ctx.moveTo(p0.x * canvas.width, (1 - p0.y) * canvas.height);
      
      for (let i = 1; i < stroke.points.length - 1; i++) {
         const p1 = stroke.points[i];
         const p2 = stroke.points[i+1];
         const cpX = (p1.x * canvas.width + p2.x * canvas.width) / 2;
         const cpY = ((1 - p1.y) * canvas.height + (1 - p2.y) * canvas.height) / 2;
         ctx.quadraticCurveTo(p1.x * canvas.width, (1 - p1.y) * canvas.height, cpX, cpY);
      }
      if (stroke.points.length > 1) {
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x * canvas.width, (1 - last.y) * canvas.height);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; 
    });

    // Draw AI Text with Math Font
    if (displayedText) {
        ctx.font = 'bold 36px "Handlee", cursive'; 
        ctx.fillStyle = '#ffffff'; 
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 2;
        ctx.textBaseline = 'top';
        
        const startX = 50;
        const startY = 50;
        const lineHeight = 60;
        const maxWidth = canvas.width - 100;
        
        let drawX = startX;
        let drawY = startY;
        
        const words = displayedText.split(' ');
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const w = ctx.measureText(word + ' ').width;
            
            if (word.includes('\n')) {
                const parts = word.split('\n');
                ctx.fillText(parts[0], drawX, drawY);
                drawY += lineHeight;
                drawX = startX;
                if(parts[1]) {
                     ctx.fillText(parts[1] + ' ', drawX, drawY);
                     drawX += ctx.measureText(parts[1] + ' ').width;
                }
                continue;
            }

            if (drawX + w > maxWidth) {
                drawY += lineHeight;
                drawX = startX;
            }
            
            ctx.fillText(word + ' ', drawX, drawY);
            drawX += w;
        }

        // Calculate AI Hand Position (Cursor)
        // Fine-tuned offset for accuracy
        const u = (drawX + 20) / canvas.width;
        const v = 1 - (drawY + 40) / canvas.height; 
        
        const worldX = (u * 8) - 4;
        const worldY = (v * 4) - 2;
        
        if (onAIWritePos && charIndex < aiText.length) {
            onAIWritePos(new Vector3(worldX, worldY, -1.8));
        }
    }

    texture.needsUpdate = true;
  }, [strokes, displayedText, canvas, texture]);

  return (
    <group position={[0, 2, -2]}>
        {/* Frame */}
        <mesh position={[0, 0, -0.05]} receiveShadow>
            <boxGeometry args={[boardWidth + 0.4, boardHeight + 0.4, 0.1]} />
            <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        
        {/* Board Mesh */}
        <mesh 
            ref={meshRef} 
            onPointerMove={(e) => {
                e.stopPropagation();
                onPointerMove(e.point);
            }}
            onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e.point);
            }}
            onPointerUp={(e) => {
                e.stopPropagation();
                onPointerUp();
            }}
        >
            <planeGeometry args={[boardWidth, boardHeight]} />
            <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
        </mesh>
        
        {/* Chalk Tray */}
        <mesh position={[0, -boardHeight/2 - 0.1, 0.2]} castShadow>
             <boxGeometry args={[boardWidth, 0.1, 0.3]} />
             <meshStandardMaterial color="#3e2723" />
        </mesh>
    </group>
  );
};

export default Blackboard;