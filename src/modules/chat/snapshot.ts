import type {
  ConversationSnapshot,
  MessageSnapshot,
} from "@/domain/entities/checkpoint";
import {
  SNAPSHOT_SKIP,
  type SnapshotFieldConfig,
  type SnapshotValueTransformer,
} from "@/modules/checkpoint/snapshot-api";

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

export const chatSnapshotFields: SnapshotFieldConfig[] = [
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
];

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
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
