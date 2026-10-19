import Phaser from 'phaser';
import { coast, FRICTION } from './carMovement';

const RIVAL_ACCELERATION = 170;
const RIVAL_MAX_SPEED = 400;
const RIVAL_COLOR = 0xef4444;

export class RivalCar {
  readonly body: Phaser.GameObjects.Rectangle;
  private speed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.body = scene.add.rectangle(x, y, width, height, RIVAL_COLOR);
  }

  update(seconds: number): void {
    this.speed = Math.min(RIVAL_MAX_SPEED, this.speed + RIVAL_ACCELERATION * seconds);
    this.body.x += this.speed * seconds;
  }

  coast(seconds: number, friction = FRICTION): void {
    const movement = coast(this.speed, seconds, friction);
    this.body.x += movement.distance;
    this.speed = movement.speed;
  }
}
