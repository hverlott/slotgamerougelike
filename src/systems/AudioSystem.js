import { Howl, Howler } from 'howler';

/**
 * 🔊 AudioSystem - 修复版游戏音频管理系统
 * 
 * 功能：
 * - 仅加载真实存在的本地文件（src/ui/*.ogg）
 * - AudioContext 解锁支持（用户手势后恢复）
 * - 安全的播放接口（不可用音效自动跳过）
 * - 控制音量分组（SFX、Music、UI）
 * - 防止同一音效过度叠加（复音限制）
 * - 支持全局静音/取消静音
 * 
 * API:
 * - audioSystem.unlock() - 解锁 AudioContext（首次用户手势后调用）
 * - audioSystem.preload() - 预加载音效（fire-and-forget，不阻塞）
 * - audioSystem.play(name, options) - 播放音效（安全，不抛异常）
 * - audioSystem.setGroupVolume(group, volume) - 设置分组音量
 * - audioSystem.mute() / unmute() - 全局静音控制
 */

export class AudioSystem {
  constructor() {
    // 音效库
    this.sounds = new Map(); // name -> { howl, config, status }
    
    // 加载状态追踪
    this.loadingStatus = new Map(); // name -> { loaded, failed, url, error }
    
    // 分组音量（0-1）
    this.groupVolumes = {
      sfx: 0.7,    // 游戏音效
      music: 0.5,  // 背景音乐
      ui: 0.6,     // UI 音效
    };
    
    // 全局静音状态
    this.isMuted = false;
    
    // AudioContext 解锁状态
    this.audioUnlocked = false;
    
    // 复音限制（防止同一音效过度叠加）
    this.activeInstances = new Map(); // name -> count
    this.maxPolyphony = {
      click: 1,
      switch: 1,
      tap: 2,
      default: 5,
    };
    
    // 🎵 音效配置清单（仅真实存在的本地文件）
    this.soundConfigs = {
      // 🎮 UI 音效（使用现有 src/ui/*.ogg 文件）
      click: {
        src: ['/src/ui/click-a.ogg'],
        volume: 0.5,
        group: 'ui',
      },
      switch: {
        src: ['/src/ui/switch-a.ogg'],
        volume: 0.5,
        group: 'ui',
      },
      
      // 🎰 老虎机音效（映射到现有文件）
      spin_start: {
        src: ['/src/ui/tap-a.ogg'],
        volume: 0.6,
        group: 'sfx',
      },
      spin_stop: {
        src: ['/src/ui/tap-b.ogg'],
        volume: 0.6,
        group: 'sfx',
      },
      
      // 🎉 胜利音效（映射到现有文件）
      win_small: {
        src: ['/src/ui/click-b.ogg'],
        volume: 0.5,
        group: 'sfx',
      },
      win_big: {
        src: ['/src/ui/switch-b.ogg'],
        volume: 0.7,
        group: 'sfx',
      },
      
      // 💥 战斗音效（临时禁用，不加载）
      // shoot: { disabled: true },
      // hit: { disabled: true },
      // explosion: { disabled: true },
      // warning: { disabled: true },
    };
    
    // 已加载状态
    this.loaded = false;
    this.loadSummary = null;
  }

  /**
   * 🔓 解锁 AudioContext（必须在用户手势后调用）
   * @returns {Promise<boolean>} - 解锁是否成功
   */
  async unlock() {
    if (this.audioUnlocked) {
      return true; // 已经解锁
    }
    
    try {
      // 检查 Howler 是否有 AudioContext
      if (Howler.ctx && Howler.ctx.state === 'suspended') {
        console.log('[AudioSystem] 🔓 解锁 AudioContext...');
        await Howler.ctx.resume();
        
        if (Howler.ctx.state === 'running') {
          this.audioUnlocked = true;
          console.log('[AudioSystem] ✅ AudioContext 已解锁');
          return true;
        } else {
          console.warn('[AudioSystem] ⚠️ AudioContext 解锁失败，状态:', Howler.ctx.state);
          return false;
        }
      } else if (Howler.ctx && Howler.ctx.state === 'running') {
        this.audioUnlocked = true;
        console.log('[AudioSystem] ✅ AudioContext 已激活');
        return true;
      } else {
        console.warn('[AudioSystem] ⚠️ AudioContext 不可用');
        return false;
      }
    } catch (error) {
      console.error('[AudioSystem] 💥 AudioContext 解锁错误:', error);
      return false;
    }
  }

  /**
   * 🎵 预加载所有音效（修复版，不阻塞启动）
   * @returns {Promise<object>} - 加载摘要
   */
  async preload() {
    if (this.loaded) return this.loadSummary;
    
    console.log('[AudioSystem] 🎵 开始预加载音效...');
    
    const results = {
      total: 0,
      loaded: [],
      failed: [],
      disabled: [],
    };

    // 过滤出启用的音效
    const enabledSounds = Object.entries(this.soundConfigs).filter(([name, config]) => {
      if (config.disabled) {
        results.disabled.push(name);
        return false;
      }
      return true;
    });

    results.total = enabledSounds.length;

    const loadPromises = enabledSounds.map(async ([name, config]) => {
      try {
        // 创建 Howl 实例
        await new Promise((resolve) => {
          const howl = new Howl({
            src: config.src,
            volume: config.volume * this.groupVolumes[config.group],
            preload: true,
            html5: false, // 使用 Web Audio API
            onload: () => {
              this.loadingStatus.set(name, {
                loaded: true,
                failed: false,
                url: config.src[0],
              });
              results.loaded.push(name);
              
              // 标记为可用
              const sound = this.sounds.get(name);
              if (sound) {
                sound.available = true;
              }
              
              resolve();
            },
            onloaderror: (id, error) => {
              this.loadingStatus.set(name, {
                loaded: false,
                failed: true,
                url: config.src[0],
                error: String(error),
              });
              results.failed.push({
                name,
                url: config.src[0],
                error: String(error),
              });
              resolve(); // 不阻塞其他音效加载
            },
          });

          this.sounds.set(name, {
            howl,
            config,
            available: false, // 在 onload 时设置为 true
          });

          // 超时保护（5 秒，仅对启用的音效）
          setTimeout(() => {
            if (!this.loadingStatus.get(name)?.loaded) {
              console.warn(`[AudioSystem] ⏱️ 加载超时: ${name}`);
              results.failed.push({
                name,
                url: config.src[0],
                error: 'Timeout',
              });
              resolve();
            }
          }, 5000);
        });

      } catch (error) {
        console.error(`[AudioSystem] 💥 严重错误: ${name}`, error);
        results.failed.push({
          name,
          url: config.src?.[0] || 'unknown',
          error: String(error),
        });
      }
    });

    // 等待所有加载完成（或超时）
    await Promise.allSettled(loadPromises);

    // 生成加载摘要
    this.loadSummary = {
      ...results,
      timestamp: new Date().toISOString(),
    };

    this.loaded = true;

    // 打印简洁摘要
    console.log(
      `[AudioSystem] 📊 加载完成！`,
      `\n  总计: ${results.total} | 成功: ${results.loaded.length} | 失败: ${results.failed.length} | 禁用: ${results.disabled.length}`,
      `\n  ✅ 已加载: ${results.loaded.join(', ') || '(无)'}`,
      results.disabled.length > 0 ? `\n  ⏸️  已禁用: ${results.disabled.join(', ')}` : '',
      results.failed.length > 0 ? `\n  ❌ 失败: ${results.failed.map(f => f.name).join(', ')}` : ''
    );

    return this.loadSummary;
  }

  /**
   * 🎼 播放音效（安全版，不抛异常）
   * @param {string} name - 音效名称
   * @param {object} options - 播放选项
   * @param {number} options.volume - 音量倍数（0-1）
   * @param {number} options.rate - 播放速率（0.5-2.0）
   * @param {boolean} options.loop - 是否循环
   * @param {boolean} options.force - 是否强制播放（忽略复音限制）
   * @param {object} options.pos - 3D 空间位置 {x, y, z}
   * @returns {number|null} - 音效实例 ID
   */
  play(name, options = {}) {
    // AudioContext 未解锁检查
    if (!this.audioUnlocked) {
      // 静默处理：AudioContext 未解锁时不播放
      return null;
    }
    
    // 全局静音检查
    if (this.isMuted) return null;
    
    // 音效存在性检查
    const sound = this.sounds.get(name);
    if (!sound) {
      // 静默处理：不存在的音效不打印警告（可能是禁用的音效）
      return null;
    }

    // 可用性检查
    if (!sound.available) {
      // 静默处理：不可用的音效不播放
      return null;
    }
    
    // 复音限制检查
    const maxPoly = this.maxPolyphony[name] ?? this.maxPolyphony.default;
    const currentCount = this.activeInstances.get(name) || 0;
    
    if (!options.force && currentCount >= maxPoly) {
      return null;
    }
    
    try {
      // 播放音效
      const { howl, config } = sound;
      const id = howl.play();
      
      // 应用选项
      if (options.volume !== undefined) {
        howl.volume(options.volume * config.volume * this.groupVolumes[config.group], id);
      }
      if (options.rate !== undefined) {
        howl.rate(options.rate, id);
      }
      if (options.loop !== undefined) {
        howl.loop(options.loop, id);
      }
      
      // 3D 空间音效
      if (options.pos) {
        // 归一化位置：假设屏幕中心是 (0,0)，范围 -1 到 1
        // x: -1 (左) ~ 1 (右)
        // y: -1 (上) ~ 1 (下)
        // z: -1 (后) ~ 1 (前)
        const { x = 0, y = 0, z = 0 } = options.pos;
        howl.pos(x, y, z, id);
        
        // 简单的衰减模型
        howl.pannerAttr({
          panningModel: 'HRTF',
          refDistance: 0.8,
          rolloffFactor: 1.5,
          distanceModel: 'exponential'
        }, id);
      } else {
         // 重置为 2D (如果之前被设置为 3D)
         howl.pos(0, 0, 0, id);
      }
      
      // 追踪活跃实例
      this.activeInstances.set(name, currentCount + 1);
      
      // 播放结束后减少计数
      howl.once('end', () => {
        const count = this.activeInstances.get(name) || 0;
        this.activeInstances.set(name, Math.max(0, count - 1));
      }, id);
      
      return id;
    } catch (error) {
      // 捕获任何播放错误（静默处理）
      return null;
    }
  }

  /**
   * 🎧 更新听众位置 (用于 3D 音效)
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  updateListener(x, y, z) {
    if (Howler.pos) {
        Howler.pos(x, y, z);
    }
  }

  /**
   * 🔇 停止指定音效
   * @param {string} name - 音效名称
   * @param {number} id - 音效实例 ID（可选）
   */
  stop(name, id) {
    const sound = this.sounds.get(name);
    if (!sound || !sound.available) return;
    
    try {
      sound.howl.stop(id);
      
      if (id === undefined) {
        // 停止所有实例
        this.activeInstances.set(name, 0);
      }
    } catch (error) {
      // 静默处理
    }
  }

  /**
   * 🔊 设置分组音量
   * @param {string} group - 分组名称 ('sfx', 'music', 'ui')
   * @param {number} volume - 音量（0-1）
   */
  setGroupVolume(group, volume) {
    if (!(group in this.groupVolumes)) {
      console.warn(`[AudioSystem] 分组不存在: ${group}`);
      return;
    }
    
    this.groupVolumes[group] = Math.max(0, Math.min(1, volume));
    
    // 更新所有该分组的音效音量
    this.sounds.forEach((sound) => {
      if (sound.config.group === group && sound.available) {
        try {
          const newVolume = sound.config.volume * this.groupVolumes[group];
          sound.howl.volume(newVolume);
        } catch (error) {
          // 静默处理
        }
      }
    });
    
    console.log(`[AudioSystem] 分组音量: ${group} = ${this.groupVolumes[group]}`);
  }

  /**
   * 🔇 全局静音
   */
  mute() {
    this.isMuted = true;
    Howler.mute(true);
    console.log('[AudioSystem] 已静音');
  }

  /**
   * 🔊 取消全局静音
   */
  unmute() {
    this.isMuted = false;
    Howler.mute(false);
    console.log('[AudioSystem] 已取消静音');
  }

  /**
   * 🎚️ 设置全局音量
   * @param {number} volume - 音量（0-1）
   */
  setMasterVolume(volume) {
    Howler.volume(Math.max(0, Math.min(1, volume)));
  }

  /**
   * 📊 获取加载状态
   * @returns {object} - 加载摘要
   */
  getLoadStatus() {
    return {
      loaded: this.loaded,
      audioUnlocked: this.audioUnlocked,
      summary: this.loadSummary,
      sounds: Array.from(this.sounds.entries()).map(([name, sound]) => ({
        name,
        available: sound.available,
        status: this.loadingStatus.get(name),
      })),
    };
  }

  /**
   * 🗑️ 销毁音频系统
   */
  destroy() {
    this.sounds.forEach((sound) => {
      try {
        sound.howl.unload();
      } catch (error) {
        // 静默处理
      }
    });
    this.sounds.clear();
    this.activeInstances.clear();
    this.loadingStatus.clear();
    console.log('[AudioSystem] 已销毁');
  }
}

// 导出单例
export const audioSystem = new AudioSystem();
