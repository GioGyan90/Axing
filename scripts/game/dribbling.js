import * as THREE from 'three';
import { BALL_GROUND_Y } from './config.js';

const DRIBBLE_CAPTURE_RADIUS = 0.9;
const DRIBBLE_RETOUCH_RESET_RADIUS = 1.05;
const DRIBBLE_FOOT_DISTANCE = 0.48;
const DRIBBLE_FOOT_SIDE_OFFSET = 0.14;

/**
 * 更新球员带球逻辑。
 *
 * 带球时将足球锁在当前面向的脚下位置，避免跑动动画中球被惯性拉远；
 * 双击后方向键会临时解除带球锁定，玩家离开球后需要再次触球才能重新进入带球状态。
 */
export function updateDribbling({ dt, state, keys, player, ball, getAimDirection, elapsedTime }) {
    const distanceToBall = flatDistance(player.position, ball.position);

    if (state.dribbleNeedsRetouch && distanceToBall > DRIBBLE_RETOUCH_RESET_RADIUS) {
        state.dribbleNeedsRetouch = false;
    }

    if (elapsedTime < state.dribbleBreakUntil || state.dribbleNeedsRetouch) {
        state.isDribbling = false;
        return false;
    }

    const isControllingBall = distanceToBall < DRIBBLE_CAPTURE_RADIUS
        && ball.position.y <= BALL_GROUND_Y + 0.08
        && horizontalSpeed(state.ballVelocity) < 3.8;

    if (!isControllingBall) {
        state.isDribbling = false;
        return false;
    }

    const move = new THREE.Vector3(
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
        0,
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    );

    const aimDirection = getAimDirection();
    const dribbleDirection = move.lengthSq() > 0 ? player.userData.facing.clone() : aimDirection;
    dribbleDirection.y = 0;
    if (dribbleDirection.lengthSq() < 0.001) dribbleDirection.set(0, 0, -1);
    dribbleDirection.normalize();

    if (move.lengthSq() === 0 || state.isChargingKick) {
        player.userData.facing.copy(dribbleDirection);
        player.rotation.y = Math.atan2(dribbleDirection.x, dribbleDirection.z);
    }

    const sideDirection = new THREE.Vector3(dribbleDirection.z, 0, -dribbleDirection.x).normalize();
    const stepPhase = Math.sin(elapsedTime * 12.5);
    const footSide = sideDirection.multiplyScalar(DRIBBLE_FOOT_SIDE_OFFSET * stepPhase);
    const footForward = dribbleDirection.clone().multiplyScalar(DRIBBLE_FOOT_DISTANCE);
    const targetBallPos = player.position.clone().add(footForward).add(footSide);
    targetBallPos.y = BALL_GROUND_Y;

    ball.position.copy(targetBallPos);
    state.ballVelocity.set(0, 0, 0);
    ball.rotation.x += player.userData.velocity.z * dt * 2.4;
    ball.rotation.z -= player.userData.velocity.x * dt * 2.4;
    state.isDribbling = true;
    return true;
}

function horizontalSpeed(velocity) {
    return Math.hypot(velocity.x, velocity.z);
}

function flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
}
