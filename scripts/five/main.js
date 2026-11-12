import {createMatch,startMatch,stepMatch,requestPass,beginCharge,releaseShot,switchPlayer,continueMatch,attackDirection,totalGoals,beginShootout} from './engine.js';
import {createView} from './view.js';
const $=id=>document.getElementById(id),keys=new Set();
let state=createMatch(),stick={x:0,z:0},aimWorld=null,last=performance.now(),accumulator=0,lastHalf=1;
const view=createView($('pitch'));
const review=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('review');
if(review)$('review-controls').hidden=false;
function text(id,value){if($(id).textContent!==String(value))$(id).textContent=value;}
function input(){
    const a=state.players[state.controlledId];
    const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x;
    const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.z;
    return {moveX:Math.max(-1,Math.min(1,x)),moveZ:Math.max(-1,Math.min(1,z)),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),
        aim:aimWorld?{x:aimWorld.x-a.x,z:aimWorld.z-a.z}:null};
}
function manual(){state.autoBlue=false;updateDemoButton();}
function updateDemoButton(){$('demo').setAttribute('aria-pressed',state.autoBlue);text('demo',state.autoBlue?'接管蓝队':'AI 观战');}
function shootDown(){manual();beginCharge(state);}
function shootUp(){releaseShot(state,input().aim);}
function pass(){manual();requestPass(state,input().aim);}
function togglePause(){if(!['ready','finished'].includes(state.phase)){state.paused=!state.paused;keys.clear();stick={x:0,z:0};state.charging=false;}}
$('start').onclick=()=>{if(state.phase==='ready')startMatch(state);else if(state.phase==='halftime')continueMatch(state);else if(state.phase==='finished'){state=createMatch();startMatch(state);}else state.paused=false;updateDemoButton();};
$('restart').onclick=()=>{state=createMatch({autoBlue:state.autoBlue});aimWorld=null;keys.clear();startMatch(state);};
$('pause').onclick=togglePause;
$('demo').onclick=()=>{state.autoBlue=!state.autoBlue;state.charging=false;updateDemoButton();};
$('pass').onclick=pass;$('switch').onclick=()=>{manual();switchPlayer(state);};
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
    if(e.code==='Space')shootDown();if(e.code==='KeyE')pass();if(e.code==='KeyQ'){manual();switchPlayer(state);}
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
    text('controlled',`蓝队 ${a.number} 号${a.role==='keeper'?' · 门将':''}`);text('possession',owner?`${owner.team===0?'蓝':'橙'}队 ${owner.number} 号控球`:'争夺自由球');
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
        if(state.phase==='ready'){text('screen-title','来一场笼式足球');text('screen-body','蓝队由你控制，队友跑位接应。双方各 1 名门将、4 名球员，八角笼内连续对抗。');text('screen-detail','球碰笼壁会反弹，不设出界。平局双方各罚 5 轮点球，仍平则逐轮加罚。');text('start','开始比赛');}
        else if(state.phase==='finished'){text('screen-title',state.winner===0?'蓝队获胜！':'橙队获胜');text('screen-body',`常规时间 ${state.scores[0]} : ${state.scores[1]}${state.shootout?` · 点球 ${totalGoals(state.shootout.results[0])} : ${totalGoals(state.shootout.results[1])}`:''}`);text('screen-detail',`蓝队完成 ${state.stats[0].passes} 次传球、${state.stats[0].shots} 次射门。再来一场配合进攻吧。`);text('start','再赛一场');}
        else if(state.paused){text('screen-title','比赛已暂停');text('screen-body','比分、计时和球员位置已保留。');text('screen-detail','E 传球 · Q 切换 · Space 射门 / 抢断。点球守门时左右移动并选择时机扑救。');text('start','继续比赛');}
        else{text('screen-title','中场休息 · 交换场地');text('screen-body',`蓝队 ${state.scores[0]} : ${state.scores[1]} 橙队`);text('screen-detail',`下半场 90 秒，橙队开球。${Math.max(0,Math.ceil(state.phaseTimer))} 秒后继续。`);text('start','下半场开球');}
    }
}
function resize(){view.resize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);resize();
function frame(now){
    const delta=Math.min(0.5,Math.max(0,(now-last)/1000));last=now;
    if(!state.paused){accumulator+=delta;let steps=0;while(accumulator>=1/60&&steps++<31){stepMatch(state,1/60,input());accumulator-=1/60;}}
    else accumulator=0;
    if(lastHalf!==state.half){aimWorld=null;lastHalf=state.half;}
    view.render(state,Math.min(delta,0.033));updateUI();requestAnimationFrame(frame);
}
if(review){
    $('review-half').onclick=()=>{state.paused=false;if(['ready','kickoff','goal'].includes(state.phase))state.phase='playing';state.remaining=0.02;};
    $('review-tie').onclick=()=>{state.paused=false;state.phase='playing';state.half=2;state.remaining=0.02;state.scores=[0,0];state.charging=false;};
    $('review-penalty').onclick=()=>{if(!state.shootout||state.phase==='finished')return;state.paused=false;const count=state.shootout.results.flat().length;const old=state.autoBlue;state.autoBlue=true;for(let i=0;i<900&&state.phase!=='finished'&&state.shootout.results.flat().length===count;i++)stepMatch(state,1/120,{});state.autoBlue=old;};
}
requestAnimationFrame(frame);
