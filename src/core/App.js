import { Application } from 'pixi.js';
import { GameLoop } from './GameLoop.js';
import { GridSystem } from '../systems/GridSystem.js';
import { SlotSystem } from '../systems/SlotSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { FXSystem } from '../systems/FXSystem.js';
import { HUD } from '../ui/HUD.js';
import { FloatingText } from '../ui/FloatingText.js';

export class App {
  constructor() {
    this.pixi = new Application();
    this.loop = null;

    this.gridSystem = null;
    this.slotSystem = null;
    this.enemySystem = null;
    this.fxSystem = null;
    this.hud = null;
    this.floatingText = null;
  }

  async init() {
    await this.pixi.init({
      background: '#000000',
      resizeTo: window,
      antialias: true,
    });

    const mount = document.getElementById('app');
    if (mount) {
      mount.innerHTML = '';
      mount.appendChild(this.pixi.canvas);
    }

    this.gridSystem = new GridSystem(this.pixi);
    this.slotSystem = new SlotSystem(this.pixi);
    this.enemySystem = new EnemySystem(this.pixi);
    this.fxSystem = new FXSystem(this.pixi);
    this.hud = new HUD(this.pixi);
    this.floatingText = new FloatingText(this.pixi);

    this.loop = new GameLoop(this.pixi.ticker);
    this.loop.add((time) => this.update(time));
    this.loop.start();
  }

  update(time) {
    const delta = time?.deltaTime ?? 0;

    this.gridSystem?.update(delta);
    this.slotSystem?.update(delta);
    this.enemySystem?.update(delta);
    this.fxSystem?.update(delta);
    this.hud?.update(delta);
    this.floatingText?.update(delta);
  }

  destroy() {
    this.loop?.destroy();
    this.pixi?.destroy?.();
  }
}
