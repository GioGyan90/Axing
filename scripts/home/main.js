import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HOME_MODEL_URL } from './assets.js';

let scene, camera, renderer, model, playerModel;
let mixer = null;
let clock = new THREE.Clock();
let animations = [];
let mouseX = 0, mouseY = 0;

const getIsMobile = () => window.innerWidth <= 768;

init3D();

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const pLight = new THREE.PointLight(0x4facfe, 20, 10);
    pLight.position.set(2, 2, 2);
    scene.add(pLight);

    const loader = new GLTFLoader();
    loader.load(HOME_MODEL_URL, (gltf) => {
        model = gltf.scene;
        updateModelLayout();
        scene.add(model);
        
        // 处理动画
        if (gltf.animations && gltf.animations.length > 0) {
            animations = gltf.animations;
            mixer = new THREE.AnimationMixer(model);
            // 播放第一个动画
            const action = mixer.clipAction(animations[0]);
            action.play();
        }
        
        // 加载球员模型
        loadPlayerModel(loader);
        
        animate();
    });

    window.addEventListener('mousemove', (e) => {
        if (!getIsMobile()) {
            mouseX = (e.clientX - window.innerWidth / 2) / 100;
            mouseY = (e.clientY - window.innerHeight / 2) / 100;
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateModelLayout();
    });
}

function updateModelLayout() {
    if (!model) return;
    if (getIsMobile()) {
        model.scale.set(1.6, 1.6, 1.6);
        // 核心修改：从 -0.9 向上回调 1 个单位，变为 0.1
        // 这样模型重心刚好在屏幕中心稍偏上一点点
        model.position.set(0, 0.1, 0);
    } else {
        model.scale.set(2.2, 2.2, 2.2);
        model.position.set(0.8, -0.3, 0);
    }
    
    // 更新球员位置
    if (playerModel) {
        if (getIsMobile()) {
            playerModel.position.set(-1.5, 0.1, 0);
            playerModel.scale.set(1.6, 1.6, 1.6);
        } else {
            playerModel.position.set(-1.2, -0.3, 0);
            playerModel.scale.set(2.2, 2.2, 2.2);
        }
    }
}

function loadPlayerModel(loader) {
    const headUrl = new URL('../../models/red_compressed.glb', import.meta.url).href;
    
    // 克隆 ZL9 身体模型
    const bodyClone = model.clone();
    playerModel = bodyClone;
    
    // 加载头部模型并替换
    loader.load(headUrl, (headGltf) => {
        const headModel = headGltf.scene;
        
        // 查找并移除原身体的头部
        bodyClone.traverse((child) => {
            if (child.isMesh && child.name.toLowerCase().includes('head')) {
                child.visible = false;
            }
        });
        
        // 设置头部位置和缩放
        headModel.scale.set(1, 1, 1);
        headModel.position.set(0, 1.6, 0);
        bodyClone.add(headModel);
        
        scene.add(playerModel);
        updateModelLayout();
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    // 更新动画混合器
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    if (model) {
        model.rotation.y += 0.005;
        model.rotation.x += (mouseY * 0.1 - model.rotation.x) * 0.05;
        model.rotation.z += (mouseX * 0.1 - model.rotation.z) * 0.05;
    }
    if (playerModel) {
        playerModel.rotation.y += 0.005;
        playerModel.rotation.x += (mouseY * 0.1 - playerModel.rotation.x) * 0.05;
        playerModel.rotation.z += (mouseX * 0.1 - playerModel.rotation.z) * 0.05;
    }
    renderer.render(scene, camera);
}

// --- 弹幕逻辑 ---
const bContainer = document.getElementById('barrage-container');
const input = document.getElementById('barrage-input');
const btn = document.getElementById('send-btn');
const STORAGE_KEY = 'axing_final_v6';
const BARRAGE_FILE_URL = './barrages.json';
let barragePool = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

// 从仓库文件加载历史弹幕
async function loadBarragesFromFile() {
    try {
        const response = await fetch(BARRAGE_FILE_URL);
        if (response.ok) {
            const data = await response.json();
            if (data.barrages && Array.isArray(data.barrages)) {
                // 合并文件中的弹幕到本地池（去重）
                data.barrages.forEach(text => {
                    if (!barragePool.includes(text)) {
                        barragePool.push(text);
                    }
                });
                console.log(`已从文件加载 ${data.barrages.length} 条历史弹幕`);
            }
        }
    } catch (error) {
        console.warn('无法加载弹幕文件，使用本地存储:', error);
    }
}

// 保存新弹幕到仓库文件（通过 localStorage 同步模拟）
function saveBarrageToFile(newText) {
    if (!barragePool.includes(newText)) {
        barragePool.push(newText);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(barragePool));
        
        // 注意：由于浏览器安全限制，纯前端无法直接写入文件
        // 实际部署时需要后端 API 支持，这里仅做本地持久化
        console.log(`新弹幕 "${newText}" 已保存到本地，需后端支持才能写入 barrages.json`);
    }
}

function createBarrage(text) {
    const isMobile = getIsMobile();
    const b = document.createElement('div');
    b.className = 'barrage-item';
    b.innerText = text;
    const size = (Math.random() * (isMobile ? 0.8 : 1.5) + (isMobile ? 0.7 : 1.0)).toFixed(1);
    b.style.fontSize = size + 'rem';
    const baseOpacity = (size / 4) + 0.2;
    const colors = [`rgba(255,255,255,${baseOpacity})`, `rgba(79,172,254,${baseOpacity + 0.1})`, `rgba(0,242,254,${baseOpacity + 0.1})` ];
    b.style.color = colors[Math.floor(Math.random() * colors.length)];
    b.style.top = Math.random() * 90 + 5 + 'vh';
    b.style.animation = `moveBarrage ${Math.random() * 5 + (isMobile ? 6 : 10)}s linear forwards`;
    bContainer.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
}

function startLoop() {
    setInterval(() => {
        if (barragePool.length) createBarrage(barragePool[Math.floor(Math.random() * barragePool.length)]);
    }, getIsMobile() ? 1200 : 1800);
}

function handleSend() {
    const t = input.value.trim();
    if (t) {
        createBarrage(t);
        saveBarrageToFile(t);
        input.value = '';
    }
}

// 初始化：加载历史弹幕
loadBarragesFromFile().then(() => {
    startLoop();
});

btn.addEventListener('click', handleSend);
input.addEventListener('keypress', (e) => e.key === 'Enter' && handleSend());
