import * as THREE from 'three';
import {BALL_RADIUS, FIELD, DEFENDER_PROFILE as PROFILE} from './config.js';
import {updatePlayerAnimation} from './player-animation.js';
import {MOTION_TIMING} from './football-motion.js';
import {isKnockedDown,getUpProgress} from './knockdown.js';

export function resetDefender({state, defender, elapsedTime = 0}) {
    const enabled = state.keeperLevel === PROFILE.level;
    defender.visible = enabled;
    defender.position.set(PROFILE.spawnX, 0, PROFILE.spawnZ);
    defender.rotation.set(0, 0, 0);
    defender.userData.velocity.set(0, 0, 0);
    defender.userData.facing.set(0, 0, 1);
    defender.userData.knockdown = null;
    defender.userData.combat=null;defender.userData.aiKick=null;defender.userData.slide=null;
    defender.userData.defense = {enabled, readyAt: elapsedTime + PROFILE.gracePeriod,
        nextTackleAt: 0, tackle: null, steals: 0};
    defender.userData.pose.lastPosition.copy(defender.position);
    defender.userData.pose.speed = 0;
    updatePlayerAnimation(defender, {dt: 1 / 60, elapsedTime});
}

export function syncDefenderDifficulty({state, defender, elapsedTime = 0}) {
    if (!defender.userData.defense || defender.userData.defense.enabled !== (state.keeperLevel === PROFILE.level)) {
        resetDefender({state, defender, elapsedTime});
    }
    return defender.userData.defense.enabled;
}

export function updateDefender({dt, state, defender, player, ball, elapsedTime, onSteal = () => {}}) {
    if (!syncDefenderDifficulty({state, defender, elapsedTime})) return;
    const ai = defender.userData.defense;
    if(isKnockedDown(defender.userData.knockdown,elapsedTime)){
        ai.tackle=null;defender.userData.velocity.set(0,0,0);
        updatePlayerAnimation(defender,{dt,elapsedTime,knocked:true,getUpProgress:getUpProgress(defender.userData.knockdown,elapsedTime)});
        return;
    }
    if (state.gameOver || state.isResetting || state.pendingRefereeFailure || state.pendingSaveNotification) {
        ai.tackle = null;
        defender.userData.velocity.set(0, 0, 0);
        updatePlayerAnimation(defender, {dt, elapsedTime});
        return;
    }
    if (elapsedTime < ai.readyAt) {
        defender.userData.velocity.set(0, 0, 0);
        faceBall(defender, ball.position);
        updatePlayerAnimation(defender, {dt, elapsedTime});
        return;
    }
    if (ai.tackle) {
        updateTackle({dt, state, defender, player, ball, elapsedTime, onSteal});
        return;
    }

    // Lead a moving ground ball a little; do not magnetically capture shots.
    const target = ball.position.clone().addScaledVector(state.ballVelocity, PROFILE.anticipation).setY(0);
    const before = defender.position.clone();
    const offset = target.sub(defender.position).setY(0);
    const distance = offset.length();
    const speed = elapsedTime < ai.nextTackleAt - 0.8 ? PROFILE.speed * 0.45 : PROFILE.speed;
    if (distance > 0.52) defender.position.addScaledVector(offset.normalize(), Math.min(distance - 0.52, speed * dt));
    constrainDefender(defender, player);
    defender.userData.velocity.copy(defender.position).sub(before).divideScalar(Math.max(dt, 0.001));
    faceBall(defender, ball.position);
    updatePlayerAnimation(defender, {dt, elapsedTime, movement: defender.userData.velocity});

    if (ball.position.y <= PROFILE.maxBallHeight && flatDistance(defender.position, ball.position) <= PROFILE.tackleRange
        && elapsedTime >= ai.nextTackleAt) {
        const direction = ball.position.clone().sub(defender.position).setY(0).normalize();
        ai.tackle = {started: elapsedTime, start: defender.position.clone(), direction,
            lunge: Math.min(0.18, Math.max(0, flatDistance(defender.position, ball.position) - 0.52)),
            touched: false, previousFoot: null};
        ai.nextTackleAt = elapsedTime + PROFILE.tackleDuration + PROFILE.tackleCooldown;
    }
}

function updateTackle({dt, state, defender, player, ball, elapsedTime, onSteal}) {
    const ai = defender.userData.defense, tackle = ai.tackle;
    const age = elapsedTime - tackle.started;
    const timing = MOTION_TIMING.kick;
    const motionTime = age <= PROFILE.contactTime
        ? THREE.MathUtils.lerp(timing.windup, timing.contact, age / PROFILE.contactTime)
        : THREE.MathUtils.lerp(timing.contact, timing.duration, Math.min(1, (age - PROFILE.contactTime) / (PROFILE.tackleDuration - PROFILE.contactTime)));
    const before = defender.position.clone();
    defender.position.copy(tackle.start).addScaledVector(tackle.direction,
        tackle.lunge * THREE.MathUtils.smoothstep(age / PROFILE.contactTime, 0, 1));
    constrainDefender(defender, player);
    defender.userData.velocity.copy(defender.position).sub(before).divideScalar(Math.max(dt, 0.001));
    defender.rotation.y = Math.atan2(tackle.direction.x, tackle.direction.z);
    defender.userData.facing.copy(tackle.direction);
    const worldDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(defender.getWorldQuaternion(new THREE.Quaternion()));
    updatePlayerAnimation(defender, {dt, elapsedTime, kicking: true, kickTime: motionTime,
        ballPosition: !tackle.touched ? ball.getWorldPosition(new THREE.Vector3()) : null, kickDirection: worldDirection});
    const foot = defender.userData.pose.rightLeg.end.getWorldPosition(new THREE.Vector3());
    const currentBall = ball.getWorldPosition(new THREE.Vector3());
    const previousBall = (state.previousBallPosition || ball.position).clone();
    ball.parent?.localToWorld(previousBall);
    const inContactWindow = age >= PROFILE.contactTime - 0.05 && age <= PROFILE.contactTime + 0.09;
    if (!tackle.touched && inContactWindow && ball.position.y <= PROFILE.maxBallHeight
        && sweptDistance(previousBall, currentBall, tackle.previousFoot || foot, foot) <= BALL_RADIUS + 0.14) {
        tackle.touched = true;
        ai.steals++;
        // Poke the ball toward open space. The player can chase and win it back;
        // a tackle itself never records a failed attempt or moves the ball.
        const side = ball.position.x >= player.position.x ? 1 : -1;
        const escape = new THREE.Vector3(
            THREE.MathUtils.clamp(ball.position.x + side * 2, -FIELD.width / 2 + 0.9, FIELD.width / 2 - 0.9),
            0, THREE.MathUtils.clamp(ball.position.z + 0.75, -FIELD.depth / 2 + 0.9, FIELD.depth / 2 - 0.9)
        ).sub(ball.position).setY(0);
        if (escape.lengthSq() < 0.001) escape.set(-side, 0, 0);
        escape.normalize();
        state.ballVelocity.set(escape.x * 4.6, 0.75, escape.z * 4.6);
        state.isDribbling = false;
        state.dribbleBreakUntil = elapsedTime + 0.8;
        state.dribbleNeedsRetouch = false;
        state.isChargingKick = false;
        state.chargePower = 0;
        if (!state.kickAction?.fired) {
            state.kickAction = null;
            state.kickPoseTimer = 0;
        }
        onSteal();
    }
    tackle.previousFoot = foot;
    if (age >= PROFILE.tackleDuration) ai.tackle = null;
}

function faceBall(defender, target) {
    const direction = target.clone().sub(defender.position).setY(0);
    if (direction.lengthSq() < 0.0001) return;
    defender.userData.facing.copy(direction.normalize());
    defender.rotation.y = Math.atan2(direction.x, direction.z);
}

function constrainDefender(defender, player) {
    const separation = defender.position.clone().sub(player.position).setY(0);
    const distance = separation.length();
    if (distance < 0.65) {
        if (distance < 0.001) separation.set(1, 0, 0); else separation.divideScalar(distance);
        defender.position.copy(player.position).addScaledVector(separation, 0.65);
    }
    defender.position.x = THREE.MathUtils.clamp(defender.position.x, -FIELD.width / 2 + 0.6, FIELD.width / 2 - 0.6);
    defender.position.z = THREE.MathUtils.clamp(defender.position.z, -FIELD.depth / 2 + 0.6, FIELD.depth / 2 - 0.7);
    defender.position.y = 0;
}
const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function sweptDistance(a0, a1, b0, b1) {
    const relative = a0.clone().sub(b0), delta = a1.clone().sub(b1).sub(relative);
    const time = delta.lengthSq() ? THREE.MathUtils.clamp(-relative.dot(delta) / delta.lengthSq(), 0, 1) : 0;
    return relative.addScaledVector(delta, time).length();
}
