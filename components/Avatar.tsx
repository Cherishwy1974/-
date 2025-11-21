import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Mesh, MathUtils } from 'three';
import { AvatarState } from '../types';

interface AvatarProps {
  targetPosition: Vector3 | null; 
  state: AvatarState;
  lookAtTarget: Vector3 | null;
}

const Avatar: React.FC<AvatarProps> = ({ targetPosition, state, lookAtTarget }) => {
  const groupRef = useRef<Group>(null);
  const spineRef = useRef<Group>(null);
  const headRef = useRef<Mesh>(null);
  const rightArmGroup = useRef<Group>(null);
  const rightForeArmGroup = useRef<Group>(null);
  const rightHandRef = useRef<Mesh>(null);

  const currentHandTarget = useRef(new Vector3(1, 1.5, 0));
  const headLookAt = useRef(new Vector3(0, 1.5, 5));
  const bodyPosition = useRef(new Vector3(0, 0, 0)); 
  
  // Logic for stable body movement
  const bodyTargetX = useRef(0); 

  const bodyRotationY = useRef(0);
  const bodyLean = useRef(new Vector3(0,0,0));

  useFrame((stateThree, delta) => {
    if (!groupRef.current || !rightArmGroup.current || !rightForeArmGroup.current || !spineRef.current) return;

    const time = stateThree.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    // --- 1. Locomotion & Positioning ---
    // Default target is current position
    let desiredBodyX = bodyTargetX.current;
    
    if (targetPosition) {
        if (state === AvatarState.WRITING) {
             // DEADZONE LOGIC: 
             // Instead of constantly moving the body (which causes swaying/jitter),
             // only move the body if the hand reaches too far from the center.
             const idealX = targetPosition.x - 0.4;
             const dist = Math.abs(idealX - bodyTargetX.current);
             
             // If we reach too far (> 0.8 units), take a "step" to the new position
             if (dist > 0.8) {
                 bodyTargetX.current = idealX;
             }
             // Otherwise, keep feet planted (bodyTargetX remains unchanged)
             
        } else if (state === AvatarState.GRABBING) {
             bodyTargetX.current = targetPosition.x - 0.4; 
        } else if (state === AvatarState.THINKING) {
             bodyTargetX.current = 0;
        }
    } else if (lookAtTarget) {
        // Idle drift towards interest
        if (state === AvatarState.IDLE) {
            bodyTargetX.current = lookAtTarget.x * 0.3;
        }
    }
    
    // Clamp to stage bounds
    bodyTargetX.current = Math.max(-3.2, Math.min(3.2, bodyTargetX.current));
    
    // Lerp body position
    // When writing, we want a stable base, so we move the body smoothly but firmly to the new "step" position
    const bodyLerpSpeed = state === AvatarState.WRITING ? 4.0 : 2.0;
    bodyPosition.current.x = MathUtils.lerp(bodyPosition.current.x, bodyTargetX.current, dt * bodyLerpSpeed);
    groupRef.current.position.x = bodyPosition.current.x;
    
    // Animation: Bobbing / Breathing
    // completely disable bobbing when writing to ensure pen accuracy
    if (state !== AvatarState.WRITING) {
        const speed = Math.abs(bodyPosition.current.x - bodyTargetX.current) * 10;
        const walkBob = Math.sin(time * 12) * Math.min(speed, 0.05);
        spineRef.current.position.y = 1.0 + Math.sin(time * 1.5) * 0.005 + walkBob;
    } else {
        spineRef.current.position.y = MathUtils.lerp(spineRef.current.position.y, 1.0, dt * 10);
    }

    // --- 2. Head Tracking ---
    const targetLook = lookAtTarget ? lookAtTarget.clone() : new Vector3(0, 1.5, 10);
    if (state === AvatarState.THINKING) targetLook.set(2, 4, 5);
    
    // Faster head tracking when working
    headLookAt.current.lerp(targetLook, dt * (state === AvatarState.WRITING ? 20 : 5));
    if (headRef.current) {
      headRef.current.lookAt(headLookAt.current);
      headRef.current.rotation.z = 0; // No tilt
    }

    // --- 3. Inverse Kinematics (Right Arm) ---
    const restPos = new Vector3(0.35, 0.9, 0.3).add(groupRef.current.position);
    let activePos = targetPosition ? targetPosition.clone() : restPos;

    if (state === AvatarState.THINKING) {
        activePos = groupRef.current.position.clone().add(new Vector3(0.15, 1.6, 0.35));
    }

    // Responsiveness control
    // Use very high speed when writing for 1:1 tracking with mouse
    const handLerpSpeed = state === AvatarState.WRITING ? 50 : (state === AvatarState.GRABBING ? 20 : 6);
    currentHandTarget.current.lerp(activePos, dt * handLerpSpeed);

    // IK Solver
    const shoulderOffsetLocal = new Vector3(0.28, 0.5, 0); 
    const shoulderPos = spineRef.current.localToWorld(shoulderOffsetLocal.clone());
    const toTarget = new Vector3().subVectors(currentHandTarget.current, shoulderPos);
    const dist = toTarget.length();

    const upperArmLen = 0.7;
    const lowerArmLen = 0.75;
    const maxReach = upperArmLen + lowerArmLen - 0.01;

    // Aim Upper Arm
    rightArmGroup.current.position.copy(shoulderOffsetLocal); 
    const localTarget = spineRef.current.worldToLocal(currentHandTarget.current.clone());
    rightArmGroup.current.lookAt(localTarget);
    rightArmGroup.current.rotateX(Math.PI / 2); 

    // Bend Elbow
    let cosElbow = (upperArmLen**2 + lowerArmLen**2 - Math.min(dist, maxReach)**2) / (2 * upperArmLen * lowerArmLen);
    const elbowAngle = Math.acos(Math.max(-1, Math.min(1, cosElbow)));
    rightForeArmGroup.current.rotation.set(elbowAngle, 0, 0); 

    // Hand Rotation
    if (rightHandRef.current) {
        rightHandRef.current.rotation.set(0,0,0);
        if (state === AvatarState.WRITING) {
             // Hold chalk precise
             rightHandRef.current.rotation.x = -Math.PI / 2;
             // Rotate chalk to hit board
             rightHandRef.current.rotation.z = -Math.PI / 4;
        } else if (state === AvatarState.GRABBING) {
             rightHandRef.current.rotation.x = -Math.PI / 2; 
        } else if (state === AvatarState.THINKING) {
             rightHandRef.current.rotation.z = Math.PI / 1.5;
             rightHandRef.current.rotation.x = -Math.PI / 4;
        }
    }
    
    // --- 4. Body Mechanics (Leaning) ---
    if (targetPosition || lookAtTarget) {
        const focusPoint = targetPosition || lookAtTarget;
        const localLook = groupRef.current.worldToLocal(focusPoint.clone());
        const targetYRot = Math.atan2(localLook.x, localLook.z);
        
        // Lock rotation more strictly when writing
        const rotationSpeed = state === AvatarState.WRITING ? 1.0 : 4.0;
        bodyRotationY.current = MathUtils.lerp(bodyRotationY.current, targetYRot * 0.7, dt * rotationSpeed);
        spineRef.current.rotation.y = bodyRotationY.current;

        // Lean into action
        let targetLeanX = 0;
        let targetLeanZ = 0;

        if (state === AvatarState.GRABBING || state === AvatarState.WRITING) {
            const reachExtension = Math.min(dist / maxReach, 1);
            targetLeanX = (localLook.y - 1.0) * 0.1; 
            // Minimal twist when writing
            targetLeanZ = -localLook.x * (state === AvatarState.WRITING ? 0.05 : 0.2) * reachExtension;
        }
        
        bodyLean.current.x = MathUtils.lerp(bodyLean.current.x, targetLeanX, dt * 5);
        bodyLean.current.z = MathUtils.lerp(bodyLean.current.z, targetLeanZ, dt * 5);
        
        spineRef.current.rotation.x = bodyLean.current.x;
        spineRef.current.rotation.z = bodyLean.current.z;
    } else {
        // Reset
        bodyRotationY.current = MathUtils.lerp(bodyRotationY.current, 0, dt * 3);
        bodyLean.current.set(0,0,0);
        spineRef.current.rotation.set(0, bodyRotationY.current, 0);
    }
  });

  // Materials
  const skinMat = <meshStandardMaterial color="#ffdbac" roughness={0.4} />;
  const suitMat = <meshStandardMaterial color="#1e293b" roughness={0.5} />;
  const shirtMat = <meshStandardMaterial color="#ffffff" roughness={0.3} />;
  const tieMat = <meshStandardMaterial color="#ef4444" roughness={0.4} />;
  
  // NOTE: Added raycast={() => null} to ALL meshes to prevent the avatar from blocking 
  // mouse events intended for the blackboard or shapes behind it.
  
  return (
    <group ref={groupRef}>
      <group ref={spineRef} position={[0, 1.0, 0]}>
        {/* Torso */}
        <mesh position={[0, 0.15, 0]} castShadow raycast={() => null}>
            <boxGeometry args={[0.42, 0.65, 0.22]} />
            {suitMat}
            <mesh position={[0, 0.1, 0.12]} raycast={() => null}>
                <planeGeometry args={[0.15, 0.45]} />
                {shirtMat}
            </mesh>
            <mesh position={[0, 0.12, 0.13]} raycast={() => null}>
                <boxGeometry args={[0.05, 0.45, 0.02]} />
                {tieMat}
            </mesh>
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0.65, 0]}>
             <mesh castShadow raycast={() => null}>
                <boxGeometry args={[0.26, 0.30, 0.28]} />
                {skinMat}
            </mesh>
            {/* Hair */}
            <mesh position={[0, 0.16, 0]} raycast={() => null}>
                 <boxGeometry args={[0.28, 0.12, 0.3]} />
                 <meshStandardMaterial color="#0f172a" />
            </mesh>
             {/* Eyes */}
            <group position={[0, 0.02, 0.15]}>
                <mesh position={[0.06, 0, 0]} raycast={() => null}>
                    <planeGeometry args={[0.05, 0.02]} />
                    <meshBasicMaterial color="black" />
                </mesh>
                <mesh position={[-0.06, 0, 0]} raycast={() => null}>
                    <planeGeometry args={[0.05, 0.02]} />
                    <meshBasicMaterial color="black" />
                </mesh>
            </group>
        </group>

        {/* Left Arm */}
        <group position={[-0.28, 0.45, 0]} rotation={[0, 0, -0.1]}>
            <mesh position={[0, -0.3, 0]} raycast={() => null}>
                <boxGeometry args={[0.09, 0.6, 0.09]} />
                {suitMat}
            </mesh>
            <mesh position={[0, -0.65, 0]} raycast={() => null}>
                 <sphereGeometry args={[0.06]} />
                 {skinMat}
            </mesh>
        </group>

        {/* Right Arm (IK) */}
        <group ref={rightArmGroup}>
            <mesh raycast={() => null}>
               <sphereGeometry args={[0.08]} />
               {suitMat}
            </mesh>
            <mesh position={[0, 0.35, 0]} rotation={[Math.PI, 0, 0]} castShadow raycast={() => null}> 
                <boxGeometry args={[0.09, 0.7, 0.09]} />
                {suitMat}
            </mesh>
            <group ref={rightForeArmGroup} position={[0, 0.7, 0]}>
                <mesh raycast={() => null}>
                    <sphereGeometry args={[0.075]} />
                    {suitMat}
                </mesh>
                <mesh position={[0, 0.35, 0]} castShadow raycast={() => null}>
                    <boxGeometry args={[0.08, 0.75, 0.08]} />
                    {suitMat}
                    <mesh position={[0, 0.35, 0]} raycast={() => null}>
                         <boxGeometry args={[0.085, 0.05, 0.085]} />
                         {shirtMat}
                    </mesh>
                </mesh>
                <mesh ref={rightHandRef} position={[0, 0.78, 0]} raycast={() => null}>
                    <boxGeometry args={[0.07, 0.1, 0.09]} />
                    {skinMat}
                    <mesh position={[0, 0.06, 0.04]} visible={state === AvatarState.WRITING} raycast={() => null}>
                        <cylinderGeometry args={[0.008, 0.008, 0.12]} />
                        <meshStandardMaterial color="white" />
                    </mesh>
                </mesh>
            </group>
        </group>
      </group>

      {/* Legs */}
      <group position={[0, 1.0, 0]}>
         <mesh position={[-0.14, -0.55, 0]} raycast={() => null}>
            <boxGeometry args={[0.13, 1.1, 0.14]} />
            {suitMat}
         </mesh>
         <mesh position={[0.14, -0.55, 0]} raycast={() => null}>
            <boxGeometry args={[0.13, 1.1, 0.14]} />
            {suitMat}
         </mesh>
      </group>
    </group>
  );
};

export default Avatar;