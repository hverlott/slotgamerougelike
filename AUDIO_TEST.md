# 🔊 音频系统测试指南

## 快速测试

打开浏览器控制台（F12），运行以下命令：

### 1. 测试基础音效
```javascript
const audio = __dslot.audioSystem;

// 射击音效
audio.play('shoot');

// 爆炸音效
audio.play('explosion');

// 中奖音效
audio.play('win_small');
audio.play('win_big');
```

### 2. 测试转轮音效
```javascript
const audio = __dslot.audioSystem;

// 启动转轮
audio.play('spin_start');

// 3个转轮依次停止
setTimeout(() => audio.play('spin_stop'), 400);
setTimeout(() => audio.play('spin_stop'), 550);
setTimeout(() => audio.play('spin_stop'), 700);
```

### 3. 测试音量控制
```javascript
const audio = __dslot.audioSystem;

// 降低音效音量
audio.setGroupVolume('sfx', 0.3);
audio.play('explosion');

// 恢复音量
audio.setGroupVolume('sfx', 0.7);
audio.play('explosion');
```

### 4. 测试静音
```javascript
const audio = __dslot.audioSystem;

// 静音
audio.mute();
audio.play('shoot'); // 无声

// 取消静音
audio.unmute();
audio.play('shoot'); // 有声
```

### 5. 测试循环播放
```javascript
const audio = __dslot.audioSystem;

// 循环播放警告音效
audio.play('warning', { loop: true });

// 3秒后停止
setTimeout(() => audio.stop('warning'), 3000);
```

### 6. 查看系统状态
```javascript
const audio = __dslot.audioSystem;

// 获取调试信息
const info = audio.getDebugInfo();
console.log('总音效数:', info.totalSounds);
console.log('静音状态:', info.muted);
console.log('SFX音量:', info.groupVolumes.sfx);
console.log('加载成功:', info.loadedSounds);
console.log('加载失败:', info.failedSounds);
console.table(info.playingCounts);
```

---

## 实战测试

### 1. 转轮音效
1. 点击 **SPIN** 按钮
2. 听到启动音效 ✅
3. 转轮依次停止，每次都有音效 ✅

### 2. 中奖音效
1. 中奖后（有钱增加）
2. 听到 `win_small` 或 `win_big` ✅

### 3. 战斗音效
1. 进入战斗阶段
2. 射击时听到 `shoot` ✅
3. 导弹/手榴弹爆炸时听到 `explosion` ✅

---

## 故障排查

### 音效不播放？
```javascript
// 1. 检查是否静音
__dslot.audioSystem.getMuted(); // false 为正常

// 2. 检查音量
__dslot.audioSystem.groupVolumes; // sfx 应该 > 0

// 3. 查看哪些音效加载失败
const info = __dslot.audioSystem.getDebugInfo();
console.log('失败:', info.failedSounds);
```

### 音效文件未找到？
音效文件应放在：
```
public/assets/audio/
├── spin_start.mp3
├── spin_stop.mp3
├── win_small.mp3
├── win_big.mp3
├── shoot.mp3
├── explosion.mp3
├── click.mp3
├── switch.mp3
└── warning.mp3
```

如果文件缺失，系统会**优雅降级**（无声但不报错）。

---

## 临时测试（无音频文件）

如果暂时没有音频文件，可以用任意 MP3 作为占位符：

```bash
# 复制任意MP3文件9次，重命名为所需音效
cp test.mp3 public/assets/audio/spin_start.mp3
cp test.mp3 public/assets/audio/spin_stop.mp3
cp test.mp3 public/assets/audio/win_small.mp3
# ... 依此类推
```

---

**🎮 测试完成后，享受有声游戏！** 🔊

