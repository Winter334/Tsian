/**
 * Yjs Subdocument 管理器
 *
 * 负责联机房间的 Subdoc 创建、加载、卸载等操作
 *
 * ⚠️ 架构规范：core/ 层只负责基础设施，不可修改业务状态
 * 所有业务逻辑（添加成员、更新状态等）必须通过 modules/room/handlers.ts
 *
 * 基于 subdocument-architecture.md 设计文档
 * 和 2.3-turn-system-design.md Phase 系统设计
 */

import { DEFAULT_FLOW_TEMPLATE } from "@/domain/entities/phase";
import * as Y from "yjs";
import { yjsManager } from "./manager";
import type {
  ArchivedTurn,
  InventoryYjsData,
  LoadedSubdocInfo,
  Member,
  RoomMetadata,
  RoomRef,
  SubdocManagerConfig,
  TurnStatus,
  WorldArchiveYjsData,
} from "./room/types";
import { DEFAULT_ROOM_CODE_OPTIONS, DEFAULT_SUBDOC_CONFIG } from "./room/types";

/**
 * 分页加载结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[];
  /** 是否还有更多 */
  hasMore: boolean;
  /** 下一页的游标（用于分页） */
  nextCursor: number | null;
  /** 总数量 */
  total: number;
}

/**
 * 分页加载选项
 */
export interface PaginationOptions {
  /** 每页数量，默认 20 */
  limit?: number;
  /** 起始位置（从最新开始倒序），默认从末尾开始 */
  cursor?: number;
}

/**
 * 历史消息项
 */
export interface HistoryMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 文档命名规范
 */
const docNames = {
  main: (roomId: string) => `room:${roomId}:main`,
  turn: (roomId: string, turnNumber: number) =>
    `room:${roomId}:turn:${turnNumber}`,
  history: (roomId: string) => `room:${roomId}:history`,
};

/**
 * 生成房间码
 */
export function generateRoomCode(options = DEFAULT_ROOM_CODE_OPTIONS): string {
  const { length, charset } = options;
  let code = "";
  for (let i = 0; i < length; i++) {
    code += charset[Math.floor(Math.random() * charset.length)];
  }
  return code;
}

/**
 * SubdocManager 类
 *
 * 管理联机房间的 Subdocument 生命周期
 *
 * ⚠️ 只提供基础设施功能，不包含业务逻辑
 */
export class SubdocManager {
  private config: SubdocManagerConfig;

  /** 已加载的 MainDoc（roomId -> Y.Doc） */
  private mainDocs: Map<string, Y.Doc> = new Map();

  /** 已加载的 TurnDoc（roomId:turnNumber -> Y.Doc） */
  private turnDocs: Map<string, Y.Doc> = new Map();

  /** 已加载的 HistoryDoc（roomId -> Y.Doc） */
  private historyDocs: Map<string, Y.Doc> = new Map();

  /** HistoryDoc 空闲计时器 */
  private historyIdleTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  constructor(config: Partial<SubdocManagerConfig> = {}) {
    this.config = { ...DEFAULT_SUBDOC_CONFIG, ...config };
  }

  // ===== 房间引用管理（RootDoc 层） =====

  /**
   * 获取房间引用 Map
   */
  getRoomsMap(): Y.Map<RoomRef> {
    const doc = yjsManager.getDoc();
    const root = doc.getMap("root");

    // 确保 rooms Map 存在
    if (!root.has("rooms")) {
      root.set("rooms", new Y.Map());
    }

    return root.get("rooms") as Y.Map<RoomRef>;
  }

  /**
   * 获取所有房间列表（只读）
   */
  listRooms(): RoomRef[] {
    const roomsMap = this.getRoomsMap();
    const rooms: RoomRef[] = [];

    roomsMap.forEach((ref) => {
      rooms.push(ref);
    });

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 通过房间码查找房间（只读）
   */
  findRoomByCode(code: string): RoomRef | null {
    const rooms = this.listRooms();
    return rooms.find((r) => r.code === code) || null;
  }

  /**
   * 通过房间 ID 查找房间（只读）
   */
  findRoomById(roomId: string): RoomRef | null {
    return this.getRoomsMap().get(roomId) || null;
  }

  // ===== 只读查询方法 =====

  /**
   * 获取房间成员列表（只读）
   */
  getRoomMembers(roomId: string): Member[] {
    const mainDoc = this.getMainDoc(roomId);
    if (!mainDoc) {
      return [];
    }

    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const members: Member[] = [];
    membersMap.forEach((member) => {
      members.push(member);
    });

    return members.sort((a, b) => a.joinedAt - b.joinedAt);
  }

  /**
   * 获取房间元数据（只读）
   */
  getRoomMetadata(roomId: string): RoomMetadata | null {
    const mainDoc = this.getMainDoc(roomId);
    if (!mainDoc) {
      return null;
    }

    const metadataMap = mainDoc.getMap("metadata");
    return {
      id: metadataMap.get("id") as string,
      code: metadataMap.get("code") as string,
      name: metadataMap.get("name") as string,
      hostUserId: metadataMap.get("hostUserId") as string,
      status: metadataMap.get("status") as RoomMetadata["status"],
      maxPlayers: metadataMap.get("maxPlayers") as number,
      turnDuration: metadataMap.get("turnDuration") as number,
      createdAt: metadataMap.get("createdAt") as number,
      updatedAt: metadataMap.get("updatedAt") as number,
    };
  }

  /**
   * 检查用户是否是房主（只读）
   */
  isHost(roomId: string, userId: string): boolean {
    const members = this.getRoomMembers(roomId);
    const member = members.find((m) => m.userId === userId);
    return member?.role === "host";
  }

  /**
   * 获取当前回合号（只读）
   */
  getCurrentTurnNumber(roomId: string): number {
    const mainDoc = this.getMainDoc(roomId);
    if (!mainDoc) {
      return 0;
    }
    return (mainDoc.getMap("config").get("currentTurnNumber") as number) || 0;
  }

  /**
   * 获取成员数量（只读）
   */
  getMemberCount(roomId: string): number {
    const mainDoc = this.getMainDoc(roomId);
    if (!mainDoc) {
      return 0;
    }
    return (mainDoc.getMap("members") as Y.Map<Member>).size;
  }

  /**
   * 获取房间库存根节点（MainDoc.inventory）
   *
   * Inventory/Skill 挂载在 MainDoc 下的 inventory 命名空间，
   * 不是独立 Subdoc。
   */
  getRoomInventoryRoot(roomId: string): InventoryYjsData | null {
    const mainDoc = this.getMainDoc(roomId);
    if (!mainDoc) {
      return null;
    }

    return mainDoc.getMap("inventory") as InventoryYjsData;
  }

  /**
   * 获取世界档案根节点（HistoryDoc.worldArchive）
   *
   * WorldArchive 在联机模式下挂载于 HistoryDoc，与消息归档同层。
   */
  getRoomWorldArchiveRoot(roomId: string): WorldArchiveYjsData | null {
    const historyDoc = this.getHistoryDoc(roomId);
    if (!historyDoc) {
      return null;
    }

    return historyDoc.getMap("worldArchive") as WorldArchiveYjsData;
  }

  // ===== MainDoc 操作 =====

  /**
   * 创建空的 MainDoc（用于加入房间）
   *
   * ⚠️ 只创建文档结构，不设置任何元数据（由服务器同步填充）
   *
   * @returns 创建的 MainDoc
   */
  createEmptyMainDoc(roomId: string): Y.Doc {
    const mainDoc = new Y.Doc({ guid: docNames.main(roomId) });

    // 只初始化必要的 Map/Array 结构，不设置值
    mainDoc.getMap("metadata");
    mainDoc.getMap("members");
    mainDoc.getMap("config");
    mainDoc.getMap("turnDocRefs");
    mainDoc.getMap("characters"); // Phase 2: 角色列表
    mainDoc.getMap("inventory"); // Phase 2: Inventory / Skill 联机根节点

    // 缓存 MainDoc
    this.mainDocs.set(roomId, mainDoc);

    return mainDoc;
  }

  /**
   * 创建房间的 MainDoc
   *
   * ⚠️ 只创建文档结构，不添加成员（由 handler 负责）
   *
   * @returns 创建的 MainDoc 和生成的房间码
   */
  createMainDoc(
    roomId: string,
    options: {
      name: string;
      hostUserId: string;
      maxPlayers?: number;
      turnDuration?: number;
      /** 存档 ID（用于跨房间匹配存档，核心匹配字段） */
      saveId?: string;
    },
  ): { mainDoc: Y.Doc; code: string } {
    const now = Date.now();
    const code = generateRoomCode();

    // 创建 MainDoc
    const mainDoc = new Y.Doc({ guid: docNames.main(roomId) });

    // 初始化 MainDoc 结构
    const metadata: RoomMetadata = {
      id: roomId,
      code,
      name: options.name,
      hostUserId: options.hostUserId,
      status: "waiting",
      maxPlayers: options.maxPlayers || 8,
      turnDuration: options.turnDuration || 5 * 60 * 1000, // 默认 5 分钟
      createdAt: now,
      updatedAt: now,
    };

    // 设置 metadata
    const metadataMap = mainDoc.getMap("metadata");
    Object.entries(metadata).forEach(([key, value]) => {
      metadataMap.set(key, value);
    });

    // 初始化 members Map（空）
    mainDoc.getMap("members");

    // 初始化 config Map（Phase 系统相关字段）
    const configMap = mainDoc.getMap("config");
    configMap.set("currentTurnNumber", 0);
    configMap.set("currentPhaseId", null);
    configMap.set("currentPhaseIndex", 0);
    configMap.set("flowTemplateId", DEFAULT_FLOW_TEMPLATE.id);

    // 创建 HistoryDoc 引用
    const historyGuid = docNames.history(roomId);
    configMap.set("historyDocGuid", historyGuid);

    // 设置 saveId（用于跨房间匹配存档，核心匹配字段）
    if (options.saveId) {
      configMap.set("saveId", options.saveId);
    }

    // 初始化 turnDocRefs Map
    mainDoc.getMap("turnDocRefs");

    // 初始化 preGamePhases Array（用于存储 lobby 等预游戏阶段）
    mainDoc.getArray("preGamePhases");

    // 初始化 characters Map（Phase 2: 角色系统）
    // 使用嵌套 Y.Map 存储角色数据，支持增量同步
    mainDoc.getMap("characters");

    // 初始化 inventory Map（Phase 2: Inventory / Skill 联机同步）
    // 挂载结构：MainDoc.inventory.{characterId}.{items|skills}
    mainDoc.getMap("inventory");

    // 缓存 MainDoc
    this.mainDocs.set(roomId, mainDoc);

    // 在 RootDoc 中注册房间引用
    const roomRef: RoomRef = {
      roomId,
      mainDocGuid: mainDoc.guid,
      createdAt: now,
      code,
    };
    this.getRoomsMap().set(roomId, roomRef);

    return { mainDoc, code };
  }

  /**
   * 获取已加载的 MainDoc
   */
  getMainDoc(roomId: string): Y.Doc | null {
    return this.mainDocs.get(roomId) || null;
  }

  /**
   * 加载 MainDoc（本地或从网络）
   *
   * TODO: 集成 Hocuspocus 后实现网络同步
   */
  async loadMainDoc(roomId: string): Promise<Y.Doc> {
    // 检查是否已加载
    const existing = this.mainDocs.get(roomId);
    if (existing) {
      return existing;
    }

    // 检查房间是否存在
    const roomRef = this.getRoomsMap().get(roomId);
    if (!roomRef) {
      throw new Error(`[SubdocManager] Room not found: ${roomId}`);
    }

    // 创建 MainDoc 并加载（暂时只支持本地）
    const mainDoc = new Y.Doc({ guid: roomRef.mainDocGuid });

    // TODO: 这里应该通过 Hocuspocus Provider 同步
    // 目前只是创建空文档

    this.mainDocs.set(roomId, mainDoc);

    return mainDoc;
  }

  /**
   * 卸载 MainDoc
   */
  unloadMainDoc(roomId: string): void {
    const mainDoc = this.mainDocs.get(roomId);
    if (mainDoc) {
      mainDoc.destroy();
      this.mainDocs.delete(roomId);
    }
  }

  // ===== TurnDoc 操作 =====

  /**
   * 生成 TurnDoc 缓存键
   */
  private getTurnDocKey(roomId: string, turnNumber: number): string {
    return `${roomId}:${turnNumber}`;
  }

  /**
   * 创建新回合文档
   *
   * ⚠️ 只创建文档结构，不更新 MainDoc 的 currentTurnNumber（由 handler 负责）
   */
  createTurnDoc(roomId: string, turnNumber: number, deadline?: number): Y.Doc {
    const key = this.getTurnDocKey(roomId, turnNumber);

    // 检查是否已存在
    const existing = this.turnDocs.get(key);
    if (existing) {
      return existing;
    }

    // 创建 TurnDoc
    const turnDoc = new Y.Doc({ guid: docNames.turn(roomId, turnNumber) });

    // 初始化结构
    turnDoc.getMap("config").set("turnNumber", turnNumber);
    turnDoc.getMap("config").set("status", "waiting" as TurnStatus);
    turnDoc
      .getMap("config")
      .set("deadline", deadline || Date.now() + 5 * 60 * 1000);

    // 初始化 actions Map
    turnDoc.getMap("actions");

    // 初始化 readyPlayers Array
    turnDoc.getArray("readyPlayers");

    // 初始化 aiResponse Text
    turnDoc.getText("aiResponse");

    // 初始化 resultFrame Map（IRNR 结算帧）
    turnDoc.getMap("resultFrame");

    // 初始化 resolveStatus
    turnDoc.getMap("config").set("resolveStatus", "idle");

    // 初始化 phases Array（该回合的阶段历史）
    turnDoc.getArray("phases");

    // 初始化当前阶段索引
    turnDoc.getMap("config").set("currentPhaseIndex", 0);

    // 缓存
    this.turnDocs.set(key, turnDoc);

    // 清理旧的 TurnDoc
    this.pruneOldTurnDocs(roomId, this.config.keepRecentTurns);

    return turnDoc;
  }

  /**
   * 加入已存在的 TurnDoc（仅 Guest 使用）
   *
   * ⚠️ 不初始化任何结构，等待服务器填充
   * 这是解决 Guest 创建空 TurnDoc 覆盖 Host 数据问题的关键
   *
   * @param roomId 房间 ID
   * @param turnNumber 回合号
   * @returns 创建的空壳 TurnDoc
   */
  joinTurnDoc(roomId: string, turnNumber: number): Y.Doc {
    const key = this.getTurnDocKey(roomId, turnNumber);

    // 检查是否已存在
    const existing = this.turnDocs.get(key);
    if (existing) {
      return existing;
    }

    // 只创建空文档，不初始化任何结构
    // 服务器会推送完整的 TurnDoc 数据填充这个空壳
    const turnDoc = new Y.Doc({ guid: `room:${roomId}:turn:${turnNumber}` });

    // 缓存
    this.turnDocs.set(key, turnDoc);

    return turnDoc;
  }

  /**
   * 获取已加载的回合文档
   */
  getTurnDoc(roomId: string, turnNumber: number): Y.Doc | null {
    const key = this.getTurnDocKey(roomId, turnNumber);
    return this.turnDocs.get(key) || null;
  }

  /**
   * 按需加载回合文档
   *
   * TODO: 集成 Hocuspocus 后实现网络同步
   */
  async loadTurnDoc(roomId: string, turnNumber: number): Promise<Y.Doc> {
    const key = this.getTurnDocKey(roomId, turnNumber);

    // 检查是否已加载
    const existing = this.turnDocs.get(key);
    if (existing) {
      return existing;
    }

    // 检查 MainDoc 中是否有引用
    const mainDoc = await this.loadMainDoc(roomId);
    const turnDocRefs = mainDoc.getMap("turnDocRefs");
    const guid = turnDocRefs.get(String(turnNumber)) as string | undefined;

    if (!guid) {
      throw new Error(
        `[SubdocManager] TurnDoc not found: ${roomId}:${turnNumber}`,
      );
    }

    // 创建 TurnDoc 并加载
    const turnDoc = new Y.Doc({ guid });

    // TODO: 通过 Hocuspocus Provider 同步

    this.turnDocs.set(key, turnDoc);

    return turnDoc;
  }

  /**
   * 卸载回合文档（释放内存）
   */
  unloadTurnDoc(roomId: string, turnNumber: number): void {
    const key = this.getTurnDocKey(roomId, turnNumber);
    const turnDoc = this.turnDocs.get(key);

    if (turnDoc) {
      turnDoc.destroy();
      this.turnDocs.delete(key);
    }
  }

  /**
   * 清理旧的回合文档，保留最近 N 个
   */
  pruneOldTurnDocs(roomId: string, keepRecent: number): void {
    const prefix = `${roomId}:`;
    const loadedTurns: number[] = [];

    // 收集该房间已加载的回合号
    this.turnDocs.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        const turnNumber = parseInt(key.slice(prefix.length), 10);
        loadedTurns.push(turnNumber);
      }
    });

    // 排序（降序）
    loadedTurns.sort((a, b) => b - a);

    // 卸载超出保留数量的
    if (loadedTurns.length > keepRecent) {
      const toUnload = loadedTurns.slice(keepRecent);
      for (const turnNumber of toUnload) {
        this.unloadTurnDoc(roomId, turnNumber);
      }
    }
  }

  // ===== HistoryDoc 操作 =====

  /**
   * 获取已加载的历史文档
   */
  getHistoryDoc(roomId: string): Y.Doc | null {
    return this.historyDocs.get(roomId) || null;
  }

  /**
   * 按需加载历史文档
   */
  async loadHistoryDoc(roomId: string): Promise<Y.Doc> {
    // 检查是否已加载
    const existing = this.historyDocs.get(roomId);
    if (existing) {
      this.resetHistoryIdleTimer(roomId);
      return existing;
    }

    // 获取 HistoryDoc GUID
    const mainDoc = await this.loadMainDoc(roomId);
    const historyGuid = mainDoc
      .getMap("config")
      .get("historyDocGuid") as string;

    if (!historyGuid) {
      // 如果没有，创建新的
      const newGuid = docNames.history(roomId);
      mainDoc.getMap("config").set("historyDocGuid", newGuid);
    }

    // 创建 HistoryDoc
    const historyDoc = new Y.Doc({
      guid: historyGuid || docNames.history(roomId),
    });

    // 初始化结构
    historyDoc.getMap("conversations");
    historyDoc.getMap("messages");
    historyDoc.getArray("archivedTurns");

    // Phase 2: WorldArchive 联机同步根节点（HistoryDoc.worldArchive）
    const worldArchiveRoot = historyDoc.getMap("worldArchive");
    if (!(worldArchiveRoot.get("entities") instanceof Y.Map)) {
      worldArchiveRoot.set("entities", new Y.Map<string>());
    }
    if (!(worldArchiveRoot.get("relationships") instanceof Y.Array)) {
      worldArchiveRoot.set("relationships", new Y.Array<string>());
    }
    if (!(worldArchiveRoot.get("metadata") instanceof Y.Map)) {
      const metadata = new Y.Map<unknown>();
      metadata.set("version", 1);
      metadata.set("updatedAt", Date.now());
      worldArchiveRoot.set("metadata", metadata);
    }

    // TODO: 通过 Hocuspocus Provider 同步

    this.historyDocs.set(roomId, historyDoc);
    this.resetHistoryIdleTimer(roomId);

    return historyDoc;
  }

  /**
   * 卸载历史文档
   */
  unloadHistoryDoc(roomId: string): void {
    // 清除计时器
    const timer = this.historyIdleTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.historyIdleTimers.delete(roomId);
    }

    // 卸载文档
    const historyDoc = this.historyDocs.get(roomId);
    if (historyDoc) {
      historyDoc.destroy();
      this.historyDocs.delete(roomId);
    }
  }

  /**
   * 重置历史文档空闲计时器
   */
  private resetHistoryIdleTimer(roomId: string): void {
    // 清除旧计时器
    const oldTimer = this.historyIdleTimers.get(roomId);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }

    // 设置新计时器
    const timer = setTimeout(() => {
      this.unloadHistoryDoc(roomId);
    }, this.config.historyIdleTimeout);

    this.historyIdleTimers.set(roomId, timer);
  }

  // ===== 内存管理 =====

  /**
   * 获取当前已加载的 Subdoc 列表
   */
  getLoadedSubdocs(roomId: string): LoadedSubdocInfo[] {
    const result: LoadedSubdocInfo[] = [];
    const now = Date.now();

    // MainDoc
    if (this.mainDocs.has(roomId)) {
      result.push({
        guid: docNames.main(roomId),
        type: "main",
        loadedAt: now, // TODO: 记录实际加载时间
      });
    }

    // TurnDocs
    const prefix = `${roomId}:`;
    this.turnDocs.forEach((doc, key) => {
      if (key.startsWith(prefix)) {
        const turnNumber = parseInt(key.slice(prefix.length), 10);
        result.push({
          guid: doc.guid,
          type: "turn",
          loadedAt: now,
          turnNumber,
        });
      }
    });

    // HistoryDoc
    if (this.historyDocs.has(roomId)) {
      result.push({
        guid: docNames.history(roomId),
        type: "history",
        loadedAt: now,
      });
    }

    return result;
  }

  /**
   * 完全离开房间（卸载所有相关 Subdoc）
   */
  leaveRoom(roomId: string): void {
    // 卸载 HistoryDoc
    this.unloadHistoryDoc(roomId);

    // 卸载所有 TurnDoc
    const prefix = `${roomId}:`;
    const keysToDelete: string[] = [];
    this.turnDocs.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => {
      const turnNumber = parseInt(key.slice(prefix.length), 10);
      this.unloadTurnDoc(roomId, turnNumber);
    });

    // 卸载 MainDoc
    this.unloadMainDoc(roomId);
  }

  /**
   * 删除房间（包括从 RootDoc 中移除引用）
   *
   * ⚠️ 这是基础设施层的清理操作，应该由 handler 调用
   */
  deleteRoom(roomId: string): void {
    // 先离开房间
    this.leaveRoom(roomId);

    // 从 RootDoc 中移除引用
    this.getRoomsMap().delete(roomId);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 清除所有计时器
    this.historyIdleTimers.forEach((timer) => clearTimeout(timer));
    this.historyIdleTimers.clear();

    // 销毁所有文档
    this.historyDocs.forEach((doc) => doc.destroy());
    this.historyDocs.clear();

    this.turnDocs.forEach((doc) => doc.destroy());
    this.turnDocs.clear();

    this.mainDocs.forEach((doc) => doc.destroy());
    this.mainDocs.clear();
  }

  // ===== 历史消息分页加载（只读） =====

  /**
   * 分页加载历史消息
   *
   * 联机模式下，历史消息存储在 HistoryDoc 中，需要懒加载以节省内存
   *
   * @param roomId 房间 ID
   * @param conversationId 会话 ID
   * @param options 分页选项
   */
  async getHistoryMessages(
    roomId: string,
    conversationId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<HistoryMessageItem>> {
    const { limit = 20, cursor } = options;

    // 加载 HistoryDoc（会自动重置空闲计时器）
    const historyDoc = await this.loadHistoryDoc(roomId);

    // 获取消息 Map
    const messagesMap = historyDoc.getMap("messages") as Y.Map<
      Y.Array<unknown>
    >;
    const messagesArray = messagesMap.get(conversationId);

    if (!messagesArray) {
      return {
        items: [],
        hasMore: false,
        nextCursor: null,
        total: 0,
      };
    }

    const allMessages = messagesArray.toArray() as HistoryMessageItem[];
    const total = allMessages.length;

    // 确定起始位置（从末尾开始倒序加载）
    const startIndex = cursor !== undefined ? cursor : total;
    const endIndex = Math.max(0, startIndex - limit);

    // 提取指定范围的消息（倒序）
    const items = allMessages.slice(endIndex, startIndex).reverse();

    // 计算是否还有更多
    const hasMore = endIndex > 0;
    const nextCursor = hasMore ? endIndex : null;

    return {
      items,
      hasMore,
      nextCursor,
      total,
    };
  }

  /**
   * 分页加载归档回合
   *
   * @param roomId 房间 ID
   * @param options 分页选项
   */
  async getArchivedTurns(
    roomId: string,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<ArchivedTurn>> {
    const { limit = 10, cursor } = options;

    // 加载 HistoryDoc
    const historyDoc = await this.loadHistoryDoc(roomId);

    // 获取归档回合 Array
    const archivedTurns = historyDoc.getArray(
      "archivedTurns",
    ) as Y.Array<ArchivedTurn>;
    const allTurns = archivedTurns.toArray();
    const total = allTurns.length;

    // 确定起始位置（从最新开始倒序）
    const startIndex = cursor !== undefined ? cursor : total;
    const endIndex = Math.max(0, startIndex - limit);

    // 提取指定范围（倒序）
    const items = allTurns.slice(endIndex, startIndex).reverse();

    // 计算是否还有更多
    const hasMore = endIndex > 0;
    const nextCursor = hasMore ? endIndex : null;

    return {
      items,
      hasMore,
      nextCursor,
      total,
    };
  }

  /**
   * 获取历史消息总数
   */
  async getHistoryMessageCount(
    roomId: string,
    conversationId: string,
  ): Promise<number> {
    const historyDoc = await this.loadHistoryDoc(roomId);
    const messagesMap = historyDoc.getMap("messages") as Y.Map<
      Y.Array<unknown>
    >;
    const messagesArray = messagesMap.get(conversationId);

    return messagesArray ? messagesArray.length : 0;
  }

  /**
   * 获取归档回合总数
   */
  async getArchivedTurnCount(roomId: string): Promise<number> {
    const historyDoc = await this.loadHistoryDoc(roomId);
    const archivedTurns = historyDoc.getArray("archivedTurns");

    return archivedTurns.length;
  }
}

/**
 * 全局单例
 */
export const subdocManager = new SubdocManager();
