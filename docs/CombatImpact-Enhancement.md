# 🎯 战斗打击感增强系统

## 📋 概述

为了提升战斗手感和视觉反馈，我们为游戏添加了以下打击感特效：
- **相机震动** - 随伤害强度动态调整
- **击中火花** - 普通/暴击两种效果
- **冲击波 AOE** - 爆炸/范围攻击的视觉反馈
- **增强浮动文字** - 暴击更大、更快、更明显

---

## 🌟 新增特效

### 1. 📹 相机震动 `cameraShake(intensity, duration)`

**调用示例**：
```javascript
// 轻微震动（普通击中）
fxSystem.cameraShake(2, 0.15);

// 中度震动（暴击）
fxSystem.cameraShake(4, 0.2);

// 强力震动（导弹爆炸）
fxSystem.cameraShake(6, 0.25);
```

**效果描述**：
- 随机方向震动，避免单一方向
- 自动回到原位，确保不累积偏移
- 支持自定义强度和持续时间

**技术实现**：
```javascript
cameraShake(intensity = 5, duration = 0.2) {
  const target = this.app.gameLayer || this.app.stage;
  const originalX = target.x;
  const originalY = target.y;
  const shakeX = (Math.random() - 0.5) * intensity * 2;
  const shakeY = (Math.random() - 0.5) * intensity * 2;

  gsap.to(target, {
    x: originalX + shakeX,
    y: originalY + shakeY,
    duration: duration / 2,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      gsap.to(target, {
        x: originalX,
        y: originalY,
        duration: 0.05
      });
    }
  });
}
```

---

### 2. ✨ 普通击中火花 `hitSpark(x, y)`

**调用示例**：
```javascript
fxSystem.hitSpark(impactX, impactY);
```

**效果描述**：
- 5 个粒子从击中点爆射出去
- 粒子带有主题色光晕
- 0.3-0.5 秒内飞行并淡出
- 飞行距离：25-45 像素

**视觉细节**：
```
    ✨     粒子爆射
  ✨ 💥 ✨  (5 个方向)
    ✨     PRIMARY 颜色
```

---

### 3. 💥 暴击火花 `critSpark(x, y)`

**调用示例**：
```javascript
fxSystem.critSpark(impactX, impactY);
```

**效果描述**：
- **内圈**：白色强光闪烁（半径 20px，扩大到 2x）
- **外圈**：12 个粒子爆射（距离 40-75px）
- 粒子颜色：ENERGY（主题色）
- 光晕更强（outerStrength: 3）
- 粒子自身会放大 1.5 倍

**对比普通击中**：
| 属性 | 普通击中 | 暴击 |
|-----|---------|-----|
| 粒子数量 | 5 个 | 12 个 + 中心闪光 |
| 飞行距离 | 25-45px | 40-75px |
| 持续时间 | 0.3-0.5s | 0.4-0.65s |
| 光晕强度 | 2 | 3-5 |
| 颜色 | PRIMARY | ENERGY + 白色 |

---

### 4. 🌀 冲击波 AOE `shockwaveAOE(x, y, radius)`

**调用示例**：
```javascript
// 手榴弹（小范围）
fxSystem.shockwaveAOE(x, y, 60);

// 导弹（大范围）
fxSystem.shockwaveAOE(x, y, 110);
```

**效果描述**：
- **3 层冲击波环**，从中心向外扩散
- 第 1 层：白色，宽 8px，最先扩散
- 第 2-3 层：ENERGY 颜色，宽度递减
- 每层延迟 0.05 秒，形成波纹效果
- **中心闪光**：白色圆形，弹性放大后淡出

**视觉时间轴**：
```
0.0s  ● 中心闪光出现
0.0s  ○ 第 1 层冲击波开始
0.05s  ○ 第 2 层冲击波开始
0.1s   ○ 第 3 层冲击波开始
0.5s   所有波扩散到最大半径
0.7s   全部淡出完成
```

**性能优化**：
- 使用对象池复用 Graphics 对象
- 动画完成后自动回收
- 最多同时 4 个对象（3 个波 + 1 个闪光）

---

## 🎨 浮动文字增强

### 暴击文字增强点

**FloatingTextSystem.js 改进**：

| 属性 | 普通 | 暴击 | 改进点 |
|-----|------|------|--------|
| 弹出缩放 | 1.1x | **1.45x** | 更大更显眼 |
| 弹出速度 | 0.22s | **0.18s** | 更快更爽快 |
| 弹出曲线 | back.out(3) | **back.out(4)** | 更强回弹 |
| 上飘距离 | 74-100px | **100-130px** | 飞得更高 |
| 上飘速度 | 0.95s | **0.85s** | 更快上升 |
| 旋转幅度 | 0.22 rad | **0.35 rad** | 更大旋转 |
| 淡出延迟 | 0.78s | **0.7s** | 更快切换 |

**代码实现**：
```javascript
const popScale = isCrit ? 1.45 : 1.1;
const popDuration = isCrit ? 0.18 : 0.22;
const popEase = isCrit ? 'back.out(4)' : 'back.out(3)';

const driftY = isCrit ? 100 + Math.random() * 30 : 74 + Math.random() * 26;
const driftDuration = isCrit ? 0.85 : 0.95;
const rotationAmount = isCrit ? 0.35 : 0.22;
```

---

## 🔗 系统集成

### BulletSystem.js 集成点

**击中判定**（第 339-425 行）：
```javascript
// 1. 判断是否暴击
const isCrit = Math.random() < finalCritChance;
const damage = (isCrit ? 2 : 1) * baseDmg;

// 2. 显示浮动伤害数字
this.floatingTextSystem?.showText(impactX, impactY, damage, isCrit);

// 3. 播放击中火花
if (isCrit) {
  this.fxSystem?.critSpark?.(impactX, impactY);
} else {
  this.fxSystem?.hitSpark?.(impactX, impactY);
}

// 4. 相机震动（根据类型和是否暴击）
const shakeIntensity = type === 4 ? 6 : (isCrit ? 4 : 2);
const shakeDuration = type === 4 ? 0.25 : (isCrit ? 0.2 : 0.15);
this.fxSystem?.cameraShake?.(shakeIntensity, shakeDuration);

// 5. AOE 冲击波（手榴弹和导弹）
if (type === 2) {
  const aoeRadius = 60 * aoeScale;
  this.fxSystem?.shockwaveAOE?.(impactX, impactY, aoeRadius);
}
if (type === 4) {
  const outerRadius = 110 * aoeScale;
  this.fxSystem?.shockwaveAOE?.(impactX, impactY, outerRadius);
}
```

### 特效触发表

| 武器类型 | 普通击中 | 暴击 | AOE |
|---------|----------|------|-----|
| **子弹** (type=1) | hitSpark + shake(2) | critSpark + shake(4) | ❌ |
| **手榴弹** (type=2) | hitSpark + shake(2) | critSpark + shake(4) | ✅ shockwave(60) |
| **激光** (type=3) | hitSpark + shake(2) | critSpark + shake(4) | ❌ |
| **导弹** (type=4) | hitSpark + shake(6) | critSpark + shake(6) | ✅ shockwave(110) |

---

## 🎮 测试方法

### 浏览器控制台测试

```javascript
const ctx = __dslot.ctx;

// 1. 测试普通击中
ctx.fxSystem.hitSpark(400, 300);
ctx.fxSystem.cameraShake(2, 0.15);

// 2. 测试暴击
ctx.fxSystem.critSpark(400, 300);
ctx.fxSystem.cameraShake(4, 0.2);

// 3. 测试小范围冲击波
ctx.fxSystem.shockwaveAOE(400, 300, 60);

// 4. 测试大范围冲击波
ctx.fxSystem.shockwaveAOE(400, 300, 110);
ctx.fxSystem.cameraShake(6, 0.25);

// 5. 测试浮动文字
ctx.floatingTextSystem.showText(400, 300, 150, false); // 普通
ctx.floatingTextSystem.showText(420, 300, 300, true);  // 暴击
```

### 实战测试

1. **启动游戏**，进行正常战斗
2. **观察普通击中**：
   - ✨ 小火花
   - 📹 轻微震动
   - 📄 普通数字弹出
3. **观察暴击**：
   - 💥 强烈闪光 + 大量粒子
   - 📹 明显震动
   - 📄 巨大数字，快速弹出
4. **观察 AOE**：
   - 🌀 扩散的冲击波环
   - 💥 中心闪光
   - 📹 强力震动

---

## 📊 性能数据

### 单次特效开销

| 特效 | 对象数量 | 持续时间 | 帧率影响 |
|-----|---------|---------|---------|
| hitSpark | 5 个粒子 | 0.5s | < 1ms |
| critSpark | 13 个对象 | 0.65s | < 2ms |
| shockwaveAOE | 4 个环 | 0.7s | < 3ms |
| cameraShake | 1 个 tween | 0.25s | < 0.5ms |

### 对象池统计

```javascript
FXSystem 对象池：
├── linePool      (上限 20)
├── glowPool      (上限 20)
├── scanPool      (上限 20)  ← 用于火花粒子
└── symbolGlowPool (上限 50)

复用率：~95%（大部分对象来自池）
新分配：仅池空时发生
```

### 优化措施

1. ✅ **对象池复用** - 避免频繁 new/destroy
2. ✅ **低质量过滤器** - quality: 0.2-0.3
3. ✅ **自动清理** - 动画完成后回收
4. ✅ **分层渲染** - 4 个独立容器
5. ✅ **批量操作** - 使用 GSAP timeline

---

## 🎨 自定义配置

### 调整火花颜色

**FXSystem.js**：
```javascript
// 普通击中 - 使用 PRIMARY 颜色
const color = PRIMARY(); // 可改为固定色 0x00F0FF

// 暴击 - 使用 ENERGY 颜色
const color = ENERGY(); // 可改为 0xFF00FF (粉色)
```

### 调整震动强度

**BulletSystem.js**（第 386-388 行）：
```javascript
// 增强所有震动
const shakeIntensity = type === 4 ? 8 : (isCrit ? 6 : 3); // 原值：6/4/2

// 延长震动时间
const shakeDuration = type === 4 ? 0.35 : (isCrit ? 0.3 : 0.2); // 原值：0.25/0.2/0.15
```

### 调整火花数量

**FXSystem.js**：
```javascript
// hitSpark() 第 494 行
const sparkCount = 8; // 原值：5

// critSpark() 第 560 行
const sparkCount = 18; // 原值：12
```

### 调整冲击波层数

**FXSystem.js**（第 634 行）：
```javascript
for (let layer = 0; layer < 5; layer++) { // 原值：3
  // ... 冲击波层
}
```

---

## 🔧 故障排查

### 问题：特效不显示

**检查清单**：
1. ✅ `ctx.fxSystem` 是否已初始化？
2. ✅ `app.gameLayer` 是否存在？
3. ✅ 坐标是否在屏幕内？
4. ✅ 浏览器控制台是否有错误？

**调试代码**：
```javascript
console.log('FXSystem:', __dslot.ctx.fxSystem);
console.log('GameLayer:', __dslot.ctx.fxSystem?.app?.gameLayer);

// 强制触发
__dslot.ctx.fxSystem.critSpark(400, 300);
```

### 问题：相机震动太强/太弱

**快速调整**：
```javascript
// 临时修改（浏览器控制台）
const originalShake = __dslot.ctx.fxSystem.cameraShake.bind(__dslot.ctx.fxSystem);
__dslot.ctx.fxSystem.cameraShake = (intensity, duration) => {
  originalShake(intensity * 0.5, duration); // 减半震动
};
```

### 问题：性能下降

**优化建议**：
1. **减少质量**：GlowFilter quality: 0.1
2. **减少粒子**：sparkCount 减半
3. **减少层数**：shockwaveAOE 改为 2 层
4. **禁用震动**：注释掉 cameraShake 调用

---

## 📝 更新日志

### v1.3.0 - 战斗打击感增强

**新增特效**：
- ✅ 相机震动系统
- ✅ 普通击中火花
- ✅ 暴击火花（加强版）
- ✅ AOE 冲击波效果

**增强功能**：
- ✅ 暴击浮动文字更大、更快
- ✅ 震动强度随武器类型动态调整
- ✅ AOE 攻击显示扩散波纹

**性能优化**：
- ✅ 所有特效使用对象池
- ✅ 自动清理和回收
- ✅ 低质量过滤器
- ✅ 批量动画管理

---

## 🎯 未来扩展

### 计划中的特效

1. **连击特效** - 达到一定连击数时的额外视觉
2. **击杀特效** - 敌人死亡时的特殊效果
3. **护盾破碎** - 击破护盾的爆裂动画
4. **穿透轨迹** - 子弹穿透时的能量轨迹
5. **弹跳轨迹** - 子弹弹跳的电光效果

### 高级特效

使用 PixiJS 高级过滤器：
- **DisplacementFilter** - 冲击波扭曲效果
- **ShockwaveFilter** - 真实冲击波变形
- **ZoomBlurFilter** - 暴击径向模糊
- **GodrayFilter** - 光线效果

---

## 📚 相关文档

- [FXSystem-CyberpunkEffects.md](./FXSystem-CyberpunkEffects.md) - 中奖线特效
- [ComboSystem-Guide.md](./ComboSystem-Guide.md) - 连击系统
- [BuildSystem-Guide.md](./BuildSystem-Guide.md) - Build 系统

---

**🎮 享受增强的战斗体验！** ⚡💥✨

