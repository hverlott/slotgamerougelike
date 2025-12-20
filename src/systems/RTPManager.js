import { themeManager } from './ThemeManager.js';

const PRIMARY = () => themeManager.getColor('primary');
const ACCENT = () => themeManager.getColor('accent');
const ENERGY = () => themeManager.getColor('win');
const BACKGROUND = () => themeManager.getColor('background');

export class RTPManager {
  constructor(options = {}) {
    this.totalBet = 0;
    this.totalWin = 0;
    this.totalSpins = 0;
    this.hitCount = 0; // Number of winning spins
    this.totalHits = 0; // Number of successful bullet hits
    this.combo = 0;
    this.roundHistory = [];
    this.pendingRound = null;
    this.external = {
      zombieAlive: 0,
      zombieSpawned: 0,
      zombieKilled: 0,
      bossBonusTotal: 0,
      bossName: 'BOSS',
      bossHPpct: 100,
      bossHP: 0,
      bossHPMax: 0,
      level: 1,
      levelKills: 0,
      levelTarget: 100,
    };
    
    // 🎛️ 可选：创建独立的调试面板（默认禁用，避免重复渲染）
    this.enableDebugPanel = options.enableDebugPanel ?? false;
    
    if (this.enableDebugPanel) {
      this.panel = this.createPanel();
      this.fields = this.createFields(this.panel);
      this.updatePanel();
      themeManager.subscribe((theme) => this.updateTheme(theme));
    } else {
      this.panel = null;
      this.fields = {};
      console.log('[RTPManager] Debug panel disabled, using StatsPanel for rendering');
    }
  }

  recordBet(bet) {
    this.startRound(bet);
  }

  recordHit(damage) {
    this.totalHits++;
    // Optional: track damage here if needed, but usually tracked in EnemySystem
  }

  createPanel() {
    const existing = document.getElementById('data-panel');
    if (existing) return existing;
    const panel = document.createElement('div');
    panel.id = 'data-panel';
    document.body.appendChild(panel);
    return panel;
  }

  createFields(panel) {
    // if panel is empty, build structure
    if (!panel.querySelector('[data-field]')) {
      panel.innerHTML = `
        <div class="title">实时战况</div>
        <div>总局数(Spins): <span data-field="spins">0</span></div>
        <div>命中率(Hit): <span data-field="hitRate">0%</span></div>
        <div>连胜(Combo): <span data-field="combo">0</span></div>
        <div>当前Boss: <span data-field="bossName">BOSS</span></div>
        <div>Boss血量: <span data-field="bossHP">100% (0/0)</span></div>
        <div>当前僵尸数: <span data-field="zAlive">0</span></div>
        <div>总产生僵尸: <span data-field="zSpawned">0</span></div>
        <div>累计消耗僵尸: <span data-field="zKilled">0</span></div>
        <div>Boss奖励累计: <span data-field="bossBonus">0.00</span></div>
        <div>关卡进度: <span data-field="levelProgress">1 / 100 (0%)</span></div>
        <div class="title" style="margin-top:8px;">财务监控</div>
        <div>总投入(In): <span data-field="in">0.00</span></div>
        <div>总回报(Out): <span data-field="out">0.00</span></div>
        <div>实时RTP: <span data-field="rtp">0%</span></div>
        <div>净收益(Net): <span data-field="net">0.00</span></div>
      `;
    }
    const get = (name) => panel.querySelector(`[data-field="${name}"]`);
    return {
      spins: get('spins'),
      hitRate: get('hitRate'),
      combo: get('combo'),
      bossName: get('bossName'),
      bossHP: get('bossHP'),
      zAlive: get('zAlive'),
      zSpawned: get('zSpawned'),
      zKilled: get('zKilled'),
      bossBonus: get('bossBonus'),
      levelProgress: get('levelProgress'),
      in: get('in'),
      out: get('out'),
      rtp: get('rtp'),
      net: get('net'),
    };
  }

  startRound(bet) {
    this.pendingRound = { bet: bet ?? 0, win: 0 };
    this.totalBet += bet ?? 0;
    this.totalSpins += 1;
    this.updatePanel();
  }

  finishRound(win) {
    if (!this.pendingRound) {
      this.startRound(0);
    }
    this.pendingRound.win = win ?? 0;
    this.totalWin += win ?? 0;
    if (win > 0) {
      this.hitCount += 1;
      this.combo += 1;
    } else {
      this.combo = 0;
    }
    this.roundHistory.push({ ...this.pendingRound });
    if (this.roundHistory.length > 50) {
      this.roundHistory.shift();
    }
    this.pendingRound = null;
    this.updatePanel();
  }

  recordRound(bet, win) {
    this.startRound(bet);
    this.finishRound(win);
  }

  calculateRTP() {
    if (this.totalBet === 0) return 0;
    return (this.totalWin / this.totalBet) * 100;
  }

  formatNumber(n, digits = 2) {
    return Number(n || 0).toFixed(digits);
  }

  updatePanel() {
    // 🎛️ 只在启用调试面板时更新 DOM
    if (!this.enableDebugPanel || !this.panel || !this.fields) {
      return; // StatsPanel 会负责渲染
    }

    const rtp = this.calculateRTP();
    const hitRate = this.totalSpins ? (this.hitCount / this.totalSpins) * 100 : 0;
    const net = this.totalWin - this.totalBet;

    const rtpColor = rtp < 90 ? '#FF4444' : rtp > 100 ? '#00FF88' : ACCENT();
    const netColor = net < 0 ? '#FF4444' : net > 0 ? '#00FF88' : ACCENT();

    if (this.fields.spins) this.fields.spins.textContent = `${this.totalSpins}`;
    if (this.fields.hitRate) this.fields.hitRate.textContent = `${this.formatNumber(hitRate, 1)}%`;
    if (this.fields.combo) this.fields.combo.textContent = `${this.combo}`;

    // 外部战况
    const ex = this.external ?? {};
    if (this.fields.bossName) this.fields.bossName.textContent = `${ex.bossName ?? 'BOSS'}`;
    if (this.fields.bossHP) {
      const pct = Math.max(0, Math.min(100, Number(ex.bossHPpct ?? 100)));
      const hp = Number(ex.bossHP ?? 0);
      const max = Number(ex.bossHPMax ?? 0);
      this.fields.bossHP.textContent = `${this.formatNumber(pct, 0)}% (${hp.toFixed(0)}/${max.toFixed(0)})`;
      this.fields.bossHP.style.color = pct < 25 ? '#FF4444' : pct > 70 ? ENERGY() : ACCENT();
    }
    if (this.fields.zAlive) this.fields.zAlive.textContent = `${ex.zombieAlive ?? 0}`;
    if (this.fields.zSpawned) this.fields.zSpawned.textContent = `${ex.zombieSpawned ?? 0}`;
    if (this.fields.zKilled) this.fields.zKilled.textContent = `${ex.zombieKilled ?? 0}`;
    if (this.fields.bossBonus) this.fields.bossBonus.textContent = this.formatNumber(ex.bossBonusTotal ?? 0);
    if (this.fields.levelProgress) {
      const lv = ex.level ?? 1;
      const k = ex.levelKills ?? 0;
      const t = ex.levelTarget ?? 100;
      const pct = t > 0 ? Math.min(100, (k / t) * 100) : 0;
      this.fields.levelProgress.textContent = `Lv${lv} ${k} / ${t} (${this.formatNumber(pct, 0)}%)`;
    }

    if (this.fields.in) this.fields.in.textContent = this.formatNumber(this.totalBet);
    if (this.fields.out) this.fields.out.textContent = this.formatNumber(this.totalWin);

    if (this.fields.rtp) {
      this.fields.rtp.textContent = `${this.formatNumber(rtp, 2)}%`;
      this.fields.rtp.style.color = rtpColor;
    }

    if (this.fields.net) {
      this.fields.net.textContent = this.formatNumber(net);
      this.fields.net.style.color = netColor;
    }
  }

  setExternalStats(next = {}) {
    if (!next || typeof next !== 'object') return;
    this.external = { ...(this.external ?? {}), ...next };
    // 🎛️ 只在启用调试面板时更新 DOM（StatsPanel 会负责主要渲染）
    if (this.enableDebugPanel) {
      this.updatePanel();
    }
  }

  updateTheme(theme) {
    // 🎛️ 只在启用调试面板时更新主题
    if (!this.enableDebugPanel || !this.panel || !theme) return;
    
    this.panel.style.background = `${theme.background}e6`;
    this.panel.style.color = theme.accent;
    this.panel.style.border = `1px solid rgba(0, 240, 255, 0.3)`;
    this.panel.style.boxShadow = `0 0 18px rgba(0,240,255,0.2)`;
    this.panel.querySelectorAll('div').forEach((div) => {
      if (div.textContent?.includes('实时战况') || div.textContent?.includes('财务监控')) {
        div.style.color = theme.primary;
      }
    });
    this.updatePanel();
  }
}

export const rtpManager = new RTPManager();
