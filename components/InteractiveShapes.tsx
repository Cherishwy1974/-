import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Mesh, Vector3, CanvasTexture } from 'three';
import { GeometricShape } from '../types';

interface Props {
  shapes: GeometricShape[];
  onDragStart: (pos: Vector3) => void;
  onDragEnd: () => void;
  onDragMove: (pos: Vector3) => void;
}

// Function to generate dynamic textures for graph planes
const useGraphTexture = (shape: GeometricShape) => {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            // Glassy Background
            ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
            ctx.fillRect(0, 0, 512, 512);
            
            // Grid
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Vertical lines
            for(let i=0; i<=512; i+=64) {
                ctx.moveTo(i, 0); ctx.lineTo(i, 512);
            }
            // Horizontal lines
            for(let i=0; i<=512; i+=64) {
                ctx.moveTo(0, i); ctx.lineTo(512, i);
            }
            ctx.stroke();

            // Axes
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(256, 0); ctx.lineTo(256, 512);
            ctx.moveTo(0, 256); ctx.lineTo(512, 256);
            ctx.stroke();
            
            // Curve Logic
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.shadowColor = shape.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            
            for(let x = 0; x < 512; x++) {
                // Map pixel x to graph domain [-5, 5]
                const domainX = (x - 256) / 40;
                
                let domainY = 0;
                // Simple function parser based on ID/Label
                if (shape.label?.includes('sin')) {
                    domainY = Math.sin(domainX) * 2;
                } else if (shape.label?.includes('cos')) {
                    domainY = Math.cos(domainX) * 2;
                } else {
                    // Default parabola
                    domainY = (domainX * domainX) * 0.2; 
                }
                
                // Map domain y back to pixel y
                const pixelY = 256 - (domainY * 40);
                
                if (x===0) ctx.moveTo(x, pixelY);
                else ctx.lineTo(x, pixelY);
            }
            ctx.stroke();
            
            // Label Text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Roboto';
            ctx.fillText(shape.label || 'y=f(x)', 20, 50);
        }
        return new CanvasTexture(canvas);
    }, [shape.label, shape.color]);
};

const GraphMesh = ({ shape, ...props }: { shape: GeometricShape } & any) => {
    const texture = useGraphTexture(shape);
    return (
        <mesh {...props}>
            <boxGeometry args={[2, 2, 0.05]} />
            <meshStandardMaterial map={texture} transparent opacity={0.95} />
        </mesh>
    );
};

const DraggableMesh = ({ shape, onDragStart, onDragEnd, onDragMove }: { 
    shape: GeometricShape;
    onDragStart: (pos: Vector3) => void;
    onDragEnd: () => void;
    onDragMove: (pos: Vector3) => void;
}) => {
    const mesh = useRef<Mesh>(null);
    const [hovered, setHover] = useState(false);
    const [dragging, setDragging] = useState(false);
    
    useFrame((state) => {
        if (mesh.current && !dragging) {
             // Idle float animation
             if (shape.type !== 'graph') {
                mesh.current.rotation.x += 0.005;
                mesh.current.rotation.y += 0.005;
             }
             const floatY = Math.sin(state.clock.elapsedTime + parseFloat(shape.id)) * 0.05;
             mesh.current.position.y = shape.position[1] + floatY;
        }
    });

    const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setDragging(true);
        onDragStart(e.point); // Initial contact point
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
        setDragging(false);
        onDragEnd();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (dragging && mesh.current) {
            // 1. Update mesh position
            // We project the mouse movement onto the plane where the object sits
            const newPos = e.point.clone();
            newPos.z = Math.max(0.5, newPos.z); // Keep away from board
            mesh.current.position.copy(newPos);
            
            // 2. Tell Avatar where the object is (World Space)
            onDragMove(newPos);
        }
    };

    const commonProps = {
        ref: mesh,
        position: shape.position,
        onPointerOver: () => setHover(true),
        onPointerOut: () => setHover(false),
        onPointerDown: onPointerDown,
        onPointerUp: onPointerUp,
        onPointerMove: onPointerMove,
        scale: hovered ? 1.1 : 1,
    };

    if (shape.type === 'graph') {
        return <GraphMesh shape={shape} {...commonProps} />;
    }

    return (
        <mesh {...commonProps}>
            {shape.type === 'cube' && <boxGeometry args={[0.6, 0.6, 0.6]} />}
            {shape.type === 'sphere' && <sphereGeometry args={[0.35]} />}
            {shape.type === 'pyramid' && <coneGeometry args={[0.35, 0.7, 4]} />}
            <meshStandardMaterial 
                color={dragging ? '#ff0055' : shape.color} 
                roughness={0.3}
                metalness={0.2}
            />
        </mesh>
    );
};

const InteractiveShapes: React.FC<Props> = ({ shapes, onDragStart, onDragEnd, onDragMove }) => {
  return (
    <group>
      {shapes.map((s) => (
        <DraggableMesh 
            key={s.id} 
            shape={s} 
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragMove={onDragMove}
        />
      ))}
    </group>
  );
};

export default InteractiveShapes;