import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BALL_RADIUS, FIELD, FIELD_SURFACE_Y, MODEL_ASSETS } from './config.js';

export function createMaterials() {
    return {
        grass: new THREE.MeshStandardMaterial({ color: 0x2fb36d, roughness: 0.82 }),
        stripe: new THREE.MeshStandardMaterial({ color: 0x24975d, roughness: 0.88 }),
        line: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
        player: new THREE.MeshStandardMaterial({ color: 0x4facfe, roughness: 0.52, metalness: 0.08 }),
        keeper: new THREE.MeshStandardMaterial({ color: 0xff5f8f, roughness: 0.55, metalness: 0.04 }),
        referee: new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.62, metalness: 0.05 }),
        ball: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
        refereeVision: new THREE.MeshBasicMaterial({
            color: 0x064d2e,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
            side: THREE.DoubleSide,
        }),
        dark: new THREE.MeshStandardMaterial({ color: 0x142039, roughness: 0.75 }),
        goal: new THREE.MeshStandardMaterial({ color: 0xdcecff, roughness: 0.35, metalness: 0.2 }),
        shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
    };
}

export function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xd9f4ff, 0x12331f, 1.85));
    const sun = new THREE.DirectionalLight(0xffffff, 2.25);
    sun.position.set(8, 18, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);
}

export function buildPitch(world, materials) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(FIELD.width + 1.2, 0.9, FIELD.depth + 1.2), materials.dark);
    base.position.y = -0.53;
    base.receiveShadow = true;
    world.add(base);

    for (let i = 0; i < 8; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(FIELD.width, 0.08, FIELD.depth / 8), i % 2 ? materials.grass : materials.stripe);
        strip.position.set(0, 0, -FIELD.depth / 2 + FIELD.depth / 16 + i * FIELD.depth / 8);
        strip.receiveShadow = true;
        world.add(strip);
    }

    addBoundaryLines(world, materials);
    addLine(world, materials, 0, 0.08, 0, FIELD.width, 0.05, 0.08);
    addLine(world, materials, 0, 0.1, FIELD.goalZ + 1.6, FIELD.width * 0.55, 0.05, 0.08);
    addLine(world, materials, -FIELD.width * 0.275, 0.1, FIELD.goalZ + 0.8, 0.05, 0.05, 1.6);
    addLine(world, materials, FIELD.width * 0.275, 0.1, FIELD.goalZ + 0.8, 0.05, 0.05, 1.6);
    addCircle(world, materials, 0, 0.11, 0, 1.1);
    addGoal(world, materials);
    addCrowdBlocks(world);
}


function addBoundaryLines(world, materials) {
    const halfWidth = FIELD.width / 2;
    const halfDepth = FIELD.depth / 2;
    addLine(world, materials, 0, 0.12, -halfDepth, FIELD.width, 0.07, 0.08);
    addLine(world, materials, 0, 0.12, halfDepth, FIELD.width, 0.07, 0.08);
    addLine(world, materials, -halfWidth, 0.12, 0, 0.08, 0.07, FIELD.depth);
    addLine(world, materials, halfWidth, 0.12, 0, 0.08, 0.07, FIELD.depth);
}

function addLine(world, materials, x, y, z, width, height, depth) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.line);
    line.position.set(x, y, z);
    world.add(line);
}

function addCircle(world, materials, x, y, z, radius) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 72), materials.line);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    world.add(ring);
}

function addGoal(world, materials) {
    const frame = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.16, 2.4, 0.16);
    const barGeo = new THREE.BoxGeometry(5.3, 0.16, 0.16);
    const leftPost = new THREE.Mesh(postGeo, materials.goal);
    const rightPost = new THREE.Mesh(postGeo, materials.goal);
    const crossbar = new THREE.Mesh(barGeo, materials.goal);
    leftPost.position.set(-2.65, 1.2, FIELD.goalZ);
    rightPost.position.set(2.65, 1.2, FIELD.goalZ);
    crossbar.position.set(0, 2.38, FIELD.goalZ);
    frame.add(leftPost, rightPost, crossbar);

    const net = new THREE.Mesh(new THREE.BoxGeometry(5.3, 2.2, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
    net.position.set(0, 1.16, FIELD.goalZ - 0.22);
    frame.add(net);
    
    // Add support braces (right-angled trapezoid prism shape from side view, same material as goal frame)
    // The short side of both trapezoids faces away from the field (outward)
    // Left brace behind left post - short side faces left (outward)
    const leftBraceShape = new THREE.Shape();
    leftBraceShape.moveTo(0, 0);
    leftBraceShape.lineTo(0, 2.4);
    leftBraceShape.lineTo(1.2, 0.3);
    leftBraceShape.lineTo(1.2, 0);
    leftBraceShape.lineTo(0, 0);
    const leftBraceExtrudeSettings = { depth: 0.16, bevelEnabled: false };
    const leftBraceGeo = new THREE.ExtrudeGeometry(leftBraceShape, leftBraceExtrudeSettings);
    const leftBrace = new THREE.Mesh(leftBraceGeo, materials.goal);
    leftBrace.position.set(-2.65 - 0.08, 0, FIELD.goalZ + 0.08);
    leftBrace.rotation.y = Math.PI / 2;
    leftBrace.castShadow = true;
    frame.add(leftBrace);
    
    // Right brace behind right post - short side faces right (outward)
    const rightBraceShape = new THREE.Shape();
    rightBraceShape.moveTo(0, 0);
    rightBraceShape.lineTo(0, 2.4);
    rightBraceShape.lineTo(-1.2, 0.3);
    rightBraceShape.lineTo(-1.2, 0);
    rightBraceShape.lineTo(0, 0);
    const rightBraceExtrudeSettings = { depth: 0.16, bevelEnabled: false };
    const rightBraceGeo = new THREE.ExtrudeGeometry(rightBraceShape, rightBraceExtrudeSettings);
    const rightBrace = new THREE.Mesh(rightBraceGeo, materials.goal);
    rightBrace.position.set(2.65 + 0.08, 0, FIELD.goalZ + 0.08);
    rightBrace.rotation.y = -Math.PI / 2;
    rightBrace.castShadow = true;
    frame.add(rightBrace);
    
    leftPost.userData.isGoalPost = true;
    rightPost.userData.isGoalPost = true;
    crossbar.userData.isGoalPost = true;
    
    world.add(frame);
}

function addCrowdBlocks(world) {
    for (let i = 0; i < 28; i++) {
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.28 + Math.random() * 0.7, 0.42),
            new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.52 + Math.random() * 0.25, 0.72, 0.58) })
        );
        const side = i % 2 ? -1 : 1;
        seat.position.set(side * (FIELD.width / 2 + 1.2 + Math.random() * 1.4), seat.geometry.parameters.height / 2, -FIELD.depth / 2 + Math.random() * FIELD.depth);
        seat.castShadow = true;
        world.add(seat);
    }
}

const CHARACTER_FOOT_CLEARANCE = 0.325;
const DEFAULT_PLAYER_USERNAME = 'ZL9';
const ZL9_HEAD_SIZE = 1.02;
const ZL9_HEAD_CENTER = new THREE.Vector3(0, 0.12, 0);
const ZL9_HEAD_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);
const PLAYER_BODY_SCALE = 0.88;
const CHARACTER_BODY_Y = 0.78;
const CHARACTER_BODY_HEIGHT = 0.42;
const CHARACTER_HEAD_Y = 1.3;

export function createCharacter(materials, material, type) {
    const bodyScale = type === 'player' ? PLAYER_BODY_SCALE : 1;
    const bodyBaseY = CHARACTER_BODY_Y * bodyScale;
    const headBaseY = CHARACTER_HEAD_Y * bodyScale;
    const scaleValue = (value) => value * bodyScale;
    const scaleTuple = (values) => values.map(scaleValue);
    const group = new THREE.Group();
    const visualRoot = new THREE.Group();
    visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE;
    const skin = new THREE.MeshStandardMaterial({ color: type === 'player' ? 0xffcf9f : 0xffc4ae, roughness: 0.62 });
    const shortsColor = type === 'player' ? 0x235da8 : (type === 'referee' ? 0x05070a : 0x7a2544);
    const shorts = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.62 });
    const socks = new THREE.MeshStandardMaterial({ color: 0xf6f7ff, roughness: 0.5 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x101522, roughness: 0.58 });
    const glove = new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: 0.46, metalness: 0.03 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: type === 'player' ? 0x3b2415 : 0x21140f, roughness: 0.7 });

    const body = createVoxelBody(scaleValue(0.34), scaleValue(CHARACTER_BODY_HEIGHT), material, shorts);
    body.position.y = bodyBaseY;
    body.castShadow = true;

    const head = new THREE.Group();
    head.position.y = headBaseY;
    const fallbackHead = createVoxelHead(skin, hairMaterial, type);
    fallbackHead.castShadow = true;
    head.add(fallbackHead);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 28), materials.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = FIELD_SURFACE_Y + 0.006;

    const limbs = new THREE.Group();
    const limbRefs = {
        leftArm: createLimb({ upperLength: scaleValue(0.29), lowerLength: scaleValue(0.28), radius: scaleValue(0.055), upperMaterial: material, lowerMaterial: skin, endMaterial: type === 'keeper' ? glove : skin, endScale: scaleTuple([0.145, 0.105, 0.135]) }),
        rightArm: createLimb({ upperLength: scaleValue(0.29), lowerLength: scaleValue(0.28), radius: scaleValue(0.055), upperMaterial: material, lowerMaterial: skin, endMaterial: type === 'keeper' ? glove : skin, endScale: scaleTuple([0.145, 0.105, 0.135]) }),
        leftLeg: createLimb({ upperLength: scaleValue(0.43), lowerLength: scaleValue(0.39), radius: scaleValue(0.098), upperMaterial: shorts, lowerMaterial: socks, endMaterial: boot, endScale: scaleTuple([0.22, 0.11, 0.34]) }),
        rightLeg: createLimb({ upperLength: scaleValue(0.43), lowerLength: scaleValue(0.39), radius: scaleValue(0.098), upperMaterial: shorts, lowerMaterial: socks, endMaterial: boot, endScale: scaleTuple([0.22, 0.11, 0.34]) }),
    };

    limbRefs.leftArm.hip.position.set(scaleValue(-0.46), scaleValue(0.98), 0);
    limbRefs.rightArm.hip.position.set(scaleValue(0.46), scaleValue(0.98), 0);
    limbRefs.leftLeg.hip.position.set(scaleValue(-0.19), scaleValue(0.42), 0);
    limbRefs.rightLeg.hip.position.set(scaleValue(0.19), scaleValue(0.42), 0);
    limbs.add(limbRefs.leftArm.hip, limbRefs.rightArm.hip, limbRefs.leftLeg.hip, limbRefs.rightLeg.hip);

    if (type === 'player') {
        const nameTag = createPlayerNameTag(DEFAULT_PLAYER_USERNAME);
        const jerseyNumber = createJerseyBackNumber('9', bodyScale);
        nameTag.position.set(0, 2.22, 0);
        body.add(jerseyNumber);
        visualRoot.add(nameTag);
    }

    visualRoot.add(body, head, limbs);
    group.add(visualRoot, shadow);
    group.userData.velocity = new THREE.Vector3();
    group.userData.facing = new THREE.Vector3(0, 0, -1);
    const hitMaterials = collectHitFlashMaterials(visualRoot);
    group.userData.hitFlashUntil = 0;
    group.userData.pose = { visualRoot, body, head, limbs, hitMaterials, bodyBaseY, headBaseY, ...limbRefs, lastPosition: new THREE.Vector3(), speed: 0, phase: Math.random() * Math.PI * 2 };
    if (type === 'player') {
        loadZl9HeadModel(group, head);
    } else if (type === 'referee') {
        loadRefereeHeadModel(group, head);
    } else if (type === 'keeper') {
        loadKeeperHeadModel(group, head);
    }
    return group;
}

function loadZl9HeadModel(character, headAnchor) {
    const loader = new GLTFLoader();
    loader.load(MODEL_ASSETS.playerHead, (gltf) => {
        const headModel = gltf.scene;
        headModel.rotation.copy(ZL9_HEAD_ROTATION);
        fitModelToBox(headModel, ZL9_HEAD_SIZE, ZL9_HEAD_CENTER);
        headModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        headAnchor.clear();
        headAnchor.add(headModel);
        character.userData.pose.hitMaterials.push(...collectHitFlashMaterials(headModel));
    });
}

function loadRefereeHeadModel(character, headAnchor) {
    const loader = new GLTFLoader();
    loader.load(MODEL_ASSETS.refereeHead, (gltf) => {
        const headModel = gltf.scene;
        headModel.rotation.copy(ZL9_HEAD_ROTATION);
        fitModelToBox(headModel, ZL9_HEAD_SIZE, ZL9_HEAD_CENTER);
        headModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        headAnchor.clear();
        headAnchor.add(headModel);
        character.userData.pose.hitMaterials.push(...collectHitFlashMaterials(headModel));
    });
}

function loadKeeperHeadModel(character, headAnchor) {
    const loader = new GLTFLoader();
    loader.load(MODEL_ASSETS.keeperHead, (gltf) => {
        const headModel = gltf.scene;
        headModel.rotation.copy(ZL9_HEAD_ROTATION);
        fitModelToBox(headModel, ZL9_HEAD_SIZE, ZL9_HEAD_CENTER);
        headModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        headAnchor.clear();
        headAnchor.add(headModel);
        character.userData.pose.hitMaterials.push(...collectHitFlashMaterials(headModel));
    });
}


function createPlayerNameTag(username = DEFAULT_PLAYER_USERNAME) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        ctx.shadowColor = 'rgba(56, 189, 248, 0.88)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(14, 116, 255, 0.92)';
        ctx.strokeStyle = 'rgba(190, 235, 255, 0.98)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(128, 190);
        ctx.lineTo(74, 94);
        ctx.lineTo(182, 94);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'rgba(125, 211, 252, 0.75)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#050912';
        ctx.lineWidth = 8;
        ctx.font = '900 64px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(username, 128, 48);
        ctx.fillText(username, 128, 48);
        ctx.restore();
        texture.needsUpdate = true;
    };
    draw();

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.9, 0.78, 1);
    sprite.renderOrder = 10;
    sprite.userData.baseScale = sprite.scale.clone();
    return sprite;
}

function createJerseyBackNumber(number = '9', bodyScale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(10, 25, 55, 0.45)';
    ctx.lineWidth = 8;
    ctx.font = 'bold 122px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(number, 64, 86);
    ctx.fillText(number, 64, 86);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
    });
    const numberPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.36 * bodyScale, 0.45 * bodyScale), material);
    numberPlane.position.set(0, 0.02 * bodyScale, -0.345 * bodyScale);
    numberPlane.rotation.y = Math.PI;
    numberPlane.renderOrder = 4;
    return numberPlane;
}

function createVoxelBody(radius, height, material, lowerBodyMaterial = material) {
    const body = new THREE.Group();
    
    // Torso - main box (upper chest)
    const torsoWidth = radius * 2.2;
    const torsoDepth = radius * 1.6;
    const torsoHeight = height * 0.55;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth), material);
    torso.position.y = height * 0.48;
    torso.castShadow = true;
    body.add(torso);
    
    // Chest plate (slightly protruding)
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 0.85, torsoHeight * 0.55, torsoDepth * 0.3), material);
    chestPlate.position.set(0, height * 0.52, torsoDepth * 0.15);
    chestPlate.castShadow = true;
    body.add(chestPlate);
    
    // Shoulders
    const shoulderWidth = radius * 0.9;
    const shoulderHeight = radius * 0.6;
    const shoulderDepth = torsoDepth * 0.7;
    
    const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(shoulderWidth, shoulderHeight, shoulderDepth), material);
    leftShoulder.position.set(-torsoWidth / 2 - shoulderWidth / 2 + radius * 0.3, height * 0.72, 0);
    leftShoulder.castShadow = true;
    body.add(leftShoulder);
    
    const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(shoulderWidth, shoulderHeight, shoulderDepth), material);
    rightShoulder.position.set(torsoWidth / 2 + shoulderWidth / 2 - radius * 0.3, height * 0.72, 0);
    rightShoulder.castShadow = true;
    body.add(rightShoulder);
    
    // Abdomen section (between torso and hips)
    const abdomenWidth = torsoWidth * 0.92;
    const abdomenHeight = height * 0.20;
    const abdomenDepth = torsoDepth * 0.95;
    const abdomen = new THREE.Mesh(new THREE.BoxGeometry(abdomenWidth, abdomenHeight, abdomenDepth), material);
    abdomen.position.y = height * 0.20;
    abdomen.castShadow = true;
    body.add(abdomen);

    // Waist block between the belly and legs. Match the shorts color so the
    // lower-body rectangle reads as pants instead of a shirt-colored filler.
    const waistFiller = new THREE.Mesh(new THREE.BoxGeometry(abdomenWidth * 0.82, height * 0.9, abdomenDepth * 0.84), lowerBodyMaterial);
    waistFiller.position.set(0, -height * 0.12, abdomenDepth * 0.04);
    waistFiller.castShadow = true;
    body.add(waistFiller);
    
    // Hips / waist section
    const hipWidth = torsoWidth * 0.88;
    const hipHeight = height * 0.16;
    const hipDepth = torsoDepth * 0.92;
    const hips = new THREE.Mesh(new THREE.BoxGeometry(hipWidth, hipHeight, hipDepth), lowerBodyMaterial);
    hips.position.y = height * 0.08;
    hips.castShadow = true;
    body.add(hips);
    // Rear hip/butt block gives the lower body volume from side/back views and
    // covers any imported head-neck geometry that extends too far downward.
    const rearHip = new THREE.Mesh(new THREE.BoxGeometry(hipWidth * 0.84, hipHeight * 0.95, hipDepth * 0.42), lowerBodyMaterial);
    rearHip.position.set(0, height * 0.06, -hipDepth * 0.36);
    rearHip.castShadow = true;
    body.add(rearHip);

    
    // Groin/crotch piece (small connector between legs)
    const groinWidth = hipWidth * 0.55;
    const groinHeight = height * 0.10;
    const groinDepth = hipDepth * 0.75;
    const groin = new THREE.Mesh(new THREE.BoxGeometry(groinWidth, groinHeight, groinDepth), lowerBodyMaterial);
    groin.position.y = 0;
    groin.castShadow = true;
    body.add(groin);
    
    return body;
}

function createVoxelHead(skinMaterial, hairMaterial, type) {
    const head = new THREE.Group();
    
    // Main head cube
    const headSize = 0.42;
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize * 0.9), skinMaterial);
    headBox.castShadow = true;
    head.add(headBox);
    
    // Eyes (two small boxes)
    const eyeSize = 0.06;
    const eyeY = headSize * 0.08;
    const eyeZ = headSize * 0.42;
    
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    leftEye.position.set(-headSize * 0.22, eyeY, eyeZ);
    leftEye.castShadow = true;
    head.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    rightEye.position.set(headSize * 0.22, eyeY, eyeZ);
    rightEye.castShadow = true;
    head.add(rightEye);
    
    // Nose (small box)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), skinMaterial);
    nose.position.set(0, eyeY - 0.05, headSize * 0.45);
    nose.castShadow = true;
    head.add(nose);
    
    // Mouth (thin box)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    mouth.position.set(0, eyeY - 0.12, headSize * 0.43);
    mouth.castShadow = true;
    head.add(mouth);
    
    // Add voxel hair
    head.add(createVoxelHair(hairMaterial, type));
    
    return head;
}

function createVoxelHair(material, type) {
    const hair = new THREE.Group();
    
    // Top cap
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.4), material);
    topCap.position.set(0, 0.22, 0);
    topCap.castShadow = true;
    hair.add(topCap);
    
    // Back section
    const backSection = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.14), material);
    backSection.position.set(0, 0.12, 0.22);
    backSection.castShadow = true;
    hair.add(backSection);
    
    // Side sections
    const sideWidth = type === 'player' ? 0.11 : 0.09;
    const sideHeight = 0.16;
    const sideDepth = 0.28;
    
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, sideHeight, sideDepth), material);
    leftSide.position.set(-0.24, 0.1, 0.02);
    leftSide.castShadow = true;
    hair.add(leftSide);
    
    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, sideHeight, sideDepth), material);
    rightSide.position.set(0.24, 0.1, 0.02);
    rightSide.castShadow = true;
    hair.add(rightSide);
    
    // Fringe/bangs (front blocks)
    const fringeBlocks = type === 'player'
        ? [
            [-0.14, 0.1, -0.18, 0.16, 0.1, 0.1],
            [0.02, 0.08, -0.2, 0.18, 0.09, 0.09],
            [0.16, 0.11, -0.17, 0.11, 0.11, 0.08],
        ]
        : [
            [-0.09, 0.09, -0.19, 0.18, 0.1, 0.09],
            [0.1, 0.1, -0.18, 0.15, 0.11, 0.09],
        ];
    
    fringeBlocks.forEach(([x, y, z, width, height, depth]) => {
        const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        block.position.set(x, y, z);
        block.castShadow = true;
        hair.add(block);
    });
    
    return hair;
}

function createLimb({ upperLength, lowerLength, radius, upperMaterial, lowerMaterial, endMaterial, endScale }) {
    const hip = new THREE.Group();
    const knee = new THREE.Group();
    const upper = createVoxelLimbSegment(radius, upperLength, upperMaterial);
    const lower = createVoxelLimbSegment(radius * 0.88, lowerLength, lowerMaterial);
    const end = new THREE.Mesh(new THREE.BoxGeometry(...endScale), endMaterial);

    upper.position.y = -upperLength / 2;
    knee.position.y = -upperLength;
    lower.position.y = -lowerLength / 2;
    end.position.set(0, -lowerLength - 0.02, -endScale[2] * 0.2);
    upper.castShadow = lower.castShadow = end.castShadow = true;

    knee.add(lower, end);
    hip.add(upper, knee);
    return { hip, knee, upper, lower, end };
}

function createVoxelLimbSegment(radius, length, material) {
    const segment = new THREE.Group();
    
    // Main limb box
    const width = radius * 2;
    const depth = radius * 1.6;
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
    mainBox.castShadow = true;
    segment.add(mainBox);
    
    // Joint connector at top (slightly wider)
    const jointHeight = length * 0.15;
    const jointWidth = width * 1.15;
    const jointDepth = depth * 1.1;
    const joint = new THREE.Mesh(new THREE.BoxGeometry(jointWidth, jointHeight, jointDepth), material);
    joint.position.y = -length / 2 + jointHeight / 2;
    joint.castShadow = true;
    segment.add(joint);
    
    return segment;
}

export function updateCharacterPose(character, { dt, elapsedTime, movement = character.userData.velocity, kicking = false, kickPower = 0, kickPhase = 'charge', kickProgress = 0, knocked = false, getUpProgress = 0, diving = false, diveProgress = 0, punching = false, punchProgress = 0, isSprinting = false, isDribbling = false } = {}) {
    const pose = character.userData.pose;
    if (!pose) return;

    const measuredSpeed = pose.lastPosition.distanceTo(character.position) / Math.max(dt, 0.0001);
    pose.lastPosition.copy(character.position);
    pose.speed = THREE.MathUtils.lerp(pose.speed, Math.max(measuredSpeed, movement.length()), Math.min(1, dt * 10));

    applyHitFlash(character, pose, elapsedTime);

    const bodyY = pose.bodyBaseY ?? CHARACTER_BODY_Y;
    const headY = pose.headBaseY ?? CHARACTER_HEAD_Y;
    const runAmount = THREE.MathUtils.clamp(pose.speed / 5.2, 0, 1);
    const sprintFactor = isSprinting ? 1.35 : (isDribbling ? 1.18 : 1.0);
    pose.visualRoot.rotation.set(0, 0, 0);
    pose.visualRoot.position.set(0, FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE, 0);

    if (knocked) {
        const recovery = THREE.MathUtils.clamp(getUpProgress, 0, 1);
        const fall = 1 - recovery;
        pose.visualRoot.rotation.x = -Math.PI / 2 * fall;
        pose.visualRoot.rotation.z = 0.16 * Math.sin(elapsedTime * 16) * fall;
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.18 * recovery;
        pose.body.position.y = bodyY - 0.02;
        pose.body.rotation.set(0.12 * fall, 0, 0.18 * fall);
        pose.head.position.y = headY - 0.06;
        pose.head.rotation.set(-0.22 * fall, 0, 0.34 * fall);
        updatePlayerNameTagFlash(pose, elapsedTime);
        setArmPose(pose.leftArm, 1.18 * fall, 0.12, 0.72 * fall);
        setArmPose(pose.rightArm, -1.05 * fall, 0.18, -0.68 * fall);
        setLegPose(pose.leftLeg, 0.34 * fall, 0.22, -0.28 * fall);
        setLegPose(pose.rightLeg, -0.42 * fall, 0.18, 0.3 * fall);
        return;
    }
    
    // Punch save animation: goalkeeper jumps up with fist raised to hit high ball
    if (punching) {
        const punch = THREE.MathUtils.clamp(punchProgress, 0, 1);
        const punchPhase = Math.sin(punch * Math.PI);
        
        // Body jumps up and extends
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.4 * punchPhase;
        pose.visualRoot.rotation.z = 0.3 * punchPhase;  // Body tilt
        pose.visualRoot.rotation.x = -0.2 * punchPhase;
        
        pose.body.position.y = bodyY + 0.25 * punchPhase;
        pose.body.rotation.set(-0.15 * punchPhase, 0, 0.3 * punchPhase);
        
        // Head looks up at the ball, tilts same as body
        pose.head.position.y = headY + 0.15 * punchPhase;
        pose.head.rotation.set(-0.5 * punchPhase, 0, 0.3 * punchPhase);
        
        // Right arm: rotates fully forward from shoulder joint (forward rotation for punching)
        // Start: hanging down (~-0.2), End: fully rotated forward (Math.PI - 0.2 ≈ 2.94)
        const rightArmAngle = -0.2 + punchPhase * Math.PI;
        setArmPose(pose.rightArm, rightArmAngle, 0.15, 0);
        
        // Right forearm bends at elbow to bring fist forward/up during peak
        // The forearm is the 'knee' joint of the arm limb
        const rightForearmBend = punchPhase > 0.5 ? (punchPhase - 0.5) * 2.5 : 0;
        pose.rightArm.knee.rotation.x = rightForearmBend;
        
        // Left arm: rotates fully forward from shoulder joint (same direction as right arm for punching)
        // Start: hanging down (~-0.2), End: fully rotated forward (Math.PI - 0.2 ≈ 2.94)
        const leftArmAngle = -0.2 + punchPhase * Math.PI;
        setArmPose(pose.leftArm, leftArmAngle, 0.2, 0);
        
        // Left forearm: slight bend for balance
        pose.leftArm.knee.rotation.x = punchPhase * 1.0;
        
        // Legs: bend knees during jump, extend on landing
        const kneeBend = punchPhase > 0.5 ? (1 - punchPhase) * 1.3 : punchPhase * 1.3;
        setLegPose(pose.leftLeg, -kneeBend, 0.8 * punchPhase, -0.3 * punchPhase);
        setLegPose(pose.rightLeg, -kneeBend, 0.6 * punchPhase, 0.3 * punchPhase);
        
        updatePlayerNameTagFlash(pose, elapsedTime, punchPhase);
        return;
    }
    
    // Diving save animation: goalkeeper leaps sideways with both arms extended
    if (diving) {
        const dive = THREE.MathUtils.clamp(diveProgress, 0, 1);
        const divePhase = Math.sin(dive * Math.PI);
        
        // Body leans and rotates towards dive direction (sideways tilt)
        pose.visualRoot.position.y = FIELD_SURFACE_Y + CHARACTER_FOOT_CLEARANCE + 0.08 * divePhase;
        pose.visualRoot.rotation.z = 1.1 * divePhase;  // Stronger body tilt
        pose.visualRoot.rotation.x = -0.45 * divePhase;
        
        pose.body.position.y = bodyY - 0.05 + 0.1 * divePhase;
        pose.body.rotation.set(-0.3 * divePhase, 0, 0.8 * divePhase);  // More pronounced lean
        
        // Head tilts same as body (inherits body rotation fully)
        pose.head.position.y = headY - 0.02 + 0.08 * divePhase;
        pose.head.rotation.set(-0.3 * divePhase, 0, 0.8 * divePhase);  // Same tilt as body
        
        // Both arms stretched out wide and UP to block the ball (hands raised)
        setArmPose(pose.leftArm, 2.1 * divePhase, 0.35, 1.65 * divePhase);  // Higher arm position
        setArmPose(pose.rightArm, -2.1 * divePhase, 0.35, -1.65 * divePhase);  // Higher arm position
        
        // Legs kick back during dive, body drops to ground
        setLegPose(pose.leftLeg, -1.05 * divePhase, 1.25 * divePhase, -0.45 * divePhase);
        setLegPose(pose.rightLeg, -1.05 * divePhase, 1.25 * divePhase, 0.45 * divePhase);
        
        updatePlayerNameTagFlash(pose, elapsedTime, divePhase);
        return;
    }
    const phase = elapsedTime * (7.8 + runAmount * 4.2) * sprintFactor + pose.phase;
    const stride = Math.sin(phase) * runAmount * sprintFactor;
    const counterStride = Math.sin(phase + Math.PI) * runAmount * sprintFactor;
    const lift = Math.abs(Math.sin(phase)) * runAmount * sprintFactor;
    const sideBob = Math.sin(phase * 2) * runAmount;
    
    // Sprint: more knee bend (屈膝), more arm bend (屈臂), more vertical bobbing (上下颠簸)
    const kneeBendMultiplier = isSprinting ? 1.45 : (isDribbling ? 1.28 : 1.0);
    const armBendMultiplier = isSprinting ? 1.35 : (isDribbling ? 1.18 : 1.0);
    const verticalBobMultiplier = isSprinting ? 1.65 : (isDribbling ? 1.25 : 1.0);

    pose.body.position.y = bodyY + lift * 0.035 * verticalBobMultiplier;
    pose.body.rotation.set(-0.08 * runAmount * sprintFactor, 0, sideBob * 0.035);
    updatePlayerNameTagFlash(pose, elapsedTime, lift);
    pose.head.position.y = headY + lift * 0.035 * verticalBobMultiplier;
    pose.head.rotation.set(0, 0, -sideBob * 0.025);

    setArmPose(pose.leftArm, -0.46 * counterStride - 0.08, (0.34 + 0.22 * Math.max(counterStride, 0)) * armBendMultiplier, 0.08);
    setArmPose(pose.rightArm, -0.46 * stride - 0.08, (0.34 + 0.22 * Math.max(stride, 0)) * armBendMultiplier, -0.08);
    setLegPose(pose.leftLeg, 0.66 * stride, (0.72 * Math.max(-stride, 0) + 0.16 * runAmount) * kneeBendMultiplier, -0.05);
    setLegPose(pose.rightLeg, 0.66 * counterStride, (0.72 * Math.max(-counterStride, 0) + 0.16 * runAmount) * kneeBendMultiplier, 0.05);

    if (kicking) {
        const charge = THREE.MathUtils.clamp(kickPower, 0.2, 1);
        if (kickPhase === 'charge') {
            const progress = THREE.MathUtils.clamp(kickProgress, 0, 1);
            const swing = Math.sin(progress * Math.PI * 0.5);
            const landing = Math.sin(progress * Math.PI);
            pose.visualRoot.position.y += landing * 0.18;
            pose.body.position.y = bodyY - 0.04 + landing * 0.08;
            pose.body.rotation.x = THREE.MathUtils.lerp(0.18, -0.16, swing);
            pose.head.position.y = headY - 0.04 + landing * 0.08;
            setLegPose(pose.leftLeg, -0.18, 0.46 * (1 - swing), -0.08);
            setLegPose(pose.rightLeg, THREE.MathUtils.lerp(-1.18, 0.92, swing), THREE.MathUtils.lerp(1.12, 0.28, swing), 0.04);
        } else {
            pose.visualRoot.position.y -= 0.07 * charge;
            pose.body.position.y = bodyY - 0.04 - 0.04 * charge;
            pose.body.rotation.x = 0.14 * charge;
            pose.head.position.y = headY - 0.05 - 0.03 * charge;
            setLegPose(pose.leftLeg, -0.12, 0.54 + charge * 0.22, -0.08);
            setLegPose(pose.rightLeg, -0.76 - charge * 0.52, 0.9 + charge * 0.28, 0.04);
        }
        setArmPose(pose.leftArm, 0.46, 0.4, 0.24);
        setArmPose(pose.rightArm, -0.58, 0.28, -0.24);
    }
}



function updatePlayerNameTagFlash(pose, elapsedTime, lift = 0) {
    const nameTag = pose.visualRoot.children.find((child) => child.isSprite && child.userData.baseScale);
    if (!nameTag) return;

    const flash = 0.62 + 0.38 * Math.sin(elapsedTime * 8.5);
    const pulse = 1 + 0.08 * Math.sin(elapsedTime * 8.5);
    nameTag.material.opacity = 0.72 + flash * 0.28;
    nameTag.scale.copy(nameTag.userData.baseScale).multiplyScalar(pulse);
    nameTag.position.y = 2.1 + lift * 0.035;
}

function collectHitFlashMaterials(root) {
    const materials = new Set();
    root.traverse((child) => {
        if (!child.isMesh) return;
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        childMaterials.forEach((material) => {
            if (material?.isMeshStandardMaterial && material.emissive) {
                material.userData.originalEmissive = material.emissive.clone();
                material.userData.originalEmissiveIntensity = material.emissiveIntensity ?? 0;
                materials.add(material);
            }
        });
    });
    return Array.from(materials);
}

function applyHitFlash(character, pose, elapsedTime) {
    const flash = elapsedTime < (character.userData.hitFlashUntil || 0);
    pose.hitMaterials.forEach((material) => {
        if (flash) {
            material.emissive.set(0xff7777);
            material.emissiveIntensity = 0.75;
        } else if (material.userData.originalEmissive) {
            material.emissive.copy(material.userData.originalEmissive);
            material.emissiveIntensity = material.userData.originalEmissiveIntensity;
        }
    });
}

export function flashCharacterHit(character, elapsedTime, duration = 0.18) {
    character.userData.hitFlashUntil = Math.max(character.userData.hitFlashUntil || 0, elapsedTime + duration);
}

function setArmPose(limb, shoulderSwing, elbowBend, sideSplay) {
    limb.hip.rotation.set(shoulderSwing, 0, sideSplay);
    limb.knee.rotation.set(-elbowBend, 0, 0);
}

function setLegPose(limb, hipSwing, kneeBend, sideSplay) {
    limb.hip.rotation.set(hipSwing, 0, sideSplay);
    limb.knee.rotation.set(kneeBend, 0, 0);
}

export function createBall(materials) {
    const group = new THREE.Group();
    const fallback = new THREE.Group();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 18), materials.ball);
    sphere.castShadow = true;
    const patchMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let i = 0; i < 6; i++) {
        const patch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 5), patchMaterial);
        patch.position.set(Math.cos(i) * 0.22, Math.sin(i * 1.7) * 0.14, Math.sin(i) * 0.22);
        patch.lookAt(0, 0, 0);
        fallback.add(patch);
    }
    fallback.add(sphere);
    group.add(fallback);

    const loader = new GLTFLoader();
    loader.load(MODEL_ASSETS.soccerBall, (gltf) => {
        const model = gltf.scene;
        fitModelToBox(model, BALL_RADIUS * 2, new THREE.Vector3(0, 0, 0));
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        fallback.visible = false;
        group.add(model);
    });
    return group;
}

export function createAimArrow() {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 1.35), new THREE.MeshBasicMaterial({ color: 0xfff06a }));
    shaft.position.z = 0.58;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.52, 4), new THREE.MeshBasicMaterial({ color: 0xfff06a }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.36;
    group.add(shaft, tip);
    group.visible = false;
    
    // 添加一个内部组用于控制箭头的垂直翘起（pitch rotation）
    const arrowInner = new THREE.Group();
    arrowInner.add(shaft, tip);
    group.add(arrowInner);
    group.userData.arrowInner = arrowInner;
    
    return group;
}

// 创建脚下的环形进度条（用于显示冲刺状态和体力恢复）
export function createFootRingBar() {
    const group = new THREE.Group();
    
    const innerRadius = 0.55;
    const outerRadius = 0.72;
    const tube = outerRadius - innerRadius;
    const torusRadius = (innerRadius + outerRadius) / 2;
    const torusTube = tube / 2;
    
    // 创建背景环（半透明深灰色）
    const bgTorus = new THREE.Mesh(
        new THREE.TorusGeometry(torusRadius, torusTube, 8, 64),
        new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        })
    );
    bgTorus.rotation.x = Math.PI / 2;
    bgTorus.position.y = 0.08;
    group.add(bgTorus);
    
    // 创建蓝紫色渐变的冲刺环形进度条（使用 ShaderMaterial 实现平滑渐变和动态填充）
    const sprintMaterial = new THREE.ShaderMaterial({
        uniforms: {
            progress: { value: 0.0 },
            innerRadius: { value: torusRadius - torusTube },
            outerRadius: { value: torusRadius + torusTube },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float progress;
            uniform float innerRadius;
            uniform float outerRadius;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                float radius = length(vPosition.xy);
                if (radius < innerRadius || radius > outerRadius) discard;
                
                float angle = atan(vPosition.y, vPosition.x);
                if (angle < 0.0) angle += 2.0 * 3.14159265;
                
                // 从 -PI/2 开始（底部），顺时针填充
                float startAngle = 1.5 * 3.14159265;
                float angleProgress = (angle - startAngle) / (2.0 * 3.14159265);
                if (angleProgress < 0.0) angleProgress += 1.0;
                
                if (angleProgress > progress) discard;
                
                // 计算相对于环中心的归一化坐标
                float normalizedRadius = (radius - innerRadius) / (outerRadius - innerRadius);
                
                // 蓝紫色渐变：内圈偏蓝，外圈偏紫
                vec3 blueColor = vec3(0.31, 0.67, 1.0);
                vec3 purpleColor = vec3(0.63, 0.33, 1.0);
                vec3 gradientColor = mix(blueColor, purpleColor, normalizedRadius);
                
                gl_FragColor = vec4(gradientColor, 0.95);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
    });
    
    const sprintTorus = new THREE.Mesh(
        new THREE.TorusGeometry(torusRadius, torusTube, 16, 128),
        sprintMaterial
    );
    sprintTorus.rotation.x = Math.PI / 2;
    sprintTorus.position.y = 0.08;
    sprintTorus.renderOrder = 3;
    group.add(sprintTorus);
    group.userData.sprintMesh = sprintTorus;
    group.userData.sprintMaterial = sprintMaterial;
    
    // 创建射门力量条（橙红渐变，1/4 圆环，半径更大）
    const powerInnerRadius = 0.82;
    const powerOuterRadius = 1.02;
    const powerTube = powerOuterRadius - powerInnerRadius;
    const powerTorusRadius = (powerInnerRadius + powerOuterRadius) / 2;
    const powerTorusTube = powerTube / 2;
    
    // 背景（1/4 圆）
    const powerBgShape = new THREE.Shape();
    powerBgShape.absarc(0, 0, powerTorusRadius, -Math.PI / 2, 0, false);
    powerBgShape.absarc(0, 0, powerTorusRadius - powerTorusTube, 0, -Math.PI / 2, true);
    const powerBg = new THREE.Mesh(
        new THREE.ShapeGeometry(powerBgShape),
        new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        })
    );
    powerBg.rotation.x = Math.PI / 2;
    powerBg.position.y = 0.08;
    group.add(powerBg);
    
    // 射门力量条（使用 ShaderMaterial 实现橙红渐变）
    const powerMaterial = new THREE.ShaderMaterial({
        uniforms: {
            progress: { value: 0.0 },
            innerRadius: { value: powerTorusRadius - powerTorusTube },
            outerRadius: { value: powerTorusRadius + powerTorusTube },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float progress;
            uniform float innerRadius;
            uniform float outerRadius;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                float radius = length(vPosition.xy);
                if (radius < innerRadius || radius > outerRadius) discard;
                
                float angle = atan(vPosition.y, vPosition.x);
                if (angle < 0.0) angle += 2.0 * 3.14159265;
                
                // 1/4 圆环：从 -PI/2 到 0（右下象限）
                float startAngle = 1.5 * 3.14159265;
                float endAngle = 2.0 * 3.14159265;
                float angleRange = endAngle - startAngle;
                float angleProgress = (angle - startAngle) / angleRange;
                
                if (angleProgress > progress) discard;
                
                // 计算相对于环中心的归一化坐标
                float normalizedRadius = (radius - innerRadius) / (outerRadius - innerRadius);
                
                // 橙红渐变：内圈橙色，外圈红色
                vec3 orangeColor = vec3(1.0, 0.65, 0.0);
                vec3 redColor = vec3(1.0, 0.0, 0.0);
                vec3 gradientColor = mix(orangeColor, redColor, normalizedRadius);
                
                gl_FragColor = vec4(gradientColor, 0.92);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
    });
    
    // 创建 1/4 圆环几何体
    const powerShape = new THREE.Shape();
    powerShape.absarc(0, 0, powerTorusRadius, -Math.PI / 2, 0, false);
    powerShape.absarc(0, 0, powerTorusRadius - powerTorusTube, 0, -Math.PI / 2, true);
    const powerMesh = new THREE.Mesh(
        new THREE.ShapeGeometry(powerShape),
        powerMaterial
    );
    powerMesh.rotation.x = Math.PI / 2;
    powerMesh.position.y = 0.08;
    powerMesh.renderOrder = 3;
    group.add(powerMesh);
    group.userData.powerMesh = powerMesh;
    group.userData.powerMaterial = powerMaterial;
    
    // 创建秒表文本（用于体力恢复倒计时）
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const timerTexture = new THREE.CanvasTexture(canvas);
    
    const timerMaterial = new THREE.SpriteMaterial({
        map: timerTexture,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
    });
    const timerSprite = new THREE.Sprite(timerMaterial);
    timerSprite.scale.set(0.5, 0.5, 1);
    timerSprite.position.y = 0.16;
    group.add(timerSprite);
    group.userData.timerSprite = timerSprite;
    group.userData.timerCanvas = canvas;
    group.userData.timerCtx = ctx;
    group.userData.timerTexture = timerTexture;
    
    group.visible = false;
    return group;
}

// 更新脚下环形进度条（冲刺状态和射门力量）
export function updateFootRingBar({ state, player, footRingBar, elapsedTime }) {
    const isSprinting = state.isSprinting;
    const isChargingKick = state.isChargingKick;
    
    // 计算冲刺可持续时间比例（5 秒总时长）
    const sprintDuration = 5.0;
    const sprintRemaining = isSprinting 
        ? Math.max(0, sprintDuration - (elapsedTime - state.sprintStartTime))
        : 0;
    const sprintProgress = sprintRemaining / sprintDuration;
    
    // 计算体力恢复倒计时（2 秒冷却）
    const cooldownRemaining = Math.max(0, state.sprintCooldownUntil - elapsedTime);
    const cooldownProgress = cooldownRemaining / 2.0;
    
    // 更新冲刺进度条（蓝紫色渐变圆环，使用 ShaderMaterial）
    const sprintMaterial = footRingBar.userData.sprintMaterial;
    if (sprintMaterial && sprintMaterial.uniforms) {
        if (isSprinting) {
            sprintMaterial.uniforms.progress.value = THREE.MathUtils.clamp(sprintProgress, 0, 1);
        } else {
            sprintMaterial.uniforms.progress.value = 0;
        }
    }
    
    // 更新射门力量条（橙红渐变 1/4 圆环，使用 ShaderMaterial）
    const powerMaterial = footRingBar.userData.powerMaterial;
    if (powerMaterial && powerMaterial.uniforms) {
        if (isChargingKick) {
            powerMaterial.uniforms.progress.value = THREE.MathUtils.clamp(state.chargePower, 0, 1);
        } else {
            powerMaterial.uniforms.progress.value = 0;
        }
    }
    
    // 更新秒表倒计时显示
    const timerSprite = footRingBar.userData.timerSprite;
    const timerCanvas = footRingBar.userData.timerCanvas;
    const timerCtx = footRingBar.userData.timerCtx;
    const timerTexture = footRingBar.userData.timerTexture;
    
    if (timerSprite && timerCanvas && timerCtx && timerTexture) {
        if (cooldownRemaining > 0.01) {
            timerSprite.material.opacity = 1.0;
            timerCtx.clearRect(0, 0, timerCanvas.width, timerCanvas.height);
            timerCtx.fillStyle = '#ffffff';
            timerCtx.font = 'bold 72px Arial, sans-serif';
            timerCtx.textAlign = 'center';
            timerCtx.textBaseline = 'middle';
            timerCtx.strokeStyle = '#000000';
            timerCtx.lineWidth = 8;
            const displayTime = cooldownRemaining.toFixed(1);
            timerCtx.strokeText(displayTime, 64, 64);
            timerCtx.fillText(displayTime, 64, 64);
            timerTexture.needsUpdate = true;
        } else {
            timerSprite.material.opacity = 0;
        }
    }
    
    // 设置可见性和位置
    if ((isSprinting || isChargingKick || cooldownRemaining > 0.01) && !state.gameOver) {
        footRingBar.visible = true;
        footRingBar.position.copy(player.position);
        footRingBar.position.y = 0.08;
        footRingBar.rotation.y = player.rotation.y;
    } else {
        footRingBar.visible = false;
    }
}

export function createRefereeVisionFan(materials) {
    const radius = 7.5;
    const halfAngle = THREE.MathUtils.degToRad(55);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= 32; i++) {
        const angle = -halfAngle + (halfAngle * 2 * i) / 32;
        shape.lineTo(Math.sin(angle) * radius, Math.cos(angle) * radius);
    }
    shape.lineTo(0, 0);

    const fan = new THREE.Mesh(new THREE.ShapeGeometry(shape), materials.refereeVision);
    fan.rotation.x = Math.PI / 2;
    fan.position.y = FIELD_SURFACE_Y + 0.14;
    fan.renderOrder = 2;
    fan.userData.radius = radius;
    fan.userData.halfAngle = halfAngle;
    return fan;
}

export function initPortraitModel(portraitRoot) {
    const portraitScene = new THREE.Scene();
    const portraitCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    portraitCamera.position.set(0, 0.55, 4.2);

    const portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    portraitRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    portraitRoot.appendChild(portraitRenderer.domElement);

    portraitScene.add(new THREE.AmbientLight(0xffffff, 1.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(2.5, 4, 3);
    portraitScene.add(keyLight);
    const rimLight = new THREE.PointLight(0x66f7c7, 6, 6);
    rimLight.position.set(-2, 1.6, 2.2);
    portraitScene.add(rimLight);

    const portraitState = { scene: portraitScene, camera: portraitCamera, renderer: portraitRenderer, model: null };
    const loader = new GLTFLoader();
    loader.load(MODEL_ASSETS.portraitModel, (gltf) => {
        portraitState.model = gltf.scene;
        fitModelToBox(portraitState.model, 2.65, new THREE.Vector3(0, -0.2, 0));
        portraitState.model.rotation.set(0.08, -0.35, 0);
        portraitState.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        portraitScene.add(portraitState.model);
        resizePortrait(portraitRoot, portraitState);
    });
    return portraitState;
}

export function updatePortraitModel(portrait, dt) {
    if (!portrait.model) return;
    portrait.model.rotation.y += dt * 0.42;
    portrait.renderer.render(portrait.scene, portrait.camera);
}

export function resizePortrait(portraitRoot, portrait) {
    const bounds = portraitRoot.getBoundingClientRect();
    const size = Math.max(1, Math.floor(Math.min(bounds.width, bounds.height)));
    portrait.renderer.setSize(size, size, false);
    portrait.camera.aspect = 1;
    portrait.camera.updateProjectionMatrix();
}


function fitModelToBox(model, targetSize, targetCenter = new THREE.Vector3()) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / maxDimension;
    model.scale.setScalar(scale);
    model.position.set(
        targetCenter.x - center.x * scale,
        targetCenter.y - center.y * scale,
        targetCenter.z - center.z * scale
    );
}
