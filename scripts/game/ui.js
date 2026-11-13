import * as THREE from 'three';
import { FIELD } from './config.js';
import {BALL_RADIUS} from './config.js';
import {goalDirection} from './goal-aim.js';
import {goalConfettiFor} from './confetti.js';

export function getGameElements() {
    return {
        root: document.getElementById('game-root'),
        portraitRoot: document.getElementById('portrait-root'),
        playerScore: document.getElementById('player-score'),
        keeperScore: document.getElementById('keeper-score'),
        outScore: document.getElementById('out-score'),
        attemptTrack: document.getElementById('attempt-track'),
        resultOverlay: document.getElementById('result-overlay'),
        resultTitle: document.getElementById('result-title'),
        resultSummary: document.getElementById('result-summary'),
        replayBtn: document.getElementById('replay-btn'),
        confettiCanvas: document.getElementById('confetti-canvas'),
        keeperLevelSelect: document.getElementById('keeper-level'),
        restartBtn: document.getElementById('restart-btn'),
        toast: document.getElementById('toast'),
        keeperBubble: document.getElementById('keeper-bubble'),
        recordsBtn: document.getElementById('records-btn'),
        recordsModal: document.getElementById('records-modal'),
        recordsContent: document.getElementById('records-content'),
        closeRecordsBtn: document.getElementById('close-records-btn'),
    };
}

export function showMessage(toast, state, message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(state.messageTimer);
    state.messageTimer = window.setTimeout(() => toast.classList.remove('show'), 1200);
}

export function updateScoreBoard(elements, state) {
    elements.playerScore.textContent = state.playerScore;
    elements.keeperScore.textContent = state.keeperScore;
    elements.outScore.textContent = state.outScore;
    Array.from(elements.attemptTrack.children).forEach((cell, index) => {
        const result = state.attempts[index];
        cell.className = 'attempt-cell';
        if (result === 'goal') {
            cell.classList.add('scored');
            cell.textContent = '●';
            cell.setAttribute('aria-label', `第 ${index + 1} 次机会得分`);
        } else if (result === 'foul') {
            cell.classList.add('missed');
            cell.textContent = '×';
            cell.setAttribute('aria-label', `第 ${index + 1} 次机会犯规`);
        } else if (result) {
            cell.classList.add('missed');
            cell.textContent = '×';
            cell.setAttribute('aria-label', `第 ${index + 1} 次机会未得分`);
        } else {
            cell.classList.add('pending');
            cell.textContent = index + 1;
            cell.setAttribute('aria-label', `第 ${index + 1} 次机会待定`);
        }
    });
}

export function showResultOverlay(elements, { title, summary, won }) {
    elements.resultTitle.textContent = title;
    elements.resultSummary.textContent = summary;
    elements.resultOverlay.classList.add('show');
    elements.resultOverlay.removeAttribute('aria-hidden');
    if (won && !Number(elements.confettiCanvas.dataset.particles)) playConfetti(elements.confettiCanvas);
    // 将焦点移到重玩按钮上，确保辅助技术用户可以访问
    elements.replayBtn.focus();
}

export function hideResultOverlay(elements) {
    elements.resultOverlay.classList.remove('show');
    elements.resultOverlay.setAttribute('aria-hidden', 'true');
    stopConfetti(elements.confettiCanvas);
}

function playConfetti(canvas) { goalConfettiFor(canvas).burst(); }
function stopConfetti(canvas) { goalConfettiFor(canvas).clear(); }

export function bindKeyboard({ keys, onKickStart, onKnockStart, onSlide, onKickRelease, onBackDoubleTap }) {
    let lastBackTapAt = 0;
    window.addEventListener('keydown', (event) => {
        if(['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName))return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
        if (event.code === 'Space') {
            if (!event.repeat) onKickStart();
            return;
        }
        if(event.code==='KeyR'){if(!event.repeat)onSlide?.();return;}
        if(event.code==='KeyF'){if(!event.repeat)onKnockStart?.();return;}
        if ((event.code === 'ArrowDown' || event.code === 'KeyS') && !event.repeat) {
            const now = performance.now();
            if (now - lastBackTapAt <= 320) {
                onBackDoubleTap?.();
                lastBackTapAt = 0;
            } else {
                lastBackTapAt = now;
            }
        }
        keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
        if (event.code === 'Space'||event.code==='KeyF') {
            onKickRelease();
            return;
        }
        keys.delete(event.code);
    });
}

export function bindTouchControls({ keys, onKickStart, onKnockStart, onSlide, onKickRelease, onKickCancel, onBackDoubleTap }) {
    let lastBackTapAt = 0;
    document.querySelectorAll('[data-key]').forEach((button) => {
        const key = button.dataset.key;
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            if (key === 'Space') {
                onKickStart();
                return;
            }
            if(key==='KeyR'){onSlide?.();return;}
            if(key==='KeyF'){onKnockStart?.();return;}
            if (key === 'ArrowDown' || key === 'KeyS') {
                const now = performance.now();
                if (now - lastBackTapAt <= 320) {
                    onBackDoubleTap?.();
                    lastBackTapAt = 0;
                } else {
                    lastBackTapAt = now;
                }
            }
            keys.add(key);
        });
        button.addEventListener('pointerup', () => { if (key === 'Space'||key==='KeyF') onKickRelease(); else keys.delete(key); });
        button.addEventListener('pointercancel', () => { if (key === 'Space'||key==='KeyF') onKickCancel(); else keys.delete(key); });
        button.addEventListener('pointerleave', () => { if (key === 'Space'||key==='KeyF') onKickRelease(); else keys.delete(key); });
    });
}

export function bindKeeperLevel(select, onChange) {
    select.addEventListener('change', () => onChange(Number(select.value)));
}

export function bindRestart(button, onRestart) {
    button.addEventListener('click', onRestart);
}

export function bindRecordsButton(button, onShowRecords) {
    if (!button) return;
    button.addEventListener('click', onShowRecords);
}

export function showRecordsModal(elements) {
    const { recordsModal, recordsContent } = elements;
    if (!recordsModal || !recordsContent) return;
    
    // 获取战绩记录
    const records = window.getMatchRecords ? window.getMatchRecords() : [];
    
    if (records.length === 0) {
        recordsContent.innerHTML = '<p class="no-records">暂无战绩记录，请先进行游戏！</p>';
    } else {
        let html = '<table class="records-table"><thead><tr><th>时间</th><th>难度</th><th>结果</th><th>5 球得分</th></tr></thead><tbody>';
        records.forEach(record => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString('zh-CN', { 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const resultText = record.won ? '胜利' : '失败';
            const resultClass = record.won ? 'win' : 'lose';
            const ballScoresHtml = record.ballScores
                .map(score => score === 1 ? '●' : (score === 0 ? '×' : '-'))
                .join(' ');
            
            html += `<tr class="record-row ${resultClass}">
                <td>${timeStr}</td>
                <td>等级${record.difficulty}</td>
                <td class="result-${resultClass}">${resultText}</td>
                <td class="ball-scores">${ballScoresHtml}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        recordsContent.innerHTML = html;
    }
    
    recordsModal.classList.add('show');
    recordsModal.removeAttribute('aria-hidden');
}

export function hideRecordsModal(elements) {
    const { recordsModal } = elements;
    if (!recordsModal) return;
    recordsModal.classList.remove('show');
    recordsModal.setAttribute('aria-hidden', 'true');
}

export function createPointerAim(camera) {
    const pointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const fieldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const aimPoint = new THREE.Vector3(0, 0, FIELD.goalZ - 1);

    window.addEventListener('pointermove', (event) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(fieldPlane, hit)) {
            aimPoint.set(
                THREE.MathUtils.clamp(hit.x, -FIELD.width / 2, FIELD.width / 2),
                0,
                THREE.MathUtils.clamp(hit.z, FIELD.goalZ - 1.5, FIELD.depth / 2)
            );
        }
    });

    return aimPoint;
}

export function createAimDirectionGetter(aimPoint, ball) {
    return () => {
        const d=goalDirection(ball.position,{goalZ:FIELD.goalZ-0.5,lineZ:FIELD.goalZ,halfWidth:2.65,ballRadius:BALL_RADIUS,preferredX:aimPoint.x});
        return new THREE.Vector3(d.x,0,d.z);
    };
}

export function resizeGame({ renderer, camera, portrait, portraitRoot, resizePortrait }) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    resizePortrait(portraitRoot, portrait);
    const aspect = width / height;
    const frustum = width < 760 ? 10.8 : 15.5;
    camera.left = -frustum * aspect / 2;
    camera.right = frustum * aspect / 2;
    camera.top = frustum / 2;
    camera.bottom = -frustum / 2;
    camera.updateProjectionMatrix();
}

function flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
}
