import * as THREE from 'three';
import {
    addLights,
    buildPitch,
    createAimArrow,
    createBall,
    createCharacter,
    createMaterials,
    createFootRingBar,
    createRefereeVisionFan,
    initPortraitModel,
    resizePortrait,
    updatePortraitModel,
    updateFootRingBar,
} from './assets.js';
import {updateDefender, syncDefenderDifficulty} from './defender.js';
import {findKnockdownTarget,kickDownOpponent} from './kicking.js';
import {goalConfettiFor} from './confetti.js';
import {updateStunStars} from './stun-stars.js';
import {updateSingleCombat} from './single-combat.js';
import {requestSingleSlide,captureSlidePositions,resolveSingleSlides} from './single-slide.js';
import {updateAIWarning} from './ai-warning.js';
import { ensureAudioContext, playKeeperHitSound, playSixteenBitApplause } from './audio.js';
import {
    breakDribble,
    cancelKickCharge,
    checkGoal,
    createGameState,
    consumeRefereeFailureIfReady,
    recordAttemptResult,
    resetGameProgress,
    kickBall,
    kickDownKeeper,
    releaseKickCharge,
    resetRound,
    startKickCharge,
    updateAimArrow,
    updateBall,
    updateChargePower,
    updateKeeper,
    updatePlayer,
    updateReferee,
    saveMatchRecord,
    getMatchRecords,
} from './rules.js';
import {
    bindKeeperLevel,
    bindKeyboard,
    bindRestart,
    bindTouchControls,
    createAimDirectionGetter,
    createPointerAim,
    getGameElements,
    resizeGame,
    hideResultOverlay,
    showMessage,
    showResultOverlay,
    updateScoreBoard,
    bindRecordsButton,
    showRecordsModal,
    hideRecordsModal,
} from './ui.js';

const elements = getGameElements();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1930);
scene.fog = new THREE.Fog(0x0b1930, 28, 70);

const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 120);
camera.position.set(15, 18, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
elements.root.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = new Set();
const state = createGameState();
const celebration=goalConfettiFor(elements.confettiCanvas);let kickIntent='ball';
const materials = createMaterials();
const world = new THREE.Group();
scene.add(world);

const portrait = initPortraitModel(elements.portraitRoot);
addLights(scene);
const player = createCharacter(materials, materials.player, 'player');
const keeper = createCharacter(materials, materials.keeper, 'keeper');
const referee = createCharacter(materials, materials.referee, 'referee');
const defender = createCharacter(materials, materials.defender, 'defender');
defender.visible = false;
const refereeVisionFan = createRefereeVisionFan(materials);
referee.add(refereeVisionFan);
const ball = createBall(materials);
const aimArrow = createAimArrow();
const footRingBar = createFootRingBar();
const aimPoint = createPointerAim(camera);
const getAimDirection = createAimDirectionGetter(aimPoint, ball);

buildPitch(world, materials);
world.add(player, keeper, referee, defender, ball, aimArrow, footRingBar);

const notify = (message) => showMessage(elements.toast, state, message);
const roundContext = { state, player, keeper, referee, defender, ball, showMessage: notify, get elapsedTime() { return clock.elapsedTime; } };
const kickContext = { state, player, ball, getAimDirection, showMessage: notify };
const keeperKickContext = {
    state,
    player,
    keeper,
    defender,
    referee,
    showMessage: notify,
    onKeeperTaunt: (message) => showKeeperBubble(message),
    onKeeperHit: (power) => playKeeperHitSound(power),
    onRefereeFoul: () => hideKeeperBubble(),
};
const resetGame = (message) => {
    hideKeeperBubble();
    resetRound(roundContext, message);
};
const startNewGame = (message = '新一局开球！') => {
    hideKeeperBubble();
    hideResultOverlay(elements);
    resetGameProgress(state);
    updateScoreBoard(elements, state);
    resetRound(roundContext, message);
};
const finishAttempt = (result) => {
    const gameResult = recordAttemptResult(state, result);
    if(result==='goal')celebration.burst();
    updateScoreBoard(elements, state);
    if (gameResult) {
        endGame(gameResult);
        return;
    }
    const messages = {
        goal: 'GOAL! 下一次机会',
        save: '被 AI 门将扑出，下一次机会',
        out: '球出界，下一次机会',
        foul: '裁判吹罚犯规，本次进攻无效，下一次机会',
    };
    resetGame(messages[result]);
};
const kickRelease = () => {
    const target=kickIntent==='person'?findKnockdownTarget({...keeperKickContext,elapsedTime:clock.elapsedTime}):null;
    if(kickIntent==='person'&&!target){cancelKickCharge(state);notify('靠近门将或后卫，再按 F 踢人');return false;}
    state.kickDirection.copy(getAimDirection()).normalize();
    state.kickTargetIsKeeper = !!target;
    if (target) {
        state.kickDirection.copy(target.position).sub(player.position).setY(0).normalize();
    }
    return releaseKickCharge(state, clock.elapsedTime, (power) => {
        if(target)return kickDownOpponent({...keeperKickContext,target,elapsedTime:clock.elapsedTime},power);
        return kickBall({...kickContext, getAimDirection: () => state.kickDirection}, power);
    });
};
const kickStart = (intent='ball') => {
    ensureAudioContext();
    if(startKickCharge(state, clock.elapsedTime))kickIntent=intent;
};

bindKeyboard({
    keys,
    onKickStart: kickStart,
    onKnockStart:()=>kickStart('person'),
    onSlide:()=>{if(requestSingleSlide({state,player,keys,elapsedTime:clock.elapsedTime}))notify('滑铲！沿移动方向铲球或铲人');},
    onKickRelease: kickRelease,
    onBackDoubleTap: () => breakDribble(state, player, ball, clock.elapsedTime),
});
bindTouchControls({
    keys,
    onKickStart: kickStart,
    onKnockStart:()=>kickStart('person'),
    onSlide:()=>{if(requestSingleSlide({state,player,keys,elapsedTime:clock.elapsedTime}))notify('滑铲！沿移动方向铲球或铲人');},
    onKickRelease: kickRelease,
    onKickCancel: () => cancelKickCharge(state),
    onBackDoubleTap: () => breakDribble(state, player, ball, clock.elapsedTime),
});
bindKeeperLevel(elements.keeperLevelSelect, (level) => {
    state.keeperLevel = level;
    syncDefenderDifficulty({state, defender, elapsedTime: clock.elapsedTime});
    notify(level === 3 ? '困难模式：三级门将 + 一名抢球后卫' : `门将 AI 等级 ${state.keeperLevel}`);
});
bindRestart(elements.restartBtn, () => {
    ensureAudioContext();
    startNewGame('重新开球！');
});
bindRestart(elements.replayBtn, () => {
    ensureAudioContext();
    startNewGame('再战一局！');
});
bindRecordsButton(elements.recordsBtn, () => {
    showRecordsModal(elements);
});
// 绑定关闭战绩弹窗按钮
if (elements.closeRecordsBtn) {
    elements.closeRecordsBtn.addEventListener('click', () => {
        hideRecordsModal(elements);
    });
}
// 点击弹窗背景关闭
if (elements.recordsModal) {
    elements.recordsModal.addEventListener('click', (event) => {
        if (event.target === elements.recordsModal) {
            hideRecordsModal(elements);
        }
    });
}

// 将 getMatchRecords 函数挂载到 window 对象，供 UI 使用
window.getMatchRecords = getMatchRecords;

window.addEventListener('resize', resize);
resize();
startNewGame('开球！Space 射门 · F 踢人 · R 滑铲');
animate();

function animate() {
    const dt = Math.min(clock.getDelta(), 0.033);
    update(dt);
    celebration.tick(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function update(dt) {
    const previous=captureSlidePositions({player,keeper,defender,ball});
    const combat=updateSingleCombat({dt,state,player,keeper,defender,referee,ball,elapsedTime:clock.elapsedTime,showMessage:notify,onHit:playKeeperHitSound});
    updateChargePower(state, clock.elapsedTime);
    if (state.isChargingKick && state.chargePower >= 1) {
        kickRelease();
    }
    updatePlayer({ dt, state, keys, player, ball, getAimDirection, elapsedTime: clock.elapsedTime });
    updateBall({ dt, state, ball });
    if(!combat.defender)updateDefender({dt, state, defender, player, ball, elapsedTime: clock.elapsedTime,
        onSteal: () => notify('后卫抢断！快追回足球')});
    
    // Track if keeper made a save this frame for delayed notification
    let keeperMadeSave = false;
    if(!combat.keeper)updateKeeper({
        dt,
        state,
        keeper,
        ball,
        elapsedTime: clock.elapsedTime,
        onKeeperSave: (taunt) => {
            keeperMadeSave = true;
            if (taunt) showKeeperBubble(taunt);
        },
    });
    
    // Delay the save notification by 1 second to let physics play out
    if (keeperMadeSave && !state.isResetting) {
        state.pendingSaveNotification = true;
        window.setTimeout(() => {
            if (state.pendingSaveNotification && !state.isResetting) {
                state.pendingSaveNotification = false;
                notify('被 AI 门将扑出！');
                finishAttempt('save');
            }
        }, 1000);
    }
    
    resolveSingleSlides({state,player,keeper,defender,referee,ball,elapsedTime:clock.elapsedTime,previous,showMessage:notify,onHit:playKeeperHitSound});
    updateReferee({ dt, state, referee, player, keeper, elapsedTime: clock.elapsedTime });
    updateStunStars(keeper,clock.elapsedTime,keeper.userData.knockdown,camera);
    updateStunStars(defender,clock.elapsedTime,defender.userData.knockdown,camera);
    updateStunStars(player,clock.elapsedTime,state.playerKnockdown,camera);
    for(const actor of [keeper,defender])updateAIWarning(actor,!!actor.userData.combat?.intent||!!actor.userData.combat?.slideIntent||!!actor.userData.aiKick&&!actor.userData.aiKick.fired);
    updateAimArrow({ state, player, ball, aimArrow, getAimDirection });
    updateFootRingBar({ state, player, footRingBar, elapsedTime: clock.elapsedTime });
    updatePortraitModel(portrait, dt);
    updateKeeperBubble();
    if(!combat.foul&&!state.pendingRefereeFailure&&clock.elapsedTime>=state.aiFoulUntil)checkGoal({
        state,
        ball,
        onGoal: () => {
            playSixteenBitApplause();
            finishAttempt('goal');
        },
        onOutOfBounds: () => finishAttempt('out'),
    });
    if (consumeRefereeFailureIfReady(state, clock.elapsedTime)) {
        state.pendingRefereeFailure = false;
        finishAttempt('foul');
    }
    world.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.015;
}

function resize() {
    resizeGame({ renderer, camera, portrait, portraitRoot: elements.portraitRoot, resizePortrait });
}

function endGame({ outcome, reason }) {
    hideKeeperBubble();
    cancelKickCharge(state);
    state.kickAction = null;
    state.playerSlideActive=false;for(const a of [player,keeper,defender])a.userData.slide=null;
    state.keeperSave = null;
    state.ballVelocity.set(0, 0, 0);
    
    // 保存战绩记录（仅对登录用户）
    saveMatchRecord(state, state.keeperLevel);
    
    const won = outcome === 'win';
    const loseReason = {
        save: '射门失败 3 次。',
        out: '射门失败 3 次。',
        foul: '犯规累计 3 次，挑战失败。',
        attempts: '5 次机会用完，未能踢进 3 球。',
    }[reason] || '挑战失败。';
    showResultOverlay(elements, {
        won,
        title: won ? '胜利！' : '失败！',
        summary: won
            ? `你在 ${state.attemptCount} 次机会内踢进 3 球，赢下挑战！`
            : `${loseReason} 本局进球 ${state.playerScore} 个。`,
    });
}

function hideKeeperBubble() {
    window.clearTimeout(state.keeperBubbleTimer);
    elements.keeperBubble.classList.remove('show');
}

function showKeeperBubble(message) {
    elements.keeperBubble.textContent = message;
    elements.keeperBubble.classList.add('show');
    window.clearTimeout(state.keeperBubbleTimer);
    state.keeperBubbleTimer = window.setTimeout(() => elements.keeperBubble.classList.remove('show'), 3000);
    updateKeeperBubble();
}

function updateKeeperBubble() {
    if (!elements.keeperBubble.classList.contains('show')) return;
    const bubblePosition = keeper.position.clone();
    bubblePosition.y += 2.55;
    world.localToWorld(bubblePosition);
    bubblePosition.project(camera);
    const x = (bubblePosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-bubblePosition.y * 0.5 + 0.5) * window.innerHeight;
    elements.keeperBubble.style.transform = `translate(-50%, -110%) translate(${x}px, ${y}px)`;
}
