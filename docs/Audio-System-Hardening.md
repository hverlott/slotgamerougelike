# 🔊 音频系统强化文档

## 📋 概述

强化音频系统以处理加载错误、多格式支持和优雅降级，确保音频问题永远不会阻塞游戏启动。

---

## 🎯 核心改进

### 1️⃣ **多格式支持**

**优先级顺序**: `mp3` → `ogg` → `wav` → `fallback`

```javascript
// 每个音效配置
{
  src: [
    '/assets/audio/click.mp3',    // 优先 1: MP3（最广泛支持）
    '/assets/audio/click.ogg',    // 优先 2: OGG（开源，较小）
    '/assets/audio/click.wav',    // 优先 3: WAV（无损，较大）
  ],
  volume: 0.5,
  group: 'ui',
  fallback: 'https://...cdn.../click.mp3', // 最后回退：CDN
}
```

**Howler 行为**:
- 按顺序尝试每个源
- 第一个成功加载的源被使用
- 如果所有本地源失败，尝试 fallback
- 如果全部失败，触发 `onloaderror`

---

### 2️⃣ **资源验证（HTTP HEAD 检查）**

**在创建 Howl 前验证本地资源**:

```javascript
async validateAudioResource(url) {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache',
    });

    const contentType = response.headers.get('content-type') || '';
    const isAudio = contentType.startsWith('audio/') || 
                    contentType.startsWith('application/ogg') ||
                    contentType === 'application/octet-stream';

    return {
      valid: response.ok && isAudio,
      status: response.status,
      contentType,
    };
  } catch (error) {
    // CORS 或网络错误 - 仍允许继续尝试
    return { valid: true, status: 0, contentType: 'unknown', warning: error.message };
  }
}
```

**验证检查**:
- ✅ HTTP 状态码 200-299
- ✅ Content-Type 以 `audio/` 开头
- ✅ 或 Content-Type 为 `application/ogg`
- ✅ 或 Content-Type 为 `application/octet-stream`（某些服务器）

**失败时行为**:
```javascript
if (!validation.valid && validation.status !== 0) {
  console.warn(
    `[AudioSystem] ⚠️ 本地资源无效: ${name}`,
    `\n  URL: ${url}`,
    `\n  Status: ${validation.status}`,
    `\n  Content-Type: ${validation.contentType}`,
    `\n  将尝试 fallback...`
  );
  // ⚠️ 仍然继续加载，Howler 会尝试其他源
}
```

---

### 3️⃣ **解码失败处理**

**Howler 错误处理**:

```javascript
new Howl({
  src: allSources,
  volume: config.volume * this.groupVolumes[config.group],
  preload: true,
  html5: false, // 使用 Web Audio API
  onload: () => {
    console.log(`[AudioSystem] ✅ 加载成功: ${name}`);
    this.loadingStatus.set(name, {
      loaded: true,
      failed: false,
      url: allSources[0],
    });
    sound.available = true; // 标记为可用
    results.loaded.push(name);
    resolve();
  },
  onloaderror: (id, error) => {
    console.warn(
      `[AudioSystem] ❌ 加载失败: ${name}`,
      `\n  Sources: ${allSources.join(', ')}`,
      `\n  Error: ${error}`
    );
    this.loadingStatus.set(name, {
      loaded: false,
      failed: true,
      url: allSources[0],
      error: String(error),
    });
    sound.available = false; // 标记为不可用
    results.failed.push({ name, urls: allSources, error: String(error) });
    resolve(); // ⚠️ 不阻塞其他音效加载
  },
});
```

**关键点**:
- ✅ 错误不抛出异常
- ✅ 标记音效为 `available: false`
- ✅ 记录详细错误信息
- ✅ 继续加载其他音效

---

### 4️⃣ **详细加载报告**

**加载完成后打印完整摘要**:

```javascript
{
  total: 10,
  loaded: ['click', 'switch', 'shoot', 'hit'],
  failed: [
    {
      name: 'explosion',
      urls: ['/assets/audio/explosion.mp3', '...fallback.mp3'],
      error: 'Decoding audio data failed',
    },
    {
      name: 'spin_start',
      urls: ['/assets/audio/spin_start.mp3'],
      error: 'Network request failed',
    },
  ],
  skipped: [],
  timestamp: '2025-12-17T10:30:00.000Z',
}
```

**控制台输出示例**:

```
[AudioSystem] 📊 加载完成！
  总计: 10
  成功: 8 (80.0%)
  失败: 2
  已加载音效: click, switch, shoot, hit, win_small, win_big, warning, spin_stop
  失败列表:
    - explosion: Decoding audio data failed
    - spin_start: Network request failed
```

---

### 5️⃣ **安全的播放接口**

**play() 方法不抛异常**:

```javascript
play(name, options = {}) {
  // 1. 全局静音检查
  if (this.isMuted) return null;
  
  // 2. 音效存在性检查
  const sound = this.sounds.get(name);
  if (!sound) {
    // 静默处理：不存在的音效不打印警告
    return null;
  }

  // 3. 可用性检查（关键！）
  if (!sound.available) {
    // 静默处理：不可用的音效不播放
    return null;
  }
  
  // 4. 复音限制检查
  const maxPoly = this.maxPolyphony[name] ?? this.maxPolyphony.default;
  const currentCount = this.activeInstances.get(name) || 0;
  
  if (!options.force && currentCount >= maxPoly) {
    return null;
  }
  
  try {
    // 5. 播放音效
    const { howl, config } = sound;
    const id = howl.play();
    
    // 应用选项...
    
    return id;
  } catch (error) {
    // 6. 捕获任何播放错误
    console.warn(`[AudioSystem] 播放错误: ${name}`, error.message);
    return null;
  }
}
```

**保证**:
- ✅ 永远不抛异常
- ✅ 不可用音效自动跳过
- ✅ 不存在的音效静默处理
- ✅ 播放错误被捕获

---

### 6️⃣ **非阻塞预加载**

**main.js 中的集成**:

**❌ 旧方式（阻塞）**:
```javascript
await audioSystem.preload(); // 阻塞游戏启动 10-30 秒
console.log('[main] Audio preloaded');
```

**✅ 新方式（fire-and-forget）**:
```javascript
// 启动预加载但不等待
audioSystem.preload().then((summary) => {
  console.log('[main] Audio preload completed', summary);
}).catch((error) => {
  console.warn('[main] Audio preload encountered errors (non-fatal):', error);
});
console.log('[main] Audio preloading started (background)');

// 游戏立即继续初始化...
```

**行为**:
- ✅ 游戏启动不被音频阻塞
- ✅ 音频在后台加载
- ✅ 加载失败不影响游戏运行
- ✅ 可用音效立即播放，未加载的自动跳过

---

## 📊 音效配置清单

### 当前配置

| 音效名 | 本地路径 | 分组 | 音量 | Fallback |
|--------|---------|------|------|----------|
| `spin_start` | `/assets/audio/spin_start.mp3` | sfx | 0.8 | Mixkit CDN |
| `spin_stop` | `/assets/audio/spin_stop.mp3` | sfx | 0.7 | Mixkit CDN |
| `win_small` | `/assets/audio/win_small.mp3` | sfx | 0.6 | Mixkit CDN |
| `win_big` | `/assets/audio/win_big.mp3` | sfx | 0.9 | Mixkit CDN |
| `shoot` | `/assets/audio/shoot.mp3` | sfx | 0.4 | Mixkit CDN |
| `hit` | `/assets/audio/hit.mp3` | sfx | 0.5 | Mixkit CDN |
| `explosion` | `/assets/audio/explosion.mp3` | sfx | 0.7 | Mixkit CDN |
| `click` | `/assets/audio/click.mp3` | ui | 0.5 | Mixkit CDN |
| `switch` | `/assets/audio/switch.mp3` | ui | 0.5 | Mixkit CDN |
| `warning` | `/assets/audio/warning.mp3` | sfx | 0.8 | Mixkit CDN |

### 添加新音效

**步骤 1**: 在 `soundConfigs` 中添加配置

```javascript
this.soundConfigs = {
  // ... 现有配置 ...
  
  // 新音效
  victory_fanfare: {
    src: [
      '/assets/audio/victory_fanfare.mp3',
      '/assets/audio/victory_fanfare.ogg',
      '/assets/audio/victory_fanfare.wav',
    ],
    volume: 1.0,
    group: 'sfx',
    fallback: 'https://cdn.example.com/victory.mp3',
  },
};
```

**步骤 2**: 在代码中播放

```javascript
audioSystem.play('victory_fanfare', { volume: 0.8 });
```

---

## 🔧 配置选项

### 音量分组

```javascript
this.groupVolumes = {
  sfx: 0.7,    // 游戏音效（0-1）
  music: 0.5,  // 背景音乐（0-1）
  ui: 0.6,     // UI 音效（0-1）
};

// 运行时调整
audioSystem.setGroupVolume('sfx', 0.5);
```

### 复音限制

```javascript
this.maxPolyphony = {
  shoot: 3,       // 最多同时 3 个射击音
  explosion: 2,   // 最多同时 2 个爆炸音
  hit: 3,         // 最多同时 3 个击中音
  click: 1,       // 最多 1 个点击音（防止双击重叠）
  switch: 1,      // 最多 1 个切换音
  default: 5,     // 其他音效默认 5
};
```

### 验证选项

```javascript
// 在 validateAudioResource() 中调整
const response = await fetch(url, { 
  method: 'HEAD',
  mode: 'cors',
  cache: 'no-cache',
  // credentials: 'include', // 如需携带 cookies
});
```

---

## 🧪 测试指南

### 测试加载状态

```javascript
// 获取详细加载状态
const status = audioSystem.getLoadStatus();
console.log('Loaded:', status.summary.loaded);
console.log('Failed:', status.summary.failed);
console.log('Available sounds:', status.sounds.filter(s => s.available));
```

### 测试不可用音效

```javascript
// 播放不存在的音效（应静默失败）
audioSystem.play('nonexistent_sound'); // null，无警告

// 播放加载失败的音效（应静默失败）
audioSystem.play('failed_sound'); // null，无警告
```

### 测试多格式回退

```javascript
// 模拟：删除 MP3 文件，保留 OGG
// Howler 应自动加载 OGG 版本
```

### 测试验证失败

```javascript
// 模拟：返回 404 或错误 Content-Type
// 应看到警告但不阻塞加载
```

### 压力测试

```javascript
// 快速连续播放同一音效
for (let i = 0; i < 10; i++) {
  audioSystem.play('click');
}
// 应受复音限制，只播放 1 个实例
```

---

## 🐛 常见问题排查

### 问题 1: "Decoding audio data failed"

**原因**:
- 音频文件损坏
- 不支持的编码格式
- 浏览器不支持该格式

**解决**:
```bash
# 转换音频格式
ffmpeg -i input.mp3 -acodec libvorbis -aq 4 output.ogg
ffmpeg -i input.mp3 -acodec pcm_s16le output.wav

# 验证文件完整性
ffprobe input.mp3
```

### 问题 2: "Network request failed"

**原因**:
- 文件路径错误
- 服务器未运行
- CORS 问题

**解决**:
```javascript
// 检查文件是否存在
fetch('/assets/audio/click.mp3', { method: 'HEAD' })
  .then(r => console.log('Status:', r.status, 'Type:', r.headers.get('content-type')))
  .catch(e => console.error('Error:', e));
```

### 问题 3: 音效不播放

**排查步骤**:
```javascript
// 1. 检查是否静音
console.log('Muted:', audioSystem.isMuted);

// 2. 检查加载状态
const status = audioSystem.getLoadStatus();
console.log('Sound status:', status.sounds.find(s => s.name === 'click'));

// 3. 检查分组音量
console.log('Group volumes:', audioSystem.groupVolumes);

// 4. 手动播放测试
const id = audioSystem.play('click', { force: true });
console.log('Play ID:', id); // null = 失败
```

### 问题 4: 控制台警告过多

**优化**:
```javascript
// AudioSystem 已优化：
// - 不存在的音效：静默处理（no-op）
// - 不可用的音效：静默跳过
// - 复音限制触发：静默返回 null

// 只在真正的错误时才打印警告
```

---

## 📈 性能优化

### 1️⃣ 使用 Web Audio API

```javascript
new Howl({
  src: sources,
  html5: false, // ✅ 使用 Web Audio API（更好的控制和性能）
  // html5: true, // ❌ 使用 HTML5 Audio（兼容性更好但功能有限）
});
```

### 2️⃣ 预加载策略

```javascript
// 关键音效立即加载
const criticalSounds = ['click', 'switch'];
await Promise.all(criticalSounds.map(name => 
  audioSystem.preloadSound(name) // 如果实现了单独加载方法
));

// 其他音效后台加载
audioSystem.preload(); // fire-and-forget
```

### 3️⃣ 音频文件优化

```bash
# MP3：128kbps 足够（游戏音效）
ffmpeg -i input.wav -b:a 128k output.mp3

# OGG：quality 4（平衡大小和质量）
ffmpeg -i input.wav -acodec libvorbis -aq 4 output.ogg

# 裁剪静音
ffmpeg -i input.mp3 -af silenceremove=1:0:-50dB output_trimmed.mp3
```

### 4️⃣ 复音限制

```javascript
// 高频音效（如射击）严格限制
this.maxPolyphony = {
  shoot: 3, // 最多 3 个同时播放
  hit: 3,
  explosion: 2,
};
```

---

## ✅ 改进检查清单

### 代码质量
- ✅ 多格式支持（mp3, ogg, wav）
- ✅ HTTP HEAD 验证
- ✅ 优雅错误处理（no throw）
- ✅ 详细加载报告
- ✅ 安全播放接口
- ✅ 无 Lint 错误

### 功能完整性
- ✅ 加载失败不阻塞启动
- ✅ 解码失败优雅降级
- ✅ 不可用音效自动跳过
- ✅ 网络错误不崩溃
- ✅ CORS 错误容忍

### 用户体验
- ✅ 游戏启动快速（音频后台加载）
- ✅ 音效失败对玩家透明
- ✅ 控制台日志清晰有用
- ✅ 无意外异常或错误

### 性能
- ✅ 非阻塞预加载
- ✅ 复音限制防止过载
- ✅ Web Audio API 高效
- ✅ 懒加载纹理

---

## 🔜 未来增强

### 短期
1. **音频图集** - 将短音效合并到单个文件（减少请求）
2. **渐进加载** - 优先加载关键音效
3. **缓存策略** - Service Worker 缓存音频文件

### 长期
1. **动态音效** - 根据游戏状态调整音效参数
2. **空间音效** - 基于位置的 3D 音效
3. **音效混音器** - 实时调整 EQ 和效果
4. **音效编辑器** - 可视化编辑音效参数

---

**🔊 音频系统全面强化！永远不会因音频问题导致游戏崩溃！** ✨🚀🎵


