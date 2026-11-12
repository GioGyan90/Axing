import test from 'node:test';
import assert from 'node:assert/strict';
import {character,THREE} from './fixtures.mjs';
import {createCombatAI,considerCombat} from '../scripts/game/combat-ai.js';
import {createMatch,stepMatch,startMatch,beginShootout} from '../scripts/five/engine.js';
import {makeKnockdown,isKnockedDown} from '../scripts/game/knockdown.js';
import {createGameState,updatePlayer,updateBall,startKickCharge,resetRound} from '../scripts/game/rules.js';
import {resetDefender,updateDefender,syncDefenderDifficulty} from '../scripts/game/defender.js';
import {updateSingleCombat} from '../scripts/game/single-combat.js';
import {FIELD,BALL_GROUND_Y} from '../scripts/game/config.js';
const step=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)stepMatch(s,1/120,{});};
function choice(seed,id,{seen=false,urgent=false,aggression=1}={}){
    const actor={id,team:1,role:id===5?'keeper':'field',x:0,z:0.1,cooldown:0,action:null},owner={id:20,team:0,role:'field',x:0,z:1};
    return considerCombat(createCombatAI(seed,id),{time:10,actor,opponents:[owner],owner,ball:{x:0,y:0.23,z:0.44},seen,homeGoalZ:urgent?-2:-12,aggression});
}
function seedFor(id,options){for(let seed=1;seed<=500;seed++)if(choice(seed,id,options))return seed;throw Error('No committing seed');}
function five(attackerId=9,targetId=4,{seen=false,keeper=false,autoBlue=false}={}){
    const s=createMatch({seed:seedFor(attackerId,{seen,urgent:keeper}),autoBlue});s.phase='playing';s.time=10;s.combatProtectedUntil=0;
    for(const a of s.players){a.x=a.team?5:-5;a.z=4+a.slot;a.cooldown=999;}
    const a=s.players[attackerId],b=s.players[targetId],x=seen?-7.1:0,home=a.team===0?1:-1;
    Object.assign(a,{x,z:keeper?home*10.8:a.team===0?1.9:0.1,cooldown:0});Object.assign(b,{x,z:keeper?home*10:1,fx:0,fz:b.team===0?-1:1});
    Object.assign(s.ball,{owner:b.id,x,y:0.23,z:b.z+b.fz*0.56,lastTouch:b.id});if(seen)s.referee.z=0.4;
    return s;
}
function waitFor(s,predicate,limit=2){for(let i=0;i<limit*120&&!predicate();i++)stepMatch(s,1/120,{});assert.ok(predicate());}

test('AI is more cautious in referee view and never chooses an unrelated distant opponent',()=>{
    let hidden=0,seen=0;for(let seed=1;seed<=300;seed++){hidden+=!!choice(seed,9);seen+=!!choice(seed,9,{seen:true});}
    assert.ok(hidden>80);assert.ok(seen>0);assert.ok(seen<hidden/3);
    const owner={id:4,team:0,x:0,z:1},actor={id:9,team:1,role:'field',x:6,z:1,cooldown:0};
    for(let seed=1;seed<50;seed++)assert.equal(considerCombat(createCombatAI(seed,9),{time:10,actor,opponents:[owner],owner,ball:{x:0,z:0.44,y:0.23},homeGoalZ:-12}),null);
});

test('orange AI independently warns, winds up and actually knocks down the human ball carrier',()=>{
    const s=five();waitFor(s,()=>!!s.players[9].combat.intent);assert.equal(s.players[4].knockdown,null);
    waitFor(s,()=>s.stats[1].knockdowns===1);assert.ok(isKnockedDown(s.players[4].knockdown,s.time));assert.equal(s.players[4].action,null);
    assert.notEqual(s.ball.owner,4);assert.equal(s.stats[0].knockdowns,0);assert.ok(s.players[9].combat.nextAttackAt>s.time+5);
    step(s,3);assert.equal(s.stats[1].knockdowns,1);
});

test('AI teammates and AI-watch blue players also attack rather than giving only orange this ability',()=>{
    for(const [attacker,target,autoBlue] of [[3,9,false],[4,9,true]]){
        const s=five(attacker,target,{autoBlue});waitFor(s,()=>s.stats[0].knockdowns===1);
        assert.ok(isKnockedDown(s.players[target].knockdown,s.time));assert.equal(s.stats[1].knockdowns,0);
    }
});

test('AI goalkeeper can protect its own goal with a near-range knockdown',()=>{
    const s=five(5,4,{keeper:true});waitFor(s,()=>s.stats[1].knockdowns===1);
    assert.ok(isKnockedDown(s.players[4].knockdown,s.time));assert.equal(s.players[5].action.kind,'knockdown');
});

test('the manually controlled blue player never attacks autonomously, and taking over cancels an unfinished AI kick',()=>{
    const manual=five(4,9);step(manual,0.6);assert.equal(manual.stats[0].knockdowns,0);assert.equal(manual.players[4].action,null);
    const s=five(4,9,{autoBlue:true});waitFor(s,()=>s.players[4].action?.source==='ai');assert.equal(s.players[4].action.fired,false);
    s.autoBlue=false;step(s,0.3);assert.equal(s.players[4].action,null);assert.equal(s.stats[0].knockdowns,0);assert.equal(s.players[4].combat.intent,null);
});

test('dodging the AI windup prevents a remote hit, and stunned players get no repeated stun extension',()=>{
    const s=five();waitFor(s,()=>s.players[9].action?.source==='ai');s.players[4].x=4;step(s,0.3);assert.equal(s.stats[1].knockdowns,0);
    const other=five();other.players[4].knockdown=makeKnockdown(other.time);const until=other.players[4].knockdown.downUntil;step(other,1);
    assert.equal(other.stats[1].knockdowns,0);assert.equal(other.players[4].knockdown.downUntil,until);
});

test('visible AI foul is penalized symmetrically and the blue team gets a standing free-kick taker',()=>{
    const s=five(9,4,{seen:true});waitFor(s,()=>s.phase==='foul');assert.equal(s.stats[1].fouls,1);assert.equal(s.freeKick.team,0);
    const remaining=s.remaining;step(s,0.8);assert.equal(s.remaining,remaining);
    while(s.phase==='foul')stepMatch(s,1/120,{});
    assert.equal(s.players[s.ball.owner].team,0);assert.notEqual(s.ball.owner,4);assert.deepEqual(s.scores,[0,0]);
});

test('kickoffs, pauses, penalties and clear shooting chances retain priority over AI combat',()=>{
    const s=five();s.paused=true;step(s,1);assert.equal(s.players[9].combat.intent,null);s.paused=false;s.phase='kickoff';s.phaseTimer=2;step(s,1);assert.equal(s.stats[1].knockdowns,0);
    const penalties=five();beginShootout(penalties);step(penalties,3);assert.equal(penalties.stats[1].knockdowns,0);assert.equal(penalties.players[9].combat.intent,null);
    const shot=five(4,9,{autoBlue:true});Object.assign(shot.players[4],{x:0,z:-8,heldSince:0});Object.assign(shot.players[9],{x:0.7,z:-8});Object.assign(shot.ball,{x:0,z:-8.56,owner:4});
    stepMatch(shot,1/120,{});assert.equal(shot.players[4].action.kind,'shot');assert.equal(shot.players[4].combat.intent,null);
});

function single({keeperOnly=false,seen=false}={}){
    const state=createGameState(),player=character('player'),keeper=character(),defender=character('defender'),referee=character('referee'),ball=new THREE.Group();
    state.keeperLevel=keeperOnly?1:3;state.aiSeed=seedFor(keeperOnly?5:6,{seen,urgent:keeperOnly,aggression:keeperOnly?0.65:1});
    resetDefender({state,defender,elapsedTime:10});player.position.set(0,0,keeperOnly?-6:1);player.userData.facing.set(0,0,-1);
    keeper.position.set(keeperOnly?0.4:4,0,keeperOnly?-6.8:-6);defender.position.set(0,0,0.1);ball.position.set(0,BALL_GROUND_Y,player.position.z-0.56);state.isDribbling=true;
    referee.position.set(seen?0:-6.2,0,seen?-1.6:0);referee.rotation.y=0;
    return {state,player,keeper,defender,referee,ball,time:10};
}
function advanceSingle(c,seconds){
    for(let i=0;i<Math.ceil(seconds*120);i++){
        c.time+=1/120;const ctx={...c,dt:1/120,elapsedTime:c.time,showMessage:()=>{}};
        const busy=updateSingleCombat(ctx);updatePlayer({...ctx,keys:new Set(),getAimDirection:()=>new THREE.Vector3(0,0,-1)});updateBall(ctx);
        if(!busy.defender)updateDefender(ctx);
    }
}

test('single-player hard defender independently hits the player, cancels their shot and disables movement during stun',()=>{
    const c=single();c.state.isChargingKick=true;c.state.chargeStartTime=10;advanceSingle(c,0.55);assert.equal(c.state.isChargingKick,false);assert.equal(c.state.kickAction,null);assert.equal(c.state.aiKnockdowns,1);assert.ok(isKnockedDown(c.state.playerKnockdown,c.time));
    const position=c.player.position.clone();assert.equal(startKickCharge(c.state,c.time),false);
    updatePlayer({...c,dt:0.1,elapsedTime:c.time,keys:new Set(['KeyW']),getAimDirection:()=>new THREE.Vector3(0,0,-1)});assert.ok(c.player.position.equals(position));
    c.time=c.state.playerKnockdown.getUpUntil+0.1;
    updatePlayer({...c,dt:0.1,elapsedTime:c.time,keys:new Set(['KeyW']),getAimDirection:()=>new THREE.Vector3(0,0,-1)});assert.ok(c.player.position.distanceTo(position)>0.1);
    assert.equal(c.state.attemptCount,0);
});

test('single-player keeper also has an independent near-goal attack intention',()=>{
    const c=single({keeperOnly:true});advanceSingle(c,0.55);assert.equal(c.state.aiKnockdowns,1);assert.ok(isKnockedDown(c.state.playerKnockdown,c.time));assert.equal(c.defender.visible,false);
});

test('single-player AI foul restores the player possession and never consumes a player attempt',()=>{
    const c=single({seen:true});advanceSingle(c,0.55);assert.equal(c.state.aiFouls,1);assert.equal(c.state.aiFoulPending,true);
    assert.equal(c.state.attemptCount,0);assert.equal(c.state.pendingRefereeFailure,false);assert.equal(c.state.keeperScore,0);
    advanceSingle(c,1.1);assert.equal(c.state.aiFoulPending,false);assert.equal(c.state.playerKnockdown,null);assert.ok(c.ball.position.distanceTo(c.player.position)<1);
    resetRound({...c,elapsedTime:c.time,showMessage:()=>{}},'reset');assert.equal(c.keeper.userData.aiKick,null);assert.equal(c.defender.userData.aiKick,null);assert.equal(c.state.playerKnockdown,null);
});

test('complete AI matches keep passing and shooting while both teams can occasionally knock down opponents',()=>{
    for(const seed of [3,12345]){
        const s=createMatch({seed,autoBlue:true});startMatch(s);for(let i=0;i<120*420&&s.phase!=='finished';i++)stepMatch(s,1/120,{});
        assert.equal(s.phase,'finished');for(const stats of s.stats){assert.ok(stats.passes>20);assert.ok(stats.shots>2);assert.ok(stats.knockdowns>0&&stats.knockdowns<20);}
    }
});


test('lowering single-player difficulty cancels a pending defender hit',()=>{
    const c=single();for(let i=0;i<120&&!c.defender.userData.aiKick;i++)advanceSingle(c,1/120);
    assert.ok(c.defender.userData.aiKick);assert.equal(c.defender.userData.aiKick.fired,false);
    c.state.keeperLevel=2;syncDefenderDifficulty({...c,elapsedTime:c.time});advanceSingle(c,0.7);
    assert.equal(c.defender.visible,false);assert.equal(c.defender.userData.aiKick,null);assert.equal(c.state.aiKnockdowns,0);
});
