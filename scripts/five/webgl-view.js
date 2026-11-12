import * as THREE from 'three';
import {createCharacter,createMaterials,addLights,createRefereeVisionFan} from '../game/assets.js';
import {updatePlayerAnimation} from '../game/player-animation.js';
import {updateGoalkeeperAnimation} from '../game/goalkeeper-animation.js';
import {CAGE,VERTICES,choosePassTarget} from './engine.js';
import {isKnockedDown,getUpProgress} from '../game/knockdown.js';
import {updateStunStars} from '../game/stun-stars.js';
import {updateAIWarning} from '../game/ai-warning.js';
import {hasCombatWarning} from '../game/combat-ai.js';

export function createWebGLView(canvas,context){
    const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x102a3b);scene.fog=new THREE.Fog(0x102a3b,42,85);
    const camera=new THREE.OrthographicCamera(-20,20,13,-13,0.1,100);camera.position.set(0,26,26);camera.lookAt(0,0,0);
    addLights(scene);const court=new THREE.Group();scene.add(court);buildCage(court);
    const materials=createMaterials(),blue=new THREE.MeshStandardMaterial({color:0x3bb5ff,roughness:0.75}),orange=new THREE.MeshStandardMaterial({color:0xff963e,roughness:0.75});
    const goalie=[new THREE.MeshStandardMaterial({color:0xcbea72,roughness:0.7}),new THREE.MeshStandardMaterial({color:0xf575ac,roughness:0.7})];
    const players=[];
    for(let i=0;i<10;i++){
        const team=i<5?0:1,slot=i%5,model=createCharacter(materials,slot===0?goalie[team]:team===0?blue:orange,slot===0?'keeper':'player',
            {nameTag:false,headModel:false,number:slot+1,shortsColor:team===0?0x194b72:0x71372a});
        model.userData.pose.phase=i*0.63;scene.add(model);players.push(model);
    }
    const referee=createCharacter(materials,materials.referee,'referee',{headModel:false,nameTag:false});
    const vision=createRefereeVisionFan(materials);referee.add(vision);scene.add(referee);
    const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(CAGE.ballRadius,1),new THREE.MeshStandardMaterial({color:0xfff9e9,flatShading:true,roughness:0.6}));
    ball.castShadow=true;scene.add(ball);
    const mark=(color,r)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,0.04,6,40),new THREE.MeshBasicMaterial({color}));m.rotation.x=Math.PI/2;m.position.y=0.1;scene.add(m);return m;};
    const selected=mark(0x95ffc8,0.62),receiver=mark(0xffe184,0.58);
    const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    return {kind:'webgl',canvas,resize(w,h){renderer.setSize(w,h,false);const span=Math.max(24,20.8*h/w);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();},
        toField(x,y){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);const p=new THREE.Vector3();ray.ray.intersectPlane(plane,p);return {x:p.x,z:p.z};},
        render(s,dt){
            for(const a of s.players){const m=players[a.id];m.position.set(a.x,0,a.z);m.rotation.y=Math.atan2(a.fx,a.fz);m.userData.velocity.set(a.vx,0,a.vz);
                if(isKnockedDown(a.knockdown,s.time)){
                    const getUp=getUpProgress(a.knockdown,s.time);
                    if(a.role==='keeper')updateGoalkeeperAnimation(m,{elapsedTime:s.time,knocked:true,getUpProgress:getUp});
                    else updatePlayerAnimation(m,{dt,elapsedTime:s.time,knocked:true,getUpProgress:getUp,movement:m.userData.velocity});
                }
                else if(a.action)updatePlayerAnimation(m,{dt,elapsedTime:s.time,kicking:true,kickTime:0.3+a.action.age/0.64,movement:m.userData.velocity});
                else if(a.role==='keeper')updateGoalkeeperAnimation(m,{dt,elapsedTime:s.time,diving:!!a.dive,motionTime:a.dive?Math.min(1.6,(s.time-a.dive.started)*2):0,diveDirection:a.dive?(a.dive.side*(a.fz<0?-1:1)):1,saveHeight:s.ball.y});
                else updatePlayerAnimation(m,{dt,elapsedTime:s.time,movement:m.userData.velocity});
                updateStunStars(m,s.time,a.knockdown,camera);
                updateAIWarning(m,hasCombatWarning(a));
            }
            const r=s.referee;referee.position.set(r.x,0,r.z);referee.rotation.y=Math.atan2(r.fx,r.fz);referee.userData.velocity.set(r.vx,0,r.vz);
            updatePlayerAnimation(referee,{dt,elapsedTime:s.time,movement:referee.userData.velocity});
            if(s.time<r.warningUntil)referee.userData.pose.rightArm.hip.rotation.x=-1.7;
            ball.position.set(s.ball.x,s.ball.y+0.04,s.ball.z);ball.rotation.x+=s.ball.vz*dt;ball.rotation.z-=s.ball.vx*dt;
            const a=s.players[s.controlledId];selected.position.set(a.x,0.09,a.z);
            const owner=s.ball.owner==null?null:s.players[s.ball.owner],target=owner?.team===0?choosePassTarget(s,owner):null;
            receiver.visible=s.phase==='playing'&&!!target;if(target)receiver.position.set(target.x,0.1,target.z);
            renderer.render(scene,camera);
        }};
}
function buildCage(root){
    const turf=new THREE.MeshStandardMaterial({color:0x299578,roughness:0.98}),dark=new THREE.MeshStandardMaterial({color:0x17384c,roughness:0.8}),line=new THREE.LineBasicMaterial({color:0xd3f4df});
    const shape=new THREE.Shape();VERTICES.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const floor=new THREE.Mesh(new THREE.ShapeGeometry(shape),turf);floor.rotation.x=-Math.PI/2;floor.position.y=0.04;floor.receiveShadow=true;root.add(floor);
    const plinth=new THREE.Mesh(new THREE.CylinderGeometry(15.2,15.5,0.6,8),dark);plinth.scale.x=0.73;plinth.position.y=-0.3;root.add(plinth);
    const polyline=points=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,0.07,z)));root.add(new THREE.Line(g,line));};
    polyline([[-8,0],[8,0]]);
    const circle=Array.from({length:65},(_,i)=>[Math.cos(i/64*Math.PI*2)*2.1,Math.sin(i/64*Math.PI*2)*2.1]);polyline(circle);
    for(const sign of [-1,1]){polyline([[-3.4,sign*12],[-3.4,sign*8],[3.4,sign*8],[3.4,sign*12]]);buildGoal(root,sign);}
    const wireCanvas=document.createElement('canvas');wireCanvas.width=wireCanvas.height=64;
    const ctx=wireCanvas.getContext('2d');ctx.strokeStyle='#b6ddd9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(32,0);ctx.lineTo(64,32);ctx.lineTo(32,64);ctx.closePath();ctx.stroke();
    const texture=new THREE.CanvasTexture(wireCanvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    const postMat=new THREE.MeshStandardMaterial({color:0xffba62,roughness:0.65});
    for(let i=0;i<8;i++){
        const a=VERTICES[i],b=VERTICES[(i+1)%8],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,CAGE.height,6),postMat);post.position.set(a[0],CAGE.height/2,a[1]);post.castShadow=true;root.add(post);
        const panel=(x,z,width)=>{
            const tex=texture.clone();tex.needsUpdate=true;tex.repeat.set(width/0.55,CAGE.height/0.55);
            const m=new THREE.Mesh(new THREE.PlaneGeometry(width,CAGE.height),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:(a[1]+b[1])/2>0?0.18:0.42,side:THREE.DoubleSide,depthWrite:false}));
            m.position.set(x,CAGE.height/2,z);m.rotation.y=-Math.atan2(dz,dx);root.add(m);
            const rail=new THREE.Mesh(new THREE.BoxGeometry(width,0.09,0.1),postMat);rail.position.set(x,CAGE.height,z);rail.rotation.y=-Math.atan2(dz,dx);root.add(rail);
            const kick=new THREE.Mesh(new THREE.BoxGeometry(width,0.37,0.12),dark);kick.position.set(x,0.19,z);kick.rotation.y=-Math.atan2(dz,dx);root.add(kick);
        };
        if(i===0||i===4){
            const width=length/2-CAGE.goalHalf;panel(-(CAGE.goalHalf+width/2),a[1],width);panel(CAGE.goalHalf+width/2,a[1],width);
            const tex=texture.clone();tex.needsUpdate=true;tex.repeat.set(CAGE.goalHalf*2/0.55,(CAGE.height-CAGE.goalHeight)/0.55);
            const upper=new THREE.Mesh(new THREE.PlaneGeometry(CAGE.goalHalf*2,CAGE.height-CAGE.goalHeight),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:a[1]>0?0.18:0.42,side:THREE.DoubleSide,depthWrite:false}));
            upper.position.set(0,(CAGE.height+CAGE.goalHeight)/2,a[1]);root.add(upper);
            const rail=new THREE.Mesh(new THREE.BoxGeometry(CAGE.goalHalf*2,0.09,0.1),postMat);rail.position.set(0,CAGE.height,a[1]);root.add(rail);
        }
        else panel((a[0]+b[0])/2,(a[1]+b[1])/2,length);
    }
}
function buildGoal(root,sign){
    const material=new THREE.MeshStandardMaterial({color:sign<0?0xffc188:0x9bdbff,roughness:0.6});
    for(const x of [-CAGE.goalHalf,CAGE.goalHalf]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,CAGE.goalHeight,8),material);p.position.set(x,CAGE.goalHeight/2,sign*12);root.add(p);}
    const bar=new THREE.Mesh(new THREE.BoxGeometry(CAGE.goalHalf*2+0.18,0.15,0.15),material);bar.position.set(0,CAGE.goalHeight,sign*12);root.add(bar);
    const net=new THREE.Mesh(new THREE.BoxGeometry(CAGE.goalHalf*2,CAGE.goalHeight,1.0),new THREE.MeshBasicMaterial({color:0xc2ded8,wireframe:true,transparent:true,opacity:0.28}));net.position.set(0,CAGE.goalHeight/2,sign*12.5);root.add(net);
}
