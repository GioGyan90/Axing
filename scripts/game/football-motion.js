import * as THREE from 'three';
import {FIELD_SURFACE_Y} from './config.js';
import {createFootballRig} from './football-rig.js';
import {FOOTBALL_CLIPS, MOTION_TIMING} from './motions/football-clips.js';
export {MOTION_TIMING};

const clips = Object.fromEntries(Object.entries(FOOTBALL_CLIPS).map(([id, json]) => [id, THREE.AnimationClip.parse(json)]));
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const bounds = new THREE.Box3();
const worldBounds = new THREE.Box3();

export function resetFootballPose(pose) {
    pose.visualRoot.rotation.set(0, 0, 0);
    pose.visualRoot.position.set(0, FIELD_SURFACE_Y + 0.325, 0);
    pose.pelvis.position.set(0, 0.42 * pose.bodyScale, 0);
    pose.pelvis.rotation.set(0, 0, 0);
    pose.body.position.set(0, pose.bodyBaseY, 0);
    pose.body.rotation.set(0, 0, 0);
    pose.head.position.set(0, pose.headBaseY, 0);
    pose.head.rotation.set(0, 0, 0);
    for (const limb of [pose.leftArm, pose.rightArm, pose.leftLeg, pose.rightLeg]) {
        limb.hip.position.copy(limb.restHipPosition);
        limb.hip.rotation.set(0, 0, 0);
        limb.knee.rotation.set(0, 0, 0);
        limb.endJoint.rotation.set(0, 0, 0);
    }
}

function motionState(pose) {
    if (pose.footballMotion) return pose.footballMotion;
    const rig = createFootballRig();
    rig.root.scale.setScalar(pose.bodyScale);
    const mixer = new THREE.AnimationMixer(rig.root);
    const actions = Object.fromEntries(Object.entries(clips).map(([id, clip]) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        return [id, action];
    }));
    pose.footballMotion = {...rig, mixer, actions, selected: null};
    return pose.footballMotion;
}

export function applyFootballMotion(pose, id, time, {lift = 0, plant = false} = {}) {
    const state = motionState(pose);
    if (state.selected !== id) {
        state.mixer.stopAllAction();
        state.actions[id].reset().play();
        state.selected = id;
    }
    const action = state.actions[id];
    action.enabled = true;
    action.paused = true;
    action.time = THREE.MathUtils.clamp(time, 0, clips[id].duration);
    state.mixer.update(0);
    state.root.updateMatrixWorld(true);
    const place = (object, name) => {
        state.bones[name].getWorldPosition(position);
        state.bones[name].getWorldQuaternion(quaternion);
        object.position.copy(position);
        object.quaternion.copy(quaternion);
    };
    place(pose.pelvis, 'Hips');
    place(pose.body, 'Spine2');
    place(pose.head, 'Head');
    for (const [side, label] of [['Left', 'left'], ['Right', 'right']]) {
        for (const [part, upper, lower, end] of [['Arm', 'Arm', 'ForeArm', 'Hand'], ['Leg', 'UpLeg', 'Leg', 'Foot']]) {
            const limb = pose[label + part];
            place(limb.hip, side + upper);
            limb.knee.quaternion.copy(state.bones[side + lower].quaternion);
            limb.endJoint.quaternion.copy(state.bones[side + end].quaternion);
        }
    }
    if (plant) {
        pose.visualRoot.updateWorldMatrix(true, true);
        pose.leftLeg.end.getWorldPosition(position);
        pose.visualRoot.worldToLocal(position);
        pose.visualRoot.position.x += 0.19 * pose.bodyScale - position.x;
        pose.visualRoot.position.z += 0.068 * pose.bodyScale - position.z;
    }
    groundCharacter(pose, lift);
}

// Test actual meshes, including asynchronously loaded large heads. A rotated
// head or torso must not sink through the pitch during a sideways landing.
export function groundCharacter(pose, lift = 0) {
    pose.visualRoot.updateWorldMatrix(true, true);
    bounds.makeEmpty();
    pose.visualRoot.traverse(mesh => {
        if (!mesh.isMesh || !mesh.geometry) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        worldBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        bounds.union(worldBounds);
    });
    if (Number.isFinite(bounds.min.y)) pose.visualRoot.position.y += FIELD_SURFACE_Y + 0.006 + lift - bounds.min.y;
    pose.visualRoot.updateWorldMatrix(true, true);
}

// A short contact correction is evaluated on the existing rigid leg. The
// authored windup/follow-through remains the baked Prompt2Rig motion.
export function aimKickFoot(pose, ballPosition, forward, weight) {
    if (!weight || !ballPosition) return;
    const limb = pose.rightLeg;
    const target = ballPosition.clone().addScaledVector(forward, -0.31);
    target.y -= 0.045;
    pose.visualRoot.worldToLocal(target);
    const hip = limb.hip.position;
    const delta = target.sub(hip);
    const a = 0.43 * pose.bodyScale, b = 0.41 * pose.bodyScale;
    const length = THREE.MathUtils.clamp(delta.length(), Math.abs(a - b) + 0.001, a + b - 0.001);
    const along = delta.normalize();
    const bend = new THREE.Vector3(0, 0, 1).addScaledVector(along, -along.z).normalize();
    const offset = (a * a + length * length - b * b) / (2 * length);
    const knee = along.clone().multiplyScalar(offset).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - offset * offset)));
    const ankle = along.clone().multiplyScalar(length);
    const down = new THREE.Vector3(0, -1, 0);
    const upperQ = new THREE.Quaternion().setFromUnitVectors(down, knee.clone().normalize());
    const lowerWorld = new THREE.Quaternion().setFromUnitVectors(down, ankle.sub(knee).normalize());
    const lowerQ = upperQ.clone().invert().multiply(lowerWorld);
    limb.hip.quaternion.slerp(upperQ, weight);
    limb.knee.quaternion.slerp(lowerQ, weight);
    limb.endJoint.quaternion.slerp(lowerWorld.clone().invert(), weight);
    groundCharacter(pose);
}

export function updatePoseEffects(character, elapsedTime, lift = 0) {
    const pose = character.userData.pose;
    for (const material of pose.hitMaterials) {
        if (elapsedTime < (character.userData.hitFlashUntil || 0)) material.emissive?.setRGB(0.5 + 0.5 * Math.sin(elapsedTime * 65), 0.2, 0.08);
        else if (material.userData.originalEmissive) material.emissive.copy(material.userData.originalEmissive);
    }
    const tag = pose.visualRoot.children.find(child => child.isSprite && child.userData.baseScale);
    if (tag) {
        tag.material.opacity = 0.82 + 0.18 * Math.sin(elapsedTime * 8.5);
        tag.scale.copy(tag.userData.baseScale).multiplyScalar(1 + lift * 0.04);
    }
}

export function aimKeeperHands(pose, worldTarget, weight) {
    if (!weight || !worldTarget) return;
    for (const [limb, sign] of [[pose.leftArm, 1], [pose.rightArm, -1]]) {
        const target = worldTarget.clone();
        pose.visualRoot.worldToLocal(target);
        target.x += sign * 0.055;
        const delta = target.sub(limb.hip.position);
        const a = 0.29 * pose.bodyScale, b = 0.3 * pose.bodyScale;
        const length = THREE.MathUtils.clamp(delta.length(), 0.025, a + b - 0.001);
        const along = delta.normalize();
        const hint = new THREE.Vector3(sign * 0.3, -0.6, 1);
        const bend = hint.addScaledVector(along, -hint.dot(along)).normalize();
        const offset = (a * a + length * length - b * b) / (2 * length);
        const elbow = along.clone().multiplyScalar(offset).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - offset * offset)));
        const down = new THREE.Vector3(0, -1, 0);
        const upper = new THREE.Quaternion().setFromUnitVectors(down, elbow.clone().normalize());
        const lowerWorld = new THREE.Quaternion().setFromUnitVectors(down, along.clone().multiplyScalar(length).sub(elbow).normalize());
        limb.hip.quaternion.slerp(upper, weight);
        limb.knee.quaternion.slerp(upper.clone().invert().multiply(lowerWorld), weight);
        limb.endJoint.quaternion.slerp(lowerWorld.clone().invert(), weight);
    }
    pose.visualRoot.updateWorldMatrix(true, true);
}
