import { rangeFrom } from '../util/random';
import { nextDegree, noteFrequency, stepSeconds, type MusicSpec } from './music';

/** How often the scheduler wakes, and how far ahead it books notes. Seconds. */
const TICK = 0.12;
const LOOKAHEAD = 0.45;
const FADE_IN = 2.5;

/**
 * One theme's ambient bed, synthesised live: a detuned drone under a slow low-pass sweep, a
 * random walk melody over the theme's scale with an echo, and for some themes a pulse.
 * Everything is scheduled a little ahead on the audio clock, so timing does not depend on
 * the frame rate.
 */
export class MusicBed {
  private readonly bus: GainNode;
  private readonly nodes: AudioNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNote = 0;
  private nextStep = 0;
  private step = 0;
  private degree = 0;
  private lastFrequency = 0;
  private echo: DelayNode | null = null;
  private stopped = false;

  constructor(
    private readonly context: AudioContext,
    out: AudioNode,
    private readonly spec: MusicSpec,
    private readonly random: () => number = Math.random,
  ) {
    this.bus = context.createGain();
    this.bus.gain.setValueAtTime(0, context.currentTime);
    this.bus.gain.linearRampToValueAtTime(1, context.currentTime + FADE_IN);
    this.bus.connect(out);
    this.buildDrone();
    this.buildEcho();
    this.degree = Math.floor(this.random() * spec.scale.length);
    this.nextNote = context.currentTime + 1.2;
    this.nextStep = context.currentTime + 0.5;
    this.timer = setInterval(() => this.schedule(), TICK * 1000);
    this.schedule();
  }

  private buildDrone(): void {
    const { drone, root } = this.spec;
    const t = this.context.currentTime;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = drone.cutoff;
    filter.Q.value = 0.8;
    const level = this.context.createGain();
    level.gain.value = drone.gain / (drone.layers.length * 2);
    filter.connect(level).connect(this.bus);
    // The sweep: a slow sine wobbling the cutoff.
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = drone.lfoRate;
    const depth = this.context.createGain();
    depth.gain.value = drone.lfoDepth;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start(t);
    this.nodes.push(lfo, depth, filter, level);
    for (const layer of drone.layers) {
      for (const sign of [-1, 1]) {
        const osc = this.context.createOscillator();
        osc.type = drone.wave;
        osc.frequency.value = root * layer;
        osc.detune.value = sign * drone.detune;
        osc.connect(filter);
        osc.start(t);
        this.nodes.push(osc);
      }
    }
  }

  private buildEcho(): void {
    const { echo } = this.spec.melody;
    if (echo <= 0) return;
    const delay = this.context.createDelay(2);
    delay.delayTime.value = echo;
    const feedback = this.context.createGain();
    feedback.gain.value = 0.38;
    const tone = this.context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    delay.connect(tone).connect(feedback).connect(delay);
    const wet = this.context.createGain();
    wet.gain.value = 0.6;
    delay.connect(wet).connect(this.bus);
    this.echo = delay;
    this.nodes.push(delay, feedback, tone, wet);
  }

  private schedule(): void {
    if (this.stopped) return;
    const horizon = this.context.currentTime + LOOKAHEAD;
    while (this.nextNote < horizon) {
      this.playNote(this.nextNote);
      this.nextNote += rangeFrom(this.random, ...this.spec.melody.interval);
    }
    const pulse = this.spec.pulse;
    if (!pulse) return;
    const length = stepSeconds(pulse.bpm);
    while (this.nextStep < horizon) {
      const semitone = pulse.pattern[this.step % pulse.pattern.length] ?? -1;
      if (semitone >= 0) this.playPulse(this.nextStep, semitone);
      this.step++;
      this.nextStep += length;
    }
  }

  private playNote(at: number): void {
    const { melody, scale, root } = this.spec;
    this.degree = nextDegree(scale, this.degree, this.random);
    const frequency = noteFrequency(root, melody.octave, scale[this.degree] ?? 0);
    const osc = this.context.createOscillator();
    osc.type = melody.wave;
    if (melody.glide > 0 && this.lastFrequency > 0) {
      osc.frequency.setValueAtTime(this.lastFrequency, at);
      osc.frequency.exponentialRampToValueAtTime(frequency, at + melody.glide);
    } else {
      osc.frequency.setValueAtTime(frequency, at);
    }
    this.lastFrequency = frequency;
    const env = this.context.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(melody.gain, at + melody.attack);
    env.gain.exponentialRampToValueAtTime(0.0005, at + melody.attack + melody.release);
    osc.connect(env).connect(this.bus);
    if (this.echo) env.connect(this.echo);
    osc.start(at);
    osc.stop(at + melody.attack + melody.release + 0.05);
  }

  private playPulse(at: number, semitone: number): void {
    const pulse = this.spec.pulse;
    if (!pulse) return;
    const osc = this.context.createOscillator();
    osc.type = pulse.wave;
    osc.frequency.value = noteFrequency(this.spec.root, 0.5, semitone);
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(pulse.cutoff * 2, at);
    filter.frequency.exponentialRampToValueAtTime(pulse.cutoff * 0.5, at + pulse.decay);
    const env = this.context.createGain();
    env.gain.setValueAtTime(pulse.gain, at);
    env.gain.exponentialRampToValueAtTime(0.0005, at + pulse.decay);
    osc.connect(filter).connect(env).connect(this.bus);
    osc.start(at);
    osc.stop(at + pulse.decay + 0.05);
  }

  /** Fades out over `seconds` and tears the graph down after. */
  stop(seconds = 1.2): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + seconds);
    setTimeout(() => this.teardown(), seconds * 1000 + 100);
  }

  private teardown(): void {
    for (const node of this.nodes) {
      if (node instanceof OscillatorNode) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      node.disconnect();
    }
    this.nodes.length = 0;
    this.bus.disconnect();
  }
}
