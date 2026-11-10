import * as THREE from 'three';
import {REFEREE_VISION} from './config.js';

// Rendering and foul detection share the same reduced sector.
export function isInRefereeVision(target, referee) {
    const offset = target.clone().sub(referee.position).setY(0);
    const distance = offset.length();
    if (distance > REFEREE_VISION.radius || distance < 0.001) return false;
    const forward = new THREE.Vector3(Math.sin(referee.rotation.y), 0, Math.cos(referee.rotation.y));
    return forward.dot(offset.divideScalar(distance)) >= Math.cos(REFEREE_VISION.halfAngle) - 1e-9;
}
