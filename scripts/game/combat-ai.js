import {isKnockedDown} from './knockdown.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const random=ai=>{ai.seed=(Math.imul(ai.seed,1664525)+1013904223)>>>0;return ai.seed/4294967296;};
export function createCombatAI(seed,id){return {seed:(seed^Math.imul(id+1,2654435761))>>>0,nextThinkAt:0,nextAttackAt:0,intent:null};}
export function clearCombatIntent(ai){if(ai)ai.intent=null;}
export const hasCombatWarning = actor => !!actor.combat?.intent||actor.action?.kind==='knockdown'&&actor.action.source==='ai'&&!actor.action.fired;
export function considerCombat(ai,{time,actor,opponents,owner,ball,seen=false,homeGoalZ,teamReadyAt=0,protectedUntil=0,preferBall=false,aggression=1}){
    if(time<ai.nextThinkAt)return null;
    ai.nextThinkAt=time+0.45+random(ai)*0.35;
    if(preferBall||time<ai.nextAttackAt||time<teamReadyAt||time<protectedUntil||actor.action||time<actor.cooldown||isKnockedDown(actor.knockdown,time))return null;
    if((ball.y??0.23)>0.85||Math.hypot(ball.vx||0,ball.vz||0)>7.5||!owner)return null;
    const candidates=opponents.filter(b=>!isKnockedDown(b.knockdown,time)&&time>=(b.combatSafeUntil||0)&&distance(actor,b)<1.8).map(target=>{
        const carrier=target.id===owner.id,pressurer=owner.team===actor.team&&distance(target,owner)<1.4;
        const urgent=carrier&&Math.abs(target.z-homeGoalZ)<4;
        if(!carrier&&!pressurer)return null;
        if(actor.role==='keeper'&&(!carrier||Math.abs(actor.z-homeGoalZ)>3.3))return null;
        return {target,urgent,reason:carrier?(urgent?'阻止射门':'抢夺球权'):owner.id===actor.id?'摆脱逼抢':'保护队友',score:(carrier?3:1)+(urgent?2:0)-distance(actor,target)};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    const choice=candidates[0];if(!choice)return null;
    const chance=Math.min(0.8,(choice.target.id===owner.id?0.46:0.26)+(choice.urgent?0.16:0))*aggression*(seen?(choice.urgent?0.5:0.12):1);
    if(random(ai)>=chance)return null;
    ai.intent={targetId:choice.target.id,reason:choice.reason,readyAt:time+0.22,expiresAt:time+1.2};
    return ai.intent;
}
export function consumeCombatAttempt(ai,time){ai.intent=null;ai.nextAttackAt=time+6+random(ai)*3;ai.nextThinkAt=time+0.6;}
