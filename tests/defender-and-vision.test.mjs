import test from 'node:test';
import assert from 'node:assert/strict';
import {character, THREE} from './fixtures.mjs';
import {createMaterials, createRefereeVisionFan} from '../scripts/game/assets.js';
import {REFEREE_VISION, DEFENDER_PROFILE, BALL_GROUND_Y, FIELD} from '../scripts/game/config.js';
import {isInRefereeVision} from '../scripts/game/referee-vision.js';
import {createGameState, updatePlayer, updateBall, resetRound} from '../scripts/game/rules.js';
import {kickDownKeeper} from '../scripts/game/kicking.js';
import {resetDefender, syncDefenderDifficulty, updateDefender} from '../scripts/game/defender.js';

function setup(level = 3) {
    const state = createGameState(), player = character('player'), defender = character('defender'), ball = new THREE.Group();
    state.keeperLevel = level;
    player.position.set(0, 0, 3.85); player.rotation.y = Math.PI;
    ball.position.set(0, BALL_GROUND_Y, 2.65);
    resetDefender({state, defender, elapsedTime: 10});
    return {state, player, defender, ball};
}
const aim = () => new THREE.Vector3(0, 0, -1);

test('referee visible sector and actual detection share a 2.5-unit radius', () => {
    const referee = character('referee'), fan = createRefereeVisionFan(createMaterials());
    assert.equal(REFEREE_VISION.radius, 7.5 / 3);
    assert.equal(fan.userData.radius, REFEREE_VISION.radius);
    const positions = fan.geometry.attributes.position;
    let max = 0;
    for(let i=0;i<positions.count;i++) max = Math.max(max, Math.hypot(positions.getX(i),positions.getY(i)));
    assert.ok(Math.abs(max-2.5)<1e-6);
    assert.equal(isInRefereeVision(new THREE.Vector3(0,0,2.5),referee),true);
    assert.equal(isInRefereeVision(new THREE.Vector3(0,0,2.51),referee),false);
    assert.equal(isInRefereeVision(new THREE.Vector3(0,0,-1),referee),false);
    referee.rotation.y = Math.PI / 2;
    assert.equal(isInRefereeVision(new THREE.Vector3(2,0,0),referee),true);
});

for(const [distance,foul] of [[2,true],[3,false]]) test(`actual kick foul at referee distance ${distance}: ${foul}`, () => {
    const state=createGameState(), player=character('player'), keeper=character(), referee=character('referee');
    player.position.set(0,0,distance);keeper.position.set(0.4,0,distance);
    assert.equal(kickDownKeeper({state,player,keeper,referee,elapsedTime:10,showMessage:()=>{}},0.5),true);
    assert.equal(state.pendingRefereeFailure,foul);
});

for(const level of [1,2]) test(`difficulty ${level} has no active defender`, () => {
    const c=setup(level), before=c.defender.position.clone();let steals=0;
    for(let i=0;i<180;i++) updateDefender({...c,dt:1/60,elapsedTime:10+i/60,onSteal:()=>steals++});
    assert.equal(c.defender.visible,false);assert.ok(c.defender.position.equals(before));assert.equal(steals,0);
});

test('hard mode starts one defender with a grace period and disabling cancels a tackle', () => {
    const c=setup();const before=c.defender.position.clone();
    updateDefender({...c,dt:1/60,elapsedTime:10.8});
    assert.equal(c.defender.visible,true);assert.ok(c.defender.position.equals(before));
    c.defender.userData.defense.tackle={started:10};c.state.keeperLevel=2;
    syncDefenderDifficulty({...c,elapsedTime:12});
    assert.equal(c.defender.visible,false);assert.equal(c.defender.userData.defense.tackle,null);
    c.state.keeperLevel=3;syncDefenderDifficulty({...c,elapsedTime:20});
    assert.equal(c.defender.visible,true);assert.equal(c.defender.userData.defense.readyAt,20+DEFENDER_PROFILE.gracePeriod);
});

for(const fps of [30,60]) test(`hard defender pursues, physically tackles once and leaves the ball recoverable at ${fps} fps`, () => {
    const c=setup();let steals=0;
    for(let i=0;i<fps*2.4;i++) {
        const dt=1/fps,elapsedTime=10+i*dt;
        updatePlayer({...c,dt,elapsedTime,keys:new Set(),getAimDirection:aim});
        updateBall({...c,dt});const before=c.ball.position.clone();
        updateDefender({...c,dt,elapsedTime,onSteal:()=>{
            steals++;
            assert.ok(c.ball.position.equals(before),'no teleport on tackle');
            assert.ok(c.state.ballVelocity.length()>4);
            assert.equal(c.state.isDribbling,false);
            assert.ok(c.state.dribbleBreakUntil>elapsedTime);
        }});
        assert.equal(c.state.attemptCount,0);
        assert.ok(Math.abs(c.defender.position.x)<=FIELD.width/2-0.6+1e-9);
        assert.ok(c.defender.position.distanceTo(c.player.position)>=0.649);
    }
    assert.equal(steals,1);
    assert.ok(c.defender.position.distanceTo(c.player.position)<3);
    c.state.ballVelocity.set(0,0,0);
    c.player.position.copy(c.ball.position).setY(0).add(new THREE.Vector3(0,0,0.48));
    updatePlayer({...c,dt:1/60,elapsedTime:14,keys:new Set(),getAimDirection:aim});
    assert.equal(c.state.isDribbling,true,'player can win the ball back');
});

test('a high ball and an evaded tackle never trigger a remote steal', () => {
    const c=setup();c.ball.position.y=2;
    let steals=0;
    for(let i=0;i<180;i++) updateDefender({...c,dt:1/60,elapsedTime:10+i/60,onSteal:()=>steals++});
    assert.equal(steals,0);
    c.ball.position.y=BALL_GROUND_Y;
    for(let i=0;i<60&&!c.defender.userData.defense.tackle;i++) updateDefender({...c,dt:1/60,elapsedTime:14+i/60});
    assert.ok(c.defender.userData.defense.tackle);
    c.ball.position.set(-4,BALL_GROUND_Y,6);c.state.previousBallPosition=c.ball.position.clone();
    for(let i=0;i<50;i++) updateDefender({...c,dt:1/60,elapsedTime:15+i/60,onSteal:()=>steals++});
    assert.equal(steals,0);
});

test('reset and end-of-round flags stop the defender and clear future tackle contacts', () => {
    for(const flag of ['gameOver','isResetting','pendingRefereeFailure','pendingSaveNotification']) {
        const c=setup();c.state[flag]=true;c.defender.userData.defense.tackle={started:10};
        const before=c.defender.position.clone();
        updateDefender({...c,dt:1/60,elapsedTime:12,onSteal:()=>assert.fail('frozen tackle fired')});
        assert.ok(c.defender.position.equals(before));assert.equal(c.defender.userData.defense.tackle,null);
    }
    const c=setup(),keeper=character();c.defender.position.set(4,0,4);
    resetRound({...c,keeper,elapsedTime:25,showMessage:()=>{}},'reset');
    assert.equal(c.defender.position.x,DEFENDER_PROFILE.spawnX);
    assert.equal(c.defender.position.z,DEFENDER_PROFILE.spawnZ);
    assert.equal(c.defender.userData.defense.readyAt,25+DEFENDER_PROFILE.gracePeriod);
    assert.equal(c.defender.userData.defense.tackle,null);
});
