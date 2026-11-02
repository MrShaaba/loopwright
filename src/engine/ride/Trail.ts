import type { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import {
  createRingSpriteTexture,
  createSoftDiscTexture,
  createSparkTexture,
} from '../scene/textures';
import { clamp } from '../util/math';
import type { Rgb } from './skins';
import { getTrail, type TrailParticles, type TrailSprite, type TrailStyle } from './trails';

/** Speed at which a trail emits at its full rate, m/s. */
const FULL_SPEED = 28;
const CAPACITY = 500;

/**
 * The effect that follows the ball: a particle system rebuilt from a trail recipe. Particles are
 * born in world space at the ball's position, so they stay behind as the ball moves on.
 */
export class Trail {
  private system: ParticleSystem | null = null;
  private style: TrailStyle = getTrail('none');
  private readonly textures = new Map<TrailSprite, DynamicTexture>();
  private readonly ballColor = new Color3(1, 1, 1);
  private readonly emitter = new Vector3(0, -100, 0);
  private readonly direction1 = new Vector3();
  private readonly direction2 = new Vector3();

  constructor(private readonly scene: Scene) {}

  get styleId(): string {
    return this.style.id;
  }

  /** Swaps the recipe. The ball colour is what `theme` coloured recipes take. */
  setStyle(style: TrailStyle, ballColor: Color3): void {
    this.style = style;
    this.ballColor.copyFrom(ballColor);
    this.system?.dispose(false);
    this.system = null;
    if (style.particles) this.system = this.build(style.particles);
  }

  setBallColor(color: Color3): void {
    this.ballColor.copyFrom(color);
    if (this.style.particles?.color === 'theme') this.setStyle(this.style, color);
  }

  private texture(sprite: TrailSprite): DynamicTexture {
    let texture = this.textures.get(sprite);
    if (!texture) {
      switch (sprite) {
        case 'disc':
          texture = createSoftDiscTexture(this.scene, 'trailDisc', 64);
          break;
        case 'spark':
          texture = createSparkTexture(this.scene, 'trailSpark', 32);
          break;
        case 'ring':
          texture = createRingSpriteTexture(this.scene, 'trailRing', 64);
          break;
      }
      this.textures.set(sprite, texture);
    }
    return texture;
  }

  private build(recipe: TrailParticles): ParticleSystem {
    const system = new ParticleSystem('trail', CAPACITY, this.scene);
    system.particleTexture = this.texture(recipe.sprite);
    system.emitter = this.emitter;
    system.isLocal = false;
    system.minEmitBox = new Vector3(-recipe.spread, -recipe.spread, -recipe.spread);
    system.maxEmitBox = new Vector3(recipe.spread, recipe.spread, recipe.spread);
    system.direction1 = this.direction1;
    system.direction2 = this.direction2;
    this.aim(recipe, null);
    system.minLifeTime = recipe.life[0];
    system.maxLifeTime = recipe.life[1];
    // With size gradients Babylon ignores minSize and maxSize: the gradient is the size itself.
    system.addSizeGradient(0, recipe.size[0], recipe.size[1]);
    system.addSizeGradient(1, recipe.size[0] * recipe.endSize, recipe.size[1] * recipe.endSize);
    system.minEmitPower = recipe.power[0];
    system.maxEmitPower = recipe.power[1];
    system.gravity = new Vector3(0, recipe.gravity, 0);
    const first = this.rgb(recipe.color);
    const second = recipe.color2 ?? first;
    system.color1 = new Color4(first[0], first[1], first[2], recipe.alpha);
    system.color2 = new Color4(second[0], second[1], second[2], recipe.alpha);
    system.colorDead = new Color4(first[0] * 0.4, first[1] * 0.4, first[2] * 0.4, 0);
    system.blendMode = ParticleSystem.BLENDMODE_ADD;
    system.emitRate = 0;
    system.updateSpeed = 1 / 60;
    system.start();
    return system;
  }

  private rgb(color: 'theme' | Rgb): Rgb {
    return color === 'theme' ? [this.ballColor.r, this.ballColor.g, this.ballColor.b] : color;
  }

  /**
   * Points the emit cone for the recipe's drift. Every drift leans away from the ball's heading,
   * because the camera rides just behind the ball and a particle born into the lens fills the frame.
   */
  private aim(recipe: TrailParticles, heading: Vector3 | null): void {
    const hx = heading ? -heading.x : 0;
    const hy = heading ? -heading.y : 0;
    const hz = heading ? -heading.z : -1;
    switch (recipe.drift) {
      case 'behind':
        this.direction1.set(hx - 0.15, hy - 0.15, hz - 0.15);
        this.direction2.set(hx + 0.15, hy + 0.15, hz + 0.15);
        break;
      case 'up':
        this.direction1.set(hx * 0.3 - 0.35, 1, hz * 0.3 - 0.35);
        this.direction2.set(hx * 0.3 + 0.35, 1, hz * 0.3 + 0.35);
        break;
      case 'random':
        this.direction1.set(hx * 0.6 - 0.7, hy * 0.6 - 0.7, hz * 0.6 - 0.7);
        this.direction2.set(hx * 0.6 + 0.7, hy * 0.6 + 0.7, hz * 0.6 + 0.7);
        break;
    }
  }

  /** Feeds the ball's position, heading and effective speed; nothing emits when standing still. */
  update(position: Vector3, heading: Vector3, speed: number): void {
    const system = this.system;
    const recipe = this.style.particles;
    if (!system || !recipe) return;
    this.emitter.copyFrom(position);
    this.aim(recipe, heading);
    const factor = speed < 0.5 ? 0 : clamp(speed / FULL_SPEED, 0.25, 1.6);
    system.emitRate = recipe.rate * factor;
  }

  dispose(): void {
    this.system?.dispose(false);
    this.system = null;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
