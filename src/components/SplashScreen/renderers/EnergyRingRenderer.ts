import { Container, Graphics, Sprite, Texture } from "@/lib/pixi";

const FRAME_DURATION_MS = 1000 / 60;
const MIN_VISIBLE_ALPHA = 0.001;
const TAU = Math.PI * 2;

const OUTER_RING_COLOR = 0x00e5cc;
const RUNE_RING_COLOR = 0x00d4bb;
const CENTER_CORE_COLOR = 0x00ffdd;

const HALO_COLOR = 0x00e5cc;
const HALO_RADII = [24, 64, 128, 220, 340] as const;
const HALO_ALPHA_WEIGHTS = [1, 0.7, 0.42, 0.2, 0.1] as const;

const OUTER_RUNE_TEXT = "☿ᛟ⊹ᚱ△ᛊ◇ᚦ⊕ᛁ▽ᚢ⊗ᛉ○ᚠ⊛ᛈ□ᚨ⊘ᛗ◈ᚷ⊙ᛚ▷ᚹ⊜ᛞ◉ᚻ⊝ᛏ⬡ᚾ⊞ᛃ⬢ᛇ⊟ᚲ⬣ᛄ⊠ᚳ⬟ᛋ⊡ᚴ⬡ᛎ";
const INNER_RUNE_TEXT =
  "αΩ⟐βΨ⟑γΦ⟒δΧ⟓εΥ⟔ζΤ⟕ηΣ⟖θΡ⟗ιΠ⟘κΞ⟙λΝ⟚μΜ⟛νΛ⟜ξΚ⟝πΙ⟞ρΘ⟟σΗ⟠τΖ⟡υΕ";

const RUNE_FONT = "serif";
const RUNE_SEGMENT_SEPARATOR = " ⟡ ";
const OUTER_RUNE_TEXT_COLOR = "rgba(0, 229, 204, 0.72)";
const INNER_RUNE_TEXT_COLOR = "rgba(0, 212, 187, 0.66)";

export class EnergyRingRenderer {
  private _container: Container;
  private _graphics: Graphics;

  private _centerX: number;
  private _centerY: number;

  private _fadeAlpha = 0;
  private _chargeProgress = 0;
  private _visible = false;

  private _isFadingIn = false;
  private _fadeInDuration = 1;
  private _fadeInElapsed = 0;

  private _isImploding = false;
  private _implodeProgress = 0;
  private _implodeDuration = 1;
  private _implodeElapsed = 0;

  private _outerRadius = 180;
  private _lineWidth = 1.2;
  private _isCompact = false;
  private _isTiny = false;
  private _runeFontSize = 10;

  // 外环、内环、六芒星、内星
  private _layerRotations: number[] = [0, 0, 0, 0];

  private _runeTextures: Map<string, Texture> = new Map();
  private _outerRuneSprite: Sprite | null = null;
  private _middleRuneSprite: Sprite | null = null;

  constructor(
    parentContainer: Container,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ) {
    this._container = new Container();
    this._graphics = new Graphics();

    this._container.addChild(this._graphics);
    this._container.visible = false;
    this._container.alpha = 0;
    parentContainer.addChild(this._container);

    this._centerX = centerX;
    this._centerY = centerY;
    this._computeLayout(width, height);
    this._initRuneSprites();
  }

  fadeIn(duration: number): void {
    this._visible = true;
    this._container.visible = true;

    this._isFadingIn = true;
    this._fadeInDuration = Math.max(1, duration);
    this._fadeInElapsed = 0;
    this._fadeAlpha = 0;

    this._isImploding = false;
    this._implodeProgress = 0;
    this._implodeElapsed = 0;

    if (!this._isTiny && (!this._outerRuneSprite || !this._middleRuneSprite)) {
      this._initRuneSprites();
    }
  }

  setChargeProgress(progress: number): void {
    this._chargeProgress = this._clamp01(progress);
  }

  startImplode(duration: number): void {
    this._visible = true;
    this._container.visible = true;

    this._isImploding = true;
    this._implodeProgress = 0;
    this._implodeDuration = Math.max(1, duration);
    this._implodeElapsed = 0;

    this._isFadingIn = false;
    this._fadeAlpha = Math.max(this._fadeAlpha, 1);
  }

  hide(): void {
    this._visible = false;
    this._isFadingIn = false;
    this._fadeInElapsed = 0;

    this._chargeProgress = 0;
    this._fadeAlpha = 0;

    this._isImploding = false;
    this._implodeProgress = 0;
    this._implodeElapsed = 0;

    this._container.visible = false;
    this._container.alpha = 0;
    this._graphics.clear();
  }

  update(dt: number, elapsed: number): void {
    const safeDt = Math.max(0, dt);
    const safeElapsed = Math.max(0, elapsed);
    const frameDelta = safeDt > 0 ? safeDt / FRAME_DURATION_MS : 1;

    this._graphics.clear();

    if (
      !this._visible &&
      !this._isImploding &&
      this._fadeAlpha <= MIN_VISIBLE_ALPHA
    ) {
      this._container.visible = false;
      this._container.alpha = 0;
      return;
    }

    if (this._isFadingIn) {
      this._fadeInElapsed += safeDt;
      const fadeProgress = this._clamp01(
        this._fadeInElapsed / this._fadeInDuration,
      );
      this._fadeAlpha = fadeProgress;

      if (fadeProgress >= 1) {
        this._isFadingIn = false;
      }
    }

    if (!this._isFadingIn && !this._isImploding && this._visible) {
      this._fadeAlpha = Math.max(this._fadeAlpha, 1);
    }

    if (this._isImploding) {
      this._implodeElapsed += safeDt;
      this._implodeProgress = this._clamp01(
        this._implodeElapsed / this._implodeDuration,
      );
    }

    const implodeScale = this._isImploding ? 1 - this._implodeProgress : 1;
    const implodeAlpha = this._isImploding
      ? 1 - this._implodeProgress * this._implodeProgress
      : 1;
    const visibilityAlpha = this._visible ? 1 : 0;
    const combinedAlpha = this._clamp01(
      this._fadeAlpha * visibilityAlpha * implodeAlpha,
    );

    this._container.visible = combinedAlpha > MIN_VISIBLE_ALPHA;
    this._container.alpha = combinedAlpha;

    if (combinedAlpha <= MIN_VISIBLE_ALPHA) {
      if (this._isImploding && this._implodeProgress >= 1) {
        this.hide();
      }
      return;
    }

    const speedMult = 1 + this._chargeProgress * 1.8;
    this._layerRotations[0] -= 0.0038 * speedMult * frameDelta; // 外层逆时针
    this._layerRotations[1] += 0.0058 * speedMult * frameDelta; // 中层顺时针
    this._layerRotations[2] += 0.011 * speedMult * frameDelta; // 六芒星顺时针
    this._layerRotations[3] -= 0.009 * speedMult * frameDelta; // 内层逆时针

    this._drawMagicCircle(safeElapsed, implodeScale);
    this._syncRuneSprites(implodeScale, combinedAlpha);

    if (this._isImploding && this._implodeProgress >= 1) {
      this.hide();
    }
  }

  resize(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): void {
    this._centerX = centerX;
    this._centerY = centerY;
    this._computeLayout(width, height);

    this._destroyRuneSprites();
    this._destroyRuneTextures();
    this._initRuneSprites();
  }

  destroy(): void {
    this._destroyRuneSprites();
    this._destroyRuneTextures();

    this._graphics.removeFromParent();
    this._graphics.destroy();

    this._container.removeFromParent();
    this._container.destroy();

    this._visible = false;
    this._isFadingIn = false;
    this._isImploding = false;
  }

  private _computeLayout(width: number, height: number): void {
    const S = Math.min(width, height);
    this._outerRadius = Math.min(Math.max(S * 0.3, 96), S * 0.5 - 24);
    this._outerRadius = Math.min(this._outerRadius, 280);

    this._lineWidth = Math.max(Math.min(S / 700, 1.8), 0.9);

    this._isCompact = S < 520;
    this._isTiny = S < 420;

    const baseRuneSize = Math.floor(
      this._outerRadius * (this._isCompact ? 0.038 : 0.048),
    );
    this._runeFontSize = Math.max(this._isTiny ? 6 : 8, baseRuneSize);
  }

  private _drawMagicCircle(elapsed: number, implodeScale: number): void {
    const R = Math.max(0, this._outerRadius * implodeScale);
    if (R <= 0.5) return;

    const cx = this._centerX;
    const cy = this._centerY;

    // 6层结构（从外到内）
    const outerBoundaryRadius = R; // Layer 1
    const outerRuneBandOuter = R * 0.97; // Layer 2
    const outerRuneBandInner = R * 0.88;

    const middleSeparatorRadius = R * 0.85; // Layer 3
    const middleRuneBandOuter = R * 0.82; // Layer 4
    const middleRuneBandInner = R * 0.72;

    const hexagramRadius = R * 0.68; // Layer 5

    const innerCircleRadius = R * 0.35; // Layer 6
    const innerStarOuterRadius = R * 0.24;
    const innerStarInnerRadius = innerStarOuterRadius * 0.5;

    const charge = this._chargeProgress;

    const outerBoundaryAlpha = this._lerp(0.56, 0.7, charge);
    const outerBandFillAlpha = this._lerp(0.05, 0.08, charge);
    const outerBandEdgeAlpha = this._lerp(0.38, 0.58, charge);

    const separatorAlpha = this._lerp(0.32, 0.52, charge);
    const separatorTickAlpha = this._lerp(0.24, 0.45, charge);

    const middleBandFillAlpha = this._lerp(0.05, 0.08, charge);
    const middleBandEdgeAlpha = this._lerp(0.32, 0.48, charge);

    const hexagramAlpha = this._lerp(0.28, 0.46, charge);
    const innerAlpha = this._lerp(0.36, 0.54, charge);

    this._drawCenterHalo(implodeScale);

    // Layer 1 - 外边界线
    this._drawCircle(
      cx,
      cy,
      outerBoundaryRadius,
      outerBoundaryAlpha,
      this._layerRotations[0],
      OUTER_RING_COLOR,
      Math.max(1.1, this._lineWidth * 1.35),
    );

    // Layer 2 - 外符文条带（填充 + 双边线）
    this._drawFilledBand(
      cx,
      cy,
      outerRuneBandOuter,
      outerRuneBandInner,
      this._layerRotations[0],
      outerBandFillAlpha,
      OUTER_RING_COLOR,
    );
    this._drawCircle(
      cx,
      cy,
      outerRuneBandOuter,
      outerBandEdgeAlpha,
      this._layerRotations[0],
      OUTER_RING_COLOR,
      Math.max(0.8, this._lineWidth),
    );
    this._drawCircle(
      cx,
      cy,
      outerRuneBandInner,
      outerBandEdgeAlpha * 0.92,
      this._layerRotations[0],
      OUTER_RING_COLOR,
      Math.max(0.8, this._lineWidth),
    );

    // Layer 3 - 中分隔线 + 刻度
    this._drawCircle(
      cx,
      cy,
      middleSeparatorRadius,
      separatorAlpha,
      this._layerRotations[1],
      RUNE_RING_COLOR,
      Math.max(0.8, this._lineWidth),
    );
    this._drawRadialTicks(
      cx,
      cy,
      middleSeparatorRadius,
      this._layerRotations[1],
      this._isCompact ? 54 : 72,
      separatorTickAlpha,
      RUNE_RING_COLOR,
    );

    // Layer 4 - 中符文条带
    this._drawFilledBand(
      cx,
      cy,
      middleRuneBandOuter,
      middleRuneBandInner,
      this._layerRotations[1],
      middleBandFillAlpha,
      RUNE_RING_COLOR,
    );
    this._drawCircle(
      cx,
      cy,
      middleRuneBandOuter,
      middleBandEdgeAlpha,
      this._layerRotations[1],
      RUNE_RING_COLOR,
      Math.max(0.8, this._lineWidth * 0.95),
    );
    this._drawCircle(
      cx,
      cy,
      middleRuneBandInner,
      middleBandEdgeAlpha * 0.9,
      this._layerRotations[1],
      RUNE_RING_COLOR,
      Math.max(0.8, this._lineWidth * 0.95),
    );

    // Layer 5 - 条带状六芒星 + 顶点装饰
    this._drawDoubleHexagram(
      cx,
      cy,
      hexagramRadius,
      this._layerRotations[2],
      hexagramAlpha,
    );

    // Layer 6 - 内环 + 核心八角星/十字
    this._drawCircle(
      cx,
      cy,
      innerCircleRadius,
      innerAlpha,
      this._layerRotations[3],
      CENTER_CORE_COLOR,
      Math.max(0.9, this._lineWidth * 1.05),
    );

    if (this._isTiny) {
      const pulseScale = 1 + 0.02 * Math.sin(elapsed * 0.0022);
      const crossHalf = innerStarOuterRadius * 0.72 * pulseScale;

      this._graphics.lineStyle(
        Math.max(0.75, this._lineWidth),
        CENTER_CORE_COLOR,
        this._clamp01(innerAlpha),
      );

      const [hStartX, hStartY] = this._rotatePoint(
        cx - crossHalf,
        cy,
        cx,
        cy,
        this._layerRotations[3],
      );
      const [hEndX, hEndY] = this._rotatePoint(
        cx + crossHalf,
        cy,
        cx,
        cy,
        this._layerRotations[3],
      );
      const [vStartX, vStartY] = this._rotatePoint(
        cx,
        cy - crossHalf,
        cx,
        cy,
        this._layerRotations[3],
      );
      const [vEndX, vEndY] = this._rotatePoint(
        cx,
        cy + crossHalf,
        cx,
        cy,
        this._layerRotations[3],
      );

      this._graphics.moveTo(hStartX, hStartY);
      this._graphics.lineTo(hEndX, hEndY);
      this._graphics.moveTo(vStartX, vStartY);
      this._graphics.lineTo(vEndX, vEndY);
    } else {
      this._drawStar(
        cx,
        cy,
        innerStarOuterRadius,
        innerStarInnerRadius,
        8,
        this._layerRotations[3],
        innerAlpha,
        CENTER_CORE_COLOR,
      );
    }

    const corePulse = 1 + Math.sin(elapsed * 0.0034 + charge * Math.PI) * 0.08;
    const coreRadius = Math.max(2, innerCircleRadius * 0.12 * corePulse);
    this._graphics.beginFill(
      CENTER_CORE_COLOR,
      this._clamp01(this._lerp(0.22, 0.4, charge)),
    );
    this._graphics.drawCircle(cx, cy, coreRadius);
    this._graphics.endFill();
  }

  private _syncRuneSprites(implodeScale: number, combinedAlpha: number): void {
    const showRunes = !this._isTiny && combinedAlpha > MIN_VISIBLE_ALPHA;

    if (this._outerRuneSprite) {
      this._outerRuneSprite.visible = showRunes;
      this._outerRuneSprite.position.set(this._centerX, this._centerY);
      this._outerRuneSprite.rotation = this._layerRotations[0];
      this._outerRuneSprite.scale.set(implodeScale);
      this._outerRuneSprite.alpha = this._clamp01(
        this._lerp(0.62, 0.82, this._chargeProgress),
      );
    }

    if (this._middleRuneSprite) {
      this._middleRuneSprite.visible = showRunes;
      this._middleRuneSprite.position.set(this._centerX, this._centerY);
      this._middleRuneSprite.rotation = this._layerRotations[1];
      this._middleRuneSprite.scale.set(implodeScale);
      this._middleRuneSprite.alpha = this._clamp01(
        this._lerp(0.58, 0.76, this._chargeProgress),
      );
    }
  }

  private _drawFilledBand(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    rotation: number,
    fillAlpha: number,
    color: number,
  ): void {
    if (outerR <= innerR || innerR <= 0) return;

    const clampedAlpha = this._clamp01(fillAlpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const startAngle = rotation;
    const endAngle = rotation + TAU;

    const outerStartX = cx + Math.cos(startAngle) * outerR;
    const outerStartY = cy + Math.sin(startAngle) * outerR;
    const innerStartX = cx + Math.cos(startAngle) * innerR;
    const innerStartY = cy + Math.sin(startAngle) * innerR;

    this._graphics.beginFill(color, clampedAlpha);
    this._graphics.moveTo(outerStartX, outerStartY);
    this._graphics.arc(cx, cy, outerR, startAngle, endAngle);
    this._graphics.lineTo(innerStartX, innerStartY);
    this._graphics.arc(cx, cy, innerR, endAngle, startAngle, true);
    this._graphics.lineTo(outerStartX, outerStartY);
    this._graphics.endFill();
  }

  private _drawRadialTicks(
    cx: number,
    cy: number,
    radius: number,
    rotation: number,
    count: number,
    alpha: number,
    color = RUNE_RING_COLOR,
  ): void {
    if (count <= 0 || radius <= 0.5) return;

    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const step = TAU / count;
    const minorLength = this._isCompact ? 5 : 8;
    const majorLength = this._isCompact ? 9 : 12;
    const majorDotRadius = this._isTiny ? 0.85 : 1.2;

    this._graphics.lineStyle(
      Math.max(0.55, this._lineWidth * 0.58),
      color,
      this._clamp01(clampedAlpha * 0.98),
    );

    this._graphics.beginFill(color, this._clamp01(clampedAlpha * 0.55));

    for (let index = 0; index < count; index += 1) {
      const angle = rotation + index * step;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const isMajor = index % 6 === 0;
      const length = isMajor ? majorLength : minorLength;
      const innerR = Math.max(0, radius - length);

      this._graphics.moveTo(cx + cos * radius, cy + sin * radius);
      this._graphics.lineTo(cx + cos * innerR, cy + sin * innerR);

      if (!isMajor) continue;
      this._graphics.drawCircle(
        cx + cos * innerR,
        cy + sin * innerR,
        majorDotRadius,
      );
    }

    this._graphics.endFill();
  }

  private _drawDoubleHexagram(
    cx: number,
    cy: number,
    radius: number,
    rotation: number,
    alpha: number,
  ): void {
    if (radius <= 0.5) return;

    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const baseRotation = rotation + Math.PI / 6; // 30°偏移
    const bandWidth = Math.max(
      this._isTiny ? 4 : 6,
      Math.min(16, radius * (this._isCompact ? 0.105 : 0.095)),
    );
    const fillAlpha = this._clamp01(clampedAlpha * 0.34);
    const edgeAlpha = this._clamp01(clampedAlpha * 1.28);
    const edgeWidth = Math.max(0.85, this._lineWidth * 1.05);

    // 简化交错策略：先绘制上三角，再绘制下三角，后绘制者覆盖前者
    this._drawBandTriangle(
      cx,
      cy,
      radius,
      baseRotation,
      bandWidth,
      fillAlpha,
      edgeAlpha,
      edgeWidth,
    );
    this._drawBandTriangle(
      cx,
      cy,
      radius,
      baseRotation + Math.PI,
      bandWidth,
      fillAlpha,
      edgeAlpha,
      edgeWidth,
    );

    this._drawHexagramVertexDots(
      cx,
      cy,
      radius + bandWidth * 0.95,
      baseRotation,
      clampedAlpha * 0.95,
    );
  }

  private _drawBandTriangle(
    cx: number,
    cy: number,
    radius: number,
    rotation: number,
    bandWidth: number,
    fillAlpha: number,
    edgeAlpha: number,
    edgeWidth: number,
  ): void {
    if (radius <= 0.5 || bandWidth <= 0.1) return;

    const clampedFillAlpha = this._clamp01(fillAlpha);
    const clampedEdgeAlpha = this._clamp01(edgeAlpha);
    if (
      clampedFillAlpha <= MIN_VISIBLE_ALPHA &&
      clampedEdgeAlpha <= MIN_VISIBLE_ALPHA
    ) {
      return;
    }

    // 宽描边模拟条带主体（miter 连接形成尖角）
    if (clampedFillAlpha > MIN_VISIBLE_ALPHA) {
      this._drawRegularPolygon(
        cx,
        cy,
        radius,
        3,
        rotation,
        clampedFillAlpha,
        RUNE_RING_COLOR,
        bandWidth,
      );
    }

    // 条带外边界线
    if (clampedEdgeAlpha > MIN_VISIBLE_ALPHA) {
      this._drawRegularPolygon(
        cx,
        cy,
        radius + bandWidth,
        3,
        rotation,
        clampedEdgeAlpha,
        OUTER_RING_COLOR,
        edgeWidth,
      );

      // 条带内边界线
      const innerEdgeRadius = Math.max(radius - bandWidth, 0.5);
      if (innerEdgeRadius > 0.5) {
        this._drawRegularPolygon(
          cx,
          cy,
          innerEdgeRadius,
          3,
          rotation,
          clampedEdgeAlpha * 0.62,
          OUTER_RING_COLOR,
          edgeWidth,
        );
      }
    }
  }

  private _drawHexagramVertexDots(
    cx: number,
    cy: number,
    radius: number,
    rotation: number,
    alpha: number,
  ): void {
    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const dotRadius = this._isTiny ? 1.2 : 1.8;
    const step = TAU / 3;

    this._graphics.beginFill(
      OUTER_RING_COLOR,
      this._clamp01(clampedAlpha * 0.9),
    );

    for (let index = 0; index < 3; index += 1) {
      const angle = -Math.PI * 0.5 + index * step;

      const [ax, ay] = this._rotatePoint(
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
        cx,
        cy,
        rotation,
      );
      const [bx, by] = this._rotatePoint(
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
        cx,
        cy,
        rotation + Math.PI,
      );

      this._graphics.drawCircle(ax, ay, dotRadius);
      this._graphics.drawCircle(bx, by, dotRadius);
    }

    this._graphics.endFill();
  }

  private _createArcTextTexture(
    id: string,
    text: string,
    radius: number,
    fontSize: number,
    color: string,
    clockwise = true,
  ): Texture {
    const key = [
      id,
      Math.round(radius),
      fontSize,
      clockwise ? "cw" : "ccw",
      this._isCompact ? "compact" : "normal",
    ].join(":");

    const cached = this._runeTextures.get(key);
    if (cached) return cached;

    const padding = Math.ceil(fontSize * 2.8);
    const canvasSize = Math.max(64, Math.ceil(radius * 2 + padding * 2));
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      const fallbackTexture = Texture.from(canvas);
      this._runeTextures.set(key, fallbackTexture);
      return fallbackTexture;
    }

    const centerX = canvasSize * 0.5;
    const centerY = canvasSize * 0.5;

    const loopedText = this._buildLoopRuneText(ctx2d, text, radius, fontSize);

    this._renderArcText(
      ctx2d,
      loopedText,
      centerX,
      centerY,
      radius,
      -Math.PI * 0.5,
      fontSize,
      color,
      clockwise,
    );

    const texture = Texture.from(canvas);
    this._runeTextures.set(key, texture);
    return texture;
  }

  private _buildLoopRuneText(
    ctx2d: CanvasRenderingContext2D,
    text: string,
    radius: number,
    fontSize: number,
  ): string {
    ctx2d.font = `${fontSize}px ${RUNE_FONT}`;

    const normalizedText = text.trim().replace(/\s+/g, " ");
    const segment = `${normalizedText}${RUNE_SEGMENT_SEPARATOR}`;
    const targetCoverage = TAU * 1.02;

    let result = segment;
    let coverage = this._measureRuneTextAngle(ctx2d, result, radius, fontSize);
    let guard = 0;

    while (coverage < targetCoverage && guard < 24) {
      result += segment;
      coverage = this._measureRuneTextAngle(ctx2d, result, radius, fontSize);
      guard += 1;
    }

    return result;
  }

  private _renderArcText(
    ctx2d: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    fontSize: number,
    color: string,
    clockwise = true,
  ): void {
    ctx2d.save();
    ctx2d.font = `${fontSize}px ${RUNE_FONT}`;
    ctx2d.fillStyle = color;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.shadowColor = color;
    ctx2d.shadowBlur = Math.max(1, fontSize * 0.2);

    const chars = text.split("");
    const charAngles: number[] = [];
    for (const char of chars) {
      charAngles.push(
        this._measureRuneCharAngle(ctx2d, char, radius, fontSize),
      );
    }

    const totalAngle = charAngles.reduce((sum, angle) => sum + angle, 0);
    let currentAngle =
      startAngle - (clockwise ? totalAngle * 0.5 : -totalAngle * 0.5);

    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      const halfAngle = charAngles[index] * 0.5;
      currentAngle += clockwise ? halfAngle : -halfAngle;

      ctx2d.save();
      ctx2d.translate(centerX, centerY);
      ctx2d.rotate(currentAngle);
      ctx2d.translate(0, -radius);
      if (!clockwise) {
        ctx2d.rotate(Math.PI);
      }
      ctx2d.fillText(char, 0, 0);
      ctx2d.restore();

      currentAngle += clockwise ? halfAngle : -halfAngle;
    }

    ctx2d.restore();
  }

  private _measureRuneTextAngle(
    ctx2d: CanvasRenderingContext2D,
    text: string,
    radius: number,
    fontSize: number,
  ): number {
    let totalAngle = 0;
    for (const char of text) {
      totalAngle += this._measureRuneCharAngle(ctx2d, char, radius, fontSize);
    }
    return totalAngle;
  }

  private _measureRuneCharAngle(
    ctx2d: CanvasRenderingContext2D,
    char: string,
    radius: number,
    fontSize: number,
  ): number {
    const safeRadius = Math.max(1, radius);
    const measured = Math.max(fontSize * 0.28, ctx2d.measureText(char).width);
    const spacingMultiplier = char === " " ? 1.45 : 1.14;
    const baseSpacing = measured * spacingMultiplier;
    const extraSpacingPx = Math.max(
      0.8,
      fontSize * (this._isCompact ? 0.13 : 0.16),
    );

    return (baseSpacing + extraSpacingPx) / safeRadius;
  }

  private _initRuneSprites(): void {
    this._destroyRuneSprites();

    if (this._isTiny) return;

    const outerRuneRadius = this._outerRadius * 0.925;
    const middleRuneRadius = this._outerRadius * 0.77;

    const outerFontSize = this._isCompact
      ? Math.max(6, this._runeFontSize - 3)
      : Math.max(7, this._runeFontSize - 1);
    const middleFontSize = Math.max(6, outerFontSize - 1);

    const outerTexture = this._createArcTextTexture(
      "outer",
      OUTER_RUNE_TEXT,
      outerRuneRadius,
      outerFontSize,
      OUTER_RUNE_TEXT_COLOR,
      true,
    );
    const middleTexture = this._createArcTextTexture(
      "middle",
      INNER_RUNE_TEXT,
      middleRuneRadius,
      middleFontSize,
      INNER_RUNE_TEXT_COLOR,
      false,
    );

    const outerSprite = new Sprite(outerTexture);
    outerSprite.anchor.set(0.5);
    outerSprite.position.set(this._centerX, this._centerY);

    const middleSprite = new Sprite(middleTexture);
    middleSprite.anchor.set(0.5);
    middleSprite.position.set(this._centerX, this._centerY);

    this._container.addChild(outerSprite);
    this._container.addChild(middleSprite);

    this._outerRuneSprite = outerSprite;
    this._middleRuneSprite = middleSprite;
  }

  private _destroyRuneSprites(): void {
    if (this._outerRuneSprite) {
      this._outerRuneSprite.removeFromParent();
      this._outerRuneSprite.destroy();
      this._outerRuneSprite = null;
    }

    if (this._middleRuneSprite) {
      this._middleRuneSprite.removeFromParent();
      this._middleRuneSprite.destroy();
      this._middleRuneSprite = null;
    }
  }

  private _destroyRuneTextures(): void {
    for (const texture of this._runeTextures.values()) {
      texture.destroy(true);
    }
    this._runeTextures.clear();
  }

  /** 绘制圆环 */
  private _drawCircle(
    cx: number,
    cy: number,
    radius: number,
    alpha: number,
    rotation = 0,
    color = OUTER_RING_COLOR,
    lineWidth = this._lineWidth,
  ): void {
    if (radius <= 0.5) return;

    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const startX = cx + Math.cos(rotation) * radius;
    const startY = cy + Math.sin(rotation) * radius;

    this._graphics.lineStyle(Math.max(0.55, lineWidth), color, clampedAlpha);
    this._graphics.moveTo(startX, startY);
    this._graphics.arc(cx, cy, radius, rotation, rotation + TAU);
  }

  /** 绘制正多边形（三角形、六边形等） */
  private _drawRegularPolygon(
    cx: number,
    cy: number,
    radius: number,
    sides: number,
    rotation: number,
    alpha: number,
    color = OUTER_RING_COLOR,
    lineWidth = this._lineWidth,
  ): void {
    if (sides < 3 || radius <= 0.5) return;

    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const step = TAU / sides;
    const points: Array<[number, number]> = [];

    for (let index = 0; index < sides; index += 1) {
      const angle = -Math.PI * 0.5 + index * step;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      points.push(this._rotatePoint(x, y, cx, cy, rotation));
    }

    this._graphics.lineStyle(Math.max(0.55, lineWidth), color, clampedAlpha);
    this._graphics.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) {
      this._graphics.lineTo(points[index][0], points[index][1]);
    }
    this._graphics.lineTo(points[0][0], points[0][1]);
  }

  /** 绘制星形（n角星，通过内外半径交替） */
  private _drawStar(
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    points: number,
    rotation: number,
    alpha: number,
    color = CENTER_CORE_COLOR,
    lineWidth = this._lineWidth,
  ): void {
    if (points < 2 || outerRadius <= 0.5 || innerRadius <= 0.1) return;

    const clampedAlpha = this._clamp01(alpha);
    if (clampedAlpha <= MIN_VISIBLE_ALPHA) return;

    const vertices: Array<[number, number]> = [];
    const step = Math.PI / points;

    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI * 0.5 + index * step;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      vertices.push(this._rotatePoint(x, y, cx, cy, rotation));
    }

    this._graphics.lineStyle(Math.max(0.55, lineWidth), color, clampedAlpha);
    this._graphics.moveTo(vertices[0][0], vertices[0][1]);
    for (let index = 1; index < vertices.length; index += 1) {
      this._graphics.lineTo(vertices[index][0], vertices[index][1]);
    }
    this._graphics.lineTo(vertices[0][0], vertices[0][1]);
  }

  private _drawCenterHalo(implodeScale: number): void {
    const glowProgress = this._isImploding
      ? Math.max(this._chargeProgress, 1 - this._implodeProgress)
      : this._chargeProgress;
    const haloBaseAlpha = this._lerp(0.04, 0.16, this._clamp01(glowProgress));

    for (let index = HALO_RADII.length - 1; index >= 0; index -= 1) {
      const radius = HALO_RADII[index] * implodeScale;
      if (radius <= 0.5) continue;

      const alpha = haloBaseAlpha * HALO_ALPHA_WEIGHTS[index];
      if (alpha <= MIN_VISIBLE_ALPHA) continue;

      this._graphics.beginFill(HALO_COLOR, this._clamp01(alpha));
      this._graphics.drawCircle(this._centerX, this._centerY, radius);
      this._graphics.endFill();
    }
  }

  private _rotatePoint(
    x: number,
    y: number,
    cx: number,
    cy: number,
    angle: number,
  ): [number, number] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }

  private _lerp(from: number, to: number, t: number): number {
    return from + (to - from) * this._clamp01(t);
  }

  private _clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
