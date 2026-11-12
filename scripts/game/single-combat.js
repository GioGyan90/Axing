import * as THREE from 'three';
import {FIELD,BALL_GROUND_Y} from './config.js';
import {KNOCKDOWN,makeKnockdown,isKnockedDown} from './knockdown.js';
import {createCombatAI,considerCombat,consumeCombatAttempt,clearCombatIntent} from './combat-ai.js';
import {isInRefereeVision} from './referee-vision.js';
import {updatePlayerAnimation} from './player-animation.js';
const flat=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function cancel(character){if(!character)return;clearCombatIntent(character.userData.combat);character.userData.aiKick=null;}
export function updateSingleCombat({dt,state,player,keeper,defender,referee,ball,elapsedTime:time,showMessage=()=>{},onHit=()=>{}}){
    const busy={keeper:false,defender:false,foul:false};
    if(state.gameOver||state.isResetting||state.pendingRefereeFailure||state.pendingSaveNotification){cancel(keeper);cancel(defender);return busy;}
    if(time<state.aiFoulUntil){state.ballVelocity.set(0,0,0);return {keeper:true,defender:true,foul:true};}
    if(state.aiFoulPending){
        state.aiFoulPending=false;state.playerKnockdown=null;state.combatProtectedUntil=time+1.5;
        ball.position.copy(player.position).addScaledVector(player.userData.facing,0.65);ball.position.y=BALL_GROUND_Y;state.ballVelocity.set(0,0,0);
        state.dribbleBreakUntil=time+0.2;showMessage('裁判吹罚对方踢人 · 你继续进攻');
    }
    const victim={id:0,team:0,role:'field',x:player.position.x,z:player.position.z,knockdown:state.playerKnockdown,combatSafeUntil:state.combatProtectedUntil};
    const owned=flat(player.position,ball.position)<0.95&&Math.hypot(state.ballVelocity.x,state.ballVelocity.z)<7.5;
    const owner=state.isDribbling||owned?victim:null;
    for(const [name,character,id] of [['keeper',keeper,5],['defender',defender,6]]){
        if(!character||character.visible===false||name==='defender'&&state.keeperLevel!==3){cancel(character);continue;}
        if(isKnockedDown(character.userData.knockdown,time)||name==='keeper'&&time<state.keeperGetUpUntil){cancel(character);continue;}
        const ai=character.userData.combat??=createCombatAI(state.aiSeed,id);
        const otherAction=name==='keeper'?state.keeperSave:character.userData.defense?.tackle;
        const actor={id,team:1,role:name==='keeper'?'keeper':'field',x:character.position.x,z:character.position.z,action:otherAction,
            cooldown:character.userData.aiCooldown||0,knockdown:character.userData.knockdown};
        let action=character.userData.aiKick;
        if(!action&&!ai.intent){
            const intent=considerCombat(ai,{time,actor,opponents:[victim],owner,ball:{...ball.position,vx:state.ballVelocity.x,vz:state.ballVelocity.z},
                seen:!!referee&&isInRefereeVision(character.position,referee),homeGoalZ:FIELD.goalZ,teamReadyAt:state.combatNextTeamAttackAt,
                protectedUntil:state.combatProtectedUntil,aggression:state.keeperLevel===1?0.65:1});
            if(intent)showMessage(`${name==='keeper'?'门将':'后卫'}准备踢人 · 快闪开！`);
        }
        if(ai.intent&&!action){
            if(!owner||time>ai.intent.expiresAt||flat(character.position,player.position)>2.1||isKnockedDown(state.playerKnockdown,time)||time<state.combatNextTeamAttackAt){clearCombatIntent(ai);continue;}
            busy[name]=true;
            const before=character.position.clone(),direction=player.position.clone().sub(character.position).setY(0),length=direction.length();
            if(length>0.001){direction.divideScalar(length);character.userData.facing.copy(direction);character.rotation.y=Math.atan2(direction.x,direction.z);}
            if(length>KNOCKDOWN.range*0.94)character.position.addScaledVector(direction,Math.min(length-0.96,(name==='keeper'?3.6:4.6)*dt));
            character.position.x=THREE.MathUtils.clamp(character.position.x,-FIELD.width/2+0.6,FIELD.width/2-0.6);
            character.position.z=THREE.MathUtils.clamp(character.position.z,FIELD.goalZ+0.4,FIELD.depth/2-0.7);
            character.userData.velocity.copy(character.position).sub(before).divideScalar(Math.max(dt,0.001));
            updatePlayerAnimation(character,{dt,elapsedTime:time,movement:character.userData.velocity});
            if(time>=ai.intent.readyAt&&flat(character.position,player.position)<=KNOCKDOWN.range){
                action=character.userData.aiKick={started:time,fired:false};consumeCombatAttempt(ai,time);state.combatNextTeamAttackAt=time+3.2;
                if(name==='keeper')state.keeperSave=null;else if(character.userData.defense)character.userData.defense.tackle=null;
            }
        }
        if(!action)continue;
        busy[name]=true;const age=time-action.started;character.userData.velocity.set(0,0,0);
        updatePlayerAnimation(character,{dt,elapsedTime:time,kicking:true,kickTime:0.3+age/0.64,movement:character.userData.velocity});
        if(!action.fired&&age>=0.14){
            action.fired=true;
            if(flat(character.position,player.position)<=KNOCKDOWN.range&&!isKnockedDown(state.playerKnockdown,time)&&time>=state.combatProtectedUntil){
                state.playerKnockdown=makeKnockdown(time,0.45);state.combatProtectedUntil=state.playerKnockdown.getUpUntil+1.2;
                state.isChargingKick=false;state.chargePower=0;state.kickAction=null;state.kickPoseTimer=0;state.isDribbling=false;state.isSprinting=false;state.dribbleBreakUntil=state.playerKnockdown.getUpUntil;
                player.userData.hitFlashUntil=time+0.25;state.aiKnockdowns++;onHit(0.45);
                if(flat(player.position,ball.position)<1.2)state.ballVelocity.copy(player.position).sub(character.position).setY(0).normalize().multiplyScalar(2.4).setY(0.75);
                if(referee&&isInRefereeVision(character.position,referee)){
                    state.aiFouls++;state.aiFoulUntil=time+1;state.aiFoulPending=true;state.ballVelocity.set(0,0,0);cancel(keeper);cancel(defender);
                    showMessage('裁判吹罚对方踢人 · 球权归你');return {keeper:true,defender:true,foul:true};
                }
                showMessage(`你被${name==='keeper'?'门将':'后卫'}踢倒了 · 眩晕 3.9 秒`);
            }
        }
        if(age>=0.64)character.userData.aiKick=null;
    }
    return busy;
}
