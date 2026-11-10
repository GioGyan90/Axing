import * as THREE from 'three';

// Same rest lengths as assets.js. Downward arms are calibrated by Prompt2Rig,
// rather than applying its T-pose angles directly to the game's rigid limbs.
export function createFootballRig() {
    const root = new THREE.Group();
    const bones = {};
    const add = (name, parent, x, y, z = 0) => {
        const bone = new THREE.Bone();
        bone.name = `mixamorig${name}`;
        bone.position.set(x, y, z);
        (parent || root).add(bone);
        bones[name] = bone;
        return bone;
    };
    const hips = add('Hips', null, 0, 0.42);
    const spine = add('Spine', hips, 0, 0.36);
    const chest = add('Spine2', add('Spine1', spine, 0, 0), 0, 0);
    const neck = add('Neck', chest, 0, 0.42);
    add('Head', neck, 0, 0.1);
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const shoulder = add(`${side}Shoulder`, chest, sign * 0.46, 0.2);
        const arm = add(`${side}Arm`, shoulder, 0, 0);
        const elbow = add(`${side}ForeArm`, arm, 0, -0.29);
        const hand = add(`${side}Hand`, elbow, 0, -0.3);
        add(`${side}HandMiddle1`, hand, 0, -0.07);
        const thigh = add(`${side}UpLeg`, hips, sign * 0.19, 0);
        const knee = add(`${side}Leg`, thigh, 0, -0.43);
        const foot = add(`${side}Foot`, knee, 0, -0.41);
        add(`${side}ToeBase`, foot, 0, -0.055, 0.17);
        // A measured shoe proxy supplies the tool's floor reference at bake time.
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.34));
        sole.position.z = 0.068;
        sole.visible = false;
        foot.add(sole);
    }
    root.updateMatrixWorld(true);
    return { root, bones };
}
