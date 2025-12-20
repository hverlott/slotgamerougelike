
import { logger } from '../utils/Logger.js';

/**
 * 🎮 GyroController - 设备体感控制系统
 * 
 * 功能：
 * 1. 视觉视差 (Parallax): 根据设备倾斜旋转游戏舞台，营造 3D 感
 * 2. 摇一摇 (Shake): 触发自动旋转 (Auto Spin)
 * 3. 倾斜控制 (Tilt): 可选的倾斜交互
 * 
 * 修复内容：
 * - 重新校准输入处理 (Calibration)
 * - 角度限制 (Clamping)
 * - 平滑过渡 (Smoothing/LERP)
 * - 灵敏度调节 (Sensitivity)
 */
export class GyroController {
  constructor(game, options = {}) {
    this.game = game;
    this.options = {
      sensitivity: 0.05,    // 旋转灵敏度
      maxAngle: 0.1,        // 最大旋转角度 (弧度) approx 5.7 degrees
      smoothFactor: 0.1,    // 平滑插值因子 (0.05 - 0.2)
      shakeThreshold: 15,   // 摇晃阈值 (m/s²)
      shakeCooldown: 1000,  // 摇晃冷却 (ms)
      ...options
    };

    this.enabled = false;
    this.hasPermission = false;

    // 状态变量
    this.targetRotation = { x: 0, y: 0 }; // 目标角度 (gamma, beta)
    this.currentRotation = { x: 0, y: 0 }; // 当前角度 (平滑后)
    
    // 初始校准值
    this.calibration = { x: 0, y: 0, set: false };

    // 摇晃检测
    this.lastShakeTime = 0;
    this.lastAcc = { x: null, y: null, z: null };

    // 绑定方法
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleMotion = this.handleMotion.bind(this);
    this.update = this.update.bind(this);
  }

  /**
   * 🚀 请求权限 (iOS 13+ 需要)
   */
  async requestPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          this.hasPermission = true;
          logger.info('[Gyro] Permission granted');
          return true;
        } else {
          logger.warn('[Gyro] Permission denied');
          return false;
        }
      } catch (e) {
        logger.error('[Gyro] Permission error:', e);
        return false;
      }
    }
    this.hasPermission = true;
    return true;
  }

  /**
   * ▶️ 启动监听
   */
  start() {
    if (this.enabled) return;
    
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', this.handleMotion);
    }
    
    this.enabled = true;
    this.game.ticker.add(this.update);
    logger.info('[Gyro] System started');
  }

  /**
   * ⏸️ 停止监听
   */
  stop() {
    if (!this.enabled) return;
    
    window.removeEventListener('deviceorientation', this.handleOrientation);
    window.removeEventListener('devicemotion', this.handleMotion);
    
    this.game.ticker.remove(this.update);
    this.enabled = false;
    
    // 重置舞台状态
    if (this.game.gameLayer) {
        this.game.gameLayer.rotation = 0;
        this.game.gameLayer.skew.set(0);
    }
  }

  /**
   * 📐 处理设备方向 (Tilt)
   */
  handleOrientation(event) {
    // gamma: 左倾/右倾 (-90 ~ 90) -> 对应 X 轴移动或 Z 轴旋转
    // beta:  前倾/后倾 (-180 ~ 180) -> 对应 Y 轴移动
    
    let { gamma, beta } = event;
    
    // 1. 数据清洗
    if (gamma === null || beta === null) return;
    
    // 限制 beta 范围 (防止倒置)
    if (beta > 90) beta = 90;
    if (beta < -90) beta = -90;

    // 2. 初始校准 (以第一次读数为基准)
    if (!this.calibration.set) {
      this.calibration.x = gamma;
      this.calibration.y = beta;
      this.calibration.set = true;
      return;
    }

    // 3. 计算相对角度
    let deltaX = gamma - this.calibration.x;
    let deltaY = beta - this.calibration.y;

    // 4. 应用灵敏度
    const targetX = deltaX * this.options.sensitivity * (Math.PI / 180);
    const targetY = deltaY * this.options.sensitivity * (Math.PI / 180);

    // 5. 角度限制 (Clamping)
    this.targetRotation.x = Math.max(-this.options.maxAngle, Math.min(this.options.maxAngle, targetX));
    this.targetRotation.y = Math.max(-this.options.maxAngle, Math.min(this.options.maxAngle, targetY));
  }

  /**
   * 📳 处理设备运动 (Shake)
   */
  handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    const { x, y, z } = acc;
    if (this.lastAcc.x === null) {
        this.lastAcc = { x, y, z };
        return;
    }

    const delta = Math.abs(x - this.lastAcc.x) + Math.abs(y - this.lastAcc.y) + Math.abs(z - this.lastAcc.z);

    if (delta > this.options.shakeThreshold) {
        const now = Date.now();
        if (now - this.lastShakeTime > this.options.shakeCooldown) {
            this.lastShakeTime = now;
            this.onShake();
        }
    }

    this.lastAcc = { x, y, z };
  }

  /**
   * 🔄 触发摇一摇事件
   */
  onShake() {
    logger.info('[Gyro] Shake detected!');
    // 触发 Auto Spin 开关
    const autoBtn = document.getElementById('auto-btn');
    if (autoBtn) {
        // 添加视觉反馈
        autoBtn.classList.add('shake-anim');
        setTimeout(() => autoBtn.classList.remove('shake-anim'), 500);
        autoBtn.click();
        
        // 浮动文字提示
        if (this.game.fxSystem?.showFloatingText) {
             this.game.fxSystem.showFloatingText(
                 this.game.app.screen.width / 2, 
                 this.game.app.screen.height / 2, 
                 "AUTO SPIN TOGGLED!", 
                 { color: 0xFFD700, fontSize: 32 }
             );
        }
    }
  }

  /**
   * 🎞️ 帧更新 (Smoothing)
   */
  update(delta) {
    if (!this.enabled || !this.game.gameLayer) return;

    // 平滑插值 (Lerp)
    // current = current + (target - current) * factor
    const factor = this.options.smoothFactor;
    
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * factor;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * factor;

    // 应用到 GameLayer (实现视差倾斜效果)
    // 稍微旋转整个舞台，营造 3D 浮动感
    this.game.gameLayer.rotation = this.currentRotation.x; // Z轴旋转
    
    // 可选：使用 skew 模拟 3D 透视
    // this.game.gameLayer.skew.x = -this.currentRotation.y * 0.5; 
    
    // 可选：移动背景 (如果有多层背景，这里可以做更复杂的 Parallax)
    // const bg = this.game.app.stage.children[0];
    // if (bg && bg.isSprite) {
    //     bg.x = (this.game.app.screen.width / 2) + this.currentRotation.x * 200;
    //     bg.y = (this.game.app.screen.height / 2) + this.currentRotation.y * 200;
    // }
  }

  /**
   * ⚙️ 动态调整设置
   */
  setSensitivity(val) {
    this.options.sensitivity = val;
  }
}
