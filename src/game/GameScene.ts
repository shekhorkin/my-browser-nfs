
import Phaser from 'phaser';

// Параметры движения машины
const GEARS = [
  { maxSpeed: 160, acceleration: 240 },
  { maxSpeed: 300, acceleration: 180 },
  { maxSpeed: 440, acceleration: 120 },
];
const MAX_SPEED = GEARS[GEARS.length - 1].maxSpeed;
const MAX_REVERSE_SPEED = 180;
const BRAKE_FORCE = 550;
const FRICTION = 110;
const COUNTDOWN_SECONDS = 3;
const START_MESSAGE_SECONDS = 1;
const FINISH_POSITION_RATIO = 0.9;
const RIVAL_ACCELERATION = 170;
const RIVAL_MAX_SPEED = 300;
const LANE_SPACING = 80;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private rival!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private raceText!: Phaser.GameObjects.Text;
  private gearText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;

  private raceState: 'countdown' | 'racing' | 'finished' = 'countdown';
  private countdownRemaining = COUNTDOWN_SECONDS;
  private raceTime = 0;
  private finishX = 0;
  private speed = 0;
  private gear = 0;
  private rivalSpeed = 0;
  private rivalFinishTime: number | null = null;
  private playerFinishTime: number | null = null;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.speed = 0;
    this.raceState = 'countdown';
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.raceTime = 0;
    this.finishX = width * FINISH_POSITION_RATIO;
    this.gear = 0;
    this.rivalSpeed = 0;
    this.rivalFinishTime = null;
    this.playerFinishTime = null;

    this.add
      .text(width / 2, 28, 'DRAG RACING', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);

    this.add.text(24, 96, '← / → — переключение передач | R — заново', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#cbd5e1',
    });

    this.add
      .text(
        width / 2,
        68,
        'Стрелка вверх — газ | Стрелка вниз — тормоз / задний ход',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#cbd5e1',
        }
      )
      .setOrigin(0.5, 0);

    // Машина начинает движение с левой стороны
    this.player = this.add.rectangle(
      width * 0.12,
      height / 2,
      42,
      42,
      0x38bdf8
    );
    this.rival = this.add.rectangle(
      this.player.x,
      this.player.y + LANE_SPACING,
      this.player.width,
      this.player.height,
      0xef4444
    );

    this.add.rectangle(this.finishX, height / 2 + LANE_SPACING / 2, 6, 180, 0xffffff);
    this.add.text(this.finishX, height / 2 - 120, 'Финиш', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.raceText = this.add.text(
      width / 2,
      height / 2 - 160,
      String(COUNTDOWN_SECONDS),
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }
    ).setOrigin(0.5, 0);

    this.gearText = this.add.text(width - 200, height - 48, 'Передача: 1', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    });

    this.speedText = this.add.text(width / 2, height - 48, 'Скорость: 0 пикс/с', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.restartKey.reset();
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
      return;
    }

    let seconds = delta / 1000;
    if (this.raceState === 'countdown') {
      this.countdownRemaining -= seconds;
      // Сбрасываем нажатия переключения, сделанные до старта.
      Phaser.Input.Keyboard.JustDown(this.cursors.right);
      Phaser.Input.Keyboard.JustDown(this.cursors.left);
      if (this.countdownRemaining > 0) {
        this.raceText.setText(String(Math.ceil(this.countdownRemaining)));
        return;
      }
      seconds = -this.countdownRemaining;
      this.raceState = 'racing';
      this.raceText.setText('Старт!');
    }

    this.raceTime += seconds;
    if (this.raceState === 'racing' && this.raceTime >= START_MESSAGE_SECONDS) {
      this.raceText.setText('');
    }
    this.updateRival(seconds);
    this.updatePlayer(seconds);

    if (this.raceState === 'racing' && this.playerFinishTime !== null && this.rivalFinishTime !== null) {
      this.raceState = 'finished';
      const result = this.playerFinishTime < this.rivalFinishTime
        ? 'Победа!'
        : this.playerFinishTime === this.rivalFinishTime ? 'Ничья!' : 'Поражение!';
      this.raceText.setText(
        `${result}\nТвоё время: ${this.playerFinishTime.toFixed(2)} с\nСоперник: ${this.rivalFinishTime.toFixed(2)} с`
      );
    }
  }

  private updatePlayer(seconds: number): void {
    if (this.playerFinishTime !== null) {
      const movement = this.coast(this.speed, seconds);
      this.player.x += movement.distance;
      this.speed = movement.speed;
      this.speedText.setText(`Скорость: ${Math.round(this.speed)} пикс/с`);
      return;
    }

    this.updateGear();
    const currentGear = GEARS[this.gear];

    // Газ — ускорение вперёд
    if (this.cursors.up.isDown && !this.cursors.down.isDown) {
      if (this.speed > currentGear.maxSpeed) {
        // После понижения передачи плавно снижаем скорость до её предела.
        this.speed = Math.max(currentGear.maxSpeed, this.speed - FRICTION * seconds);
      } else {
        const acceleration = this.speed < 0 ? GEARS[0].acceleration : currentGear.acceleration;
        this.speed = Math.min(currentGear.maxSpeed, this.speed + acceleration * seconds);
      }
    }

    // Тормоз — замедление и переход на задний ход
    else if (this.cursors.down.isDown && !this.cursors.up.isDown) {
      this.speed -= BRAKE_FORCE * seconds;
    }

    // Если кнопки отпущены — плавное замедление
    else {
      if (this.speed > 0) {
        this.speed = Math.max(
          0,
          this.speed - FRICTION * seconds
        );
      } else if (this.speed < 0) {
        this.speed = Math.min(
          0,
          this.speed + FRICTION * seconds
        );
      }
    }

    // Ограничиваем максимальную скорость
    // вперёд и назад
    this.speed = Phaser.Math.Clamp(
      this.speed,
      -MAX_REVERSE_SPEED,
      MAX_SPEED
    );

    this.speedText.setText(`Скорость: ${Math.round(this.speed)} пикс/с`);

    // Горизонтальное движение квадрата
    // Положительная скорость — вправо
    // Отрицательная скорость — влево
    const previousX = this.player.x;
    this.player.x += this.speed * seconds;

    if (this.player.x + this.player.width / 2 >= this.finishX) {
      // Учитываем только часть кадра до пересечения линии передней гранью.
      const finishCenterX = this.finishX - this.player.width / 2;
      const frameFraction = (finishCenterX - previousX) / (this.player.x - previousX);
      this.playerFinishTime = this.raceTime - seconds * (1 - frameFraction);
      const movement = this.coast(this.speed, seconds * (1 - frameFraction));
      this.player.x = finishCenterX + movement.distance;
      this.speed = movement.speed;
      this.speedText.setText(`Скорость: ${Math.round(this.speed)} пикс/с`);
    }

    if (this.playerFinishTime === null) this.keepPlayerOnScreen();
  }

  private updateRival(seconds: number): void {
    if (this.rivalFinishTime !== null) {
      const movement = this.coast(this.rivalSpeed, seconds);
      this.rival.x += movement.distance;
      this.rivalSpeed = movement.speed;
      return;
    }

    this.rivalSpeed = Math.min(RIVAL_MAX_SPEED, this.rivalSpeed + RIVAL_ACCELERATION * seconds);
    const previousX = this.rival.x;
    this.rival.x += this.rivalSpeed * seconds;

    const finishCenterX = this.finishX - this.rival.width / 2;
    if (this.rival.x >= finishCenterX) {
      const frameFraction = (finishCenterX - previousX) / (this.rival.x - previousX);
      this.rivalFinishTime = this.raceTime - seconds * (1 - frameFraction);
      const movement = this.coast(this.rivalSpeed, seconds * (1 - frameFraction));
      this.rival.x = finishCenterX + movement.distance;
      this.rivalSpeed = movement.speed;
    }
  }

  private coast(speed: number, seconds: number): { speed: number; distance: number } {
    // После финиша остаётся только трение. Не даём машине поехать назад.
    const movingSeconds = Math.min(seconds, speed / FRICTION);
    return {
      speed: Math.max(0, speed - FRICTION * seconds),
      distance: speed * movingSeconds - FRICTION * movingSeconds * movingSeconds / 2,
    };
  }

  private updateGear(): void {
    const shiftUp = Phaser.Input.Keyboard.JustDown(this.cursors.right);
    const shiftDown = Phaser.Input.Keyboard.JustDown(this.cursors.left);

    if (shiftUp && !shiftDown) {
      this.gear = Math.min(GEARS.length - 1, this.gear + 1);
    } else if (shiftDown && !shiftUp) {
      this.gear = Math.max(0, this.gear - 1);
    }

    this.gearText.setText(`Передача: ${this.gear + 1}`);
  }

  private keepPlayerOnScreen(): void {
    const half = this.player.width / 2;

    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      half,
      this.scale.width - half
    );

    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      110 + half,
      this.scale.height - half
    );
  }

}
