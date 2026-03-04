import type {
  Command,
  CommandContext,
  CommandMiddleware,
  CommandResult,
} from "../command-bus";

export type PermissionRole = "host" | "member" | "public";

export interface RoomPermissionMember {
  userId: string;
  role?: string;
}

export interface RoomPermissionSnapshot {
  roomId: string | null;
  hostUserId: string | null;
  localUserId?: string | null;
  isLocalHost?: boolean;
  members: RoomPermissionMember[];
}

export interface RoomPermissionValidationContext {
  command: Command<unknown>;
  context: CommandContext;
  payload: unknown;
  sender: string | null;
  roomId: string | null;
  snapshot: RoomPermissionSnapshot | null;
}

export interface PermissionRule {
  commandPattern: string;
  requiredRole: PermissionRole;
  validatePayload?: (ctx: RoomPermissionValidationContext) => string | null;
}

export interface CreateRoomPermissionMiddlewareDeps {
  getRoomSnapshot: (roomId?: string | null) => RoomPermissionSnapshot | null;
  getDefaultSender?: () => string | null | undefined;
  rules?: readonly PermissionRule[];
}

const ROOM_COMMAND_PREFIX = "room/";

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getPayloadObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as Record<string, unknown>;
}

function readPayloadString(payload: unknown, key: string): string | null {
  const payloadObject = getPayloadObject(payload);
  if (!payloadObject) {
    return null;
  }

  return toNonEmptyString(payloadObject[key]);
}

function readRoomId(payload: unknown): string | null {
  return readPayloadString(payload, "roomId");
}

function createFailure(error: string): CommandResult<unknown> {
  return {
    success: false,
    error,
  };
}

function commandPatternMatches(pattern: string, commandType: string): boolean {
  if (pattern.endsWith("*")) {
    return commandType.startsWith(pattern.slice(0, -1));
  }

  return pattern === commandType;
}

function resolveRule(
  commandType: string,
  rules: readonly PermissionRule[],
): PermissionRule | null {
  for (const rule of rules) {
    if (commandPatternMatches(rule.commandPattern, commandType)) {
      return rule;
    }
  }

  return null;
}

function isMember(snapshot: RoomPermissionSnapshot, sender: string): boolean {
  return snapshot.members.some((member) => member.userId === sender);
}

function isHost(snapshot: RoomPermissionSnapshot, sender: string): boolean {
  const byHostUserId = snapshot.hostUserId === sender;
  const byMemberRole = snapshot.members.some(
    (member) => member.userId === sender && member.role === "host",
  );
  const byLocalHostHint =
    snapshot.isLocalHost === true && snapshot.localUserId === sender;

  return byHostUserId || byMemberRole || byLocalHostHint;
}

function validateRole(
  commandType: string,
  requiredRole: PermissionRole,
  sender: string | null,
  roomId: string | null,
  snapshot: RoomPermissionSnapshot | null,
): string | null {
  if (requiredRole === "public") {
    return null;
  }

  if (!sender) {
    return `Permission denied for ${commandType}: missing sender`;
  }

  if (!snapshot) {
    return `Permission denied for ${commandType}: room context unavailable`;
  }

  if (roomId && snapshot.roomId && roomId !== snapshot.roomId) {
    return `Permission denied for ${commandType}: room mismatch (${roomId})`;
  }

  const senderIsMember = isMember(snapshot, sender);
  if (!senderIsMember) {
    return `Permission denied for ${commandType}: sender is not a room member`;
  }

  if (requiredRole === "host" && !isHost(snapshot, sender)) {
    return `Permission denied for ${commandType}: host role required`;
  }

  return null;
}

function validateSenderMatchesPayloadField(
  field: string,
  options?: {
    allowMissingSender?: boolean;
  },
): (ctx: RoomPermissionValidationContext) => string | null {
  return ({ command, payload, sender }) => {
    const payloadValue = readPayloadString(payload, field);
    if (!payloadValue) {
      return `Permission denied for ${command.type}: payload.${field} is required`;
    }

    if (!sender) {
      return options?.allowMissingSender
        ? null
        : `Permission denied for ${command.type}: missing sender`;
    }

    if (payloadValue !== sender) {
      return `Permission denied for ${command.type}: sender must match payload.${field}`;
    }

    return null;
  };
}

const OPTIONAL_SENDER_MATCH_USER_ID = validateSenderMatchesPayloadField(
  "userId",
  { allowMissingSender: true },
);
const REQUIRE_SENDER_MATCH_USER_ID =
  validateSenderMatchesPayloadField("userId");
const REQUIRE_SENDER_MATCH_CURRENT_HOST =
  validateSenderMatchesPayloadField("currentHostId");
const REQUIRE_KICK_TARGET_FIELD = ({
  command,
  payload,
}: RoomPermissionValidationContext): string | null => {
  const targetUserId =
    readPayloadString(payload, "targetUserId") ??
    readPayloadString(payload, "userId");
  if (!targetUserId) {
    return `Permission denied for ${command.type}: payload.targetUserId (or payload.userId) is required`;
  }

  return null;
};

export const ROOM_PERMISSION_RULES: readonly PermissionRule[] = [
  // ===== 公共命令（不要求成员） =====
  {
    commandPattern: "room/create",
    requiredRole: "public",
    validatePayload: ({ command, payload, sender }) => {
      const hostUserId = readPayloadString(payload, "hostUserId");
      if (!hostUserId) {
        return `Permission denied for ${command.type}: payload.hostUserId is required`;
      }

      if (sender && hostUserId !== sender) {
        return `Permission denied for ${command.type}: sender must match payload.hostUserId`;
      }

      return null;
    },
  },
  {
    commandPattern: "room/join",
    requiredRole: "public",
    validatePayload: OPTIONAL_SENDER_MATCH_USER_ID,
  },
  { commandPattern: "room/query", requiredRole: "public" },

  // ===== 成员命令 =====
  {
    commandPattern: "room/leave",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/member/status/update",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/turn/submit",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  // 兼容历史命令路径：room/turn/action/submit
  {
    commandPattern: "room/turn/action/submit",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/turn/action/update",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/turn/action/withdraw",
    requiredRole: "member",
    validatePayload: ({ command, payload, sender }) => {
      const operatorId = readPayloadString(payload, "operatorId");
      if (!operatorId) {
        return `Permission denied for ${command.type}: payload.operatorId is required`;
      }

      if (!sender) {
        return `Permission denied for ${command.type}: missing sender`;
      }

      if (operatorId !== sender) {
        return `Permission denied for ${command.type}: sender must match payload.operatorId`;
      }

      const targetUserId = readPayloadString(payload, "userId");
      if (!targetUserId) {
        return `Permission denied for ${command.type}: payload.userId is required`;
      }

      return null;
    },
  },
  {
    commandPattern: "room/character/create",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/character/update",
    requiredRole: "member",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },

  // ===== Host 命令 =====
  {
    commandPattern: "room/delete",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/settings/update",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/member/kick",
    requiredRole: "host",
    validatePayload: REQUIRE_KICK_TARGET_FIELD,
  },
  {
    commandPattern: "room/member/transfer-host",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_CURRENT_HOST,
  },
  { commandPattern: "room/turn/start", requiredRole: "host" },
  { commandPattern: "room/turn/action/lock", requiredRole: "host" },
  { commandPattern: "room/turn/complete", requiredRole: "host" },
  { commandPattern: "room/turn/force-start", requiredRole: "host" },
  { commandPattern: "room/turn/extend", requiredRole: "host" },
  { commandPattern: "room/phase/enter", requiredRole: "host" },
  { commandPattern: "room/phase/complete", requiredRole: "host" },
  { commandPattern: "room/phase/advance", requiredRole: "host" },
  {
    commandPattern: "room/game/start",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/game/end",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  { commandPattern: "room/npc/create", requiredRole: "host" },
  { commandPattern: "room/npc/status/update", requiredRole: "host" },
  { commandPattern: "room/npc/info/update", requiredRole: "host" },
  { commandPattern: "room/history/load", requiredRole: "host" },
  { commandPattern: "room/history/archive", requiredRole: "host" },
  {
    commandPattern: "room/ai/process",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/ai/cancel",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },
  {
    commandPattern: "room/ai/regenerate",
    requiredRole: "host",
    validatePayload: REQUIRE_SENDER_MATCH_USER_ID,
  },

  // 默认策略：所有未显式声明的 room/* 命令要求成员身份
  { commandPattern: "room/*", requiredRole: "member" },
];

function resolveSender(
  context: CommandContext,
  getDefaultSender?: () => string | null | undefined,
): string | null {
  const fromContext = toNonEmptyString(context.sender);
  if (fromContext) {
    return fromContext;
  }

  const fromDefault = toNonEmptyString(getDefaultSender?.());
  if (fromDefault) {
    return fromDefault;
  }

  return null;
}

export function createRoomPermissionMiddleware(
  deps: CreateRoomPermissionMiddlewareDeps,
): CommandMiddleware {
  const rules = deps.rules ?? ROOM_PERMISSION_RULES;

  return async (command, context, next): Promise<CommandResult<unknown>> => {
    if (!command.type.startsWith(ROOM_COMMAND_PREFIX)) {
      return next();
    }

    const rule = resolveRule(command.type, rules);
    if (!rule) {
      return next();
    }

    const roomId = readRoomId(command.payload);
    const sender = resolveSender(context, deps.getDefaultSender);
    const snapshot = deps.getRoomSnapshot(roomId);

    const roleError = validateRole(
      command.type,
      rule.requiredRole,
      sender,
      roomId,
      snapshot,
    );
    if (roleError) {
      return createFailure(roleError);
    }

    const payloadError = rule.validatePayload?.({
      command,
      context,
      payload: command.payload,
      sender,
      roomId,
      snapshot,
    });
    if (payloadError) {
      return createFailure(payloadError);
    }

    return next();
  };
}
