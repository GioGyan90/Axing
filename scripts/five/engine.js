// Renderer-independent match simulation. Metres, seconds; both renderers use
// these exact players, ball, clock, contacts and shootout results.
export const CAGE = Object.freeze({halfWidth:8,halfLength:12,cut:2.6,height:3.2,goalHalf:2.1,goalHeight:2,ballRadius:0.23,playerRadius:0.38});
export const HALF_SECONDS = 90;
export const VERTICES = Object.freeze([
    [-5.4,-12],[5.4,-12],[8,-9.4],[8,9.4],[5.4,12],[-5.4,12],[-8,9.4],[-8,-9.4],
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const norm=(x,z)=>{const d=Math.hypot(x,z)||1;return {x:x/d,z:z/d};};
const rand=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
export const attackDirection=(s,team)=>(team===0?-1:1)*(s.half===1?1:-1);
export const totalGoals=results=>results.filter(Boolean).length;
const teamPlayers=(s,team)=>s.players.filter(a=>a.team===team);
export const controlledPlayer=s=>s.players[s.controlledId];

export function createMatch({seed=12345,autoBlue=false}={}) {
    const s={seed,autoBlue,time:0,half:1,remaining:HALF_SECONDS,phase:'ready',phaseTimer:0,scores:[0,0],winner:null,
        players:[],controlledId:4,ball:{x:0,y:CAGE.ballRadius,z:0,vx:0,vy:0,vz:0,owner:null,lastTouch:null,lockUntil:0,kicker:null},
        charging:false,charge:0,chargeStart:0,shootout:null,events:[],serial:0,lastEvent:'准备开赛',
        stats:[{passes:0,shots:0,tackles:0,saves:0},{passes:0,shots:0,tackles:0,saves:0}],paused:false};
    for(let team=0;team<2;team++) for(let slot=0;slot<5;slot++) s.players.push({id:team*5+slot,team,slot,number:slot+1,
        role:slot===0?'keeper':'field',x:0,z:0,vx:0,vz:0,fx:0,fz:team===0?-1:1,cooldown:0,action:null,dive:null,heldSince:0});
    placeKickoff(s,0);s.phase='ready';return s;
}
function emit(s,text){s.lastEvent=text;s.events.push({id:++s.serial,time:s.time,text});if(s.events.length>40)s.events.shift();}
export function startMatch(s){if(s.phase!=='ready')return false;s.phase='kickoff';s.phaseTimer=1.4;emit(s,'蓝队开球');return true;}
function stopActions(s){s.charging=false;s.charge=0;for(const a of s.players){a.action=null;a.dive=null;a.vx=a.vz=0;}}
function placeKickoff(s,team){
    stopActions(s);
    const slots=[[0,10.8],[-3.5,5],[3.5,4.4],[-2.5,0.8],[2.3,1.1]];
    for(const a of s.players){const d=attackDirection(s,a.team);a.x=slots[a.slot][0];a.z=-d*slots[a.slot][1];a.fx=0;a.fz=d;a.cooldown=s.time+0.6;}
    const carrier=s.players[team*5+4],d=attackDirection(s,team);carrier.x=0;carrier.z=-d*0.58;
    const opponent=s.players[(1-team)*5+4];opponent.x=2.3;opponent.z=-attackDirection(s,1-team)*2.5;
    s.controlledId=team===0?carrier.id:3;
    Object.assign(s.ball,{x:0,y:CAGE.ballRadius,z:0,vx:0,vy:0,vz:0,owner:carrier.id,lastTouch:carrier.id,lockUntil:s.time+0.5,kicker:null});
    carrier.heldSince=s.time;s.kickoffTeam=team;
}
function goalOpening(b){return Math.abs(b.x)<CAGE.goalHalf-CAGE.ballRadius && b.y<CAGE.goalHeight-CAGE.ballRadius;}
export function confineCircle(body,radius,{ball=false}={}){
    for(let round=0;round<4;round++) for(let i=0;i<VERTICES.length;i++){
        const a=VERTICES[i],b=VERTICES[(i+1)%8],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
        if(ball && Math.abs(nz)>0.999 && goalOpening(body))continue;
        const excess=nx*body.x+nz*body.z-(nx*a[0]+nz*a[1]-radius);
        if(excess>0){body.x-=nx*(excess+1e-7);body.z-=nz*(excess+1e-7);if(ball){const v=body.vx*nx+body.vz*nz;if(v>0){body.vx-=1.82*v*nx;body.vz-=1.82*v*nz;}}}
    }
    return body;
}
export function insideCage(point,radius=0){return VERTICES.every((a,i)=>{const b=VERTICES[(i+1)%8],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);return (dz*(point.x-a[0])-dx*(point.z-a[1]))/l<=-radius+1e-5;});}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function choosePassTarget(s,actor,aim){
    const d=aim||{x:0,z:attackDirection(s,actor.team)};
    return teamPlayers(s,actor.team).filter(a=>a.id!==actor.id).map(a=>{
        const distance=dist(a,actor),v=norm(a.x-actor.x,a.z-actor.z),alignment=v.x*d.x+v.z*d.z;
        const lane=Math.min(...s.players.filter(b=>b.team!==actor.team).map(b=>distanceToSegment(b,actor,a)));
        const score=alignment*3+Math.min(2,lane)-Math.abs(distance-5)*0.12+(a.role==='keeper'?-1:0);
        return {a,score};
    }).sort((a,b)=>b.score-a.score)[0]?.a;
}
function queueAction(s,a,kind,target,power=0.65){
    if(a.action||s.time<a.cooldown)return false;
    a.action={kind,target:{...target},power,age:0,fired:false};a.cooldown=s.time+(kind==='tackle'?1.15:0.7);
    const direction=norm(target.x-a.x,target.z-a.z);a.fx=direction.x;a.fz=direction.z;return true;
}
export function requestPass(s,aim){
    if(s.phase!=='playing'||s.ball.owner==null)return false;
    const a=s.players[s.ball.owner];if(a.team!==0)return false;
    const target=choosePassTarget(s,a,aim);if(!target)return false;
    s.charging=false;return queueAction(s,a,'pass',{x:target.x+target.vx*0.22,z:target.z+target.vz*0.22,id:target.id});
}
export function beginCharge(s){
    if(s.phase==='shootout'){if(s.shootout.stage==='aim'&&s.shootout.turn===0){s.charging=true;s.chargeStart=s.time;return true;}return requestDive(s);}
    if(s.phase!=='playing')return false;
    const a=controlledPlayer(s);
    if(s.ball.owner!==a.id){return queueAction(s,a,'tackle',{x:s.ball.x,z:s.ball.z});}
    if(a.action)return false;s.charging=true;s.chargeStart=s.time;s.charge=0.18;return true;
}
export function releaseShot(s,aim){
    if(!s.charging)return false;
    const power=clamp((s.time-s.chargeStart)/0.65,0.18,1);s.charging=false;s.charge=0;
    if(s.phase==='shootout'&&s.shootout.turn===0&&s.shootout.stage==='aim')return takePenalty(s,s.shootout.aim,power);
    if(s.phase!=='playing')return false;
    const a=controlledPlayer(s);if(s.ball.owner!==a.id)return false;
    const direction=aim||{x:-a.x,z:attackDirection(s,0)*CAGE.halfLength-a.z},d=norm(direction.x,direction.z);
    return queueAction(s,a,'shot',{x:a.x+d.x*20,z:a.z+d.z*20},power);
}
export function switchPlayer(s){
    if(s.phase!=='playing')return false;
    const candidates=s.players.filter(a=>a.team===0&&a.role==='field').sort((a,b)=>dist(a,s.ball)-dist(b,s.ball));
    s.controlledId=(candidates[0].id===s.controlledId?candidates[1]:candidates[0]).id;return true;
}
function takePossession(s,a){
    s.ball.owner=a.id;s.ball.lastTouch=a.id;s.ball.kicker=null;a.heldSince=s.time;
    if(a.team===0&&a.role==='field')s.controlledId=a.id;
}
function kick(s,a,action){
    if(action.kind==='tackle'){
        if(s.time<s.ball.lockUntil)return;
        const boot={x:a.x+a.fx*0.55,z:a.z+a.fz*0.55};
        const victim=s.ball.owner==null?null:s.players[s.ball.owner];
        if(s.ball.y<0.65&&dist(boot,s.ball)<0.61&&(!victim||victim.team!==a.team)){
            takePossession(s,a);s.ball.lockUntil=s.time+0.6;s.stats[a.team].tackles++;emit(s,`${a.team===0?'蓝':'橙'}队 ${a.number} 号抢断`);
        }return;
    }
    if(s.ball.owner!==a.id)return;
    const d=norm(action.target.x-s.ball.x,action.target.z-s.ball.z),speed=action.kind==='pass'?10.5:12+action.power*6;
    Object.assign(s.ball,{owner:null,vx:d.x*speed,vz:d.z*speed,vy:action.kind==='pass'?0.65:0.9+action.power*1.2,lastTouch:a.id,kicker:a.id,lockUntil:s.time+0.14});
    if(action.kind==='pass'){
        s.stats[a.team].passes++;s.passTargetId=action.target.id;
        if(a.team===0&&s.players[action.target.id]?.role==='field')s.controlledId=action.target.id;
        emit(s,`${a.team===0?'蓝':'橙'}队 ${a.number} → ${s.players[action.target.id]?.number} 号传球`);
    }else{s.stats[a.team].shots++;s.passTargetId=null;emit(s,`${a.team===0?'蓝':'橙'}队 ${a.number} 号射门`);}
    if(s.phase==='shootout'){
        const p=s.shootout;p.stage='flight';p.flightAge=0;p.shotAim=action.target.x/CAGE.goalHalf;
        p.keeperGuess=clamp(p.shotAim+(rand(s)-0.5)*1.6,-1,1);if(rand(s)<0.28)p.keeperGuess=-Math.sign(p.shotAim||1)*0.8;
    }
}
function updateActions(s,dt){for(const a of s.players){if(a.dive&&s.time-a.dive.started>0.8)a.dive=null;if(!a.action)continue;const k=a.action;k.age+=dt;
    if(!k.fired&&k.age>=0.14){k.fired=true;kick(s,a,k);}if(k.age>=0.64)a.action=null;}}
function moveToward(a,target,speed,dt){const d=norm(target.x-a.x,target.z-a.z),length=dist(a,target);if(length>0.08){const step=Math.min(length,speed*dt);a.x+=d.x*step;a.z+=d.z*step;a.fx=d.x;a.fz=d.z;}}
function botField(s,a,dt){
    const direction=attackDirection(s,a.team),b=s.ball,owner=b.owner==null?null:s.players[b.owner];
    if(owner?.id===a.id){
        const held=s.time-a.heldSince,goalDistance=Math.abs(direction*CAGE.halfLength-a.z);
        const pressure=Math.min(...s.players.filter(p=>p.team!==a.team).map(p=>dist(a,p)));
        const target=choosePassTarget(s,a,{x:0,z:direction});
        if(!a.action&&held>0.42){
            if(goalDistance<5.7&&Math.abs(a.x)<4.5)queueAction(s,a,'shot',{x:(rand(s)-0.5)*3.3,z:direction*(CAGE.halfLength+0.5)},0.75);
            else if(target&&((held>0.30&&pressure<2.3)||(held>1.25&&target.role!=='keeper')))
                queueAction(s,a,'pass',{x:target.x+target.vx*0.2,z:target.z+target.vz*0.2,id:target.id});
        }
        if(!a.action)moveToward(a,{x:a.x*0.75,z:direction*(CAGE.halfLength-1)},4.8,dt);return;
    }
    const nearest=s.players.filter(p=>p.team===a.team&&p.role==='field').sort((x,y)=>dist(x,b)-dist(y,b));
    let target;
    if(!owner||owner.team!==a.team){
        if(nearest.slice(0,owner?1:2).some(p=>p.id===a.id))target={x:b.x+b.vx*0.14,z:b.z+b.vz*0.14};
        else target={x:(a.slot%2? -1:1)*3.7,z:clamp(b.z*0.45-direction*3,-8,8)};
        if(owner&&owner.team!==a.team&&dist(a,b)<1.05&&b.y<0.65&&!a.action)queueAction(s,a,'tackle',{x:b.x,z:b.z});
    }else{
        const baseX=[0,-4.4,4.4,-2.7,2.7][a.slot];
        target={x:clamp(baseX+owner.x*0.25,-6.5,6.5),z:clamp(owner.z+direction*(a.slot===1?-2.8:a.slot===2?-0.8:2.8),-9,9)};
        if(s.passTargetId===a.id)target={x:b.x+b.vx*0.20,z:b.z+b.vz*0.20};
    }
    if(!a.action)moveToward(a,target,4.6,dt);
}
function botKeeper(s,a,dt){
    const d=attackDirection(s,a.team),home=-d*(CAGE.halfLength-0.95),b=s.ball;
    if(b.owner===a.id){
        if(s.time-a.heldSince>0.6&&!a.action){const t=choosePassTarget(s,a,{x:0,z:d});queueAction(s,a,'pass',{x:t.x,z:t.z,id:t.id});}return;
    }
    let targetX=clamp(b.x*0.65,-1.65,1.65);
    if(b.vz*d< -1&&Math.abs(b.z-home)<5){
        const arrival=(home-b.z)/(b.vz||0.01),predicted=b.x+b.vx*Math.max(0,arrival);
        targetX=clamp(predicted,-1.75,1.75);
        if(arrival>0&&arrival<0.45&&!a.dive&&s.time>a.cooldown){a.dive={started:s.time,side:Math.sign(targetX-a.x)||1};a.cooldown=s.time+0.9;}
    }
    const targetZ=Math.abs(b.z-home)<2&&b.y<0.6?clamp(b.z,home-0.75,home+0.75):home;
    moveToward(a,{x:targetX,z:targetZ},a.dive?6.2:3.7,dt);a.fx=0;a.fz=d;
}
function movePlayers(s,dt,input){
    const before=s.players.map(a=>({x:a.x,z:a.z}));
    for(const a of s.players){
        if(a.role==='keeper')botKeeper(s,a,dt);
        else if(a.team===0&&a.id===s.controlledId&&!s.autoBlue){
            const move=norm(input.moveX||0,input.moveZ||0),magnitude=clamp(Math.hypot(input.moveX||0,input.moveZ||0),0,1),speed=input.sprint?7.6:5.4;
            if(magnitude&&!a.action){a.x+=move.x*speed*dt*magnitude;a.z+=move.z*speed*dt*magnitude;a.fx=move.x;a.fz=move.z;}
            else if(s.ball.owner===a.id&&input.aim){const d=norm(input.aim.x,input.aim.z);a.fx=d.x;a.fz=d.z;}
        }else botField(s,a,dt);
    }
    for(let pass=0;pass<2;pass++)for(let i=0;i<10;i++)for(let j=i+1;j<10;j++){
        const a=s.players[i],b=s.players[j],length=dist(a,b),minimum=CAGE.playerRadius*2;
        if(length<minimum){const d=length>1e-5?norm(b.x-a.x,b.z-a.z):{x:1,z:0},push=(minimum-length)*0.5;a.x-=d.x*push;a.z-=d.z*push;b.x+=d.x*push;b.z+=d.z*push;}
    }
    for(const a of s.players){confineCircle(a,CAGE.playerRadius);a.vx=(a.x-before[a.id].x)/dt;a.vz=(a.z-before[a.id].z)/dt;}
}
function attachBall(s){const a=s.players[s.ball.owner];if(!a)return;Object.assign(s.ball,{x:a.x+a.fx*0.56,z:a.z+a.fz*0.56,y:a.role==='keeper'?0.9:CAGE.ballRadius,vx:0,vy:0,vz:0});}
function keeperContact(s,a,previous){
    const b=s.ball;if(b.y>2.15||Math.abs(b.z-a.z)>1.15)return false;
    const reach=a.dive?0.95:0.62;
    return distanceToSegment(a,previous,b)<reach;
}
function integrateBall(s,dt,{penalty=false}={}){
    const b=s.ball,previous={x:b.x,y:b.y,z:b.z};
    if(b.owner!=null)attachBall(s);else{
        b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=12*dt;
        if(b.y<CAGE.ballRadius){b.y=CAGE.ballRadius;b.vy=-b.vy*0.42;if(b.vy<0.35)b.vy=0;}
        if(b.y>CAGE.height-CAGE.ballRadius){b.y=CAGE.height-CAGE.ballRadius;b.vy=-Math.abs(b.vy)*0.65;}
        const damping=Math.exp(-(b.y>CAGE.ballRadius+0.03?0.15:0.65)*dt);b.vx*=damping;b.vz*=damping;
        if(s.time>b.lockUntil){
            const candidates=penalty?[s.players[s.shootout.keeperId]]:[...s.players].sort((a,c)=>dist(a,b)-dist(c,b));
            for(const a of candidates){
                if(a.id===b.kicker&&s.time<b.lockUntil+0.4)continue;
                if(a.role==='keeper'&&keeperContact(s,a,previous)){
                    s.stats[a.team].saves++;a.dive=a.dive||{started:s.time,side:Math.sign(b.x-a.x)||1};
                    if(penalty){resolvePenalty(s,false);return;}
                    takePossession(s,a);emit(s,`${a.team===0?'蓝':'橙'}队门将扑救`);break;
                }
                if(!penalty&&a.role==='field'&&b.y<0.66&&distanceToSegment(a,previous,b)<0.62){
                    if(Math.hypot(b.vx,b.vz)<12){takePossession(s,a);break;}
                    const n=norm(b.x-a.x,b.z-a.z);b.vx=n.x*5;b.vz=n.z*5;b.vy=1.2;b.lockUntil=s.time+0.2;break;
                }
            }
        }
    }
    // Goal detection precedes the end-wall response. Only a valid goal opening
    // is a gap; all eight other wall faces and the roof return the ball.
    for(const sign of [-1,1]){
        const plane=sign*(CAGE.halfLength+CAGE.ballRadius);
        if(previous.z*sign<plane*sign&&b.z*sign>=plane*sign){
            const t=clamp((plane-previous.z)/(b.z-previous.z||1),0,1),cross={x:previous.x+(b.x-previous.x)*t,y:previous.y+(b.y-previous.y)*t};
            if(goalOpening(cross)){
                if(penalty){resolvePenalty(s,true);return;}
                const scoring=attackDirection(s,0)===sign?0:1;s.scores[scoring]++;s.phase='goal';s.phaseTimer=2;
                s.concededTeam=1-scoring;stopActions(s);b.owner=null;b.vx=b.vy=b.vz=0;emit(s,`${scoring===0?'蓝':'橙'}队进球！`);return;
            }
        }
    }
    // Round goal posts can return a ball even inside the cage opening.
    if(b.owner==null)for(const sign of [-1,1])for(const x of [-CAGE.goalHalf,CAGE.goalHalf]){
        if(b.y>CAGE.goalHeight+0.1)continue;
        const dx=b.x-x,dz=b.z-sign*CAGE.halfLength,l=Math.hypot(dx,dz),r=CAGE.ballRadius+0.09;
        if(l<r&&l>1e-5){const nx=dx/l,nz=dz/l,dot=b.vx*nx+b.vz*nz;if(dot<0){b.vx-=1.8*dot*nx;b.vz-=1.8*dot*nz;}b.x=x+nx*r;b.z=sign*CAGE.halfLength+nz*r;}
    }
    confineCircle(b,CAGE.ballRadius,{ball:true});
}
function endHalf(s){
    s.remaining=0;
    stopActions(s);s.ball.owner=null;s.ball.vx=s.ball.vy=s.ball.vz=0;
    if(s.half===1){s.phase='halftime';s.phaseTimer=4;emit(s,'中场休息 · 交换场地');}
    else if(s.scores[0]===s.scores[1])beginShootout(s);
    else finish(s,s.scores[0]>s.scores[1]?0:1);
}
function finish(s,winner){s.winner=winner;s.phase='finished';stopActions(s);s.ball.vx=s.ball.vy=s.ball.vz=0;emit(s,`${winner===0?'蓝':'橙'}队获胜！`);}
export function continueMatch(s){if(s.phase==='halftime')s.phaseTimer=0;else if(s.paused)s.paused=false;}
export function stepMatch(s,dt,input={}){
    if(!(dt>0)||dt>0.1||s.paused||s.phase==='ready'||s.phase==='finished')return;
    s.time+=dt;
    if(s.phase==='shootout'){stepShootout(s,dt,input);return;}
    if(['kickoff','goal','halftime'].includes(s.phase)){
        s.phaseTimer-=dt;if(s.phaseTimer>0)return;
        if(s.phase==='halftime'){s.half=2;s.remaining=HALF_SECONDS;placeKickoff(s,1);s.phase='kickoff';s.phaseTimer=1.4;emit(s,'下半场 · 橙队开球');}
        else if(s.phase==='goal'){placeKickoff(s,s.concededTeam);s.phase='kickoff';s.phaseTimer=1.2;}
        else{s.phase='playing';emit(s,`${s.half===1?'上':'下'}半场进行中`);}return;
    }
    s.remaining=Math.max(0,s.remaining-dt);
    if(s.charging){s.charge=clamp((s.time-s.chargeStart)/0.65,0.18,1);if(s.charge>=1)releaseShot(s,input.aim);}
    movePlayers(s,dt,input);updateActions(s,dt);integrateBall(s,dt);
    if(s.remaining<=1e-7)endHalf(s);
}

export function beginShootout(s){
    stopActions(s);s.phase='shootout';s.shootout={results:[[],[]],turn:0,round:1,stage:'prepare',timer:0,aim:0,keeperAim:0,flightAge:0};
    emit(s,'点球大战 · 双方各五轮，平局逐轮加罚');preparePenalty(s);
}
function preparePenalty(s){
    const p=s.shootout;p.turn=(p.results[0].length+p.results[1].length)%2;p.round=Math.floor((p.results[0].length+p.results[1].length)/2)+1;
    p.stage='aim';p.timer=0;p.aim=0;p.keeperAim=0;p.flightAge=0;
    p.shooterId=p.turn*5+([1,2,3,4,0][p.results[p.turn].length%5]);p.keeperId=(1-p.turn)*5;
    stopActions(s);
    for(const a of s.players){a.x=(a.team===0?-1:1)*5.5;a.z=3+a.slot*1.4;a.fx=0;a.fz=-1;}
    const shooter=s.players[p.shooterId],keeper=s.players[p.keeperId];
    shooter.x=0;shooter.z=-5.65;shooter.fx=0;shooter.fz=-1;shooter.cooldown=0;
    keeper.x=0;keeper.z=-11.25;keeper.fx=0;keeper.fz=1;
    Object.assign(s.ball,{x:0,y:CAGE.ballRadius,z:-6.2,vx:0,vy:0,vz:0,owner:shooter.id,lastTouch:null,lockUntil:s.time,kicker:null});
    s.controlledId=p.turn===0?shooter.id:keeper.id;
    emit(s,`${p.round<=5?'点球第':'加罚第'} ${p.round} 轮 · ${p.turn===0?'蓝队主罚':'蓝队守门'}`);
}
function takePenalty(s,aim,power=0.8){
    const p=s.shootout;if(p.stage!=='aim')return false;
    p.aim=clamp(aim,-1,1);const a=s.players[p.shooterId];a.cooldown=0;
    const ok=queueAction(s,a,'shot',{x:p.aim*CAGE.goalHalf*0.93,z:-CAGE.halfLength-0.5},power);
    if(ok)p.stage='windup';return ok;
}
export function requestDive(s,side){
    if(s.phase!=='shootout'||s.shootout.turn!==1||!['aim','windup','flight'].includes(s.shootout.stage))return false;
    const p=s.shootout,a=s.players[p.keeperId];if(a.dive)return false;
    const chosen=side??Math.sign(p.keeperAim);a.dive={started:s.time,side:clamp(chosen,-1,1)};return true;
}
export function resolvePenalty(s,scored){
    const p=s.shootout;if(s.phase!=='shootout'||p.stage!=='flight')return false;
    p.results[p.turn].push(Boolean(scored));p.stage='result';p.timer=0;s.ball.owner=null;s.ball.vx=s.ball.vy=s.ball.vz=0;
    emit(s,`${p.turn===0?'蓝':'橙'}队点球${scored?'命中':'未进'}`);
    if(p.results[0].length>=5&&p.results[0].length===p.results[1].length){const a=totalGoals(p.results[0]),b=totalGoals(p.results[1]);if(a!==b)finish(s,a>b?0:1);}
    return true;
}
function stepShootout(s,dt,input){
    const p=s.shootout;p.timer+=dt;
    if(p.stage==='result'){if(p.timer>=1.4)preparePenalty(s);return;}
    const keeper=s.players[p.keeperId];
    if(p.turn===0&&p.stage==='aim'){
        p.aim=clamp(p.aim+(input.moveX||0)*dt*0.9,-1,1);if(Number.isFinite(input.penaltyAim))p.aim=clamp(input.penaltyAim,-1,1);
        if(s.charging){s.charge=clamp((s.time-s.chargeStart)/0.65,0.18,1);if(s.charge>=1)releaseShot(s);}
        if(p.timer>10||s.autoBlue)takePenalty(s,s.autoBlue?(rand(s)-0.5)*1.8:p.aim,0.85);
    }
    if(p.turn===1){
        p.keeperAim=clamp(p.keeperAim+(input.moveX||0)*dt*2,-1,1);
        if(!keeper.dive)keeper.x=clamp(keeper.x+(input.moveX||0)*3.6*dt,-1.7,1.7);
        else keeper.x=clamp(keeper.x+keeper.dive.side*5.7*dt,-1.9,1.9);
        if(s.autoBlue&&!keeper.dive&&p.stage==='flight'&&p.flightAge>0.1)requestDive(s,Math.sign(s.ball.vx));
        if(p.stage==='aim'&&p.timer>1.45)takePenalty(s,(rand(s)-0.5)*1.85,0.8);
    }
    updateActions(s,dt);
    if(p.stage==='flight'){
        p.flightAge+=dt;
        if(p.turn===0&&p.flightAge>0.14){
            if(!keeper.dive)keeper.dive={started:s.time,side:Math.sign(p.keeperGuess-keeper.x)};
            moveToward(keeper,{x:p.keeperGuess*1.75,z:-11.25},5.5,dt);
        }
        integrateBall(s,dt,{penalty:true});
        if(p.stage==='flight'&&(p.flightAge>2.2||(p.flightAge>0.55&&s.ball.vz>0.5)))resolvePenalty(s,false);
    }
}
