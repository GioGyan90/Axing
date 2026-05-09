import * as THREE from 'three';
import { FIELD_SURFACE_Y } from './config.js';

const CHARACTER_BODY_Y = 0.78;
const CHARACTER_HEAD_Y = 1.3;
const CHARACTER_FOOT_CLEARANCE = 0.325;

/**
 * Update player character pose (running, kicking, knocked down)
 * @param {THREE.Group} character - The player character group
 * @param {Object} options - Animation options
 */
export function updatePlayerAnimation(character, { 
    dt, 
    elapsedTime, 
    movement = character.userData.velocity, 
    kicking = false, 
    kickPower = 0, 
    kickPhase = 'charge', 
    kickProgress = 0, 
    knocked = false, 
    getUpProgress = 0,
    isSprinting = false, 
    isDribbling = false 
} = {}) {
    const pose = character.userData.pose;
    if (!pose) return;

    const measuredSpeed = pose.lastPosition.distanceTo(character.position) / Math.max(dt, 0.0001);
    pose.lastPosition.copy(character.position);
    pose.speed = THREE.MathUtils.lerp(pose.speed, Math.max(measuredSpeed, movement.length()), Math.min(1, dt * 10));

    applyHitFlash(character, pose, elapsedTime);

    const bodyY = pose.bodyBaseY ?? CHARACTER_BODY_Y;
    const headY = pose.headBaseY ?? CHARACTER_HEAD_Y;
    const runAmount = THREE.MathUtils.clamp(pose.speed / 5.2, 0, 1);
    const sprintFactor = isSprinting ? 1.35 : (isDribbling ? 1.18 : 1.0);
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

    const phase = elapsedTime * (7.8 + runAmount * 4.2) * sprintFactor + pose.phase;
    const stride = Math.sin(phase) * runAmount * sprintFactor;
    const counterStride = Math.sin(phase + Math.PI) * runAmount * sprintFactor;
    const lift = Math.abs(Math.sin(phase)) * runAmount * sprintFactor;
    const sideBob = Math.sin(phase * 2) * runAmount;
    
    // Sprint: more knee bend, more arm bend, more vertical bobbing
    const kneeBendMultiplier = isSprinting ? 1.45 : (isDribbling ? 1.28 : 1.0);
    const armBendMultiplier = isSprinting ? 1.35 : (isDribbling ? 1.18 : 1.0);
    const verticalBobMultiplier = isSprinting ? 1.65 : (isDribbling ? 1.25 : 1.0);

    pose.body.position.y = bodyY + lift * 0.035 * verticalBobMultiplier;
    pose.body.rotation.set(-0.08 * runAmount * sprintFactor, 0, sideBob * 0.035);
    updatePlayerNameTagFlash(pose, elapsedTime, lift);
    pose.head.position.y = headY + lift * 0.035 * verticalBobMultiplier;
    pose.head.rotation.set(0, 0, -sideBob * 0.025);

    setArmPose(pose.leftArm, -0.46 * counterStride - 0.08, (0.34 + 0.22 * Math.max(counterStride, 0)) * armBendMultiplier, 0.08);
    setArmPose(pose.rightArm, -0.46 * stride - 0.08, (0.34 + 0.22 * Math.max(stride, 0)) * armBendMultiplier, -0.08);
    setLegPose(pose.leftLeg, 0.66 * stride, (0.72 * Math.max(-stride, 0) + 0.16 * runAmount) * kneeBendMultiplier, -0.05);
    setLegPose(pose.rightLeg, 0.66 * counterStride, (0.72 * Math.max(-counterStride, 0) + 0.16 * runAmount) * kneeBendMultiplier, 0.05);

    if (kicking) {
        const charge = THREE.MathUtils.clamp(kickPower, 0.2, 1);
        if (kickPhase === 'charge') {
            const progress = THREE.MathUtils.clamp(kickProgress, 0, 1);
            const swing = Math.sin(progress * Math.PI * 0.5);
            const landing = Math.sin(progress * Math.PI);
            pose.visualRoot.position.y += landing * 0.18;
            pose.body.position.y = bodyY - 0.04 + landing * 0.08;
            pose.body.rotation.x = THREE.MathUtils.lerp(0.18, -0.16, swing);
            pose.head.position.y = headY - 0.04 + landing * 0.08;
            setLegPose(pose.leftLeg, -0.18, 0.46 * (1 - swing), -0.08);
            setLegPose(pose.rightLeg, THREE.MathUtils.lerp(-1.18, 0.92, swing), THREE.MathUtils.lerp(1.12, 0.28, swing), 0.04);
        } else {
            pose.visualRoot.position.y -= 0.07 * charge;
            pose.body.position.y = bodyY - 0.04 - 0.04 * charge;
            pose.body.rotation.x = 0.14 * charge;
            pose.head.position.y = headY - 0.05 - 0.03 * charge;
            setLegPose(pose.leftLeg, -0.12, 0.54 + charge * 0.22, -0.08);
            setLegPose(pose.rightLeg, -0.76 - charge * 0.52, 0.9 + charge * 0.28, 0.04);
        }
        setArmPose(pose.leftArm, 0.46, 0.4, 0.24);
        setArmPose(pose.rightArm, -0.58, 0.28, -0.24);
    }
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

function applyHitFlash(character, pose, elapsedTime) {
    if (elapsedTime < (character.userData.hitFlashUntil || 0)) {
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

export function flashCharacterHit(character, elapsedTime, duration = 0.18) {
    character.userData.hitFlashUntil = Math.max(character.userData.hitFlashUntil || 0, elapsedTime + duration);
}

function setArmPose(limb, shoulderSwing, elbowBend, sideSplay) {
    limb.hip.rotation.set(shoulderSwing, 0, sideSplay);
    limb.knee.rotation.set(-elbowBend, 0, 0);
}

function setLegPose(limb, hipSwing, kneeBend, sideSplay) {
    limb.hip.rotation.set(hipSwing, 0, sideSplay);
    limb.knee.rotation.set(kneeBend, 0, 0);
}
