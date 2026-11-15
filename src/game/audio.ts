// Web Audio sound generator (used AI to help with the frequency/filter math)
export interface AmbientState {
  outside: boolean;
  onFoot: boolean;
  storm: boolean;
  night: boolean;
  danger: boolean;
}

type Mood = 'calm' | 'explore' | 'tension';

export const AUDIO_FILES = {
  marsWind: 'audio/mars-wind.mp3',
  musicCalm: 'audio/music-calm.mp3',
  musicExplore: 'audio/music-explore.mp3',
  musicTension: 'audio/music-tension.mp3',
  victory: 'audio/victory.mp3',
} as const;

type AudioFileKey = keyof typeof AUDIO_FILES;

class NasaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  // Separate volume buses so players can balance them in Settings
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private volumes = { master: 1, music: 0.8, sfx: 0.9, ambient: 0.8 };
  private muted = false;

  // Ambient layers
  private ambientOn = false;
  private musicGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private breathGain: GainNode | null = null;
  private breathFilter: BiquadFilterNode | null = null;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private breathTimer: ReturnType<typeof setInterval> | null = null;
  private chordIndex = 0;
  private state: AmbientState | null = null;
  private mood: Mood = 'calm';
  private beat = 0;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private delay: DelayNode | null = null;
  private buffers: Partial<Record<AudioFileKey, AudioBuffer>> = {};
  private fileGains: Partial<Record<AudioFileKey, GainNode>> = {};

  public setVolumes(v: Partial<{ master: number; music: number; sfx: number; ambient: number }>) {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, t, 0.05);
    this.sfxBus?.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.musicBus?.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.ambientBus?.gain.setTargetAtTime(this.volumes.ambient, t, 0.05);
  }

  public setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volumes.master;
        // Gentle compressor keeps music, wind and alerts balanced on any speakers
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.01;
        comp.release.value = 0.25;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.ambientBus = this.ctx.createGain();
        for (const b of [this.sfxBus, this.musicBus, this.ambientBus]) b.connect(this.master);
        this.applyVolumes();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  public tone(freq: number, type: OscillatorType = 'sine', dur = 0.1, vol = 0.08, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      // Ignore Web Audio gesture blocks
    }
  }

  private cachedNoise: AudioBuffer | null = null;

  private noiseBurst(opts: {
    dur: number;
    vol: number;
    type: BiquadFilterType;
    f0: number;
    f1: number;
    q?: number;
    delay?: number;
    attack?: number;
  }) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.muted) return;
    try {
      if (!this.cachedNoise) this.cachedNoise = this.noiseBuffer(ctx);
      const t = ctx.currentTime + (opts.delay ?? 0);
      const src = ctx.createBufferSource();
      src.buffer = this.cachedNoise;
      const f = ctx.createBiquadFilter();
      f.type = opts.type;
      f.Q.value = opts.q ?? 1;
      f.frequency.setValueAtTime(opts.f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + opts.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(opts.vol, t + (opts.attack ?? 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfxBus);
      src.start(t, Math.random() * 1.5);
      src.stop(t + opts.dur + 0.05);
    } catch {
      // ignore
    }
  }

  private sweep(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.muted) return;
    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      // ignore
    }
  }

  public playSampleCollect() {
    this.noiseBurst({ dur: 0.18, vol: 0.12, type: 'bandpass', f0: 2500, f1: 900, q: 2 });
    this.tone(180, 'square', 0.05, 0.08, 0.18);
    this.sweep('sine', 1318, 1568, 0.35, 0.07, 0.24);
    this.sweep('sine', 1975, 2093, 0.5, 0.04, 0.3);
  }

  public playRoverStart() {
    this.sweep('sawtooth', 38, 92, 0.9, 0.06);
    this.sweep('triangle', 420, 880, 0.7, 0.04, 0.1);
    this.noiseBurst({ dur: 0.9, vol: 0.05, type: 'lowpass', f0: 200, f1: 700 });
    this.tone(1046, 'sine', 0.12, 0.05, 0.85);
  }

  public playRoverStop() {
    this.sweep('sawtooth', 90, 34, 0.8, 0.05);
    this.sweep('triangle', 820, 360, 0.6, 0.035);
    this.noiseBurst({ dur: 0.35, vol: 0.06, type: 'bandpass', f0: 1800, f1: 600, q: 1.5, delay: 0.55 });
  }

  public playDoor(entering: boolean) {
    // Door panel sliding on its rails
    this.noiseBurst({ dur: 0.5, vol: 0.12, type: 'bandpass', f0: 500, f1: 1400, q: 0.8, attack: 0.02 });
    this.sweep('triangle', 140, 220, 0.45, 0.04);
    this.tone(70, 'sine', 0.18, 0.12, 0.48); // thunk as it locks
    if (entering) {
      this.noiseBurst({ dur: 1.1, vol: 0.08, type: 'highpass', f0: 1200, f1: 4200, delay: 0.55, attack: 0.3 });
    } else {
      this.noiseBurst({ dur: 1.1, vol: 0.08, type: 'highpass', f0: 4200, f1: 900, delay: 0.55, attack: 0.05 });
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: softer, more like wind than hiss
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  public startAmbient() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.ambientOn) return;
    this.ambientOn = true;
    try {
      // Music bus
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.musicBus ?? this.master);
      this.musicGain.gain.setTargetAtTime(1, ctx.currentTime, 2);
      // A soft echo gives the melody a sense of open space
      this.delay = ctx.createDelay(1.5);
      this.delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      this.delay.connect(fb);
      fb.connect(this.delay);
      this.delay.connect(wet);
      wet.connect(this.musicGain);

      // Wind: looping noise through a moving band-pass filter
      const wind = ctx.createBufferSource();
      wind.buffer = this.noiseBuffer(ctx);
      wind.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 400;
      this.windFilter.Q.value = 0.7;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      wind.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ambientBus ?? this.master);
      wind.start();

      // Habitat hum (life support fans)
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 58;
      this.humGain = ctx.createGain();
      this.humGain.gain.value = 0;
      hum.connect(this.humGain);
      this.humGain.connect(this.ambientBus ?? this.master);
      hum.start();

      // Breathing: noise shaped by a filter, envelope driven by a timer
      const breath = ctx.createBufferSource();
      breath.buffer = this.noiseBuffer(ctx);
      breath.loop = true;
      this.breathFilter = ctx.createBiquadFilter();
      this.breathFilter.type = 'bandpass';
      this.breathFilter.frequency.value = 900;
      this.breathFilter.Q.value = 1.2;
      this.breathGain = ctx.createGain();
      this.breathGain.gain.value = 0;
      breath.connect(this.breathFilter);
      this.breathFilter.connect(this.breathGain);
      this.breathGain.connect(this.ambientBus ?? this.master);
      breath.start();

      this.playChord();
      this.chordTimer = setInterval(() => this.playChord(), 7000);
      this.breathTimer = setInterval(() => this.breathe(), 3600);
      this.beatTimer = setInterval(() => this.onBeat(), 440);
      void this.loadFiles();
    } catch {
      this.ambientOn = false;
    }
  }

  private async loadFiles() {
    const ctx = this.ctx;
    if (!ctx || !this.master || typeof fetch === 'undefined') return;
    // audio/manifest.json lists which optional files exist, so we never request missing ones
    let available: string[] = [];
    try {
      const res = await fetch('audio/manifest.json');
      if (res.ok) available = (await res.json()) as string[];
    } catch {
      return;
    }
    for (const key of Object.keys(AUDIO_FILES) as AudioFileKey[]) {
      const file = AUDIO_FILES[key].split('/').pop() ?? '';
      if (!available.includes(file)) continue;
      try {
        const res = await fetch(AUDIO_FILES[key]);
        if (!res.ok) continue;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers[key] = buf;
        if (key === 'victory') continue;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g);
        g.connect((key === 'marsWind' ? this.ambientBus : this.musicBus) ?? this.master);
        src.start();
        this.fileGains[key] = g;
      } catch {
        // File not provided: the generated layer stays in use
      }
    }
  }

  private currentMood(): Mood {
    const st = this.state;
    if (!st) return 'calm';
    if (st.storm || st.danger) return 'tension';
    return st.outside ? 'explore' : 'calm';
  }

  private hasMusicFile(m: Mood): boolean {
    return Boolean(
      (m === 'calm' && this.fileGains.musicCalm) ||
        (m === 'explore' && this.fileGains.musicExplore) ||
        (m === 'tension' && this.fileGains.musicTension)
    );
  }

  private note(freq: number, vol: number, len: number, type: OscillatorType = 'sine') {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || this.muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      osc.connect(g);
      g.connect(this.musicGain);
      if (this.delay) g.connect(this.delay);
      osc.start(t);
      osc.stop(t + len + 0.05);
    } catch {
      // ignore
    }
  }

  private onBeat() {
    if (!this.ctx || !this.state || this.muted) return;
    this.mood = this.currentMood();
    if (this.hasMusicFile(this.mood)) return;
    this.beat += 1;
    // A minor pentatonic, two octaves
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    if (this.mood === 'calm') {
      if (this.beat % 2 === 0 && Math.random() < 0.45) {
        this.note(scale[Math.floor(Math.random() * 6)], 0.022, 1.6);
      }
    } else if (this.mood === 'explore') {
      // Sparse, high notes with long echoes: lonely and wide open
      if (this.beat % 3 === 0 && Math.random() < 0.55) {
        this.note(scale[3 + Math.floor(Math.random() * 6)], 0.018, 2.6);
      }
    } else {
      // Tension: pulsing low bass plus short minor stabs
      this.note(this.beat % 4 === 0 ? 55 : 55 * 1.06, 0.05, 0.35, 'triangle');
      if (this.beat % 8 === 4) this.note(311.13, 0.018, 0.5, 'sawtooth');
    }
  }

  public playVictory() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const vb = this.buffers.victory;
    if (vb) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = vb;
        src.connect(this.sfxBus ?? this.master);
        src.start();
        return;
      } catch {
        // fall through to the generated fanfare
      }
    }
    const fanfare = [261.63, 329.63, 392, 523.25, 392, 523.25, 659.25, 783.99];
    fanfare.forEach((f, i) => this.tone(f, 'triangle', 0.5, 0.09, i * 0.18));
    this.tone(130.81, 'sine', 2.5, 0.08, 0);
  }

  public playDefeat() {
    [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(f, 'sine', 0.8, 0.08, i * 0.4));
  }

  private playChord() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || this.muted) return;
    if (this.hasMusicFile(this.currentMood())) return;
    const day = [
      [110.0, 164.81, 220.0, 261.63],
      [87.31, 130.81, 174.61, 220.0],
      [98.0, 130.81, 196.0, 261.63],
      [98.0, 146.83, 196.0, 246.94],
    ];
    const dark = [
      [110.0, 164.81, 220.0, 261.63],
      [103.83, 155.56, 207.65, 246.94],
      [87.31, 130.81, 174.61, 207.65],
      [82.41, 123.47, 164.81, 207.65],
    ];
    const set = this.state && (this.state.night || this.state.danger) ? dark : day;
    const chord = set[this.chordIndex % set.length];
    this.chordIndex += 1;
    const t = ctx.currentTime;
    chord.forEach((f, i) => {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 8;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.03 : 0.016, t + 2.2);
        g.gain.linearRampToValueAtTime(0, t + 7.6);
        osc.connect(g);
        g.connect(this.musicGain!);
        osc.start(t);
        osc.stop(t + 7.8);
      } catch {
        // ignore
      }
    });
  }

  private breathe() {
    const ctx = this.ctx;
    if (!ctx || !this.breathGain || !this.state?.onFoot) return;
    const t = ctx.currentTime;
    const v = this.state.danger ? 0.09 : 0.05;
    const g = this.breathGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(v, t + 0.6); // inhale
    g.linearRampToValueAtTime(0, t + 1.3);
    g.linearRampToValueAtTime(v * 0.8, t + 1.9); // exhale
    g.linearRampToValueAtTime(0, t + 2.9);
    this.breathFilter?.frequency.setValueAtTime(1100, t);
    this.breathFilter?.frequency.linearRampToValueAtTime(700, t + 2.9);
  }

  public updateAmbient(state: AmbientState | null) {
    this.state = state;
    const ctx = this.ctx;
    if (!ctx || !this.ambientOn) return;
    const t = ctx.currentTime;
    const windTarget = !state ? 0 : state.storm ? (state.outside ? 0.22 : 0.07) : state.outside ? 0.07 : 0.015;
    // Real Mars wind recording (if provided) replaces the generated wind
    if (this.fileGains.marsWind) {
      this.fileGains.marsWind.gain.setTargetAtTime(windTarget * 4, t, 0.6);
      this.windGain?.gain.setTargetAtTime(0, t, 0.3);
    } else {
      this.windGain?.gain.setTargetAtTime(windTarget, t, 0.6);
    }
    const mood = this.currentMood();
    const musicVol = state ? 0.35 : 0.2;
    this.fileGains.musicCalm?.gain.setTargetAtTime(mood === 'calm' ? musicVol : 0, t, 1.5);
    this.fileGains.musicExplore?.gain.setTargetAtTime(mood === 'explore' ? musicVol : 0, t, 1.5);
    this.fileGains.musicTension?.gain.setTargetAtTime(mood === 'tension' ? musicVol : 0, t, 1.0);
    this.windFilter?.frequency.setTargetAtTime(
      (state?.storm ? 700 : 380) + Math.sin(t * 0.4) * 150,
      t,
      0.5
    );
    this.humGain?.gain.setTargetAtTime(state && !state.outside ? 0.018 : 0, t, 0.4);
    this.musicGain?.gain.setTargetAtTime(state ? 1 : 0.5, t, 1);
  }

  public playQuindarBeep() {
    this.tone(2525, 'sine', 0.12, 0.07, 0);
  }

  public playSuccess() {
    this.tone(523.25, 'sine', 0.12, 0.1, 0);
    this.tone(659.25, 'sine', 0.12, 0.1, 0.09);
    this.tone(783.99, 'sine', 0.18, 0.12, 0.18);
  }

  public playAlert() {
    this.tone(440, 'triangle', 0.16, 0.1, 0);
    this.tone(330, 'triangle', 0.22, 0.1, 0.18);
  }

  public playAirlock() {
    this.tone(180, 'sine', 0.25, 0.09, 0);
    this.tone(240, 'sine', 0.25, 0.09, 0.15);
  }

  public playSoulHit() {
    this.tone(140, 'sawtooth', 0.12, 0.16, 0);
    this.tone(95, 'square', 0.18, 0.14, 0.06);
  }

  public playShieldBlock() {
    this.tone(880, 'triangle', 0.06, 0.09, 0);
    this.tone(1320, 'sine', 0.06, 0.07, 0.02);
  }

  public playJump() {
    this.tone(360, 'sine', 0.07, 0.06, 0);
  }

  public playImpact() {
    this.tone(86, 'square', 0.26, 0.15, 0);
  }

  public playDeflect() {
    this.tone(740, 'sine', 0.1, 0.09, 0);
    this.tone(1046, 'sine', 0.12, 0.08, 0.05);
  }
}

export const sound = new NasaAudio();
