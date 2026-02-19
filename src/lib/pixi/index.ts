/**
 * PixiJS 导出模块 (v7)
 * 用于集中管理 PixiJS 相关导出
 *
 * 所有 PixiJS 相关导入应该通过此模块，确保松耦合架构
 *
 * 注意: @pixi/react 与 React 19 不兼容，已移除
 * 使用命令式 API 直接操作 PixiJS
 */

// 核心导出 - 常用类型
export {
  Application,
  Container,
  Graphics,
  Point,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";

// 类型导出
export type { Filter } from "pixi.js";
export type PointData = { x: number; y: number };

// 滤镜导出 - v7 从主包导入
export { CRTFilter, GlitchFilter, RGBSplitFilter } from "pixi-filters";

// 自定义滤镜
export { AngryNoiseFilter } from "./AngryNoiseFilter";
