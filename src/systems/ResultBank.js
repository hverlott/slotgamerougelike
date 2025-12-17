// ResultBank 负责提供“看起来像真的”的盘面：
// - 控制命中率（避免 2~3 把就 1000% RTP）
// - 避免随机填充导致“额外连线”叠加（导致超大赢分）

const REEL_COLS = 3;
const REEL_ROWS = 3;
const POOL_SIZE = 20000;

// 与 SlotSystem PAYTABLE 保持一致（倍率）
const PAYTABLE = { 0: 0, 1: 0.5, 2: 1, 3: 2, 4: 5 };
const SYMBOLS = [0, 1, 2, 3, 4];

const PAY_LINES = [
  [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }],
  [{ c: 0, r: 1 }, { c: 1, r: 1 }, { c: 2, r: 1 }],
  [{ c: 0, r: 2 }, { c: 1, r: 2 }, { c: 2, r: 2 }],
  [{ c: 0, r: 0 }, { c: 0, r: 1 }, { c: 0, r: 2 }],
  [{ c: 1, r: 0 }, { c: 1, r: 1 }, { c: 1, r: 2 }],
  [{ c: 2, r: 0 }, { c: 2, r: 1 }, { c: 2, r: 2 }],
  [{ c: 0, r: 0 }, { c: 1, r: 1 }, { c: 2, r: 2 }],
  [{ c: 0, r: 2 }, { c: 1, r: 1 }, { c: 2, r: 0 }],
  [{ c: 1, r: 0 }, { c: 0, r: 1 }, { c: 1, r: 2 }],
];

const makeEmpty = () =>
  Array.from({ length: REEL_COLS }, () => Array.from({ length: REEL_ROWS }, () => 0));

const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const checkWinLines = (grid) => {
  const lines = [];
  PAY_LINES.forEach((coords, idx) => {
    const symbols = coords.map(({ c, r }) => grid?.[c]?.[r]);
    if (symbols.some((v) => v === undefined)) return;
    const baseSymbol = symbols.find((v) => v !== 4);
    const target = baseSymbol ?? 4;
    const allMatch = symbols.every((v) => v === target || v === 4);
    if (!allMatch) return;
    if ((PAYTABLE[target] ?? 0) <= 0) return;
    lines.push({ index: idx, coords, symbol: target, multiplier: PAYTABLE[target] });
  });
  return lines;
};

export class ResultBank {
  constructor() {
    this.pool = [];
    this.generatePool();
  }

  generatePool() {
    const results = [];

    // 体验目标（可调）：提高中奖率与爽感（miss 更少，small win 更多）
    for (let i = 0; i < POOL_SIZE; i += 1) {
      const roll = Math.random();

      // 20% miss, 55% small, 20% mid, 5% big
      let tier = 'miss';
      if (roll < 0.2) tier = 'miss';
      else if (roll < 0.75) tier = 'small';
      else if (roll < 0.95) tier = 'mid';
      else tier = 'big';

      const reels = makeEmpty();
      let intendedLine = null;
      let intendedSymbol = 0;

      if (tier !== 'miss') {
        intendedLine = Math.floor(Math.random() * PAY_LINES.length);
        const coords = PAY_LINES[intendedLine];

        if (tier === 'small') {
          intendedSymbol = Math.random() < 0.45 ? 1 : 2; // 更偏向 1x
        } else if (tier === 'mid') {
          intendedSymbol = 3; // 2x
        } else {
          intendedSymbol = Math.random() < 0.7 ? 4 : 3; // 5x 或 2x（偶尔）
        }

        coords.forEach(({ c, r }) => {
          reels[c][r] = intendedSymbol;
        });

        // 非中奖格子：以 0 为主，少量低级符号点缀（避免额外三连）
        const safeFill = [0, 0, 0, 1, 2];
        for (let c = 0; c < REEL_COLS; c += 1) {
          for (let r = 0; r < REEL_ROWS; r += 1) {
            if (reels[c][r] !== 0) continue;
            reels[c][r] = randomPick(safeFill);
          }
        }

        // 二次保险：如果意外出现多条线，重置非目标格子为 0
        const wins = checkWinLines(reels);
        if (wins.length > 1) {
          for (let c = 0; c < REEL_COLS; c += 1) {
            for (let r = 0; r < REEL_ROWS; r += 1) {
              reels[c][r] = 0;
            }
          }
          PAY_LINES[intendedLine].forEach(({ c, r }) => {
            reels[c][r] = intendedSymbol;
          });
        }
      } else {
        // miss：随机填充低级符号，但避免产生三连
        // 简化：先全 0，再撒一些 1/2，天然不容易三连
        const missFill = [0, 0, 0, 1, 2];
        for (let c = 0; c < REEL_COLS; c += 1) {
          for (let r = 0; r < REEL_ROWS; r += 1) {
            reels[c][r] = randomPick(missFill);
          }
        }
        // 若意外三连，强制打断
        const wins = checkWinLines(reels);
        if (wins.length) {
          const breakCell = wins[0].coords[Math.floor(Math.random() * 3)];
          reels[breakCell.c][breakCell.r] = 0;
        }
      }

      // 仅用于日志/调试（主逻辑以 SlotSystem 实算为准）
      const winLines = checkWinLines(reels);
      results.push({
        reels,
        isWin: winLines.length > 0,
        winAmount: winLines.reduce((s, l) => s + (l.multiplier ?? 0), 0),
        winLines,
      });
    }

    this.pool = results;
  }

  // 关卡越高：命中率越低、且偏向低档符号（主逻辑会再叠加 payoutScale）
  getResult(level = 1) {
    if (!this.pool.length) this.generatePool();
    const base = this.pool.pop();
    const lv = Math.max(1, Number(level) || 1);

    // 命中率衰减：lv1 维持当前爽感，之后每关增加 miss 概率
    const hitScale = Math.max(0.35, 1 - (lv - 1) * 0.06);
    if (base.isWin && Math.random() > hitScale) {
      // 直接改成 miss：全局更低的 RTP
      return { reels: this.makeMissGrid(), isWin: false, winAmount: 0, winLines: [] };
    }

    // 赢保留，但高等级时降档（减少 4/3 的占比）
    if (base.isWin && lv > 1) {
      const downgrade = Math.min(0.55, (lv - 1) * 0.08);
      if (Math.random() < downgrade) {
        const g = base.reels;
        for (let c = 0; c < REEL_COLS; c += 1) {
          for (let r = 0; r < REEL_ROWS; r += 1) {
            if (g[c][r] === 4) g[c][r] = 3;
            else if (g[c][r] === 3 && Math.random() < 0.6) g[c][r] = 2;
          }
        }
        const wl = checkWinLines(g);
        base.winLines = wl;
        base.isWin = wl.length > 0;
        base.winAmount = wl.reduce((s, l) => s + (l.multiplier ?? 0), 0);
      }
    }

    return base;
  }

  makeMissGrid() {
    const reels = makeEmpty();
    const missFill = [0, 0, 0, 1, 2];
    for (let c = 0; c < REEL_COLS; c += 1) {
      for (let r = 0; r < REEL_ROWS; r += 1) {
        reels[c][r] = randomPick(missFill);
      }
    }
    const wins = checkWinLines(reels);
    if (wins.length) {
      const breakCell = wins[0].coords[Math.floor(Math.random() * 3)];
      reels[breakCell.c][breakCell.r] = 0;
    }
    return reels;
  }
}

export const resultBank = new ResultBank();

