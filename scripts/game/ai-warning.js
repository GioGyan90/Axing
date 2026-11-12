import * as THREE from 'three';
let material;
const position=new THREE.Vector3();
export function updateAIWarning(character,visible){
    let marker=character.userData.aiWarning;
    if(!visible){if(marker)marker.visible=false;return;}
    if(!marker){
        if(!material){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#d95642';ctx.beginPath();ctx.ellipse(32,48,29,43,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff8df';ctx.font='bold 76px system-ui';ctx.textAlign='center';ctx.fillText('!',32,75);material=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false});}
        marker=new THREE.Sprite(material);marker.scale.set(0.4,0.6,1);marker.renderOrder=20;character.add(marker);character.userData.aiWarning=marker;
    }
    marker.visible=true;character.updateMatrixWorld(true);character.userData.pose.head.getWorldPosition(position);character.worldToLocal(position);marker.position.copy(position);marker.position.y+=0.46;
}
