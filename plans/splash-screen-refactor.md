# 开屏动画重构设计文档

## 实现状态

| 阶段               | 状态     | 说明                                      |
| ------------------ | -------- | ----------------------------------------- |
| Phase 1 - 信号锁定 | ✅ 已完成 | 搜索噪声→信号闪现→径向锁定→确认脉冲       |
| Phase 2 - 能量启动 | ⏳ 未开始 | 需实现长按充能→启动序列→爆炸过渡          |
| Logo idle 动画     | ✅ 已完成 | PixiJS Graphics 程序化绘制 + 多层独立动画 |
| HUD 文字渲染       | ❌ 已移除 | 根据反馈简化，不再显示 HUD 状态文字       |

## 1. 概述

### 1.1 目标

将现有开屏动画（终端打字 → 扫描线揭示署名 → Glitch 切换）彻底替换为两段式沉浸动画：

1. **Phase 1 - 信号锁定**：画面从静态噪声中逐步"捕获"并锁定 Logo 信号
2. **Phase 2 - 能量启动**：长按 Logo 充能并释放后触发能量吸入→爆炸→进入标题画面

### 1.2 设计原则

- **不引入新的渲染依赖**：充分利用现有 PixiJS v7 + pixi-filters
- **统一体验**：桌面端与移动端使用相同效果参数，不做性能降级
- **最大复用**：核心效果完全基于现有 FilterManager 能力 + 一个新自定义滤镜

### 1.3 技术约束

| 约束     | 说明                                                            |
| -------- | --------------------------------------------------------------- |
| 渲染引擎 | PixiJS v7（已有）                                               |
| 滤镜     | pixi-filters v5（已有）+ 自定义 Filter（参照 AngryNoiseFilter） |
| 动画     | Framer Motion（UI 层）+ PixiJS ticker（Canvas 层）              |
| Logo     | PixiJS Graphics 程序化绘制（不再依赖 SVG Sprite）               |
| 状态管理 | React useState + 回调                                           |

### 1.4 与原 GPU 粒子方案的对比

| 维度            | 原方案（GPU 粒子系统）                           | 新方案（信号锁定）                         |
| --------------- | ------------------------------------------------ | ------------------------------------------ |
| 核心技术        | Mesh + 自定义顶点/片段着色器 + DRAW_MODES.POINTS | Filter（片段着色器）+ Graphics 遮罩        |
| 自定义 GLSL     | 顶点 + 片段着色器                                | 仅片段着色器（与 AngryNoiseFilter 同模式） |
| 新增 PixiJS API | Mesh, Geometry, Buffer, Shader, DRAW_MODES       | 无需新增（全部已导出）                     |
| 数据管理        | 80,000 粒子的环形缓冲区                          | 仅 uniform 参数                            |
| 实现风险        | POINTS 模式兼容性、坐标系统差异                  | 极低（Filter 模式已验证）                  |
| 视觉风格        | 流星拖尾→横扫揭示                                | 静态噪声→信号闪现→径向清除→锁定确认        |

---

## 2. 已确认的设计决策

| 决策项        | 结论                              | 说明                                               |
| ------------- | --------------------------------- | -------------------------------------------------- |
| Logo 揭示方式 | 信号锁定（Signal Lock）           | 从噪声中逐步锁定信号，符合赛博朋克/神经接续主题    |
| 核心渲染技术  | 自定义 Filter + Graphics 遮罩     | 不需要自定义 Geometry/Mesh/顶点着色器              |
| 噪声效果      | SignalNoiseFilter（新）           | 参照 AngryNoiseFilter 模式，纯片段着色器           |
| 滤镜复用      | FilterManager 全部复用            | GlitchFilter + RGBSplitFilter + CRTFilter 直接使用 |
| Logo 渲染方式 | PixiJS Graphics 程序化绘制        | 多层图元可独立动画，不再依赖 SVG Sprite            |
| HUD 状态文字  | 已移除                            | 用户反馈认为信息冗余，改为简洁提示文字             |
| 动画完成后    | Phase 1 结束进入 idle，点击后完成 | 暂不实现作者署名阶段                               |
| 鼠标跟随      | 不需要                            | 无交互式粒子                                       |

---

## 3. 整体流程

```mermaid
stateDiagram-v2
    direction LR
    s1: Intro
    s2: LogoRevealed
    s3: HoldDetected
    s4: Sequence
    s5: TitleScreen

    [*] --> s1: 页面加载
    s1 --> s2: 信号锁定完成
    s2 --> s3: 用户长按/点击 Logo
    s3 --> s2: 松手太早
    s3 --> s4: 持续按住 > 1.2s
    s4 --> s5: 爆炸动画完成
```

> 当前实现（截至 Phase 1）：`intro -> idle -> complete(点击)`；`charging/sequence` 仍为 Phase 2 预留状态。

### 3.1 状态定义

```typescript
type SplashPhase =
  | "intro"      // 信号锁定阶段（自动播放）
  | "idle"       // Logo 已揭示，等待用户交互
  | "charging"   // 用户按住 Logo，能量聚集（Phase 2 预留）
  | "sequence"   // 启动序列（吸入→爆炸→冲击波，Phase 2 预留）
  | "complete"   // 动画完成，进入标题画面
```

---

## 4. Phase 1 - 信号锁定（Signal Lock）

### 4.1 效果概述

画面模拟在搜索一个微弱的信号源，经历四个子阶段逐步锁定并显示 Logo：

```mermaid
flowchart LR
    A[4a. 搜索噪声] --> B[4b. 信号闪现]
    B --> C[4c. 径向锁定]
    C --> D[4d. 确认脉冲]
```

### 4.2 子阶段详解

#### 4a. 搜索噪声 Search Static（0-800ms）

**视觉效果**：
- 全屏静态噪声/雪花覆盖（`SignalNoiseFilter`）
- CRT 扫描线 + 轻微曲面变形
- 噪声强度从 100% 开始，保持高强度

**技术实现**：
- `SignalNoiseFilter`：全屏覆盖的片段着色器，产生 TV 静态噪声纹理
- `CRTFilter`：已有，直接使用
- HUD 文字渲染已移除（按反馈简化界面）

#### 4b. 信号闪现 Signal Glimpse（800-2000ms）

**视觉效果**：
- Logo 在噪声中间歇性闪烁出现（每次 100-200ms 可见）
- 每次闪现伴随强烈的 RGB 色差抖动 + 水平撕裂
- 闪现间隔逐渐缩短（第一次 400ms 间隔 → 最后 150ms 间隔）
- 闪现时 Logo 有轻微位置偏移（像信号不稳定）

**技术实现**：
- Logo 由 `LogoRenderer` 使用 PixiJS `Graphics` 程序化绘制
- 通过 `logo.alpha` 与 `flash(duration)` 控制闪烁
- 每次闪现同步触发 `FilterManager.triggerRGBSplit()` + `FilterManager.triggerTear()`
- Logo 位置用 `setJitter(maxOffset)` 做随机偏移

#### 4c. 径向锁定 Radial Lock（2000-3200ms）

**视觉效果**：
- Logo 固定在屏幕中心，不再消失
- 噪声从 Logo 中心开始**径向向外清除**
- 清除边界有明亮的青色扫描环（类似雷达扫描）
- 清除区域内 Logo 清晰可见，外部仍是噪声
- GlitchFilter 效果逐渐减弱

**技术实现**：
- `SignalNoiseFilter` 使用 `uClearCenter`（vec2）和 `uClearRadius`（float）uniform
- 片段着色器中：距离中心 < `uClearRadius` 的区域不施加噪声
- 清除边界用 `smoothstep` 做柔和过渡 + 青色发光环
- 每帧更新 `uClearRadius` 从 0 → `maxClearRadius`

#### 4d. 确认脉冲 Confirm Pulse（3200-3800ms）

**视觉效果**：
- 噪声完全清除，画面变为纯黑背景 + Logo
- Logo 触发一次能量脉冲：从中心向外扩散的青色光环
- 脉冲过后进入 Logo idle 动画（多层独立运动）
- 底部淡入提示文字：`SIGNAL LOCKED · CLICK TO INITIALIZE`

**技术实现**：
- 脉冲环：`PulseRenderer` 使用 PixiJS `Graphics` 绘制扩散圆环并淡出
- Logo idle：`LogoRenderer.startIdleAnimation()` 驱动分层动画
- 提示文字：DOM 层 Framer Motion 淡入

### 4.3 SignalNoiseFilter 设计

参照 `AngryNoiseFilter` 的架构，创建新的自定义 Filter：

```typescript
class SignalNoiseFilter extends Filter {
  // Uniforms
  uniforms: {
    uTime: number;           // 时间（驱动噪声动画）
    uIntensity: number;      // 噪声强度 (0-1)
    uResolution: number[];   // 屏幕尺寸
    uClearCenter: number[];  // 清除区域中心 (NDC)
    uClearRadius: number;    // 清除半径 (0 = 全噪声, 1 = 全清除)
    uScanRingWidth: number;  // 扫描环宽度
    uScanRingColor: number[];// 扫描环颜色 (RGB)
    uNoiseScale: number;     // 噪声缩放
    uFlickerSpeed: number;   // 闪烁速度
  };
}
```

**片段着色器核心逻辑**（伪代码）：

```glsl
void main() {
  vec4 original = texture2D(uSampler, vTextureCoord);

  // 计算到清除中心的距离
  float dist = distance(vTextureCoord, uClearCenter);
  float normalizedDist = dist / uMaxDist;

  // 清除区域遮罩（中心清晰 → 外部噪声）
  float clearMask = smoothstep(uClearRadius, uClearRadius + 0.02, normalizedDist);

  // TV 静态噪声
  float noise = tvNoise(vTextureCoord, uTime, uNoiseScale);

  // 扫描环发光
  float ring = scanRing(normalizedDist, uClearRadius, uScanRingWidth);

  // 混合：清除区域显示原始内容，外部显示噪声
  vec3 noiseColor = vec3(noise) * 0.3;
  vec3 finalColor = mix(original.rgb, noiseColor, clearMask * uIntensity);

  // 叠加扫描环
  finalColor += uScanRingColor * ring;

  gl_FragColor = vec4(finalColor, 1.0);
}
```

### 4.4 视觉参数与 Logo 渲染

#### 4.4.1 噪声与滤镜参数

| 参数         | 值                              | 说明                 |
| ------------ | ------------------------------- | -------------------- |
| 噪声颜色     | 灰白色（TV 雪花风格）           | 经典静态噪声         |
| 扫描环颜色   | `vec3(0.0, 0.9, 0.8)` (#00E5CC) | 主题青色             |
| 扫描环宽度   | 0.015（NDC 单位）               | 窄而明亮的扫描线     |
| CRT 扫描线   | lineContrast: 0.1               | 常驻弱 CRT 质感      |
| RGB 色差峰值 | 15-25px                         | 信号闪现时的剧烈抖动 |
| 撕裂切片     | 8-15                            | 信号闪现时的水平撕裂 |

#### 4.4.2 Logo 程序化绘制（`LogoRenderer`）

- Logo 不再使用 SVG Sprite，改为 PixiJS `Graphics` 程序化绘制。
- Logo 由 **7 层组成**（设计分组）：外框、内框、辅助线、裂隙辉光、裂隙主体×3 层渐变、中心奇点。
- 裂隙内线（`riftInnerLine`）作为实现细节层，用于提升裂隙轮廓锐度。
- 矩形框尺寸统一为 **56×56**，通过不同旋转角度与颜色区分层次。
- 裂隙主体通过多层叠加模拟渐变：**深青 → 主题青 → 白色核心**。
- idle 阶段动画包含：
  - 外框与内框反向旋转
  - 辅助线透明度闪烁
  - 裂隙渐变层独立脉动（缩放 + 透明度）
  - 中心奇点快速旋转与高频闪烁

### 4.5 时间线

| 时间        | 事件                                                | 技术操作                                |
| ----------- | --------------------------------------------------- | --------------------------------------- |
| 0ms         | 全屏噪声 + CRT 效果                                 | SignalNoiseFilter intensity=1.0         |
| 800ms       | 第一次 Logo 闪现（100ms 可见）                      | logo.flash(100), triggerRGBSplit        |
| 1100ms      | 第二次 Logo 闪现（120ms 可见）                      | 同上，间隔缩短                          |
| 1350ms      | 第三次 Logo 闪现（150ms 可见）                      | 同上，更强的 RGB 色差                   |
| 1550ms      | 第四次闪现（180ms 可见）                            | 同上，位置偏移减小                      |
| 1800ms      | 第五次闪现（200ms 可见）                            | 信号趋于稳定                            |
| 2000ms      | Logo 固定显示，径向清除开始                         | uClearRadius 从 0 开始递增              |
| 2000-3200ms | 清除半径扩大，扫描环向外推进                        | 每帧更新 uClearRadius                   |
| 3200ms      | 噪声完全清除，启动 Logo idle 分层动画               | uIntensity → 0, logo.startIdleAnimation |
| 3400ms      | 确认脉冲（青色光环扩散）                            | PulseRenderer.triggerPulse              |
| 3600ms      | 提示文字淡入（SIGNAL LOCKED · CLICK TO INITIALIZE） | DOM Framer Motion                       |
| 3800ms      | 进入 idle 状态                                      | phase = "idle"                          |

---

## 5. Phase 2 - 能量启动（Angel 风格，规划中）

### 5.1 效果描述

参考 `examples/angel/index.html` 中的 Logo 交互效果（纯 Canvas 2D 实现）：

1. 用户**长按** Logo
2. 星空加速 + 能量环旋转加速 + 闪电效果
3. 松手后（如果按住超过 1.2 秒），触发**启动序列**：
   - 星空急停
   - 粒子吸入 Logo 中心
   - 闪白爆炸 + 冲击波扩散
   - 淡出进入标题画面

### 5.2 实现对照

| Angel 原版元素  | 新版实现                       | 技术方案                               |
| --------------- | ------------------------------ | -------------------------------------- |
| 星空背景 Canvas | 简单星空粒子                   | PixiJS Graphics 小圆点                 |
| tech-ring 旋转  | 能量环 CSS 动画                | Framer Motion / CSS                    |
| 闪电效果        | Canvas 2D 折线                 | PixiJS Graphics                        |
| 吸入效果        | 粒子向中心运动                 | PixiJS ticker 动画                     |
| 闪白爆炸        | 全屏白色 overlay               | DOM + CSS transition                   |
| 冲击波          | Canvas 圆环扩散                | PixiJS Graphics                        |
| 碎片粒子        | 爆炸碎片                       | PixiJS Graphics                        |
| Logo 样式层     | 保留现有精细多层设计（不简化） | 继续使用 `LogoRenderer` 程序化分层绘制 |
| 3D 按钮效果     | 不需要                         | -                                      |

### 5.3 交互状态机

```mermaid
stateDiagram-v2
    idle --> charging: pointerdown / touchstart
    charging --> idle: pointerup 且 holdTime 小于 1.2s
    charging --> primed: holdTime >= 1.2s
    primed --> sequence: pointerup
    sequence --> complete: 动画播放完毕
```

### 5.4 时间线

#### 按住阶段 charging

| 时间   | 效果                               |
| ------ | ---------------------------------- |
| 0ms    | Logo 添加 calibrating 类，星空加速 |
| 持续   | 能量环加速旋转，间歇闪电           |
| 1200ms | Logo 添加 primed 类，表示可以释放  |

#### 启动序列 sequence

| 时间        | 效果                             |
| ----------- | -------------------------------- |
| 0ms         | 星空急停                         |
| 0-100ms     | 密集闪电爆发                     |
| 100ms       | 进入吸入模式                     |
| 100-1200ms  | 所有粒子螺旋吸入中心             |
| 1200ms      | Logo 内缩 + 隐藏能量环           |
| 1400ms      | 闪白爆炸 + 色差冲击              |
| 1400-1600ms | 所有星星向外爆炸 + 碎片 + 冲击波 |
| 1600-1900ms | 淡出所有效果                     |
| 1900ms      | 调用 onComplete，进入标题画面    |

---

## 6. 组件架构

### 6.1 文件结构（当前实现）

```
src/components/SplashScreen/
├── index.tsx                        # 主组件（phase 切换 + 点击完成）
├── PixiSplashCanvas.tsx             # PixiJS 画布、RAF 循环、resize
├── FilterManager.ts                 # 滤镜管理（从旧 PixiSplashCanvas 提取）
├── renderers/
│   ├── SignalLockRenderer.ts        # 信号锁定动画编排器
│   ├── LogoRenderer.ts              # 程序化 Logo 绘制 + 多层 idle 动画
│   └── PulseRenderer.ts             # 确认脉冲光环
├── filters/
│   └── SignalNoiseFilter.ts         # 自定义 TV 噪声滤镜（片段着色器）
└── types.ts                         # 类型定义
```

> 注：`HudRenderer.ts` 已移除；`StarfieldRenderer.ts` / `ExplosionRenderer.ts` 为 Phase 2 规划能力，当前尚未实现。

### 6.2 组件职责

| 组件                 | 职责                                                     |
| -------------------- | -------------------------------------------------------- |
| `SplashScreen`       | 状态机管理（`intro`→`idle`→`complete`）、退出动画与回调  |
| `PixiSplashCanvas`   | PixiJS 初始化、分层容器管理、渲染器生命周期、帧循环      |
| `FilterManager`      | 统一管理 Glitch/RGBSplit/CRT 滤镜并提供触发 API          |
| `SignalLockRenderer` | Phase 1 编排（搜索噪声→闪现→径向锁定→确认脉冲）          |
| `LogoRenderer`       | PixiJS Graphics 程序化绘制 Logo，负责闪现/锁定/idle 动画 |
| `PulseRenderer`      | 确认脉冲光环绘制与生命周期管理                           |
| `SignalNoiseFilter`  | 自定义片段着色器：TV 静态噪声 + 径向清除遮罩             |

### 6.3 技术依赖图

```mermaid
flowchart TD
    subgraph 基础依赖
        GF[GlitchFilter]
        RF[RGBSplitFilter]
        CF[CRTFilter]
        ANF[AngryNoiseFilter - 参照模式]
    end

    subgraph 当前实现
        PSC[PixiSplashCanvas]
        FM[FilterManager]
        SNF[SignalNoiseFilter]
        SLR[SignalLockRenderer]
        LR[LogoRenderer]
        PR[PulseRenderer]
    end

    PSC --> FM
    PSC --> SLR
    ANF -.->|参照架构| SNF
    GF --> FM
    RF --> FM
    CF --> FM
    FM -->|故障滤镜触发| SLR
    SNF -->|噪声+径向清除| SLR
    SLR --> LR
    SLR --> PR
```

### 6.4 数据流

```
页面加载
   ↓
SplashScreen（phase: intro）
   ↓
PixiSplashCanvas 初始化 PixiJS + FilterManager + SignalLockRenderer
   ↓
SignalLockRenderer 编排 Phase 1
   ├── SignalNoiseFilter（噪声覆盖 + 径向清除）
   ├── FilterManager（Glitch/RGBSplit/CRT）
   ├── LogoRenderer（闪现/锁定/idle 多层动画）
   └── PulseRenderer（确认脉冲）
   ↓
动画完成 → phase: idle
   ↓
DOM 层中心点击热区（button）
   ↓
phase: complete → 500ms 淡出 → onComplete()
```

---

## 7. 不需要扩展 PixiJS 导出

与原方案不同，信号锁定方案**不需要**在 `src/lib/pixi/index.ts` 中新增任何导出。所有使用的 API（Application, Container, Graphics, Sprite, Text, TextStyle, Texture, Filter）已经导出。

自定义 `SignalNoiseFilter` 继承自已导出的 `Filter` 类，与 `AngryNoiseFilter` 模式完全一致。

---

## 8. 与现有代码的关系

### 8.1 需要替换/新增的文件

| 文件                                               | 处理方式                                     |
| -------------------------------------------------- | -------------------------------------------- |
| `src/components/SplashScreen/index.tsx`            | **重写**（新状态机 + 点击完成逻辑）          |
| `src/components/SplashScreen/PixiSplashCanvas.tsx` | **重写**（画布管理 + 渲染器调度）            |
| `src/components/SplashScreen/FilterManager.ts`     | **新增**（从旧版 PixiSplashCanvas 提取）     |
| `src/config/splash.ts`                             | **大幅修改**（Signal Lock 时间线与参数配置） |

### 8.2 保留/复用的能力

| 能力                    | 来源                               | 复用方式                             |
| ----------------------- | ---------------------------------- | ------------------------------------ |
| PixiJS Application 创建 | `PixiSplashCanvas.tsx`（旧实现）   | 沿用初始化模式                       |
| FilterManager 触发 API  | `FilterManager.ts`（由旧画布提取） | **核心复用** - 直接使用滤镜触发方法  |
| 自定义 Filter 模式      | `AngryNoiseFilter.ts`              | **参照架构**创建 `SignalNoiseFilter` |
| Framer Motion 退出动画  | `SplashScreen/index.tsx`           | 沿用 `AnimatePresence`               |
| pixi-filters            | `pixi-filters`                     | CRT/Glitch/RGBSplit 直接使用         |

### 8.3 不受影响的组件

- `TitleScreen/` - 完全不变
- `App.tsx` - 接口不变（onComplete 回调）
- `effects/` - 不变

### 8.4 与原设计的差异（截至 Phase 1）

1. `HudRenderer` 已移除：HUD 状态文字在最终实现中被简化掉，不再单独渲染。
2. Logo 渲染从 SVG Sprite 改为 PixiJS Graphics 程序化绘制，支持多层图元独立动画。
3. Logo idle 动画从“简单呼吸”升级为“多层独立动画”（外框反向旋转 + 裂隙脉动 + 奇点闪烁）。
4. `FilterManager` 从 `PixiSplashCanvas.tsx` 提取为独立文件，职责更清晰。
5. Phase 2 交互暂时简化为“idle 点击后完成”，尚未实现长按充能与启动序列。

---

## 9. 技术风险与备选方案

| 风险              | 说明                                          | 备选方案                             |
| ----------------- | --------------------------------------------- | ------------------------------------ |
| TV 噪声性能       | 片段着色器逐像素计算噪声                      | 使用预生成噪声纹理 + UV 动画滚动     |
| Filter 叠加顺序   | SignalNoiseFilter 与 FilterManager 的滤镜共存 | 分层容器，不同容器独立滤镜           |
| Logo 分层动画调参 | 多层 Graphics 在不同分辨率下可能出现节奏失衡  | 固定基准尺寸 + 分层 alpha/scale 约束 |
| 径向清除边界锯齿  | smoothstep 过渡可能不够平滑                   | 增大过渡区域宽度 + 噪声化边界        |

---

## 10. 实现步骤（Todo）

1. ✅ 创建 `SignalNoiseFilter`（自定义片段着色器）
2. ✅ 实现 `LogoRenderer`（PixiJS Graphics 程序化绘制 + 多层动画）
3. ✅ 实现 `SignalLockRenderer`（Phase 1 动画编排）
4. ❌ ~~实现 `HudRenderer`~~（已移除，用户反馈认为多余）
5. ✅ 实现 `PulseRenderer`（确认脉冲光环）
6. ✅ 重写 `SplashCanvas.tsx`（新的画布管理）
7. ✅ 重写 `SplashScreen/index.tsx`（新状态机）
8. ✅ 更新 `config/splash.ts`（新配置参数）
9. ⏳ 实现 Phase 2 能量启动效果（未开始）
10. ✅ 集成测试 + 动画调参

---

## 11. 已废弃的文档

以下文档与 GPU 粒子系统方案相关，已不再适用：

- ~~`pixi-mesh-shader-technical-guide.md`~~ - PixiJS Mesh + 自定义 Shader 的 GPU 粒子技术指南（已废弃，且文件已从仓库删除）
