/**
 * 愤怒噪声滤镜 (Angry Noise Filter)
 * 基于 Piter Pasma 的 Genuary 2026 logo 效果
 *
 * 核心效果：
 * - 白色核心 + 粗黑色描边
 * - 青色/品红色喷溅边缘（破碎噪声轮廓）
 * - 多层采样产生分层的"愤怒"边缘
 */
import { Filter } from "pixi.js";

// 片段着色器 - 匹配 Genuary 2026 logo 风格
const fragmentShader = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec2 uDimensions;
  
  // 颜色层
  uniform vec3 uColor1;  // 青色层（最外层喷溅）
  uniform vec3 uColor2;  // 品红层（中层喷溅）
  uniform vec3 uColor3;  // 白色层（核心）
  
  // 噪声偏移
  uniform vec2 uOffset1;
  uniform vec2 uOffset2;
  uniform vec2 uOffset3;
  
  // 边缘参数
  uniform float uEdgeThickness;
  uniform float uSplashSpread;
  uniform float uNoiseScale;

  // 简单哈希
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // 噪声
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // 分形噪声
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // 愤怒噪声位移
  vec2 angryDisplace(vec2 uv, float time, float scale, vec2 offset) {
    vec2 p = uv * scale + offset;
    float n1 = fbm(p + time * 0.2);
    float n2 = fbm(p + vec2(5.2, 1.3) + time * 0.15);
    
    float displaceX = (n1 - 0.5) * 2.0;
    float displaceY = (n2 - 0.5) * 2.0;
    
    // 高频噪声产生破碎边缘
    float hf = fbm(p * 3.0 + time * 0.3);
    displaceX += (hf - 0.5) * 0.8;
    displaceY += (hf - 0.5) * 0.8;
    
    return vec2(displaceX, displaceY);
  }

  void main() {
    vec2 uv = vTextureCoord;
    float t = uTime;
    
    vec2 pixelSize = 1.0 / uDimensions;
    
    // 基础位移强度
    float baseDisplace = uIntensity * uSplashSpread * 0.003;
    
    // 三层采样 - 不同的噪声位移
    // 外层（青色）- 最大位移
    vec2 disp1 = angryDisplace(uv, t, 6.0 * uNoiseScale, uOffset1) * baseDisplace * 2.0;
    vec4 layer1 = texture2D(uSampler, uv + disp1);
    
    // 中层（品红）
    vec2 disp2 = angryDisplace(uv, t * 1.1, 8.0 * uNoiseScale, uOffset2) * baseDisplace * 1.5;
    vec4 layer2 = texture2D(uSampler, uv + disp2);
    
    // 内层（黑色轮廓）- 轻微位移
    vec2 disp3 = angryDisplace(uv, t * 0.9, 10.0 * uNoiseScale, uOffset3) * baseDisplace * 0.5;
    vec4 layer3 = texture2D(uSampler, uv + disp3);
    
    // 原始层
    vec4 original = texture2D(uSampler, uv);
    
    // 检测边缘 - 采样周围像素来创建描边效果
    float strokeWidth = uEdgeThickness * 1.5;
    float strokeAlpha = 0.0;
    for(float dy = -1.0; dy <= 1.0; dy += 1.0) {
      for(float dx = -1.0; dx <= 1.0; dx += 1.0) {
        if(dx == 0.0 && dy == 0.0) continue;
        vec2 offset = vec2(dx, dy) * pixelSize * strokeWidth;
        strokeAlpha = max(strokeAlpha, texture2D(uSampler, uv + offset).a);
      }
    }
    
    // 组合颜色
    vec3 finalColor = vec3(0.0);
    float finalAlpha = 0.0;
    
    // 外层青色
    if (layer1.a > 0.1) {
      finalColor = uColor1;
      finalAlpha = layer1.a;
    }
    
    // 中层品红
    if (layer2.a > 0.1) {
      finalColor = mix(finalColor, uColor2, layer2.a * 0.9);
      finalAlpha = max(finalAlpha, layer2.a);
    }
    
    // 黑色描边层 - 在彩色喷溅和白色核心之间
    // 使用 strokeAlpha（周围像素）但排除当前像素
    float strokeMask = strokeAlpha - original.a * 0.3;
    if (strokeMask > 0.2) {
      float blackBlend = smoothstep(0.2, 0.6, strokeMask);
      finalColor = mix(finalColor, vec3(0.0), blackBlend * 0.95);
      finalAlpha = max(finalAlpha, strokeMask);
    }
    
    // 内层黑色轮廓
    if (layer3.a > 0.2) {
      finalColor = mix(finalColor, vec3(0.0), layer3.a * 0.9);
      finalAlpha = max(finalAlpha, layer3.a);
    }
    
    // 原始层 - 先绘制黑色描边环
    if (original.a > 0.2 && original.a < 0.85) {
      // 这是边缘区域 - 绘制黑色
      float edgeBlend = smoothstep(0.2, 0.5, original.a) * (1.0 - smoothstep(0.6, 0.85, original.a));
      finalColor = mix(finalColor, vec3(0.0), edgeBlend * 0.95);
      finalAlpha = max(finalAlpha, original.a);
    }
    
    // 白色核心 - 只有最内部才是白色
    if (original.a > 0.7) {
      float core = smoothstep(0.7, 0.95, original.a);
      finalColor = mix(finalColor, uColor3, core);
      finalAlpha = max(finalAlpha, original.a);
    }
    
    // 轻微闪烁
    float flicker = 0.96 + 0.04 * sin(t * 10.0 + uv.x * 6.0);
    finalColor *= flicker;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export class AngryNoiseFilter extends Filter {
  private _time: number = 0;
  private _intensity: number = 1.0;
  private _basePhases: {
    offset1: number[];
    offset2: number[];
    offset3: number[];
  };

  constructor() {
    super(undefined, fragmentShader, {
      uTime: 0,
      uIntensity: 1.0,
      uDimensions: [800, 200],
      uColor1: [0.0, 0.33, 1.0], // 青色（匹配示例 vec3(0, .33, 1)）
      uColor2: [1.0, 0.0, 0.33], // 品红（匹配示例 vec3(1, 0, .33)）
      uColor3: [1.0, 1.0, 1.0], // 白色
      uOffset1: [0, 0],
      uOffset2: [0, 0],
      uOffset3: [0, 0],
      uEdgeThickness: 3.0,
      uSplashSpread: 8.0,
      uNoiseScale: 1.0,
    });

    // 初始化随机偏移
    this._basePhases = {
      offset1: [Math.random() * 100, Math.random() * 100],
      offset2: [Math.random() * 100, Math.random() * 100],
      offset3: [Math.random() * 100, Math.random() * 100],
    };

    this.uniforms.uOffset1 = this._basePhases.offset1;
    this.uniforms.uOffset2 = this._basePhases.offset2;
    this.uniforms.uOffset3 = this._basePhases.offset3;
  }

  /**
   * 更新时间（用于动画）
   */
  get time(): number {
    return this._time;
  }

  set time(value: number) {
    this._time = value;
    this.uniforms.uTime = value;

    // 更新偏移（随时间缓慢变化，产生动态破碎感）
    const t = value * 0.05;
    this.uniforms.uOffset1 = [
      this._basePhases.offset1[0] + t * 1.0,
      this._basePhases.offset1[1] + t * 0.7,
    ];
    this.uniforms.uOffset2 = [
      this._basePhases.offset2[0] + t * 0.8,
      this._basePhases.offset2[1] + t * 1.1,
    ];
    this.uniforms.uOffset3 = [
      this._basePhases.offset3[0] + t * 1.2,
      this._basePhases.offset3[1] + t * 0.9,
    ];
  }

  /**
   * 效果强度
   */
  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    this._intensity = value;
    this.uniforms.uIntensity = value;
  }

  /**
   * 设置分辨率
   */
  setResolution(width: number, height: number): void {
    this.uniforms.uDimensions = [width, height];
  }

  /**
   * 设置颜色
   */
  setColors(color1: number[], color2: number[], color3: number[]): void {
    this.uniforms.uColor1 = color1;
    this.uniforms.uColor2 = color2;
    this.uniforms.uColor3 = color3;
  }

  /**
   * 设置边缘参数
   */
  setEdgeParams(thickness: number, spread: number, noiseScale: number): void {
    this.uniforms.uEdgeThickness = thickness;
    this.uniforms.uSplashSpread = spread;
    this.uniforms.uNoiseScale = noiseScale;
  }

  /**
   * 设置喷溅扩散范围
   */
  set splashSpread(value: number) {
    this.uniforms.uSplashSpread = value;
  }

  get splashSpread(): number {
    return this.uniforms.uSplashSpread;
  }

  /**
   * 设置噪声缩放
   */
  set noiseScale(value: number) {
    this.uniforms.uNoiseScale = value;
  }

  get noiseScale(): number {
    return this.uniforms.uNoiseScale;
  }
}
