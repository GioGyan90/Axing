import * as THREE from 'three';
import { BALL_GROUND_Y } from './config.js';
import { horizontalSpeed, flatDistance } from './rules.js';

/**
 * 更新球员带球逻辑
 * 当球员靠近球且球速较慢时，进入带球状态
 * 带球时通过弹簧 - 阻尼系统让球自然跟随
 * 小幅度移动时球能跟上，大幅度快速横移时球因惯性拉脱
 */
export function updateDribbling({ dt, state, keys, player, ball, getAimDirection, elapsedTime }) {
    const distanceToBall = flatDistance(player.position, ball.position);
    const isControllingBall = distanceToBall < 0.9 && ball.position.y <= BALL_GROUND_Y + 0.08 && horizontalSpeed(state.ballVelocity) < 3.8;
    
    if (!isControllingBall) return false;
    
    const aimDirection = getAimDirection();
    if (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD') ||
        keys.has('ArrowUp') || keys.has('ArrowDown') || keys.has('ArrowLeft') || keys.has('ArrowRight')) {
        // 有移动输入时使用移动方向
    } else if (state.isChargingKick) {
        // 蓄力时使用瞄准方向
        player.userData.facing.copy(aimDirection);
        player.rotation.y = Math.atan2(aimDirection.x, aimDirection.z);
    }
    
    // 计算带球方向
    const move = new THREE.Vector3(
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
        0,
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    );
    
    const dribbleDirection = move.lengthSq() > 0 ? player.userData.facing.clone() : aimDirection;
    
    // 计算理想的目标球位置：基于当前球相对位置，但限制在球员前方扇形区域内
    const ballOffset = ball.position.clone().sub(player.position);
    ballOffset.y = 0;
    const distToPlayer = ballOffset.length();
    
    // 理想距离：球应该保持在球员前方 0.45-0.65 单位处
    const idealDist = 0.55;
    let targetBallPos;
    
    if (distToPlayer > 0.01) {
        // 计算球相对于球员朝向的角度
        const forward = dribbleDirection.clone();
        const angleToForward = forward.angleTo(ballOffset.clone().normalize());
        
        // 如果球在身后或侧面太远，将其拉回前方
        const maxAngle = THREE.MathUtils.degToRad(70); // 允许的最大角度
        
        // 计算目标方向：在球员朝向前方 clampedAngle 范围内
        const targetDir = ballOffset.clone().normalize();
        if (angleToForward > maxAngle) {
            // 球在太侧面的位置，将其投影到最大角度方向
            const projection = forward.clone().multiplyScalar(Math.cos(maxAngle));
            const sideDir = ballOffset.clone().normalize().sub(forward.clone().multiplyScalar(Math.cos(angleToForward))).normalize();
            targetDir.copy(projection.addScaledVector(sideDir, Math.sin(maxAngle))).normalize();
        }
        
        targetBallPos = player.position.clone().add(targetDir.multiplyScalar(idealDist));
    } else {
        // 球就在脚下，放在正前方
        targetBallPos = player.position.clone().add(dribbleDirection.clone().multiplyScalar(idealDist));
    }
    
    // 计算将球拉向理想位置所需的加速度
    const toTarget = targetBallPos.clone().sub(ball.position);
    toTarget.y = 0;
    const distanceToTarget = toTarget.length();
    
    // 弹簧力系数和阻尼
    const springConstant = 22.0;
    const dampingFactor = 7.5;
    
    // 计算弹簧力产生的加速度
    let acceleration = toTarget.normalize().multiplyScalar(distanceToTarget * springConstant);
    
    // 添加阻尼（抵抗球的当前速度）
    const ballHorizontalVel = new THREE.Vector3(state.ballVelocity.x, 0, state.ballVelocity.z);
    const dampingForce = ballHorizontalVel.multiplyScalar(-dampingFactor);
    acceleration.add(dampingForce);
    
    // 限制最大加速度，实现拉脱效果
    const maxAcceleration = 18.0;
    if (acceleration.length() > maxAcceleration) {
        acceleration.normalize().multiplyScalar(maxAcceleration);
    }
    
    // 应用加速度到球的速度
    state.ballVelocity.x += acceleration.x * dt;
    state.ballVelocity.z += acceleration.z * dt;
    
    return true;
}
