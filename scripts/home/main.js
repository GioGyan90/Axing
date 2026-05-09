import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HOME_MODEL_URL } from './assets.js';

let scene, camera, renderer, model;
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
}

function animate() {
    requestAnimationFrame(animate);
    if (model) {
        model.rotation.y += 0.005;
        model.rotation.x += (mouseY * 0.1 - model.rotation.x) * 0.05;
        model.rotation.z += (mouseX * 0.1 - model.rotation.z) * 0.05;
    }
    renderer.render(scene, camera);
}

// --- 弹幕逻辑 ---
const bContainer = document.getElementById('barrage-container');
const input = document.getElementById('barrage-input');
const btn = document.getElementById('send-btn');
const STORAGE_KEY = 'axing_final_v6';
let barragePool = JSON.parse(localStorage.getItem(STORAGE_KEY) || '["不够不堪！", "三鲜伊面天下第一", "细节拉满了", "阿性你真行"]');

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
        if (!barragePool.includes(t)) {
            barragePool.push(t);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(barragePool));
        }
        input.value = '';
    }
}

btn.addEventListener('click', handleSend);
input.addEventListener('keypress', (e) => e.key === 'Enter' && handleSend());
startLoop();
