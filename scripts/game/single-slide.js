import {FIELD,BALL_RADIUS} from './config.js';
import {SLIDE,createSlide,advanceSlide,slideContact} from './slide-tackle.js';
import {makeKnockdown,isKnockedDown} from './knockdown.js';
import {clearCombatIntent} from './combat-ai.js';
import {isInRefereeVision} from './referee-vision.js';
import {updatePlayerAnimation} from './player-animation.js';

export function requestSingleSlide({state,player,keys=new Set(),elapsedTime:time}){
    if(state.gameOver||state.isResetting||state.pendingRefereeFailure||state.pendingSaveNotification||time<state.aiFoulUntil
        ||state.kickAction||player.userData.slide||time<(state.slideCooldownUntil||0)||isKnockedDown(state.playerKnockdown,time))return false;
    const velocity={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),
        z:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)};
    player.userData.slide=createSlide(time,velocity,player.userData.facing);
    state.playerSlideActive=true;state.slideCooldownUntil=time+SLIDE.cooldown;state.isChargingKick=false;state.chargePower=0;state.isDribbling=false;state.isSprinting=false;
    state.dribbleBreakUntil=time+SLIDE.duration+0.2;return true;
}
export function startSingleAISlide({state,actor,elapsedTime:time,direction}){
    actor.userData.slide=createSlide(time,direction,actor.userData.facing,'ai');actor.userData.aiCooldown=time+SLIDE.cooldown;
    clearCombatIntent(actor.userData.combat);actor.userData.aiKick=null;
    if(actor.userData.defense)actor.userData.defense.tackle=null;
    state.combatNextTeamAttackAt=time+3.2;
}
export function updateSingleSlide({dt,actor,elapsedTime}){
    const slide=actor.userData.slide;if(!slide)return false;
    const before={x:actor.position.x,z:actor.position.z};
    const finished=advanceSlide(slide,dt,before,actor.position,p=>{
        p.x=Math.max(-FIELD.width/2+0.6,Math.min(FIELD.width/2-0.6,p.x));
        p.z=Math.max(-FIELD.depth/2+0.6,Math.min(FIELD.depth/2-0.7,p.z));
    });
    actor.userData.facing.set(slide.dx,0,slide.dz);actor.rotation.y=Math.atan2(slide.dx,slide.dz);
    actor.userData.velocity.set((actor.position.x-before.x)/dt,0,(actor.position.z-before.z)/dt);
    updatePlayerAnimation(actor,{dt,elapsedTime,movement:actor.userData.velocity,sliding:true,slideTime:slide.age});
    if(finished)actor.userData.slide=null;
    return true;
}
export function captureSlidePositions({player,keeper,defender,ball}){
    return {players:new Map([player,keeper,defender].filter(Boolean).map(a=>[a,{x:a.position.x,z:a.position.z}])),ball:{...ball.position}};
}
function stopSlides(actors){for(const a of actors){if(!a)continue;a.userData.slide=null;clearCombatIntent(a.userData.combat);a.userData.aiKick=null;}}
export function resolveSingleSlides({state,player,keeper,defender,referee,ball,elapsedTime:time,previous,showMessage=()=>{},onHit=()=>{}}){
    if(state.gameOver||state.isResetting||state.pendingRefereeFailure||time<state.aiFoulUntil)return;
    const actors=[player,keeper,defender].filter(a=>a&&a.visible!==false);
    for(const actor of actors){
        const slide=actor.userData.slide;if(!slide?.sweep)continue;
        if(!slide.hitBall&&slideContact(slide,previous.ball,ball.position,BALL_RADIUS,{maxHeight:SLIDE.maxBallHeight})){
            slide.hitBall=true;state.ballVelocity.set(slide.dx*8,0.8,slide.dz*8);state.isDribbling=false;state.dribbleBreakUntil=time+0.7;
            showMessage(actor===player?'滑铲触球！':'后卫滑铲解围！');
        }
        const opponents=actor===player?actors.filter(a=>a!==player):[player];
        for(const target of opponents){
            const down=target===player?state.playerKnockdown:target.userData.knockdown;
            if(slide.hitPlayers.includes(target)||isKnockedDown(down,time)||target===player&&time<state.combatProtectedUntil)continue;
            if(!slideContact(slide,previous.players.get(target)||target.position,target.position,0.34))continue;
            slide.hitPlayers.push(target);const status=makeKnockdown(time,0.45);
            target.userData.slide=null;target.userData.aiKick=null;target.userData.velocity.set(0,0,0);target.userData.hitFlashUntil=time+0.25;clearCombatIntent(target.userData.combat);onHit(0.45);
            if(target===player){
                state.playerKnockdown=status;state.combatProtectedUntil=status.getUpUntil+1.2;state.aiKnockdowns++;
                state.isChargingKick=false;state.chargePower=0;state.kickAction=null;state.kickPoseTimer=0;state.isDribbling=false;state.isSprinting=false;state.dribbleBreakUntil=status.getUpUntil;
            }else{
                target.userData.knockdown=status;
                if(target===keeper){state.keeperState='knocked';state.keeperMode='knocked';state.keeperDownUntil=status.downUntil;state.keeperGetUpUntil=status.getUpUntil;state.keeperSave=null;state.pendingSaveNotification=false;}
                if(target.userData.defense){target.userData.defense.tackle=null;target.userData.defense.readyAt=status.getUpUntil;target.userData.defense.nextTackleAt=status.getUpUntil+0.2;}
            }
            showMessage(target===player?'你被滑铲放倒 · 眩晕 3.9 秒':`${target===keeper?'门将':'后卫'}被铲倒 · 眩晕 3.9 秒`);
            if(referee&&isInRefereeVision(actor.position,referee)){
                if(actor===player){state.pendingRefereeFailure=true;state.refereeWarningUntil=time+1;state.refereeWarningMessage='裁判吹罚铲人犯规，本次进攻无效';showMessage(state.refereeWarningMessage);}
                else{state.aiFouls++;state.aiFoulUntil=time+1;state.aiFoulPending=true;showMessage('裁判吹罚对方铲人 · 球权归你');}
                state.ballVelocity.set(0,0,0);stopSlides(actors);return;
            }
        }
    }
}
