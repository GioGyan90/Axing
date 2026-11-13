// Shared by the challenge and 5v5 simulations. World movement belongs to the
// simulation; the baked animation has no horizontal root motion.
export const SLIDE = Object.freeze({glide:0.6,duration:0.84,activeFrom:0.08,speed:9,cooldown:1.8,reach:0.96,bootRadius:0.22,maxBallHeight:0.62});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createSlide(time,velocity,facing,source='human') {
    let x=velocity?.x||0,z=velocity?.z||0;
    if(Math.hypot(x,z)<0.15){x=facing?.x||0;z=facing?.z||0;}
    const length=Math.hypot(x,z);if(length<0.001){x=0;z=-1;}
    else{x/=length;z/=length;}
    return {started:time,age:0,dx:x,dz:z,source,hitPlayers:[],hitBall:false,sweep:null};
}
const travel=t=>{const a=clamp(t,0,SLIDE.glide);return SLIDE.speed*(a-a*a/(2*SLIDE.glide));};
export function advanceSlide(slide,dt,before,after,confine=()=>{}) {
    const old=slide.age;slide.age=Math.min(SLIDE.duration,old+dt);
    const distance=travel(slide.age)-travel(old);
    after.x+=slide.dx*distance;after.z+=slide.dz*distance;confine(after);
    // Only the part of this frame with an extended boot can make contact.
    const from=Math.max(old,SLIDE.activeFrom),to=Math.min(slide.age,SLIDE.glide);
    const span=slide.age-old||1;
    slide.sweep=to>=from&&old<SLIDE.glide&&slide.age>=SLIDE.activeFrom?{
        from:(from-old)/span,to:(to-old)/span,
        a:{x:before.x+(after.x-before.x)*(from-old)/span,z:before.z+(after.z-before.z)*(from-old)/span},
        b:{x:before.x+(after.x-before.x)*(to-old)/span,z:before.z+(after.z-before.z)*(to-old)/span},
    }:null;
    return slide.age>=SLIDE.duration;
}
const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
function pointSegment(p,a,b){const x=b.x-a.x,z=b.z-a.z,t=clamp(((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z||1),0,1);return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
function segments(a,b,c,d){
    const cross=(x,z,u,v)=>x*v-z*u,ab={x:b.x-a.x,z:b.z-a.z},cd={x:d.x-c.x,z:d.z-c.z},den=cross(ab.x,ab.z,cd.x,cd.z);
    if(Math.abs(den)>1e-9){const t=cross(c.x-a.x,c.z-a.z,cd.x,cd.z)/den,u=cross(c.x-a.x,c.z-a.z,ab.x,ab.z)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
    return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
// Relative motion turns a moving target and a moving extended leg into two
// segments. This also catches a fast ball crossing between rendered frames.
export function slideContact(slide,previous,current,radius,{maxHeight=Infinity}={}) {
    const sweep=slide.sweep;if(!sweep)return false;
    let from=sweep.from,to=sweep.to;
    if(Number.isFinite(maxHeight)&&previous.y!=null&&current.y!=null){
        const dy=current.y-previous.y;
        if(Math.abs(dy)<1e-8){if(previous.y>maxHeight)return false;}
        else if(dy>0)to=Math.min(to,(maxHeight-previous.y)/dy);
        else from=Math.max(from,(maxHeight-previous.y)/dy);
        if(to<from)return false;
    }
    const a=interpolate(previous,current,from),b=interpolate(previous,current,to),span=sweep.to-sweep.from;
    const hipA=interpolate(sweep.a,sweep.b,span>1e-8?(from-sweep.from)/span:0),hipB=interpolate(sweep.a,sweep.b,span>1e-8?(to-sweep.from)/span:0);
    a.x-=hipA.x;a.z-=hipA.z;b.x-=hipB.x;b.z-=hipB.z;
    const start={x:slide.dx*0.12,z:slide.dz*0.12},end={x:slide.dx*SLIDE.reach,z:slide.dz*SLIDE.reach};
    return segments(a,b,start,end)<=radius+SLIDE.bootRadius;
}
