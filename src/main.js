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

// ========== 游戏常量配置 ==========
const GRID_SIZE = 10;
const CELL_SIZE = 60;
const GRID_TOP = 80;
const COMBAT_SCALE = 100;
const BASE_DAMAGE = 10 * COMBAT_SCALE;
const MAX_CONCURRENT_BULLETS = 40;

// 🎨 光晕强度标准（全局统一）
const GLOW_STRENGTH = {
  SMALL: { distance: 8, outerStrength: 1.5, quality: 0.1 },
  MEDIUM: { distance: 12, outerStrength: 2.0, quality: 0.15 },
  LARGE: { distance: 20, outerStrength: 3.0, quality: 0.2 },
};

// ========== ✅ 所有系统变量提前声明（避免变量遮蔽和"先用后声明"）==========
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
  slot_wild: 'https://pixijs.com/assets/skully.png',
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
const DEBUG_SPAWN_DUMMIES = false;
const createZombies = (enemySystem) => {
  const cols = [2, 5, 8];
  cols.forEach((c, idx) => enemySystem.spawnZombie(c, idx % 2));
};

// ========== HUD 系统模拟（提供状态机所需接口）==========
const createHUDSystem = (spinButton, betDisplay, currentBet) => {
  return {
    setSpinEnabled: (enabled) => {
      spinButton.disabled = !enabled;
      spinButton.textContent = enabled ? '旋转' : '旋转中...';
    },
    getBet: () => currentBet.value,
    showSpinResult: (spinData) => {
      console.log('[HUD] Spin result:', spinData);
    },
    update: () => {
      // 更新 HUD 显示
    },
    openChoice: async (options) => {
      console.log('[HUD] Choice options:', options);
      return options[0] ?? null;
    }
  };
};

// ========== 主初始化流程 ==========
(async () => {
  try {
    // ========== 步骤 1: 初始化 GameApp ==========
    await game.init({ resizeTo: document.getElementById('game-stage') });
    console.log('[main] GameApp initialized');

    // ========== 步骤 2: 加载资源 ==========
    await Assets.load(
      Object.keys(ASSET_MANIFEST).map((key) => ({ alias: key, src: ASSET_MANIFEST[key] }))
    );
    console.log('[main] Assets loaded');

    // ========== 步骤 2.5: 预加载音频 🔊（fire-and-forget，不阻塞启动）==========
    audioSystem.preload().then((summary) => {
      console.log('[main] Audio preload completed', summary);
    }).catch((error) => {
      console.warn('[main] Audio preload encountered errors (non-fatal):', error);
    });
    console.log('[main] Audio preloading started (background)');

    // 🔓 AudioContext 解锁（首次用户交互时）
    let audioUnlockAttempted = false;
    const unlockAudioOnFirstGesture = async () => {
      if (audioUnlockAttempted) return;
      audioUnlockAttempted = true;
      
      const unlocked = await audioSystem.unlock();
      if (unlocked) {
        console.log('[main] 🔊 音频已解锁，可以播放声音');
      } else {
        console.warn('[main] ⚠️ 音频解锁失败');
      }
    };

    // ========== 步骤 2.6: 初始化统计面板 🎛️ ==========
    const statsPanelReady = initStatsPanel('#sidebar');
    if (statsPanelReady) {
      console.log('[main] StatsPanel initialized and ready');
    } else {
      console.warn('[main] StatsPanel init failed, stats may not update');
    }

    // ========== 步骤 3: 增强背景 + 视差 ==========
    const bg = new Sprite(Texture.from('bg_city'));
    bg.anchor.set(0.5);
    bg.alpha = 0.22; // 🎨 更暗，减少视觉噪音
    
    // 添加色调滤镜（温和处理，保持清晰）
    const bgColorMatrix = new ColorMatrixFilter();
    bgColorMatrix.brightness(0.7, false); // 更高亮度（0.6 → 0.7）
    bgColorMatrix.contrast(0.85, false);  // 更高对比度（0.8 → 0.85）
    bg.filters = [bgColorMatrix];
    
    const fitBg = () => {
      const sw = game.app.screen.width;
      const sh = game.app.screen.height;
      const tw = bg.texture?.orig?.width || bg.texture?.width || 1;
      const th = bg.texture?.orig?.height || bg.texture?.height || 1;
      const s = Math.max(sw / tw, sh / th) * 1.1; // 稍微放大以支持视差
      bg.scale.set(s);
      bg.position.set(sw / 2, sh / 2);
    };
    fitBg();
    window.addEventListener('resize', fitBg, { passive: true });
    game.app.stage.addChildAt(bg, 0);
    console.log('[main] Enhanced background added');
    
    // 🌟 漂浮粒子系统（低数量，池化）
    const particleContainer = new Container();
    game.app.stage.addChild(particleContainer);
    
    const particles = [];
    const PARTICLE_COUNT = 12; // 非常少的粒子
    
    // 创建粒子池
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = new Graphics();
      particle.circle(0, 0, 1 + Math.random() * 1.5);
      particle.fill({ color: 0x00F0FF, alpha: 0.15 + Math.random() * 0.15 });
      
      particle.x = Math.random() * game.app.screen.width;
      particle.y = Math.random() * game.app.screen.height;
      particle.vx = (Math.random() - 0.5) * 0.2;
      particle.vy = (Math.random() - 0.5) * 0.2;
      
      particleContainer.addChild(particle);
      particles.push(particle);
    }
    console.log('[main] Floating particles added');

    // 🎨 精致暗角（保持清晰度）
    const vignette = new Graphics();
    const drawVignette = () => {
      const sw = game.app.screen.width;
      const sh = game.app.screen.height;
      vignette.clear();
      
      // 外圈暗色渐变（更温和）
      const centerX = sw / 2;
      const centerY = sh / 2;
      const radius = Math.max(sw, sh) * 0.68; // 更大的半径 = 更少暗角
      
      vignette.rect(0, 0, sw, sh);
      vignette.fill({
        color: 0x000000,
        alpha: 0,
      });
      
      // 径向渐变效果（使用多个圆模拟，更少步骤）
      const steps = 6; // 减少步骤
      for (let i = 0; i < steps; i++) {
        const progress = i / steps;
        const r = radius * (1 + progress * 0.7); // 更小的扩散
        const alpha = Math.pow(progress, 1.5) * 0.40; // 降低强度（0.65 → 0.40）
        
        vignette.circle(centerX, centerY, r);
        vignette.fill({
          color: 0x000000,
          alpha: alpha / steps,
        });
      }
    };
    drawVignette();
    window.addEventListener('resize', drawVignette, { passive: true });
    game.app.stage.addChild(vignette);
    console.log('[main] Refined vignette overlay added (reduced intensity)');

    const width = game.app.screen.width;
    const height = game.app.screen.height;

    // ========== 步骤 4: 按依赖顺序初始化所有系统 ==========
    console.log('[main] Initializing systems...');
    
    // 🎨 4.1 - 精致战场框架（高级材质 + 细线条）
    const battlefieldFrame = new Container();
    const battlefieldWidth = GRID_SIZE * CELL_SIZE + 40;
    const battlefieldHeight = GRID_SIZE * CELL_SIZE + 40;
    const battlefieldX = width / 2 - battlefieldWidth / 2;
    const battlefieldY = GRID_TOP - 20;
    
    // === 第1层：深色玻璃基底 ===
    const glassBase = new Graphics();
    glassBase.roundRect(
      battlefieldX, 
      battlefieldY, 
      battlefieldWidth, 
      battlefieldHeight, 
      12
    );
    glassBase.fill({
      color: 0x0a1520,
      alpha: 0.35, // 降低 alpha 让背景更清晰
    });
    
    // === 第2层：淡淡噪点纹理（更密、更静态） ===
    const noiseOverlay = new Graphics();
    // 通过多个小点模拟噪点效果
    for (let i = 0; i < 60; i++) {  // 40 → 60 (更密)
      const x = battlefieldX + Math.random() * battlefieldWidth;
      const y = battlefieldY + Math.random() * battlefieldHeight;
      noiseOverlay.circle(x, y, 0.5);
      noiseOverlay.fill({ 
        color: 0xFFFFFF, 
        alpha: 0.015 + Math.random() * 0.01  // 更淡 (0.02-0.04 → 0.015-0.025)
      });
    }
    
    // === 第3层：微妙内阴影（更精致） ===
    const innerShadow = new Graphics();
    innerShadow.roundRect(
      battlefieldX + 2, 
      battlefieldY + 2, 
      battlefieldWidth - 4, 
      battlefieldHeight - 4, 
      11
    );
    innerShadow.stroke({
      width: 2,        // 3 → 2 (更细)
      color: 0x000000,
      alpha: 0.15,     // 0.25 → 0.15 (更淡)
    });
    
    // === 第4层：主边框（1px 细线，更暗） ===
    const mainBorder = new Graphics();
    mainBorder.roundRect(
      battlefieldX, 
      battlefieldY, 
      battlefieldWidth, 
      battlefieldHeight, 
      12
    );
    mainBorder.stroke({
      width: 1,
      color: 0x00F0FF,
      alpha: 0.25,  // 0.4 → 0.25 (更暗，更精致)
    });
    
    // === 第5层：内高光（顶部和左侧） ===
    const innerHighlight = new Graphics();
    // 顶部高光
    innerHighlight.moveTo(battlefieldX + 12, battlefieldY + 1);
    innerHighlight.lineTo(battlefieldX + battlefieldWidth - 12, battlefieldY + 1);
    innerHighlight.stroke({
      width: 1,
      color: 0xFFFFFF,
      alpha: 0.08, // 非常微妙的内高光
    });
    // 左侧高光
    innerHighlight.moveTo(battlefieldX + 1, battlefieldY + 12);
    innerHighlight.lineTo(battlefieldX + 1, battlefieldY + battlefieldHeight - 12);
    innerHighlight.stroke({
      width: 1,
      color: 0xFFFFFF,
      alpha: 0.06,
    });
    
    // === 第6层：精致角落装饰（极简） ===
    const cornerAccents = new Graphics();
    const cornerSize = 8;
    const cornerOffset = 3;
    
    // 四个角的小装饰线
    const corners = [
      { x: battlefieldX + cornerOffset, y: battlefieldY + cornerOffset }, // 左上
      { x: battlefieldX + battlefieldWidth - cornerOffset, y: battlefieldY + cornerOffset }, // 右上
      { x: battlefieldX + cornerOffset, y: battlefieldY + battlefieldHeight - cornerOffset }, // 左下
      { x: battlefieldX + battlefieldWidth - cornerOffset, y: battlefieldY + battlefieldHeight - cornerOffset }, // 右下
    ];
    
    corners.forEach((corner, index) => {
      const isTop = index < 2;
      const isLeft = index % 2 === 0;
      
      // 水平线
      cornerAccents.moveTo(
        isLeft ? corner.x : corner.x - cornerSize,
        corner.y
      );
      cornerAccents.lineTo(
        isLeft ? corner.x + cornerSize : corner.x,
        corner.y
      );
      
      // 垂直线
      cornerAccents.moveTo(
        corner.x,
        isTop ? corner.y : corner.y - cornerSize
      );
      cornerAccents.lineTo(
        corner.x,
        isTop ? corner.y + cornerSize : corner.y
      );
    });
    
    cornerAccents.stroke({
      width: 1,
      color: 0x00F0FF,
      alpha: 0.25,
    });
    
    // ❌ 第7层：外光晕已移除（太亮，不高级）
    // subtleGlow 已删除，保持精致暗调
    
    // 组装所有层（移除外光晕）
    battlefieldFrame.addChild(glassBase);
    battlefieldFrame.addChild(noiseOverlay);
    battlefieldFrame.addChild(innerShadow);
    // subtleGlow 已移除
    battlefieldFrame.addChild(mainBorder);
    battlefieldFrame.addChild(innerHighlight);
    battlefieldFrame.addChild(cornerAccents);
    
    game.gameLayer.addChildAt(battlefieldFrame, 0);
    console.log('[main] Premium battlefield frame added (refined & layered)');

    // 4.2 - GridSystem（基础层，无依赖）
    gridSystem = new GridSystem(game, GRID_SIZE, CELL_SIZE);
    gridSystem.container.x = width / 2 - (GRID_SIZE * CELL_SIZE) / 2;
    gridSystem.container.y = GRID_TOP;
    game.gameLayer.addChild(gridSystem.container); // ✅ 添加到舞台
    console.log('[main] GridSystem created and added to stage');

    // 4.3 - ComboSystem（连击/热度系统，无依赖）🔥
    comboSystem = new ComboSystem();
    console.log('[main] ComboSystem created');

    // 4.4 - EnemySystem（敌人层，依赖 ComboSystem）
    enemySystem = new EnemySystem(game, {
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      gridTop: 0,
      combatScale: COMBAT_SCALE,
      moveTweenDuration: 1.0,
      onDamageDealt: (damage) => comboSystem.recordDamage(damage), // 🔥 伤害回调
    });
    enemySystem.container.x = gridSystem.container.x;
    enemySystem.container.y = GRID_TOP;
    game.gameLayer.addChild(enemySystem.container); // ✅ 添加到舞台
    console.log('[main] EnemySystem created and added to stage');
    
    if (DEBUG_SPAWN_DUMMIES) createZombies(enemySystem);

    // 4.5 - FloatingTextSystem（文字层，无依赖）
    floatingTextSystem = new FloatingTextSystem(game);
    game.gameLayer.addChild(floatingTextSystem.container);
    console.log('[main] FloatingTextSystem created and added to stage');

    // 4.6 - FXSystem（特效层，无依赖）✅ 只创建一次
    fxSystem = new FXSystem(game);
    console.log('[main] FXSystem created');
    
    // ✅ 附加 ticker 更新（只一次）
    game.ticker.add((delta) => {
      const deltaMS = Math.min(game.app?.ticker?.deltaMS ?? delta * (1000 / 60), 50);
      fxSystem.update?.(deltaMS);
    });

    // 4.7 - BulletSystem（依赖: enemySystem, floatingTextSystem, fxSystem）✅ 只创建一次
    bulletSystem = new BulletSystem(game, enemySystem, {
      damagePerHit: BASE_DAMAGE,
      floatingTextSystem,
      fxSystem,
      audioSystem, // 🔊 音频系统
    });
    console.log('[main] BulletSystem created');

    // 4.8 - JackpotSystem（Boss系统，需要在LevelManager之前）
    jackpotSystem = new JackpotSystem(game, {
      x: width / 2,
      y: GRID_TOP + CELL_SIZE * 1.2,
      scale: 1.05,
    });
    game.gameLayer.addChild(jackpotSystem);
    jackpotSystem.x = gridSystem.container.x + (GRID_SIZE * CELL_SIZE) / 2;
    jackpotSystem.y = GRID_TOP + CELL_SIZE * 1.15;
    console.log('[main] JackpotSystem created and added to stage');

    // 4.9 - UpgradeSystem（升级系统，需要在 LevelManager 之前）🎯
    upgradeSystem = new UpgradeSystem(game);
    // 将系统引用附加到 game 对象，供 UpgradeSystem 访问
    game.bulletSystem = bulletSystem;
    game.jackpotSystem = jackpotSystem;
    console.log('[main] UpgradeSystem created');

    // 4.10 - LevelManager（关卡管理，依赖: enemySystem, jackpotSystem, floatingTextSystem, upgradeSystem）
    const levelThemeOrder = ['cyberA', 'cyberB', 'cyberC', 'cyberD', 'cyberE'];
    const applyCssTheme = (theme) => {
      if (!theme) return;
      const root = document.documentElement;
      root.style.setProperty('--bg', theme.background);
      root.style.setProperty('--panel', theme.surface);
      root.style.setProperty('--primary', theme.primary);
      root.style.setProperty('--win', theme.win);
      root.style.setProperty('--danger', theme.danger);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--grid', theme.grid ?? theme.primary);
    };

    levelManager = new LevelManager(game, enemySystem, {
      initialDensity: 0.4 + Math.random() * 0.2,
      spawnOnSpinOnly: true,
      upgradeSystem, // 🎯 传入升级系统
      onLevelChange: ({ level }) => {
        const themeName = levelThemeOrder[(Math.max(1, level) - 1) % levelThemeOrder.length];
        themeManager.setTheme(themeName);
        game.setLevelVisual?.(level);
        jackpotSystem.setLevel?.(level);
        floatingTextSystem.setLevel?.(level);
        const glow = Math.min(0.42, 0.18 + (level - 1) * 0.06);
        document.documentElement.style.setProperty('--uiGlow', `${glow}`);
      },
    });
    console.log('[main] LevelManager created');

    // 4.11 - SlotSystem（滚轮系统，最后初始化）
    slotSystem = new SlotSystem(game, {
      audioSystem, // 🔊 音频系统
    });
    slotSystem.scale.set(0.9);
    slotSystem.x = width / 2 - (slotSystem.totalWidth * slotSystem.scale.x) / 2;
    slotSystem.y = GRID_TOP + GRID_SIZE * CELL_SIZE + 20;
    game.gameLayer.addChild(slotSystem);
    slotSystem.onShake = null; // 关掉全局中奖抖动
    console.log('[main] SlotSystem created and added to stage');

    // 🎨 确保正确的 Z-order 分层
    // stage children: bg (0) -> particleContainer (1) -> vignette (2) -> gameLayer (3+)
    // gameLayer children: battlefieldBloom (0) -> battlefieldFrame (1) -> grid (2) -> enemies (3) -> bullets/fx (4) -> floatingText (5) -> slot (6+)
    console.log('[main] Enhanced scene composition layering complete');
    console.log('[main] Layer order: background → particles → vignette → battlefield frame → grid → enemies → bullets/fx → floatingText → slot');

    // 同步初始关卡
    floatingTextSystem.setLevel?.((levelManager?.currentLevel ?? 0) + 1);

    console.log('[main] All systems initialized successfully');

    // ========== 步骤 5: UI控制面板绑定 ==========
    const themeSwitcher = document.getElementById('theme-switcher');
    const spinButton = document.getElementById('spin-btn');
    const betMinus = document.getElementById('bet-minus');
    const betPlus = document.getElementById('bet-plus');
    const betDisplay = document.getElementById('bet-display');
    const autoBtn = document.getElementById('auto-btn');
    
    if (!spinButton || !betMinus || !betPlus || !betDisplay || !autoBtn) {
      console.error('Control panel elements missing');
      return;
    }
    
    spinButton.textContent = '旋转';

    // ========== 步骤 6: 下注控制 ==========
    let currentBet = 10;
    const minBet = 1;
    const maxBet = 500;
    let isAutoSpin = false;

    const currentBetRef = { get value() { return currentBet; } };

    const updateBetDisplay = () => {
      betDisplay.value = currentBet.toFixed(0);
    };

    const setAutoActive = (active) => {
      isAutoSpin = active;
      autoBtn.classList.toggle('active', active);
    };

    updateBetDisplay();

    betMinus.addEventListener('click', async () => {
      if (slotSystem.isSpinning) return;
      await unlockAudioOnFirstGesture(); // 🔓 首次交互解锁音频
      audioSystem.play('click'); // 🔊 点击音效
      currentBet = Math.max(minBet, currentBet - 10);
      updateBetDisplay();
    });

    betPlus.addEventListener('click', async () => {
      if (slotSystem.isSpinning) return;
      await unlockAudioOnFirstGesture(); // 🔓 首次交互解锁音频
      audioSystem.play('click'); // 🔊 点击音效
      currentBet = Math.min(maxBet, currentBet + 10);
      updateBetDisplay();
    });

    // ========== 步骤 7: 创建游戏上下文和 GameLoop ==========
    const ctx = {
      game,
      app: game.app,
      gridSystem,
      enemySystem,
      floatingTextSystem,
      fxSystem,
      bulletSystem,
      slotSystem,
      jackpotSystem,
      levelManager,
      rtpManager,
      resultBank,
      comboSystem, // 🔥 连击系统
      audioSystem, // 🔊 音频系统
      hudSystem: createHUDSystem(spinButton, betDisplay, currentBetRef),
      player: { bet: currentBet },
      bossBonusTotal: 0
    };

    // 初始化游戏循环（包含状态机）
    gameLoop = new GameLoop(ctx);
    console.log('[main] GameLoop initialized');

    // 游戏结束回调
    game.onGameOver = () => {
      setAutoActive(false);
      spinButton.disabled = true;
      spinButton.textContent = '游戏结束';
      levelManager.setPaused(true);
    };

    // ========== 步骤 8: 游戏主循环 Ticker ==========
    let statsTimer = 0;
    let parallaxTime = 0;
    
    // 🔍 看门狗：监控状态机是否卡住
    let lastWatchdogCheck = Date.now();
    let lastWatchdogState = null;
    let watchdogStuckTime = 0;

    const tickerHandler = (delta) => {
      const raw = game.app?.ticker?.deltaMS ?? delta * (1000 / 60);
      const deltaMS = Math.min(raw, 50);
      
      // 🎨 背景视差（慢速）
      parallaxTime += deltaMS * 0.00005;
      if (bg) {
        bg.x = game.app.screen.width / 2 + Math.sin(parallaxTime) * 15;
        bg.y = game.app.screen.height / 2 + Math.cos(parallaxTime * 0.8) * 10;
      }
      
      // 🌟 粒子漂浮动画
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        
        // 边界环绕
        const sw = game.app.screen.width;
        const sh = game.app.screen.height;
        if (p.x < -10) p.x = sw + 10;
        if (p.x > sw + 10) p.x = -10;
        if (p.y < -10) p.y = sh + 10;
        if (p.y > sh + 10) p.y = -10;
        
        // 微妙的闪烁
        p.alpha = 0.15 + Math.sin(parallaxTime * 2 + p.x * 0.01) * 0.1;
      });
      
      // 驱动状态机更新
      gameLoop.update(deltaMS);
      
      // 🔍 看门狗：检测状态机是否卡住
      const now = Date.now();
      if (now - lastWatchdogCheck > 1000) { // 每秒检查一次
        lastWatchdogCheck = now;
        
        const currentState = ctx.machine?.currentKey;
        const stateChangeTime = ctx.machine?.lastChangeTime ?? now;
        const timeSinceChange = now - stateChangeTime;
        
        if (currentState && currentState === lastWatchdogState) {
          watchdogStuckTime += 1000;
          
          // 如果状态超过 8 秒未改变，记录警告
          if (watchdogStuckTime >= 8000 && window.__TRACE__) {
            console.warn(`🐕 [Watchdog] State stuck in ${currentState} for ${(watchdogStuckTime/1000).toFixed(1)}s`);
            console.warn(`   Last await: ${ctx.machine.lastAwaitLabel ?? 'unknown'}`);
            console.warn(`   Active bullets: ${bulletSystem?.activeBullets?.length ?? 0}`);
            console.warn(`   Active FX: ${fxSystem?.activeTimelines?.length ?? 0}`);
          }
        } else {
          lastWatchdogState = currentState;
          watchdogStuckTime = 0;
        }
      }
      
      // 🔥 更新连击系统（热度衰减、过载状态）
      comboSystem.update(deltaMS);
      
      // 关卡管理器更新
      levelManager.setPaused(slotSystem.isSpinning);
      levelManager.update(deltaMS);
      jackpotSystem.update(deltaMS);
      
      // 🎛️ 战况统计更新（节流 200ms）
      statsTimer += deltaMS;
      if (statsTimer >= 200) {
        statsTimer = 0;
        
        // 收集所有统计数据（确保所有字段都有有效值）
        const comboState = comboSystem.getState();
        const rtp = rtpManager.calculateRTP();
        const hitRate = rtpManager.totalSpins > 0 ? (rtpManager.hitCount / rtpManager.totalSpins) * 100 : 0;
        const net = rtpManager.totalWin - rtpManager.totalBet;
        
        // ✅ Boss HP 信息（从 JackpotSystem 实时获取）
        let bossHP = 0;
        let bossHPMax = 1;
        let bossHPpct = 100;
        let bossName = 'BOSS';
        
        if (jackpotSystem) {
          bossHP = Number(jackpotSystem.hp ?? 0);
          bossHPMax = Number(jackpotSystem.maxHP ?? 1);
          bossName = String(jackpotSystem.bossName ?? 'BOSS');
          
          // 安全计算百分比（防止除以 0）
          if (bossHPMax > 0) {
            bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
          } else {
            bossHPpct = bossHP > 0 ? 100 : 0;
          }
        }
        
        // 获取活跃子弹数（安全访问）
        let activeBulletsCount = 0;
        if (bulletSystem && bulletSystem.activeBullets) {
          activeBulletsCount = Array.isArray(bulletSystem.activeBullets) 
            ? bulletSystem.activeBullets.length 
            : 0;
        }
        
        // 获取活跃特效数（安全访问）
        let activeFXCount = 0;
        if (fxSystem) {
          if (fxSystem.activeTimelines && Array.isArray(fxSystem.activeTimelines)) {
            activeFXCount = fxSystem.activeTimelines.length;
          } else if (fxSystem.activeLines && fxSystem.activeGlows) {
            // 备用计数方式
            activeFXCount = (fxSystem.activeLines?.length ?? 0) + 
                          (fxSystem.activeGlows?.length ?? 0) +
                          (fxSystem.activeScans?.length ?? 0);
          }
        }
        
        // 获取僵尸存活数（多重后备）
        let zombiesAlive = 0;
        if (enemySystem) {
          if (typeof enemySystem.getAliveCount === 'function') {
            zombiesAlive = enemySystem.getAliveCount();
          } else if (Array.isArray(enemySystem.zombies)) {
            zombiesAlive = enemySystem.zombies.filter(z => z && !z.destroyed).length;
          }
        }
        
        // 获取累计伤害（用于 DPS 计算）
        let totalDamage = 0;
        if (enemySystem) {
          totalDamage = enemySystem.totalDamageDealt ?? 0;
        }
        
        // 构建完整的统计数据对象
        const statsData = {
          // ===== 第1部分：战斗概况 =====
          spins: rtpManager.totalSpins ?? 0,
          hitRate: Number(hitRate) || 0,
          combo: rtpManager.combo ?? 0,
          totalDamage: Number(totalDamage) || 0, // 用于 DPS 计算（StatsPanel 自动计算）
          
          // ✅ Boss 信息（实时从 JackpotSystem 获取）
          bossName: bossName,
          bossHPpct: Number(bossHPpct) || 0,
          bossHP: Number(bossHP) || 0,
          bossHPMax: Number(bossHPMax) || 1,
          
          // 僵尸统计
          zombieAlive: Number(zombiesAlive) || 0,
          zombieSpawned: Number(enemySystem?.totalSpawned ?? 0),
          zombieKilled: Number(enemySystem?.totalKilled ?? 0),
          
          // 关卡进度
          level: Number(levelManager?.currentLevel ?? 0) + 1,
          levelKills: Number(levelManager?.kills ?? 0),
          levelTarget: Number(levelManager?.killsToAdvance ?? 100),
          
          // ===== 第2部分：经济监控 =====
          rtp: Number(rtp) || 0,
          totalBet: Number(rtpManager.totalBet ?? 0),
          totalWin: Number(rtpManager.totalWin ?? 0),
          net: Number(net) || 0,
          bossBonusTotal: Number(ctx.bossBonusTotal ?? 0),
          
          // ===== 第3部分：系统状态 =====
          currentBet: Number(currentBet) || 10,
          activeBullets: Number(activeBulletsCount) || 0,
          activeFX: Number(activeFXCount) || 0,
          
          // 注意: FPS 由 StatsPanel.js 自动计算（基于 performance.now()）
        };
        
        // ✅ 更新新的统计面板（index.html #sidebar）
        updateStatsPanel(statsData);
        
        // ✅ 更新旧的 RTPManager 面板（兼容）
        rtpManager.setExternalStats?.({
          zombieAlive: statsData.zombieAlive,
          zombieSpawned: statsData.zombieSpawned,
          zombieKilled: statsData.zombieKilled,
          bossBonusTotal: statsData.bossBonusTotal,
          bossName: statsData.bossName,
          bossHPpct: statsData.bossHPpct,
          bossHP: statsData.bossHP,
          bossHPMax: statsData.bossHPMax,
          level: statsData.level,
          levelKills: statsData.levelKills,
          levelTarget: statsData.levelTarget,
        });

        // 🔥 更新连击/热度 UI
        ctx.hudSystem?.setComboState?.({
          comboCount: comboState.comboCount,
          heatPercent: comboState.heatPercent,
          heatColor: comboSystem.getHeatColor(),
          overdriveActive: comboState.overdriveActive,
        });
      }
    };
    game.ticker.add(tickerHandler);
    console.log('[main] Ticker handler attached');

    // ========== 步骤 9: Spin 按钮逻辑（触发状态机）==========
    
    slotSystem.onWin = ({ totalWin, winLines }) => {
      console.log('Win lines:', winLines);
      if (totalWin > currentBet * 10) {
        setAutoActive(false); // 大奖自动停止
      }
    };

    // Spin 锁（防止快速点击）
    const SPIN_LOCK_KEY = '__D_SLOTGAME_SPIN_LOCK__';
    
    const triggerSpin = () => {
      // 🛡️ 防止重复触发
      if (globalThis[SPIN_LOCK_KEY]) return;
      if (slotSystem.isSpinning) return;
      if (!ctx.machine) return;
      
      // 🛡️ 重入保护：仅在 IDLE 状态时允许 spin
      const currentState = ctx.machine.currentKey;
      if (currentState && currentState !== 'IDLE') {
        console.warn(`[main] Cannot spin: not in IDLE state (current: ${currentState})`);
        return;
      }

      console.log('[main] Spin button clicked -> SPINNING');
      
      // 设置锁
      globalThis[SPIN_LOCK_KEY] = true;
      
      // 触发状态机转换到 SPINNING 状态
      ctx.machine.change(GameStateKey.SPINNING).then(() => {
        // Spin 完成后解锁
        globalThis[SPIN_LOCK_KEY] = false;
        
        // 自动旋转逻辑
        if (isAutoSpin) {
          setTimeout(() => {
            if (isAutoSpin && !slotSystem.isSpinning) {
              triggerSpin();
            }
          }, 260);
        }
      }).catch((err) => {
        console.error('[main] Spin error:', err);
        globalThis[SPIN_LOCK_KEY] = false;
        slotSystem.isSpinning = false;
      });
    };

    spinButton.addEventListener('click', async () => {
      await unlockAudioOnFirstGesture(); // 🔓 首次交互解锁音频
      audioSystem.play('click'); // 🔊 点击音效
      setAutoActive(false);
      triggerSpin();
    });

    autoBtn.addEventListener('click', async () => {
      if (slotSystem.isSpinning) return;
      await unlockAudioOnFirstGesture(); // 🔓 首次交互解锁音频
      audioSystem.play('switch'); // 🔊 切换音效
      setAutoActive(!isAutoSpin);
      if (isAutoSpin) {
        triggerSpin();
      }
    });

    // ========== 步骤 10: 调试接口 ==========
    globalThis.__dslot = {
      game,
      gameLoop,
      ctx,
      gridSystem,
      enemySystem,
      floatingTextSystem,
      fxSystem,
      bulletSystem,
      levelManager,
      slotSystem,
      jackpotSystem,
      comboSystem, // 🔥 连击系统
      upgradeSystem, // 🎯 升级系统
      audioSystem, // 🔊 音频系统
    };

    // ========== 步骤 11: 主题切换器 ==========
    if (themeSwitcher) {
      const themes = Object.entries(UIThemes);
      themeSwitcher.innerHTML = '';
      themes.forEach(([key, cfg]) => {
        const btn = document.createElement('button');
        btn.className = 'theme-dot';
        btn.style.background = cfg.primary;
        btn.title = cfg.name;
        btn.addEventListener('click', async () => {
          await unlockAudioOnFirstGesture(); // 🔓 首次交互解锁音频
          audioSystem.play('switch'); // 🔊 主题切换音效
          document.querySelectorAll('.theme-dot').forEach((n) => n.classList.remove('active'));
          btn.classList.add('active');
          themeManager.setTheme(key);
        });
        themeSwitcher.appendChild(btn);
        if (key === themeManager.currentTheme) btn.classList.add('active');
      });

      themeManager.subscribe((theme) => {
        document.querySelectorAll('.theme-dot').forEach((n) => {
          n.classList.toggle('active', n.style.background.toLowerCase() === theme.primary.toLowerCase());
        });
      });
    }

    // ========== 步骤 12: 主题传播 ==========
    themeManager.subscribe((theme) => {
      applyCssTheme(theme);
      gridSystem.updateTheme?.(theme);
      slotSystem.updateTheme?.(theme);
      enemySystem.updateTheme?.(theme);
      floatingTextSystem.updateTheme?.(theme);
      rtpManager.updateTheme?.(theme);
      game.updateTheme?.(theme);
    });

    // 初始化默认主题
    themeManager.setTheme(themeManager.currentTheme);

    console.log('[main] ✅ Game fully initialized and ready!');

  } catch (err) {
    console.error('❌ Failed to init game:', err);
  }
})();
}
