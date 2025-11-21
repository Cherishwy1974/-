import { Vector3 } from 'three';

export enum AvatarState {
  IDLE = 'IDLE',
  WRITING = 'WRITING',
  THINKING = 'THINKING',
  GRABBING = 'GRABBING', // For holding 3D objects
  WALKING = 'WALKING',
}

export interface DrawingPoint {
  x: number;
  y: number;
  z: number;
  dragging?: boolean;
}

export interface Stroke {
  points: DrawingPoint[];
  color: string;
}

export interface GeometricShape {
  id: string;
  type: 'cube' | 'sphere' | 'pyramid' | 'graph';
  position: [number, number, number];
  color: string;
  label?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}