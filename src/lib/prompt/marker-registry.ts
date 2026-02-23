/**
 * Marker 注册表
 *
 * Phase 4 IRNR v2 重构核心基础设施。
 * 将分散在 assembler.ts 中的渲染逻辑集中管理，
 * 支持双轨并行（Marker 块 + 同名变量）。
 */

import type { Message as AIMessage } from "@/lib/ai/types";
import { collectWorldInfoContentSync } from "@/lib/lorebook";
import type { WorldConfig } from "@/lib/world";
import { DEFAULT_WORLD_CONFIG, resolveDimensionSelections } from "@/lib/world";
import type { CharacterInfo, PromptBlock, VariableContext } from "./types";

// ─── 接口定义 ─────────────────────────────────────────────

interface MarkerRegistryEntry {
  /** 唯一标识（同时作为 MarkerType 和主变量名 {{id}}） */
  id: string;
  /** 变量别名列表（如 characterDescription → 别名 user） */
  aliases?: readonly string[];
  /** 显示名称（编辑器 UI） */
  displayName: string;
  /** 描述（变量提示 tooltip） */
  description: string;
  /** 渲染函数：VariableContext → 纯文本（Marker 和变量共享） */
  render: (context: VariableContext) => string;
  /** 多消息模式（如 chatHistory），true = 只能做 Marker，不生成变量 */
  multiMessage?: boolean;
  /** 多消息渲染（仅 multiMessage=true 时使用） */
  renderMessages?: (
    context: VariableContext,
    block: PromptBlock,
  ) => AIMessage[];
  /** Marker 块的默认 role */
  defaultRole?: "system" | "user" | "assistant";
  /** 是否需要 markerConfig */
  hasConfig?: boolean;
}

// ─── 工具函数 ─────────────────────────────────────────────

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─── 内部辅助函数 ─────────────────────────────────────────

type EntityTagMetadata = NonNullable<
  NonNullable<VariableContext["entityEffects"]>[string]
>[number];

type InventorySnapshot = NonNullable<VariableContext["inventoryData"]>[number];

type StructuralChangeEntry = NonNullable<
  NonNullable<VariableContext["resultFrame"]>["structuralChanges"]
>[number];

interface CharacterSheetEntity {
  referenceId: string;
  displayName: string;
  fields?: Map<string, unknown>;
  status?: unknown;
  level?: unknown;
  character?: CharacterInfo;
  dimensionSummary?: string;
  tags: EntityTagMetadata[];
  inventory?: InventorySnapshot;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;

    const normalized = normalizeKey(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}

function getWorldConfig(context: VariableContext): WorldConfig {
  return context.worldConfig ?? DEFAULT_WORLD_CONFIG;
}

function splitGameStateByEntity(
  gameState: VariableContext["gameState"],
): Map<string, Map<string, unknown>> {
  const entityGroups = new Map<string, Map<string, unknown>>();
  if (!gameState) return entityGroups;

  for (const [key, value] of Object.entries(gameState)) {
    const dotIndex = key.indexOf(".");
    if (dotIndex === -1) {
      const globalGroup =
        entityGroups.get("__global__") ?? new Map<string, unknown>();
      globalGroup.set(key, value);
      entityGroups.set("__global__", globalGroup);
      continue;
    }

    const entityId = key.substring(0, dotIndex);
    const fieldKey = key.substring(dotIndex + 1);
    const group = entityGroups.get(entityId) ?? new Map<string, unknown>();
    group.set(fieldKey, value);
    entityGroups.set(entityId, group);
  }

  return entityGroups;
}

function getPlayersForContext(
  context: VariableContext,
): VariableContext["user"][] {
  if (context.mode === "multiplayer" && context.players?.length) {
    return context.players;
  }
  return [context.user];
}

function findEntityFields(
  entityGroups: Map<string, Map<string, unknown>>,
  candidates: readonly string[],
): Map<string, unknown> | undefined {
  for (const candidate of candidates) {
    const direct = entityGroups.get(candidate);
    if (direct) return direct;
  }

  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  for (const [entityId, fields] of entityGroups) {
    if (entityId === "__global__") continue;

    if (normalizedCandidates.has(normalizeKey(entityId))) {
      return fields;
    }

    const name = fields.get("name");
    if (
      typeof name === "string" &&
      name.trim() &&
      normalizedCandidates.has(normalizeKey(name))
    ) {
      return fields;
    }
  }

  return undefined;
}

function findInventorySnapshot(
  context: VariableContext,
  candidates: readonly string[],
): InventorySnapshot | undefined {
  if (!context.inventoryData?.length) return undefined;

  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  for (const entry of context.inventoryData) {
    if (
      normalizedCandidates.has(normalizeKey(entry.characterId)) ||
      normalizedCandidates.has(normalizeKey(entry.characterName))
    ) {
      return entry;
    }
  }

  return undefined;
}

function collectEntityTags(
  context: VariableContext,
  candidates: readonly string[],
): EntityTagMetadata[] {
  if (!context.entityEffects) return [];

  const result: EntityTagMetadata[] = [];
  const seen = new Set<string>();
  const normalizedCandidates = new Set(candidates.map(normalizeKey));

  const collectTags = (tags: readonly EntityTagMetadata[]) => {
    for (const tag of tags) {
      const key = `${tag.id}::${tag.displayName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tag);
    }
  };

  for (const candidate of candidates) {
    const direct = context.entityEffects[candidate];
    if (direct?.length) {
      collectTags(direct);
    }
  }

  for (const [entityKey, tags] of Object.entries(context.entityEffects)) {
    if (!tags?.length) continue;
    if (normalizedCandidates.has(normalizeKey(entityKey))) {
      collectTags(tags);
    }
  }

  return result;
}

function splitTalentAndEffects(tags: readonly EntityTagMetadata[]): {
  talents: EntityTagMetadata[];
  effects: EntityTagMetadata[];
} {
  return {
    talents: tags.filter((tag) => tag.category === "talent"),
    effects: tags.filter((tag) => tag.category !== "talent"),
  };
}

function collectTalents(
  worldConfig: WorldConfig,
  talentIds: readonly string[] | undefined,
  tags: readonly EntityTagMetadata[],
): Array<{ name: string; description?: string }> {
  const result: Array<{ name: string; description?: string }> = [];
  const seen = new Set<string>();

  if (talentIds?.length && worldConfig.talents) {
    for (const talentId of talentIds) {
      const talent = worldConfig.talents.find((item) => item.id === talentId);
      if (!talent || seen.has(talent.name)) continue;
      seen.add(talent.name);
      result.push({
        name: talent.name,
        description: talent.description || undefined,
      });
    }
  }

  for (const tag of tags) {
    if (seen.has(tag.displayName)) continue;
    seen.add(tag.displayName);
    result.push({
      name: tag.displayName,
      description: tag.effectDescription || undefined,
    });
  }

  return result;
}

function formatEffectWithDuration(tag: EntityTagMetadata): string {
  const durationText =
    tag.remainingDuration !== undefined
      ? `（剩余 ${tag.remainingDuration} 回合）`
      : "";
  return `${tag.displayName}${durationText}`;
}

function formatSheetEffect(tag: EntityTagMetadata): string {
  const manageText = tag.trigger ? "[系统管理]" : "[AI管理]";
  return `${formatEffectWithDuration(tag)}${manageText}`;
}

function getResourceStats(worldConfig: WorldConfig): Array<{
  key: string;
  label: string;
  maxField?: string;
}> {
  return worldConfig.derivedStats
    .filter((stat) => stat.isResource && stat.maxField)
    .map((stat) => ({
      key: stat.key,
      label: stat.label,
      maxField: stat.maxField,
    }));
}

function resolveDimensionSummary(
  character: CharacterInfo | undefined,
  worldConfig: WorldConfig,
): string | undefined {
  if (!character?.dimensionSelections) return undefined;

  const resolved = resolveDimensionSelections(
    worldConfig,
    character.dimensionSelections,
  );

  if (resolved.length === 0) return undefined;

  return resolved
    .map(({ dimensionLabel, option }) => `${dimensionLabel}: ${option.name}`)
    .join(" | ");
}

function resolveDimensionTitle(
  character: CharacterInfo | undefined,
  worldConfig: WorldConfig,
): string | undefined {
  if (!character?.dimensionSelections) return undefined;

  const resolved = resolveDimensionSelections(
    worldConfig,
    character.dimensionSelections,
  );

  if (resolved.length === 0) return undefined;
  return resolved.map(({ option }) => option.name).join("");
}

function buildEntityNameMap(
  context: VariableContext,
  entityGroups: Map<string, Map<string, unknown>>,
): Map<string, string> {
  const entityNameMap = new Map<string, string>();

  if (context.entityDisplayNames) {
    for (const [
      entityId,
      displayName,
    ] of context.entityDisplayNames.entries()) {
      entityNameMap.set(entityId, displayName);
    }
  }

  for (const [entityId, fields] of entityGroups) {
    if (entityId === "__global__") continue;
    const name = fields.get("name");
    if (typeof name === "string" && name.trim()) {
      entityNameMap.set(entityId, name.trim());
    } else if (!entityNameMap.has(entityId)) {
      entityNameMap.set(entityId, entityId);
    }
  }

  const playerName =
    context.user.character?.name?.trim() || context.user.name?.trim();
  if (playerName && !entityNameMap.has("player")) {
    entityNameMap.set("player", playerName);
  }

  return entityNameMap;
}

function buildStatLabelMap(worldConfig: WorldConfig): Map<string, string> {
  const labels = new Map<string, string>();

  for (const attr of worldConfig.primaryAttributes) {
    labels.set(attr.key, attr.label);
  }

  for (const stat of worldConfig.derivedStats) {
    labels.set(stat.key, stat.label);
  }

  return labels;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeResultText(
  text: string,
  entityNameMap: Map<string, string>,
  statLabelMap: Map<string, string>,
): string {
  let normalized = text;

  const entityPairs = [...entityNameMap.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [entityId, displayName] of entityPairs) {
    if (!entityId || entityId === displayName) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(entityId)}\\b`, "g");
    normalized = normalized.replace(pattern, displayName);
  }

  normalized = normalized.replace(
    /([A-Za-z0-9_#\u4e00-\u9fa5]+)\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, entity, field) => {
      const displayName = entityNameMap.get(entity) ?? entity;
      const fieldLabel = statLabelMap.get(field) ?? field;
      return `${displayName}${fieldLabel}`;
    },
  );

  const fieldPairs = [...statLabelMap.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [fieldKey, label] of fieldPairs) {
    const pattern = new RegExp(`\\b${escapeRegExp(fieldKey)}\\b`, "g");
    normalized = normalized.replace(pattern, label);
  }

  return normalized;
}

function splitSummarySentences(summary: string): string[] {
  const normalized = summary.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const line of lines) {
    const stripped = line.replace(/^[-•▸]\s*/, "");
    const parts = stripped
      .split(/(?<=[。！？])/)
      .map((part) => part.trim())
      .filter(Boolean);
    segments.push(...parts);
  }

  return segments;
}

function renderFallbackResultLines(
  frame: NonNullable<VariableContext["resultFrame"]>,
  entityNameMap: Map<string, string>,
  statLabelMap: Map<string, string>,
): string[] {
  const lines: string[] = [];

  for (const check of frame.checks) {
    const modifierText =
      check.modifier >= 0 ? `+${check.modifier}` : `${check.modifier}`;

    let targetPart = "";

    if (check.dcSource === "opposed") {
      const opposedSkillText = check.opposedSkill ?? "unknown";
      const opposedModifierText =
        typeof check.opposedModifier === "number"
          ? check.opposedModifier >= 0
            ? `+${check.opposedModifier}`
            : `${check.opposedModifier}`
          : "";

      if (
        typeof check.opposedRoll === "number" &&
        typeof check.opposedModifier === "number" &&
        typeof check.opposedTotal === "number"
      ) {
        targetPart = `对抗(${opposedSkillText}) ${check.opposedRoll}${opposedModifierText}=${check.opposedTotal}`;
      } else if (typeof check.opposedTotal === "number") {
        targetPart = `对抗(${opposedSkillText}) ${check.opposedTotal}`;
      } else {
        targetPart = `对抗(${opposedSkillText})`;
      }
    } else if (typeof check.dc === "number") {
      targetPart = `难度 ${check.dc}`;
    }

    const detailPart = targetPart
      ? `掷骰 ${check.roll}${modifierText}=${check.total}，${targetPart}`
      : `掷骰 ${check.roll}${modifierText}=${check.total}`;

    lines.push(
      `${check.name} → ${check.success ? "成功" : "失败"}（${detailPart}）`,
    );
  }

  for (const change of frame.valueChanges) {
    const entityName = entityNameMap.get(change.entityId) ?? change.entityId;
    const fieldLabel = statLabelMap.get(change.field) ?? change.field;
    const reasonText = change.reason ? `（${change.reason}）` : "";
    lines.push(
      `${entityName}${fieldLabel} ${stringifyValue(change.oldValue)}→${stringifyValue(
        change.newValue,
      )}${reasonText}`,
    );
  }

  return lines;
}

function renderStructuralChangeLines(
  structuralChanges: readonly StructuralChangeEntry[] | undefined,
  summaryText: string,
  entityNameMap: Map<string, string>,
  statLabelMap: Map<string, string>,
): string[] {
  if (!structuralChanges?.length) return [];

  const lines: string[] = [];
  const seen = new Set<string>();
  const summaryLower = summaryText.toLowerCase();

  for (const change of structuralChanges) {
    if (change.details?.failed === true) continue;

    const targetName = entityNameMap.get(change.targetId) ?? change.targetId;
    const rawName =
      typeof change.details?.name === "string"
        ? change.details.name
        : change.entityId;
    const name = normalizeResultText(rawName, entityNameMap, statLabelMap);
    const quantity =
      typeof change.details?.quantity === "number"
        ? change.details.quantity
        : 1;

    let line = "";
    let keyword = "";

    switch (change.type) {
      case "item_added":
        keyword = "获得物品";
        line = `${targetName} 获得物品: ${name}${quantity > 1 ? ` x${quantity}` : ""}`;
        break;
      case "item_removed":
        keyword = "失去物品";
        line = `${targetName} 失去物品: ${name}${quantity > 1 ? ` x${quantity}` : ""}`;
        break;
      case "skill_learned":
        keyword = "习得技能";
        line = `${targetName} 习得技能: ${name}`;
        break;
      case "skill_removed":
        keyword = "遗忘技能";
        line = `${targetName} 遗忘技能: ${name}`;
        break;
    }

    if (!line) continue;

    const signature = line.toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);

    if (
      keyword &&
      summaryLower.includes(keyword.toLowerCase()) &&
      summaryLower.includes(String(name).toLowerCase())
    ) {
      continue;
    }

    lines.push(line);
  }

  return lines;
}

function renderCharacterSheetEntity(
  entity: CharacterSheetEntity,
  worldConfig: WorldConfig,
): string[] {
  const lines: string[] = [];

  const levelValue = entity.level ?? entity.fields?.get("level");
  const statusValue = entity.status ?? entity.fields?.get("status");

  let title = `[引用ID: ${entity.referenceId}] ${entity.displayName}`;
  if (levelValue !== undefined) {
    title += ` Lv.${stringifyValue(levelValue)}`;
  }
  if (statusValue !== undefined && String(statusValue).trim()) {
    title += ` - 状态: ${stringifyValue(statusValue)}`;
  }
  lines.push(title);

  if (entity.dimensionSummary) {
    lines.push(entity.dimensionSummary);
  }

  const attributeParts: string[] = [];
  for (const attr of worldConfig.primaryAttributes) {
    if (attr.key === "level") continue;
    const value =
      entity.fields?.get(attr.key) ?? entity.character?.attributes?.[attr.key];
    if (value !== undefined) {
      attributeParts.push(`${attr.key} ${stringifyValue(value)}`);
    }
  }
  lines.push(
    `属性: ${attributeParts.length > 0 ? attributeParts.join(" | ") : "（无）"}`,
  );

  const resourceParts: string[] = [];
  for (const stat of getResourceStats(worldConfig)) {
    const value = entity.fields?.get(stat.key);
    if (value === undefined) continue;

    const maxValue = stat.maxField
      ? entity.fields?.get(stat.maxField)
      : undefined;
    if (maxValue !== undefined) {
      resourceParts.push(
        `${stat.key} ${stringifyValue(value)}/${stringifyValue(maxValue)}`,
      );
    } else {
      resourceParts.push(`${stat.key} ${stringifyValue(value)}`);
    }
  }
  lines.push(
    `资源: ${resourceParts.length > 0 ? resourceParts.join(" | ") : "（无）"}`,
  );

  if (levelValue !== undefined) {
    lines.push(`等级: ${stringifyValue(levelValue)}`);
  }

  const { talents: talentTags, effects } = splitTalentAndEffects(entity.tags);
  const talents = collectTalents(
    worldConfig,
    entity.character?.talentIds,
    talentTags,
  );
  lines.push(
    `天赋: ${
      talents.length > 0
        ? talents
            .map((talent) =>
              talent.description
                ? `${talent.name} - ${talent.description}`
                : talent.name,
            )
            .join("; ")
        : "（无）"
    }`,
  );

  lines.push(
    `当前效果: ${
      effects.length > 0
        ? effects.map((tag) => formatSheetEffect(tag)).join("、")
        : "（无）"
    }`,
  );

  const itemText =
    !entity.inventory || entity.inventory.items.length === 0
      ? "（无）"
      : entity.inventory.items
          .map((item) => {
            const qtyText = item.quantity > 1 ? `x${item.quantity}` : "x1";
            const equippedText = item.equipped ? "，已装备" : "";
            return `${item.name}${qtyText}（${item.category}${equippedText}）`;
          })
          .join("、");
  lines.push(`背包: ${itemText}`);

  const skillText =
    !entity.inventory || entity.inventory.skills.length === 0
      ? "（无）"
      : entity.inventory.skills
          .map((skill) => {
            const levelText = ` Lv.${skill.level}`;
            const typeText = skill.activeUsable ? "主动" : "被动";
            return `${skill.name}${levelText}（${typeText}/${skill.category}）`;
          })
          .join("、");
  lines.push(`技能: ${skillText}`);

  return lines;
}

// ─── 渲染函数 ─────────────────────────────────────────────

/**
 * 渲染对话历史（多消息模式）
 *
 * 从 assembler.ts resolveChatHistory() 提取。
 * 根据 block.markerConfig 过滤系统消息并截取最新 N 条。
 */
function renderChatHistoryMessages(
  context: VariableContext,
  block: PromptBlock,
): AIMessage[] {
  const maxMessages = block.markerConfig?.maxMessages ?? 50;
  const includeSystemMessages =
    block.markerConfig?.includeSystemMessages ?? false;

  let messages = context.chatHistory;

  // 过滤系统消息
  if (!includeSystemMessages) {
    messages = messages.filter((m) => m.role !== "system");
  }

  // 限制消息数量（取最新的 N 条）
  if (messages.length > maxMessages) {
    messages = messages.slice(-maxMessages);
  }

  return messages;
}

/**
 * 渲染角色数据表（Parser 专用）
 *
 * 合并玩家/NPC/状态/效果/背包/技能信息，
 * 并保留引用 ID 与变量名（str、hp 等）以便构造 RuleScript。
 */
function renderCharacterSheet(context: VariableContext): string {
  const worldConfig = getWorldConfig(context);
  const entityGroups = splitGameStateByEntity(context.gameState);

  const lines: string[] = ["【角色数据表】", "", "═══ 玩家角色 ═══"];
  const players = getPlayersForContext(context);

  if (players.length === 0) {
    lines.push("（无）");
  } else {
    for (const player of players) {
      const referenceId =
        context.mode === "solo"
          ? "player"
          : player.character?.name?.trim() || player.name || "player";

      const candidates = uniqueNonEmpty([
        referenceId,
        player.character?.name,
        player.name,
        "player",
      ]);

      const fields = findEntityFields(entityGroups, candidates);
      const nameField = fields?.get("name");
      const displayName =
        typeof nameField === "string" && nameField.trim()
          ? nameField.trim()
          : player.character?.name?.trim() || player.name || referenceId;

      const tags = collectEntityTags(
        context,
        uniqueNonEmpty([...candidates, displayName]),
      );

      const inventory = findInventorySnapshot(
        context,
        uniqueNonEmpty([...candidates, displayName]),
      );

      const blockLines = renderCharacterSheetEntity(
        {
          referenceId,
          displayName,
          fields,
          level: fields?.get("level"),
          status: fields?.get("status"),
          character: player.character,
          dimensionSummary: resolveDimensionSummary(
            player.character,
            worldConfig,
          ),
          tags,
          inventory,
        },
        worldConfig,
      );

      lines.push(...blockLines, "");
    }
  }

  lines.push("═══ 在场 NPC ═══");

  let npcs = context.activeNpcs ?? [];
  if (npcs.length === 0) {
    const fallbackNpcs: NonNullable<VariableContext["activeNpcs"]> = [];
    for (const [entityId, fields] of entityGroups) {
      if (entityId === "__global__" || entityId === "player") continue;
      if (fields.get("controlType") !== "npc") continue;

      const fieldName = fields.get("name");
      const fieldStatus = fields.get("status");
      const fieldLevel = fields.get("level");

      fallbackNpcs.push({
        id: entityId,
        name:
          typeof fieldName === "string" && fieldName.trim()
            ? fieldName.trim()
            : entityId,
        status:
          typeof fieldStatus === "string" && fieldStatus.trim()
            ? fieldStatus.trim()
            : "active",
        level: typeof fieldLevel === "number" ? fieldLevel : undefined,
      });
    }

    npcs = fallbackNpcs;
  }

  if (npcs.length === 0) {
    lines.push("（无）");
  } else {
    for (const npc of npcs) {
      const referenceId = npc.name?.trim() || npc.id;
      const candidates = uniqueNonEmpty([referenceId, npc.id, npc.name]);
      const fields = findEntityFields(entityGroups, candidates);

      const nameField = fields?.get("name");
      const displayName =
        typeof nameField === "string" && nameField.trim()
          ? nameField.trim()
          : npc.name || npc.id;

      const tags = collectEntityTags(
        context,
        uniqueNonEmpty([...candidates, displayName]),
      );

      const inventory = findInventorySnapshot(
        context,
        uniqueNonEmpty([...candidates, displayName]),
      );

      const npcCharacter: CharacterInfo = {
        name: displayName,
        attributes: npc.attributes,
        talentIds: npc.talentIds,
      };

      const blockLines = renderCharacterSheetEntity(
        {
          referenceId,
          displayName,
          fields,
          status: fields?.get("status") ?? npc.status,
          level: fields?.get("level") ?? npc.level,
          character: npcCharacter,
          tags,
          inventory,
        },
        worldConfig,
      );

      lines.push(...blockLines, "");
    }
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * 渲染角色描写（Narrative 专用）
 *
 * 仅保留叙事素材，不包含变量名和引用 ID。
 */
function renderCharacterDescription(context: VariableContext): string {
  const worldConfig = getWorldConfig(context);
  const entityGroups = splitGameStateByEntity(context.gameState);

  const lines: string[] = ["【玩家角色】"];
  const players = getPlayersForContext(context);

  if (players.length === 0) {
    lines.push("（无）");
  } else {
    for (const player of players) {
      const baseName =
        player.character?.name?.trim() || player.name?.trim() || "未知角色";
      const titleDimension = resolveDimensionTitle(
        player.character,
        worldConfig,
      );
      const title = titleDimension
        ? `${baseName} — ${titleDimension}`
        : baseName;
      lines.push(title);

      if (player.character?.appearance?.trim()) {
        lines.push(`外貌: ${player.character.appearance.trim()}`);
      }
      if (player.character?.personality?.trim()) {
        lines.push(`性格: ${player.character.personality.trim()}`);
      }
      if (player.character?.description?.trim()) {
        lines.push(`背景故事: ${player.character.description.trim()}`);
      }

      const candidates = uniqueNonEmpty([
        context.mode === "solo" ? "player" : baseName,
        baseName,
        player.name,
      ]);

      const fields = findEntityFields(entityGroups, candidates);
      const displayNameField = fields?.get("name");
      const displayName =
        typeof displayNameField === "string" && displayNameField.trim()
          ? displayNameField.trim()
          : baseName;

      const tags = collectEntityTags(
        context,
        uniqueNonEmpty([...candidates, displayName]),
      );
      const { talents } = splitTalentAndEffects(tags);

      const talentLines = collectTalents(
        worldConfig,
        player.character?.talentIds,
        talents,
      );

      if (talentLines.length > 0) {
        lines.push(
          `天赋: ${talentLines
            .map((talent) =>
              talent.description
                ? `${talent.name}（${talent.description}）`
                : talent.name,
            )
            .join("、")}`,
        );
      }

      lines.push("");
    }
  }

  lines.push("【在场 NPC】");
  const npcs = context.activeNpcs ?? [];
  if (npcs.length === 0) {
    lines.push("（无）");
  } else {
    npcs.forEach((npc, index) => {
      const levelText = npc.level !== undefined ? ` (Lv.${npc.level})` : "";
      lines.push(`${index + 1}. ${npc.name}${levelText}`);

      if (npc.appearance?.trim()) {
        lines.push(`   外貌: ${npc.appearance.trim()}`);
      }

      if (npc.personality?.trim()) {
        lines.push(`   性格: ${npc.personality.trim()}`);
      }

      const statusParts: string[] = [];
      if (npc.description?.trim()) {
        statusParts.push(npc.description.trim());
      }

      const tags = collectEntityTags(
        context,
        uniqueNonEmpty([npc.id, npc.name]),
      );
      const { effects } = splitTalentAndEffects(tags);
      if (effects.length > 0) {
        for (const effect of effects) {
          if (effect.effectDescription?.trim()) {
            statusParts.push(
              `${effect.displayName}：${effect.effectDescription}`,
            );
          } else {
            statusParts.push(formatEffectWithDuration(effect));
          }
        }
      }

      if (statusParts.length > 0) {
        lines.push(`   当前状态: ${statusParts.join("；")}`);
      }
    });
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * 渲染叙事状态速览（Narrative 专用）
 *
 * 仅输出资源字段与当前效果，避免技术性噪音。
 */
function renderNarrativeState(context: VariableContext): string {
  const worldConfig = getWorldConfig(context);
  const entityGroups = splitGameStateByEntity(context.gameState);
  const entries = [...entityGroups.entries()].filter(
    ([entityId]) => entityId !== "__global__",
  );

  if (entries.length === 0) {
    return "";
  }

  const resourceStats = getResourceStats(worldConfig);
  if (resourceStats.length === 0) {
    return "";
  }

  const entityNameMap = buildEntityNameMap(context, entityGroups);
  const lines: string[] = ["【当前状态速览】"];

  for (const [entityId, fields] of entries) {
    const fieldName = fields.get("name");
    const displayName =
      typeof fieldName === "string" && fieldName.trim()
        ? fieldName.trim()
        : (entityNameMap.get(entityId) ?? entityId);

    const resourceParts: string[] = [];
    for (const stat of resourceStats) {
      const currentValue = fields.get(stat.key);
      if (currentValue === undefined) continue;

      const maxValue = stat.maxField ? fields.get(stat.maxField) : undefined;
      if (maxValue !== undefined) {
        resourceParts.push(
          `${stat.label} ${stringifyValue(currentValue)}/${stringifyValue(maxValue)}`,
        );
      } else {
        resourceParts.push(`${stat.label} ${stringifyValue(currentValue)}`);
      }
    }

    if (resourceParts.length === 0) {
      continue;
    }

    const tags = collectEntityTags(
      context,
      uniqueNonEmpty([entityId, displayName]),
    );
    const { effects } = splitTalentAndEffects(tags);
    const effectText =
      effects.length > 0
        ? effects.map((effect) => formatEffectWithDuration(effect)).join("、")
        : "状态正常";

    lines.push(`${displayName}: ${[...resourceParts, effectText].join(" | ")}`);
  }

  if (lines.length <= 1) {
    return "";
  }

  return lines.join("\n");
}

/**
 * 渲染结算结果帧
 *
 * 优先使用 mechanicSummary，补充 structuralChanges。
 */
function renderResultFrame(context: VariableContext): string {
  const frame = context.resultFrame;
  if (!frame) {
    return "";
  }

  const worldConfig = getWorldConfig(context);
  const entityGroups = splitGameStateByEntity(context.gameState);
  const entityNameMap = buildEntityNameMap(context, entityGroups);
  const statLabelMap = buildStatLabelMap(worldConfig);

  const lines: string[] = ["【本轮结算结果】"];

  const summaryLines = splitSummarySentences(frame.mechanicSummary)
    .map((line) => normalizeResultText(line, entityNameMap, statLabelMap))
    .filter((line) => line.trim().length > 0);

  if (summaryLines.length > 0) {
    lines.push("");
    for (const line of summaryLines) {
      lines.push(`▸ ${line}`);
    }
  } else {
    const fallbackLines = renderFallbackResultLines(
      frame,
      entityNameMap,
      statLabelMap,
    );
    if (fallbackLines.length > 0) {
      lines.push("");
      for (const line of fallbackLines) {
        lines.push(`▸ ${line}`);
      }
    }
  }

  if (!frame.success && frame.failureReason?.trim()) {
    lines.push("", `▸ 失败原因: ${frame.failureReason.trim()}`);
  }

  const normalizedSummary = normalizeResultText(
    frame.mechanicSummary,
    entityNameMap,
    statLabelMap,
  );
  const structuralLines = renderStructuralChangeLines(
    frame.structuralChanges,
    normalizedSummary,
    entityNameMap,
    statLabelMap,
  );

  if (structuralLines.length > 0) {
    lines.push("");
    for (const line of structuralLines) {
      lines.push(`▸ ${line}`);
    }
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length <= 1) {
    return "";
  }

  return lines.join("\n");
}

/**
 * 渲染操作定义
 *
 * 从 assembler.ts resolveOperationDefs() 提取。
 * 加上 "【可用操作定义】" 前缀输出。
 */
function renderOperationDefs(context: VariableContext): string {
  const defs = context.operationDefinitions;
  if (!defs?.trim()) {
    return "";
  }

  return `【可用操作定义】\n${defs.trim()}`;
}

/**
 * 渲染世界信息
 *
 * 从 assembler.ts resolveWorldInfo() 提取。
 * 收集世界书激活内容 + 追加手动传入的 worldInfo。
 */
function renderWorldInfo(context: VariableContext): string {
  // 从世界书系统收集激活内容
  let worldInfoContent = collectWorldInfoContentSync(context);

  // 如果有手动传入的 worldInfo，追加到末尾
  if (context.worldInfo?.trim()) {
    worldInfoContent = worldInfoContent
      ? worldInfoContent + "\n\n" + context.worldInfo
      : context.worldInfo;
  }

  if (!worldInfoContent.trim()) {
    return "";
  }

  return worldInfoContent;
}

/**
 * 渲染剧情梗概
 *
 * 从 assembler.ts resolveScenario() 提取。
 */
function renderScenario(context: VariableContext): string {
  return context.scenario ?? "";
}

/**
 * 渲染回合信息
 *
 * 从 assembler.ts resolveTurnInfo() 提取。
 * 格式化回合号 + 玩家行动列表。
 */
function renderTurnInfo(context: VariableContext): string {
  if (!context.turn) {
    return "";
  }

  return `--- 第 ${context.turn.number} 回合 ---\n${context.turn.actions
    .map((a) => a.content)
    .join("\n")}`;
}

/**
 * 渲染分段记忆（三级：大总结 + 小总结 + 完整正文）
 *
 * 单消息模式：将所有记忆内容合并为一段文本，
 * 从 VariableContext.memoryData 读取预计算的记忆数据。
 * 角色由块配置的 role 决定。
 */
function renderMemorySummary(context: VariableContext): string {
  const memoryData = context.memoryData;
  if (!memoryData) return "";

  const { megaSummaries, miniSummaries, recentNarratives } = memoryData;
  const parts: string[] = [];

  // 1. 大总结（最早的历史）
  if (megaSummaries.length > 0) {
    parts.push(
      ["【剧情回顾】", ...megaSummaries.map((s) => s.content)].join("\n\n"),
    );
  }

  // 2. 小总结（中等时间跨度）
  if (miniSummaries.length > 0) {
    parts.push(
      ["【近期事件摘要】", ...miniSummaries.map((s) => s.content)].join("\n\n"),
    );
  }

  // 3. 最近回合完整正文（最新的，不加标记直接拼接）
  if (recentNarratives.length > 0) {
    parts.push(recentNarratives.map((n) => n.content).join("\n\n"));
  }

  return parts.join("\n\n");
}

// ─── 注册表 ───────────────────────────────────────────────

const MARKER_REGISTRY = [
  {
    id: "chatHistory",
    displayName: "对话历史",
    description: "注入对话历史记录（多条消息）",
    render: () => "",
    multiMessage: true,
    renderMessages: renderChatHistoryMessages,
    defaultRole: "user" as const,
    hasConfig: true,
  },
  {
    id: "characterSheet",
    aliases: ["gameState"],
    displayName: "角色数据表",
    description: "注入含引用ID与变量名的完整角色数据（Parser 专用）",
    render: renderCharacterSheet,
    defaultRole: "system" as const,
  },
  {
    id: "characterDescription",
    aliases: ["user", "userPersona", "npcInfo"],
    displayName: "角色描写",
    description: "注入纯叙事角色信息（无变量名/无引用ID）",
    render: renderCharacterDescription,
    defaultRole: "system" as const,
  },
  {
    id: "narrativeState",
    displayName: "叙事状态速览",
    description: "注入精简资源状态与当前效果（Narrative 专用）",
    render: renderNarrativeState,
    defaultRole: "system" as const,
  },
  {
    id: "resultFrame",
    displayName: "结算结果",
    description: "注入本轮规则引擎的结算结果（检定/骰子/状态变化）",
    render: renderResultFrame,
    defaultRole: "system" as const,
  },
  {
    id: "operationDefs",
    displayName: "操作定义",
    description: "注入可用的 RuleScript 操作类型定义",
    render: renderOperationDefs,
    defaultRole: "system" as const,
  },
  {
    id: "worldInfo",
    displayName: "世界信息",
    description: "注入世界书激活内容",
    render: renderWorldInfo,
    defaultRole: "system" as const,
  },
  {
    id: "scenario",
    displayName: "剧情梗概",
    description: "注入当前剧情梗概",
    render: renderScenario,
    defaultRole: "system" as const,
  },
  {
    id: "turnInfo",
    displayName: "回合信息",
    description: "注入当前回合号和玩家行动（联机模式）",
    render: renderTurnInfo,
    defaultRole: "system" as const,
  },
  {
    id: "memorySummary",
    displayName: "分段记忆",
    description: "注入三级记忆：完整正文 + 小总结 + 大总结",
    render: renderMemorySummary,
    defaultRole: "system" as const,
    hasConfig: true,
  },
] satisfies MarkerRegistryEntry[];

// ─── 查询 API ─────────────────────────────────────────────

/**
 * 所有 Marker ID 列表（用于派生 MarkerType 字面量联合类型）
 *
 * 手动定义 as const 以保留字面量类型，
 * .map() 会丢失字面量信息导致推导为 string[]。
 * 新增 Marker 时需同步更新此数组。
 */
export const MARKER_IDS = [
  "chatHistory",
  "characterSheet",
  "characterDescription",
  "narrativeState",
  "resultFrame",
  "operationDefs",
  "worldInfo",
  "scenario",
  "turnInfo",
  "memorySummary",
] as const;

/** 按 id 查找 */
export function getMarkerById(id: string): MarkerRegistryEntry | undefined {
  return MARKER_REGISTRY.find((e) => e.id === id);
}

/** 按 id 或别名查找 */
export function findMarkerByIdOrAlias(
  name: string,
): MarkerRegistryEntry | undefined {
  return MARKER_REGISTRY.find((e) => {
    if (e.id === name) return true;
    if (!("aliases" in e)) return false;
    return Array.isArray(e.aliases) && e.aliases.includes(name);
  });
}

/** 获取所有注册项 */
export function getAllMarkers(): readonly MarkerRegistryEntry[] {
  return MARKER_REGISTRY;
}

// ─── 类型导出 ─────────────────────────────────────────────

export type { MarkerRegistryEntry };
