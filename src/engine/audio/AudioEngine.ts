import type { AudioConfig } from '../theme/ThemeConfig';
import { clamp } from '../util/math';

/** Speed at which wind and rumble reach full strength, m/s. */
const FULL_SPEED = 28;
const RAMP = 0.08;

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
 * user gesture (dispatching the train) and every voice follows the train's speed.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private clackGain: GainNode | null = null;
  private clackRate: OscillatorNode | null = null;
  private chainGain: GainNode | null = null;
  private mutedFlag = false;

  constructor(private readonly config: AudioConfig) {}

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

    // Wind: white noise through a band-pass whose centre rises with speed.
    const wind = loopSource(context, noiseBuffer(context, 2, false));
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.7;
    windFilter.frequency.value = this.config.wind.minPitch;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    this.windFilter = windFilter;
    this.windGain = windGain;

    // Rumble: brown noise and a low sawtooth, both low-passed, with a clacking tremolo.
    const rumble = loopSource(context, noiseBuffer(context, 3, true));
    const rumbleFilter = context.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    const rumbleOsc = context.createOscillator();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.value = this.config.rumble.minPitch;
    const oscGain = context.createGain();
    oscGain.gain.value = 0.18;
    const clackGain = context.createGain();
    clackGain.gain.value = 1;
    const clackRate = context.createOscillator();
    clackRate.type = 'sine';
    clackRate.frequency.value = 4;
    const clackDepth = context.createGain();
    clackDepth.gain.value = 0.35;
    clackRate.connect(clackDepth).connect(clackGain.gain);
    const rumbleGain = context.createGain();
    rumbleGain.gain.value = 0;
    rumble.connect(rumbleFilter);
    rumbleOsc.connect(oscGain).connect(rumbleFilter);
    rumbleFilter.connect(clackGain).connect(rumbleGain).connect(master);
    rumble.start();
    rumbleOsc.start();
    clackRate.start();
    this.rumbleFilter = rumbleFilter;
    this.rumbleOsc = rumbleOsc;
    this.rumbleGain = rumbleGain;
    this.clackGain = clackGain;
    this.clackRate = clackRate;

    // Chain lift: a slow mechanical clank.
    const chainOsc = context.createOscillator();
    chainOsc.type = 'square';
    chainOsc.frequency.value = 52;
    const chainFilter = context.createBiquadFilter();
    chainFilter.type = 'lowpass';
    chainFilter.frequency.value = 220;
    const chainTick = context.createOscillator();
    chainTick.type = 'square';
    chainTick.frequency.value = 5.5;
    const chainTickDepth = context.createGain();
    chainTickDepth.gain.value = 0.5;
    const chainAm = context.createGain();
    chainAm.gain.value = 0.5;
    chainTick.connect(chainTickDepth).connect(chainAm.gain);
    const chainGain = context.createGain();
    chainGain.gain.value = 0;
    chainOsc.connect(chainFilter).connect(chainAm).connect(chainGain).connect(master);
    chainOsc.start();
    chainTick.start();
    this.chainGain = chainGain;
  }

  /** Drives every voice from the train's state. Safe to call before `start()`. */
  update(speed: number, onChain: boolean): void {
    const context = this.context;
    if (!context) return;
    const t = context.currentTime;
    const factor = clamp(Math.abs(speed) / FULL_SPEED, 0, 1);
    const { wind, rumble } = this.config;

    this.windFilter?.frequency.setTargetAtTime(
      wind.minPitch + (wind.maxPitch - wind.minPitch) * factor,
      t,
      RAMP,
    );
    this.windGain?.gain.setTargetAtTime(factor * factor * wind.gain, t, RAMP);

    this.rumbleFilter?.frequency.setTargetAtTime(90 + 260 * factor, t, RAMP);
    this.rumbleOsc?.frequency.setTargetAtTime(
      rumble.minPitch + (rumble.maxPitch - rumble.minPitch) * factor,
      t,
      RAMP,
    );
    this.rumbleGain?.gain.setTargetAtTime(Math.sqrt(factor) * rumble.gain, t, RAMP);
    this.clackRate?.frequency.setTargetAtTime(2 + 14 * factor, t, RAMP);
    this.clackGain?.gain.setTargetAtTime(1, t, RAMP);

    this.chainGain?.gain.setTargetAtTime(onChain ? 0.22 : 0, t, 0.15);
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.05);
    }
  }

  /** Fades everything out, for leaving ride mode. */
  silence(): void {
    this.update(0, false);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }
}
