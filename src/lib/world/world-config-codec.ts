/**
 * WorldConfig ↔ Y.Map 编解码
 *
 * 设计决策：WorldConfig 属于「创建时写入、运行时多次读取」的静态快照，
 * 不需要字段级 CRDT 合并，因此统一序列化为 JSON 字符串存储。
 */

import * as Y from "yjs";

import type { WorldConfig } from "./types";

const WORLD_CONFIG_SNAPSHOT_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorldConfig(value: unknown): value is WorldConfig {
  if (!isRecord(value)) return false;

  return (
    value.version === 1 &&
    Array.isArray(value.primaryAttributes) &&
    Array.isArray(value.derivedStats) &&
    isRecord(value.checkRules)
  );
}

/**
 * 将 WorldConfig 序列化为 Y.Map
 *
 * 存储结构：
 * - version: 快照格式版本
 * - data: WorldConfig JSON 字符串
 */
export function worldConfigToYMap(config: WorldConfig): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set("version", WORLD_CONFIG_SNAPSHOT_VERSION);
  map.set("data", JSON.stringify(config));
  return map;
}

/**
 * 从 Y.Map 反序列化 WorldConfig
 *
 * 反序列化失败（版本不匹配、JSON 非法、结构不合法）时返回 null。
 */
export function worldConfigFromYMap(map: Y.Map<unknown>): WorldConfig | null {
  const version = map.get("version");
  const data = map.get("data");

  if (version !== WORLD_CONFIG_SNAPSHOT_VERSION) return null;
  if (typeof data !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(data);
    if (!isWorldConfig(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
