import {CAGE,VERTICES,choosePassTarget} from './engine.js';

// Fast, playable projected view when WebGL is unavailable. It renders the same
// simulation, including the octagonal walls, all ten players and ball height.
export function createCanvasView(canvas){
    const ctx=canvas.getContext('2d');let width=1,height=1,scale=1,cx=0,cy=0;
    const p=(x,y,z)=>({x:cx+x*scale,y:cy+z*scale*0.56-y*scale});
    function path(points,fill,stroke,lineWidth=1){ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}}
    const line=(a,b,color,w=1)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();};
    const poly=(points,fill,stroke,w)=>path(points.map(([x,y,z])=>p(x,y,z)),fill,stroke,w);
    function circle(x,z,r,color,w){const c=p(x,0.07,z);ctx.beginPath();ctx.ellipse(c.x,c.y,r*scale,r*scale*0.56,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();}
    function fence(i){
        const a=VERTICES[i],b=VERTICES[(i+1)%8],near=(a[1]+b[1])/2>1;
        const segments=[];
        if(i===0||i===4){
            segments.push([a,[-CAGE.goalHalf,a[1]]],[[CAGE.goalHalf,a[1]],b]);
            const alpha=near?'#b7e6dd23':'#b7e6dd55';
            for(let h=CAGE.goalHeight+0.2;h<CAGE.height;h+=0.5)line(p(-CAGE.goalHalf,h,a[1]),p(CAGE.goalHalf,h,a[1]),alpha,0.7);
            for(let x=-CAGE.goalHalf;x<=CAGE.goalHalf;x+=0.65)line(p(x,CAGE.goalHeight,a[1]),p(x,CAGE.height,a[1]),alpha,0.7);
            line(p(-CAGE.goalHalf,CAGE.height,a[1]),p(CAGE.goalHalf,CAGE.height,a[1]),near?'#ffc47d88':'#ffc47d',2.4);
        }
        else segments.push([a,b]);
        for(const [u,v] of segments){
            poly([[u[0],0,u[1]],[v[0],0,v[1]],[v[0],0.38,v[1]],[u[0],0.38,u[1]]],near?'#143f47aa':'#143f47');
            const alpha=near?'#b7e6dd23':'#b7e6dd55';
            for(let h=0.8;h<CAGE.height;h+=0.65)line(p(u[0],h,u[1]),p(v[0],h,v[1]),alpha,0.7);
            const n=Math.ceil(Math.hypot(v[0]-u[0],v[1]-u[1])/0.65);
            for(let j=0;j<=n;j++){const t=j/n,x=u[0]+(v[0]-u[0])*t,z=u[1]+(v[1]-u[1])*t;line(p(x,0.38,z),p(x,CAGE.height,z),alpha,0.7);}
            line(p(u[0],CAGE.height,u[1]),p(v[0],CAGE.height,v[1]),near?'#ffc47d88':'#ffc47d',2.4);
        }
        line(p(a[0],0,a[1]),p(a[0],CAGE.height,a[1]),'#ffc47d',3);
        const light=p(a[0],CAGE.height,a[1]);ctx.fillStyle='#ffdea4';ctx.beginPath();ctx.arc(light.x,light.y,3.3,0,Math.PI*2);ctx.fill();
    }
    function goal(sign){
        const z=sign*12,color=sign<0?'#ffbc8a':'#9bdfff';
        for(const x of [-CAGE.goalHalf,CAGE.goalHalf]){
            line(p(x,0,z),p(x,2,z),color,3.2);line(p(x,2,z),p(x,1.9,z+sign),color,1.5);line(p(x,0,z+sign),p(x,1.9,z+sign),'#c1dfd277',1);
        }
        line(p(-CAGE.goalHalf,2,z),p(CAGE.goalHalf,2,z),color,3.2);
        for(let x=-CAGE.goalHalf;x<=CAGE.goalHalf;x+=0.42)line(p(x,0,z+sign),p(x,1.9,z+sign),'#c1dfd255',0.8);
        for(let y=0;y<2;y+=0.4)line(p(-CAGE.goalHalf,y,z+sign),p(CAGE.goalHalf,y,z+sign),'#c1dfd255',0.8);
    }
    function box(x,y,w,h,d,front,side,top){
        ctx.fillStyle=front;ctx.fillRect(x,y,w,h);
        path([{x:x+w,y},{x:x+w+d,y:y-d*0.6},{x:x+w+d,y:y+h-d*0.6},{x:x+w,y:y+h}],side);
        path([{x,y},{x:x+d,y:y-d*0.6},{x:x+w+d,y:y-d*0.6},{x:x+w,y}],top);
    }
    function actor(a,s){
        const q=p(a.x,0,a.z),size=scale*0.9,team=a.team===0;
        ctx.save();ctx.translate(q.x,q.y);
        ctx.fillStyle='#071f293b';ctx.beginPath();ctx.ellipse(0,1,size*0.48,size*0.15,0,0,Math.PI*2);ctx.fill();
        let tilt=0;if(a.dive)tilt=-a.dive.side*Math.sin(Math.min(1,(s.time-a.dive.started)/0.8)*Math.PI)*0.95;
        ctx.translate(0,-size*0.57);ctx.rotate(tilt);ctx.translate(0,size*0.57);
        const moving=Math.min(1,Math.hypot(a.vx,a.vz)/5),stride=Math.sin(s.time*13+a.id)*moving*size*0.14;
        const action=a.action?Math.sin(Math.min(1,a.action.age/0.64)*Math.PI)*size*0.25:0;
        const skin=a.team===0?'#efc194':'#cc996d',shirt=a.role==='keeper'?(team?'#ccea7c':'#f175aa'):(team?'#39b4f0':'#ff9a43'),side=team?'#197bb4':'#cd602c',shorts=team?'#16476b':'#693a30';
        for(const sign of [-1,1]){
            const footX=sign*size*0.12+(sign<0?a.fx*action:0),footY=sign*stride+(sign<0?a.fz*action*0.56-action*0.2:0);
            line({x:sign*size*0.12,y:-size*0.53},{x:footX,y:-size*0.07+footY},shorts,size*0.16);
            line({x:footX,y:-size*0.27+footY*0.5},{x:footX,y:-size*0.05+footY},'#eef4ee',size*0.13);
            box(footX-size*0.09,-size*0.06+footY,size*0.20,size*0.08,size*0.05,'#132d3d','#0d2231','#314b58');
        }
        box(-size*0.27,-size*1.03,size*0.54,size*0.52,size*0.10,shirt,side,team?'#75d2f5':'#ffbc6c');
        for(const sign of [-1,1]){
            const handX=sign*size*(a.dive?0.44:0.31),handY=-size*0.55+sign*stride*0.4-(a.dive?size*0.38:0);
            line({x:sign*size*0.3,y:-size*0.96},{x:handX,y:handY},skin,size*0.13);
            if(a.role==='keeper')box(handX-size*0.07,handY-size*0.02,size*0.15,size*0.14,0,'#fff8dd','#e5dac5','#fff8dd');
        }
        ctx.fillStyle='#f4f5eb';ctx.textAlign='center';ctx.font=`bold ${Math.max(9,size*0.26)}px system-ui`;ctx.fillText(a.number,0,-size*0.7);
        box(-size*0.23,-size*1.56,size*0.46,size*0.46,size*0.12,skin,'#b98460','#f3cda3');
        box(-size*0.24,-size*1.59,size*0.48,size*0.14,size*0.12,a.team===0?'#423b32':'#3b3028','#2c2b28','#5d5142');
        const facing=a.fz>=0?1:-1;ctx.fillStyle='#263339';const eyeY=-size*1.35;
        if(facing>0){ctx.fillRect(-size*0.12,eyeY,size*0.06,size*0.05);ctx.fillRect(size*0.08,eyeY,size*0.06,size*0.05);}
        ctx.restore();
    }
    return {kind:'canvas',canvas,
        resize(w,h){width=w;height=h;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(w/(w/h<0.8?18.8:24),h/21.5);cx=w/2;cy=h/2+scale*0.7;},
        toField(x,y){const r=canvas.getBoundingClientRect();return {x:(x-r.left-cx)/scale,z:(y-r.top-cy)/(scale*0.56)};},
        render(s){
            const bg=ctx.createRadialGradient(width/2,height/2,10,width/2,height/2,width*0.7);bg.addColorStop(0,'#23475a');bg.addColorStop(1,'#0b2031');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
            poly(VERTICES.map(([x,z])=>[x,-0.3,z]),'#0d2737','#38606b',2);
            poly(VERTICES.map(([x,z])=>[x,0.04,z]),'#278d76','#87bdb1',1.5);
            // Alternating inset stripes follow the same clipped octagon.
            for(let z=-10;z<=10;z+=4){const w=8-Math.max(0,Math.abs(z)+1-9.4);poly([[-w,0.05,z-1],[w,0.05,z-1],[w,0.05,z+1],[-w,0.05,z+1]],'#30977c');}
            line(p(-8,0.07,0),p(8,0.07,0),'#d7f4d9aa',1.2);circle(0,0,2.1,'#d7f4d9aa',1.2);
            for(const sign of [-1,1]){const z=sign*8;line(p(-3.4,0.07,sign*12),p(-3.4,0.07,z),'#d7f4d9aa');line(p(-3.4,0.07,z),p(3.4,0.07,z),'#d7f4d9aa');line(p(3.4,0.07,z),p(3.4,0.07,sign*12),'#d7f4d9aa');}
            for(let i=0;i<8;i++)if((VERTICES[i][1]+VERTICES[(i+1)%8][1])/2<=1)fence(i);goal(-1);
            const a=s.players[s.controlledId];circle(a.x,a.z,0.66,'#a4ffd5',2.8);
            const owner=s.ball.owner==null?null:s.players[s.ball.owner],target=owner?.team===0?choosePassTarget(s,owner):null;
            if(s.phase==='playing'&&target)circle(target.x,target.z,0.62,'#ffe19a',1.7);
            const objects=[...s.players.map(a=>({z:a.z,draw:()=>actor(a,s)})),{z:s.ball.z,draw:()=>{
                const b=s.ball,shadow=p(b.x,0,b.z),q=p(b.x,b.y,b.z),r=CAGE.ballRadius*scale;
                ctx.fillStyle='#102e4244';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,r*1.1,r*0.5,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#fff9e9';ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2b4554';ctx.beginPath();ctx.arc(q.x-r*0.15,q.y-r*0.08,r*0.36,0,Math.PI*2);ctx.fill();
            }}];objects.sort((a,b)=>a.z-b.z).forEach(o=>o.draw());
            goal(1);for(let i=0;i<8;i++)if((VERTICES[i][1]+VERTICES[(i+1)%8][1])/2>1)fence(i);
            if(s.phase==='shootout'&&s.shootout.stage==='aim'&&s.shootout.turn===0){const target=p(s.shootout.aim*CAGE.goalHalf*0.93,0.8,-12);ctx.strokeStyle='#ffe08a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(target.x,target.y,8,0,Math.PI*2);ctx.stroke();line({x:target.x-12,y:target.y},{x:target.x+12,y:target.y},'#ffe08a',1);}
        }};
}
