import * as THREE from 'three';
import { FIELD } from './config.js';

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
    if (won) playConfetti(elements.confettiCanvas);
    // 将焦点移到重玩按钮上，确保辅助技术用户可以访问
    elements.replayBtn.focus();
}

export function hideResultOverlay(elements) {
    elements.resultOverlay.classList.remove('show');
    elements.resultOverlay.setAttribute('aria-hidden', 'true');
    stopConfetti(elements.confettiCanvas);
}

function playConfetti(canvas) {
    const context = canvas.getContext('2d');
    const colors = ['#66f7c7', '#ffd166', '#6db7ff', '#ff596f', '#ffffff'];
    const resize = () => {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    stopConfetti(canvas);
    const pieces = Array.from({ length: 150 }, () => ({
        x: Math.random() * window.innerWidth,
        y: -30 - Math.random() * window.innerHeight * 0.45,
        size: 6 + Math.random() * 9,
        speed: 2.4 + Math.random() * 4.4,
        drift: -2 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        spin: -0.22 + Math.random() * 0.44,
        color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const draw = () => {
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        pieces.forEach((piece) => {
            piece.y += piece.speed;
            piece.x += piece.drift + Math.sin(piece.y * 0.018) * 0.8;
            piece.rotation += piece.spin;
            if (piece.y > window.innerHeight + 30) {
                piece.y = -30;
                piece.x = Math.random() * window.innerWidth;
            }
            context.save();
            context.translate(piece.x, piece.y);
            context.rotate(piece.rotation);
            context.fillStyle = piece.color;
            context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.58);
            context.restore();
        });
        canvas.dataset.confettiFrame = window.requestAnimationFrame(draw);
    };
    window.addEventListener('resize', resize, { once: true });
    draw();
    canvas.dataset.confettiTimer = window.setTimeout(() => stopConfetti(canvas), 5200);
}

function stopConfetti(canvas) {
    if (canvas.dataset.confettiFrame) window.cancelAnimationFrame(Number(canvas.dataset.confettiFrame));
    if (canvas.dataset.confettiTimer) window.clearTimeout(Number(canvas.dataset.confettiTimer));
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    delete canvas.dataset.confettiFrame;
    delete canvas.dataset.confettiTimer;
}

export function bindKeyboard({ keys, onKickStart, onKickRelease, onBackDoubleTap }) {
    let lastBackTapAt = 0;
    window.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
        if (event.code === 'Space') {
            if (!event.repeat) onKickStart();
            return;
        }
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
        if (event.code === 'Space') {
            onKickRelease();
            return;
        }
        keys.delete(event.code);
    });
}

export function bindTouchControls({ keys, onKickStart, onKickRelease, onKickCancel, onBackDoubleTap }) {
    let lastBackTapAt = 0;
    document.querySelectorAll('[data-key]').forEach((button) => {
        const key = button.dataset.key;
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            if (key === 'Space') {
                onKickStart();
                return;
            }
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
        button.addEventListener('pointerup', () => { if (key === 'Space') onKickRelease(); else keys.delete(key); });
        button.addEventListener('pointercancel', () => { if (key === 'Space') onKickCancel(); else keys.delete(key); });
        button.addEventListener('pointerleave', () => { if (key === 'Space') onKickRelease(); else keys.delete(key); });
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
        const target = aimPoint.clone();
        if (!Number.isFinite(target.x) || flatDistance(target, ball.position) < 0.25) {
            target.set(0, 0, FIELD.goalZ - 1);
        }
        const direction = target.sub(ball.position);
        direction.y = 0;
        if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
        return direction.normalize();
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
