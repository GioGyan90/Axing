// Chat-authored motion-plan v1, consumed by the actual 3D_AItool compiler.
const rotations = values => Object.entries(values).map(([joint, degrees]) => ({joint, degrees}));
const frame = (t, values, root = [0, 0, 0]) => ({t, root, rotations: rotations(values)});
const ready = {
    Hips: [0, 0, 0], Spine: [6, 0, 0], Head: [-5, 0, 0],
    LeftArm: [0, -20, -65], RightArm: [0, 20, 65],
    LeftForeArm: [0, 0, -35], RightForeArm: [0, 0, 35],
    LeftUpLeg: [-10, 0, 6], RightUpLeg: [-10, 0, -6],
    LeftLeg: [20, 0, 0], RightLeg: [20, 0, 0],
    LeftFoot: [-10, 0, 0], RightFoot: [-10, 0, 0],
};
const kickReady = {...ready, Spine: [3, 0, 0], LeftUpLeg: [-3, 0, 0], RightUpLeg: [-3, 0, 0], LeftLeg: [6, 0, 0], RightLeg: [6, 0, 0]};
const windup = {...kickReady, Hips: [0, -13, -5], Spine: [-8, 20, 0], Head: [8, -7, 0], RightUpLeg: [32, 0, -5], RightLeg: [82, 0, 0], RightFoot: [12, 0, 0], LeftUpLeg: [-8, 0, 3], LeftLeg: [16, 0, 0], LeftArm: [0, -35, -48], RightArm: [0, -24, 58]};
const impact = {...kickReady, Hips: [0, 6, 2], Spine: [12, -10, 0], Head: [-10, 3, 0], RightUpLeg: [-48, 0, -3], RightLeg: [30, 0, 0], RightFoot: [8, 0, 0], LeftUpLeg: [-8, 0, 1], LeftLeg: [16, 0, 0], LeftArm: [0, 15, -48], RightArm: [0, 35, 68]};
const follow = {...impact, Hips: [3, 14, 4], Spine: [17, -20, 0], RightUpLeg: [-73, 0, -4], RightLeg: [24, 0, 0], RightFoot: [4, 0, 0], LeftArm: [0, 25, -56], RightArm: [0, 38, 53]};
const kick = {version: 1, name: '右脚正脚背射门', duration: 1.3, loop: false, hands: {left: 'looseFist', right: 'looseFist'}, frames: [
    frame(0, kickReady), frame(0.15, {...kickReady, RightUpLeg: [12, 0, -3], RightLeg: [35, 0, 0]}),
    frame(0.3, windup), frame(0.42, {...windup, RightUpLeg: [0, 0, -4], RightLeg: [65, 0, 0], Spine: [3, 5, 0]}),
    frame(0.52, impact), frame(0.64, follow), frame(0.82, {...follow, RightUpLeg: [-38, 0, -2], RightLeg: [45, 0, 0]}),
    frame(1.05, {...kickReady, RightUpLeg: [8, 0, -1], RightLeg: [28, 0, 0]}), frame(1.3, kickReady),
]};
const crouch = {...ready, Hips: [0, 0, -7], Spine: [14, 0, 4], LeftUpLeg: [-30, 0, 10], RightUpLeg: [-34, 0, -10], LeftLeg: [58, 0, 0], RightLeg: [64, 0, 0], LeftFoot: [-28, 0, 0], RightFoot: [-30, 0, 0]};
const reach = {...ready, Hips: [0, 0, -76], Spine: [0, 0, -3], Head: [0, 0, 4], LeftArm: [0, -6, 52], RightArm: [0, 6, -116], LeftForeArm: [0, 0, 10], RightForeArm: [0, 0, -8], LeftUpLeg: [4, 0, 6], RightUpLeg: [17, 0, -9], LeftLeg: [20, 0, 0], RightLeg: [55, 0, 0], LeftFoot: [-10, 0, 0], RightFoot: [-18, 0, 0]};
const landed = {...reach, Hips: [8, 0, -84], Spine: [5, 0, 3], LeftArm: [0, -8, 68], RightArm: [0, 12, -110], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, -12], LeftLeg: [50, 0, 0], RightLeg: [80, 0, 0]};
const dive = {version: 1, name: '左侧蹬地横扑与起身', duration: 1.6, loop: false, hands: {left: 'open', right: 'open'}, frames: [
    frame(0, ready), frame(0.13, crouch, [0, -0.09, 0]),
    frame(0.25, {...crouch, Hips: [0, 0, -28], LeftUpLeg: [-5, 0, 5], RightUpLeg: [5, 0, -8], LeftLeg: [15, 0, 0], RightLeg: [28, 0, 0], LeftArm: [0, -12, 15], RightArm: [0, 10, -70]}),
    frame(0.43, {...reach, Hips: [0, 0, -62]}), frame(0.57, reach),
    frame(0.72, {...reach, Hips: [4, 0, -83], LeftLeg: [38, 0, 0], RightLeg: [68, 0, 0]}),
    frame(0.9, landed), frame(1.08, {...landed, Hips: [12, 0, -55], LeftUpLeg: [-35, 0, 6], RightUpLeg: [-25, 0, -8], LeftLeg: [85, 0, 0], RightLeg: [100, 0, 0]}),
    frame(1.3, {...crouch, Hips: [0, 0, -18], LeftArm: [0, -30, -45], RightArm: [0, 20, 50]}), frame(1.6, ready),
]};
function mirror(plan) {
    return {...plan, name: '右侧蹬地横扑与起身', frames: plan.frames.map(f => ({...f, root: [-f.root[0], f.root[1], f.root[2]], rotations: f.rotations.map(r => ({joint: r.joint.replace(/^(Left|Right)/, s => s === 'Left' ? 'Right' : 'Left'), degrees: [r.degrees[0], -r.degrees[1], -r.degrees[2]]}))}))};
}
const punchTop = {...ready, Hips: [-5, 0, 0], Spine: [-6, 0, 0], Head: [-14, 0, 0], LeftArm: [0, -5, 100], RightArm: [0, 5, -100], LeftForeArm: [0, 0, 8], RightForeArm: [0, 0, -8], LeftUpLeg: [5, 0, 4], RightUpLeg: [10, 0, -4], LeftLeg: [16, 0, 0], RightLeg: [25, 0, 0]};
const punch = {version: 1, name: '高球双拳解围与落地', duration: 1.25, loop: false, hands: {left: 'fist', right: 'fist'}, frames: [
    frame(0, ready), frame(0.14, {...crouch, Hips: [0, 0, 0]}, [0, -0.08, 0]),
    frame(0.28, {...punchTop, LeftArm: [0, -8, 65], RightArm: [0, 8, -65], LeftLeg: [8, 0, 0], RightLeg: [12, 0, 0]}),
    frame(0.45, punchTop), frame(0.58, {...punchTop, Spine: [3, 0, 0], LeftArm: [0, -15, 88], RightArm: [0, 15, -88]}),
    frame(0.76, {...ready, LeftUpLeg: [-23, 0, 6], RightUpLeg: [-23, 0, -6], LeftLeg: [46, 0, 0], RightLeg: [46, 0, 0]}), frame(1, ready), frame(1.25, ready),
]};
const scoopPose = {...ready, Hips: [25, 0, 0], Spine: [8, 0, 0], Head: [-25, 0, 0],
    LeftUpLeg: [-60, 0, 10], RightUpLeg: [-60, 0, -10], LeftLeg: [112, 0, 0], RightLeg: [112, 0, 0],
    LeftFoot: [-52, 0, 0], RightFoot: [-52, 0, 0], LeftArm: [0, -35, -70], RightArm: [0, 35, 70], LeftForeArm: [0, 0, -12], RightForeArm: [0, 0, 12]};
const scoop = {version: 1, name: '中路低球下蹲封堵', duration: 1.2, loop: false, hands: {left: 'open', right: 'open'}, frames: [
    frame(0, ready), frame(0.15, {...crouch, Hips: [8, 0, 0]}),
    frame(0.32, {...scoopPose, LeftUpLeg: [-45, 0, 10], RightUpLeg: [-45, 0, -10], LeftLeg: [85, 0, 0], RightLeg: [85, 0, 0]}),
    frame(0.45, scoopPose), frame(0.62, {...scoopPose, Spine: [3, 0, 0]}),
    frame(0.82, {...crouch, Hips: [8, 0, 0]}), frame(1.05, ready), frame(1.2, ready),
]};
export const FOOTBALL_PLANS = {kick, diveLeft: dive, diveRight: mirror(dive), punch, scoop};
export const MOTION_TIMING = {
    kick: {windup: 0.3, contact: 0.52, follow: 0.64, duration: 1.3},
    diveLeft: {contact: 0.57, land: 0.9, duration: 1.6},
    diveRight: {contact: 0.57, land: 0.9, duration: 1.6},
    punch: {contact: 0.45, land: 0.76, duration: 1.25},
    scoop: {contact: 0.45, land: 0.65, duration: 1.2},
};
