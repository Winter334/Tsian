import type {
  Character,
  CharacterStatus,
  ControlType,
} from "@/domain/entities/character";
import type {
  CharacterSnapshot,
  ConversationSnapshot,
  ItemSnapshot,
  MessageSnapshot,
  SkillSnapshot,
} from "@/domain/entities/checkpoint";
import {
  characterToYMap,
  yMapToCharacter,
} from "@/modules/game/repository/entity-codec";
import {
  itemInstanceToYMap,
  skillInstanceToYMap,
  yMapToItemInstance,
  yMapToSkillInstance,
} from "@/modules/inventory/repository/inventory-codec";
import * as Y from "yjs";

/** Yjs 数据结构策略类型 */
export type SnapshotStrategy =
  | "plainMap"
  | "mapOfArray"
  | "nestedYMap"
  | "mapOfArrayOfYMap"
  | "memoryStructure"
  | "plainValue";

/** 编解码器接口 */
export interface FieldCodec<T = unknown> {
  /** Y.Map → 普通对象 */
  decode: (yMap: Y.Map<unknown>) => T;
  /** 普通对象 → Y.Map */
  encode: (obj: T) => Y.Map<unknown>;
}

/** 变换跳过标记 */
export const SNAPSHOT_SKIP = Symbol("checkpoint.snapshot.skip");

/** 字段值变换结果 */
export type SnapshotTransformResult = unknown | typeof SNAPSHOT_SKIP;

/** plainMap / mapOfArray 的值变换器 */
export interface SnapshotValueTransformer {
  /** 提取阶段：Yjs 值 -> 快照值 */
  decode?: (value: unknown, key: string) => SnapshotTransformResult;
  /** 恢复阶段：快照值 -> Yjs 值 */
  encode?: (value: unknown, key: string) => SnapshotTransformResult;
}

/** 快照字段配置 */
export interface SnapshotFieldConfig {
  /** SaveSlot 中的 key */
  key: string;
  /** Yjs 数据结构策略 */
  strategy: SnapshotStrategy;
  /** nestedYMap 和 mapOfArrayOfYMap 策略需要编解码器 */
  codec?: FieldCodec<unknown>;
  /** plainMap 和 mapOfArray 可选值变换器 */
  valueTransformer?: SnapshotValueTransformer;
}

const conversationValueTransformer: SnapshotValueTransformer = {
  decode: (value, fallbackId) => {
    if (!isRecord(value)) return SNAPSHOT_SKIP;
    return toConversationSnapshot(value, fallbackId);
  },
  encode: (value, fallbackId) => toConversationRestoreValue(value, fallbackId),
};

const messageValueTransformer: SnapshotValueTransformer = {
  decode: (value, fallbackConversationId) => {
    if (!isRecord(value)) return SNAPSHOT_SKIP;
    return toMessageSnapshot(value, fallbackConversationId);
  },
  encode: (value, fallbackConversationId) =>
    normalizeMessage(value, fallbackConversationId),
};

const characterCodec: FieldCodec<CharacterSnapshot> = {
  decode: (map) => toCharacterSnapshot(yMapToCharacter(map)),
  encode: (snapshot) => characterToYMap(snapshotToCharacter(snapshot)),
};

const inventoryCodec: FieldCodec<ItemSnapshot> = {
  decode: yMapToItemInstance,
  encode: itemInstanceToYMap,
};

const skillCodec: FieldCodec<SkillSnapshot> = {
  decode: yMapToSkillInstance,
  encode: skillInstanceToYMap,
};

export const SNAPSHOT_FIELDS: SnapshotFieldConfig[] = [
  {
    key: "conversations",
    strategy: "plainMap",
    valueTransformer: conversationValueTransformer,
  },
  {
    key: "messages",
    strategy: "mapOfArray",
    valueTransformer: messageValueTransformer,
  },
  {
    key: "characters",
    strategy: "nestedYMap",
    codec: toUnknownCodec(characterCodec, asCharacterSnapshot),
  },
  {
    key: "inventories",
    strategy: "mapOfArrayOfYMap",
    codec: toUnknownCodec(inventoryCodec, asItemSnapshot),
  },
  {
    key: "skills",
    strategy: "mapOfArrayOfYMap",
    codec: toUnknownCodec(skillCodec, asSkillSnapshot),
  },
  { key: "memory", strategy: "memoryStructure" },
  { key: "gameState", strategy: "plainValue" },
];

/** 不参与快照的元数据 key */
export const SNAPSHOT_EXCLUDED_KEYS = new Set([
  "id",
  "name",
  "createdAt",
  "updatedAt",
  "type",
  "lastRoomId",
  "lastRoomCode",
  "memberCount",
  "members",
  "maxPlayers",
  "turnDuration",
  "checkpoints",
]);

function toUnknownCodec<T>(
  codec: FieldCodec<T>,
  cast: (value: unknown) => T,
): FieldCodec<unknown> {
  return {
    decode: (yMap) => codec.decode(yMap),
    encode: (obj) => codec.encode(cast(obj)),
  };
}

function asCharacterSnapshot(value: unknown): CharacterSnapshot {
  return value as CharacterSnapshot;
}

function asItemSnapshot(value: unknown): ItemSnapshot {
  return value as ItemSnapshot;
}

function asSkillSnapshot(value: unknown): SkillSnapshot {
  return value as SkillSnapshot;
}

function toConversationSnapshot(
  value: Record<string, unknown>,
  fallbackId: string,
): ConversationSnapshot {
  const now = Date.now();
  const createdAt = toNumber(value.createdAt, now);
  const updatedAt = toNumber(value.updatedAt, createdAt);

  const snapshot: ConversationSnapshot = {
    id: typeof value.id === "string" ? value.id : fallbackId,
    title: typeof value.title === "string" ? value.title : "未命名会话",
    characterIds: toStringArray(value.characterIds),
    createdAt,
    updatedAt,
  };

  if (typeof value.systemPrompt === "string") {
    snapshot.systemPrompt = value.systemPrompt;
  }
  if (isRecord(value.settings)) {
    snapshot.settings = value.settings as ConversationSnapshot["settings"];
  }
  if (isRecord(value.metadata)) {
    snapshot.metadata = value.metadata;
  }

  return snapshot;
}

function toConversationRestoreValue(
  value: unknown,
  fallbackId: string,
): Record<string, unknown> & { id: string } {
  const conversation = isRecord(value) ? value : {};
  const normalizedId =
    typeof conversation.id === "string" ? conversation.id : fallbackId;

  return {
    ...conversation,
    id: normalizedId,
    characterIds: toStringArray(conversation.characterIds),
    metadata: isRecord(conversation.metadata)
      ? conversation.metadata
      : undefined,
  };
}

function toMessageSnapshot(
  value: Record<string, unknown>,
  fallbackConversationId: string,
): MessageSnapshot {
  const now = Date.now();
  const createdAt = toNumber(value.createdAt, now);
  const updatedAt = toNumber(value.updatedAt, createdAt);

  const snapshot: MessageSnapshot = {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    role: normalizeMessageRole(value.role),
    content: typeof value.content === "string" ? value.content : "",
    status: normalizeMessageStatus(value.status),
    conversationId:
      typeof value.conversationId === "string"
        ? value.conversationId
        : fallbackConversationId,
    createdAt,
    updatedAt,
  };

  if (typeof value.characterId === "string") {
    snapshot.characterId = value.characterId;
  }
  if (typeof value.error === "string") {
    snapshot.error = value.error;
  }
  if (isRecord(value.metadata)) {
    snapshot.metadata = value.metadata;
  }

  return snapshot;
}

function normalizeMessage(
  value: unknown,
  fallbackConversationId: string,
): MessageSnapshot {
  const message = isRecord(value) ? value : {};
  const now = Date.now();
  const createdAt = toNumber(message.createdAt, now);
  const updatedAt = toNumber(message.updatedAt, createdAt);

  return {
    ...message,
    id: typeof message.id === "string" ? message.id : crypto.randomUUID(),
    role: normalizeMessageRole(message.role),
    status: normalizeMessageStatus(message.status),
    content: typeof message.content === "string" ? message.content : "",
    conversationId:
      typeof message.conversationId === "string"
        ? message.conversationId
        : fallbackConversationId,
    characterId:
      typeof message.characterId === "string" ? message.characterId : undefined,
    error: typeof message.error === "string" ? message.error : undefined,
    metadata: isRecord(message.metadata) ? message.metadata : undefined,
    createdAt,
    updatedAt,
  };
}

function toCharacterSnapshot(character: Character): CharacterSnapshot {
  const snapshot: CharacterSnapshot = {
    id: character.id,
    name: character.name,
    creatorUniqueTag: character.creatorUniqueTag,
    operatorUserId: character.operatorUserId,
    operatorUniqueTag: character.operatorUniqueTag,
    status: character.status,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    controlType: character.controlType,
  };

  if (typeof character.description === "string") {
    snapshot.description = character.description;
  }
  if (typeof character.personality === "string") {
    snapshot.personality = character.personality;
  }
  if (typeof character.appearance === "string") {
    snapshot.appearance = character.appearance;
  }
  if (isRecord(character.attributes)) {
    snapshot.attributes = character.attributes;
  }
  if (isRecord(character.tags)) {
    snapshot.tags = character.tags;
  }
  if (isRecord(character.dimensionSelections)) {
    snapshot.dimensionSelections = character.dimensionSelections as Record<
      string,
      string
    >;
  }
  if (Array.isArray(character.talentIds)) {
    snapshot.talentIds = character.talentIds.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return snapshot;
}

function snapshotToCharacter(snapshot: CharacterSnapshot): Character {
  const now = Date.now();

  const character: Character = {
    id: typeof snapshot.id === "string" ? snapshot.id : crypto.randomUUID(),
    name: typeof snapshot.name === "string" ? snapshot.name : "未命名",
    controlType: isControlType(snapshot.controlType)
      ? snapshot.controlType
      : "player",
    creatorUniqueTag:
      typeof snapshot.creatorUniqueTag === "string"
        ? snapshot.creatorUniqueTag
        : "",
    operatorUserId:
      typeof snapshot.operatorUserId === "string"
        ? snapshot.operatorUserId
        : "",
    operatorUniqueTag:
      typeof snapshot.operatorUniqueTag === "string"
        ? snapshot.operatorUniqueTag
        : "",
    status: isCharacterStatus(snapshot.status) ? snapshot.status : "active",
    createdAt:
      typeof snapshot.createdAt === "number" ? snapshot.createdAt : now,
    updatedAt:
      typeof snapshot.updatedAt === "number" ? snapshot.updatedAt : now,
  };

  if (typeof snapshot.description === "string") {
    character.description = snapshot.description;
  }
  if (typeof snapshot.personality === "string") {
    character.personality = snapshot.personality;
  }
  if (typeof snapshot.appearance === "string") {
    character.appearance = snapshot.appearance;
  }
  if (isRecord(snapshot.attributes)) {
    character.attributes = snapshot.attributes;
  }
  if (isRecord(snapshot.tags)) {
    character.tags = snapshot.tags;
  }
  if (isRecord(snapshot.dimensionSelections)) {
    character.dimensionSelections = snapshot.dimensionSelections as Record<
      string,
      string
    >;
  }
  if (Array.isArray(snapshot.talentIds)) {
    character.talentIds = snapshot.talentIds.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return character;
}

function normalizeMessageRole(value: unknown): MessageSnapshot["role"] {
  return value === "user" || value === "assistant" || value === "system"
    ? value
    : "system";
}

function normalizeMessageStatus(value: unknown): MessageSnapshot["status"] {
  return value === "pending" ||
    value === "streaming" ||
    value === "complete" ||
    value === "error"
    ? value
    : "complete";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function isCharacterStatus(value: unknown): value is CharacterStatus {
  return (
    value === "active" ||
    value === "off_scene" ||
    value === "archived" ||
    value === "dead"
  );
}

function isControlType(value: unknown): value is ControlType {
  return value === "player" || value === "npc" || value === "companion";
}
