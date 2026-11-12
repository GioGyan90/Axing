import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,stepMatch,HALF_SECONDS,CAGE,VERTICES,attackDirection,confineCircle,insideCage,requestPass,choosePassTarget,beginCharge,releaseShot,beginShootout,resolvePenalty,continueMatch,totalGoals} from '../scripts/five/engine.js';
const advance=(s,t,input={})=>{for(let i=0;i<Math.ceil(t*120);i++)stepMatch(s,1/120,input);};
const playing=()=>{const s=createMatch();s.phase='playing';for(const a of s.players)a.cooldown=0;return s;};
function nextPenalty(s){for(let i=0;i<400&&s.phase==='shootout'&&s.shootout.stage==='result';i++)stepMatch(s,1/120,{});}

test('5v5 roster has exactly one goalkeeper and four field players on both teams',()=>{
    const s=createMatch();assert.equal(s.players.length,10);for(const team of [0,1]){assert.equal(s.players.filter(a=>a.team===team&&a.role==='keeper').length,1);assert.equal(s.players.filter(a=>a.team===team&&a.role==='field').length,4);}
    assert.equal(s.remaining,90);assert.equal(s.phase,'ready');
});

test('both halves last 90 active seconds; kickoff, halftime and pause do not consume play time',()=>{
    const s=createMatch();startMatch(s);while(s.phase==='kickoff')stepMatch(s,1/120,{});assert.equal(s.phase,'playing');assert.equal(s.remaining,HALF_SECONDS);
    s.paused=true;const time=s.time;advance(s,10);assert.equal(s.time,time);assert.equal(s.remaining,90);s.paused=false;
    s.remaining=0.01;advance(s,0.02);assert.equal(s.phase,'halftime');assert.equal(s.half,1);
    continueMatch(s);advance(s,0.01);assert.equal(s.half,2);assert.equal(s.remaining,90);assert.equal(s.phase,'kickoff');assert.equal(attackDirection(s,0),1);
    assert.equal(s.ball.owner,9);assert.ok(s.players[0].z<0);
});

test('all eight cage faces reflect an outward ball, including the chamfered corners',()=>{
    for(let i=0;i<8;i++){
        const a=VERTICES[i],b=VERTICES[(i+1)%8],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=dz/l,nz=-dx/l;
        const ball={x:(a[0]+b[0])/2+nx*0.2,z:(a[1]+b[1])/2+nz*0.2,y:0.23,vx:nx*12,vz:nz*12};
        if(Math.abs(nz)>0.99)ball.x=3.3;
        confineCircle(ball,CAGE.ballRadius,{ball:true});
        assert.ok(insideCage(ball,CAGE.ballRadius),`wall ${i} leaked`);assert.ok(ball.vx*nx+ball.vz*nz<0,`wall ${i} failed to return ball`);
    }
});

test('high shots hit the cage roof and stay in play',()=>{
    const s=playing();Object.assign(s.ball,{owner:null,x:5,y:3,z:4,vx:20,vy:15,vz:9,lockUntil:999});
    for(let i=0;i<120;i++){stepMatch(s,1/120,{});assert.ok(s.ball.y<=CAGE.height-CAGE.ballRadius+1e-6);assert.ok(insideCage(s.ball,CAGE.ballRadius));}
    assert.equal(s.phase,'playing');assert.equal(s.scores[0]+s.scores[1],0);
});

test('pass winds up, releases a real ball once and switches to the receiving field player',()=>{
    const s=playing(),owner=s.players[s.ball.owner];const receiver=choosePassTarget(s,owner,{x:-1,z:-1});
    const targetId=receiver.id;assert.equal(requestPass(s,{x:-1,z:-1}),true);
    advance(s,0.1);assert.equal(s.stats[0].passes,0);assert.equal(s.ball.owner,owner.id);
    advance(s,0.06);assert.equal(s.stats[0].passes,1);assert.ok(Math.hypot(s.ball.vx,s.ball.vz)>5);assert.equal(s.controlledId,targetId);
    advance(s,0.1);assert.equal(s.stats[0].passes,1);
});

test('charge releases one shot and an unowned ball uses a tackle rather than shooting remotely',()=>{
    const s=playing();assert.equal(beginCharge(s),true);advance(s,0.3);assert.equal(releaseShot(s,{x:0,z:-1}),true);
    assert.equal(s.stats[0].shots,0);advance(s,0.16);assert.equal(s.stats[0].shots,1);assert.equal(releaseShot(s,{x:0,z:-1}),false);
    s.ball.owner=9;s.players[4].action=null;s.players[4].cooldown=0;s.controlledId=4;
    assert.equal(beginCharge(s),true);assert.equal(s.players[4].action.kind,'tackle');
});

test('goal mouth scores once before the cage response, with correct direction after switching ends',()=>{
    for(const half of [1,2]){const s=playing();s.half=half;const sign=attackDirection(s,0);
        Object.assign(s.ball,{owner:null,x:0,y:CAGE.ballRadius,z:sign*12.15,vx:0,vy:0,vz:sign*17,lockUntil:999});
        stepMatch(s,1/60,{});assert.deepEqual(s.scores,[1,0]);assert.equal(s.phase,'goal');
        advance(s,1);assert.deepEqual(s.scores,[1,0]);advance(s,1.1);assert.equal(s.ball.owner,9);
    }
});

test('regulation winner finishes, whereas a tied second half enters a fresh shootout',()=>{
    const win=playing();win.half=2;win.scores=[2,1];win.remaining=0.01;advance(win,0.02);assert.equal(win.phase,'finished');assert.equal(win.winner,0);
    const tie=playing();tie.half=2;tie.scores=[2,2];tie.remaining=0.01;advance(tie,0.02);assert.equal(tie.phase,'shootout');assert.deepEqual(tie.shootout.results,[[],[]]);assert.deepEqual(tie.scores,[2,2]);
});

test('shootout completes all five rounds per side, even when one side leads early',()=>{
    const s=createMatch();beginShootout(s);
    for(let attempt=0;attempt<10;attempt++){
        assert.equal(s.phase,'shootout');s.shootout.stage='flight';assert.equal(resolvePenalty(s,attempt%2===0),true);
        if(attempt<9){assert.equal(s.phase,'shootout');nextPenalty(s);}
    }
    assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.deepEqual(s.shootout.results.map(r=>r.length),[5,5]);assert.deepEqual(s.shootout.results.map(totalGoals),[5,0]);
});

test('a tied five-round shootout continues in paired sudden-death rounds',()=>{
    const s=createMatch();beginShootout(s);
    for(let attempt=0;attempt<10;attempt++){s.shootout.stage='flight';resolvePenalty(s,true);nextPenalty(s);}
    assert.equal(s.phase,'shootout');assert.equal(s.shootout.round,6);
    s.shootout.stage='flight';resolvePenalty(s,true);assert.equal(s.phase,'shootout');nextPenalty(s);
    s.shootout.stage='flight';resolvePenalty(s,false);assert.equal(s.phase,'finished');assert.equal(s.winner,0);
    assert.deepEqual(s.shootout.results.map(r=>r.length),[6,6]);assert.equal(resolvePenalty(s,true),false);
});

test('a penalty result remains visible before the next taker steps up',()=>{
    const s=createMatch();beginShootout(s);s.shootout.stage='flight';resolvePenalty(s,true);
    advance(s,1);assert.equal(s.shootout.stage,'result');assert.equal(s.shootout.turn,0);
    advance(s,0.5);assert.equal(s.shootout.stage,'aim');assert.equal(s.shootout.turn,1);
    assert.deepEqual(s.shootout.results,[[true],[]]);
});

test('real penalty flight, save/goal resolution and turn alternation complete without fabricated results',()=>{
    const s=createMatch({autoBlue:true,seed:12345});beginShootout(s);
    for(let i=0;i<120*120&&s.phase!=='finished';i++)stepMatch(s,1/120,{});
    assert.equal(s.phase,'finished');assert.ok(s.shootout.results[0].length>=5);assert.equal(s.shootout.results[0].length,s.shootout.results[1].length);
    assert.ok(s.stats[0].shots>=5);assert.ok(s.stats[1].shots>=5);assert.ok(s.stats[0].saves+s.stats[1].saves>0);
});

test('complete AI match produces passing cooperation for both teams and ends with a winner',()=>{
    const s=createMatch({autoBlue:true,seed:12345});startMatch(s);
    for(let i=0;i<120*420&&s.phase!=='finished';i++)stepMatch(s,1/120,{});
    assert.equal(s.phase,'finished');assert.ok([0,1].includes(s.winner));assert.equal(s.half,2);assert.equal(s.remaining,0);
    for(const stats of s.stats){assert.ok(stats.passes>10);assert.ok(stats.shots>2);assert.ok(stats.saves>0);}
    for(const a of s.players)assert.ok(insideCage(a,CAGE.playerRadius));
    const fresh=createMatch();assert.deepEqual(fresh.scores,[0,0]);assert.equal(fresh.remaining,90);assert.equal(fresh.shootout,null);
});
