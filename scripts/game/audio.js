let audioContext = null;

export function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

export function playSixteenBitApplause() {
    const context = ensureAudioContext();
    const startTime = context.currentTime + 0.02;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, startTime);
    master.gain.exponentialRampToValueAtTime(0.32, startTime + 0.05);
    master.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.15);
    master.connect(context.destination);

    for (let i = 0; i < 34; i++) {
        const clapTime = startTime + i * 0.028 + Math.random() * 0.026;
        const duration = 0.05 + Math.random() * 0.045;
        const source = context.createBufferSource();
        const sampleRate = context.sampleRate;
        const buffer = context.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
        const data = buffer.getChannelData(0);
        let hold = 0;
        let value = 0;
        for (let j = 0; j < data.length; j++) {
            if (hold <= 0) {
                value = (Math.random() * 2 - 1);
                value = Math.round(value * 32767) / 32767;
                hold = 2 + Math.floor(Math.random() * 4);
            }
            hold -= 1;
            const envelope = Math.pow(1 - j / data.length, 2.2);
            data[j] = value * envelope;
        }
        source.buffer = buffer;

        const bitcrusher = context.createWaveShaper();
        bitcrusher.curve = new Float32Array([-1, -0.6, -0.28, 0, 0.28, 0.6, 1]);
        bitcrusher.oversample = 'none';

        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200 + Math.random() * 1800, clapTime);
        filter.Q.setValueAtTime(0.8 + Math.random() * 0.8, clapTime);

        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, clapTime);
        gain.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.08, clapTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, clapTime + duration);

        source.connect(bitcrusher);
        bitcrusher.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start(clapTime);
        source.stop(clapTime + duration);
    }

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, startTime + index * 0.06);
        gain.gain.setValueAtTime(0.0001, startTime + index * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.045, startTime + index * 0.06 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.06 + 0.12);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(startTime + index * 0.06);
        oscillator.stop(startTime + index * 0.06 + 0.13);
    });
}

export function playKeeperHitSound(powerRatio = 0.5) {
    const context = ensureAudioContext();
    const startTime = context.currentTime + 0.01;
    const impact = context.createOscillator();
    const thump = context.createOscillator();
    const noise = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const sampleRate = context.sampleRate;
    const duration = 0.16;
    const buffer = context.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.8);
    }

    noise.buffer = buffer;
    impact.type = 'square';
    thump.type = 'triangle';
    impact.frequency.setValueAtTime(180 + powerRatio * 95, startTime);
    impact.frequency.exponentialRampToValueAtTime(70, startTime + duration);
    thump.frequency.setValueAtTime(58, startTime);
    thump.frequency.exponentialRampToValueAtTime(36, startTime + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, startTime);
    filter.frequency.exponentialRampToValueAtTime(180, startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18 + powerRatio * 0.12, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    impact.connect(gain);
    thump.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    impact.start(startTime);
    thump.start(startTime);
    noise.start(startTime);
    impact.stop(startTime + duration);
    thump.stop(startTime + duration);
    noise.stop(startTime + duration);
}
