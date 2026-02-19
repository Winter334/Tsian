/**
 * EntityAliasMap 构建器
 *
 * 将实体数据（EntityData）转换为别名映射，
 * 使 AI 输出的人类可读名称（如 "player"、NPC 名称）
 * 能够被引擎正确解析为实际实体 ID。
 */

import type { EntityAliasMap } from "@/lib/rules/schema/types";
import type { EntityData } from "./entity-accessor";

/**
 * 构建实体别名映射
 *
 * @param actorId - 当前行动者（玩家角色）的实体 ID
 * @param entities - 所有实体数据
 * @returns EntityAliasMap
 *
 * 构建规则：
 * - "player" / "self" / "actor" → actorId
 * - 每个活跃 NPC 的名称 → NPC 实际 ID
 * - 重名 NPC 使用 "名称#序号" 消歧
 */
export function buildEntityAliasMap(
  actorId: string,
  entities: EntityData[]
): EntityAliasMap {
  const aliases = new Map<string, string>();
  const displayNames = new Map<string, string>();

  // ── 玩家角色别名 ──
  aliases.set("player", actorId);
  aliases.set("self", actorId);
  aliases.set("actor", actorId);
  displayNames.set(actorId, "player");

  // ── NPC 别名 ──

  // 先收集所有活跃 NPC 的名称，用于重名检测
  const npcsByName = new Map<string, EntityData[]>();

  for (const entity of entities) {
    // 跳过玩家角色自身
    if (entity.id === actorId) continue;

    // 只处理 NPC（controlType === "npc"）
    const controlType = entity.fields.controlType;
    if (controlType !== "npc") continue;

    // 跳过已归档或已死亡的 NPC
    const status = entity.fields.status;
    if (status === "archived" || status === "dead") continue;

    const name = entity.fields.name;
    if (typeof name !== "string" || name.length === 0) continue;

    const normalizedName = name.toLowerCase();
    const existing = npcsByName.get(normalizedName) ?? [];
    existing.push(entity);
    npcsByName.set(normalizedName, existing);
  }

  // 构建 NPC 别名
  for (const [normalizedName, npcs] of npcsByName) {
    if (npcs.length === 1) {
      // 唯一名称：直接映射
      const npc = npcs[0];
      const name = npc.fields.name as string;
      aliases.set(normalizedName, npc.id);
      displayNames.set(npc.id, name);
    } else {
      // 重名：使用 "名称#序号" 消歧
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const name = npc.fields.name as string;
        const disambiguated = `${normalizedName}#${i + 1}`;
        aliases.set(disambiguated, npc.id);
        displayNames.set(npc.id, `${name}#${i + 1}`);
      }
      // 同时保留无后缀名称指向第一个 NPC（最常见情况）
      aliases.set(normalizedName, npcs[0].id);
    }
  }

  return { aliases, displayNames };
}
