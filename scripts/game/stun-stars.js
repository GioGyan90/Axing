import * as THREE from 'three';
import {isKnockedDown} from './knockdown.js';
const shape=new THREE.Shape();
for(let i=0;i<10;i++){const angle=Math.PI/2+i*Math.PI/5,r=i%2?0.055:0.13;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
const geometry=new THREE.ShapeGeometry(shape),material=new THREE.MeshBasicMaterial({color:0xffdb62,side:THREE.DoubleSide});
const point=new THREE.Vector3(),rotation=new THREE.Quaternion();
export function updateStunStars(character,time,status,camera){
    let stars=character.userData.stunStars;
    const visible=isKnockedDown(status,time);
    if(!visible){if(stars)stars.visible=false;return;}
    if(!stars){stars=new THREE.Group();for(let i=0;i<3;i++)stars.add(new THREE.Mesh(geometry,material));character.add(stars);character.userData.stunStars=stars;}
    stars.visible=true;character.updateMatrixWorld(true);character.userData.pose.head.getWorldPosition(point);character.worldToLocal(point);stars.position.copy(point);stars.position.y+=0.34;
    if(camera)stars.quaternion.copy(character.getWorldQuaternion(rotation).invert()).multiply(camera.quaternion);
    stars.children.forEach((star,i)=>{const a=time*4+i*Math.PI*2/3;star.position.set(Math.cos(a)*0.34,Math.sin(a)*0.10,0);star.rotation.z=Math.sin(time*3+i)*0.25;});
}
