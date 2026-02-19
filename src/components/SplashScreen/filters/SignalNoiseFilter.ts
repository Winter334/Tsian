import { Filter } from "pixi.js";

interface SignalNoiseUniforms {
  uTime: number;
  uIntensity: number;
  uClearCenter: Float32Array;
  uClearRadius: number;
  uScanRingWidth: number;
  uScanRingColor: Float32Array;
  uNoiseScale: number;
  uFlickerSpeed: number;
}

const fragmentShader = `
  precision highp float;

  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;

  uniform vec4 inputSize;
  uniform vec4 outputFrame;

  uniform float uTime;
  uniform float uIntensity;
  uniform vec2 uClearCenter;
  uniform float uClearRadius;
  uniform float uScanRingWidth;
  uniform vec3 uScanRingColor;
  uniform float uNoiseScale;
  uniform float uFlickerSpeed;

  // 快速 hash：用于生成 TV 雪花噪声
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // TV 静态噪声（高频闪烁 + 线状干扰）
  float tvStaticNoise(vec2 fragPx, float time) {
    float frame = floor(time * uFlickerSpeed * 60.0);
    float scale = max(0.05, uNoiseScale);

    vec2 px = floor(fragPx * scale);
    float frameSeed = hash12(vec2(frame * 0.123, frame * 1.713));

    float n1 = hash13(vec3(px, frameSeed));
    float n2 = hash13(vec3(px * 1.37 + vec2(17.0, 59.0), frameSeed * 1.19 + 0.17));
    float n3 = hash13(vec3(px * 0.71 + vec2(131.0, 17.0), frameSeed * 2.41 + 0.37));

    float grain = n1 * 0.58 + n2 * 0.32 + n3 * 0.10;
    float sparkle = step(0.935, n3) * 0.28;

    float lineIndex = floor(fragPx.y * 0.5);
    float lineNoise = hash12(vec2(lineIndex, frameSeed * 241.17));
    float scanInterference = (lineNoise - 0.5) * 0.16;

    return clamp(grain + sparkle + scanInterference, 0.0, 1.0);
  }

  // 扫描环（内外柔和渐变 + 光晕）
  float scanRingGlow(float dist, float radius, float ringWidth) {
    float w = max(ringWidth, 0.5);
    float edge = abs(dist - radius);

    float core = 1.0 - smoothstep(0.0, w, edge);
    float glow = 1.0 - smoothstep(w, w * 4.0, edge);

    return core * 0.9 + glow * 0.45;
  }

  void main() {
    vec2 uv = vTextureCoord;
    vec4 original = texture2D(uSampler, uv);

    // 基于 Pixi 内置 inputSize/outputFrame 计算坐标，避免移动端 filterArea 映射偏移
    vec2 frameSize = max(outputFrame.zw, vec2(1.0));
    vec2 centerUv = clamp(uClearCenter, vec2(0.0), vec2(1.0));
    vec2 fragPx = uv * inputSize.xy;
    vec2 centerPx = centerUv * frameSize;
    float distPx = length(fragPx - centerPx);

    float minDim = max(min(frameSize.x, frameSize.y), 1.0);
    float transitionWidthPx = 3.0;
    float radiusPx = max(uClearRadius, 0.0) * minDim;

    // 半径为 0 时按“全噪声”处理；半径增大后再进入正常清除逻辑
    float clearMask = smoothstep(radiusPx, radiusPx + transitionWidthPx, distPx);
    clearMask = mix(1.0, clearMask, step(0.0001, radiusPx));

    float noiseValue = tvStaticNoise(fragPx, uTime);
    vec3 noiseColor = vec3(noiseValue) * 0.3;

    float intensity = clamp(uIntensity, 0.0, 1.0);
    float noiseMix = clearMask * intensity;
    vec3 mixedColor = mix(original.rgb, noiseColor, noiseMix);

    float ringWidthPx = max(uScanRingWidth * minDim, 0.5);
    float ringStrength = pow(intensity, 3.0);
    float ring =
      scanRingGlow(distPx, radiusPx, ringWidthPx) *
      step(0.0001, radiusPx) *
      ringStrength;
    mixedColor += uScanRingColor * ring;

    gl_FragColor = vec4(clamp(mixedColor, 0.0, 1.0), original.a);
  }
`;

export class SignalNoiseFilter extends Filter {
  private _time: number = 0;
  private _intensity: number = 1;
  private _clearRadius: number = 0;

  constructor() {
    super(undefined, fragmentShader, {
      uTime: 0,
      uIntensity: 1,
      uClearCenter: new Float32Array([0.5, 0.5]),
      uClearRadius: 0,
      uScanRingWidth: 0.015,
      uScanRingColor: new Float32Array([0.0, 0.9, 0.8]),
      uNoiseScale: 1,
      uFlickerSpeed: 1,
    });
  }

  private get uniformsRef(): SignalNoiseUniforms {
    return this.uniforms as unknown as SignalNoiseUniforms;
  }

  get time(): number {
    return this._time;
  }

  set time(value: number) {
    this._time = value;
    this.uniformsRef.uTime = value;
  }

  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    const clamped = Math.min(1, Math.max(0, value));
    this._intensity = clamped;
    this.uniformsRef.uIntensity = clamped;
  }

  get clearRadius(): number {
    return this._clearRadius;
  }

  set clearRadius(value: number) {
    const radius = Math.max(0, value);
    this._clearRadius = radius;
    this.uniformsRef.uClearRadius = radius;
  }

  setClearCenter(x: number, y: number): void {
    const center = this.uniformsRef.uClearCenter;
    center[0] = Math.min(1, Math.max(0, x));
    center[1] = Math.min(1, Math.max(0, y));
  }

  get noiseScale(): number {
    return this.uniformsRef.uNoiseScale;
  }

  set noiseScale(value: number) {
    this.uniformsRef.uNoiseScale = Math.max(0.05, value);
  }

  get flickerSpeed(): number {
    return this.uniformsRef.uFlickerSpeed;
  }

  set flickerSpeed(value: number) {
    this.uniformsRef.uFlickerSpeed = Math.max(0.01, value);
  }

  get scanRingWidth(): number {
    return this.uniformsRef.uScanRingWidth;
  }

  set scanRingWidth(value: number) {
    this.uniformsRef.uScanRingWidth = Math.max(0.0005, value);
  }

  setScanRingColor(r: number, g: number, b: number): void {
    const color = this.uniformsRef.uScanRingColor;
    color[0] = Math.min(1, Math.max(0, r));
    color[1] = Math.min(1, Math.max(0, g));
    color[2] = Math.min(1, Math.max(0, b));
  }
}
