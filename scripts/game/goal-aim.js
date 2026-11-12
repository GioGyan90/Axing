// Goal assistance is independent of camera, facing and renderer. The target
// stays inside the posts; pointer input may only choose a horizontal placement.
export function goalTarget(origin, {goalZ, lineZ, halfWidth, ballRadius = 0.23, preferredX = 0, margin = 0.22}) {
    const limit = Math.max(0, halfWidth - ballRadius - margin);
    let low=-limit,high=limit;
    if(Number.isFinite(lineZ)&&Math.abs(goalZ-origin.z)>0.001){
        const direction=Math.sign(goalZ-lineZ)||1;
        // Account for both edges of a whole ball crossing the mouth. A target
        // behind a post can otherwise hit the end wall when shot from a wing.
        for(const z of [lineZ-direction*ballRadius,lineZ+direction*ballRadius]){
            const t=(z-origin.z)/(goalZ-origin.z);if(t<=0||t>1)continue;
            low=Math.max(low,(-limit-origin.x*(1-t))/t);high=Math.min(high,(limit-origin.x*(1-t))/t);
        }
        if(low>high){low=-limit;high=limit;}
    }
    const x = Number.isFinite(preferredX) ? Math.max(low, Math.min(high, preferredX)) : Math.max(low, Math.min(high,0));
    return {x, z: goalZ};
}
export function goalDirection(origin, options) {
    const target = goalTarget(origin, options), dx = target.x - origin.x, dz = target.z - origin.z;
    const length = Math.hypot(dx, dz) || 1;
    return {x: dx / length, z: dz / length};
}
