/**
 * 用户身份管理
 *
 * 管理本地用户身份（userId、displayName、uniqueTag）
 * 设计时考虑未来扩展账号系统的兼容性
 *
 * 核心概念：
 * - userId: 技术标识符，每个设备不同，用于 Yjs 和同设备匹配
 * - uniqueTag: 用户标识符（如 `勇者#A3F2`），全局唯一，用于跨设备恢复
 * - displayName: 显示名称，可随时修改，不影响匹配
 */

const USER_ID_KEY = "lyra.userId";
const DISPLAY_NAME_KEY = "lyra.displayName";
const UNIQUE_TAG_KEY = "lyra.uniqueTag";
const CREATED_AT_KEY = "lyra.createdAt";

/**
 * 用户身份接口
 *
 * 便于未来扩展账号系统
 */
export interface UserIdentity {
  /** 技术标识符（UUID，本地生成） */
  userId: string;

  /**
   * 用户标识符（首次设置时生成，永不改变）
   * 格式：{显示名称}#{shortId}
   * 例如：勇者#A3F2
   */
  uniqueTag: string;

  /** 当前显示名称（可随时修改） */
  displayName: string;

  /** 创建时间 */
  createdAt: number;

  /** 关联的账号 ID（未来扩展） */
  accountId?: string;

  /** 是否为游客身份 */
  isGuest: boolean;
}

/**
 * 解析后的 uniqueTag 结构
 */
export interface ParsedUniqueTag {
  /** 原始显示名称（创建时的名称） */
  originalName: string;
  /** 4位十六进制短ID（大写） */
  shortId: string;
}

/**
 * 从 userId 生成 shortId
 *
 * 取 UUID 的前4个十六进制字符并转为大写
 * 例如：a3f2b1c4-... -> A3F2
 */
export function generateShortId(userId: string): string {
  // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // 取前4个字符（跳过可能的连字符）
  const cleanId = userId.replace(/-/g, "");
  return cleanId.substring(0, 4).toUpperCase();
}

/**
 * 生成 uniqueTag
 *
 * 格式：{displayName}#{shortId}
 * 一旦生成就永不改变
 */
export function generateUniqueTag(displayName: string, userId: string): string {
  const shortId = generateShortId(userId);
  return `${displayName}#${shortId}`;
}

/**
 * 解析 uniqueTag
 *
 * @param uniqueTag 格式：{displayName}#{shortId}
 * @returns 解析结果，如果格式无效返回 null
 */
export function parseUniqueTag(uniqueTag: string): ParsedUniqueTag | null {
  const lastHashIndex = uniqueTag.lastIndexOf("#");
  if (lastHashIndex === -1 || lastHashIndex === uniqueTag.length - 1) {
    return null;
  }

  const originalName = uniqueTag.substring(0, lastHashIndex);
  const shortId = uniqueTag.substring(lastHashIndex + 1);

  // 验证 shortId 格式（4位十六进制）
  if (!/^[0-9A-Fa-f]{4}$/.test(shortId)) {
    return null;
  }

  return {
    originalName,
    shortId: shortId.toUpperCase(),
  };
}

/**
 * 获取或创建用户 ID
 *
 * 首次使用时生成 UUID，之后持久化到 localStorage
 */
export function getOrCreateUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
    // 同时记录创建时间
    localStorage.setItem(CREATED_AT_KEY, Date.now().toString());
  }
  return userId;
}

/**
 * 获取用户创建时间
 */
export function getCreatedAt(): number {
  const stored = localStorage.getItem(CREATED_AT_KEY);
  if (stored) {
    return parseInt(stored, 10);
  }
  // 如果没有记录，使用当前时间并保存
  const now = Date.now();
  localStorage.setItem(CREATED_AT_KEY, now.toString());
  return now;
}

/**
 * 获取上次使用的显示名
 */
export function getLastDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) || "";
}

/**
 * 获取当前的 uniqueTag
 */
export function getUniqueTag(): string | null {
  return localStorage.getItem(UNIQUE_TAG_KEY);
}

/**
 * 保存显示名
 *
 * 用于记住用户上次使用的名称
 * 注意：这不会改变 uniqueTag
 */
export function saveDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

/**
 * 初始化 uniqueTag
 *
 * 仅在首次设置时调用，一旦设置就永不改变
 * @param displayName 用户设置的显示名称
 * @returns 生成的 uniqueTag
 */
export function initializeUniqueTag(displayName: string): string {
  const existingTag = getUniqueTag();
  if (existingTag) {
    return existingTag;
  }

  const userId = getOrCreateUserId();
  const uniqueTag = generateUniqueTag(displayName, userId);
  localStorage.setItem(UNIQUE_TAG_KEY, uniqueTag);
  localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  return uniqueTag;
}

/**
 * 更新显示名称
 *
 * 修改当前显示名称，但不影响 uniqueTag
 * @param newName 新的显示名称
 */
export function updateDisplayName(newName: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, newName);
}

/**
 * 恢复身份
 *
 * 用于跨设备恢复身份，通过输入 uniqueTag 来恢复
 * 这会替换当前设备的 uniqueTag，但保留 userId
 *
 * @param uniqueTag 要恢复的 uniqueTag
 * @returns 是否恢复成功
 */
export function recoverIdentity(uniqueTag: string): boolean {
  const parsed = parseUniqueTag(uniqueTag);
  if (!parsed) {
    return false;
  }

  // 保存恢复的 uniqueTag
  localStorage.setItem(UNIQUE_TAG_KEY, uniqueTag.toUpperCase());
  // 使用原始名称作为当前显示名
  localStorage.setItem(DISPLAY_NAME_KEY, parsed.originalName);

  return true;
}

/**
 * 检查是否已完成身份初始化
 *
 * 用于判断是否需要显示首次引导的身份设置步骤
 */
export function hasInitializedIdentity(): boolean {
  return !!getUniqueTag();
}

/**
 * 获取当前用户身份
 */
export function getCurrentIdentity(): UserIdentity {
  const userId = getOrCreateUserId();
  const uniqueTag = getUniqueTag();
  const displayName = getLastDisplayName();

  return {
    userId,
    uniqueTag: uniqueTag || "", // 未初始化时为空字符串
    displayName,
    createdAt: getCreatedAt(),
    isGuest: true, // 当前都是游客身份
  };
}

/**
 * 检查是否有保存的显示名
 */
export function hasDisplayName(): boolean {
  return !!localStorage.getItem(DISPLAY_NAME_KEY);
}

/**
 * 清除用户身份（用于调试或重置）
 */
export function clearIdentity(): void {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(UNIQUE_TAG_KEY);
  localStorage.removeItem(CREATED_AT_KEY);
}

/**
 * 生成默认显示名
 *
 * 用于用户未输入名称时的默认值
 */
export function generateDefaultDisplayName(): string {
  const adjectives = ["勇敢的", "神秘的", "快乐的", "聪明的", "冷静的"];
  const nouns = ["冒险者", "旅行者", "探索者", "守护者", "观察者"];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);

  return `${adj}${noun}${num}`;
}

/**
 * 获取用于显示的短标识
 *
 * 如果有 uniqueTag，返回 shortId 部分
 * 否则返回 userId 的前4位
 */
export function getDisplayShortId(): string {
  const uniqueTag = getUniqueTag();
  if (uniqueTag) {
    const parsed = parseUniqueTag(uniqueTag);
    if (parsed) {
      return parsed.shortId;
    }
  }
  return generateShortId(getOrCreateUserId());
}
