export const KNOCKDOWN = Object.freeze({range: 1.08, minSeconds: 3, maxSeconds: 5, recovery: 0.6});
export function makeKnockdown(time, power = 0.65) {
    const duration = KNOCKDOWN.minSeconds + (KNOCKDOWN.maxSeconds - KNOCKDOWN.minSeconds) * Math.max(0, Math.min(1, power));
    return {started: time, downUntil: time + duration, getUpUntil: time + duration + KNOCKDOWN.recovery};
}
export const isKnockedDown = (status, time) => !!status && time < status.getUpUntil;
export const getUpProgress = (status, time) => status ? Math.max(0, Math.min(1, (time - status.downUntil) / KNOCKDOWN.recovery)) : 1;
