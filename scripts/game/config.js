export const FIELD = Object.freeze({
    width: 16 * 2 / 3,
    depth: 24 * 2 / 3,
    goalZ: -11.8 * 2 / 3 + 0.5,
    boundaryOffset: 0.18,
});

export const FIELD_SURFACE_Y = 0.04;
export const BALL_RADIUS = 0.28;
export const BALL_GROUND_Y = FIELD_SURFACE_Y + BALL_RADIUS;

export const MODEL_ASSETS = Object.freeze({
    soccerBall: new URL('../../models/soccer_ball.glb', import.meta.url).href,
    portraitModel: new URL('../../models/092187c58cb33a5723b3719eece5c5c2.glb', import.meta.url).href,
    playerHead: new URL('../../models/ZL9head.glb', import.meta.url).href,
    refereeHead: new URL('../../models/ref.glb', import.meta.url).href,
    keeperHead: new URL('../../models/kep.glb', import.meta.url).href,
});

export const KEEPER_PROFILES = Object.freeze({
    1: {
        anticipate: 0.12,
        lateralSpeed: 0,
        depthSpeed: 0,
        saveRadius: 0.42,
        saveCooldown: 1.05,
        chargeRange: 0,
        chargeWidth: 2.2,
        chargeSpeed: 0,
        tackleRadius: 0.64,
        clearancePower: 9.2,
        diveThreshold: 0.75,
        diveReach: 1.6,
        diveClearPower: 8.5,
        // 扇形活动区间参数
        sectorAngle: 70 * Math.PI / 180, // 扇形半角（总角度 140 度）
        sectorRadius: 4.5, // 扇形半径
        visionAngle: 60 * Math.PI / 180, // 视野半角（总视野 120 度）
        visionRadius: 12, // 视野距离
        // 扑救动作时序参数
        squatDuration: 0.15, // 下蹲蓄力时间
        jumpDuration: 0.2, // 弹跳腾空时间
        diveDuration: 0.35, // 倒地伸展时间
        landDuration: 0.25, // 落地缓冲时间
        getUpDuration: 0.5, // 起身恢复时间
    },
    2: {
        anticipate: 0.24,
        lateralSpeed: 4.1,
        depthSpeed: 3.0,
        saveRadius: 0.68,
        saveCooldown: 0.75,
        chargeRange: 3.15,
        chargeWidth: 2.75,
        chargeSpeed: 6.1,
        tackleRadius: 0.76,
        clearancePower: 10.8,
        diveThreshold: 0.75,
        diveReach: 1.6,
        diveClearPower: 8.5,
        // 扇形活动区间参数
        sectorAngle: 80 * Math.PI / 180, // 扇形半角（总角度 160 度）
        sectorRadius: 5.5, // 扇形半径
        visionAngle: 70 * Math.PI / 180, // 视野半角（总视野 140 度）
        visionRadius: 14, // 视野距离
        // 扑救动作时序参数
        squatDuration: 0.12, // 下蹲蓄力时间
        jumpDuration: 0.18, // 弹跳腾空时间
        diveDuration: 0.3, // 倒地伸展时间
        landDuration: 0.2, // 落地缓冲时间
        getUpDuration: 0.4, // 起身恢复时间
    },
    3: {
        anticipate: 0.34,
        lateralSpeed: 6.2,
        depthSpeed: 4.2,
        saveRadius: 0.82,
        saveCooldown: 0.48,
        chargeRange: 4.05,
        chargeWidth: 3.25,
        chargeSpeed: 7.4,
        tackleRadius: 0.9,
        clearancePower: 12.2,
        diveThreshold: 0.75,
        diveReach: 1.6,
        diveClearPower: 8.5,
        // 扇形活动区间参数
        sectorAngle: 85 * Math.PI / 180, // 扇形半角（总角度 170 度）
        sectorRadius: 6.5, // 扇形半径
        visionAngle: 80 * Math.PI / 180, // 视野半角（总视野 160 度）
        visionRadius: 16, // 视野距离
        // 扑救动作时序参数
        squatDuration: 0.1, // 下蹲蓄力时间
        jumpDuration: 0.15, // 弹跳腾空时间
        diveDuration: 0.25, // 倒地伸展时间
        landDuration: 0.15, // 落地缓冲时间
        getUpDuration: 0.35, // 起身恢复时间
    },
});
