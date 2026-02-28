import type {
  ArchiveUpdate,
  EntityArchetype,
  EntityPresence,
  EntityRelationship,
} from "@/modules/world-archive/types";
import type { DirectorOutput, Foreshadow, Milestone, StoryArc } from "./types";

/**
 * 解析导演 AI 的 XML 输出
 *
 * 从导演 AI 的原始文本中提取四个 XML 区域。
 * 采用 fail-fast 策略：必需标签缺失时抛出错误。
 *
 * @throws {DirectorOutputParseError} 当必需的 XML 标签缺失时
 */
export function parseDirectorOutput(rawOutput: string): DirectorOutput {
  const plotDirectives = extractXmlContent(rawOutput, "plot_directives");
  if (plotDirectives === null) {
    throw new DirectorOutputParseError(
      "导演 AI 输出缺少必需的 <plot_directives> 标签",
      rawOutput,
    );
  }

  const narrativeHints = extractXmlContent(rawOutput, "narrative_hints");
  if (narrativeHints === null) {
    throw new DirectorOutputParseError(
      "导演 AI 输出缺少必需的 <narrative_hints> 标签",
      rawOutput,
    );
  }

  const archiveUpdatesRaw = extractXmlContent(rawOutput, "archive_updates");
  if (archiveUpdatesRaw === null) {
    throw new DirectorOutputParseError(
      "导演 AI 输出缺少必需的 <archive_updates> 标签",
      rawOutput,
    );
  }

  const outlineUpdatesRaw =
    extractXmlContent(rawOutput, "outline_updates") ?? undefined;

  return {
    plotDirectives: plotDirectives.trim(),
    narrativeHints: narrativeHints.trim(),
    archiveUpdatesRaw: archiveUpdatesRaw.trim(),
    outlineUpdatesRaw: outlineUpdatesRaw?.trim(),
  };
}

/**
 * outline_updates 结构化解析结果
 */
export type OutlineUpdateInstruction =
  | {
      type: "append_arc_deviation";
      deviation: string;
    }
  | {
      type: "set_arc_status";
      status: StoryArc["status"];
    }
  | {
      type: "set_milestone_status";
      milestoneRef: string;
      status: Milestone["status"];
    }
  | {
      type: "increment_foreshadow_hint";
      foreshadowRef: string;
      delta: number;
    }
  | {
      type: "set_foreshadow_status";
      foreshadowRef: string;
      status: Foreshadow["status"];
    }
  | {
      type: "add_foreshadow";
      foreshadow: Omit<Foreshadow, "id">;
    }
  | {
      type: "remove_foreshadow";
      foreshadowRef: string;
    };

/**
 * 从 outline_updates 原始文本解析结构化指令
 */
export function parseOutlineUpdates(
  raw: string,
  currentTurn: number,
): OutlineUpdateInstruction[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"));

  const instructions: OutlineUpdateInstruction[] = [];

  for (const line of lines) {
    const content = stripWrappingQuotes(line.slice(1).trim());
    if (!content) {
      continue;
    }

    const deviationMatch = content.match(/^弧线偏离(?:记录)?[：:]\s*(.+)$/u);
    if (deviationMatch) {
      const deviation = stripWrappingQuotes(deviationMatch[1].trim());
      if (deviation) {
        instructions.push({
          type: "append_arc_deviation",
          deviation,
        });
      }
      continue;
    }

    const arcStatusMatch = content.match(
      /^弧线状态(?:变更)?[：:]\s*(active|completed|abandoned|modified|进行中|已完成|放弃|废弃|已废弃|已修改|改写)/iu,
    );
    if (arcStatusMatch) {
      const status = mapStoryArcStatus(arcStatusMatch[1]);
      if (status) {
        instructions.push({
          type: "set_arc_status",
          status,
        });
      }
      continue;
    }

    const milestoneMatch = content.match(
      /^里程碑["“”'‘’]?([^：:]+?)["“”'‘’]?[：:]\s*(pending|triggered|skipped|待触发|未触发|已触发|触发|跳过|已跳过)/iu,
    );
    if (milestoneMatch) {
      const milestoneRef = stripWrappingQuotes(milestoneMatch[1].trim());
      const status = mapMilestoneStatus(milestoneMatch[2]);
      if (milestoneRef && status) {
        instructions.push({
          type: "set_milestone_status",
          milestoneRef,
          status,
        });
      }
      continue;
    }

    const foreshadowHintMatch = content.match(
      /^伏笔["“”'‘’]?([^：:]+?)["“”'‘’]?[：:]\s*暗示次数\s*([+-])\s*(\d+)/iu,
    );
    if (foreshadowHintMatch) {
      const foreshadowRef = stripWrappingQuotes(foreshadowHintMatch[1].trim());
      const sign = foreshadowHintMatch[2];
      const amount = Number.parseInt(foreshadowHintMatch[3], 10);
      if (foreshadowRef && Number.isFinite(amount) && amount > 0) {
        instructions.push({
          type: "increment_foreshadow_hint",
          foreshadowRef,
          delta: sign === "-" ? -amount : amount,
        });
      }
      continue;
    }

    const foreshadowStatusMatch = content.match(
      /^伏笔["“”'‘’]?([^：:]+?)["“”'‘’]?[：:]\s*(?:状态(?:变更)?为?|status\s*(?:=|:|为))\s*(planted|hinted|revealed|abandoned|埋下|已埋下|暗示中|已暗示|揭示|已揭示|放弃|废弃|已放弃)/iu,
    );
    if (foreshadowStatusMatch) {
      const foreshadowRef = stripWrappingQuotes(
        foreshadowStatusMatch[1].trim(),
      );
      const status = mapForeshadowStatus(foreshadowStatusMatch[2]);
      if (foreshadowRef && status) {
        instructions.push({
          type: "set_foreshadow_status",
          foreshadowRef,
          status,
        });
      }
      continue;
    }

    const addForeshadowMatch = content.match(/^新增伏笔[：:]\s*(.+)$/u);
    if (addForeshadowMatch) {
      const seed = stripWrappingQuotes(addForeshadowMatch[1].trim());
      if (seed) {
        instructions.push({
          type: "add_foreshadow",
          foreshadow: {
            description: seed,
            plantedAtTurn: currentTurn,
            triggerCondition: "待导演后续细化",
            revealEffect: "待导演后续细化",
            status: "planted",
            hintCount: 0,
            relatedEntityIds: [],
          },
        });
      }
      continue;
    }

    const removeForeshadowMatch = content.match(/^移除伏笔[：:]\s*(.+)$/u);
    if (removeForeshadowMatch) {
      const foreshadowRef = stripWrappingQuotes(
        removeForeshadowMatch[1].trim(),
      );
      if (foreshadowRef) {
        instructions.push({
          type: "remove_foreshadow",
          foreshadowRef,
        });
      }
      continue;
    }
  }

  return instructions;
}

/**
 * 从 archive_updates 原始文本解析 ArchiveUpdate 数组
 *
 * 支持格式：
 * - 实体名(entityId)：状态描述
 * - 实体名：状态描述
 *
 * 需要通过 entityLookup 做名称/ID 的模糊匹配。
 */
export function parseArchiveUpdates(
  raw: string,
  entityLookup: (nameOrId: string) => string | undefined,
  currentTurn: number,
): ArchiveUpdate[] {
  const updates: ArchiveUpdate[] = [];
  const parseErrors: string[] = [];

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"));

  for (const line of lines) {
    const content = line.slice(1).trim();
    if (!content) {
      continue;
    }

    const created = tryParseCreateEntity(content);
    if (created) {
      updates.push(created);
      continue;
    }

    const match = content.match(/^(.+?)(?:\(([^)]+)\))?[：:]\s*(.+)$/u);
    if (!match) {
      parseErrors.push(`条目格式不匹配：${content}`);
      continue;
    }

    const [, entityName, explicitId, description] = match;

    const trimmedName = stripWrappingQuotes(entityName.trim());
    const trimmedDesc = description.trim();
    const normalizedDesc = stripWrappingQuotes(trimmedDesc);

    const createdFromDescription = tryParseCreateEntity(
      normalizedDesc,
      trimmedName,
      explicitId,
    );
    if (createdFromDescription) {
      updates.push(createdFromDescription);
      continue;
    }

    const entityId = resolveEntityId(trimmedName, explicitId, entityLookup);

    if (!entityId) {
      parseErrors.push(`无法匹配实体：${trimmedName}`);
      continue;
    }

    const parsedPresence = tryParsePresence(normalizedDesc);
    if (parsedPresence) {
      pushPresenceChange(
        updates,
        entityId,
        parsedPresence,
        normalizedDesc,
        currentTurn,
      );
      continue;
    }

    const parsedRelationship = tryParseRelationship(
      normalizedDesc,
      entityLookup,
    );
    if (parsedRelationship) {
      pushRelationshipChange(
        updates,
        entityId,
        parsedRelationship,
        currentTurn,
      );
      continue;
    }

    if (hasPresenceKeyword(normalizedDesc)) {
      parseErrors.push(`存在状态更新缺少有效值：${content}`);
      continue;
    }

    if (hasRelationshipKeyword(normalizedDesc)) {
      parseErrors.push(`关系更新无法解析目标或类型：${content}`);
      continue;
    }

    if (
      normalizedDesc.startsWith("状态更新为") ||
      normalizedDesc.startsWith("状态更新：") ||
      normalizedDesc.startsWith("状态更新:")
    ) {
      const newState = stripWrappingQuotes(
        normalizedDesc.replace(/^状态更新[为：:]\s*/u, "").trim(),
      );
      if (!newState) {
        parseErrors.push(`状态更新缺少状态文本：${content}`);
        continue;
      }
      pushStateChange(updates, entityId, newState, currentTurn);
      continue;
    }

    if (
      normalizedDesc.startsWith("进展为") ||
      normalizedDesc.startsWith("进展：") ||
      normalizedDesc.startsWith("进展:")
    ) {
      const newState = stripWrappingQuotes(
        normalizedDesc.replace(/^进展[为：:]\s*/u, "").trim(),
      );
      if (!newState) {
        parseErrors.push(`进展更新缺少状态文本：${content}`);
        continue;
      }
      pushStateChange(updates, entityId, newState, currentTurn);
      continue;
    }

    pushStateChange(updates, entityId, normalizedDesc, currentTurn);
  }

  if (parseErrors.length > 0) {
    throw new DirectorOutputParseError(
      `archive_updates 解析失败：\n- ${parseErrors.join("\n- ")}`,
      raw,
    );
  }

  return updates;
}

function resolveEntityId(
  name: string,
  explicitId: string | undefined,
  entityLookup: (nameOrId: string) => string | undefined,
): string | undefined {
  const normalizedExplicit = stripWrappingQuotes(explicitId?.trim() ?? "");
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  if (!name) {
    return undefined;
  }

  return entityLookup(name);
}

function pushStateChange(
  updates: ArchiveUpdate[],
  entityId: string,
  newState: string,
  _currentTurn: number,
): void {
  updates.push({ type: "update_state", entityId, newState });
}

function pushPresenceChange(
  updates: ArchiveUpdate[],
  entityId: string,
  newPresence: EntityPresence,
  _description: string,
  _currentTurn: number,
): void {
  updates.push({ type: "update_presence", entityId, newPresence });
}

function pushRelationshipChange(
  updates: ArchiveUpdate[],
  entityId: string,
  relationship: EntityRelationship,
  _currentTurn: number,
): void {
  updates.push({
    type: "add_relationship",
    entityId,
    relationship,
  });
}

function hasPresenceKeyword(description: string): boolean {
  return /存在状态|presence\s*status|(?:→|->)\s*(?:active|nearby|dormant|resolved|活跃|附近|临近|休眠|潜伏|已解决|终结)|(?:变为|切换为|调整为)\s*(?:active|nearby|dormant|resolved|活跃|附近|临近|休眠|潜伏|已解决|终结)/iu.test(
    description,
  );
}

function hasRelationshipKeyword(description: string): boolean {
  return /关系(?:更新|变更)?[：:]?|与.+建立了/u.test(description);
}

function tryParsePresence(description: string): EntityPresence | null {
  const fromToMatch = description.match(
    /从\s*[^，。；;]+?\s*变为\s*(active|nearby|dormant|resolved|活跃|附近|临近|休眠|潜伏|已解决|终结)/iu,
  );
  if (fromToMatch) {
    return resolvePresence(fromToMatch[1]);
  }

  const directMatch = description.match(
    /(?:存在状态(?:变更)?(?:为|：|:)?|presence(?:\s+status)?(?:\s*(?:为|to|:|：))?)\s*(active|nearby|dormant|resolved|活跃|附近|临近|休眠|潜伏|已解决|终结)/iu,
  );
  if (directMatch) {
    return resolvePresence(directMatch[1]);
  }

  const arrowMatch = description.match(
    /(?:→|->)\s*(active|nearby|dormant|resolved|活跃|附近|临近|休眠|潜伏|已解决|终结)/iu,
  );
  if (arrowMatch) {
    return resolvePresence(arrowMatch[1]);
  }

  return null;
}

function resolvePresence(token: string): EntityPresence | null {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "active":
    case "活跃":
      return "active";
    case "nearby":
    case "附近":
    case "临近":
      return "nearby";
    case "dormant":
    case "休眠":
    case "潜伏":
      return "dormant";
    case "resolved":
    case "已解决":
    case "终结":
      return "resolved";
    default:
      return null;
  }
}

function tryParseRelationship(
  description: string,
  entityLookup: (nameOrId: string) => string | undefined,
): EntityRelationship | null {
  const establishMatch = description.match(
    /与\s*([^\s，。；;：:()（）]+)(?:[（(]([^)）]+)[）)])?\s*建立了\s*([^，。；;：:]+?)\s*关系/u,
  );
  if (establishMatch) {
    const targetName = stripWrappingQuotes(establishMatch[1].trim());
    const targetEntityId = resolveEntityId(
      targetName,
      establishMatch[2],
      entityLookup,
    );
    if (!targetEntityId) {
      return null;
    }

    const type = stripWrappingQuotes(establishMatch[3].trim()) || "关系更新";
    return {
      targetEntityId,
      type,
      description,
    };
  }

  if (!description.match(/^关系(?:更新|变更)?[：:]/u)) {
    return null;
  }

  const payload = description
    .replace(/^关系(?:更新|变更)?[：:]\s*/u, "")
    .trim();

  const targetMatch =
    payload.match(
      /(?:与|对)\s*([^\s，。；;：:()（）]+)(?:[（(]([^)）]+)[）)])?/u,
    ) ??
    payload.match(
      /目标(?:实体)?[：:]\s*([^\s，。；;：:()（）]+)(?:[（(]([^)）]+)[）)])?/u,
    );

  if (!targetMatch) {
    return null;
  }

  const targetName = stripWrappingQuotes(targetMatch[1].trim());
  const targetEntityId = resolveEntityId(
    targetName,
    targetMatch[2],
    entityLookup,
  );
  if (!targetEntityId) {
    return null;
  }

  const typeMatch =
    payload.match(/(?:关系类型|类型)[：:]\s*([^，。；;：:\n]+)/u) ??
    payload.match(/建立了\s*([^，。；;：:]+?)\s*关系/u) ??
    payload.match(/从\s*[^，。；;：:]+?\s*变为\s*([^，。；;：:\n]+)/u);

  const type =
    stripWrappingQuotes(typeMatch?.[1]?.trim() ?? "关系更新") || "关系更新";

  return {
    targetEntityId,
    type,
    description,
  };
}

function tryParseCreateEntity(
  content: string,
  fallbackName?: string,
  fallbackGameEntityId?: string,
): Extract<ArchiveUpdate, { type: "create_entity" }> | null {
  if (!/(新增实体|首次出现)/u.test(content)) {
    return null;
  }

  const prefixedNameMatch = content.match(
    /(?:新增实体|首次出现)(?:了|的)?(?:实体)?[：:]?\s*([^\s，。；;：:（）()]+)/u,
  );

  const rawFallbackName =
    fallbackName && !/^(新增实体|首次出现)$/u.test(fallbackName)
      ? fallbackName.trim()
      : "";
  const fallbackNameParts = splitEntityRef(rawFallbackName);

  const candidateName = stripWrappingQuotes(
    prefixedNameMatch?.[1]?.trim() ?? fallbackNameParts.name,
  );

  if (!candidateName) {
    return null;
  }

  const archetype = parseEntityArchetype(content);

  const initialStateMatch = content.match(
    /(?:初始状态|当前状态|状态(?:为|：|:)|现状)[：:]\s*([^。；;，,\n]+)/u,
  );
  const essenceMatch = content.match(
    /(?:本质|身份|设定|特征)[：:]\s*([^。；;，,\n]+)/u,
  );

  const initialState = stripWrappingQuotes(
    initialStateMatch?.[1]?.trim() ?? `${candidateName}首次出现。`,
  );
  const essence = stripWrappingQuotes(
    essenceMatch?.[1]?.trim() ?? initialState,
  );

  const normalizedFallbackGameEntityId = stripWrappingQuotes(
    fallbackGameEntityId?.trim() ?? "",
  );
  const gameEntityId =
    fallbackNameParts.gameEntityId ??
    (isLikelyGameEntityId(normalizedFallbackGameEntityId)
      ? normalizedFallbackGameEntityId
      : undefined) ??
    extractGameEntityIdFromText(content, candidateName);

  return {
    type: "create_entity",
    archetype,
    name: candidateName,
    essence,
    initialState,
    gameEntityId,
  };
}

function splitEntityRef(raw: string): { name: string; gameEntityId?: string } {
  const normalized = stripWrappingQuotes(raw.trim());
  if (!normalized) {
    return { name: "" };
  }

  const match = normalized.match(/^(.+?)\s*[（(]\s*([^)）]+)\s*[）)]$/u);
  if (!match) {
    return { name: normalized };
  }

  const name = stripWrappingQuotes(match[1].trim());
  const token = stripWrappingQuotes(match[2].trim());

  if (!name || !isLikelyGameEntityId(token)) {
    return { name: normalized };
  }

  return { name, gameEntityId: token };
}

function extractGameEntityIdFromText(
  content: string,
  preferredName: string,
): string | undefined {
  const escapedName = escapeRegExp(preferredName);
  const aroundName = content.match(
    new RegExp(`${escapedName}\\s*[（(]\\s*([^)）]+)\\s*[）)]`, "u"),
  );
  const aroundNameId = stripWrappingQuotes(aroundName?.[1]?.trim() ?? "");
  if (isLikelyGameEntityId(aroundNameId)) {
    return aroundNameId;
  }

  const genericPattern = /[（(]\s*([^)）]+)\s*[）)]/gu;
  for (const match of content.matchAll(genericPattern)) {
    const candidate = stripWrappingQuotes(match[1].trim());
    if (isLikelyGameEntityId(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function isLikelyGameEntityId(token: string): boolean {
  const normalized = token.trim();
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (
    lower === "character" ||
    lower === "event" ||
    lower === "faction" ||
    lower === "location" ||
    lower === "item_unique" ||
    lower === "quest" ||
    lower === "mystery" ||
    lower === "custom"
  ) {
    return false;
  }

  return (
    /^(?:chr|npc|entity|char|pc|monster|mob|item|loc|location|faction|quest|event|evt)(?:[_-][a-z0-9_-]+|\d+)$/iu.test(
      normalized,
    ) || /^[a-z][a-z0-9]*_[a-z0-9_-]+$/iu.test(normalized)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapStoryArcStatus(token: string): StoryArc["status"] | null {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "active":
    case "进行中":
      return "active";
    case "completed":
    case "已完成":
      return "completed";
    case "abandoned":
    case "放弃":
    case "废弃":
    case "已废弃":
      return "abandoned";
    case "modified":
    case "已修改":
    case "改写":
      return "modified";
    default:
      return null;
  }
}

function mapMilestoneStatus(token: string): Milestone["status"] | null {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "pending":
    case "待触发":
    case "未触发":
      return "pending";
    case "triggered":
    case "触发":
    case "已触发":
      return "triggered";
    case "skipped":
    case "跳过":
    case "已跳过":
      return "skipped";
    default:
      return null;
  }
}

function mapForeshadowStatus(token: string): Foreshadow["status"] | null {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "planted":
    case "埋下":
    case "已埋下":
      return "planted";
    case "hinted":
    case "暗示中":
    case "已暗示":
      return "hinted";
    case "revealed":
    case "揭示":
    case "已揭示":
      return "revealed";
    case "abandoned":
    case "放弃":
    case "废弃":
    case "已放弃":
      return "abandoned";
    default:
      return null;
  }
}

function parseEntityArchetype(content: string): EntityArchetype {
  const mappedFromType = mapArchetypeToken(
    content.match(
      /(?:类型|archetype)[：:]\s*(character|event|faction|location|item_unique|quest|mystery|custom|角色|人物|事件|势力|地点|道具|物品|任务|谜团|自定义)/iu,
    )?.[1],
  );
  if (mappedFromType) {
    return mappedFromType;
  }

  const mappedFromBracket = mapArchetypeToken(
    content.match(
      /[（(]\s*(character|event|faction|location|item_unique|quest|mystery|custom|角色|人物|事件|势力|地点|道具|物品|任务|谜团|自定义)\s*[）)]/iu,
    )?.[1],
  );
  if (mappedFromBracket) {
    return mappedFromBracket;
  }

  return "character";
}

function mapArchetypeToken(token: string | undefined): EntityArchetype | null {
  if (!token) {
    return null;
  }

  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "character":
    case "角色":
    case "人物":
      return "character";
    case "event":
    case "事件":
      return "event";
    case "faction":
    case "势力":
      return "faction";
    case "location":
    case "地点":
      return "location";
    case "item_unique":
    case "道具":
    case "物品":
      return "item_unique";
    case "quest":
    case "任务":
      return "quest";
    case "mystery":
    case "谜团":
      return "mystery";
    case "custom":
    case "自定义":
      return "custom";
    default:
      return null;
  }
}

function stripWrappingQuotes(input: string): string {
  return input.replace(/^["'“”‘’`]+|["'“”‘’`]+$/gu, "");
}

/**
 * 从文本中提取指定 XML 标签的内容
 */
function extractXmlContent(text: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = text.match(regex);
  return match ? match[1] : null;
}

/**
 * 导演 AI 输出解析错误
 */
export class DirectorOutputParseError extends Error {
  public readonly rawOutput: string;

  constructor(message: string, rawOutput: string) {
    super(message);
    this.name = "DirectorOutputParseError";
    this.rawOutput = rawOutput;
  }
}
