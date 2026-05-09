import * as THREE from 'three';
import { FIELD_SURFACE_Y } from './config.js';

const CHARACTER_BODY_Y = 0.78;
const CHARACTER_HEAD_Y = 1.3;
const CHARACTER_FOOT_CLEARANCE = 0.325;

/**
 * Update goalkeeper character pose (idle, diving, punching, knocked down)
 * @param {THREE.Group} keeper - The goalkeeper character group
 * @param {Object} options - Animation options
 */
export function updateGoalkeeperAnimation(keeper, { 
    dt, 
    elapsedTime, 
    movement = keeper.userData.velocity, 
    knocked = false, 
    getUpProgress = 0, 
    diving = false, 
    diveProgress = 0, 
    punching = false, 
    punchProgress = 0 
} = {}) {
    const pose = keeper.userData.pose;
    if (!pose) return;

    const measuredSpeed = pose.lastPosition.distanceTo(keeper.position) / Math.max(dt, 0.0001);
    pose.lastPosition.copy(keeper.position);
    pose.speed = THREE.MathUtils.lerp(pose.speed, Math.max(measuredSpeed, movement.length()), Math.min(1, dt * 10));

    applyHitFlash(keeper, pose, elapsedTime);

    const bodyY = pose.bodyBaseY ?? CHARACTER_BODY_Y;
    const headY = pose.headBaseY ?? CHARACTER_HEAD_Y;
    pose.visualRoot.rotation.set(0, 0, 0);
    pose.visualRoot.position.set(0, FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE, 0);

    if (knocked) {
        const recovery = THREE.MathUtils.clamp(getUpProgress, 0, 1);
        const fall = 1 - recovery;
        pose.visualRoot.rotation.x = -Math.PI / 2 * fall;
        pose.visualRoot.rotation.z = 0.16 * Math.sin(elapsedTime * 16) * fall;
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.18 * recovery;
        pose.body.position.y = bodyY - 0.02;
        pose.body.rotation.set(0.12 * fall, 0, 0.18 * fall);
        pose.head.position.y = headY - 0.06;
        pose.head.rotation.set(-0.22 * fall, 0, 0.34 * fall);
        updatePlayerNameTagFlash(pose, elapsedTime);
        setArmPose(pose.leftArm, 1.18 * fall, 0.12, 0.72 * fall);
        setArmPose(pose.rightArm, -1.05 * fall, 0.18, -0.68 * fall);
        setLegPose(pose.leftLeg, 0.34 * fall, 0.22, -0.28 * fall);
        setLegPose(pose.rightLeg, -0.42 * fall, 0.18, 0.3 * fall);
        return;
    }
    
    // Punch save animation: goalkeeper jumps up with fist raised to hit high ball
    if (punching) {
        const punch = THREE.MathUtils.clamp(punchProgress, 0, 1);
        const punchPhase = Math.sin(punch * Math.PI);
        
        // Body jumps up and extends
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.4 * punchPhase;
        pose.visualRoot.rotation.z = 0.3 * punchPhase;  // Body tilt
        pose.visualRoot.rotation.x = -0.2 * punchPhase;
        
        pose.body.position.y = bodyY + 0.25 * punchPhase;
        pose.body.rotation.set(-0.15 * punchPhase, 0, 0.3 * punchPhase);
        
        // Head looks up at the ball, tilts same as body
        pose.head.position.y = headY + 0.15 * punchPhase;
        pose.head.rotation.set(-0.5 * punchPhase, 0, 0.3 * punchPhase);
        
        // Right arm: rotates fully forward from shoulder joint (forward rotation for punching)
        // Start: hanging down (~-0.2), End: fully rotated forward (Math.PI - 0.2 ≈ 2.94)
        const rightArmAngle = -0.2 - punchPhase * Math.PI;
        setArmPose(pose.rightArm, rightArmAngle, 0.15, 0);
        
        // Right forearm bends at elbow to bring fist forward/up during peak
        // The forearm is the 'knee' joint of the arm limb
        const rightForearmBend = punchPhase > 0.5 ? (punchPhase - 0.5) * 2.5 : 0;
        pose.rightArm.knee.rotation.x = rightForearmBend;
        
        // Left arm: rotates fully forward from shoulder joint (same direction as right arm for punching)
        // Start: hanging down (~-0.2), End: fully rotated forward (Math.PI - 0.2 ≈ 2.94)
        const leftArmAngle = -0.2 - punchPhase * Math.PI;
        setArmPose(pose.leftArm, leftArmAngle, 0.2, 0);
        
        // Left forearm: slight bend for balance
        pose.leftArm.knee.rotation.x = punchPhase * 1.0;
        
        // Legs: bend knees during jump, extend on landing
        const kneeBend = punchPhase > 0.5 ? (1 - punchPhase) * 1.3 : punchPhase * 1.3;
        setLegPose(pose.leftLeg, -kneeBend, 0.8 * punchPhase, -0.3 * punchPhase);
        setLegPose(pose.rightLeg, -kneeBend, 0.6 * punchPhase, 0.3 * punchPhase);
        
        updatePlayerNameTagFlash(pose, elapsedTime, punchPhase);
        return;
    }
    
    // Diving save animation: goalkeeper leaps sideways with both arms extended
    if (diving) {
        const dive = THREE.MathUtils.clamp(diveProgress, 0, 1);
        const divePhase = Math.sin(dive * Math.PI);
        
        // Body leans and rotates towards dive direction (sideways tilt)
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.08 * divePhase;
        pose.visualRoot.rotation.z = 1.1 * divePhase;  // Stronger body tilt
        pose.visualRoot.rotation.x = -0.45 * divePhase;
        
        pose.body.position.y = bodyY - 0.05 + 0.1 * divePhase;
        pose.body.rotation.set(-0.3 * divePhase, 0, 0.8 * divePhase);  // More pronounced lean
        
        // Head tilts same as body (inherits body rotation fully)
        pose.head.position.y = headY - 0.02 + 0.08 * divePhase;
        pose.head.rotation.set(-0.3 * divePhase, 0, 0.8 * divePhase);  // Same tilt as body
        
        // Both arms stretched out wide and UP to block the ball (hands raised)
        setArmPose(pose.leftArm, 2.1 * divePhase, 0.35, 1.65 * divePhase);  // Higher arm position
        setArmPose(pose.rightArm, -2.1 * divePhase, 0.35, -1.65 * divePhase);  // Higher arm position
        
        // Legs kick back during dive, body drops to ground
        setLegPose(pose.leftLeg, -1.05 * divePhase, 1.25 * divePhase, -0.45 * divePhase);
        setLegPose(pose.rightLeg, -1.05 * divePhase, 1.25 * divePhase, 0.45 * divePhase);
        
        updatePlayerNameTagFlash(pose, elapsedTime, divePhase);
        return;
    }
    
    // Idle stance: slight bounce, arms ready
    const phase = elapsedTime * 4.5 + pose.phase;
    const idleBob = Math.sin(phase) * 0.04;
    
    pose.body.position.y = bodyY + idleBob;
    pose.body.rotation.set(-0.06, 0, Math.sin(phase * 2) * 0.02);
    updatePlayerNameTagFlash(pose, elapsedTime, Math.abs(idleBob));
    pose.head.position.y = headY + idleBob;
    pose.head.rotation.set(0, 0, -Math.sin(phase * 2) * 0.015);
    
    setArmPose(pose.leftArm, -0.25, 0.28, 0.12);
    setArmPose(pose.rightArm, -0.25, 0.28, -0.12);
    setLegPose(pose.leftLeg, 0.08, 0.18, -0.04);
    setLegPose(pose.rightLeg, 0.08, 0.18, 0.04);
}

function updatePlayerNameTagFlash(pose, elapsedTime, lift = 0) {
    const nameTag = pose.visualRoot.children.find((child) => child.isSprite && child.userData.baseScale);
    if (!nameTag) return;

    const flash = 0.62 + 0.38 * Math.sin(elapsedTime * 8.5);
    const pulse = 1 + 0.08 * Math.sin(elapsedTime * 8.5);
    const baseScale = nameTag.userData.baseScale;
    nameTag.material.opacity = flash + lift * 0.18;
    nameTag.scale.copy(baseScale).multiplyScalar(pulse + lift * 0.12);
}

function collectHitFlashMaterials(root) {
    const materials = [];
    root.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                materials.push(...child.material);
            } else {
                materials.push(child.material);
            }
        }
    });
    return materials;
}

function applyHitFlash(keeper, pose, elapsedTime) {
    if (elapsedTime < (keeper.userData.hitFlashUntil || 0)) {
        const flash = 0.5 + 0.5 * Math.sin(elapsedTime * 65);
        pose.hitMaterials.forEach((material) => {
            material.emissive?.setRGB(flash, flash * 0.7, flash * 0.3);
        });
    } else {
        pose.hitMaterials.forEach((material) => {
            material.emissive?.setRGB(0, 0, 0);
        });
    }
}

export function flashCharacterHit(keeper, elapsedTime, duration = 0.18) {
    keeper.userData.hitFlashUntil = Math.max(keeper.userData.hitFlashUntil || 0, elapsedTime + duration);
}

function setArmPose(limb, shoulderSwing, elbowBend, sideSplay) {
    limb.hip.rotation.set(shoulderSwing, 0, sideSplay);
    limb.knee.rotation.set(-elbowBend, 0, 0);
}

function setLegPose(limb, hipSwing, kneeBend, sideSplay) {
    limb.hip.rotation.set(hipSwing, 0, sideSplay);
    limb.knee.rotation.set(kneeBend, 0, 0);
}
