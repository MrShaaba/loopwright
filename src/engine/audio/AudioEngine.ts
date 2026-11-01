import { clamp } from '../util/math';

/** Speed at which wind and roll reach full strength, m/s. */
const FULL_SPEED = 32;
const RAMP = 0.08;
const WIND = { minPitch: 140, maxPitch: 1100, gain: 0.5 };
const ROLL = { minPitch: 34, maxPitch: 150, gain: 0.42 };

function noiseBuffer(context: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loopSource(context: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/**
 * All sound is synthesised with Web Audio: no files. The context is created on the first
 * user gesture (starting the ride) and every voice follows the ball's speed.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollOsc: OscillatorNode | null = null;
  private fx: GainNode | null = null;
  private mutedFlag = false;

  get muted(): boolean {
    return this.mutedFlag;
  }

  get ready(): boolean {
    return this.context !== null;
  }

  /** Builds the graph. Must be called from a user gesture the first time. */
  start(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const context = new AudioContext();
    this.context = context;
    const master = context.createGain();
    master.gain.value = this.mutedFlag ? 0 : 1;
    master.connect(context.destination);
    this.master = master;
    const fx = context.createGain();
    fx.gain.value = 0.9;
    fx.connect(master);
    this.fx = fx;

    // Wind: white noise through a band-pass whose centre rises with speed.
    const wind = loopSource(context, noiseBuffer(context, 2, false));
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.7;
    windFilter.frequency.value = WIND.minPitch;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    this.windFilter = windFilter;
    this.windGain = windGain;

    // Roll: brown noise and a low sine, both low-passed, the hum of a ball on glass.
    const roll = loopSource(context, noiseBuffer(context, 3, true));
    const rollFilter = context.createBiquadFilter();
    rollFilter.type = 'lowpass';
    rollFilter.frequency.value = 120;
    const rollOsc = context.createOscillator();
    rollOsc.type = 'triangle';
    rollOsc.frequency.value = ROLL.minPitch;
    const oscGain = context.createGain();
    oscGain.gain.value = 0.22;
    const rollGain = context.createGain();
    rollGain.gain.value = 0;
    roll.connect(rollFilter);
    rollOsc.connect(oscGain).connect(rollFilter);
    rollFilter.connect(rollGain).connect(master);
    roll.start();
    rollOsc.start();
    this.rollFilter = rollFilter;
    this.rollOsc = rollOsc;
    this.rollGain = rollGain;
  }

  /** Drives every voice from the ball's effective speed in m/s. Safe to call before `start()`. */
  update(speed: number): void {
    const context = this.context;
    if (!context) return;
    const t = context.currentTime;
    const factor = clamp(Math.abs(speed) / FULL_SPEED, 0, 1);
    this.windFilter?.frequency.setTargetAtTime(
      WIND.minPitch + (WIND.maxPitch - WIND.minPitch) * factor,
      t,
      RAMP,
    );
    this.windGain?.gain.setTargetAtTime(factor * factor * WIND.gain, t, RAMP);
    this.rollFilter?.frequency.setTargetAtTime(90 + 320 * factor, t, RAMP);
    this.rollOsc?.frequency.setTargetAtTime(
      ROLL.minPitch + (ROLL.maxPitch - ROLL.minPitch) * factor,
      t,
      RAMP,
    );
    this.rollGain?.gain.setTargetAtTime(Math.sqrt(factor) * ROLL.gain, t, RAMP);
  }

  /** A short two-note chime for a ring; the pitch climbs with the combo and settles after a dozen. */
  chime(combo: number): void {
    const context = this.context;
    const fx = this.fx;
    if (!context || !fx) return;
    const t = context.currentTime;
    const semitone = Math.min(12, Math.max(0, combo - 1));
    const base = 660 * Math.pow(2, semitone / 12);
    for (const [offset, ratio, gain] of [
      [0, 1, 0.22],
      [0.06, 1.5, 0.16],
    ] as const) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = base * ratio;
      const env = context.createGain();
      env.gain.setValueAtTime(0, t + offset);
      env.gain.linearRampToValueAtTime(gain, t + offset + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.22);
      osc.connect(env).connect(fx);
      osc.start(t + offset);
      osc.stop(t + offset + 0.25);
    }
  }

  /** A gem: a quick rising run of bright notes with a shimmer on top. */
  sparkle(): void {
    const context = this.context;
    const fx = this.fx;
    if (!context || !fx) return;
    const t = context.currentTime;
    const notes = [880, 1174.7, 1480, 1760, 2349.3];
    notes.forEach((frequency, index) => {
      const osc = context.createOscillator();
      osc.type = index === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      const env = context.createGain();
      const start = t + index * 0.055;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.16, start + 0.01);
      env.gain.exponentialRampToValueAtTime(
        0.001,
        start + (index === notes.length - 1 ? 0.6 : 0.2),
      );
      osc.connect(env).connect(fx);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }

  /** A boost pad: a band-passed noise sweep rising through the burst. */
  whoosh(): void {
    const context = this.context;
    const fx = this.fx;
    if (!context || !fx) return;
    const t = context.currentTime;
    const source = loopSource(context, noiseBuffer(context, 1, false));
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.9);
    const env = context.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    source.connect(filter).connect(env).connect(fx);
    source.start(t);
    source.stop(t + 1);
  }

  /** A hazard: a low thud with a short burst of noise. */
  thud(): void {
    const context = this.context;
    const fx = this.fx;
    if (!context || !fx) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const env = context.createGain();
    env.gain.setValueAtTime(0.6, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(env).connect(fx);
    osc.start(t);
    osc.stop(t + 0.4);
    const burst = loopSource(context, noiseBuffer(context, 0.3, false));
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const burstEnv = context.createGain();
    burstEnv.gain.setValueAtTime(0.35, t);
    burstEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    burst.connect(filter).connect(burstEnv).connect(fx);
    burst.start(t);
    burst.stop(t + 0.2);
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.05);
    }
  }

  /** Fades everything out, for leaving ride mode or pausing. */
  silence(): void {
    this.update(0);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }
}
