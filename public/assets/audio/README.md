# 🔊 音频资源文件夹

此文件夹用于存放游戏音效文件。

## 📂 所需音效文件

请将以下音效文件放入此文件夹：

### 转轮音效
- `spin_start.mp3` - 转轮启动音效
- `spin_stop.mp3` - 转轮停止音效（每个转轮停止时播放）

### 胜利音效
- `win_small.mp3` - 小额中奖音效（倍率 < 5x）
- `win_big.mp3` - 大额中奖音效（倍率 >= 5x）

### 战斗音效
- `shoot.mp3` - 射击音效（子弹发射）
- `explosion.mp3` - 爆炸音效（导弹/手榴弹）

### UI 音效
- `click.mp3` - 按钮点击音效
- `switch.mp3` - 开关/切换音效

### 警告音效
- `warning.mp3` - 危险警告音效

---

## 🎵 音效建议

### 音频格式
- **格式**：MP3 (推荐) 或 OGG
- **采样率**：44.1 kHz
- **比特率**：128-192 kbps
- **声道**：立体声或单声道

### 音效时长
- `spin_start`: 0.5-1.0 秒
- `spin_stop`: 0.3-0.5 秒
- `win_small`: 1.0-2.0 秒
- `win_big`: 2.0-3.0 秒
- `shoot`: 0.2-0.4 秒
- `explosion`: 0.5-1.0 秒
- `click`: 0.1-0.2 秒
- `switch`: 0.2-0.4 秒
- `warning`: 1.0-2.0 秒

### 音量参考
所有音效应该在 **-6dB 到 -12dB** 范围内，避免过响。

---

## 🎨 免费音效资源

### 推荐网站
1. **Freesound** - https://freesound.org/
2. **Zapsplat** - https://www.zapsplat.com/
3. **Mixkit** - https://mixkit.co/free-sound-effects/
4. **BBC Sound Effects** - https://sound-effects.bbcrewind.co.uk/

### 搜索关键词
- **spin_start**: "slot machine start", "reel spin", "mechanical start"
- **spin_stop**: "slot stop", "reel stop", "mechanical click"
- **win_small**: "coin collect", "ding", "small reward"
- **win_big**: "jackpot", "big win", "fanfare"
- **shoot**: "laser shot", "pew", "sci-fi gun"
- **explosion**: "explosion", "boom", "impact"
- **click**: "button click", "ui click", "interface"
- **switch**: "toggle", "switch", "ui switch"
- **warning**: "alarm", "alert", "danger"

---

## 🛠️ 临时占位符

如果您暂时没有音效文件，系统会**优雅降级**，不播放音效但不会报错。

要快速测试音频系统，可以：
1. 使用任意 MP3 文件作为占位符
2. 重命名为对应的音效文件名
3. 放入此文件夹

---

## 📝 注意事项

- ✅ 确保文件名完全匹配（区分大小写）
- ✅ 文件扩展名为 `.mp3`
- ✅ 避免使用特殊字符或中文文件名
- ✅ 测试音效是否能在浏览器中播放

---

**🎮 添加音效后，刷新页面即可生效！**

