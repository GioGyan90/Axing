import test from 'node:test';
import assert from 'node:assert/strict';
import {character,THREE} from './fixtures.mjs';
import {SLIDE,createSlide,advanceSlide,slideContact} from '../scripts/game/slide-tackle.js';
import {createMatch,stepMatch,requestSlide,beginCharge,requestKnockdown,beginShootout,insideCage} from '../scripts/five/engine.js';
import {createGameState,updatePlayer,updateBall,startKickCharge,resetRound} from '../scripts/game/rules.js';
import {requestSingleSlide,captureSlidePositions,resolveSingleSlides} from '../scripts/game/single-slide.js';
import {updateSingleCombat} from '../scripts/game/single-combat.js';
import {createCombatAI,considerSlide,hasCombatWarning} from '../scripts/game/combat-ai.js';
import {updatePlayerAnimation} from '../scripts/game/player-animation.js';
import {makeKnockdown,isKnockedDown} from '../scripts/game/knockdown.js';
import {BALL_GROUND_Y,FIELD_SURFACE_Y,FIELD} from '../scripts/game/config.js';

function five(){
    const s=createMatch();s.phase='playing';s.time=10;s.combatProtectedUntil=999;
    for(const a of s.players){a.x=a.team?6:-6;a.z=6+a.slot*.8;a.cooldown=999;}
    Object.assign(s.players[4],{x:0,z:2,fx:0,fz:-1,cooldown:0});
    Object.assign(s.ball,{owner:null,x:0,z:0.4,y:0.23,lockUntil:999});
    return s;
}
function step(s,seconds,hz=120,input={}){for(let i=0;i<Math.ceil(seconds*hz);i++)stepMatch(s,1/hz,input);}

test('slide direction uses movement first, then facing, and total travel is independent of frame rate',()=>{
    for(const hz of [10,30,60,120]){
        const a={x:0,z:0},slide=createSlide(0,{x:3,z:4},{x:0,z:-1});
        for(let i=0;i<hz;i++)advanceSlide(slide,1/hz,{...a},a);
        assert.ok(Math.abs(a.x-1.62)<1e-8);assert.ok(Math.abs(a.z-2.16)<1e-8);assert.equal(slide.age,SLIDE.duration);
    }
    assert.equal(createSlide(0,{x:0,z:0},{x:-1,z:0}).dx,-1);
});

test('extended boot sweeps fast moving balls and players, with no contact behind, above or during recovery',()=>{
    const a={x:0,z:0},slide=createSlide(0,{x:0,z:1},{x:0,z:-1});
    advanceSlide(slide,0.1,{...a},a);advanceSlide(slide,0.1,{...a},a);
    assert.equal(slideContact(slide,{x:-3,z:1.8},{x:3,z:1.8},0.23),true);
    assert.equal(slideContact(slide,{x:-3,y:2,z:1.8},{x:3,y:2,z:1.8},0.23,{maxHeight:SLIDE.maxBallHeight}),false);
    assert.equal(slideContact(slide,{x:2,z:1.5},{x:2,z:1.5},0.38),false);
    assert.equal(slideContact(slide,{x:0,z:-1},{x:0,z:-1},0.38),false);
    for(let i=0;i<7;i++)advanceSlide(slide,0.1,{...a},a);
    assert.equal(slideContact(slide,{x:0,z:3},{x:0,z:3},0.38),false);
});

test('5v5 slide has real incremental travel, locks direction and blocks shooting until recovery',()=>{
    const s=five(),a=s.players[4];
    assert.equal(requestSlide(s,{moveX:1,moveZ:0}),true);assert.equal(a.x,0);assert.equal(beginCharge(s),false);
    step(s,0.2,60,{moveX:-1,moveZ:0,aim:{x:0,z:1}});assert.ok(a.x>1&&a.x<2);assert.equal(a.z,2);assert.equal(a.fx,1);
    step(s,0.65);assert.equal(a.slide,null);assert.ok(Math.abs(a.x-2.7)<1e-8);assert.equal(requestSlide(s),false);
    step(s,1);assert.equal(requestSlide(s),true);
});

test('5v5 only-ball contact releases possession and never invents a foul or repeated impulses',()=>{
    for(const hz of [30,60,120]){
        const s=five();assert.equal(requestSlide(s),true);step(s,0.7,hz);
        assert.equal(s.stats[0].slideBallHits,1);assert.equal(s.stats[0].knockdowns,0);assert.equal(s.stats[0].fouls,0);
        assert.ok(s.ball.vz< -4);assert.equal(s.ball.lastTouch,4);assert.equal(s.ball.owner,null);assert.ok(s.players[4].slide.hitBall);
    }
});

test('one 5v5 slide can knock away the ball and knock down its carrier, once per victim',()=>{
    const s=five();Object.assign(s.players[9],{x:0,z:-0.5,fx:0,fz:1,heldSince:10});Object.assign(s.ball,{owner:9,x:0,z:0.06});
    requestSlide(s);step(s,0.65);assert.equal(s.stats[0].slideBallHits,1);assert.equal(s.stats[0].knockdowns,1);assert.ok(isKnockedDown(s.players[9].knockdown,s.time));
    const until=s.players[9].knockdown.downUntil;step(s,0.15);assert.equal(s.players[9].knockdown.downUntil,until);assert.equal(s.ball.owner,null);
});

test('a slide cannot hit an opponent outside the leg sweep or an airborne ball',()=>{
    const s=five();Object.assign(s.players[9],{x:2,z:0});s.ball.y=2;s.ball.vy=3;
    requestSlide(s);step(s,0.35);assert.equal(s.stats[0].slideBallHits,0);assert.equal(s.stats[0].knockdowns,0);
});

test('visible slide into a person is whistled; visible clean ball contact is legal',()=>{
    for(const humanContact of [true,false]){
        const s=five(),a=s.players[4];a.x=-7.1;s.referee.z=0.2;Object.assign(s.ball,{x:-7.1,z:0.4});
        if(humanContact)Object.assign(s.players[9],{x:-7.1,z:-0.1});
        requestSlide(s);step(s,0.5);assert.equal(s.stats[0].fouls,humanContact?1:0);
        assert.equal(s.phase,humanContact?'foul':'playing');if(humanContact){assert.equal(s.freeKick.team,1);assert.equal(a.slide,null);}
    }
});

test('slides stay inside octagon corners and stop for half-time, penalties, stun and pauses',()=>{
    const s=five(),a=s.players[4];Object.assign(a,{x:6.1,z:8.9});requestSlide(s,{moveX:1,moveZ:1});
    for(let i=0;i<100;i++){stepMatch(s,1/120,{});assert.ok(insideCage(a,0.38));}
    const p=five();requestSlide(p);step(p,0.15);p.paused=true;const z=p.players[4].z;step(p,1);assert.equal(p.players[4].z,z);assert.equal(requestSlide(p),false);
    p.paused=false;p.remaining=0.01;step(p,0.02);assert.equal(p.phase,'halftime');assert.equal(p.players[4].slide,null);assert.equal(requestSlide(p),false);
    const pk=five();requestSlide(pk);beginShootout(pk);assert.equal(pk.players[4].slide,null);assert.equal(requestSlide(pk),false);
    const down=five();down.players[4].knockdown=makeKnockdown(10);assert.equal(requestSlide(down),false);assert.equal(requestKnockdown(down),false);
});

test('AI independently telegraphs and executes sliding tackles on either team, not on teammates',()=>{
    const options={time:10,actor:{id:9,team:1,role:'field',x:0,z:0,cooldown:0},owner:{id:4,team:0},ball:{x:0,y:0.23,z:2.5,vx:0,vz:0}};
    let seed=0;for(let i=1;i<5000;i++)if(considerSlide(createCombatAI(i,9),options)){seed=i;break;}
    assert.ok(seed);assert.equal(considerSlide(createCombatAI(seed,9),{...options,owner:{id:8,team:1}}),null);
    for(const team of [0,1]){
        const s=five(),id=team===0?3:9,a=s.players[id];Object.assign(a,{x:0,z:-0.5,cooldown:0});a.combat=createCombatAI(2,9);
        Object.assign(s.players[team===0?9:4],{x:0,z:2.6,fx:0,fz:-1,heldSince:10,action:{kind:'shot',age:0,fired:true}});Object.assign(s.ball,{owner:team===0?9:4,z:2.04});s.combatProtectedUntil=0;
        stepMatch(s,1/120,{});assert.ok(hasCombatWarning(a));assert.equal(a.slide,null);
        step(s,0.6);assert.ok(s.stats[team].slides>0);assert.ok(s.stats[team].slideBallHits>0||s.stats[team].knockdowns>0);
    }
});

function single(){
    const state=createGameState(),player=character('player'),keeper=character(),defender=character('defender'),ball=new THREE.Group();
    player.position.set(0,0,2);player.userData.facing.set(0,0,-1);keeper.position.set(4,0,-6);defender.position.set(0,0,-0.4);state.keeperLevel=3;
    ball.position.set(0,BALL_GROUND_Y,0.4);return {state,player,keeper,defender,ball,elapsedTime:10,keys:new Set()};
}
function singleStep(c,dt=1/120){
    c.elapsedTime+=dt;const previous=captureSlidePositions(c);updatePlayer({...c,dt,getAimDirection:()=>new THREE.Vector3(0,0,-1)});updateBall({...c,dt});resolveSingleSlides({...c,previous});
}

test('single-player slide hits both the ball and defender, preserves stun and can also hit the goalkeeper',()=>{
    for(const victim of ['defender','keeper']){
        const c=single();if(victim==='keeper'){c.defender.visible=false;c.keeper.position.set(0,0,-0.4);}
        assert.equal(requestSingleSlide(c),true);assert.equal(startKickCharge(c.state,10),false);
        for(let i=0;i<70;i++)singleStep(c);
        assert.ok(c.player.userData.slide.hitBall);assert.ok(isKnockedDown(c[victim].userData.knockdown,c.elapsedTime));assert.ok(c.state.ballVelocity.z< -3);
        assert.equal(c.state.attemptCount,0);if(victim==='keeper')assert.equal(c.state.keeperState,'knocked');
    }
});

test('single-player movement, recovery and resetting cancel future slide contacts',()=>{
    const c=single();c.keys.add('KeyD');requestSingleSlide(c);singleStep(c,0.1);assert.ok(c.player.position.x>0.7);assert.equal(c.player.position.z,2);
    assert.equal(requestSingleSlide(c),false);c.keys.clear();for(let i=0;i<95;i++)singleStep(c);assert.equal(c.player.userData.slide,null);assert.equal(c.state.playerSlideActive,false);
    c.elapsedTime=12;requestSingleSlide(c);resetRound({...c,showMessage:()=>{}},'reset');assert.equal(c.player.userData.slide,null);assert.equal(c.state.slideCooldownUntil,0);
    c.state.isResetting=false;c.state.playerKnockdown=makeKnockdown(12);assert.equal(requestSingleSlide(c),false);
});

test('single-player defender chooses a slide independently, warns, then contacts the ball carrier',()=>{
    const c=single();c.state.aiSeed=4;c.state.isDribbling=true;c.defender.position.z=-0.8;c.ball.position.z=1.44;
    updateSingleCombat({...c,dt:1/120});assert.ok(c.defender.userData.combat.slideIntent);assert.equal(c.defender.userData.slide,undefined);
    for(let i=0;i<120&&!c.state.playerKnockdown;i++){
        c.elapsedTime+=1/120;const previous=captureSlidePositions(c),ctx={...c,dt:1/120};updateSingleCombat(ctx);
        updatePlayer({...ctx,getAimDirection:()=>new THREE.Vector3(0,0,-1)});updateBall(ctx);resolveSingleSlides({...c,previous});
    }
    assert.equal(c.state.aiKnockdowns,1);assert.ok(isKnockedDown(c.state.playerKnockdown,c.elapsedTime));assert.ok(c.defender.userData.slide.hitBall);
});

test('single-player AI slide can physically knock the human down and referee awards the human possession',()=>{
    const c=single(),referee=character('referee');c.referee=referee;referee.position.set(-2,0,0.7);referee.rotation.y=Math.PI/2;
    // A real AI slide after its decision, then the normal contact resolver.
    c.defender.position.set(0,0,-0.5);c.defender.userData.slide=createSlide(10,{x:0,z:1},{x:0,z:1},'ai');
    for(let i=0;i<80&&!c.state.aiFoulPending;i++){
        c.elapsedTime+=1/120;const previous=captureSlidePositions(c);const context={...c,dt:1/120};updateSingleCombat(context);updatePlayer({...context,getAimDirection:()=>new THREE.Vector3(0,0,-1)});updateBall(context);resolveSingleSlides({...c,previous});
    }
    assert.equal(c.state.aiFoulPending,true);assert.equal(c.state.aiFouls,1);assert.equal(c.state.attemptCount,0);assert.equal(c.player.userData.slide,null);assert.ok(isKnockedDown(c.state.playerKnockdown,c.elapsedTime));
});

test('baked slide really lowers the body, extends one foot and recovers continuously without ground penetration',()=>{
    const actor=character('player'),pose=actor.userData.pose;let previous;
    for(let i=0;i<=168;i++){
        const time=i/200;updatePlayerAnimation(actor,{sliding:true,slideTime:time});actor.updateMatrixWorld(true);
        let floor=Infinity;pose.visualRoot.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();floor=Math.min(floor,new THREE.Box3().copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld).min.y);}});
        assert.ok(floor>=FIELD_SURFACE_Y-1e-5);const head=pose.head.getWorldPosition(new THREE.Vector3());
        if(previous)assert.ok(head.distanceTo(previous)<0.18,`head discontinuity at ${time}`);previous=head;
        if(i===70){assert.ok(head.y<1.1);assert.ok(pose.pelvis.getWorldPosition(new THREE.Vector3()).y<0.4);const foot=pose.rightLeg.end.getWorldPosition(new THREE.Vector3());assert.ok(foot.z>0.55);assert.ok(foot.y<0.4);}
        if(i===168)assert.ok(head.y>1.55);
    }
});
