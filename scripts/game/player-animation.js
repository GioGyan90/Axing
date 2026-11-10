import * as THREE from 'three';
import {resetFootballPose, applyFootballMotion, groundCharacter, aimKickFoot, updatePoseEffects, MOTION_TIMING} from './football-motion.js';

export function updatePlayerAnimation(character, {
    dt = 1 / 60, elapsedTime = 0, movement = character.userData.velocity,
    kicking = false, kickPower = 0, kickPhase = 'charge', kickProgress = 0,
    kickTime, ballPosition, kickDirection,
    knocked = false, getUpProgress = 0, isSprinting = false, isDribbling = false,
} = {}) {
    const pose = character.userData.pose;
    if (!pose) return;
    resetFootballPose(pose);
    const measuredSpeed = pose.lastPosition.distanceTo(character.position) / Math.max(dt, 0.0001);
    pose.lastPosition.copy(character.position);
    pose.speed = THREE.MathUtils.lerp(pose.speed, Math.max(measuredSpeed, movement.length()), Math.min(1, dt * 10));
    updatePoseEffects(character, elapsedTime);
    if (knocked) {
        pose.visualRoot.rotation.x = -Math.PI / 2 * (1 - getUpProgress);
        groundCharacter(pose);
        return;
    }
    if (kicking) {
        const time = kickTime ?? (kickPhase === 'charge'
            ? MOTION_TIMING.kick.windup * THREE.MathUtils.clamp(kickPower, 0, 1)
            : MOTION_TIMING.kick.windup + (1 - kickProgress) * (MOTION_TIMING.kick.duration - MOTION_TIMING.kick.windup));
        applyFootballMotion(pose, 'kick', time, {plant: true});
        const weight = THREE.MathUtils.smoothstep(time, 0.42, 0.52) * (1 - THREE.MathUtils.smoothstep(time, 0.54, 0.68));
        aimKickFoot(pose, ballPosition, kickDirection || character.userData.facing, weight);
        return;
    }
    const run = THREE.MathUtils.clamp(pose.speed / 5.2, 0, 1);
    const speed = isSprinting ? 1.35 : isDribbling ? 1.18 : 1;
    const phase = elapsedTime * (7.8 + run * 4.2) * speed + pose.phase;
    const stride = Math.sin(phase) * run * speed;
    const lift = Math.abs(Math.sin(phase)) * run;
    pose.body.position.y += lift * 0.035;
    pose.body.rotation.set(-0.08 * run, 0, Math.sin(phase * 2) * run * 0.035);
    pose.head.position.y += lift * 0.035;
    pose.head.rotation.z = -Math.sin(phase * 2) * run * 0.025;
    setArm(pose.leftArm, 0.46 * stride - 0.08, 0.34 + 0.22 * Math.max(-stride, 0), 0.08);
    setArm(pose.rightArm, -0.46 * stride - 0.08, 0.34 + 0.22 * Math.max(stride, 0), -0.08);
    setLeg(pose.leftLeg, 0.66 * stride, (0.72 * Math.max(-stride, 0) + 0.16 * run) * speed, 0.05);
    setLeg(pose.rightLeg, -0.66 * stride, (0.72 * Math.max(stride, 0) + 0.16 * run) * speed, -0.05);
    groundCharacter(pose);
}
const setArm = (limb, swing, bend, splay) => {limb.hip.rotation.set(swing, 0, splay); limb.knee.rotation.set(-bend, 0, 0);};
const setLeg = (limb, swing, bend, splay) => {limb.hip.rotation.set(swing, 0, splay); limb.knee.rotation.set(bend, 0, 0);};
