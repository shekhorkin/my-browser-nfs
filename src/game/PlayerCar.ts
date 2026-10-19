import Phaser from 'phaser';
import { coast, FRICTION } from './carMovement';

const GEARS = [
  { label: 'R', maxSpeed: 180, acceleration: 240, direction: -1 },
  { label: 'N', maxSpeed: 0, acceleration: 0, direction: 0 },
  { label: '1', maxSpeed: 160, acceleration: 240, direction: 1 },
  { label: '2', maxSpeed: 300, acceleration: 180, direction: 1 },
  { label: '3', maxSpeed: 440, acceleration: 120, direction: 1 },
];
const REVERSE_GEAR = 0;
const NEUTRAL_GEAR = 1;
const MAX_SPEED = GEARS[GEARS.length - 1].maxSpeed;
const MAX_REVERSE_SPEED = GEARS[REVERSE_GEAR].maxSpeed;
const BRAKE_FORCE = 550;
const PLAYER_COLOR = 0x38bdf8;

export class PlayerCar {
  readonly body: Phaser.GameObjects.Rectangle;
  private speed = 0;
  private gear = NEUTRAL_GEAR;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.body = scene.add.rectangle(x, y, width, height, PLAYER_COLOR);
  }

  get currentSpeed(): number {
    return this.speed;
  }

  get currentGear(): string {
    return GEARS[this.gear].label;
  }

  update(seconds: number, gas: boolean, brake: boolean, shiftUp: boolean, shiftDown: boolean): void {
    this.shiftGear(shiftUp, shiftDown);

    const currentGear = GEARS[this.gear];
    if (gas && !brake && currentGear.direction !== 0) {
      const directionalSpeed = this.speed * currentGear.direction;
      if (directionalSpeed > currentGear.maxSpeed) {
        this.speed = currentGear.direction * Math.max(
          currentGear.maxSpeed, directionalSpeed - FRICTION * seconds
        );
      } else {
        this.speed = currentGear.direction * Math.min(
          currentGear.maxSpeed, directionalSpeed + currentGear.acceleration * seconds
        );
      }
    } else if (brake && !gas) {
      this.speed = Math.sign(this.speed) * Math.max(0, Math.abs(this.speed) - BRAKE_FORCE * seconds);
    } else if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - FRICTION * seconds);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + FRICTION * seconds);
    }

    this.speed = Phaser.Math.Clamp(this.speed, -MAX_REVERSE_SPEED, MAX_SPEED);
    this.body.x += this.speed * seconds;
  }

  shiftGear(shiftUp: boolean, shiftDown: boolean): void {
    let nextGear = this.gear;
    if (shiftUp && !shiftDown) {
      nextGear = Math.min(GEARS.length - 1, this.gear + 1);
    } else if (shiftDown && !shiftUp) {
      nextGear = Math.max(REVERSE_GEAR, this.gear - 1);
    }

    // Включать заднюю передачу и выходить из неё можно только после остановки.
    if (this.speed !== 0 && (this.gear === REVERSE_GEAR || nextGear === REVERSE_GEAR)) return;
    this.gear = nextGear;
  }

  launch(speed: number): void {
    const currentGear = GEARS[this.gear];
    this.speed = currentGear.direction * Math.min(currentGear.maxSpeed, Math.max(0, speed));
  }

  coast(seconds: number): void {
    const movement = coast(this.speed, seconds);
    this.body.x += movement.distance;
    this.speed = movement.speed;
  }
}
