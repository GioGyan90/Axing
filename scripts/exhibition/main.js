import * as THREE from 'three';
import {
    addLights,
    createCharacter,
    createMaterials,
    updateCharacterPose,
} from '../game/assets.js';

const container = document.getElementById('exhibition-canvas');
const caption = document.getElementById('stage-caption');
const tabs = Array.from(document.querySelectorAll('.model-tab'));
const actionSelect = document.getElementById('action-select');
const captions = {
    player: '玩家 ZL9：放大头部后的主角模型',
    keeper: '队员：粉色队服的守门员模型',
    referee: '裁判：黑色制服与视野判定角色模型',
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.Fog(0x07111f, 10, 28);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
camera.position.set(0, 2.35, 7.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

addLights(scene);

const materials = createMaterials();
const stage = new THREE.Group();
scene.add(stage);

const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.9, 4.35, 0.32, 64),
    new THREE.MeshStandardMaterial({ color: 0x123c56, roughness: 0.72, metalness: 0.12 })
);
floor.position.y = -0.16;
floor.receiveShadow = true;
stage.add(floor);

const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.75, 0.03, 10, 96),
    new THREE.MeshBasicMaterial({ color: 0x6dfcff, transparent: true, opacity: 0.5 })
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.02;
stage.add(ring);

const characters = {
    player: createCharacter(materials, materials.player, 'player'),
    keeper: createCharacter(materials, materials.keeper, 'keeper'),
    referee: createCharacter(materials, materials.referee, 'referee'),
};

const layout = {
    player: { x: -1.9, z: 0.18, yaw: 0.4 },
    keeper: { x: 0, z: -0.15, yaw: 0 },
    referee: { x: 1.9, z: 0.18, yaw: -0.4 },
};

Object.entries(characters).forEach(([key, character]) => {
    const spot = layout[key];
    character.position.set(spot.x, 0.04, spot.z);
    character.rotation.y = spot.yaw;
    stage.add(character);
});

let focused = 'player';
let currentAction = 'idle';
let dragging = false;
let lastX = 0;
let targetStageRotation = -0.15;
const clock = new THREE.Clock();
const galleryMovement = new THREE.Vector3();

// Action configuration: movement speed and special flags for each action
const actionConfig = {
    idle: { speed: 0, sprint: false, kicking: false, diving: false },
    walk: { speed: 1.2, sprint: false, kicking: false, diving: false },
    run: { speed: 3.5, sprint: false, kicking: false, diving: false },
    sprint: { speed: 5.5, sprint: true, kicking: false, diving: false },
    kick: { speed: 0, sprint: false, kicking: true, diving: false },
    dive: { speed: 0, sprint: false, kicking: false, diving: true },
};

// Action select event listener
actionSelect?.addEventListener('change', (event) => {
    currentAction = event.target.value;
});

function setFocus(target) {
    focused = target;
    caption.textContent = captions[target];
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === target));
    const x = layout[target].x;
    targetStageRotation = THREE.MathUtils.clamp(-x * 0.12, -0.5, 0.5);
}

tabs.forEach((tab) => {
    tab.addEventListener('click', () => setFocus(tab.dataset.target));
});

container.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    container.setPointerCapture(event.pointerId);
});

container.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = event.clientX - lastX;
    lastX = event.clientX;
    targetStageRotation += delta * 0.006;
});

container.addEventListener('pointerup', (event) => {
    dragging = false;
    container.releasePointerCapture(event.pointerId);
});

container.addEventListener('pointercancel', () => {
    dragging = false;
});

window.addEventListener('resize', resize);
resize();
setFocus(focused);
animate();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);
    const elapsedTime = clock.elapsedTime;

    stage.rotation.y = THREE.MathUtils.lerp(stage.rotation.y, targetStageRotation, 0.06);
    
    // Get action config for current action
    const config = actionConfig[currentAction] || actionConfig.idle;
    
    // For kick and dive actions, use periodic animation loop
    let kicking = false;
    let diving = false;
    let kickProgress = 0;
    let diveProgress = 0;
    
    if (config.kicking) {
        // Loop kick animation every 1.2 seconds
        const kickCycleTime = (elapsedTime % 1.2) / 1.2;
        kicking = true;
        kickProgress = kickCycleTime;
    } else if (config.diving) {
        // Loop dive animation every 1.5 seconds
        const diveCycleTime = (elapsedTime % 1.5) / 1.5;
        diving = true;
        diveProgress = diveCycleTime;
    }
    
    Object.entries(characters).forEach(([key, character], index) => {
        const isFocused = key === focused;
        const targetScale = isFocused ? 1.16 : 0.9;
        const scale = THREE.MathUtils.lerp(character.scale.x, targetScale, 0.08);
        character.scale.setScalar(scale);
        character.position.y = 0.04 + (isFocused ? Math.sin(elapsedTime * 2.1) * 0.025 : 0);
        
        // Calculate movement based on action
        let moveSpeed = config.speed;
        if (!isFocused && moveSpeed > 0) {
            moveSpeed = Math.max(moveSpeed * 0.2, 0.15);
        }
        
        updateCharacterPose(character, {
            dt,
            elapsedTime: elapsedTime + index * 0.25,
            movement: galleryMovement.set(isFocused && !config.kicking && !config.diving ? moveSpeed : (config.speed > 0 ? moveSpeed : 0), 0, 0),
            kicking,
            kickProgress,
            diving,
            diveProgress,
            isSprinting: config.sprint,
        });
    });

    renderer.render(scene, camera);
}

function resize() {
    const { width, height } = container.getBoundingClientRect();
    const renderWidth = Math.max(1, Math.floor(width));
    const renderHeight = Math.max(1, Math.floor(height));
    renderer.setSize(renderWidth, renderHeight, false);
    camera.aspect = renderWidth / renderHeight;
    camera.updateProjectionMatrix();
}
