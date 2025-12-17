import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const PRIMARY = () => parseInt(themeManager.getColor('primary').replace('#', '0x'), 16);
const SECONDARY = () => parseInt(themeManager.getColor('secondary').replace('#', '0x'), 16);
const GRID = () => parseInt((themeManager.getColor('grid') ?? themeManager.getColor('primary')).replace('#', '0x'), 16);
const WIN = () => parseInt(themeManager.getColor('win').replace('#', '0x'), 16);

export class GridSystem {
  constructor(app, gridSize = 10, cellSize = 60) {
    this.container = new Container();
    this.app = app;
    this.gridSize = gridSize;
    this.cellSize = cellSize;
    // 需求：去掉僵尸区域的网格 UI（不再绘制每格边框/hover）
    this.tiles = [];
    this.app.gameLayer.addChild(this.container);
    this.roadBase = new Graphics();
    this.roadOverlay = new Graphics();
    this.drawGrid();
    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  drawGrid() {
    this.container.removeChildren();

    // 路面底（无格子 UI）
    this.roadBase.eventMode = 'none';
    this.container.addChild(this.roadBase);
    this.drawRoadBase();

    // 车道线叠加层
    this.roadOverlay.eventMode = 'none';
    this.container.addChild(this.roadOverlay);
    this.drawRoadOverlay();
  }

  updateTheme(theme) {
    // 不再刷新格子，仅刷新路面/车道线
    this.drawRoadBase();
    this.drawRoadOverlay();
  }

  drawTileShape(graphics, alpha, color = SECONDARY()) {
    graphics.clear();
    const w = this.cellSize - 2;
    const h = this.cellSize - 2;
    // 路面：深色沥青
    graphics.roundRect(1, 1, w, h, 10);
    graphics.fill({ color: 0x0b1324, alpha: 0.92 });
    // 弱网格分隔（像路块拼接）
    graphics.stroke({ width: 1, color, alpha: 0.22 + alpha * 0.25 });
    // 轻微高光（让路面不死板）
    graphics.roundRect(6, 6, w - 10, h - 10, 8);
    graphics.stroke({ width: 1, color: 0xffffff, alpha: 0.03 });
  }

  drawRoadBase() {
    const g = this.roadBase;
    g.clear();
    const size = this.gridSize * this.cellSize;
    const asphalt = 0x0b1324;
    const seam = SECONDARY();

    // 大块路面
    g.roundRect(0, 0, size, size, 18);
    g.fill({ color: asphalt, alpha: 0.95 });
    g.stroke({ width: 2, color: seam, alpha: 0.12 });

    // 轻微“砖缝/沥青纹理”——用几条随机细线模拟（很克制）
    for (let i = 0; i < 22; i += 1) {
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + (Math.random() - 0.5) * 140;
      const y2 = y1 + (Math.random() - 0.5) * 140;
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.02 });
    }

    // 轻微暗角（伪 3D：边缘更暗）
    g.roundRect(6, 6, size - 12, size - 12, 16);
    g.stroke({ width: 10, color: 0x000000, alpha: 0.06 });
  }

  drawRoadOverlay() {
    const g = this.roadOverlay;
    g.clear();
    const size = this.gridSize * this.cellSize;
    const laneColor = GRID();
    const midColor = WIN();

    // 外侧路缘线（更淡）
    g.roundRect(0, 0, size, size, 18);
    g.stroke({ width: 2, color: laneColor, alpha: 0.14 });

    // 车道分隔线（竖向，按“路”而不是按格）
    const laneCount = 3;
    for (let i = 1; i < laneCount; i += 1) {
      const x = (size / laneCount) * i;
      g.moveTo(x, 18);
      g.lineTo(x, size - 18);
      g.stroke({ width: 2, color: laneColor, alpha: 0.08 });
    }

    // 中线虚线（路中央）
    const midX = size / 2;
    const dash = 18;
    const gap = 14;
    for (let y = 18; y < size - 18; y += dash + gap) {
      g.moveTo(midX, y);
      g.lineTo(midX, Math.min(size - 18, y + dash));
      g.stroke({ width: 4, color: 0xffd54a, alpha: 0.26, cap: 'round' });
    }
  }

  // 动效核心：GSAP 脉冲动画
  pulseTile(tile) {
    this.drawTileShape(tile, 1, PRIMARY());
    tile.alpha = 2;
    gsap.to(tile, {
      alpha: 1,
      duration: 0.8,
      ease: 'power2.out',
      onStart: () => this.drawTileShape(tile, 1, PRIMARY()),
      onComplete: () => this.drawTileShape(tile, 0.3, SECONDARY()),
    });
  }
}
