const colors = ['#ffcc68','#69e4be','#6fcfff','#ff8bb1','#fff6d9'];
export function spawnConfetti(width, height, random = Math.random, reduced = false) {
    return Array.from({length: reduced ? 24 : 144}, (_, i) => {
        return {x:width*(0.02+random()*0.96),y:height*(random()*0.5-0.1),vx:(random()-0.5)*140,vy:30+random()*90,
            rotation:random()*Math.PI*2,spin:(random()-0.5)*10,size:5+random()*6,age:0,life:reduced?1.1:3.2+random()*1.2,color:colors[i%colors.length]};
    });
}
export function stepConfetti(pieces, dt) {
    for (const p of pieces) {p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt+140*dt*dt;p.vy+=280*dt;p.rotation+=p.spin*dt;}
    return pieces.filter(p=>p.age<p.life);
}
const controllers = new WeakMap();
export function goalConfettiFor(canvas) {
    if(controllers.has(canvas))return controllers.get(canvas);
    const ctx=canvas.getContext('2d');let pieces=[],width=0,height=0;
    Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'50'});
    canvas.hidden=true;
    function resize(){if(width===innerWidth&&height===innerHeight)return;width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
    const controller={
        burst(){resize();pieces=spawnConfetti(width,height,Math.random,!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);canvas.hidden=false;canvas.dataset.particles=String(pieces.length);},
        clear(){pieces=[];ctx.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;canvas.dataset.particles='0';},
        tick(dt,paused=false){if(!pieces.length)return;resize();if(!paused)pieces=stepConfetti(pieces,Math.min(0.1,dt));ctx.clearRect(0,0,width,height);
            for(const p of pieces){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.globalAlpha=Math.min(1,(p.life-p.age)/0.65);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*0.6);ctx.restore();}
            canvas.dataset.particles=String(pieces.length);if(!pieces.length)canvas.hidden=true;
        }
    };controllers.set(canvas,controller);return controller;
}
