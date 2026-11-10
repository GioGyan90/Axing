import {pathToFileURL} from 'node:url';
import path from 'node:path';
export async function resolve(specifier, context, nextResolve) {
    if (process.env.AXING_THREE_ROOT && specifier === 'three') return {url: pathToFileURL(path.resolve(process.env.AXING_THREE_ROOT, 'build/three.module.js')).href, shortCircuit: true};
    if (process.env.AXING_THREE_ROOT && specifier.startsWith('three/addons/')) return {url: pathToFileURL(path.resolve(process.env.AXING_THREE_ROOT, 'examples/jsm', specifier.slice('three/addons/'.length))).href, shortCircuit: true};
    if (specifier === 'three') return {url: pathToFileURL(path.resolve(process.env.PROMPT2RIG_ROOT || '../3D_AItool', 'experiments/prompt2rig/public/vendor/three.module.js')).href, shortCircuit: true};
    if (specifier.startsWith('three/addons/')) return {url: pathToFileURL(path.resolve(process.env.PROMPT2RIG_ROOT || '../3D_AItool', 'experiments/prompt2rig/public/vendor', specifier.slice('three/addons/'.length))).href, shortCircuit: true};
    return nextResolve(specifier, context);
}
