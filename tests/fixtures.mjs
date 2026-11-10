import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter, createMaterials} from '../scripts/game/assets.js';
GLTFLoader.prototype.load = () => {};
const noop = () => {};
globalThis.document = {createElement: () => ({width:0,height:0,getContext:()=>new Proxy({}, {get:(_,key)=>key==='measureText'?()=>({width:100}):noop,set:()=>true})})};
globalThis.window = {setTimeout:noop,clearTimeout:noop};
export function character(type = 'keeper') {
    const materials = createMaterials();
    return createCharacter(materials, type === 'player' ? materials.player : materials.keeper, type);
}
export {THREE};
