import test from 'node:test';
import assert from 'node:assert/strict';
import {character, THREE} from './fixtures.mjs';
import {FOOTBALL_CLIPS, MOTION_TIMING} from '../scripts/game/motions/football-clips.js';
import {updatePlayerAnimation} from '../scripts/game/player-animation.js';
import {updateGoalkeeperAnimation} from '../scripts/game/goalkeeper-animation.js';
import {predictKeeperSave, beginKeeperSave} from '../scripts/game/goalkeeper.js';
import {createGameState, startKickCharge, releaseKickCharge, updatePlayer, updateBall, updateKeeper, resetRound} from '../scripts/game/rules.js';
import {kickBall} from '../scripts/game/kicking.js';
import {BALL_GROUND_Y, FIELD_SURFACE_Y, FIELD, KEEPER_PROFILES} from '../scripts/game/config.js';

const vector = () => new THREE.Vector3();
function meshFloor(root) {
    root.updateMatrixWorld(true);
    let min = Infinity;
    root.traverse(o => {if(o.isMesh){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();min=Math.min(min,new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).min.y);}});
    return min;
}

test('baked clips have distinct identities, finite normalized rotations and continuous adjacent frames', () => {
    assert.equal(new Set(Object.values(FOOTBALL_CLIPS).map(c => c.uuid)).size, 5);
    for (const json of Object.values(FOOTBALL_CLIPS)) {
        const clip = THREE.AnimationClip.parse(json);
        assert.ok(clip.duration >= 1);
        for (const track of clip.tracks) {
            assert.ok([...track.values].every(Number.isFinite));
            if (!track.name.endsWith('.quaternion')) continue;
            let previous;
            for (let i=0; i<track.values.length; i+=4) {
                const q = new THREE.Quaternion().fromArray(track.values,i);
                assert.ok(Math.abs(q.length()-1)<0.00002);
                if(previous) assert.ok(q.angleTo(previous)<0.8,`${json.name} ${track.name} discontinuous`);
                previous=q;
            }
        }
    }
});

test('both dive directions actually tilt the head and reach to opposite sides', () => {
    const keeper = character();
    const positions=[];
    for(const side of [1,-1]) {
        updateGoalkeeperAnimation(keeper,{diving:true,motionTime:0.57,diveDirection:side});
        positions.push(keeper.userData.pose.head.getWorldPosition(vector()));
    }
    assert.ok(positions[0].x>0.75);
    assert.ok(positions[1].x < -0.75);
    assert.ok(Math.abs(positions[0].y-positions[1].y)<0.0001);
});

test('all five key phases recover continuously and no rigid mesh penetrates the pitch', () => {
    const keeper=character();
    for (const id of ['diveLeft','diveRight','punch','scoop']) {
        let previous;
        for(let i=0;i<=160;i++) {
            const time=MOTION_TIMING[id].duration*i/160;
            updateGoalkeeperAnimation(keeper,{diving:id.startsWith('dive'),punching:id==='punch',scooping:id==='scoop',motionTime:time,diveDirection:id==='diveRight'?-1:1,saveHeight:id==='punch'?2.3:0.55});
            assert.ok(meshFloor(keeper.userData.pose.visualRoot)>=FIELD_SURFACE_Y-0.0001);
            const head=keeper.userData.pose.head.getWorldPosition(vector());
            if(previous)assert.ok(head.distanceTo(previous)<0.15,`${id} head jumped at ${time}`);
            previous=head;
        }
    }
});

test('kicking plants the support foot and the actual shoe reaches the ball at impact', () => {
    const player=character('player'), ball=new THREE.Vector3(-0.16,BALL_GROUND_Y,0.57);
    let support;
    for(let i=0;i<=130;i++) {
        const t=i/100;
        updatePlayerAnimation(player,{kicking:true,kickTime:t,ballPosition:t<=0.54?ball:null,kickDirection:new THREE.Vector3(0,0,1)});
        const p=player.userData.pose;
        const current=p.leftLeg.end.getWorldPosition(vector());
        if(support) assert.ok(Math.hypot(current.x-support.x,current.z-support.z)<0.00001);
        support=current;
        assert.ok(meshFloor(p.visualRoot)>=FIELD_SURFACE_Y-0.0001);
        if(i===52) assert.ok(p.rightLeg.end.getWorldPosition(vector()).distanceTo(ball)<0.31);
    }
});

test('shot is delayed until the contact marker, fires once, and preserves release power', () => {
    const state=createGameState(), player=character('player'), ball=new THREE.Group();
    ball.position.set(-0.16,BALL_GROUND_Y,0.57);state.kickDirection.set(0,0,1);
    startKickCharge(state,9.5);let fired=0,power=0;
    releaseKickCharge(state,10,p=>{fired++;power=p;kickBall({state,player,ball,getAimDirection:()=>state.kickDirection,showMessage:()=>{}},p);state.chargePower=0;});
    assert.equal(fired,0);assert.equal(state.ballVelocity.length(),0);
    for(let i=1;i<=100;i++) {
        updatePlayer({dt:1/120,state,keys:new Set(),player,ball,getAimDirection:()=>state.kickDirection,elapsedTime:10+i/120});
        if(i<5) assert.equal(fired,0);
    }
    assert.equal(fired,1);assert.ok(Math.abs(power-0.5/0.675)<1e-9);
    assert.ok(state.ballVelocity.z < -14);assert.equal(state.kickAction,null);
});

test('a queued shot prevents repeated key presses and reset cancels its future event', () => {
    const state=createGameState(),player=character('player'),keeper=character(),ball=new THREE.Group();
    startKickCharge(state,9.5);let fired=0;releaseKickCharge(state,10,()=>fired++);
    assert.equal(startKickCharge(state,10.01),false);
    resetRound({state,player,keeper,ball,showMessage:()=>{}},'reset');
    updatePlayer({dt:0.033,state,keys:new Set(),player,ball,getAimDirection:()=>state.kickDirection,elapsedTime:11});
    assert.equal(fired,0);assert.equal(state.keeperSave,null);assert.equal(keeper.position.y,0);
});

test('keeper sees the field in +Z, rejects a ball behind him, and starting a save never deflects it', () => {
    const keeper=character(),state=createGameState(),ball=new THREE.Group();ball.position.set(1.45,BALL_GROUND_Y,3.2);state.ballVelocity.set(0,0,-8);
    const prediction=predictKeeperSave(keeper,ball,state.ballVelocity,KEEPER_PROFILES[1]);
    assert.ok(prediction);
    const velocity=state.ballVelocity.clone();beginKeeperSave({state,keeper,ball,elapsedTime:10,profile:KEEPER_PROFILES[1]},prediction);
    assert.deepEqual(state.ballVelocity.toArray(),velocity.toArray());
    ball.position.z=-1;assert.equal(predictKeeperSave(keeper,ball,velocity,KEEPER_PROFILES[1]),null);
});

for(const level of [1,2,3]) for(const [kind,x,y,vy] of [['left',1.45,BALL_GROUND_Y,0],['right',-1.45,BALL_GROUND_Y,0],['high',0,2,3.8],['center',0,BALL_GROUND_Y,0]]) {
    test(`real simulation: level ${level} ${kind} shot contacts before a single deflection`, () => {
        const keeper=character(),state=createGameState(),ball=new THREE.Group();
        keeper.position.set(0,0,FIELD.goalZ+0.72);ball.position.set(x,y,keeper.position.z+3.2);state.keeperLevel=level;state.ballVelocity.set(0,vy,-8);
        let saves=0;
        for(let i=0;i<180;i++) {
            const dt=1/120,elapsedTime=10+i*dt;
            updateBall({dt,state,ball});
            updateKeeper({dt,state,keeper,ball,elapsedTime,onKeeperSave:()=>{saves++;assert.ok(state.ballVelocity.z>0);}});
            assert.equal(keeper.scale.y,1);
        }
        assert.equal(saves,1);
        assert.equal(state.keeperSave,null);
        assert.equal(keeper.position.y,0);
    });
}

test('unreachable shots and high balls produce no phantom saves', () => {
    for(const [x,y] of [[3.2,BALL_GROUND_Y],[0,3.5]]) {
        const keeper=character(),state=createGameState(),ball=new THREE.Group();
        keeper.position.z=FIELD.goalZ+0.72;ball.position.set(x,y,keeper.position.z+2.5);state.ballVelocity.set(0,0,-8);
        let saves=0;
        for(let i=0;i<50;i++){const dt=1/120;updateBall({dt,state,ball});updateKeeper({dt,state,keeper,ball,elapsedTime:10+i*dt,onKeeperSave:()=>saves++});}
        assert.equal(saves,0);
    }
});

for (const fps of [30, 60]) for (const [kind,x,y,vy] of [['low',1.45,BALL_GROUND_Y,0],['high',0,2,3.8]]) {
    test(`simulation at ${fps} fps: ${kind} ball with an oversized imported-head bound`, () => {
        const keeper=character(),state=createGameState(),ball=new THREE.Group();
        keeper.userData.pose.head.clear();
        const head=new THREE.Mesh(new THREE.BoxGeometry(1.02,1.02,1.02),new THREE.MeshStandardMaterial());
        head.position.y=0.12;keeper.userData.pose.head.add(head);
        keeper.position.z=FIELD.goalZ+0.72;ball.position.set(x,y,keeper.position.z+3.2);state.ballVelocity.set(0,vy,-8);
        let saves=0;
        for(let i=0;i<fps*2;i++) {
            const dt=1/fps;updateBall({dt,state,ball});
            updateKeeper({dt,state,keeper,ball,elapsedTime:10+i*dt,onKeeperSave:()=>saves++});
            assert.ok(meshFloor(keeper.userData.pose.visualRoot)>=FIELD_SURFACE_Y-0.0001);
        }
        assert.equal(saves,1);
    });
}

test('pelvis covers both thigh pivots throughout the sideways dive', () => {
    const keeper=character();const pose=keeper.userData.pose;
    for(let i=0;i<=160;i++) {
        updateGoalkeeperAnimation(keeper,{diving:true,motionTime:i/100,diveDirection:1});
        for (const limb of [pose.leftLeg,pose.rightLeg]) {
            const p=pose.pelvis.worldToLocal(limb.hip.getWorldPosition(vector()));
            assert.ok(Math.abs(p.x)<0.25 && p.y>-0.04 && p.y<0.2 && Math.abs(p.z)<0.17);
        }
    }
});
