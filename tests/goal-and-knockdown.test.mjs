import test from 'node:test';
import assert from 'node:assert/strict';
import {character,THREE} from './fixtures.mjs';
import {createMatch,stepMatch,beginCharge,releaseShot,requestKnockdown,refereeSees,attackDirection,beginShootout,resolvePenalty,CAGE} from '../scripts/five/engine.js';
import {makeKnockdown,isKnockedDown} from '../scripts/game/knockdown.js';
import {createAimDirectionGetter} from '../scripts/game/ui.js';
import {kickBall,kickDownOpponent,findKnockdownTarget} from '../scripts/game/kicking.js';
import {createGameState,updateReferee,resetRound,updateKeeper} from '../scripts/game/rules.js';
import {resetDefender,updateDefender} from '../scripts/game/defender.js';
import {BALL_GROUND_Y,BALL_RADIUS,FIELD} from '../scripts/game/config.js';
import {spawnConfetti,stepConfetti} from '../scripts/game/confetti.js';
const advance=(s,t)=>{for(let i=0;i<Math.ceil(t*120);i++)stepMatch(s,1/120,{});};
function fight(x=0){
    const s=createMatch();s.phase='playing';s.time=10;
    for(const a of s.players){a.x=a.team?5:-5;a.z=6+a.slot;a.cooldown=100;}
    const a=s.players[4],b=s.players[9];Object.assign(a,{x,z:1,fx:0,fz:-1});Object.assign(b,{x,z:0.1,fx:0,fz:1});
    Object.assign(s.ball,{owner:a.id,x,y:CAGE.ballRadius,z:0.44,lastTouch:a.id});
    return s;
}

test('5v5 shots target the opponent goal in both halves even with a pointer behind the shooter',()=>{
    for(const half of [1,2])for(const x of [-6,6])for(const hintX of [-100,100]){
        const s=fight();s.half=half;const a=s.players[4];Object.assign(a,{x,z:0,cooldown:0,fx:0,fz:-attackDirection(s,0)});
        Object.assign(s.ball,{owner:a.id,x,y:CAGE.ballRadius,z:0});
        assert.equal(beginCharge(s),true);assert.equal(releaseShot(s,{x:hintX,z:-attackDirection(s,0)*30}),true);
        const target=a.action.target;assert.equal(Math.sign(target.z),attackDirection(s,0));assert.ok(Math.abs(target.x)<CAGE.goalHalf-CAGE.ballRadius);
        advance(s,0.16);assert.ok(s.ball.vz*attackDirection(s,0)>0);assert.equal(s.stats[0].shots,1);
    }
});

test('single-player assisted shots ignore a backwards pointer and keep both width and apex below the frame',()=>{
    for(const x of [-4,0,4]){
        const state=createGameState(),player=character('player'),ball=new THREE.Group();player.position.set(x,0,2);ball.position.set(x,BALL_GROUND_Y,1.52);
        const getAimDirection=createAimDirectionGetter(new THREE.Vector3(x*100,0,8),ball);
        assert.ok(getAimDirection().z<0);
        assert.equal(kickBall({state,player,ball,getAimDirection,showMessage:()=>{}},1),true);
        const v=state.ballVelocity,t=(FIELD.goalZ-0.5-ball.position.z)/v.z;
        assert.ok(v.z<0);assert.ok(Math.abs(ball.position.x+v.x*t)<2.65-BALL_RADIUS);
        assert.ok(BALL_GROUND_Y+v.y*v.y/(2*15.5)<2.38-BALL_RADIUS);
    }
});

test('a knockdown waits for foot contact, cancels the victim action, drops possession and stuns only once',()=>{
    const s=fight();s.players[4].cooldown=0;s.ball.owner=9;
    assert.equal(requestKnockdown(s),true);advance(s,0.1);assert.equal(s.players[9].knockdown,null);
    advance(s,0.06);const victim=s.players[9];assert.ok(isKnockedDown(victim.knockdown,s.time));assert.equal(s.stats[0].knockdowns,1);
    assert.equal(victim.action,null);assert.notEqual(s.ball.owner,victim.id);
    const position={x:victim.x,z:victim.z};advance(s,1);assert.equal(victim.x,position.x);assert.equal(victim.z,position.z);assert.equal(victim.vx,0);assert.equal(victim.vz,0);
    assert.equal(s.stats[0].knockdowns,1);assert.equal(s.stats[0].fouls,0);
    s.paused=true;const time=s.time;advance(s,2);assert.equal(s.time,time);assert.ok(isKnockedDown(victim.knockdown,s.time));
    s.paused=false;advance(s,4.2);assert.equal(isKnockedDown(victim.knockdown,s.time),false);
});

test('out-of-range or dodged opponents cannot be knocked down remotely',()=>{
    const s=fight();s.players[4].cooldown=0;s.players[9].x=3;assert.equal(requestKnockdown(s),false);
    s.players[9].x=0;assert.equal(requestKnockdown(s),true);s.players[9].x=5;advance(s,0.3);
    assert.equal(s.players[9].knockdown,null);assert.equal(s.stats[0].knockdowns,0);
});

test('stunned keepers cannot save and stunned field players cannot receive a pass or take possession',()=>{
    const s=fight();const down=s.players[9];down.knockdown=makeKnockdown(s.time);down.x=4;down.z=0;
    const keeper=s.players[5];keeper.knockdown=makeKnockdown(s.time);keeper.x=0;keeper.z=-10;
    Object.assign(s.ball,{owner:null,x:0,y:CAGE.ballRadius,z:-9.9,vx:0,vy:0,vz:-3,lockUntil:0,kicker:null});
    advance(s,0.15);assert.equal(s.stats[1].saves,0);assert.notEqual(s.ball.owner,5);
    Object.assign(s.ball,{owner:null,x:down.x,y:CAGE.ballRadius,z:down.z,vx:0,vy:0,vz:0,lockUntil:0});
    advance(s,0.1);assert.notEqual(s.ball.owner,9);
});

test('an off-cage referee sees a nearby foul, stops the clock and awards a free kick to a standing opponent',()=>{
    const s=fight(-7.1);s.players[4].cooldown=0;assert.equal(refereeSees(s,s.players[4]),true);
    assert.equal(requestKnockdown(s),true);advance(s,0.16);assert.equal(s.phase,'foul');assert.equal(s.stats[0].fouls,1);
    const remaining=s.remaining;advance(s,0.8);assert.equal(s.remaining,remaining);
    advance(s,0.7);assert.equal(s.phase,'playing');assert.equal(s.players[s.ball.owner].team,1);assert.notEqual(s.ball.owner,9);
    assert.equal(s.scores[0]+s.scores[1],0);assert.ok(s.referee.x < -CAGE.halfWidth);
    for(let i=0;i<600;i++){s.ball.z=Math.sin(i/30)*11;stepMatch(s,1/120,{});assert.ok(s.referee.x < -CAGE.halfWidth);}
});

test('knockdowns are unavailable during pause, kickoffs or penalties, and a fresh match clears stun',()=>{
    for(const phase of ['ready','kickoff','halftime','shootout','finished']){const s=fight();s.phase=phase;s.players[4].cooldown=0;assert.equal(requestKnockdown(s),false);}
    const s=fight();s.paused=true;assert.equal(requestKnockdown(s),false);
    s.paused=false;s.players[9].knockdown=makeKnockdown(s.time);beginShootout(s);assert.equal(s.players[9].knockdown,null);
    assert.ok(createMatch().players.every(a=>!a.knockdown));
});

function single(){
    const state=createGameState(),player=character('player'),keeper=character(),defender=character('defender'),referee=character('referee'),ball=new THREE.Group();
    state.keeperLevel=3;resetDefender({state,defender,elapsedTime:10});player.position.set(0,0,1);defender.position.set(0,0,0.2);keeper.position.set(4,0,-6);referee.position.set(-6.2,0,0);ball.position.set(0,BALL_GROUND_Y,0.5);
    return {state,player,keeper,defender,referee,ball,elapsedTime:10,showMessage:()=>{}};
}

test('single-player defender knockdown cancels a pending tackle and preserves the 3–5 second stun until recovery',()=>{
    const c=single();c.defender.userData.defense.tackle={started:10};assert.equal(findKnockdownTarget(c),c.defender);
    assert.equal(kickDownOpponent(c,0.5),true);assert.equal(c.defender.userData.defense.tackle,null);
    assert.equal(c.defender.userData.knockdown.downUntil,14);assert.equal(kickDownOpponent(c,0.5),false);
    const position=c.defender.position.clone();for(let i=0;i<120;i++)updateDefender({...c,dt:1/60,elapsedTime:10+i/60,onSteal:()=>assert.fail('stunned tackle fired')});
    assert.ok(c.defender.position.equals(position));assert.equal(c.state.pendingRefereeFailure,false);
    c.ball.position.z=-3;updateDefender({...c,dt:1/60,elapsedTime:14.7});assert.ok(c.defender.userData.velocity.length()>0);
    resetRound(c,'reset');assert.equal(c.defender.userData.knockdown,null);assert.equal(c.keeper.userData.knockdown,null);
});

test('single-player keeper keeps its stun and loses a pending save; a visible defender hit is still a foul',()=>{
    const c=single();c.keeper.position.set(0.5,0,1);c.defender.visible=false;c.state.keeperSave={futureContact:true};
    assert.equal(kickDownOpponent(c,0.5),true);assert.equal(c.state.keeperSave,null);assert.equal(c.state.keeperDownUntil,14);
    updateKeeper({...c,dt:1/60,elapsedTime:11,onKeeperSave:()=>assert.fail('stunned keeper saved')});assert.equal(c.state.keeperMode,'knocked');assert.ok(c.keeper.userData.knockdown);
    const other=single();other.referee.position.set(0,0,-1);other.referee.rotation.y=0;
    assert.equal(kickDownOpponent(other,0.5),true);assert.equal(other.state.pendingRefereeFailure,true);
});

test('single-player referee stays outside one sideline when the player crosses the field',()=>{
    const c=single();for(let i=0;i<600;i++){c.player.position.x=Math.sin(i/30)*5;updateReferee({...c,dt:1/60,elapsedTime:10+i/60});assert.ok(c.referee.position.x < -FIELD.width/2);}
});

test('every actual regulation or penalty goal emits one celebration signal; a miss emits none',()=>{
    const s=fight();Object.assign(s.ball,{owner:null,x:0,y:CAGE.ballRadius,z:-12.15,vx:0,vy:0,vz:-17,lockUntil:999});stepMatch(s,1/60,{});assert.equal(s.goalSerial,1);advance(s,1);assert.equal(s.goalSerial,1);
    beginShootout(s);s.shootout.stage='flight';resolvePenalty(s,false);assert.equal(s.goalSerial,1);
    s.shootout.stage='flight';resolvePenalty(s,true);assert.equal(s.goalSerial,2);assert.equal(resolvePenalty(s,true),false);assert.equal(s.goalSerial,2);
});

test('confetti is finite, frame-rate independent and fully removed after its short celebration',()=>{
    const a=spawnConfetti(390,844,()=>0.5),b=spawnConfetti(390,844,()=>0.5);assert.equal(a.length,144);
    let slow=a,fast=b;for(let i=0;i<30;i++)slow=stepConfetti(slow,1/30);for(let i=0;i<60;i++)fast=stepConfetti(fast,1/60);
    assert.ok(Math.abs(slow[0].x-fast[0].x)<1e-8);assert.ok(Math.abs(slow[0].y-fast[0].y)<1e-8);assert.equal(slow[0].color,fast[0].color);
    for(let i=0;i<300;i++)slow=stepConfetti(slow,1/60);assert.equal(slow.length,0);assert.equal(spawnConfetti(390,844,()=>0.5,true).length,24);
});

test('assisted wing shots enter the actual goal mouth instead of hitting the end wall before the target',()=>{
    for(const half of [1,2])for(const x of [-4,4]){
        const s=createMatch(),sign=half===1?-1:1;s.phase='playing';s.half=half;s.time=10;
        for(const a of s.players){a.x=a.team?5:-5;a.z=-sign*8;a.cooldown=999;}
        const a=s.players[4];Object.assign(a,{x,z:sign*7,fx:0,fz:sign,cooldown:0});
        Object.assign(s.ball,{x,y:CAGE.ballRadius,z:sign*7.56,owner:4});
        beginCharge(s);releaseShot(s,{x:x*100,z:-sign*20});
        for(let i=0;i<120&&s.phase==='playing';i++)stepMatch(s,1/120,{});
        assert.equal(s.phase,'goal');assert.deepEqual(s.scores,[1,0]);assert.equal(s.goalSerial,1);
    }
});
