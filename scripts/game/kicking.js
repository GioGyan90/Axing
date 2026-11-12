import * as THREE from 'three';
import { BALL_GROUND_Y, BALL_RADIUS, FIELD } from './config.js';
import {isInRefereeVision} from './referee-vision.js';
import {goalDirection} from './goal-aim.js';
import {KNOCKDOWN,makeKnockdown,isKnockedDown} from './knockdown.js';

/**
 * 射门逻辑
 * 根据踢球者与球的距离判断踢高球还是贴地球
 * 距离越近，踢出的球越高；距离越远，踢出的球越贴近地面
 */
export function kickBall({ state, player, ball, getAimDirection, showMessage }, powerRatio = 0.35) {
    if (state.gameOver) return false;
    if (state.isResetting || flatDistance(player.position, ball.position) > 1.15) {
        showMessage('靠近足球再射门');
        return false;
    }
    const hint = getAimDirection();
    const travel = Math.abs(FIELD.goalZ - ball.position.z);
    const preferredX = ball.position.x + hint.x * travel / Math.max(0.05, Math.abs(hint.z));
    const direction = goalDirection(ball.position, {goalZ:FIELD.goalZ-0.5,lineZ:FIELD.goalZ,halfWidth:2.65,ballRadius:BALL_RADIUS,preferredX});
    
    // 根据踢球者与球的距离判断踢高球还是贴地球
    const distanceToBall = flatDistance(player.position, ball.position);
    const maxKickDistance = 1.15;
    const minKickDistance = 0.35;
    
    // 计算距离比例：0 = 最远距离（贴地），1 = 最近距离（高球）
    const distanceRatio = THREE.MathUtils.clamp(
        (maxKickDistance - distanceToBall) / (maxKickDistance - minKickDistance),
        0, 1
    );
    
    // 基础力量
    const power = THREE.MathUtils.lerp(8.2, 17.4, powerRatio);
    
    // 垂直速度：距离越近踢得越高，力量也会影响高度
    const baseVerticalVelocity = THREE.MathUtils.lerp(0.8, 6.5, distanceRatio);
    const powerVerticalBoost = THREE.MathUtils.lerp(0, 2.5, powerRatio);
    const maxLift = Math.sqrt(2 * 15.5 * (2.38 - BALL_RADIUS - BALL_GROUND_Y - 0.2));
    const verticalVelocity = Math.min(maxLift, baseVerticalVelocity + powerVerticalBoost);
    
    state.ballVelocity.set(direction.x * power, verticalVelocity, direction.z * power);
    
    const shotType = distanceRatio > 0.4 ? '高球' : (distanceRatio > 0.2 ? '半高球' : '贴地球');
    showMessage(`射门！力量 ${Math.round(powerRatio * 100)}% ${shotType}`);
    return true;
}

/**
 * 踢倒门将逻辑
 * 当球员靠近门将并释放蓄力时，可以踢倒门将
 * 如果裁判看到则判犯规，否则门将眩晕一段时间
 */
export function kickDownKeeper({ state, player, keeper, referee, elapsedTime, showMessage, onKeeperTaunt, onKeeperHit, onRefereeFoul }, powerRatio = 0.35) {
    const KEEPER_MIN_KNOCKDOWN_DURATION = 3;
    const KEEPER_MAX_KNOCKDOWN_DURATION = 5;
    const REFEREE_WARNING_DURATION = 1;
    
    const KEEPER_TAUNTS = [
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
    ];
    
    const REFEREE_WARNINGS = [
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
    ];
    
    const distanceToKeeper = flatDistance(player.position, keeper.position);
    const keeperCanBeKicked = !state.gameOver
        && !state.isResetting
        && elapsedTime >= state.keeperGetUpUntil
        && distanceToKeeper < 1.05;
    if (!keeperCanBeKicked) return false;

    const direction = keeper.position.clone().sub(player.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
    direction.normalize();

    keeper.position.addScaledVector(direction, 0.18);
    keeper.position.x = THREE.MathUtils.clamp(keeper.position.x, -FIELD.width / 2 + 0.65, FIELD.width / 2 - 0.65);
    keeper.position.z = THREE.MathUtils.clamp(keeper.position.z, FIELD.goalZ + 0.4, FIELD.depth / 2 - 0.65);
    keeper.rotation.y = Math.atan2(direction.x, direction.z);
    keeper.userData.velocity.set(0, 0, 0);

    state.keeperMode = 'knocked';
    state.keeperState = 'knocked';
    const knockdownDuration = THREE.MathUtils.lerp(KEEPER_MIN_KNOCKDOWN_DURATION, KEEPER_MAX_KNOCKDOWN_DURATION, THREE.MathUtils.clamp(powerRatio, 0, 1));
    state.keeperDownUntil = Math.max(state.keeperDownUntil, elapsedTime + knockdownDuration);
    state.keeperGetUpUntil = state.keeperDownUntil + 0.6;
    keeper.userData.knockdown = makeKnockdown(elapsedTime, powerRatio);
    state.keeperChargeUntil = state.keeperGetUpUntil + 0.45;
    state.lastKeeperKnockdownTime = elapsedTime;
    state.keeperSave = null;
    
    // 触发击打效果
    if (onKeeperHit) onKeeperHit(powerRatio);
    
    // 取消蓄力
    state.isChargingKick = false;
    state.chargePower = 0;

    // 检查裁判是否看到
    if (referee && isInRefereeVision(player.position, referee)) {
        const warning = REFEREE_WARNINGS[Math.floor(Math.random() * REFEREE_WARNINGS.length)];
        state.pendingRefereeFailure = true;
        state.refereeWarningUntil = elapsedTime + REFEREE_WARNING_DURATION;
        state.refereeWarningMessage = warning;
        showMessage(warning);
        if (onRefereeFoul) onRefereeFoul(warning);
    } else {
        const taunt = KEEPER_TAUNTS[Math.floor(Math.random() * KEEPER_TAUNTS.length)];
        if (onKeeperTaunt) onKeeperTaunt(taunt);
        showMessage(`你把门将踢倒了！眩晕 ${knockdownDuration.toFixed(1)} 秒`);
    }
    return true;
}

export function findKnockdownTarget({state,player,keeper,defender,elapsedTime}) {
    return [keeper,defender].filter(target=>target&&target.visible!==false
        && !(target===keeper&&elapsedTime<state.keeperGetUpUntil)
        && !isKnockedDown(target.userData.knockdown,elapsedTime)
        && flatDistance(player.position,target.position)<KNOCKDOWN.range)
        .sort((a,b)=>flatDistance(player.position,a.position)-flatDistance(player.position,b.position))[0];
}

export function kickDownOpponent(context, powerRatio = 0.65) {
    const {state,player,keeper,defender,referee,elapsedTime,showMessage,onKeeperHit,onRefereeFoul}=context;
    if(state.gameOver||state.isResetting||state.pendingRefereeFailure)return false;
    const target=context.target||findKnockdownTarget(context);
    if(!target||target.visible===false||flatDistance(player.position,target.position)>=KNOCKDOWN.range||isKnockedDown(target.userData.knockdown,elapsedTime))return false;
    if(target===keeper)return kickDownKeeper(context,powerRatio);
    if(target!==defender)return false;
    target.userData.knockdown=makeKnockdown(elapsedTime,powerRatio);
    target.userData.velocity.set(0,0,0);target.userData.hitFlashUntil=elapsedTime+0.25;
    if(target.userData.defense){target.userData.defense.tackle=null;target.userData.defense.readyAt=target.userData.knockdown.getUpUntil;target.userData.defense.nextTackleAt=target.userData.knockdown.getUpUntil+0.2;}
    onKeeperHit?.(powerRatio);
    if(referee&&isInRefereeVision(player.position,referee)){
        state.pendingRefereeFailure=true;state.refereeWarningUntil=elapsedTime+1;state.refereeWarningMessage='裁判吹罚：踢倒后卫，踢人犯规！';
        showMessage(state.refereeWarningMessage);onRefereeFoul?.(state.refereeWarningMessage);
    }else showMessage(`后卫被踢倒！眩晕 ${(target.userData.knockdown.downUntil-elapsedTime).toFixed(1)} 秒`);
    return true;
}

/**
 * 计算水平距离
 */
function flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
}
