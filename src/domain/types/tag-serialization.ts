/**
 * TagMetadata 序列化/反序列化工具
 *
 * Yjs 的 Y.Map 只能存储原始值和普通对象，不能存储 JavaScript Map。
 * 这些工具函数在 Map<string, TagMetadata> 和 Record<string, unknown>
 * 之间进行转换，确保标签元数据可以安全地存储到 Yjs 并从中恢复。
 *
 * @module domain/types/tag-serialization
 */

import type { TagMetadata } from "./result-frame";
import type { ConditionTrigger } from "./rule-script";

/**
 * 将 Map<string, TagMetadata> 序列化为 Yjs 兼容的普通对象
 *
 * Yjs 的 Y.Map 只能存储原始值和普通对象，不能存储 JavaScript Map。
 * 此函数将 Map 转换为 Record<string, object> 供 Yjs 存储。
 *
 * TagMetadata 内部的 trigger 字段（ConditionTrigger）本身就是
 * 纯 JSON 兼容的对象层级（没有 Map/Set），可以直接存储。
 */
export function serializeTagsForYjs(
  tags: Map<string, TagMetadata>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, meta] of tags) {
    // 使用展开运算符创建浅拷贝，TagMetadata 的所有字段
    // 都是原始值或纯对象（trigger/actions），无需深拷贝
    result[key] = { ...meta };
  }
  return result;
}

/**
 * 从 Yjs 存储的普通对象反序列化为 Map<string, TagMetadata>
 *
 * 对每个条目进行类型安全的字段提取，确保恢复的 TagMetadata
 * 结构完整。缺失的可选字段不会被填充，保持 undefined。
 */
export function deserializeTagsFromYjs(
  raw: Record<string, unknown> | undefined | null
): Map<string, TagMetadata> {
  const tags = new Map<string, TagMetadata>();
  if (!raw || typeof raw !== "object") return tags;

  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const meta = value as Record<string, unknown>;
      const tagMetadata: TagMetadata = {
        id: typeof meta.id === "string" ? meta.id : key,
        displayName:
          typeof meta.displayName === "string" ? meta.displayName : key,
        effectDescription:
          typeof meta.effectDescription === "string"
            ? meta.effectDescription
            : "",
        source:
          meta.source === "predefined" || meta.source === "ai-generated"
            ? meta.source
            : "ai-generated",
      };

      // 可选字段：只在存在时设置
      if (meta.trigger && typeof meta.trigger === "object") {
        tagMetadata.trigger = meta.trigger as ConditionTrigger;
      }
      if (typeof meta.remainingDuration === "number") {
        tagMetadata.remainingDuration = meta.remainingDuration;
      }
      if (typeof meta.stacks === "number") {
        tagMetadata.stacks = meta.stacks;
      }
      if (typeof meta.addedAtTurn === "number") {
        tagMetadata.addedAtTurn = meta.addedAtTurn;
      }
      if (meta.category === "talent" || meta.category === "condition") {
        tagMetadata.category = meta.category;
      }

      tags.set(key, tagMetadata);
    }
  }

  return tags;
}
