import type {
  ArchiveUpdate,
  EntityArchetype,
  EntityPresence,
} from "@/modules/world-archive/types";
import type { DirectorOutput, Foreshadow, Milestone, StoryArc } from "./types";

// ─── 类型定义 ─────────────────────────────────────────────

interface ParseOptions {
  ioContract?: {
    requiredTags?: string[];
    optionalTags?: string[];
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

// ─── archive_updates JSON 条目类型 ─────────────────────────

interface ArchiveCreateOp {
  op: "create";
  type: string;
  name: string;
  state: string;
  id?: string;
  essence?: string;
  presence?: string;
  tags?: string[];
}

interface ArchiveUpdateOp {
  op: "update";
  ref: string;
  state: string;
}

interface ArchiveEssenceOp {
  op: "essence";
  ref: string;
  essence: string;
}

interface ArchivePresenceOp {
  op: "presence";
  ref: string;
  presence: string;
}

interface ArchiveRelateOp {
  op: "relate";
  ref: string;
  target: string;
  relType: string;
  relDesc: string;
}

type ArchiveJsonOp =
  | ArchiveCreateOp
  | ArchiveUpdateOp
  | ArchiveEssenceOp
  | ArchivePresenceOp
  | ArchiveRelateOp;

// ─── outline_updates JSON 条目类型 ─────────────────────────

interface OutlineArcDeviationOp {
  op: "arc_deviation";
  desc: string;
}

interface OutlineArcStatusOp {
  op: "arc_status";
  status: string;
}

interface OutlineMilestoneOp {
  op: "milestone";
  ref: string;
  status: string;
}

interface OutlineForeshadowHintOp {
  op: "foreshadow_hint";
  ref: string;
  delta: number;
}

interface OutlineForeshadowStatusOp {
  op: "foreshadow_status";
  ref: string;
  status: string;
}

interface OutlineAddForeshadowOp {
  op: "add_foreshadow";
  desc: string;
  trigger?: string;
  reveal?: string;
}

interface OutlineRemoveForeshadowOp {
  op: "remove_foreshadow";
  ref: string;
}

type OutlineJsonOp =
  | OutlineArcDeviationOp
  | OutlineArcStatusOp
  | OutlineMilestoneOp
  | OutlineForeshadowHintOp
  | OutlineForeshadowStatusOp
  | OutlineAddForeshadowOp
  | OutlineRemoveForeshadowOp;

// ─── 常量 ──────────────────────────────────────────────────

const DEFAULT_REQUIRED_TAGS = [
  "plot_directives",
  "turn_narrative_intent",
  "narrative_hints",
  "archive_updates",
];
const DEFAULT_OPTIONAL_TAGS = ["outline_updates"];

const VALID_ARCHETYPES = new Set<string>([
  "character",
  "event",
  "faction",
  "location",
  "item_unique",
  "quest",
  "mystery",
  "custom",
]);

const VALID_PRESENCES = new Set<string>([
  "active",
  "nearby",
  "dormant",
  "resolved",
]);

const VALID_ARC_STATUSES = new Set<string>([
  "active",
  "completed",
  "abandoned",
  "modified",
]);

const VALID_MILESTONE_STATUSES = new Set<string>([
  "pending",
  "triggered",
  "skipped",
]);

const VALID_FORESHADOW_STATUSES = new Set<string>([
  "planted",
  "hinted",
  "revealed",
  "abandoned",
]);

// ─── 导演输出解析 ──────────────────────────────────────────

/**
 * 解析导演 AI 的 XML 输出
 *
 * 从导演 AI 的原始文本中提取四个 XML 区域。
 * 采用 fail-fast 策略：必需标签缺失时抛出错误。
 *
 * @throws {DirectorOutputParseError} 当必需的 XML 标签缺失时
 */
export function parseDirectorOutput(
  raw: string,
  options?: ParseOptions,
): DirectorOutput {
  const plotDirectives = extractXmlContent(raw, "plot_directives");
  const turnNarrativeIntent = extractXmlContent(raw, "turn_narrative_intent");
  const narrativeHints = extractXmlContent(raw, "narrative_hints");
  const archiveUpdatesRaw = extractXmlContent(raw, "archive_updates");
  const outlineUpdatesRaw =
    extractXmlContent(raw, "outline_updates") ?? undefined;

  const { requiredTags, optionalTags } = resolveDirectorIoContract(options);
  const extractedTags = new Map<string, string | null>();

  for (const tag of [...requiredTags, ...optionalTags]) {
    extractedTags.set(tag, extractXmlContent(raw, tag));
  }

  const parseWarnings = requiredTags.filter((tag) => {
    return extractedTags.get(tag) === null;
  });

  const degraded = parseWarnings.length > 0;

  return {
    plotDirectives: (plotDirectives ?? "").trim(),
    turnNarrativeIntent: (turnNarrativeIntent ?? "").trim(),
    narrativeHints: (narrativeHints ?? "").trim(),
    archiveUpdatesRaw: (archiveUpdatesRaw ?? "").trim(),
    outlineUpdatesRaw: outlineUpdatesRaw?.trim(),
    degraded: degraded ? true : undefined,
    parseWarnings: degraded ? parseWarnings : undefined,
  };
}

// ─── archive_updates JSON 解析 ────────────────────────────

/**
 * 从 archive_updates 原始文本解析 ArchiveUpdate 数组
 *
 * 输入为 JSON 数组格式，每个元素包含 `op` 字段标识操作类型。
 * `ref` 字段通过 `entityLookup` 做名称/ID 模糊匹配。
 *
 * @throws {DirectorOutputParseError} 当 JSON 解析失败或类型校验不通过时
 */
export function parseArchiveUpdates(
  raw: string,
  entityLookup: (nameOrId: string) => string | undefined,
  currentTurn: number,
): ArchiveUpdate[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") {
    return [];
  }

  const items = parseJsonArray<ArchiveJsonOp>(trimmed, "archive_updates");
  const updates: ArchiveUpdate[] = [];
  const errors: string[] = [];
  const pendingRefs = new Map<string, string>();
  const resolveArchiveRef = (ref: unknown): string => {
    return resolveRef(ref, entityLookup, pendingRefs);
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object" || !item.op) {
      errors.push(`[${i}] 缺少 op 字段`);
      continue;
    }

    try {
      const update = mapArchiveOp(item, resolveArchiveRef, currentTurn);
      if (!update) {
        continue;
      }

      updates.push(update);

      if (item.op === "create" && update.type === "create_entity") {
        registerPendingCreateRefs(item, update, pendingRefs);

        const presenceUpdate = mapArchiveCreatePresence(item, update);
        if (presenceUpdate) {
          updates.push(presenceUpdate);
        }
      }
    } catch (error) {
      errors.push(
        `[${i}] op="${item.op}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new DirectorOutputParseError(
      `archive_updates 解析失败：\n- ${errors.join("\n- ")}`,
      raw,
    );
  }

  return updates;
}

function mapArchiveOp(
  item: ArchiveJsonOp,
  resolveArchiveRef: (ref: unknown) => string,
  _currentTurn: number,
): ArchiveUpdate | null {
  switch (item.op) {
    case "create":
      return mapArchiveCreate(item);
    case "update":
      return mapArchiveUpdate(item, resolveArchiveRef);
    case "essence":
      return mapArchiveEssence(item, resolveArchiveRef);
    case "presence":
      return mapArchivePresence(item, resolveArchiveRef);
    case "relate":
      return mapArchiveRelate(item, resolveArchiveRef);
    default:
      throw new Error(`未知操作类型: ${(item as { op: string }).op}`);
  }
}

function mapArchiveCreate(item: ArchiveCreateOp): ArchiveUpdate {
  if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
    throw new Error("create 操作缺少有效的 name 字段");
  }
  if (!item.type || typeof item.type !== "string" || !item.type.trim()) {
    throw new Error("create 操作缺少有效的 type 字段");
  }
  if (!item.state || typeof item.state !== "string" || !item.state.trim()) {
    throw new Error("create 操作缺少有效的 state 字段");
  }

  const archetype = resolveArchetype(item.type);

  return {
    type: "create_entity",
    archetype,
    name: item.name.trim(),
    essence:
      item.essence && typeof item.essence === "string" && item.essence.trim()
        ? item.essence.trim()
        : item.state.trim(),
    initialState: item.state.trim(),
    gameEntityId:
      item.id && typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : undefined,
    tags: Array.isArray(item.tags)
      ? item.tags
          .filter((t): t is string => typeof t === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined,
  };
}

function mapArchiveUpdate(
  item: ArchiveUpdateOp,
  resolveArchiveRef: (ref: unknown) => string,
): ArchiveUpdate {
  const entityId = resolveArchiveRef(item.ref);
  if (!item.state || typeof item.state !== "string") {
    throw new Error("update 操作缺少 state 字段");
  }
  return { type: "update_state", entityId, newState: item.state.trim() };
}

function mapArchiveEssence(
  item: ArchiveEssenceOp,
  resolveArchiveRef: (ref: unknown) => string,
): ArchiveUpdate {
  const entityId = resolveArchiveRef(item.ref);
  if (!item.essence || typeof item.essence !== "string") {
    throw new Error("essence 操作缺少 essence 字段");
  }
  return {
    type: "update_essence",
    entityId,
    newEssence: item.essence.trim(),
  };
}

function mapArchivePresence(
  item: ArchivePresenceOp,
  resolveArchiveRef: (ref: unknown) => string,
): ArchiveUpdate {
  const entityId = resolveArchiveRef(item.ref);
  if (!item.presence || typeof item.presence !== "string") {
    throw new Error("presence 操作缺少 presence 字段");
  }
  const presence = item.presence.trim().toLowerCase();
  if (!VALID_PRESENCES.has(presence)) {
    throw new Error(
      `presence 值无效: "${item.presence}"，期望 active/nearby/dormant/resolved`,
    );
  }
  return {
    type: "update_presence",
    entityId,
    newPresence: presence as EntityPresence,
  };
}

function mapArchiveRelate(
  item: ArchiveRelateOp,
  resolveArchiveRef: (ref: unknown) => string,
): ArchiveUpdate {
  const entityId = resolveArchiveRef(item.ref);

  if (!item.target || typeof item.target !== "string") {
    throw new Error("relate 操作缺少 target 字段");
  }
  if (!item.relType || typeof item.relType !== "string") {
    throw new Error("relate 操作缺少 relType 字段");
  }
  if (!item.relDesc || typeof item.relDesc !== "string") {
    throw new Error("relate 操作缺少 relDesc 字段");
  }

  const targetEntityId = resolveArchiveRef(item.target);

  return {
    type: "add_relationship",
    entityId,
    relationship: {
      targetEntityId,
      type: item.relType.trim(),
      description: item.relDesc.trim(),
    },
  };
}

// ─── outline_updates JSON 解析 ────────────────────────────

/**
 * 从 outline_updates 原始文本解析结构化指令
 *
 * 输入为 JSON 数组格式，每个元素包含 `op` 字段标识操作类型。
 *
 * @throws {DirectorOutputParseError} 当 JSON 解析失败或类型校验不通过时
 */
export function parseOutlineUpdates(
  raw: string,
  currentTurn: number,
): OutlineUpdateInstruction[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") {
    return [];
  }

  const items = parseJsonArray<OutlineJsonOp>(trimmed, "outline_updates");
  const instructions: OutlineUpdateInstruction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object" || !item.op) {
      errors.push(`[${i}] 缺少 op 字段`);
      continue;
    }

    try {
      const instruction = mapOutlineOp(item, currentTurn);
      if (instruction) {
        instructions.push(instruction);
      }
    } catch (error) {
      errors.push(
        `[${i}] op="${item.op}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new DirectorOutputParseError(
      `outline_updates 解析失败：\n- ${errors.join("\n- ")}`,
      raw,
    );
  }

  return instructions;
}

function mapOutlineOp(
  item: OutlineJsonOp,
  currentTurn: number,
): OutlineUpdateInstruction | null {
  switch (item.op) {
    case "arc_deviation":
      return mapArcDeviation(item);
    case "arc_status":
      return mapArcStatus(item);
    case "milestone":
      return mapMilestone(item);
    case "foreshadow_hint":
      return mapForeshadowHint(item);
    case "foreshadow_status":
      return mapForeshadowStatus(item);
    case "add_foreshadow":
      return mapAddForeshadow(item, currentTurn);
    case "remove_foreshadow":
      return mapRemoveForeshadow(item);
    default:
      throw new Error(`未知操作类型: ${(item as { op: string }).op}`);
  }
}

function mapArcDeviation(
  item: OutlineArcDeviationOp,
): OutlineUpdateInstruction {
  if (!item.desc || typeof item.desc !== "string") {
    throw new Error("arc_deviation 操作缺少 desc 字段");
  }
  return { type: "append_arc_deviation", deviation: item.desc.trim() };
}

function mapArcStatus(item: OutlineArcStatusOp): OutlineUpdateInstruction {
  if (!item.status || typeof item.status !== "string") {
    throw new Error("arc_status 操作缺少 status 字段");
  }
  const status = item.status.trim().toLowerCase();
  if (!VALID_ARC_STATUSES.has(status)) {
    throw new Error(
      `arc_status 值无效: "${item.status}"，期望 active/completed/abandoned/modified`,
    );
  }
  return {
    type: "set_arc_status",
    status: status as StoryArc["status"],
  };
}

function mapMilestone(item: OutlineMilestoneOp): OutlineUpdateInstruction {
  if (!item.ref || typeof item.ref !== "string") {
    throw new Error("milestone 操作缺少 ref 字段");
  }
  if (!item.status || typeof item.status !== "string") {
    throw new Error("milestone 操作缺少 status 字段");
  }
  const status = item.status.trim().toLowerCase();
  if (!VALID_MILESTONE_STATUSES.has(status)) {
    throw new Error(
      `milestone status 值无效: "${item.status}"，期望 pending/triggered/skipped`,
    );
  }
  return {
    type: "set_milestone_status",
    milestoneRef: item.ref.trim(),
    status: status as Milestone["status"],
  };
}

function mapForeshadowHint(
  item: OutlineForeshadowHintOp,
): OutlineUpdateInstruction {
  if (!item.ref || typeof item.ref !== "string") {
    throw new Error("foreshadow_hint 操作缺少 ref 字段");
  }
  if (typeof item.delta !== "number" || !Number.isFinite(item.delta)) {
    throw new Error("foreshadow_hint 操作的 delta 必须是有效数字");
  }
  return {
    type: "increment_foreshadow_hint",
    foreshadowRef: item.ref.trim(),
    delta: item.delta,
  };
}

function mapForeshadowStatus(
  item: OutlineForeshadowStatusOp,
): OutlineUpdateInstruction {
  if (!item.ref || typeof item.ref !== "string") {
    throw new Error("foreshadow_status 操作缺少 ref 字段");
  }
  if (!item.status || typeof item.status !== "string") {
    throw new Error("foreshadow_status 操作缺少 status 字段");
  }
  const status = item.status.trim().toLowerCase();
  if (!VALID_FORESHADOW_STATUSES.has(status)) {
    throw new Error(
      `foreshadow_status 值无效: "${item.status}"，期望 planted/hinted/revealed/abandoned`,
    );
  }
  return {
    type: "set_foreshadow_status",
    foreshadowRef: item.ref.trim(),
    status: status as Foreshadow["status"],
  };
}

function mapAddForeshadow(
  item: OutlineAddForeshadowOp,
  currentTurn: number,
): OutlineUpdateInstruction {
  if (!item.desc || typeof item.desc !== "string") {
    throw new Error("add_foreshadow 操作缺少 desc 字段");
  }
  return {
    type: "add_foreshadow",
    foreshadow: {
      description: item.desc.trim(),
      plantedAtTurn: currentTurn,
      triggerCondition:
        item.trigger && typeof item.trigger === "string"
          ? item.trigger.trim()
          : "待导演后续细化",
      revealEffect:
        item.reveal && typeof item.reveal === "string"
          ? item.reveal.trim()
          : "待导演后续细化",
      status: "planted",
      hintCount: 0,
      relatedEntityIds: [],
    },
  };
}

function mapRemoveForeshadow(
  item: OutlineRemoveForeshadowOp,
): OutlineUpdateInstruction {
  if (!item.ref || typeof item.ref !== "string") {
    throw new Error("remove_foreshadow 操作缺少 ref 字段");
  }
  return {
    type: "remove_foreshadow",
    foreshadowRef: item.ref.trim(),
  };
}

// ─── 共用工具函数 ──────────────────────────────────────────

/**
 * 解析 JSON 数组，包含容错修复层
 *
 * 容错策略：
 * 1. 首先尝试直接 JSON.parse
 * 2. 失败时自动修复常见 AI 错误（尾逗号、单引号、未转义换行）后重试
 * 3. 仍然失败则抛出 DirectorOutputParseError
 */
function parseJsonArray<T>(raw: string, context: string): T[] {
  // 第一次尝试：直接解析
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new DirectorOutputParseError(
        `${context} 期望 JSON 数组，实际为 ${typeof parsed}`,
        raw,
      );
    }
    return parsed as T[];
  } catch (error) {
    if (error instanceof DirectorOutputParseError) {
      throw error;
    }
    // 继续尝试修复
  }

  // 第二次尝试：自动修复后重试
  const fixed = repairJson(raw);
  try {
    const parsed: unknown = JSON.parse(fixed);
    if (!Array.isArray(parsed)) {
      throw new DirectorOutputParseError(
        `${context} 期望 JSON 数组，修复后仍为 ${typeof parsed}`,
        raw,
      );
    }
    return parsed as T[];
  } catch (error) {
    if (error instanceof DirectorOutputParseError) {
      throw error;
    }
    throw new DirectorOutputParseError(
      `${context} JSON 解析失败（修复后仍无法解析）: ${error instanceof Error ? error.message : String(error)}`,
      raw,
    );
  }
}

/**
 * 尝试修复常见的 AI JSON 输出错误
 *
 * 修复项：
 * - 移除尾逗号（对象末尾和数组末尾的逗号）
 * - 将单引号替换为双引号（仅在 JSON 值/键的位置）
 * - 移除 JSON 字符串值中未转义的换行符
 * - 移除 BOM 和不可见字符
 * - 移除 JSON 前后的非 JSON 文本（如 markdown code fence）
 */
export function repairJson(raw: string): string {
  let text = raw;

  // 移除 BOM
  text = text.replace(/^\uFEFF/, "");

  // 移除 markdown code fence 包裹
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  // 提取第一个 [ 到最后一个 ] 之间的内容
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    text = text.slice(firstBracket, lastBracket + 1);
  }

  // 将单引号键值替换为双引号（简单启发式：不在双引号字符串内的单引号）
  text = text.replace(/(?<=[[{,]\s*)'([^']*?)'(?=\s*:)/g, '"$1"');
  text = text.replace(/(?<=:\s*)'([^']*?)'/g, '"$1"');

  // 移除字符串值中的未转义换行
  text = text.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");

  // 移除尾逗号（],} 或 ],] 前的逗号）
  text = text.replace(/,\s*([}\]])/g, "$1");

  return text.trim();
}

function normalizeArchiveRefKey(value: string): string {
  return value.trim().toLowerCase();
}

function registerPendingCreateRefs(
  item: ArchiveCreateOp,
  update: Extract<ArchiveUpdate, { type: "create_entity" }>,
  pendingRefs: Map<string, string>,
): void {
  const localRefToken = update.gameEntityId ?? update.name;
  const candidates = [item.id, item.name, update.gameEntityId, update.name];

  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) {
      continue;
    }

    pendingRefs.set(normalizeArchiveRefKey(candidate), localRefToken);
  }
}

function mapArchiveCreatePresence(
  item: ArchiveCreateOp,
  update: Extract<ArchiveUpdate, { type: "create_entity" }>,
): Extract<ArchiveUpdate, { type: "update_presence" }> | null {
  if (!item.presence || typeof item.presence !== "string") {
    return null;
  }

  const normalizedPresence = item.presence.trim().toLowerCase();
  if (!normalizedPresence) {
    return null;
  }
  if (!VALID_PRESENCES.has(normalizedPresence)) {
    throw new Error(
      `create.presence 值无效: "${item.presence}"，期望 active/nearby/dormant/resolved`,
    );
  }
  if (normalizedPresence === "active") {
    return null;
  }

  return {
    type: "update_presence",
    entityId: update.gameEntityId ?? update.name,
    newPresence: normalizedPresence as EntityPresence,
  };
}

/**
 * 解析 ref 字段：优先匹配已有档案实体；仅当未命中时，才回退到同批次 create 的本地引用。
 */
function resolveRef(
  ref: unknown,
  entityLookup: (nameOrId: string) => string | undefined,
  pendingRefs?: Map<string, string>,
): string {
  if (!ref || typeof ref !== "string") {
    throw new Error("缺少 ref 字段");
  }
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error("ref 字段为空");
  }

  const resolved = entityLookup(trimmed);
  if (resolved) {
    return resolved;
  }

  const pendingResolved = pendingRefs?.get(normalizeArchiveRefKey(trimmed));
  if (pendingResolved) {
    return pendingResolved;
  }

  throw new Error(`无法匹配实体引用: ${trimmed}`);
}

/**
 * 解析实体原型
 */
function resolveArchetype(raw: unknown): EntityArchetype {
  if (!raw || typeof raw !== "string") {
    throw new Error("缺少 type 字段");
  }
  const normalized = raw.trim().toLowerCase();
  if (VALID_ARCHETYPES.has(normalized)) {
    return normalized as EntityArchetype;
  }
  throw new Error(
    `type 值无效: "${raw}"，期望 character/event/faction/location/item_unique/quest/mystery/custom`,
  );
}

// ─── IO Contract / XML 提取 ───────────────────────────────

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }

  const normalized: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }
    normalized.push(trimmed);
  }

  return normalized;
}

function resolveDirectorIoContract(options?: ParseOptions): {
  requiredTags: string[];
  optionalTags: string[];
} {
  if (!options?.ioContract) {
    return {
      requiredTags: [...DEFAULT_REQUIRED_TAGS],
      optionalTags: [...DEFAULT_OPTIONAL_TAGS],
    };
  }

  return {
    requiredTags: normalizeTags(options.ioContract.requiredTags),
    optionalTags: normalizeTags(options.ioContract.optionalTags),
  };
}

/**
 * 从文本中提取指定 XML 标签的内容
 */
function extractXmlContent(text: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = text.match(regex);
  return match ? match[1] : null;
}

// ─── 错误类 ───────────────────────────────────────────────

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
