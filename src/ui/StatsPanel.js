/**
 * 🎛️ StatsPanel - 专业战斗与经济仪表板
 * 
 * 职责：
 * - 缓存所有 DOM 引用
 * - 提供统一的更新接口
 * - 优雅处理缺失数据
 * - 格式化数值显示（千位分隔符）
 * - 支持调试日志
 * - 计算衍生指标（DPS等）
 */

/**
 * 格式化数字（带千位分隔符）
 * @param {number} n - 数字
 * @param {number} digits - 小数位数
 * @returns {string}
 */
function formatNumber(n, digits = 2) {
  const num = Number(n || 0);
  const fixed = num.toFixed(digits);
  
  // 添加千位分隔符
  const [integer, decimal] = fixed.split('.');
  const withCommas = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return decimal !== undefined ? `${withCommas}.${decimal}` : withCommas;
}

/**
 * 格式化百分比（1 位小数）
 * @param {number} value - 数值
 * @returns {string}
 */
function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

/**
 * 格式化金额（千位分隔符 + 2 位小数）
 * @param {number} value - 金额
 * @returns {string}
 */
function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * 格式化整数（千位分隔符）
 * @param {number} value - 整数
 * @returns {string}
 */
function formatInteger(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * 格式化连击（带 x 前缀）
 * @param {number} value - 连击数
 * @returns {string}
 */
function formatCombo(value) {
  const num = Number(value || 0);
  return num > 0 ? `x${num}` : '--';
}

/**
 * 格式化关卡进度
 * @param {number} level - 关卡
 * @param {number} kills - 击杀数
 * @param {number} target - 目标数
 * @returns {string}
 */
function formatLevelProgress(level, kills, target) {
  const k = formatInteger(kills);
  const t = formatInteger(target);
  return `Lv${level} (${k}/${t})`;
}

/**
 * 安全设置文本内容
 */
function safeSetText(element, value) {
  if (element && element.textContent !== undefined) {
    element.textContent = value;
  }
}

/**
 * 安全设置样式
 */
function safeSetStyle(element, property, value) {
  if (element && element.style) {
    element.style[property] = value;
  }
}

/**
 * StatsPanel 类
 */
class StatsPanel {
  constructor() {
    this.fields = {};
    this.initialized = false;
    this.updateCount = 0;
    this.lastUpdate = 0;
    
    // 调试日志开关
    this.debug = false;
    
    // 数值缓存（用于检测变化和计算DPS）
    this.lastValues = {};
    
    // DPS 计算相关
    this.damageHistory = []; // 最近5秒的伤害记录 [{time, damage}, ...]
    this.DPS_WINDOW = 5000; // 5秒窗口
    
    // Boss HP 容器
    this.bossHPContainer = null;
    this.bossHPFill = null;
    this.bossHPPercentage = null;
    
    // FPS 计算
    this.fpsHistory = [];
    this.lastFrameTime = performance.now();
  }

  /**
   * 初始化面板（缓存 DOM 引用）
   */
  init(rootSelector = '#sidebar') {
    try {
      const root = typeof rootSelector === 'string' 
        ? document.querySelector(rootSelector) 
        : rootSelector;

      if (!root) {
        console.warn('[StatsPanel] Root element not found:', rootSelector);
        return false;
      }

      // 缓存所有 data-field 元素
      const fieldNames = [
        // 战斗概况
        'spins',          // 总局数
        'hitRate',        // 命中率
        'combo',          // 连击数
        'dps',            // DPS
        'bossName',       // Boss 名称
        'bossHPText',     // Boss 血量文本
        'zAlive',         // 当前僵尸
        'zSpawned',       // 总生成僵尸
        'zKilled',        // 累计击杀
        'level',          // 当前关卡
        'levelProgress',  // 关卡进度
        
        // 经济监控
        'rtp',            // 实时RTP
        'in',             // 总投入
        'out',            // 总回收
        'net',            // 净收益
        'bossBonus',      // Boss 奖励
        
        // 系统状态
        'bet',            // 当前下注
        'bullets',        // 子弹并发
        'fx',             // 特效并发
        'fps',            // FPS
        'frameTime',      // 帧耗时
      ];

      let foundCount = 0;
      fieldNames.forEach((name) => {
        const element = root.querySelector(`[data-field="${name}"]`);
        if (element) {
          this.fields[name] = element;
          foundCount++;
        } else {
          this.fields[name] = null;
          if (this.debug) {
            console.warn(`[StatsPanel] Field not found: ${name}`);
          }
        }
      });

      // 缓存 Boss HP 条特殊元素
      this.bossHPFill = document.querySelector('.boss-hp-fill');
      this.bossHPPercentage = document.querySelector('.boss-hp-percentage');
      this.bossHPContainer = document.querySelector('.boss-hp-container');

      // 系统部分折叠功能（桌面端默认展开，移动端默认折叠）
      const systemToggle = document.getElementById('system-toggle');
      const systemContent = document.getElementById('system-content');
      
      if (systemToggle && systemContent) {
        systemToggle.addEventListener('click', () => {
          // 检查屏幕宽度
          const isMobile = window.innerWidth <= 768;
          
          if (isMobile) {
            // 移动端：切换 expanded 类
            const isCollapsed = !systemContent.classList.contains('expanded');
            
            if (isCollapsed) {
              systemContent.classList.add('expanded');
            } else {
              systemContent.classList.remove('expanded');
            }
            
            const icon = systemToggle.querySelector('.toggle-icon');
            if (icon) {
              icon.textContent = isCollapsed ? '▲' : '▼';
            }
          }
          // 桌面端：不响应点击（始终展开）
        });
        
        // 初始化状态
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          systemContent.classList.remove('expanded'); // 移动端默认折叠
          const icon = systemToggle.querySelector('.toggle-icon');
          if (icon) {
            icon.textContent = '▼';
            icon.style.display = '';
          }
        } else {
          systemContent.style.display = 'block'; // 桌面端强制展开
          const icon = systemToggle.querySelector('.toggle-icon');
          if (icon) {
            icon.style.display = 'none'; // 隐藏折叠图标
          }
        }
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
          const isMobile = window.innerWidth <= 768;
          const icon = systemToggle.querySelector('.toggle-icon');
          
          if (isMobile) {
            systemContent.style.display = '';
            if (icon) icon.style.display = '';
          } else {
            systemContent.style.display = 'block';
            if (icon) icon.style.display = 'none';
          }
        });
      }

      this.initialized = foundCount > 0;
      console.log(`[StatsPanel] Initialized with ${foundCount}/${fieldNames.length} fields`);
      
      return this.initialized;
    } catch (error) {
      console.error('[StatsPanel] Init error:', error);
      return false;
    }
  }

  /**
   * 更新统计面板
   * @param {Object} stats - 统计数据对象
   */
  update(stats = {}) {
    if (!this.initialized) {
      console.warn('[StatsPanel] Not initialized, call init() first');
      return;
    }

    // 检查调试模式
    if (typeof window !== 'undefined' && window.__HUD_DEBUG__) {
      this.debug = true;
    }

    const now = Date.now();
    this.updateCount++;
    this.lastUpdate = now;

    if (this.debug && this.updateCount % 50 === 0) {
      console.log(`[StatsPanel #${this.updateCount}]`, stats);
    }

    try {
      // ========== 🎯 KPI 卡片更新 ==========
      
      // Hit Rate KPI
      if (stats.hitRate !== undefined) {
        const formatted = formatPercentage(stats.hitRate);
        this.updateFieldWithAnimation('hitRate', formatted, stats.hitRate);
        
        // 颜色编码
        const hitColor = stats.hitRate > 80 ? '#00FF88' : 
                        stats.hitRate > 50 ? '#00F0FF' : '#FF4444';
        safeSetStyle(this.fields.hitRate, 'color', hitColor);
      }
      
      // Combo KPI
      if (stats.combo !== undefined) {
        const comboValue = Number(stats.combo);
        const formatted = formatCombo(comboValue);
        this.updateFieldWithAnimation('combo', formatted, comboValue);
        
        // 连击激活状态
        const comboCard = document.querySelector('[data-kpi="combo"]');
        if (comboCard) {
          if (comboValue > 5) {
            comboCard.classList.add('combo-active');
          } else {
            comboCard.classList.remove('combo-active');
          }
        }
      }
      
      // ✅ Boss HP KPI（安全处理缺失数据）
      const hasBossData = stats.bossHP !== undefined && stats.bossHPMax !== undefined && stats.bossHPMax > 0;
      
      if (hasBossData) {
        const bossHP = Number(stats.bossHP) || 0;
        const bossHPMax = Number(stats.bossHPMax) || 1;
        const bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
        
        const formatted = formatPercentage(bossHPpct);
        this.updateFieldWithAnimation('bossHPpct', formatted, bossHPpct);
        
        // 更新 KPI HP 条
        const kpiHpFill = document.querySelector('.kpi-hp-fill');
        if (kpiHpFill) {
          kpiHpFill.style.width = `${bossHPpct}%`;
        }
        
        // 颜色编码
        const hpColor = bossHPpct > 50 ? '#00FF88' : 
                       bossHPpct > 20 ? '#FFA500' : '#FF4444';
        safeSetStyle(this.fields.bossHPpct, 'color', hpColor);
        
        // Boss 警告状态
        const bossCard = document.querySelector('.boss-hp-kpi');
        if (bossCard) {
          if (bossHPpct < 20) {
            bossCard.setAttribute('data-warning', 'true');
          } else {
            bossCard.removeAttribute('data-warning');
          }
        }
      } else {
        // 没有 Boss 数据时显示 "--"
        safeSetText(this.fields.bossHPpct, '--');
        
        const kpiHpFill = document.querySelector('.kpi-hp-fill');
        if (kpiHpFill) {
          kpiHpFill.style.width = '0%';
        }
      }
      
      // RTP KPI
      if (stats.rtp !== undefined) {
        const formatted = formatPercentage(stats.rtp);
        this.updateFieldWithAnimation('rtp', formatted, stats.rtp);
        
        // 颜色编码
        const rtpColor = stats.rtp > 100 ? '#00FF88' : 
                        stats.rtp > 90 ? '#00F0FF' : '#FF4444';
        safeSetStyle(this.fields.rtp, 'color', rtpColor);
      }
      
      // ========== 📋 详细表格更新 ==========
      
      // 总局数
      if (stats.spins !== undefined) {
        safeSetText(this.fields.spins, formatInteger(stats.spins));
      }
      
      // DPS
      if (stats.totalDamage !== undefined) {
        const currentDamage = Number(stats.totalDamage);
        this.recordDamage(currentDamage, now);
        const dps = this.calculateDPS(now);
        safeSetText(this.fields.dps, formatInteger(dps));
      } else {
        safeSetText(this.fields.dps, '--');
      }
      
      // Boss 名称
      if (stats.bossName !== undefined) {
        safeSetText(this.fields.bossName, String(stats.bossName));
      }
      
      // ✅ Boss HP 文本（详细表格，显示百分比 + (当前/最大)）
      if (hasBossData) {
        const bossHP = Number(stats.bossHP) || 0;
        const bossHPMax = Number(stats.bossHPMax) || 1;
        const bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
        
        const hpText = `${bossHPpct.toFixed(1)}% (${formatInteger(bossHP)}/${formatInteger(bossHPMax)})`;
        safeSetText(this.fields.bossHPText, hpText);
        
        // 颜色编码
        const hpColor = bossHPpct > 50 ? '#00FF88' : 
                       bossHPpct > 20 ? '#FFA500' : '#FF4444';
        safeSetStyle(this.fields.bossHPText, 'color', hpColor);
      } else {
        // 没有数据时显示 "--"
        safeSetText(this.fields.bossHPText, '--');
        safeSetStyle(this.fields.bossHPText, 'color', '');
      }
      
      // 僵尸统计
      if (stats.zombieAlive !== undefined) {
        safeSetText(this.fields.zAlive, formatInteger(stats.zombieAlive));
      }
      
      if (stats.zombieSpawned !== undefined) {
        safeSetText(this.fields.zSpawned, formatInteger(stats.zombieSpawned));
      }
      
      if (stats.zombieKilled !== undefined) {
        safeSetText(this.fields.zKilled, formatInteger(stats.zombieKilled));
      }
      
      // 关卡进度
      if (stats.level !== undefined && stats.levelKills !== undefined && stats.levelTarget !== undefined) {
        const formatted = formatLevelProgress(stats.level, stats.levelKills, stats.levelTarget);
        safeSetText(this.fields.levelProgress, formatted);
      }
      
      // Boss 奖励累计
      if (stats.bossBonusTotal !== undefined) {
        safeSetText(this.fields.bossBonus, formatMoney(stats.bossBonusTotal));
      }
      
      // ========== 💰 经济统计 ==========
      
      // 总投入
      if (stats.totalBet !== undefined) {
        safeSetText(this.fields.in, formatMoney(stats.totalBet));
      }
      
      // 总回收
      if (stats.totalWin !== undefined) {
        safeSetText(this.fields.out, formatMoney(stats.totalWin));
      }
      
      // 净收益
      if (stats.net !== undefined) {
        const net = Number(stats.net);
        safeSetText(this.fields.net, formatMoney(net));
        
        // 净收益颜色
        const netColor = net < 0 ? '#FF4444' : net > 0 ? '#00FF88' : '#00F0FF';
        safeSetStyle(this.fields.net, 'color', netColor);
      }
      
      // ========== 第3部分：系统状态 ==========
      
      if (stats.currentBet !== undefined) {
        safeSetText(this.fields.bet, formatNumber(stats.currentBet, 0));
      }
      
      if (stats.activeBullets !== undefined) {
        safeSetText(this.fields.bullets, formatNumber(stats.activeBullets, 0));
      }
      
      if (stats.activeFX !== undefined) {
        safeSetText(this.fields.fx, formatNumber(stats.activeFX, 0));
      }
      
      // FPS 计算
      this.updateFPS();
      
    } catch (error) {
      console.error('[StatsPanel] Update error:', error);
    }
  }

  /**
   * 记录伤害（用于 DPS 计算）
   */
  recordDamage(totalDamage, time) {
    // 如果总伤害比上次大，说明造成了新伤害
    const lastTotal = this.lastValues.totalDamage || 0;
    const newDamage = totalDamage - lastTotal;
    
    if (newDamage > 0) {
      this.damageHistory.push({ time, damage: newDamage });
    }
    
    this.lastValues.totalDamage = totalDamage;
    
    // 清理旧数据（超过窗口期的）
    const cutoff = time - this.DPS_WINDOW;
    this.damageHistory = this.damageHistory.filter((record) => record.time >= cutoff);
  }

  /**
   * 计算 DPS（最近5秒平均）
   */
  calculateDPS(now) {
    if (this.damageHistory.length === 0) return 0;
    
    const cutoff = now - this.DPS_WINDOW;
    const recentDamage = this.damageHistory.filter((record) => record.time >= cutoff);
    
    if (recentDamage.length === 0) return 0;
    
    const totalDamage = recentDamage.reduce((sum, record) => sum + record.damage, 0);
    const timeSpan = Math.max(1, (now - recentDamage[0].time) / 1000); // 秒
    
    return totalDamage / timeSpan;
  }

  /**
   * 更新 FPS（基于实际帧时间）
   */
  updateFPS() {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    // 记录最近10帧
    this.fpsHistory.push(frameTime);
    if (this.fpsHistory.length > 10) {
      this.fpsHistory.shift();
    }
    
    // 计算平均帧时间
    const avgFrameTime = this.fpsHistory.reduce((sum, t) => sum + t, 0) / this.fpsHistory.length;
    const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
    
    // 更新显示
    safeSetText(this.fields.fps, Math.round(fps).toString());
    safeSetText(this.fields.frameTime, formatNumber(avgFrameTime, 1));
    
    // FPS 颜色（性能指标）
    const fpsColor = fps < 45 ? '#FF4444' : fps < 55 ? '#FF003C' : '#00FF88';
    safeSetStyle(this.fields.fps, 'color', fpsColor);
  }

  /**
   * 更新字段并触发动画（如果值变化）
   */
  updateFieldWithAnimation(fieldName, displayText, numericValue) {
    const field = this.fields[fieldName];
    if (!field) return;
    
    // 检查值是否变化
    const lastValue = this.lastValues[fieldName];
    const hasChanged = lastValue !== undefined && lastValue !== numericValue;
    
    // 更新文本
    safeSetText(field, displayText);
    
    // 如果值变化，触发动画
    if (hasChanged) {
      field.classList.remove('value-changed');
      void field.offsetWidth;
      field.classList.add('value-changed');
      
      setTimeout(() => {
        field.classList.remove('value-changed');
      }, 300);
    }
    
    // 缓存当前值
    this.lastValues[fieldName] = numericValue;
  }

  /**
   * 重置所有字段为默认值
   */
  reset() {
    this.lastValues = {};
    this.damageHistory = [];
    this.fpsHistory = [];
    
    this.update({
      spins: 0,
      hitRate: 0,
      combo: 0,
      totalDamage: 0,
      bossName: 'BOSS',
      bossHPpct: 100,
      bossHP: 0,
      bossHPMax: 0,
      zombieAlive: 0,
      zombieSpawned: 0,
      zombieKilled: 0,
      level: 1,
      levelKills: 0,
      levelTarget: 100,
      rtp: 0,
      totalBet: 0,
      totalWin: 0,
      net: 0,
      bossBonusTotal: 0,
      currentBet: 10,
      activeBullets: 0,
      activeFX: 0,
    });
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      updateCount: this.updateCount,
      lastUpdate: this.lastUpdate,
      fieldsCount: Object.keys(this.fields).length,
      fieldsFound: Object.values(this.fields).filter((f) => f !== null).length,
      damageHistoryLength: this.damageHistory.length,
      debug: this.debug,
    };
  }
}

// ========== 导出单例 ==========
export const statsPanel = new StatsPanel();

export function initStatsPanel(rootSelector = '#sidebar') {
  return statsPanel.init(rootSelector);
}

export function updateStatsPanel(stats) {
  statsPanel.update(stats);
}

export function resetStatsPanel() {
  statsPanel.reset();
}

export function getStatsPanelDebugInfo() {
  return statsPanel.getDebugInfo();
}
