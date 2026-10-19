
import Phaser from 'phaser';
import { RivalCar } from './RivalCar';
import { PlayerCar } from './PlayerCar';

const RED_SIGNAL_COUNT = 3;
const RED_SIGNAL_INTERVAL = 1;
const GREEN_DELAY_MIN = 1;
const GREEN_DELAY_MAX = 2;
const SIGNAL_RADIUS = 16;
const SIGNAL_SPACING = 48;
const RED_SIGNAL_COLOR = 0xef4444;
const GREEN_SIGNAL_COLOR = 0x22c55e;
const SIGNAL_OFF_ALPHA = 0.2;
const FINISH_POSITION_RATIO = 0.9;
const LANE_SPACING = 80;
const FALSE_START_SPEED = 90;
const PAUSE_OVERLAY_DEPTH = 100;

export class GameScene extends Phaser.Scene {
  private player!: PlayerCar;
  private rival!: RivalCar;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private isPaused = false;
  private raceText!: Phaser.GameObjects.Text;
  private gearText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private startLights: Phaser.GameObjects.Arc[] = [];

  private raceState: 'countdown' | 'racing' | 'finished' | 'falseStart' = 'countdown';
  private countdownElapsed = 0;
  private greenSignalTime = 0;
  private raceTime = 0;
  private finishX = 0;
  private rivalFinishTime: number | null = null;
  private playerFinishTime: number | null = null;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.raceState = 'countdown';
    this.isPaused = false;
    this.countdownElapsed = 0;
    this.greenSignalTime = RED_SIGNAL_COUNT * RED_SIGNAL_INTERVAL
      + Phaser.Math.FloatBetween(GREEN_DELAY_MIN, GREEN_DELAY_MAX);
    this.startLights = [];
    this.raceTime = 0;
    this.finishX = width * FINISH_POSITION_RATIO;
    this.rivalFinishTime = null;
    this.playerFinishTime = null;

    this.add
      .text(width / 2, 28, 'DRAG RACING', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);

    this.add.text(24, 96, '← / → — передачи R–N–1–2–3 | R — заново | P — пауза', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#cbd5e1',
    });

    this.add
      .text(
        width / 2,
        68,
        '↑ — газ (на N не разгоняет) | ↓ — тормоз | Задняя — после остановки',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#cbd5e1',
        }
      )
      .setOrigin(0.5, 0);

    // Машина начинает движение с левой стороны
    this.player = new PlayerCar(
      this,
      width * 0.12,
      height / 2,
      42,
      42
    );
    this.rival = new RivalCar(
      this,
      this.player.body.x,
      this.player.body.y + LANE_SPACING,
      this.player.body.width,
      this.player.body.height
    );

    this.add.rectangle(this.finishX, height / 2 + LANE_SPACING / 2, 6, 180, 0xffffff);
    this.add.text(this.finishX, height / 2 - 120, 'Финиш', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    const signalsY = height - 150;
    this.add.rectangle(width / 2, signalsY, SIGNAL_SPACING * 4, SIGNAL_RADIUS * 3, 0x1e293b)
      .setStrokeStyle(2, 0x64748b);
    for (let index = 0; index <= RED_SIGNAL_COUNT; index += 1) {
      const color = index < RED_SIGNAL_COUNT ? RED_SIGNAL_COLOR : GREEN_SIGNAL_COLOR;
      this.startLights.push(this.add.circle(
        width / 2 + (index - RED_SIGNAL_COUNT / 2) * SIGNAL_SPACING,
        signalsY,
        SIGNAL_RADIUS,
        color
      ).setAlpha(SIGNAL_OFF_ALPHA));
    }

    this.raceText = this.add.text(
      width / 2,
      height / 2 - 160,
      'Жди зелёного!\nГаз на передаче до старта — фальстарт.',
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }
    ).setOrigin(0.5, 0);

    this.gearText = this.add.text(width - 200, height - 48, `Передача: ${this.player.currentGear}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    });

    this.speedText = this.add.text(width / 2, height - 48, 'Скорость: 0 пикс/с', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.pauseOverlay = this.add.container(width / 2, height / 2, [
      this.add.rectangle(0, 0, width, height, 0x000000, 0.65),
      this.add.rectangle(0, 0, 360, 160, 0x1e293b).setStrokeStyle(2, 0x64748b),
      this.add.text(0, 0, 'Пауза\nP — продолжить\nR — заново', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
      }).setOrigin(0.5),
    ]).setDepth(PAUSE_OVERLAY_DEPTH).setVisible(false);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.restartKey.reset();
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pauseKey.reset();
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
      return;
    }

    const pausePressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
    if (pausePressed) {
      this.isPaused = !this.isPaused;
      this.pauseOverlay.setVisible(this.isPaused);
    }
    if (this.isPaused || pausePressed) {
      // Не переносим переключения передач из паузы в гонку.
      Phaser.Input.Keyboard.JustDown(this.cursors.right);
      Phaser.Input.Keyboard.JustDown(this.cursors.left);
      return;
    }

    if (this.raceState === 'falseStart') {
      this.player.coast(delta / 1000);
      this.speedText.setText(`Скорость: ${Math.round(this.player.currentSpeed)} пикс/с`);
      return;
    }

    let seconds = delta / 1000;
    if (this.raceState === 'countdown') {
      this.countdownElapsed += seconds;
      const greenIsOn = this.countdownElapsed >= this.greenSignalTime;
      this.startLights.forEach((light, index) => {
        const isOn = index < RED_SIGNAL_COUNT
          ? !greenIsOn && this.countdownElapsed >= (index + 1) * RED_SIGNAL_INTERVAL
          : greenIsOn;
        light.setAlpha(isOn ? 1 : SIGNAL_OFF_ALPHA);
      });
      // Передачу можно выбрать заранее, движение разрешено только на зелёный.
      this.player.shiftGear(
        Phaser.Input.Keyboard.JustDown(this.cursors.right),
        Phaser.Input.Keyboard.JustDown(this.cursors.left)
      );
      this.gearText.setText(`Передача: ${this.player.currentGear}`);
      if (!greenIsOn && this.cursors.up.isDown && this.player.currentGear !== 'N') {
        this.raceState = 'falseStart';
        this.player.launch(FALSE_START_SPEED);
        this.speedText.setText(`Скорость: ${Math.round(this.player.currentSpeed)} пикс/с`);
        this.raceText.setText('Фальстарт! Поражение.\nR — заново');
        return;
      }
      if (!greenIsOn) return;
      seconds = this.countdownElapsed - this.greenSignalTime;
      this.raceState = 'racing';
      this.raceText.setText('');
    }

    this.raceTime += seconds;
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
      this.player.coast(seconds);
      this.speedText.setText(`Скорость: ${Math.round(this.player.currentSpeed)} пикс/с`);
      return;
    }

    const previousX = this.player.body.x;
    this.player.update(
      seconds,
      this.cursors.up.isDown,
      this.cursors.down.isDown,
      Phaser.Input.Keyboard.JustDown(this.cursors.right),
      Phaser.Input.Keyboard.JustDown(this.cursors.left)
    );
    this.gearText.setText(`Передача: ${this.player.currentGear}`);
    this.speedText.setText(`Скорость: ${Math.round(this.player.currentSpeed)} пикс/с`);

    if (this.player.body.x + this.player.body.width / 2 >= this.finishX) {
      // Учитываем только часть кадра до пересечения линии передней гранью.
      const finishCenterX = this.finishX - this.player.body.width / 2;
      const frameFraction = (finishCenterX - previousX) / (this.player.body.x - previousX);
      this.playerFinishTime = this.raceTime - seconds * (1 - frameFraction);
      this.player.body.x = finishCenterX;
      this.player.coast(seconds * (1 - frameFraction));
      this.speedText.setText(`Скорость: ${Math.round(this.player.currentSpeed)} пикс/с`);
    }

    if (this.playerFinishTime === null) this.keepPlayerOnScreen();
  }

  private updateRival(seconds: number): void {
    if (this.rivalFinishTime !== null) {
      this.rival.coast(seconds);
      return;
    }

    const previousX = this.rival.body.x;
    this.rival.update(seconds);

    const finishCenterX = this.finishX - this.rival.body.width / 2;
    if (this.rival.body.x >= finishCenterX) {
      const frameFraction = (finishCenterX - previousX) / (this.rival.body.x - previousX);
      this.rivalFinishTime = this.raceTime - seconds * (1 - frameFraction);
      this.rival.body.x = finishCenterX;
      this.rival.coast(seconds * (1 - frameFraction));
    }
  }

  private keepPlayerOnScreen(): void {
    const half = this.player.body.width / 2;

    this.player.body.x = Phaser.Math.Clamp(
      this.player.body.x,
      half,
      this.scale.width - half
    );

    this.player.body.y = Phaser.Math.Clamp(
      this.player.body.y,
      110 + half,
      this.scale.height - half
    );
  }

}
