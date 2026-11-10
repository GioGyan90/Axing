import * as THREE from 'three';
import {BALL_GROUND_Y, BALL_RADIUS, FIELD} from './config.js';
import {updateGoalkeeperAnimation} from './goalkeeper-animation.js';
import {MOTION_TIMING} from './football-motion.js';

export const KEEPER_STATE = Object.freeze({
    IDLE: 'idle', SQUAT: 'squat', JUMP: 'jump', DIVE: 'dive',
    LAND: 'land', GET_UP: 'getUp', KNOCKED: 'knocked',
    CHARGE: 'charge', RETURN: 'return', PUNCH: 'punch', SCOOP: 'scoop',
});

// Predict the same bounce/gravity/damping as updateBall, facing +Z into the
// pitch. Prediction chooses an animation; it never changes the ball velocity.
export function predictKeeperSave(keeper, ball, velocity, profile) {
    if (velocity.z >= -1.5 || ball.position.z < keeper.position.z - 0.2) return null;
    const offset = ball.position.clone().sub(keeper.position);
    offset.y = 0;
    if (offset.length() > profile.sectorRadius || Math.atan2(Math.abs(offset.x), offset.z) > profile.visionAngle) return null;
    const point = ball.position.clone(), speed = velocity.clone();
    const plane = keeper.position.z + 0.3;
    const step = 1 / 120;
    let time = 0;
    while (point.z > plane && time < 0.55) {
        point.addScaledVector(speed, step);
        speed.y -= 15.5 * step;
        if (point.y <= BALL_GROUND_Y) {
            point.y = BALL_GROUND_Y;
            const rebound = -speed.y * 0.56;
            if (speed.y < 0) speed.y = rebound > 0.38 ? rebound : 0;
        }
        const damping = Math.pow(point.y > BALL_GROUND_Y + 0.02 ? 0.992 : 0.982, step * 60);
        speed.x *= damping;
        speed.z *= damping;
        time += step;
    }
    if (point.z > plane + 0.1 || point.y > 2.65 || Math.abs(point.x) > 2.9) return null;
    const distance = Math.abs(point.x - keeper.position.x);
    if (distance > (profile.diveReach || 1.6) + 0.65) return null;
    return {point, time: Math.max(0.08, time), side: point.x >= keeper.position.x ? 1 : -1,
        kind: point.y > 1.35 && distance < 0.85 ? 'punch' : distance < 0.45 && point.y < 1.35 ? 'scoop' : 'dive'};
}

export function beginKeeperSave({state, keeper, ball, elapsedTime, profile}, prediction) {
    const predicted = prediction || predictKeeperSave(keeper, ball, state.ballVelocity, profile);
    if (!predicted) return false;
    const id = predicted.kind === 'dive' ? predicted.side > 0 ? 'diveLeft' : 'diveRight' : predicted.kind;
    const timing = MOTION_TIMING[id];
    keeper.rotation.y = 0;
    keeper.position.y = 0;
    keeper.scale.set(1, 1, 1);
    const start = keeper.position.clone();
    // Measure this character's actual baked glove position, then place the
    // lateral leap continuously. Large imported heads affect landing height.
    updateGoalkeeperAnimation(keeper, {elapsedTime, diving: predicted.kind === 'dive', punching: predicted.kind === 'punch', scooping: predicted.kind === 'scoop', diveDirection: predicted.side, motionTime: timing.contact, saveHeight: predicted.point.y});
    const pose = keeper.userData.pose;
    const gloves = pose.leftArm.end.getWorldPosition(new THREE.Vector3()).add(pose.rightArm.end.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    keeper.parent?.worldToLocal(gloves);
    const end = start.clone();
    end.x += THREE.MathUtils.clamp(predicted.point.x - gloves.x, -(profile.diveReach || 1.6), profile.diveReach || 1.6);
    end.z += THREE.MathUtils.clamp(predicted.point.z - gloves.z, -0.55, 0.55);
    end.x = THREE.MathUtils.clamp(end.x, -FIELD.width / 2 + 0.65, FIELD.width / 2 - 0.65);
    state.keeperSave = {id, kind: predicted.kind, side: predicted.side, start, end, point: predicted.point.clone(),
        started: elapsedTime, lead: predicted.time, duration: predicted.time + (timing.duration - timing.contact) / 1.25,
        deflected: false, previousGloves: null};
    state.keeperActionStart = elapsedTime;
    state.keeperMode = predicted.kind;
    state.keeperState = predicted.kind === 'punch' ? KEEPER_STATE.PUNCH : predicted.kind === 'scoop' ? KEEPER_STATE.SCOOP : KEEPER_STATE.SQUAT;
    state.isDiving = predicted.kind === 'dive';
    updateGoalkeeperAnimation(keeper, {elapsedTime, diving: predicted.kind === 'dive', punching: predicted.kind === 'punch', scooping: predicted.kind === 'scoop', diveDirection: predicted.side, motionTime: 0, saveHeight: predicted.point.y});
    return true;
}

export function updateKeeperSave({dt, state, keeper, ball, elapsedTime, onKeeperSave, profile}) {
    const save = state.keeperSave;
    if (!save) return false;
    const age = Math.max(0, elapsedTime - save.started);
    const timing = MOTION_TIMING[save.id];
    const time = age <= save.lead ? timing.contact * age / save.lead : timing.contact + (age - save.lead) * 1.25;
    const before = keeper.position.clone();
    const travel = THREE.MathUtils.smoothstep(age / save.lead, 0, 1);
    keeper.position.copy(save.start).lerp(save.end, travel);
    keeper.userData.velocity.copy(keeper.position).sub(before).divideScalar(Math.max(dt, 0.001));
    keeper.scale.set(1, 1, 1);
    const target = save.point.clone();
    keeper.parent?.localToWorld(target);
    updateGoalkeeperAnimation(keeper, {elapsedTime, diving: save.kind === 'dive', punching: save.kind === 'punch', scooping: save.kind === 'scoop',
        motionTime: time, diveDirection: save.side, saveHeight: save.point.y, saveTarget: target});
    state.keeperState = save.kind === 'punch' && time < timing.land ? KEEPER_STATE.PUNCH
        : time < 0.15 ? KEEPER_STATE.SQUAT : time < 0.35 ? KEEPER_STATE.JUMP
        : time < timing.land ? KEEPER_STATE.DIVE : time < timing.land + 0.15 ? KEEPER_STATE.LAND : KEEPER_STATE.GET_UP;
    const gloves = [keeper.userData.pose.leftArm.end, keeper.userData.pose.rightArm.end].map(hand => hand.getWorldPosition(new THREE.Vector3()));
    const ballNow = ball.getWorldPosition(new THREE.Vector3());
    const ballBefore = (state.previousBallPosition || ball.position).clone();
    ball.parent?.localToWorld(ballBefore);
    const inContactPhase = time >= 0.2 && time <= timing.land;
    if (!save.deflected && inContactPhase) {
        let touched = gloves.some((hand, i) => sweptDistance(ballBefore, ballNow, save.previousGloves?.[i] || hand, hand) < BALL_RADIUS + 0.12);
        // Chest blocks remain possible, but a remote predicted intersection
        // alone is never reported as a successful save.
        if (!touched) {
            const chest = keeper.userData.pose.body.getWorldPosition(new THREE.Vector3());
            chest.y += 0.1;
            touched = ballNow.distanceTo(chest) < BALL_RADIUS + 0.32;
        }
        if (touched) {
            save.deflected = true;
            state.lastKeeperSaveTime = elapsedTime;
            const clearPower = profile.diveClearPower || 8.5;
            state.ballVelocity.set(save.side * clearPower * (save.kind === 'punch' ? 0.6 : 0.85), save.kind === 'punch' ? 5.2 : 3.2, clearPower * 0.65);
            onKeeperSave(save.kind === 'punch' ? '高空球也是我的！' : '这球我扑到了！');
        }
    }
    save.previousGloves = gloves;
    if (age >= save.duration) {
        state.keeperSave = null;
        state.isDiving = false;
        state.keeperState = KEEPER_STATE.IDLE;
        state.keeperMode = 'guard';
        keeper.position.y = 0;
        keeper.userData.velocity.set(0, 0, 0);
    }
    return true;
}

function sweptDistance(a0, a1, b0, b1) {
    const relative = a0.clone().sub(b0);
    const delta = a1.clone().sub(b1).sub(relative);
    const t = delta.lengthSq() ? THREE.MathUtils.clamp(-relative.dot(delta) / delta.lengthSq(), 0, 1) : 0;
    return relative.addScaledVector(delta, t).length();
}

// Existing exports keep callers compatible with the unified save controller.
export function checkHighBallPunch(keeper, ball, velocity, profile, elapsedTime, lastSaveTime, getUpUntil, isResetting) {
    return !isResetting && elapsedTime >= getUpUntil && elapsedTime - lastSaveTime > profile.saveCooldown
        && predictKeeperSave(keeper, ball, velocity, profile)?.kind === 'punch';
}
export const performHighBallPunch = context => beginKeeperSave(context);
export const updatePunchAnimation = context => updateKeeperSave(context);
