# 魔法阵视觉优化方案

## 1. 问题诊断

### 1.1 当前 EnergyRingRenderer 问题

| 问题     | 现状                                                  | 目标                             |
| -------- | ----------------------------------------------------- | -------------------------------- |
| 环带太细 | 双线 stroke（间距仅 4-6 × lineWidth），视觉上只是细线 | 宽条带（填充环带），带宽 12-20px |
| 缺乏文字 | 环带内仅有短弧点缀和刻度线                            | 环带内填充沿弧排列的魔法符文     |
| 几何单薄 | 六芒星用单线 stroke                                   | 双线/宽边六芒星，增加视觉厚度    |
| 层次不足 | 仅 4 层（外环、中环、六芒星、内星）                   | 增至 6 层，增加符文带和装饰环    |

### 1.2 当前 LogoRenderer 相关问题

| 问题         | 现状                                                   | 目标                                         |
| ------------ | ------------------------------------------------------ | -------------------------------------------- |
| 视觉杂乱     | 充能时魔法阵线条与 Logo 线条交织，导致中心区域信息过密 | 通过分层/避让/时序解耦，消除线条交织         |
| 注意力竞争   | Ring 与 Logo 在同区域同时高亮，视觉焦点冲突            | 让 Ring 负责外围能量感，Logo 保持主体可读性  |
| 错误优化方向 | 将问题归因于 Logo 本体复杂度，尝试简化 Logo            | 保留 Logo 原设计，优先优化充能阶段 Ring 策略 |

---

## 2. 字体集成方案

### 2.1 字体文件部署

```
操作：将 temp/Spooky Creeky.ttf 移动到 public/fonts/SpookyCreeky.ttf
```

### 2.2 CSS @font-face 注册

在 [`src/styles/globals.css`](src/styles/globals.css) 文件开头添加：

```css
@font-face {
  font-family: 'SpookyCreeky';
  src: url('/fonts/SpookyCreeky.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
```

### 2.3 字体预加载与就绪检测

在 EnergyRingRenderer 初始化前，确保字体已加载：

```typescript
// src/components/SplashScreen/utils/fontLoader.ts
const MAGIC_FONT_FAMILY = 'SpookyCreeky';

export async function loadMagicFont(): Promise<boolean> {
  try {
    await document.fonts.load(`16px ${MAGIC_FONT_FAMILY}`);
    return document.fonts.check(`16px ${MAGIC_FONT_FAMILY}`);
  } catch {
    return false;
  }
}

export { MAGIC_FONT_FAMILY };
```

### 2.4 Pixi.js 文字技术选型

**选型结论：Canvas 2D 离屏预渲染 → Pixi.js Texture**

| 方案                   | 优点                                              | 缺点                                                   | 结论 |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------ | ---- |
| Pixi.Text 逐字符定位   | 简单直接                                          | 每个字符一个 Text 对象，60+ 字符性能差；旋转更新开销大 | ❌    |
| Pixi.BitmapText        | 性能最好                                          | 需预生成 BitmapFont atlas，流程复杂；不支持弧线排列    | ❌    |
| Canvas 2D 预渲染到纹理 | 一次渲染、一个 Sprite；完美支持弧线文字；性能最优 | 需手写 Canvas 2D 弧线文字逻辑                          | ✅    |

**核心思路**：创建离屏 Canvas，用 Canvas 2D API 的 `translate/rotate` 将每个字符沿圆弧排列，然后用 `Texture.from(canvas)` 转为 Pixi 纹理，作为 Sprite 叠加。

---

## 3. EnergyRingRenderer 重构方案

### 3.1 新层次结构（从外到内）

```
┌─────────────────────────────────────────────┐
│ Layer 6: 外符文带（宽条带 + 魔法文字）       │  ← 新增
│ Layer 5: 外环线（双线边界）                  │  ← 原外环简化
│ Layer 4: 中符文带（宽条带 + 魔法文字）       │  ← 新增
│ Layer 3: 中环线（双线边界）                  │  ← 原中环简化
│ Layer 2: 六芒星（双线宽边 + 顶点装饰）      │  ← 增强
│ Layer 1: 内环 + 装饰圆 + 内星               │  ← 简化
│ Layer 0: 中心光晕（halo）                    │  ← 保留
└─────────────────────────────────────────────┘
```

### 3.2 半径分配（以 outerRadius = R 为基准）

```
R          ─ 外符文带外缘
R - 0.08R  ─ 外符文带内缘（带宽 ≈ 0.08R）
R - 0.10R  ─ 外环线外圈
R - 0.12R  ─ 外环线内圈（双线间距 0.02R）

R * 0.72   ─ 中符文带外缘
R * 0.64   ─ 中符文带内缘（带宽 ≈ 0.08R）
R * 0.62   ─ 中环线外圈
R * 0.60   ─ 中环线内圈

R * 0.55   ─ 六芒星外接圆
R * 0.35   ─ 内圆
R * 0.28   ─ 八角星外径
R * 0.15   ─ 八角星内径
```

### 3.3 关键绘制方法改造

#### 3.3.1 新增：`_drawFilledBand()` — 宽条带绘制

```typescript
/**
 * 绘制填充环带（宽条带）
 * 使用两个同心 arc 围成的环形区域，半透明填充
 */
private _drawFilledBand(
  cx: number, cy: number,
  outerR: number, innerR: number,
  rotation: number,
  fillAlpha: number,
  color: number,
): void {
  if (outerR <= innerR || innerR <= 0) return;

  const g = this._graphics;
  g.beginFill(color, this._clamp01(fillAlpha));

  // 外弧（顺时针）
  const startAngle = rotation;
  const startX = cx + Math.cos(startAngle) * outerR;
  const startY = cy + Math.sin(startAngle) * outerR;
  g.moveTo(startX, startY);
  g.arc(cx, cy, outerR, startAngle, startAngle + TAU);

  // 内弧（逆时针 = 挖空）
  // 使用 moveTo 跳到内弧起点，然后反向 arc
  const innerStartX = cx + Math.cos(startAngle + TAU) * innerR;
  const innerStartY = cy + Math.sin(startAngle + TAU) * innerR;
  g.moveTo(innerStartX, innerStartY);
  g.arc(cx, cy, innerR, startAngle + TAU, startAngle, true);

  g.endFill();
}
```

> **注意**：Pixi.js v7 Graphics 的 `beginFill` + `arc` 组合支持环形绘制。若遇到填充问题，备选方案是使用 `drawCircle(outerR)` 填充后再用背景色 `drawCircle(innerR)` 遮盖（视觉裁剪法）。但更推荐使用 `beginHole()` / `endHole()` API（Pixi v7 支持）:

```typescript
// 备选：使用 hole API
g.beginFill(color, fillAlpha);
g.drawCircle(cx, cy, outerR);
g.beginHole();
g.drawCircle(cx, cy, innerR);
g.endHole();
g.endFill();
```

#### 3.3.2 新增：`_runeTextSprites` — 预渲染弧线文字

```typescript
// 新增成员
private _runeTextures: Map<string, Texture> = new Map();
private _runeSprites: Sprite[] = [];

/**
 * 将魔法文字沿弧线预渲染到离屏 Canvas，生成 Pixi Texture
 * 
 * @param id       纹理标识符（用于缓存）
 * @param text     要渲染的文字内容
 * @param radius   文字排列的圆弧半径
 * @param fontSize 字体大小
 * @param color    CSS 颜色字符串
 * @returns Texture
 */
private _createArcTextTexture(
  id: string,
  text: string,
  radius: number,
  fontSize: number,
  color: string,
): Texture {
  // 检查缓存
  const cached = this._runeTextures.get(id);
  if (cached) return cached;

  const canvasSize = Math.ceil(radius * 2 + fontSize * 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;

  ctx.font = `${fontSize}px SpookyCreeky, serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 计算每个字符的角度间距
  const totalChars = text.length;
  const anglePerChar = TAU / totalChars;

  for (let i = 0; i < totalChars; i++) {
    const angle = i * anglePerChar - Math.PI / 2; // 从顶部开始
    ctx.save();
    ctx.translate(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    );
    ctx.rotate(angle + Math.PI / 2); // 字符朝外
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }

  const texture = Texture.from(canvas);
  this._runeTextures.set(id, texture);
  return texture;
}
```

#### 3.3.3 魔法文字内容

```typescript
// 外环符文（重复循环填满一圈）
const OUTER_RUNE_TEXT =
  'ARCANUM ETERNIS VOCATUS NEXUS DIMENSIO PORTALIS VERITUM SANCTUM LYRAETH OBSCURIS ';

// 中环符文
const INNER_RUNE_TEXT =
  'NEURAL LINK AWAKENED SIGNAL LOCKED CONSCIOUSNESS SYNC PROTOCOL ENGAGED ';
```

> 使用 Spooky Creeky 字体后，普通英文字母会呈现魔法/哥特风格，无需真正的符文 Unicode。

#### 3.3.4 改造 `_drawMagicCircle()` 主函数

```typescript
private _drawMagicCircle(elapsed: number, implodeScale: number): void {
  const R = Math.max(0, this._outerRadius * implodeScale);
  if (R <= 0.5) return;

  // ── 半径计算 ──
  const outerRuneBandOuter = R;
  const outerRuneBandInner = R * 0.92;
  const outerLineOuter = R * 0.90;
  const outerLineInner = R * 0.88;

  const midRuneBandOuter = R * 0.72;
  const midRuneBandInner = R * 0.64;
  const midLineOuter = R * 0.62;
  const midLineInner = R * 0.60;

  const hexagramRadius = R * 0.55;
  const innerCircleRadius = R * 0.35;
  const innerStarOuter = R * 0.28;
  const innerStarInner = innerStarOuter * 0.52;

  // ── Layer 0: 中心光晕 ──
  this._drawCenterHalo(implodeScale);

  // ── Layer 1: 内环 + 八角星 ──
  this._drawCircle(cx, cy, innerCircleRadius, 0.45, rot[3], CENTER_CORE_COLOR);
  if (!this._isTiny) {
    this._drawStar(cx, cy, innerStarOuter, innerStarInner, 8, rot[3], 0.45, CENTER_CORE_COLOR);
  }

  // ── Layer 2: 六芒星（双线宽边）──
  this._drawDoubleHexagram(cx, cy, hexagramRadius, rot[2], 0.4);

  // ── Layer 3: 中环线（双线）──
  this._drawCircle(cx, cy, midLineOuter, 0.3, rot[1], RUNE_RING_COLOR);
  this._drawCircle(cx, cy, midLineInner, 0.3, rot[1], RUNE_RING_COLOR);

  // ── Layer 4: 中符文带 ──
  this._drawFilledBand(cx, cy, midRuneBandOuter, midRuneBandInner, rot[1], 0.08, RUNE_RING_COLOR);
  // 符文 Sprite 旋转由 update() 中设置 sprite.rotation

  // ── Layer 5: 外环线（双线）──
  this._drawCircle(cx, cy, outerLineOuter, 0.35, rot[0], OUTER_RING_COLOR);
  this._drawCircle(cx, cy, outerLineInner, 0.35, rot[0], OUTER_RING_COLOR);
  this._drawRadialTicks(cx, cy, outerLineInner, outerLineOuter, 72, rot[0], 0.25);

  // ── Layer 6: 外符文带 ──
  this._drawFilledBand(cx, cy, outerRuneBandOuter, outerRuneBandInner, rot[0], 0.06, OUTER_RING_COLOR);
  // 符文 Sprite 旋转由 update() 中设置 sprite.rotation
}
```

#### 3.3.5 新增：`_drawDoubleHexagram()` — 双线六芒星

```typescript
/**
 * 双线六芒星：外线 + 偏移内线，形成宽边效果
 */
private _drawDoubleHexagram(
  cx: number, cy: number,
  radius: number,
  rotation: number,
  alpha: number,
): void {
  const outerLW = this._lineWidth * 1.5;
  const innerLW = this._lineWidth * 0.8;
  const innerRadius = radius * 0.92; // 内线半径略小

  // 外三角 A + B
  this._drawRegularPolygon(cx, cy, radius, 3, rotation, alpha, OUTER_RING_COLOR, outerLW);
  this._drawRegularPolygon(cx, cy, radius, 3, rotation + Math.PI, alpha, OUTER_RING_COLOR, outerLW);

  // 内三角 A + B（略小，形成双线效果）
  this._drawRegularPolygon(cx, cy, innerRadius, 3, rotation, alpha * 0.6, RUNE_RING_COLOR, innerLW);
  this._drawRegularPolygon(cx, cy, innerRadius, 3, rotation + Math.PI, alpha * 0.6, RUNE_RING_COLOR, innerLW);

  // 六个顶点装饰圆
  this._drawHexagramVertexDots(cx, cy, radius, rotation, alpha);
}
```

#### 3.3.6 新增：`_drawRadialTicks()` — 环线间刻度

```typescript
/**
 * 在双线环之间绘制细密径向刻度，替代原来的粗刻度+菱形
 */
private _drawRadialTicks(
  cx: number, cy: number,
  innerR: number, outerR: number,
  count: number,
  rotation: number,
  alpha: number,
): void {
  const step = TAU / count;
  this._graphics.lineStyle(
    Math.max(0.5, this._lineWidth * 0.5),
    OUTER_RING_COLOR,
    this._clamp01(alpha),
  );

  for (let i = 0; i < count; i++) {
    const angle = rotation + i * step;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // 长短交替
    const tickInner = i % 3 === 0 ? innerR : innerR + (outerR - innerR) * 0.3;
    this._graphics.moveTo(cx + cos * tickInner, cy + sin * tickInner);
    this._graphics.lineTo(cx + cos * outerR, cy + sin * outerR);
  }
}
```

### 3.4 符文 Sprite 管理

由于 `Graphics` 每帧 `clear()` 重绘，符文文字不能画在 Graphics 上（会被清除）。需要用独立的 `Sprite` 承载：

```typescript
// 在构造函数中初始化
private _outerRuneSprite: Sprite | null = null;
private _middleRuneSprite: Sprite | null = null;

// 初始化时创建（需在字体加载完成后调用）
initRuneSprites(): void {
  const R = this._outerRadius;

  // 外符文环
  const outerRuneRadius = R * 0.96; // 文字排列的中线半径
  const outerFontSize = Math.max(8, R * 0.05);
  const outerTex = this._createArcTextTexture(
    'outer', OUTER_RUNE_TEXT, outerRuneRadius, outerFontSize,
    'rgba(0, 229, 204, 0.4)',
  );
  this._outerRuneSprite = new Sprite(outerTex);
  this._outerRuneSprite.anchor.set(0.5);
  this._outerRuneSprite.position.set(this._centerX, this._centerY);
  this._container.addChild(this._outerRuneSprite);

  // 中符文环
  const midRuneRadius = R * 0.68;
  const midFontSize = Math.max(7, R * 0.04);
  const midTex = this._createArcTextTexture(
    'mid', INNER_RUNE_TEXT, midRuneRadius, midFontSize,
    'rgba(0, 212, 187, 0.35)',
  );
  this._middleRuneSprite = new Sprite(midTex);
  this._middleRuneSprite.anchor.set(0.5);
  this._middleRuneSprite.position.set(this._centerX, this._centerY);
  this._container.addChild(this._middleRuneSprite);
}
```

在 [`update()`](src/components/SplashScreen/renderers/EnergyRingRenderer.ts:110) 中同步旋转：

```typescript
// 在 update() 的旋转计算之后
if (this._outerRuneSprite) {
  this._outerRuneSprite.rotation = this._layerRotations[0];
  this._outerRuneSprite.alpha = combinedAlpha * 0.5;
}
if (this._middleRuneSprite) {
  this._middleRuneSprite.rotation = this._layerRotations[1];
  this._middleRuneSprite.alpha = combinedAlpha * 0.45;
}
```

### 3.5 resize 时重建纹理

```typescript
resize(centerX: number, centerY: number, width: number, height: number): void {
  this._centerX = centerX;
  this._centerY = centerY;
  this._computeLayout(width, height);

  // 清除纹理缓存并重建
  this._destroyRuneSprites();
  this._runeTextures.forEach(tex => tex.destroy(true));
  this._runeTextures.clear();
  this.initRuneSprites();
}
```

### 3.6 implode 缩放处理

符文 Sprite 需要跟随 implode 缩放：

```typescript
// 在 update() 中
if (this._outerRuneSprite) {
  this._outerRuneSprite.scale.set(implodeScale);
}
if (this._middleRuneSprite) {
  this._middleRuneSprite.scale.set(implodeScale);
}
```

---

## 4. Logo 保留方案（不简化）

### 4.1 设计原则

- Logo 是精心设计的视觉主体，`LogoRenderer` 结构保持不变（不删层、不改几何）。
- 当前“杂乱”主要来自 **charging 阶段魔法阵线条与 Logo 线条交织**，并非 Logo 本体问题。
- 优化重心转向 `EnergyRingRenderer` 与编排层：空间避让、透明度衰减、节奏错峰、容器分层。

### 4.2 交织问题拆解

| 问题     | 触发条件                                 | 优化目标                            |
| -------- | ---------------------------------------- | ----------------------------------- |
| 空间交织 | 中环/内环线条进入 Logo 主体区域          | 为 Logo 预留安全半径（safe radius） |
| 节奏交织 | Ring 与 Logo 同时高亮、同频变化          | 充能节奏拆分为外环优先、中环后置    |
| 亮度交织 | 交叉区域 alpha 叠加过高导致中心过曝/发糊 | 对中心区 ring 做径向 alpha 衰减     |

### 4.3 具体改造方向（优先改 EnergyRing）

1. **空间避让**：charging 期间动态抬高中环内径，禁止 ring 穿过 Logo 关键线条区域。
2. **中心衰减**：按到中心距离对 ring alpha 做衰减，越靠近 Logo 中心越淡。
3. **错峰充能**：0~60% 先增强外环；60~100% 再逐步提升中环/符文。
4. **层级隔离**：Logo 保持上层主体可读性，ring 负责外围包围感。

```typescript
// 伪代码：charging 期间 ring 避让 logo
const safeRadius = this._logoSafeRadius * (0.95 + chargeProgress * 0.1);

// 中层内径不进入 logo 安全区
const midLineInner = Math.max(R * 0.60, safeRadius);
const midRuneBandInner = Math.max(R * 0.64, safeRadius * 1.05);

// 错峰增强：外环先增强，中环后增强
const outerBoost = chargeProgress;
const midBoost = chargeProgress < 0.6 ? 0 : (chargeProgress - 0.6) / 0.4;
```

### 4.4 LogoRenderer 改动策略

- `LogoRenderer.ts` **不做简化改造**：保留 outerFrame、innerFrame、rift 渐变层、奇点等原有设计。
- 如确有需要，仅允许新增“只读信息接口”（例如视觉包围半径），供 ring 做避让计算。
- idle / flash / lock 接口与行为保持兼容，不引入破坏性改动。

---

## 5. 完整重构文件清单

### 5.1 需要修改的文件

| 文件                                                                                   | 改动类型     | 说明                                                                                  |
| -------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| [`EnergyRingRenderer.ts`](src/components/SplashScreen/renderers/EnergyRingRenderer.ts) | **大改**     | 新增宽条带、符文纹理、双线六芒星，并在 charging 阶段加入 Logo 安全区避让与 alpha 衰减 |
| [`LogoRenderer.ts`](src/components/SplashScreen/renderers/LogoRenderer.ts)             | **可选小改** | 保持原有设计，不做简化；仅在需要时新增只读边界信息                                    |
| [`src/styles/globals.css`](src/styles/globals.css)                                     | **小改**     | 添加 @font-face 声明                                                                  |
| [`src/lib/pixi/index.ts`](src/lib/pixi/index.ts)                                       | **小改**     | 添加 `Sprite` 和 `Texture` 导出（如果未导出）                                         |
| [`PixiSplashCanvas.tsx`](src/components/SplashScreen/PixiSplashCanvas.tsx)             | **小改**     | EnergyRingRenderer 构造后调用 `initRuneSprites()`                                     |

### 5.2 需要新增的文件

| 文件                                              | 说明            |
| ------------------------------------------------- | --------------- |
| `public/fonts/SpookyCreeky.ttf`                   | 从 `temp/` 移动 |
| `src/components/SplashScreen/utils/fontLoader.ts` | 字体加载工具    |

### 5.3 Pixi 导出补充

当前 [`src/lib/pixi/index.ts`](src/lib/pixi/index.ts) 已导出 `Sprite` 和 `Texture`，无需额外修改。

---

## 6. 屏幕适配策略

### 6.1 基于 `_computeLayout()` 的响应式参数

```typescript
private _computeLayout(width: number, height: number): void {
  const S = Math.min(width, height);
  this._outerRadius = Math.min(
    Math.max(S * 0.3, 96),
    S * 0.5 - 24,
  );
  this._outerRadius = Math.min(this._outerRadius, 280);
  this._lineWidth = Math.max(Math.min(S / 700, 1.8), 0.9);
  this._isCompact = S < 520;
  this._isTiny = S < 420;

  // ── 新增：符文字体大小随屏幕缩放 ──
  this._runeFontSize = Math.max(
    this._isTiny ? 6 : 8,
    Math.floor(this._outerRadius * 0.05),
  );
}
```

### 6.2 小屏降级策略

| 条件                   | 降级措施                              |
| ---------------------- | ------------------------------------- |
| `_isTiny` (S < 420)    | 不渲染符文文字 Sprite，仅保留填充条带 |
| `_isCompact` (S < 520) | 符文字体缩小到 6px，减少刻度数量      |
| 正常屏幕               | 全部效果启用                          |

```typescript
// 在 initRuneSprites() 开头
if (this._isTiny) return; // 极小屏不渲染符文
```

---

## 7. 动画接口兼容性保证

### 7.1 EnergyRingRenderer 接口不变

以下公开方法签名完全保持不变：

```typescript
fadeIn(duration: number): void;
setChargeProgress(progress: number): void;
startImplode(duration: number): void;
hide(): void;
update(dt: number, elapsed: number): void;
resize(centerX: number, centerY: number, width: number, height: number): void;
destroy(): void;
```

**内部改动**：
- `update()` 中增加符文 Sprite 的 rotation/alpha/scale 同步
- `destroy()` 中增加纹理和 Sprite 的清理
- `resize()` 中增加纹理重建

### 7.2 LogoRenderer 接口不变

以下公开方法签名完全保持不变：

```typescript
init(ctx: SplashCanvasContext): void;
update(elapsed: number, delta: number): void;
resize(width: number, height: number): void;
destroy(): void;
setVisible(visible: boolean): void;
setAlpha(alpha: number): void;
setPosition(x: number, y: number): void;
setJitter(maxOffset: number): void;
setCharging(active: boolean): void;
setChargeProgress(progress: number): void;
setSequenceMode(active: boolean): void;
shrink(duration: number): void;
setScale(scale: number): void;
getScale(): number;
flash(duration: number): void;
startIdleAnimation(): void;
startBreathing(): void; // deprecated 兼容
lockVisible(): void;
hideInstantly(): void;
getCenter(): { x: number; y: number };
```

**内部改动**：
- 保持现有 Logo 几何与层次设计，不做删层简化
- 如需配合 ring 避让，仅新增可选只读边界信息
- idle 动画可做参数微调（alpha/速度），不改图元结构

---

## 8. 颜色方案

沿用当前青绿色系，不引入新颜色常量：

| 常量                | 值         | 用途                       |
| ------------------- | ---------- | -------------------------- |
| `OUTER_RING_COLOR`  | `0x00e5cc` | 外环带、外符文、六芒星外线 |
| `RUNE_RING_COLOR`   | `0x00d4bb` | 中环带、中符文、六芒星内线 |
| `CENTER_CORE_COLOR` | `0x00ffdd` | 内环、八角星               |

符文文字使用同色系但降低 alpha：
- 外环符文：`rgba(0, 229, 204, 0.4)`
- 中环符文：`rgba(0, 212, 187, 0.35)`

---

## 9. 实施步骤（供 Code 模式执行）

1. 将 `temp/Spooky Creeky.ttf` 移动到 `public/fonts/SpookyCreeky.ttf`
2. 在 `src/styles/globals.css` 添加 `@font-face` 声明
3. 创建 `src/components/SplashScreen/utils/fontLoader.ts`
4. 重构 `EnergyRingRenderer.ts`：
   - a. 添加 `Sprite`、`Texture` 导入
   - b. 添加符文常量和成员变量
   - c. 实现 `_createArcTextTexture()` 方法
   - d. 实现 `_drawFilledBand()` 方法
   - e. 实现 `_drawDoubleHexagram()` 方法
   - f. 实现 `_drawRadialTicks()` 方法
   - g. 改造 `_drawMagicCircle()` 使用新层次
   - h. 添加 `initRuneSprites()` 和 `_destroyRuneSprites()` 方法
   - i. 在 `update()` 中同步符文 Sprite
   - j. 在 charging 阶段加入 Logo 安全区避让 / alpha 衰减 / 错峰充能
   - k. 在 `resize()` 中重建纹理
   - l. 在 `destroy()` 中清理资源
5. 保持 `LogoRenderer.ts` 现有视觉设计，不做简化改造；必要时仅新增只读边界信息（可选）
6. 在 `PixiSplashCanvas.tsx` 中添加字体加载和符文初始化调用，并协调 charging 阶段 Ring/Logo 分层关系
7. 验证所有动画阶段（intro → idle → charging → sequence → complete）正常工作，重点确认充能时不再出现 ring 与 Logo 关键线条交织

---

## 10. 视觉效果对比预览

### 改造前

```
薄线外圈 ─────────────────── (stroke 1.2px)
    薄线内圈 + 短弧点缀
        薄线中圈 ─────────── (stroke 1.2px)
            薄线内圈 + 刻度线
                单线三角形 × 2（六芒星）
                    薄线内圈
                        八角星
                            [方形框] [方形框]
                              十字准星
                              多层裂隙
                              方块奇点
```

### 改造后

```
▓▓▓ 外符文宽带 ▓▓▓▓▓▓▓▓▓▓▓ (填充带 + 弧线魔法文字)
  ══ 外双线环 ══════════════ (双 stroke + 72 根细密刻度)
      ▓▓ 中符文宽带 ▓▓▓▓▓▓▓ (填充带 + 弧线魔法文字)
        ══ 中双线环 ════════ (双 stroke)
            ╔═ 双线六芒星 ═╗ (外线 + 内线 + 顶点圆)
              ── 内圆 ──
                ✦ 八角星 ✦
                  [保留原 Logo 设计：外框 + 内框 + 十字 + 裂隙层 + 奇点]
                  [通过 Ring 避让与错峰充能降低中心区交织]
                  [目标：Logo 主体始终清晰可读]
