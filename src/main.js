import { game } from './core/GameApp.js';
import { GameLoop } from './core/GameLoop.js';
import { GameStateKey } from './core/states/GameStates.js';
import { Assets, Graphics, Sprite, Texture, Container, ColorMatrixFilter } from 'pixi.js';
import { GridSystem } from './systems/GridSystem.js';
import { SlotSystem } from './systems/SlotSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { BulletSystem } from './systems/BulletSystem.js';
import { FloatingTextSystem } from './systems/FloatingTextSystem.js';
import { FXSystem } from './systems/FXSystem.js';
import { rtpManager } from './systems/RTPManager.js';
import { LevelManager } from './systems/LevelManager.js';
import { resultBank } from './systems/ResultBank.js';
import { themeManager, UIThemes } from './systems/ThemeManager.js';
import { JackpotSystem } from './systems/JackpotSystem.js';
import { ComboSystem } from './systems/ComboSystem.js';
import { UpgradeSystem } from './systems/UpgradeSystem.js';
import { audioSystem } from './systems/AudioSystem.js';
import { initStatsPanel, updateStatsPanel } from './ui/StatsPanel.js';
import { logger } from './utils/Logger.js';
import { AutoRepairSystem } from './systems/AutoRepairSystem.js';
import { GyroController } from './systems/GyroController.js';

// ========== 游戏常量配置 ==========
const GRID_SIZE = 10;
const CELL_SIZE = 60;
const GRID_TOP = 80;
const COMBAT_SCALE = 100;
const BASE_DAMAGE = 10 * COMBAT_SCALE;

// ========== 系统变量声明 ==========
let gridSystem;
let enemySystem;
let floatingTextSystem;
let fxSystem;
let bulletSystem;
let slotSystem;
let jackpotSystem;
let levelManager;
let gameLoop;
let comboSystem;
let upgradeSystem;

// ========== 资源清单 ==========
const ASSET_MANIFEST = {
  slot_low: '/assets/2001.png',
  slot_mid: '/assets/2002.png',
  slot_high: '/assets/2003.png',
  slot_wild: '/assets/2004.png', // ✅ 确保文件存在
  z_walker: '/assets/character_zombie_attack0.png',
  bg_city: '/assets/bacmgrond.png',
};

// ========== HMR 保护锁 ==========
const BOOT_KEY = '__D_SLOTGAME_BOOTSTRAPPED__';
if (globalThis[BOOT_KEY]) {
  console.warn('[main] 已初始化，跳过重复启动（HMR保护）。请刷新页面应用最新改动。');
} else {
  globalThis[BOOT_KEY] = true;

// ========== 辅助函数 ==========
const createZombies = (enemySystem) => {
  const cols = [2, 5, 8];
  cols.forEach((c, idx) => enemySystem.spawnZombie(c, idx % 2));
};

const createHUDSystem = (spinButton, betDisplay, currentBet) => {
  return {
    setSpinEnabled: (enabled) => {
      if (spinButton) {
        spinButton.disabled = !enabled;
        spinButton.textContent = enabled ? '旋转' : '旋转中...';
      }
    },
    getBet: () => currentBet.value,
    showSpinResult: (spinData) => {
      console.log('[HUD] Spin result:', spinData);
    },
    update: () => {},
    openChoice: async (options) => {
      console.log('[HUD] Choice options:', options);
      return options[0] ?? null;
    }
  };
};

// ========== 资源加载器 (带重试) ==========
const loadAssetsWithRetry = async (manifest, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[AssetLoader] Attempt ${i + 1}/${retries}...`);
      const assets = Object.keys(manifest).map((key) => ({ alias: key, src: manifest[key] }));
      await Assets.load(assets);
      console.log('[AssetLoader] Success!');
      return;
    } catch (err) {
      console.warn(`[AssetLoader] Attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000)); // 等待1秒重试
    }
  }
};

// ========== 主初始化流程 ==========
(async () => {
  try {
    // 1. 初始化 GameApp
    const stage = document.getElementById('game-stage');
    if (!stage) throw new Error("Missing #game-stage element");
    await game.init({ resizeTo: stage });
    console.log('[main] GameApp initialized');

    // 2. 加载资源
    await loadAssetsWithRetry(ASSET_MANIFEST);

    // 2.5 预加载音频
    audioSystem.preload().catch(e => console.warn("Audio preload warning:", e));
    
    // 解锁音频逻辑
    let audioUnlockAttempted = false;
    const unlockAudioOnFirstGesture = async () => {
      if (audioUnlockAttempted) return;
      audioUnlockAttempted = true;
      await audioSystem.unlock();
    };

    // 2.6 初始化统计面板
    initStatsPanel('#sidebar');

    // 3. 增强背景
    try {
      const bg = new Sprite(Texture.from('bg_city'));
      bg.anchor.set(0.5);
      bg.alpha = 0.22;
      const fitBg = () => {
        const sw = game.app.screen.width;
        const sh = game.app.screen.height;
        bg.position.set(sw / 2, sh / 2);
        const scale = Math.max(sw / bg.texture.width, sh / bg.texture.height) * 1.1;
        bg.scale.set(scale);
      };
      fitBg();
      window.addEventListener('resize', fitBg);
      game.app.stage.addChildAt(bg, 0);
    } catch (e) {
      console.warn("Background load failed, skipping");
    }

    const width = game.app.screen.width;
    const height = game.app.screen.height;

    // 4. 初始化各系统
    console.log('[main] Initializing systems...');

    // 4.1 战场框架
    const battlefieldFrame = new Container();
    const bfW = GRID_SIZE * CELL_SIZE + 40;
    const bfH = GRID_SIZE * CELL_SIZE + 40;
    const bfX = width / 2 - bfW / 2;
    const bfY = GRID_TOP - 20;

    const frameBg = new Graphics();
    frameBg.roundRect(bfX, bfY, bfW, bfH, 12);
    frameBg.fill({ color: 0x0a1520, alpha: 0.35 });
    frameBg.stroke({ width: 1, color: 0x00F0FF, alpha: 0.25 });
    battlefieldFrame.addChild(frameBg);
    game.gameLayer.addChildAt(battlefieldFrame, 0);

    // 4.2 GridSystem
    gridSystem = new GridSystem(game, GRID_SIZE, CELL_SIZE);
    gridSystem.container.x = width / 2 - (GRID_SIZE * CELL_SIZE) / 2;
    gridSystem.container.y = GRID_TOP;
    game.gameLayer.addChild(gridSystem.container);

    // 4.3 ComboSystem
    comboSystem = new ComboSystem();

    // 4.4 EnemySystem
    enemySystem = new EnemySystem(game, {
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      gridTop: 0,
      combatScale: COMBAT_SCALE,
      moveTweenDuration: 1.0,
      onDamageDealt: (damage) => comboSystem.recordDamage(damage),
    });
    enemySystem.container.x = gridSystem.container.x;
    enemySystem.container.y = GRID_TOP;
    game.gameLayer.addChild(enemySystem.container);

    // 4.5 FloatingTextSystem
    floatingTextSystem = new FloatingTextSystem(game);
    game.gameLayer.addChild(floatingTextSystem.container);

    // 4.6 FXSystem
    fxSystem = new FXSystem(game);
    game.ticker.add((delta) => {
      const deltaMS = Math.min(game.app?.ticker?.deltaMS ?? delta * 16.66, 50);
      fxSystem.update?.(deltaMS);
    });

    // 4.7 BulletSystem
    bulletSystem = new BulletSystem(game, enemySystem, {
      damagePerHit: BASE_DAMAGE,
      floatingTextSystem,
      fxSystem,
      audioSystem,
      onHit: (damage, info) => {
        rtpManager.recordHit?.(damage);
      }
    });

    // 4.8 JackpotSystem
    jackpotSystem = new JackpotSystem(game, {
      x: width / 2,
      y: GRID_TOP + CELL_SIZE * 1.2,
      scale: 1.05,
    });
    game.gameLayer.addChild(jackpotSystem);
    jackpotSystem.x = gridSystem.container.x + (GRID_SIZE * CELL_SIZE) / 2;
    jackpotSystem.y = GRID_TOP + CELL_SIZE * 1.15;

    // 4.9 UpgradeSystem
    upgradeSystem = new UpgradeSystem(game);
    game.bulletSystem = bulletSystem;
    game.jackpotSystem = jackpotSystem;

    // 4.10 LevelManager
    game.resultBank = resultBank;
    
    levelManager = new LevelManager(game, enemySystem, {
      initialDensity: 0.4,
      spawnOnSpinOnly: true,
      upgradeSystem,
      onLevelChange: ({ level }) => {
        const themeName = ['cyberA', 'cyberB', 'cyberC'][level % 3];
        themeManager.setTheme(themeName);
        game.setLevelVisual?.(level);
        jackpotSystem.setLevel?.(level);
        floatingTextSystem.setLevel?.(level);
      },
    });
    game.levelManager = levelManager;

    // 4.11 SlotSystem
    slotSystem = new SlotSystem(game, { audioSystem });
    slotSystem.scale.set(0.9);
    slotSystem.x = width / 2 - (slotSystem.totalWidth * slotSystem.scale.x) / 2;
    slotSystem.y = GRID_TOP + GRID_SIZE * CELL_SIZE + 20;
    game.gameLayer.addChild(slotSystem);

    // 5. UI 绑定
    const spinButton = document.getElementById('spin-btn');
    const betMinus = document.getElementById('bet-minus');
    const betPlus = document.getElementById('bet-plus');
    const betDisplay = document.getElementById('bet-display');
    const autoBtn = document.getElementById('auto-btn');
    const betMax = document.getElementById('bet-max');

    let currentBet = 10;
    const maxBet = 500;
    let isAutoSpin = false;
    const currentBetRef = { get value() { return currentBet; } };

    const updateBetDisplay = () => { if (betDisplay) betDisplay.value = currentBet; };

    if (betMinus) betMinus.onclick = () => {
      if (slotSystem.isSpinning) return;
      unlockAudioOnFirstGesture();
      audioSystem.play('click');
      currentBet = Math.max(1, currentBet - 10);
      updateBetDisplay();
    };

    if (betPlus) betPlus.onclick = () => {
      if (slotSystem.isSpinning) return;
      unlockAudioOnFirstGesture();
      audioSystem.play('click');
      currentBet = Math.min(maxBet, currentBet + 10);
      updateBetDisplay();
    };

    if (betMax) betMax.onclick = () => {
      if (slotSystem.isSpinning) return;
      unlockAudioOnFirstGesture();
      audioSystem.play('click');
      currentBet = maxBet;
      updateBetDisplay();
    };

    // 5.5 🎮 Gyro Controller (设备体感)
    const gyroController = new GyroController(game, {
      sensitivity: 0.08,
      maxAngle: 0.15,
      onShake: () => {
        if (autoBtn) {
          // 模拟点击自动旋转
          autoBtn.click();
        }
      }
    });
    // 注意：start() 需要权限，将在第一次点击旋转时请求

    // 5.6 📱 触控区域调节 (全局暴露)
    window.setGyroSensitivity = (val) => {
        gyroController.setSensitivity(val);
        console.log(`[Gyro] Sensitivity set to ${val}`);
    };

    window.adjustTouchArea = (scale = 1.0) => {
      const root = document.documentElement;
      // 假设基础按钮大小为 44px
      const size = 44 * scale;
      const padding = 8 * scale;
      // 设置 CSS 变量 (需要在 CSS 中支持，这里直接修改 style)
      const buttons = document.querySelectorAll('button, .bet-btn, #spin-btn, #auto-btn');
      buttons.forEach(btn => {
        btn.style.transform = `scale(${scale})`;
        btn.style.margin = `${padding}px`;
      });
      console.log(`[UI] Touch area scale set to ${scale}`);
      
      // 也可以修改 --touch-scale 变量如果使用了它
      root.style.setProperty('--touch-scale', scale);
    };

    // 6. 游戏循环与状态机
    const ctx = {
      game, app: game.app,
      gridSystem, enemySystem, floatingTextSystem, fxSystem, bulletSystem, slotSystem, jackpotSystem,
      levelManager, rtpManager, resultBank, comboSystem, audioSystem, upgradeSystem,
      hudSystem: createHUDSystem(spinButton, betDisplay, currentBetRef),
      player: { bet: currentBet },
      bossBonusTotal: 0,
      logger // 📝 注入日志系统
    };

    // 🛡️ 初始化自动修复系统
    const autoRepair = new AutoRepairSystem(ctx);

    gameLoop = new GameLoop(ctx);
    console.log('[main] GameLoop initialized');

    // 🛠️ 调试快捷键
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F9') {
        logger.exportLogs();
      }
      if (e.code === 'F8') {
        logger.analyze();
      }
      if (e.code === 'F7') {
        // Toggle Bullet Debug
        const debug = !bulletSystem.debugMode;
        bulletSystem.setDebug(debug);
        logger.info(`Bullet Debug: ${debug}`);
      }
    });

    // 7. Ticker & Stats
    let statsTimer = 0;
    game.ticker.add((delta) => {
      const deltaMS = Math.min(game.app?.ticker?.deltaMS ?? delta * 16.66, 50);
      
      gameLoop.update(deltaMS);
      comboSystem.update(deltaMS);
      levelManager.setPaused(slotSystem.isSpinning);
      levelManager.update(deltaMS);
      jackpotSystem.update(deltaMS);

      // 更新统计
      statsTimer += deltaMS;
      if (statsTimer >= 200) {
        statsTimer = 0;
        
        // 收集数据
        const comboState = comboSystem.getState();
        const rtp = rtpManager.calculateRTP();
        const hitRate = rtpManager.totalSpins > 0 ? (rtpManager.hitCount / rtpManager.totalSpins) * 100 : 0;
        
        // Boss数据
        let bossHP = Number(jackpotSystem.displayHP ?? jackpotSystem.hp ?? 0);
        let bossHPMax = Number(jackpotSystem.maxHP ?? 1);
        let bossHPpct = bossHPMax > 0 ? (bossHP / bossHPMax) * 100 : 0;

        const statsData = {
          spins: rtpManager.totalSpins ?? 0,
          hitRate,
          combo: rtpManager.combo ?? 0,
          totalDamage: enemySystem.totalDamageDealt ?? 0,
          bossName: jackpotSystem.bossName ?? 'BOSS',
          bossHPpct,
          bossHP,
          bossHPMax,
          zombieAlive: enemySystem.zombies?.filter(z => !z.destroyed).length ?? 0,
          zombieSpawned: enemySystem.totalSpawned ?? 0,
          zombieKilled: enemySystem.totalKilled ?? 0,
          level: (levelManager.currentLevel ?? 0) + 1,
          levelKills: levelManager.kills ?? 0,
          levelTarget: levelManager.killsToAdvance ?? 100,
          
          critRate: 10 + (Number(bulletSystem?.critChance ?? 0) * 100) + (comboState.heatPercent > 80 ? 10 : 0),
          atkPower: (bulletSystem.damagePerHit / 10) * 100,
          time: (Date.now() - (globalThis.__startTime || Date.now())) / 1000,
          
          rtp,
          totalBet: rtpManager.totalBet ?? 0,
          totalWin: rtpManager.totalWin ?? 0,
          net: (rtpManager.totalWin - rtpManager.totalBet),
          totalHits: rtpManager.totalHits ?? 0, // Pass totalHits
          bossBonusTotal: ctx.bossBonusTotal ?? 0,
          
          currentBet,
          activeBullets: bulletSystem.activeBullets?.length ?? 0,
          activeFX: fxSystem.activeTimelines?.length ?? 0
        };

        updateStatsPanel(statsData);
        
        // 更新 Combo UI
        ctx.hudSystem?.setComboState?.({
          comboCount: comboState.comboCount,
          heatPercent: comboState.heatPercent,
          heatColor: comboSystem.getHeatColor(),
          overdriveActive: comboState.overdriveActive,
        });
      }
    });

    // 8. Spin 逻辑
    const SPIN_LOCK_KEY = '__D_SLOTGAME_SPIN_LOCK__';
    const triggerSpin = () => {
      if (globalThis[SPIN_LOCK_KEY]) return;
      if (slotSystem.isSpinning) return;
      if (ctx.machine.currentKey && ctx.machine.currentKey !== 'IDLE') return;

      globalThis[SPIN_LOCK_KEY] = true;
      globalThis.__startTime = globalThis.__startTime || Date.now();

      ctx.machine.change(GameStateKey.SPINNING).then(() => {
        globalThis[SPIN_LOCK_KEY] = false;
        if (isAutoSpin) {
          setTimeout(() => {
            if (isAutoSpin && !slotSystem.isSpinning) triggerSpin();
          }, 260);
        }
      }).catch(err => {
        console.error("Spin failed", err);
        globalThis[SPIN_LOCK_KEY] = false;
        slotSystem.isSpinning = false;
      });
    };

    if (spinButton) spinButton.onclick = async () => {
      // 🎮 请求体感权限 (仅第一次有效)
      if (!gyroController.hasPermission) {
        gyroController.requestPermission().then(granted => {
          if (granted) gyroController.start();
        });
      } else if (!gyroController.enabled) {
        gyroController.start();
      }

      await unlockAudioOnFirstGesture();
      audioSystem.play('click');
      isAutoSpin = false;
      if (autoBtn) autoBtn.classList.remove('active');
      triggerSpin();
    };

    if (autoBtn) autoBtn.onclick = async () => {
      await unlockAudioOnFirstGesture();
      audioSystem.play('switch');
      if (isAutoSpin) {
        isAutoSpin = false;
        autoBtn.classList.remove('active');
      } else {
        isAutoSpin = true;
        autoBtn.classList.add('active');
        if (!slotSystem.isSpinning) triggerSpin();
      }
    };

    console.log('[main] ✅ Game fully initialized!');

  } catch (err) {
    console.error('❌ Failed to init game:', err);
    // 简单的 UI 错误提示
    const stage = document.getElementById('game-stage');
    if (stage) {
      stage.innerHTML = `<div style="color:red; padding:20px;">Game Init Error: ${err.message}<br>Check console for details.</div>`;
    }
  }
})();
}
