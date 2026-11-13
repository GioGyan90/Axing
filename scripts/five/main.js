import {createMatch,startMatch,stepMatch,requestPass,beginCharge,releaseShot,requestKnockdown,requestSlide,switchPlayer,continueMatch,attackDirection,totalGoals,beginShootout} from './engine.js';
import {createView} from './view.js';
import {goalConfettiFor} from '../game/confetti.js';
import {isKnockedDown} from '../game/knockdown.js';
const $=id=>document.getElementById(id),keys=new Set();
let state=createMatch(),stick={x:0,z:0},aimWorld=null,last=performance.now(),accumulator=0,lastHalf=1;
const view=createView($('pitch'));
const confetti=goalConfettiFor($('goal-confetti'));let lastGoalSerial=0;
const review=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('review');
let reviewFrozen=false,reviewFreezeAt=Infinity,reviewTriggered=false,reviewArmed=false;
if(review)$('review-controls').hidden=false;
function resetReview(){reviewArmed=false;reviewFrozen=false;reviewFreezeAt=Infinity;reviewTriggered=false;}
function text(id,value){if($(id).textContent!==String(value))$(id).textContent=value;}
function input(){
    const a=state.players[state.controlledId];
    const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x;
    const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.z;
    return {moveX:Math.max(-1,Math.min(1,x)),moveZ:Math.max(-1,Math.min(1,z)),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),
        aim:aimWorld?{x:aimWorld.x-a.x,z:aimWorld.z-a.z}:null};
}
function manual(){state.autoBlue=false;const a=state.players[state.controlledId];a.combat.intent=null;if(a.action?.source==='ai'&&!a.action.fired){a.action=null;a.cooldown=state.time;}updateDemoButton();}
function updateDemoButton(){$('demo').setAttribute('aria-pressed',state.autoBlue);text('demo',state.autoBlue?'接管蓝队':'AI 观战');}
function shootDown(){manual();beginCharge(state);}
function shootUp(){releaseShot(state,input().aim);}
function pass(){manual();requestPass(state,input().aim);}
function knock(){if(state.phase!=='playing'||state.paused)return;if(isKnockedDown(state.players[state.controlledId].knockdown,state.time)){state.lastEvent='眩晕中 · Q 可切换队友';return;}manual();if(!requestKnockdown(state))state.lastEvent='靠近未眩晕的对方球员，再按 F 踢人';}
function slide(){if(state.phase!=='playing'||state.paused)return;if(review&&reviewArmed){reviewFrozen=false;reviewArmed=false;}manual();if(!requestSlide(state,input()))state.lastEvent=isKnockedDown(state.players[state.controlledId].knockdown,state.time)?'眩晕中 · Q 可切换队友':'滑铲起身或冷却中，稍后再试';}
function togglePause(){if(!['ready','finished'].includes(state.phase)){state.paused=!state.paused;keys.clear();stick={x:0,z:0};state.charging=false;}}
$('start').onclick=()=>{resetReview();if(state.phase==='ready')startMatch(state);else if(state.phase==='halftime')continueMatch(state);else if(state.phase==='finished'){state=createMatch();lastGoalSerial=0;confetti.clear();startMatch(state);}else state.paused=false;updateDemoButton();};
$('restart').onclick=()=>{resetReview();state=createMatch({autoBlue:state.autoBlue});aimWorld=null;lastGoalSerial=0;confetti.clear();keys.clear();startMatch(state);updateDemoButton();};
$('pause').onclick=togglePause;
$('demo').onclick=()=>{state.autoBlue=!state.autoBlue;state.charging=false;updateDemoButton();};
$('slide').onclick=slide;$('pass').onclick=pass;$('knock').onclick=knock;$('switch').onclick=()=>{manual();switchPlayer(state);};
$('shoot').addEventListener('pointerdown',e=>{e.preventDefault();$('shoot').setPointerCapture(e.pointerId);shootDown();});
$('shoot').addEventListener('pointerup',e=>{e.preventDefault();shootUp();});
$('shoot').addEventListener('pointercancel',()=>{state.charging=false;});
$('penalty-aim').addEventListener('input',e=>{if(state.shootout?.turn===0)state.shootout.aim=Number(e.target.value);});
window.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&!(e.target.id==='penalty-aim'&&['Space','KeyA','KeyD'].includes(e.code)))return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    if(e.repeat)return;keys.add(e.code);
    if(e.code==='Escape'){togglePause();return;}
    if(state.paused||state.phase==='ready'||state.phase==='finished')return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))manual();
    if(e.code==='Space')shootDown();if(e.code==='KeyE')pass();if(e.code==='KeyF')knock();if(e.code==='KeyR')slide();if(e.code==='KeyQ'){manual();switchPlayer(state);}
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')shootUp();});
window.addEventListener('blur',()=>{keys.clear();stick={x:0,z:0};state.charging=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!['ready','finished'].includes(state.phase)){state.paused=true;keys.clear();state.charging=false;}});
view.canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;aimWorld=view.toField(e.clientX,e.clientY);if(state.phase==='shootout'&&state.shootout.turn===0&&state.shootout.stage==='aim')state.shootout.aim=Math.max(-1,Math.min(1,aimWorld.x/2.1));});
let stickId=null;
function moveStick(e){if(e.pointerId!==stickId)return;const r=$('stick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),limit=r.width*0.34;
    stick={x:dx/Math.max(limit,d),z:dy/Math.max(limit,d)};$('thumb').style.transform=`translate(${stick.x*limit}px,${stick.z*limit}px)`;}
$('stick').onpointerdown=e=>{e.preventDefault();manual();stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);moveStick(e);};
$('stick').onpointermove=moveStick;
function endStick(e){if(e.pointerId!==stickId)return;stickId=null;stick={x:0,z:0};$('thumb').style.transform='translate(0,0)';}
$('stick').onpointerup=endStick;$('stick').onpointercancel=endStick;
function penaltyRow(id,results){
    const count=Math.max(5,Math.max(...state.shootout.results.map(r=>r.length))+ (state.shootout.round>5?1:0));
    const signature=results.map(Boolean).join(',')+'|'+count;
    if($(id).dataset.signature===signature)return;$(id).dataset.signature=signature;$(id).replaceChildren();
    for(let i=0;i<count;i++){const li=document.createElement('li');li.className=i<results.length?(results[i]?'hit':'miss'):'';li.textContent=i<results.length?(results[i]?'✓':'×'):'·';li.setAttribute('aria-label',`第 ${i+1} 轮${i<results.length?results[i]?'命中':'未进':'待罚'}`);$(id).append(li);}
}
function updateUI(){
    text('score-blue',state.scores[0]);text('score-orange',state.scores[1]);
    const seconds=Math.max(0,Math.ceil(state.remaining));text('clock',`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
    text('period',state.phase==='shootout'?'点球大战':state.phase==='finished'?'比赛结束':state.half===1?'上半场':'下半场');
    text('passes-blue',state.stats[0].passes);text('passes-orange',state.stats[1].passes);
    const a=state.players[state.controlledId],owner=state.ball.owner==null?null:state.players[state.ball.owner];
    const stunned=state.players.filter(a=>isKnockedDown(a.knockdown,state.time)),down=isKnockedDown(a.knockdown,state.time);
    text('referee-status',state.phase==='foul'?`裁判吹罚 · ${state.freeKick?.team===0?'蓝':'橙'}队任意球`:`场外裁判 · ${stunned.length?`蓝队 ${stunned.filter(a=>a.team===0).length} / 橙队 ${stunned.filter(a=>a.team===1).length} 人眩晕`:'视野内踢人 / 铲人犯规'}`);
    $('slide').disabled=state.phase!=='playing'||state.paused||down||!!a.slide||state.time<a.cooldown;
    $('slide').setAttribute('aria-label',a.slide?'滑铲中':state.time<a.cooldown?'滑铲冷却中':'滑铲 R');
    $('knock').disabled=state.phase!=='playing'||state.paused||down;$('shoot').disabled=down||!!a.slide;$('pass').disabled=down||!!a.slide;
    text('controlled',`蓝队 ${a.number} 号${down?(state.time<a.knockdown.downUntil?` · 眩晕 ${(a.knockdown.downUntil-state.time).toFixed(1)}s`:' · 起身中'):a.slide?' · 滑铲中':a.role==='keeper'?' · 门将':''}`);text('possession',owner?`${owner.team===0?'蓝':'橙'}队 ${owner.number} 号控球`:'争夺自由球');
    text('direction',state.shootout?(state.shootout.turn===0?'点球进攻方向 ↑':'守门：左右移动 + 射门键扑救'):`蓝队进攻方向 ${attackDirection(state,0)<0?'↑':'↓'}`);text('event',state.lastEvent);
    $('power-fill').style.width=state.charge*100+'%';document.querySelector('.power').setAttribute('aria-valuenow',Math.round(state.charge*100));
    text('pause',state.paused?'继续':'暂停');
    $('penalties').hidden=!state.shootout;
    if(state.shootout){const p=state.shootout;penaltyRow('penalty-blue',p.results[0]);penaltyRow('penalty-orange',p.results[1]);
        text('penalty-total-blue',totalGoals(p.results[0]));text('penalty-total-orange',totalGoals(p.results[1]));
        text('penalty-round',p.round<=5?`点球第 ${p.round} 轮 / 5`:`逐轮加罚 · 第 ${p.round} 轮`);
        $('aim-control').hidden=p.turn!==0;$('penalty-aim').value=p.aim;
        text('penalty-instruction',p.turn===0?'蓝队主罚：A/D 或滑条瞄准，按住射门蓄力':'蓝队守门：A/D 或摇杆横移，Space / 射门键扑救');
    }
    const overlay=state.phase==='ready'||state.phase==='halftime'||state.phase==='finished'||state.paused;
    $('screen').hidden=!overlay;$('format').hidden=state.phase!=='ready';
    if(overlay){
        if(state.phase==='ready'){text('screen-title','来一场笼式足球');text('screen-body','蓝队由你控制，队友接应。双方 AI 也会近身踢人，红色 ! 提醒闪避。Space 射门，F 踢人，R 沿移动方向滑铲，可铲球也可铲倒人。');text('screen-detail','球碰笼壁会反弹，不设出界。平局双方各罚 5 轮点球，仍平则逐轮加罚。');text('start','开始比赛');}
        else if(state.phase==='finished'){text('screen-title',state.winner===0?'蓝队获胜！':'橙队获胜');text('screen-body',`常规时间 ${state.scores[0]} : ${state.scores[1]}${state.shootout?` · 点球 ${totalGoals(state.shootout.results[0])} : ${totalGoals(state.shootout.results[1])}`:''}`);text('screen-detail',`蓝队完成 ${state.stats[0].passes} 次传球、${state.stats[0].shots} 次射门。再来一场配合进攻吧。`);text('start','再赛一场');}
        else if(state.paused){text('screen-title','比赛已暂停');text('screen-body','比分、计时和球员位置已保留。');text('screen-detail','R 滑铲 · F 踢人 · E 传球 · Q 切换 · Space 射门 / 抢断。点球守门时左右移动并选择时机扑救。');text('start','继续比赛');}
        else{text('screen-title','中场休息 · 交换场地');text('screen-body',`蓝队 ${state.scores[0]} : ${state.scores[1]} 橙队`);text('screen-detail',`下半场 90 秒，橙队开球。${Math.max(0,Math.ceil(state.phaseTimer))} 秒后继续。`);text('start','下半场开球');}
    }
}
function resize(){view.resize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);resize();
function frame(now){
    const delta=Math.min(0.5,Math.max(0,(now-last)/1000));last=now;
    if(!state.paused&&!reviewFrozen){accumulator+=delta;let steps=0;while(accumulator>=1/60&&steps++<31){
        stepMatch(state,1/60,input());accumulator-=1/60;
        if(review&&$('review-hold').checked){
            if(!reviewTriggered&&(state.stats[0].knockdowns||state.stats[1].knockdowns||state.stats[0].slideBallHits||state.goalSerial)){reviewTriggered=true;reviewFreezeAt=state.time+0.35;}
            if(state.time>=reviewFreezeAt){reviewFrozen=true;accumulator=0;break;}
        }
    }}
    else accumulator=0;
    if(lastHalf!==state.half){aimWorld=null;lastHalf=state.half;}
    if(state.goalSerial>lastGoalSerial)confetti.burst();lastGoalSerial=state.goalSerial;
    view.render(state,Math.min(delta,0.033));confetti.tick(delta,state.paused||reviewFrozen);updateUI();
    if(review)text('review-label',reviewArmed?'场景就绪 · 按 R 开始':reviewFrozen?`已冻结 · 蓝队铲球 ${state.stats[0].slideBallHits} / 铲倒 ${state.stats[0].knockdowns} · 橙队铲球 ${state.stats[1].slideBallHits} / 铲倒 ${state.stats[1].knockdowns}`:'');requestAnimationFrame(frame);
}
if(review){
    function scenario(kind){
        reviewArmed=false;state=createMatch({seed:kind==='ai-foul'?105:kind==='ai'?1:12345});state.phase='playing';state.time=10;reviewFrozen=false;reviewTriggered=false;reviewFreezeAt=Infinity;lastGoalSerial=0;confetti.clear();keys.clear();
        for(const a of state.players){a.x=a.team?5:-5;a.z=6+a.slot;a.cooldown=999;}
        const x=kind==='foul'||kind==='ai-foul'?-7.1:kind==='goal'?4:0,a=state.players[4],victim=state.players[9];
        Object.assign(a,{x,z:kind==='goal'?-7:1,fx:0,fz:-1,cooldown:0});Object.assign(victim,{x,z:0.1,fx:0,fz:1});
        if(kind==='goal')Object.assign(state.players[5],{x:-5,z:8});
        if(kind==='ai'||kind==='ai-foul'){victim.cooldown=0;state.referee.z=0.4;}
        Object.assign(state.ball,{owner:4,x,y:0.23,z:a.z-0.56,lastTouch:4});
        aimWorld=kind==='goal'?{x:100,z:8}:null;state.lastEvent=kind==='goal'?'鼠标在身后 · 按射门检查自动瞄准':kind==='foul'?'靠近场外裁判 · 按 F 检查吹罚':'按 F 踢人 · 检查倒地与眩晕';updateDemoButton();
        if(kind==='ai'||kind==='ai-foul')state.lastEvent='AI 自主决策中 · 无需按踢人键';
    }
    function slideScenario(kind){
        scenario('knock');const a=state.players[4],b=state.players[9],x=kind==='slide-foul'?-7.1:0;
        Object.assign(a,{x,z:2,fx:0,fz:-1});Object.assign(b,{x:kind==='slide-ball'?5:x,z:-0.6,fx:0,fz:1,heldSince:state.time});
        Object.assign(state.ball,{owner:kind==='slide-ball'?null:9,x,y:0.23,z:kind==='slide-ball'?0.4:-0.04,lockUntil:state.time+0.1});
        if(kind==='slide-foul')state.referee.z=0.4;
        reviewFrozen=true;reviewArmed=true;state.lastEvent='按 R 或滑铲按钮 · 真实滑行、触球与铲倒检查';
    }
    $('review-slide').onclick=()=>slideScenario('slide');$('review-slide-ball').onclick=()=>slideScenario('slide-ball');$('review-slide-foul').onclick=()=>slideScenario('slide-foul');
    $('review-ai-slide').onclick=()=>{scenario('ai');state.players[9].combat.seed=(2^Math.imul(10,2654435761))>>>0;state.players[4].z=2.6;state.players[9].z=-0.5;state.ball.z=2.04;state.lastEvent='后卫自主判断滑铲 · 无需按键';};
    $('review-knock').onclick=()=>scenario('knock');$('review-foul').onclick=()=>scenario('foul');$('review-goal').onclick=()=>scenario('goal');
    $('review-ai-warning').onclick=()=>{scenario('ai');for(let i=0;i<240&&!state.players[9].combat.intent;i++)stepMatch(state,1/120,{});reviewFrozen=true;reviewTriggered=true;};
    $('review-ai').onclick=()=>scenario('ai');$('review-ai-foul').onclick=()=>scenario('ai-foul');
    $('review-hold').onchange=()=>{reviewFrozen=false;reviewFreezeAt=Infinity;reviewTriggered=true;};
    $('review-half').onclick=()=>{resetReview();state.paused=false;if(['ready','kickoff','goal'].includes(state.phase))state.phase='playing';state.remaining=0.02;};
    $('review-tie').onclick=()=>{resetReview();state.paused=false;state.phase='playing';state.half=2;state.remaining=0.02;state.scores=[0,0];state.charging=false;};
    $('review-penalty').onclick=()=>{if(!state.shootout||state.phase==='finished')return;state.paused=false;const count=state.shootout.results.flat().length;const old=state.autoBlue;state.autoBlue=true;for(let i=0;i<900&&state.phase!=='finished'&&state.shootout.results.flat().length===count;i++)stepMatch(state,1/120,{});state.autoBlue=old;};
}
requestAnimationFrame(frame);
