import * as THREE from 'three';
import {resetFootballPose, applyFootballMotion, groundCharacter, aimKeeperHands, updatePoseEffects, MOTION_TIMING} from './football-motion.js';

export function updateGoalkeeperAnimation(keeper, {
    elapsedTime = 0, knocked = false, getUpProgress = 0,
    diving = false, diveProgress = 0, diveDirection = 1,
    punching = false, scooping = false, punchProgress = 0, motionTime, saveHeight = 0.55, saveTarget,
} = {}) {
    const pose = keeper.userData.pose;
    if (!pose) return;
    resetFootballPose(pose);
    updatePoseEffects(keeper, elapsedTime);
    if (knocked) {
        const recovery = THREE.MathUtils.clamp(getUpProgress, 0, 1);
        applyFootballMotion(pose, 'diveLeft', THREE.MathUtils.lerp(0.9, 1.6, recovery));
        return;
    }
    if (diving || punching || scooping) {
        const id = scooping ? 'scoop' : punching ? 'punch' : diveDirection >= 0 ? 'diveLeft' : 'diveRight';
        const timing = MOTION_TIMING[id];
        const time = motionTime ?? timing.duration * (punching ? punchProgress : diveProgress);
        const rise = THREE.MathUtils.smoothstep(time, 0.14, timing.contact);
        const fall = 1 - THREE.MathUtils.smoothstep(time, timing.contact, timing.land);
        const height = punching ? Math.max(0.12, saveHeight - 2.05) : Math.max(0, saveHeight - 0.55);
        applyFootballMotion(pose, id, time, {lift: rise * fall * height});
        const reach = THREE.MathUtils.smoothstep(time, 0.2, timing.contact) * (1 - THREE.MathUtils.smoothstep(time, timing.contact + 0.12, timing.land));
        aimKeeperHands(pose, saveTarget, reach);
        return;
    }
    // The first pose is also the last recovery pose, so a save never snaps back
    // to the old upright arms-down stance.
    applyFootballMotion(pose, 'diveLeft', 0);
    pose.head.rotation.x -= 0.015 * Math.sin(elapsedTime * 4.5);
    groundCharacter(pose);
}
