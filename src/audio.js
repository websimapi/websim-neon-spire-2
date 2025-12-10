// Procedural Audio System (WebAudio API)
// No external assets required, but designed to work with generated ones if present.

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
        this.sounds = {};
    }

    async init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Prevent clipping
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;

        // Preload generated assets
        this.loadSound('dash', 'sfx_dash.mp3');
        this.loadSound('hit', 'sfx_hit.mp3');
        this.loadSound('levelup', 'sfx_levelup.mp3');
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
        } catch (e) {
            console.warn(`Failed to load sound ${name}, falling back to synth.`);
        }
    }

    play(name) {
        if (!this.initialized) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (this.sounds[name]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.sounds[name];
            source.connect(this.masterGain);
            source.start(0);
        } else {
            // Fallback Synths
            this.synth(name);
        }
    }

    synth(type) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        const now = this.ctx.currentTime;

        if (type === 'dash') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'hit') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'explode') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    }
}

export const audio = new AudioSystem();