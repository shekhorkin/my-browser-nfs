import Phaser from 'phaser';
import { coast, FRICTION } from './carMovement';

const RIVAL_ACCELERATION = 170;
const RIVAL_MAX_SPEED = 400;
const RIVAL_COLOR = 0xef4444;

export class RivalCar {
  readonly body: Phaser.GameObjects.Rectangle;
  private speed = 0;

  constructor(
    scene: Phaser.Scene, x: number, y: number, width: number, height: number,
    private readonly maxSpeed = RIVAL_MAX_SPEED,
    private readonly acceleration = RIVAL_ACCELERATION,
    color = RIVAL_COLOR
  ) {
    this.body = scene.add.rectangle(x, y, width, height, color);
  }

  update(seconds: number): void {
    this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * seconds);
    this.body.x += this.speed * seconds;
  }

  coast(seconds: number, friction = FRICTION): void {
    const movement = coast(this.speed, seconds, friction);
    this.body.x += movement.distance;
    this.speed = movement.speed;
  }
}
