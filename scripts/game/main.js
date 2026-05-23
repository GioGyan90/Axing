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
const materials = createMaterials();
const world = new THREE.Group();
scene.add(world);

const portrait = initPortraitModel(elements.portraitRoot);
addLights(scene);
const player = createCharacter(materials, materials.player, 'player');
const keeper = createCharacter(materials, materials.keeper, 'keeper');
const referee = createCharacter(materials, materials.referee, 'referee');
const refereeVisionFan = createRefereeVisionFan(materials);
referee.add(refereeVisionFan);
const ball = createBall(materials);
const aimArrow = createAimArrow();
const footRingBar = createFootRingBar();
const aimPoint = createPointerAim(camera);
const getAimDirection = createAimDirectionGetter(aimPoint, ball);

buildPitch(world, materials);
world.add(player, keeper, referee, ball, aimArrow, footRingBar);

const notify = (message) => showMessage(elements.toast, state, message);
const roundContext = { state, player, keeper, referee, ball, showMessage: notify };
const kickContext = { state, player, ball, getAimDirection, showMessage: notify };
const keeperKickContext = {
    state,
    player,
    keeper,
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
const kickRelease = () => releaseKickCharge(state, clock.elapsedTime, (power) => {
    if (kickDownKeeper({ ...keeperKickContext, elapsedTime: clock.elapsedTime }, power)) return true;
    return kickBall(kickContext, power);
});
const kickStart = () => {
    ensureAudioContext();
    startKickCharge(state, clock.elapsedTime);
};

bindKeyboard({
    keys,
    onKickStart: kickStart,
    onKickRelease: kickRelease,
    onBackDoubleTap: () => breakDribble(state, player, ball, clock.elapsedTime),
});
bindTouchControls({
    keys,
    onKickStart: kickStart,
    onKickRelease: kickRelease,
    onKickCancel: () => cancelKickCharge(state),
    onBackDoubleTap: () => breakDribble(state, player, ball, clock.elapsedTime),
});
bindKeeperLevel(elements.keeperLevelSelect, (level) => {
    state.keeperLevel = level;
    notify(`门将 AI 等级 ${state.keeperLevel}`);
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

window.addEventListener('resize', resize);
resize();
startNewGame('开球！按住 Space 蓄力，靠近门将可蓄力踢人');
animate();

function animate() {
    const dt = Math.min(clock.getDelta(), 0.033);
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function update(dt) {
    updateChargePower(state, clock.elapsedTime);
    if (state.isChargingKick && state.chargePower >= 1) {
        kickRelease();
    }
    updatePlayer({ dt, state, keys, player, ball, getAimDirection, elapsedTime: clock.elapsedTime });
    updateBall({ dt, state, ball });
    
    // Track if keeper made a save this frame for delayed notification
    let keeperMadeSave = false;
    updateKeeper({
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
    
    updateReferee({ dt, state, referee, player, keeper, elapsedTime: clock.elapsedTime });
    updateAimArrow({ state, player, ball, aimArrow, getAimDirection });
    updateFootRingBar({ state, player, footRingBar, elapsedTime: clock.elapsedTime });
    updatePortraitModel(portrait, dt);
    updateKeeperBubble();
    checkGoal({
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
