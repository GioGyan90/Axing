import * as THREE from 'three';
import { FIELD, KEEPER_PROFILES } from './config.js';
import { updateGoalkeeperAnimation } from './goalkeeper-animation.js';

// 门将状态枚举（与 rules.js 保持一致）
export const KEEPER_STATE = {
    IDLE: 'idle',
    SQUAT: 'squat',
    JUMP: 'jump',
    DIVE: 'dive',
    LAND: 'land',
    GET_UP: 'getUp',
    KNOCKED: 'knocked',
    CHARGE: 'charge',
    RETURN: 'return',
    PUNCH: 'punch',        // 新增：抬手击球状态
};

// 高球扑救嘲讽语
const HIGH_BALL_PUNCH_TAUNTS = Object.freeze([
    '这球太高？我跳起来打！',
    '空中球也是我的！',
    '想吊射？没那么容易！',
    '高空轰炸无效！',
    '这高度我照样够得着！',
    '半高球？直接拳击！',
    '飞那么高也没用！',
    '我的拳头比球快！',
    '空中禁区我说了算！',
    '这球我笑纳了！',
]);

/**
 * 检查是否需要执行抬手击球动作
 * @param {THREE.Object3D} keeper - 门将对象
 * @param {THREE.Mesh} ball - 足球对象
 * @param {THREE.Vector3} ballVelocity - 足球速度
 * @param {Object} profile - 门将配置参数
 * @param {number} elapsedTime - 当前游戏时间
 * @param {number} lastSaveTime - 上次扑救时间
 * @param {number} getUpUntil - 起身完成时间
 * @param {boolean} isResetting - 是否正在重置
 * @returns {boolean} 是否应该启动抬手击球动作
 */
export function checkHighBallPunch(keeper, ball, ballVelocity, profile, elapsedTime, lastSaveTime, getUpUntil, isResetting) {
    // 基本检查
    if (elapsedTime - lastSaveTime <= profile.saveCooldown) return false;
    if (elapsedTime < getUpUntil) return false;
    if (isResetting) return false;
    
    // 球必须是飞向球门的
    if (ballVelocity.z >= -1.5) return false;
    
    // 检查球的高度：必须是高球（高于门将伸手可及的范围，但低于横梁）
    const punchHeightMin = 1.6;  // 最低击球高度（约头部以上）
    const punchHeightMax = 2.3;  // 最高击球高度（略低于横梁）
    if (ball.position.y < punchHeightMin || ball.position.y > punchHeightMax) return false;
    
    // 计算球的位置相对于门将的水平距离
    const horizontalOffset = new THREE.Vector3(ball.position.x - keeper.position.x, 0, ball.position.z - keeper.position.z);
    const distanceToBall = horizontalOffset.length();
    
    // 检查距离是否在可击球范围内（比地面扑救稍近）
    const punchRange = profile.punchRange || 2.8;
    if (distanceToBall > punchRange || distanceToBall < 0.5) return false;
    
    // 检查球的水平位置是否在球门宽度内
    const halfGoalWidth = 2.65;
    if (Math.abs(ball.position.x) > halfGoalWidth + 0.5) return false;
    
    // 预测球的轨迹
    const predictTime = profile.anticipate || 0.25;
    const predictedBallX = ball.position.x + ballVelocity.x * predictTime;
    const predictedBallZ = ball.position.z + ballVelocity.z * predictTime;
    const predictedBallY = ball.position.y + ballVelocity.y * predictTime;
    
    // 检查预测点是否在危险区域
    const isDangerZone = predictedBallZ < FIELD.goalZ + 0.9 && predictedBallZ > FIELD.goalZ - 0.6;
    if (!isDangerZone) return false;
    
    // 检查预测高度是否仍在可击球范围内
    if (predictedBallY < punchHeightMin || predictedBallY > punchHeightMax) return false;
    
    // Level 1 门将也可以执行抬手击球（这是基础技能）
    // 计算是否能及时移动到击球位置
    const lateralDistance = Math.abs(predictedBallX - keeper.position.x);
    const moveTime = lateralDistance / Math.max(profile.lateralSpeed || 5.0, 0.1);
    const timeToGoal = Math.abs((predictedBallZ - FIELD.goalZ) / ballVelocity.z);
    const canReachInTime = moveTime < timeToGoal * 0.85;
    
    return canReachInTime;
}

/**
 * 执行抬手击球动作
 * @param {Object} context - 上下文对象
 * @param {Object} context.state - 游戏状态
 * @param {THREE.Object3D} context.keeper - 门将对象
 * @param {THREE.Mesh} context.ball - 足球对象
 * @param {number} context.elapsedTime - 当前游戏时间
 * @param {Function} context.onKeeperSave - 扑救成功回调
 * @param {Object} context.profile - 门将配置参数
 * @returns {boolean} 是否成功执行击球
 */
export function performHighBallPunch({ state, keeper, ball, elapsedTime, onKeeperSave, profile }) {
    // 启动抬手击球动作序列
    state.keeperState = KEEPER_STATE.PUNCH;
    state.keeperActionStart = elapsedTime;
    state.keeperMode = 'punch';
    
    // 调整位置朝向球的方向
    const punchDirection = Math.sign(ball.position.x - keeper.position.x);
    const punchDistance = Math.min(Math.abs(ball.position.x - keeper.position.x), 0.8);
    keeper.position.x += punchDirection * punchDistance * 0.4;
    keeper.position.x = THREE.MathUtils.clamp(keeper.position.x, -FIELD.width / 2 + 0.65, FIELD.width / 2 - 0.65);
    
    // 设置击球时间点
    const punchTime = profile.punchDuration || 0.35;
    state.keeperPunchUntil = elapsedTime + punchTime;
    state.lastKeeperSaveTime = elapsedTime;
    
    // 物理碰撞：用拳头改变球的速度
    const punchPower = profile.punchPower || 9.5;
    const punchLift = profile.punchLift || 5.2;
    const clearX = Math.sign(ball.position.x - keeper.position.x) * punchPower * 0.7;
    const clearZ = Math.abs(state.ballVelocity.z) * 0.25;
    
    // 给球一个向上的力，模拟拳击效果
    state.ballVelocity.set(clearX, punchLift, clearZ);
    ball.position.y = Math.max(ball.position.y, 1.8);
    
    // 播放击球音效和嘲讽
    const taunt = HIGH_BALL_PUNCH_TAUNTS[Math.floor(Math.random() * HIGH_BALL_PUNCH_TAUNTS.length)];
    onKeeperSave(taunt);
    
    return true;
}

/**
 * 更新抬手击球动作的动画
 * @param {Object} context - 上下文对象
 * @param {number} context.dt - 时间增量
 * @param {Object} context.state - 游戏状态
 * @param {THREE.Object3D} context.keeper - 门将对象
 * @param {number} context.elapsedTime - 当前游戏时间
 */
export function updatePunchAnimation({ dt, state, keeper, elapsedTime }) {
    const punchElapsed = elapsedTime - state.keeperActionStart;
    const punchDuration = KEEPER_PROFILES[state.keeperLevel]?.punchDuration || 0.35;
    
    if (punchElapsed >= punchDuration) {
        // 击球动作完成，转入落地/恢复状态
        state.keeperState = KEEPER_STATE.LAND;
        state.keeperActionStart = elapsedTime;
        return;
    }
    
    const punchProgress = punchElapsed / punchDuration;
    keeper.userData.velocity.set(0, 0, 0);
    
    // 击球动画：身体向上伸展，双臂高举
    const punchPhase = Math.sin(punchProgress * Math.PI);
    keeper.position.y = punchPhase * 0.3;  // 轻微跳跃
    
    // 使用 goalkeeper animation 来触发自定义动画，但传入 punch 特定参数
    updateGoalkeeperAnimation(keeper, { 
        dt, 
        elapsedTime, 
        movement: keeper.userData.velocity, 
        punching: true, 
        punchProgress 
    });
    
    keeper.scale.set(1, 1, 1);
}
