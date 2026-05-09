import * as THREE from 'three';
import { BALL_GROUND_Y, BALL_RADIUS, FIELD, KEEPER_PROFILES } from './config.js';
import { flashCharacterHit, updateCharacterPose } from './assets.js';
import { kickBall, kickDownKeeper } from './kicking.js';
import { updateDribbling } from './dribbling.js';

// 重新导出 kicking.js 中的函数，供 main.js 使用
export { kickBall, kickDownKeeper };

export const MAX_ATTEMPTS = 5;
export const GOALS_TO_WIN = 3;
export const FAILURES_TO_LOSE = 3;
const KEEPER_MIN_KNOCKDOWN_DURATION = 3;
const KEEPER_MAX_KNOCKDOWN_DURATION = 5;
const KEEPER_GET_UP_DURATION = 0.6;
const KICK_RELEASE_DURATION = 0.46;
const REFEREE_WARNING_DURATION = 1;
const REFEREE_PATROL_SPEED = 3.2;
const REFEREE_VISION_RADIUS = 7.5;
const REFEREE_VISION_HALF_ANGLE = THREE.MathUtils.degToRad(55);

// 门将状态枚举
export const KEEPER_STATE = {
    IDLE: 'idle',           // 空闲站立
    SQUAT: 'squat',         // 下蹲蓄力
    JUMP: 'jump',           // 弹跳腾空
    DIVE: 'dive',           // 倒地伸展
    LAND: 'land',           // 落地缓冲
    GET_UP: 'getUp',        // 起身恢复
    KNOCKED: 'knocked',     // 被击倒
    CHARGE: 'charge',       // 前冲击球
    RETURN: 'return',       // 返回位置
};
const KEEPER_TAUNTS = Object.freeze([
    '靠！你来真的啊？',
    '妈呀，犯规了吧！',
    '混蛋，我记住你了！',
    '哎哟，疼死老子了！',
    '臭小子，别得意！',
    '你个小王*蛋，裁判呢？',
    '别踢人啊，缺不缺德！',
    '我*，这脚真阴！',
    '去你的，球门不是拳击台！',
    '你大*爷的，疼懵了！',
    '再来一下我可翻脸了！',
    '臭不要脸，专挑门将下脚？',
    '你这混球，踢球还是踢人？',
    '我服了，你脚上有钉子啊！',
    '死不讲理，给我等着！',
    '小兔崽子，犯规犯上瘾了？',
    '靠边站，别逼我铲你！',
    '你个坏种，疼死我了！',
    '裁判眼瞎了吗？这都不吹！',
    '我真是倒了八辈子霉！',
]);

const KEEPER_SAVE_TAUNTS = Object.freeze([
    '就这？我热身都没出汗！',
    '射得不错，可惜我更不错！',
    '球门今天归我管，懂？',
    '再瞄准一点吧，太好猜了！',
    '这脚软得像棉花糖！',
    '你射门，我收快递！',
    '别急，下一脚我也接着！',
    '想进球？先问问我的手套！',
    '这球我闭眼都能扑！',
    '你的射门说明书丢了吗？',
    '门前禁飞区，退后！',
    '球来了，分数留下！',
    '今天的球门上锁了！',
    '这角度，我早就看穿了！',
    '省点力气吧，还是我赢！',
]);

const REFEREE_WARNINGS = Object.freeze([
    '主裁判看见了！恶意踢人，红牌！',
    '哨声响起：袭击门将，比赛判负！',
    '裁判警告：这不是格斗赛！',
    'VAR 都不用看，踢人犯规！',
    '主裁举牌：故意踢守门员！',
    '警告！裁判视野内禁止踢人！',
    '犯规动作太明显，本局要被判负！',
    '裁判怒了：冲人不冲球！',
    '哔——恶意犯规，马上判负！',
    '被主裁抓现行了，别装无辜！',
    '裁判记录犯规：踢倒门将！',
    '场上纪律警告：暴力动作！',
    '主裁判跑来警告：停止踢人！',
    '视野内犯规成立，本局失败！',
    '裁判盯着呢，踢门将要付出代价！',
]);

export function createGameState() {
    return {
        playerScore: 0,
        keeperScore: 0,
        outScore: 0,
        attempts: Array(MAX_ATTEMPTS).fill(null),
        attemptCount: 0,
        gameOver: false,
        ballVelocity: new THREE.Vector3(),
        messageTimer: 0,
        keeperBubbleTimer: 0,
        isResetting: false,
        isChargingKick: false,
        chargeStartTime: 0,
        chargePower: 0,
        lastKeeperSaveTime: -10,
        keeperLevel: 1,
        kickPoseTimer: 0,
        kickPoseDuration: KICK_RELEASE_DURATION,
        kickPosePower: 0,
        keeperMode: 'guard',
        keeperState: KEEPER_STATE.IDLE, // 门将详细状态机状态
        keeperChargeUntil: 0,
        keeperDownUntil: 0,
        keeperGetUpUntil: 0,
        keeperDiveUntil: 0,
        keeperActionStart: 0, // 当前动作开始时间
        isDiving: false,
        lastKeeperKnockdownTime: -10,
        pendingRefereeFailure: false,
        refereeWarningUntil: 0,
        refereeWarningMessage: '',
        isSprinting: false,
        sprintStartTime: 0,
        sprintCooldownUntil: 0,
        pendingSaveNotification: false,
        predictedInterceptPoint: null, // 预判的拦截点
    };
}

export function resetGameProgress(state) {
    state.playerScore = 0;
    state.keeperScore = 0;
    state.outScore = 0;
    state.attempts.fill(null);
    state.attemptCount = 0;
    state.gameOver = false;
    state.pendingRefereeFailure = false;
    state.refereeWarningUntil = 0;
    state.refereeWarningMessage = '';
    state.pendingSaveNotification = false;
}

export function recordAttemptResult(state, result) {
    if (state.gameOver || state.attemptCount >= MAX_ATTEMPTS) return null;
    state.attempts[state.attemptCount] = result;
    state.attemptCount += 1;
    if (result === 'goal') state.playerScore += 1;
    if (result === 'save') state.keeperScore += 1;
    if (result === 'out') state.outScore += 1;
    if (result === 'foul') state.keeperScore += 1;

    if (state.playerScore >= GOALS_TO_WIN) {
        state.gameOver = true;
        return { outcome: 'win', reason: 'goal' };
    }
    if (state.keeperScore + state.outScore >= FAILURES_TO_LOSE) {
        state.gameOver = true;
        return { outcome: 'lose', reason: result === 'out' ? 'out' : (result === 'foul' ? 'foul' : 'save') };
    }
    if (state.attemptCount >= MAX_ATTEMPTS) {
        state.gameOver = true;
        return { outcome: 'lose', reason: 'attempts' };
    }
    return null;
}

export function updateChargePower(state, elapsedTime) {
    if (!state.isChargingKick || state.gameOver) return;
    state.chargePower = THREE.MathUtils.clamp((elapsedTime - state.chargeStartTime) / 0.675, 0.18, 1);
}

export function startKickCharge(state, elapsedTime) {
    if (state.gameOver || state.isChargingKick) return false;
    state.isChargingKick = true;
    state.chargeStartTime = elapsedTime;
    updateChargePower(state, elapsedTime);
    return true;
}

export function releaseKickCharge(state, elapsedTime, kickBall) {
    if (!state.isChargingKick) return false;
    updateChargePower(state, elapsedTime);
    state.isChargingKick = false;
    if (kickBall(state.chargePower)) {
        state.kickPoseTimer = KICK_RELEASE_DURATION;
        state.kickPoseDuration = KICK_RELEASE_DURATION;
        state.kickPosePower = state.chargePower;
    }
    state.chargePower = 0;
    return true;
}

export function cancelKickCharge(state) {
    state.isChargingKick = false;
    state.chargePower = 0;
}

// kickBall and kickDownKeeper are now exported from kicking.js
// These wrapper functions maintain backward compatibility
export function kickBallWrapper({ state, player, ball, getAimDirection, showMessage }, powerRatio = 0.35) {
    // This function is kept for backward compatibility but delegates to kicking.js
    return kickBall({ state, player, ball, getAimDirection, showMessage }, powerRatio);
}

export function kickDownKeeperWrapper({ state, player, keeper, referee, elapsedTime, showMessage, onKeeperTaunt, onKeeperHit, onRefereeFoul }, powerRatio = 0.35) {
    // This function is kept for backward compatibility but delegates to kicking.js
    return kickDownKeeper({ state, player, keeper, referee, elapsedTime, showMessage, onKeeperTaunt, onKeeperHit, onRefereeFoul }, powerRatio);
}

export function updateReferee({ dt, state, referee, player, keeper, elapsedTime }) {
    if (!referee) return;
    const patrolPhase = elapsedTime * 0.55;
    const playerSide = player.position.x >= 0 ? -1 : 1;
    const sidelineOffset = FIELD.width / 2 + 0.3;
    const sidelineShadow = playerSide * sidelineOffset;
    const sweep = Math.sin(patrolPhase) * 1.05;
    const target = new THREE.Vector3(
        THREE.MathUtils.clamp(sidelineShadow + sweep, -FIELD.width / 2 - 0.5, FIELD.width / 2 + 0.5),
        0,
        THREE.MathUtils.clamp(player.position.z + 1.7 + Math.cos(patrolPhase * 0.8) * 0.8, FIELD.goalZ + 1.0, FIELD.depth / 2 - 1.05)
    );

    if (state.gameOver) {
        referee.userData.velocity.set(0, 0, 0);
    } else {
        moveKeeperToward(referee, target, REFEREE_PATROL_SPEED, dt);
    }

    const watchTarget = state.pendingRefereeFailure ? player.position : keeper.position.clone().lerp(player.position, 0.45);
    referee.rotation.y = Math.atan2(watchTarget.x - referee.position.x, watchTarget.z - referee.position.z);
    updateCharacterPose(referee, { dt, elapsedTime, movement: referee.userData.velocity });
}

export function consumeRefereeFailureIfReady(state, elapsedTime) {
    if (!state.pendingRefereeFailure || elapsedTime < state.refereeWarningUntil) return false;
    state.pendingRefereeFailure = false;
    state.refereeWarningUntil = 0;
    return true;
}

function isInRefereeVision(target, referee) {
    const offset = target.clone().sub(referee.position);
    offset.y = 0;
    const distance = offset.length();
    if (distance > REFEREE_VISION_RADIUS || distance < 0.001) return false;
    offset.normalize();
    const forward = new THREE.Vector3(Math.sin(referee.rotation.y), 0, Math.cos(referee.rotation.y)).normalize();
    const angle = forward.angleTo(offset);
    return angle <= REFEREE_VISION_HALF_ANGLE;
}

export function updatePlayer({ dt, state, keys, player, ball, getAimDirection, elapsedTime }) {
    if (state.gameOver) {
        player.userData.velocity.set(0, 0, 0);
        updateCharacterPose(player, { dt, elapsedTime, movement: player.userData.velocity });
        return;
    }
    
    // Sprint logic: hold Shift to sprint for 5 seconds, then 2 second cooldown
    const canSprint = elapsedTime >= state.sprintCooldownUntil;
    const wantToSprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    
    if (wantToSprint && canSprint && !state.isSprinting) {
        state.isSprinting = true;
        state.sprintStartTime = elapsedTime;
    }
    
    if (state.isSprinting) {
        const sprintElapsed = elapsedTime - state.sprintStartTime;
        if (sprintElapsed >= 5.0) {
            state.isSprinting = false;
            state.sprintCooldownUntil = elapsedTime + 2.0;
        }
    }
    
    const move = new THREE.Vector3(
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
        0,
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    );
    
    const baseSpeed = 6.1;
    const sprintMultiplier = state.isSprinting ? 1.5 : 1.0;
    const currentSpeed = baseSpeed * sprintMultiplier;
    
    if (move.lengthSq() > 0) {
        move.normalize();
        player.userData.facing.copy(move);
        player.rotation.y = Math.atan2(move.x, move.z);
    }
    player.userData.velocity.copy(move).multiplyScalar(currentSpeed);
    player.position.addScaledVector(move, currentSpeed * dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -FIELD.width / 2 + 0.6, FIELD.width / 2 - 0.6);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -FIELD.depth / 2 + 0.6, FIELD.depth / 2 - 0.7);
    state.kickPoseTimer = Math.max(0, state.kickPoseTimer - dt);
    updateCharacterPose(player, {
        dt,
        elapsedTime,
        movement: player.userData.velocity,
        kicking: state.isChargingKick || state.kickPoseTimer > 0,
        kickPower: state.kickPoseTimer > 0 ? state.kickPosePower : state.chargePower,
        kickPhase: state.kickPoseTimer > 0 ? 'release' : 'charge',
        kickProgress: state.kickPoseTimer > 0 ? state.kickPoseTimer / Math.max(state.kickPoseDuration, 0.001) : 0,
        isSprinting: state.isSprinting,
    });

    const distanceToBall = flatDistance(player.position, ball.position);
    const isControllingBall = distanceToBall < 0.9 && ball.position.y <= BALL_GROUND_Y + 0.08 && horizontalSpeed(state.ballVelocity) < 3.8;
    if (isControllingBall) {
        const aimDirection = getAimDirection();
        if (move.lengthSq() === 0 || state.isChargingKick) {
            player.userData.facing.copy(aimDirection);
            player.rotation.y = Math.atan2(aimDirection.x, aimDirection.z);
        }
        
        // 带球物理：通过限制最大加速度实现自然的球跟随效果
        // 小幅度移动时球能跟上，大幅度快速横移时球因惯性拉脱
        const dribbleDirection = move.lengthSq() > 0 ? player.userData.facing.clone() : aimDirection;
        
        // 计算理想的目标球位置：基于当前球相对位置，但限制在球员前方扇形区域内
        // 这样无论纵向还是横向移动，球都能自然跟随
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
            const clampedAngle = Math.min(angleToForward, maxAngle);
            
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
        // 纵向加速度限制较宽松，横向加速度限制较严格
        const maxAcceleration = 18.0;
        if (acceleration.length() > maxAcceleration) {
            acceleration.normalize().multiplyScalar(maxAcceleration);
        }
        
        // 应用加速度到球的速度
        state.ballVelocity.x += acceleration.x * dt;
        state.ballVelocity.z += acceleration.z * dt;
    }
}

export function updateBall({ dt, state, ball }) {
    ball.position.addScaledVector(state.ballVelocity, dt);
    state.ballVelocity.y -= 15.5 * dt;
    const groundY = BALL_GROUND_Y;
    if (ball.position.y <= groundY) {
        ball.position.y = groundY;
        if (state.ballVelocity.y < 0) {
            const rebound = -state.ballVelocity.y * 0.56;
            state.ballVelocity.y = rebound > 0.38 ? rebound : 0;
        }
    }

    const horizontalDamping = Math.pow(ball.position.y > groundY + 0.02 ? 0.992 : 0.982, dt * 60);
    state.ballVelocity.x *= horizontalDamping;
    state.ballVelocity.z *= horizontalDamping;
    if (horizontalSpeed(state.ballVelocity) < 0.02) {
        state.ballVelocity.x = 0;
        state.ballVelocity.z = 0;
    }

    ball.rotation.x += state.ballVelocity.z * dt * 2.2;
    ball.rotation.z -= state.ballVelocity.x * dt * 2.2;
    
    checkGoalPostCollision(ball, state);
}

function checkGoalPostCollision(ball, state) {
    const postRadius = 0.08 + BALL_RADIUS;
    const postPositions = [
        { x: -2.65, z: FIELD.goalZ },
        { x: 2.65, z: FIELD.goalZ },
    ];
    
    for (const post of postPositions) {
        const dx = ball.position.x - post.x;
        const dz = ball.position.z - post.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < postRadius && ball.position.y < 2.4) {
            const normal = new THREE.Vector3(dx, 0, dz).normalize();
            const dot = state.ballVelocity.x * normal.x + state.ballVelocity.z * normal.z;
            
            if (dot < 0) {
                const restitution = 0.7;
                state.ballVelocity.x -= (1 + restitution) * dot * normal.x;
                state.ballVelocity.z -= (1 + restitution) * dot * normal.z;
                
                const overlap = postRadius - distance;
                ball.position.x += normal.x * overlap;
                ball.position.z += normal.z * overlap;
            }
        }
    }
    
    const crossbarY = 2.38;
    const crossbarHalfWidth = 2.65;
    const crossbarRadius = 0.08 + BALL_RADIUS;
    
    if (ball.position.y < crossbarY + 0.5 && Math.abs(ball.position.x) < crossbarHalfWidth + crossbarRadius) {
        const distToCrossbar = Math.abs(ball.position.z - FIELD.goalZ);
        const verticalDist = Math.abs(ball.position.y - crossbarY);
        
        if (distToCrossbar < crossbarRadius && verticalDist < crossbarRadius + 0.2) {
            if (ball.position.y < crossbarY) {
                state.ballVelocity.y = Math.abs(state.ballVelocity.y) * 0.6 + 0.3;
                ball.position.y = crossbarY - crossbarRadius;
            } else if (distToCrossbar < crossbarRadius) {
                const normalZ = ball.position.z > FIELD.goalZ ? 1 : -1;
                const dot = state.ballVelocity.z * normalZ;
                if (dot < 0) {
                    const restitution = 0.6;
                    state.ballVelocity.z -= (1 + restitution) * dot;
                    ball.position.z = FIELD.goalZ + normalZ * crossbarRadius;
                }
            }
        }
    }
}

export function updateKeeper({ dt, state, keeper, ball, elapsedTime, onKeeperSave }) {
    if (state.gameOver) {
        keeper.userData.velocity.set(0, 0, 0);
        updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity });
        return;
    }
    
    const profile = KEEPER_PROFILES[state.keeperLevel] || KEEPER_PROFILES[1];
    
    // 处理被击倒状态（优先级最高）
    if (elapsedTime < state.keeperGetUpUntil && state.keeperState !== KEEPER_STATE.KNOCKED) {
        state.keeperMode = 'knocked';
        state.keeperState = KEEPER_STATE.KNOCKED;
        keeper.userData.velocity.set(0, 0, 0);
        const getUpDuration = profile.getUpDuration || 0.6;
        const getUpProgress = elapsedTime <= state.keeperDownUntil
            ? 0
            : THREE.MathUtils.clamp((elapsedTime - state.keeperDownUntil) / getUpDuration, 0, 1);
        updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, knocked: true, getUpProgress });
        keeper.scale.set(1, 1, 1);
        return;
    }
    
    // 状态机处理：根据 keeperState 执行不同行为
    switch (state.keeperState) {
        case KEEPER_STATE.SQUAT: {
            // 下蹲蓄力阶段
            const squatElapsed = elapsedTime - state.keeperActionStart;
            const squatDuration = profile.squatDuration || 0.15;
            if (squatElapsed >= squatDuration) {
                // 转入弹跳阶段
                state.keeperState = KEEPER_STATE.JUMP;
                state.keeperActionStart = elapsedTime;
            } else {
                // 保持下蹲姿势
                const squatProgress = squatElapsed / squatDuration;
                keeper.userData.velocity.set(0, 0, 0);
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, kicking: true, kickPower: squatProgress, kickPhase: 'charge' });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
        
        case KEEPER_STATE.JUMP: {
            // 弹跳腾空阶段
            const jumpElapsed = elapsedTime - state.keeperActionStart;
            const jumpDuration = profile.jumpDuration || 0.2;
            if (jumpElapsed >= jumpDuration) {
                // 转入倒地阶段
                state.keeperState = KEEPER_STATE.DIVE;
                state.keeperActionStart = elapsedTime;
            } else {
                // 腾空姿态
                const jumpProgress = jumpElapsed / jumpDuration;
                keeper.userData.velocity.set(0, 0, 0);
                keeper.position.y = Math.sin(jumpProgress * Math.PI) * 0.8; // 抛物线跳跃
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, diving: true, diveProgress: jumpProgress });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
        
        case KEEPER_STATE.DIVE: {
            // 倒地伸展阶段
            const diveElapsed = elapsedTime - state.keeperActionStart;
            const diveDuration = profile.diveDuration || 0.35;
            if (diveElapsed >= diveDuration) {
                // 转入落地阶段
                state.keeperState = KEEPER_STATE.LAND;
                state.keeperActionStart = elapsedTime;
            } else {
                // 倒地扑救姿态
                const diveProgress = diveElapsed / diveDuration;
                keeper.userData.velocity.set(0, 0, 0);
                keeper.position.y = Math.max(0, 0.8 - diveProgress * 0.8); // 逐渐落地
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, diving: true, diveProgress });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
        
        case KEEPER_STATE.LAND: {
            // 落地缓冲阶段
            const landElapsed = elapsedTime - state.keeperActionStart;
            const landDuration = profile.landDuration || 0.25;
            if (landElapsed >= landDuration) {
                // 转入起身阶段
                state.keeperState = KEEPER_STATE.GET_UP;
                state.keeperActionStart = elapsedTime;
            } else {
                // 落地缓冲姿态
                const landProgress = landElapsed / landDuration;
                keeper.userData.velocity.set(0, 0, 0);
                keeper.position.y = 0;
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, knocked: true, getUpProgress: landProgress * 0.3 });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
        
        case KEEPER_STATE.GET_UP: {
            // 起身恢复阶段
            const getUpElapsed = elapsedTime - state.keeperActionStart;
            const getUpDuration = profile.getUpDuration || 0.5;
            if (getUpElapsed >= getUpDuration) {
                // 恢复空闲状态
                state.keeperState = KEEPER_STATE.IDLE;
                state.keeperMode = 'guard';
                keeper.position.y = 0;
            } else {
                // 起身姿态
                const getUpProgress = getUpElapsed / getUpDuration;
                keeper.userData.velocity.set(0, 0, 0);
                keeper.position.y = 0;
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, knocked: true, getUpProgress });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
        
        case KEEPER_STATE.KNOCKED: {
            // 被击倒状态（由外部触发）
            if (elapsedTime >= state.keeperGetUpUntil) {
                state.keeperState = KEEPER_STATE.GET_UP;
                state.keeperActionStart = elapsedTime;
            } else {
                keeper.userData.velocity.set(0, 0, 0);
                const getUpDuration = profile.getUpDuration || 0.6;
                const getUpProgress = elapsedTime <= state.keeperDownUntil ? 0 : THREE.MathUtils.clamp((elapsedTime - state.keeperDownUntil) / getUpDuration, 0, 1);
                updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity, knocked: true, getUpProgress });
                keeper.scale.set(1, 1, 1);
                return;
            }
            break;
        }
    }
    
    // IDLE、CHARGE、RETURN 状态的常规处理
    if (state.keeperState === KEEPER_STATE.DIVE) {
        state.keeperState = KEEPER_STATE.IDLE;
    }
    if (state.keeperState === KEEPER_STATE.KNOCKED) {
        state.keeperState = KEEPER_STATE.IDLE;
    }

    const homePosition = getKeeperHomePosition(profile, state, ball);
    const ballIsPlayable = ball.position.y <= BALL_GROUND_Y + 0.18;
    const ballIsLoose = horizontalSpeed(state.ballVelocity) < 5.2;
    const chargeHalfWidth = profile.chargeWidth || 2.2;
    const ballInChargeLane = Math.abs(ball.position.x) < chargeHalfWidth
        && ball.position.z > FIELD.goalZ + 1.0
        && ball.position.z < FIELD.goalZ + profile.chargeRange;
    const shouldCharge = ballIsPlayable
        && ballIsLoose
        && ballInChargeLane
        && elapsedTime >= state.keeperChargeUntil
        && !state.isResetting
        && elapsedTime >= state.keeperGetUpUntil
        && profile.chargeSpeed > 0
        && state.keeperState === KEEPER_STATE.IDLE;

    if (shouldCharge) {
        state.keeperMode = 'charge';
        state.keeperState = KEEPER_STATE.CHARGE;
    } else if (state.keeperState === KEEPER_STATE.CHARGE && (
        !ballIsPlayable
        || ball.position.z > FIELD.goalZ + profile.chargeRange + 0.85
        || ball.position.z < FIELD.goalZ + 0.55
    )) {
        state.keeperMode = 'return';
        state.keeperState = KEEPER_STATE.RETURN;
    }

    const target = state.keeperState === KEEPER_STATE.CHARGE
        ? new THREE.Vector3(
            THREE.MathUtils.clamp(ball.position.x, -chargeHalfWidth, chargeHalfWidth),
            0,
            THREE.MathUtils.clamp(ball.position.z, FIELD.goalZ + 0.9, FIELD.goalZ + profile.chargeRange + 0.2)
        )
        : homePosition;
    const moveSpeed = state.keeperState === KEEPER_STATE.CHARGE
        ? profile.chargeSpeed
        : Math.max(profile.lateralSpeed, profile.depthSpeed);
    
    // Level 1 keeper does not walk/move to intercept, only dives in place
    if (state.keeperLevel === 1 && state.keeperState !== KEEPER_STATE.CHARGE) {
        keeper.userData.velocity.set(0, 0, 0);
    } else {
        moveKeeperToward(keeper, target, moveSpeed, dt);
    }

    if (state.keeperState === KEEPER_STATE.RETURN && flatDistance(keeper.position, homePosition) < 0.12) {
        state.keeperState = KEEPER_STATE.IDLE;
        state.keeperMode = 'guard';
    }

    keeper.rotation.y = Math.atan2(ball.position.x - keeper.position.x, ball.position.z - keeper.position.z);
    updateCharacterPose(keeper, { dt, elapsedTime, movement: keeper.userData.velocity });

    const danger = ball.position.z < FIELD.goalZ + 1.35 && state.ballVelocity.z < -0.8;
    keeper.scale.set(1, danger ? 0.82 : 1, danger ? 1.22 : 1);
    if (state.keeperState === KEEPER_STATE.CHARGE
        && flatDistance(keeper.position, ball.position) < profile.tackleRadius
        && ballIsPlayable
    ) {
        clearBallFromKeeper({ state, keeper, ball, elapsedTime, onKeeperSave, profile, lift: 3.4 });
        state.keeperState = KEEPER_STATE.RETURN;
        state.keeperChargeUntil = elapsedTime + profile.saveCooldown + 0.6;
        return;
    }
    
    // 扇形视野检测与预判逻辑
    const canPredictSave = checkKeeperVisionAndSector(keeper, ball, state.ballVelocity, profile, elapsedTime, state.lastKeeperSaveTime, state.keeperGetUpUntil, state.isResetting);
    
    if (canPredictSave) {
        // 启动完整扑救动作序列：SQUAT -> JUMP -> DIVE -> LAND -> GET_UP
        state.keeperState = KEEPER_STATE.SQUAT;
        state.keeperActionStart = elapsedTime;
        state.keeperMode = 'dive';
        
        // Level 1 keeper does not adjust position before diving (dives in place)
        // Higher level keepers can shift position slightly before diving
        if (state.keeperLevel !== 1) {
            const diveDirection = Math.sign(ball.position.x - keeper.position.x);
            const diveDistance = Math.min(Math.abs(ball.position.x - keeper.position.x), 1.2);
            keeper.position.x += diveDirection * diveDistance * 0.5;
            keeper.position.x = THREE.MathUtils.clamp(keeper.position.x, -FIELD.width / 2 + 0.65, FIELD.width / 2 - 0.65);
        }
        
        // 设置拦截时间点，在倒地阶段触球
        const totalDiveTime = (profile.squatDuration || 0.15) + (profile.jumpDuration || 0.2) + (profile.diveDuration || 0.35) * 0.7;
        state.keeperDiveUntil = elapsedTime + totalDiveTime;
        state.lastKeeperSaveTime = elapsedTime;
        
        // 物理碰撞：改变球的速度
        const diveClearPower = profile.diveClearPower || 8.5;
        const clearX = Math.sign(ball.position.x - keeper.position.x) * diveClearPower;
        state.ballVelocity.set(clearX, 4.5, Math.abs(state.ballVelocity.z) * 0.3);
        ball.position.y = Math.max(ball.position.y, BALL_GROUND_Y + 0.08);
        
        const taunt = KEEPER_SAVE_TAUNTS[Math.floor(Math.random() * KEEPER_SAVE_TAUNTS.length)];
        onKeeperSave(taunt);
        return;
    }
    
    // 原有的近距离扑救逻辑（作为备用）
    const ballHeadingToGoal = state.ballVelocity.z < -2.5;
    const veryNearGoalLine = ball.position.z < FIELD.goalZ + 0.5 && ball.position.z > FIELD.goalZ - 0.3;
    if (ballHeadingToGoal
        && veryNearGoalLine
        && flatDistance(keeper.position, ball.position) < profile.saveRadius
        && ball.position.y < 1.05
        && elapsedTime - state.lastKeeperSaveTime > profile.saveCooldown
        && state.keeperState === KEEPER_STATE.IDLE
    ) {
        clearBallFromKeeper({ state, keeper, ball, elapsedTime, onKeeperSave, profile, lift: 5.8 });
    }
}

/**
 * 检查球是否在门将的扇形活动区间和视野范围内，并预测是否能扑救成功
 * @param {THREE.Object3D} keeper - 门将对象
 * @param {THREE.Mesh} ball - 足球对象
 * @param {THREE.Vector3} ballVelocity - 足球速度
 * @param {Object} profile - 门将配置参数
 * @param {number} elapsedTime - 当前游戏时间
 * @param {number} lastSaveTime - 上次扑救时间
 * @param {number} getUpUntil - 起身完成时间
 * @param {boolean} isResetting - 是否正在重置
 * @returns {boolean} 是否应该启动扑救动作
 */
function checkKeeperVisionAndSector(keeper, ball, ballVelocity, profile, elapsedTime, lastSaveTime, getUpUntil, isResetting) {
    // 基本检查
    if (elapsedTime - lastSaveTime <= profile.saveCooldown) return false;
    if (elapsedTime < getUpUntil) return false;
    if (isResetting) return false;
    
    // 球必须是飞向球门的
    if (ballVelocity.z >= -1.5) return false;
    
    // 计算球的位置相对于门将的方向向量
    const ballOffset = ball.position.clone().sub(keeper.position);
    ballOffset.y = 0; // 忽略高度差，只考虑水平面
    const distanceToBall = ballOffset.length();
    
    // 检查距离是否在扇形半径内
    if (distanceToBall > profile.sectorRadius || distanceToBall < 0.3) return false;
    
    // 归一化方向向量
    ballOffset.normalize();
    
    // 计算门将朝向（面向球门前方）
    const keeperForward = new THREE.Vector3(0, 0, -1); // 门将默认面向球场
    
    // 计算球相对于门将朝向的角度
    const angleToBall = keeperForward.angleTo(ballOffset);
    
    // 检查是否在扇形活动区间内
    if (angleToBall > profile.sectorAngle) return false;
    
    // 检查是否在视野范围内（更严格的视野角度）
    if (angleToBall > profile.visionAngle) return false;
    
    // 检查球的飞行高度是否在可扑救范围内
    if (ball.position.y > 2.4) return false;
    
    // 预测球的轨迹，判断是否能碰到球
    const predictTime = profile.anticipate || 0.25;
    const predictedBallX = ball.position.x + ballVelocity.x * predictTime;
    const predictedBallZ = ball.position.z + ballVelocity.z * predictTime;
    
    // 检查预测点是否在球门线附近（危险区域）
    const isDangerZone = predictedBallZ < FIELD.goalZ + 0.8 && predictedBallZ > FIELD.goalZ - 0.5;
    if (!isDangerZone) return false;
    
    // Level 1 keeper: only checks if ball is within dive reach, does not calculate movement time
    if (profile.lateralSpeed === 0) {
        // For level 1, check if the predicted ball position is within half goal width (dive reach)
        const halfGoalWidth = 2.65; // Half of standard goal width
        const canReachByDiving = Math.abs(predictedBallX) <= halfGoalWidth;
        return canReachByDiving;
    }
    
    // 计算门将移动到预测点所需时间
    const lateralDistance = Math.abs(predictedBallX - keeper.position.x);
    const moveTime = lateralDistance / Math.max(profile.lateralSpeed || 5.0, 0.1);
    
    // 如果能在球到达前移动到位置，则扑救可行
    const timeToGoal = Math.abs((predictedBallZ - FIELD.goalZ) / ballVelocity.z);
    const canReachInTime = moveTime < timeToGoal * 0.85; // 留 15% 余量
    
    return canReachInTime;
}

function getKeeperHomePosition(profile, state, ball) {
    const predictedX = THREE.MathUtils.clamp(
        ball.position.x + state.ballVelocity.x * profile.anticipate,
        -2.25,
        2.25
    );
    return new THREE.Vector3(predictedX, 0, FIELD.goalZ + 0.74);
}

function moveKeeperToward(keeper, target, speed, dt) {
    const before = keeper.position.clone();
    const offset = target.clone().sub(keeper.position);
    offset.y = 0;
    const distance = offset.length();
    if (distance > 0.001) {
        keeper.position.addScaledVector(offset.normalize(), Math.min(distance, speed * dt));
    }
    keeper.userData.velocity.copy(keeper.position).sub(before).multiplyScalar(dt > 0 ? 1 / dt : 0);
}

function clearBallFromKeeper({ state, keeper, ball, elapsedTime, onKeeperSave, profile, lift }) {
    const clear = new THREE.Vector3(ball.position.x - keeper.position.x, 0, 2.15).normalize();
    state.ballVelocity.set(clear.x * profile.clearancePower, lift, clear.z * profile.clearancePower);
    ball.position.y = Math.max(ball.position.y, BALL_GROUND_Y + 0.06);
    state.lastKeeperSaveTime = elapsedTime;
    const taunt = KEEPER_SAVE_TAUNTS[Math.floor(Math.random() * KEEPER_SAVE_TAUNTS.length)];
    onKeeperSave(taunt);
}

export function updateAimArrow({ state, player, ball, aimArrow, getAimDirection }) {
    const close = flatDistance(player.position, ball.position) < 1.25;
    aimArrow.visible = close;
    if (state.gameOver) {
        aimArrow.visible = false;
        return;
    }
    if (!close) return;
    aimArrow.position.copy(ball.position);
    aimArrow.position.y = ball.position.y + 0.12;
    const direction = getAimDirection();
    aimArrow.rotation.y = Math.atan2(direction.x, direction.z);
    const chargeScale = state.isChargingKick ? THREE.MathUtils.lerp(0.85, 1.75, state.chargePower) : 1;
    aimArrow.scale.set(1, 1, chargeScale);
    
    // 根据踢球者与球的距离调整箭头的垂直翘起角度
    // 距离越近，箭头翘得越高（表示高球）；距离越远，箭头越平（表示贴地球）
    const distanceToBall = flatDistance(player.position, ball.position);
    const maxKickDistance = 1.15;
    const minKickDistance = 0.35;
    const distanceRatio = THREE.MathUtils.clamp(
        (maxKickDistance - distanceToBall) / (maxKickDistance - minKickDistance),
        0, 1
    );
    
    // 计算箭头翘起角度：0度（贴地）到 25 度（高球）
    const pitchAngle = distanceRatio * THREE.MathUtils.degToRad(25);
    
    // 应用翘起到内部组
    if (aimArrow.userData.arrowInner) {
        aimArrow.userData.arrowInner.rotation.x = -pitchAngle;
    }
}

export function checkGoal({ state, ball, onGoal, onOutOfBounds }) {
    if (state.isResetting || state.gameOver) return;

    const outPadding = BALL_RADIUS + FIELD.boundaryOffset;
    const goalCrossed = ball.position.z < FIELD.goalZ - 0.36;
    if (goalCrossed && Math.abs(ball.position.x) < 2.55) {
        onGoal();
        return;
    }

    const outOfBounds = Math.abs(ball.position.x) > FIELD.width / 2 + outPadding
        || ball.position.z > FIELD.depth / 2 + outPadding
        || ball.position.z < -FIELD.depth / 2 - outPadding;
    if (outOfBounds) onOutOfBounds();
}

export function resetRound({ state, player, keeper, referee, ball, showMessage }, message) {
    if (state.gameOver) return;
    state.isResetting = true;
    player.position.set(0, 0, 3.85);
    keeper.position.set(0, 0, FIELD.goalZ + 0.72);
    ball.position.set(0, BALL_GROUND_Y, 2.65);
    state.ballVelocity.set(0, 0, 0);
    cancelKickCharge(state);
    state.kickPoseTimer = 0;
    state.kickPoseDuration = KICK_RELEASE_DURATION;
    state.kickPosePower = 0;
    state.keeperMode = 'guard';
    state.keeperState = KEEPER_STATE.IDLE;
    state.keeperChargeUntil = 0;
    state.keeperDownUntil = 0;
    state.keeperGetUpUntil = 0;
    state.keeperDiveUntil = 0;
    state.keeperActionStart = 0;
    state.isDiving = false;
    state.lastKeeperSaveTime = -10;
    state.pendingRefereeFailure = false;
    state.refereeWarningUntil = 0;
    state.refereeWarningMessage = '';
    state.pendingSaveNotification = false;
    state.predictedInterceptPoint = null;
    player.userData.facing.set(0, 0, -1);
    player.rotation.y = Math.PI;
    if (referee) {
        const sidelineOffset = FIELD.width / 2 + 0.3;
        referee.position.set(-sidelineOffset, 0, 1.35);
        referee.rotation.y = Math.PI * 0.35;
        referee.userData.velocity.set(0, 0, 0);
        updateCharacterPose(referee, { dt: 1 / 60, elapsedTime: 0, movement: new THREE.Vector3() });
    }
    updateCharacterPose(player, { dt: 1 / 60, elapsedTime: 0, movement: new THREE.Vector3() });
    updateCharacterPose(keeper, { dt: 1 / 60, elapsedTime: 0, movement: new THREE.Vector3() });
    showMessage(message);
    window.setTimeout(() => { state.isResetting = false; }, 420);
}

export function horizontalSpeed(velocity) {
    return Math.hypot(velocity.x, velocity.z);
}

export function flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
}
