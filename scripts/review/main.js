import * as THREE from 'three';
import {createRenderer} from '../vendor/prompt2rig/renderer.js';
import {createMaterials, createCharacter, addLights} from '../game/assets.js';
import {updatePlayerAnimation} from '../game/player-animation.js';
import {updateGoalkeeperAnimation} from '../game/goalkeeper-animation.js';
import {MOTION_TIMING} from '../game/football-motion.js';
import {createGameState, updateBall, updateKeeper, updatePlayer, startKickCharge, releaseKickCharge} from '../game/rules.js';
import {kickBall} from '../game/kicking.js';
import {BALL_GROUND_Y, BALL_RADIUS, FIELD_SURFACE_Y} from '../game/config.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9eee5);
scene.userData.labFloorY = FIELD_SURFACE_Y;
addLights(scene);
const renderer = createRenderer();
$('stage').append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const materials = createMaterials();
const player = createCharacter(materials, materials.player, 'player');
const keeper = createCharacter(materials, materials.keeper, 'keeper');
player.userData.motionCharacter = keeper.userData.motionCharacter = true;
scene.add(player, keeper);
for (const character of [player, keeper]) character.traverse(o => {if (o.isSprite) o.visible = false;});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12), materials.ball);
ball.userData.motionCharacter = true;
scene.add(ball);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({color: 0xd5e2d0}));
floor.rotation.x = -Math.PI / 2;
floor.position.y = FIELD_SURFACE_Y;
floor.receiveShadow = true;
scene.add(floor);
let id = 'kick', time = 0.52, playing = false, view = 'three', last = performance.now(), scenario = null;
const views = {front:[0,2.5,6.5],side:[6.5,2.5,0],back:[0,2.5,-6.5],three:[4,3,5],topFront:[3,5,4],topBack:[-3,5,-4]};
function setView(next) {
    view = next;
    camera.position.set(...views[view]);
    camera.lookAt(0.45, 1.05, 0);
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
}
function selectMotion(next) {
    scenario = null; playing = false; id = next; time = MOTION_TIMING[id].contact;
    player.position.set(0, 0, 0); player.rotation.y = 0;
    keeper.position.set(0, 0, 0); keeper.rotation.y = 0;
    $('motion').value = id;
    $('time').max = MOTION_TIMING[id].duration;
    $('play').textContent = '播放';
    const t = MOTION_TIMING[id];
    $('phases').replaceChildren();
    for (const [label, at] of [['准备',0],['蓄力 / 蹬地', t.windup || 0.13],['触球', t.contact],['随摆 / 落地', t.follow || t.land],['恢复', t.duration]]) {
        const b = document.createElement('button'); b.textContent = label;
        b.onclick = () => {playing = false; scenario = null; time = at; $('play').textContent = '播放';};
        $('phases').append(b);
    }
}
function startScenario(kind) {
    selectMotion(kind === 'shot' ? 'kick' : kind === 'left' ? 'diveLeft' : kind === 'right' ? 'diveRight' : kind === 'center' ? 'scoop' : 'punch');
    const state = createGameState();
    const x = kind === 'left' ? 1.45 : kind === 'right' ? -1.45 : 0;
    ball.position.set(x, kind === 'high' ? 2 : BALL_GROUND_Y, 3.2);
    state.ballVelocity.set(0, kind === 'high' ? 3.8 : 0, -8);
    if (kind === 'shot') {
        player.position.set(0, 0, 1.6); player.rotation.y = Math.PI;
        ball.position.set(0, BALL_GROUND_Y, 1.12);
        state.ballVelocity.set(0,0,0); state.kickDirection.set(0,0,-1);
        startKickCharge(state, 9.5);
        releaseKickCharge(state, 10, power => {
            kickBall({state,player,ball,getAimDirection:()=>state.kickDirection,showMessage:()=>{}},power);
            $('test-result').textContent = `射门触球成功 · 足球于触球帧离脚，力量 ${Math.round(power * 100)}%`;
        });
    }
    scenario = {kind,state,elapsed:10,age:0,saved:false};
    $('test-result').textContent = '测试进行中 · 足球尚未与人物接触';
}
$('motion').onchange = e => selectMotion(e.target.value);
$('play').onclick = () => {scenario = null; playing = !playing; if (time >= MOTION_TIMING[id].duration) time = 0; $('play').textContent = playing ? '暂停' : '播放';};
$('time').oninput = e => {scenario = null; playing = false; time = Number(e.target.value); $('play').textContent = '播放';};
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
document.querySelectorAll('[data-test]').forEach(b => b.onclick = () => startScenario(b.dataset.test));
function renderPose(dt) {
    player.visible = id === 'kick'; keeper.visible = id !== 'kick';
    if (scenario) {
        const s = scenario; s.elapsed += dt; s.age += dt;
        if (s.kind === 'shot') updatePlayer({dt,state:s.state,keys:new Set(),player,ball,getAimDirection:()=>s.state.kickDirection,elapsedTime:s.elapsed});
        updateBall({dt,state:s.state,ball});
        if (s.kind !== 'shot') updateKeeper({dt,state:s.state,keeper,ball,elapsedTime:s.elapsed,onKeeperSave:()=>{
            s.saved = true;
            $('test-result').textContent = '扑救触球成功 · 足球在接触手套 / 身体后改变方向';
        }});
        if (s.age > 2.5 && !s.saved && s.kind !== 'shot') $('test-result').textContent = '本次球未接触门将，继续飞行；没有触发远距离弹球。';
        return;
    }
    if (id === 'kick') {
        ball.position.set(-0.16, BALL_GROUND_Y, 0.57);
        updatePlayerAnimation(player,{dt,elapsedTime:time,kicking:true,kickTime:time,
            ballPosition: time <= 0.54 ? ball.position : null,kickDirection:new THREE.Vector3(0,0,1)});
        if (time > 0.52) ball.position.z += Math.min(1.2, (time - 0.52) * 4);
    } else {
        const side = id === 'diveRight' ? -1 : 1;
        ball.position.set(id === 'punch' || id === 'scoop' ? 0 : side * 1.48, id === 'punch' ? 2.28 : id === 'scoop' ? BALL_GROUND_Y : 0.55, 0.3);
        updateGoalkeeperAnimation(keeper,{elapsedTime:time,diving:id.startsWith('dive'),punching:id==='punch',scooping:id==='scoop',
            motionTime:time,diveDirection:side,saveHeight:ball.position.y,saveTarget:ball.position});
    }
}
function resize() {
    const width = Math.max(320, Math.min(1136, innerWidth - 44));
    const height = Math.min(540, Math.round(width * 0.48));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}
function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.033); last = now;
    if (playing) time = (time + dt * Number($('speed').value)) % MOTION_TIMING[id].duration;
    renderPose(dt);
    $('time').value = time;
    $('time-value').textContent = `${time.toFixed(2)} s`;
    $('status').textContent = `${renderer.compatibility ? 'Canvas 兼容预览' : 'WebGL 预览'} · ${(id === 'kick' ? player : keeper).userData.headLoaded ? '原游戏头部已载入' : '头部载入中'} · 可暂停检查六个视角`;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}
window.addEventListener('error', e => $('error').textContent = e.message);
window.addEventListener('unhandledrejection', e => $('error').textContent = String(e.reason));
window.addEventListener('resize', resize);
resize(); setView(view); selectMotion(id); requestAnimationFrame(tick);
