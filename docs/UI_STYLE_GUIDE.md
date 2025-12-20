# UI Style Guide (Genshin / StarRail Inspired)

## 1. Design Philosophy
- **Clean & Sci-Fi**: Minimalist interface with futuristic elements.
- **Glassmorphism**: Translucent panels with blur effects (`backdrop-filter: blur(20px)`).
- **Motion**: Smooth ease-out animations for all interactions.
- **Palette**: White/Gold/Blue dominance.

## 2. Color Palette
| Variable | Hex | Usage |
|----------|-----|-------|
| `--bg` | `#F2F3F7` | Global Background |
| `--panel` | `rgba(255, 255, 255, 0.9)` | HUD Panels |
| `--primary` | `#3B4255` | Text, Icons |
| `--accent` | `#4CC9F0` | Highlights, Energy |
| `--win` | `#FFB800` | Gold/Win events |
| `--danger` | `#FF4D4F` | Critical/Error |

## 3. Typography
- **Font Family**: "PingFang SC", "Microsoft YaHei", sans-serif.
- **Numbers**: "Orbitron" or Monospace for stats.
- **Weights**: 400 (Regular), 600 (Semi-Bold), 800 (Bold).

## 4. Components

### Buttons
- **Shape**: Rounded Rect (`border-radius: 12px` or Capsule).
- **Interaction**:
  - Hover: Brightness +5%, Scale 1.02.
  - Active: Scale 0.98.
  - Click: Particle Burst.

### Panels
- **Background**: White with 90% opacity.
- **Border**: 1px solid white/alpha 0.6.
- **Shadow**: Soft drop shadow (`0 8px 24px rgba(0,0,0,0.12)`).

### Animations
- **Transitions**: `0.2s cubic-bezier(0.4, 0.0, 0.2, 1)`.
- **Flip Counter**: Mechanical flip effect for counters.
- **Pulse**: For critical statuses (Boss HP < 20%).

## 5. Layout
- **Desktop**: 2-column grid (Game Stage / HUD).
- **Mobile**: Full screen Game Stage + Bottom Sheet HUD.
