/**
 * Yjs 文档管理器
 * 负责 Yjs 文档的创建、初始化、存档管理等核心功能
 */

import type { Character } from "@/domain/entities/character";
import { characterToYMap, yMapToCharacter } from "@/modules/game/repository";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { CURRENT_VERSION, runMigrations } from "./migrations";
import type {
  CreateSaveParams,
  ExportConversationData,
  ExportMessageData,
  ExportSaveData,
  ImportSaveData,
  SaveMemberInfo,
  SaveSlotInfo,
  SaveType,
  YjsInitOptions,
} from "./types";

/**
 * 默认文档名称
 */
const DEFAULT_DOC_NAME = "lyra-game";

/**
 * localStorage key for current save ID
 */
const CURRENT_SAVE_KEY = "lyra-current-save-id";

/**
 * YjsManager 类
 */
export class YjsManager {
  private doc: Y.Doc | null = null;
  private provider: IndexeddbPersistence | null = null;
  private currentSaveId: string | null = null;
  private initialized = false;

  /**
   * 初始化 Yjs 文档
   */
  async init(options: YjsInitOptions = {}): Promise<void> {
    if (this.initialized) {
      return;
    }

    const docName = options.docName || DEFAULT_DOC_NAME;

    // 1. 创建 Yjs 文档
    this.doc = new Y.Doc();

    // 2. 创建 IndexedDB Provider
    this.provider = new IndexeddbPersistence(docName, this.doc);

    // 3. 等待 Provider 同步完成
    await new Promise<void>((resolve, reject) => {
      if (!this.provider) {
        reject(new Error("Provider not initialized"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("IndexedDB sync timeout"));
      }, 10000); // 10s 超时

      this.provider.once("synced", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // 4. 初始化根文档结构
    this.initRootStructure();

    // 5. 检查并执行数据迁移
    await this.checkAndMigrate();

    // 6. 恢复上次的存档 ID
    this.restoreCurrentSave();

    this.initialized = true;
  }

  /**
   * 恢复上次的存档 ID
   */
  private restoreCurrentSave(): void {
    try {
      const savedId = localStorage.getItem(CURRENT_SAVE_KEY);
      if (savedId) {
        const saves = this.getSaveSlots();
        if (saves.has(savedId)) {
          this.currentSaveId = savedId;
        } else {
          // 存档已被删除，清除 localStorage
          localStorage.removeItem(CURRENT_SAVE_KEY);
        }
      }
    } catch {
      // Silently ignore restore errors
    }
  }

  /**
   * 持久化当前存档 ID
   */
  private persistCurrentSave(): void {
    try {
      if (this.currentSaveId) {
        localStorage.setItem(CURRENT_SAVE_KEY, this.currentSaveId);
      } else {
        localStorage.removeItem(CURRENT_SAVE_KEY);
      }
    } catch {
      // Silently ignore persist errors
    }
  }

  /**
   * 初始化根文档结构
   */
  private initRootStructure(): void {
    if (!this.doc) return;

    const root = this.doc.getMap("root");

    // 初始化 version
    if (!root.has("version")) {
      root.set("version", CURRENT_VERSION);
    }

    // 初始化 saves
    if (!root.has("saves")) {
      root.set("saves", new Y.Map());
    }

    // 初始化 settings
    if (!root.has("settings")) {
      root.set("settings", new Y.Map());
    }

    // 初始化 assets
    if (!root.has("assets")) {
      root.set("assets", new Y.Map());
    }
  }

  /**
   * 检查并执行数据迁移
   */
  private async checkAndMigrate(): Promise<void> {
    if (!this.doc) return;

    const root = this.doc.getMap("root");
    const version = (root.get("version") as number) || 0;

    if (version < CURRENT_VERSION) {
      const result = await runMigrations(root, version, CURRENT_VERSION);

      if (!result.success) {
        // 迁移失败时仍然更新版本号，避免重复尝试失败的迁移
        root.set("version", CURRENT_VERSION);
      }
    }
  }

  /**
   * 获取 Yjs 文档
   */
  getDoc(): Y.Doc {
    if (!this.doc) {
      throw new Error("[YjsManager] Document not initialized");
    }
    return this.doc;
  }

  /**
   * 获取存档槽位 Map
   */
  getSaveSlots(): Y.Map<unknown> {
    const doc = this.getDoc();
    const root = doc.getMap("root");
    return root.get("saves") as Y.Map<unknown>;
  }

  /**
   * 获取所有存档信息（用于 UI 显示）
   */
  listSaves(): SaveSlotInfo[] {
    const saves = this.getSaveSlots();
    const result: SaveSlotInfo[] = [];

    saves.forEach((value, key) => {
      const saveMap = value as Y.Map<unknown>;

      // 从 Y.Map 中读取数据并转换为普通类型
      const id = saveMap.get("id") as string;
      const name = saveMap.get("name") as string;
      const createdAt = saveMap.get("createdAt") as number;
      const updatedAt = saveMap.get("updatedAt") as number;
      const type = (saveMap.get("type") as SaveType) || "solo";

      // 联机存档专用字段
      const lastRoomId = saveMap.get("lastRoomId") as string | undefined;
      const lastRoomCode = saveMap.get("lastRoomCode") as string | undefined;
      const memberCount = saveMap.get("memberCount") as number | undefined;
      const members = saveMap.get("members") as SaveMemberInfo[] | undefined;
      const maxPlayers = saveMap.get("maxPlayers") as number | undefined;
      const turnDuration = saveMap.get("turnDuration") as number | undefined;

      // 游戏进度字段（Phase 1 新增）
      const currentTurnNumber = saveMap.get("currentTurnNumber") as
        | number
        | undefined;

      result.push({
        id: id || key, // 如果没有 id 字段，使用 key
        name: name || "未命名存档",
        createdAt: Number(createdAt) || 0,
        updatedAt: Number(updatedAt) || 0,
        type,
        // 联机存档专用字段（仅在存在时添加）
        ...(lastRoomId && { lastRoomId }),
        ...(lastRoomCode && { lastRoomCode }),
        ...(memberCount !== undefined && { memberCount }),
        ...(members && { members }),
        ...(maxPlayers !== undefined && { maxPlayers }),
        ...(turnDuration !== undefined && { turnDuration }),
        // 游戏进度字段
        ...(currentTurnNumber !== undefined && { currentTurnNumber }),
      });
    });

    // 按更新时间倒序排序
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 创建新存档
   */
  createSave(params: CreateSaveParams): string {
    const saves = this.getSaveSlots();
    const saveId = crypto.randomUUID();
    const now = Date.now();

    // 确定存档类型，默认为 'solo'
    const saveType: SaveType = params.type || "solo";

    // 创建存档对象（使用普通对象，Yjs 会自动转换）
    const saveData: Record<string, unknown> = {
      id: saveId,
      name: params.name,
      createdAt: now,
      updatedAt: now,
      type: saveType,
      conversations: new Y.Map(),
      messages: new Y.Map(),
      gameState: new Y.Map(),
    };

    // 联机存档专用字段
    if (saveType === "multiplayer") {
      if (params.roomCode) {
        saveData.lastRoomCode = params.roomCode;
      }
      if (params.members) {
        saveData.members = params.members;
        saveData.memberCount = params.members.length;
      }
    }

    // 创建存档 Map 并设置数据
    const saveMap = new Y.Map();
    Object.entries(saveData).forEach(([key, value]) => {
      saveMap.set(key, value);
    });

    // 添加到 saves
    saves.set(saveId, saveMap);

    return saveId;
  }

  /**
   * 使用指定 ID 创建存档
   *
   * 用于 Guest 加入房间时创建与 Host 相同 saveId 的存档
   * 这样所有玩家的存档使用相同的 ID，匹配简单可靠
   *
   * @param saveId 指定的存档 ID（通常从 MainDoc 读取）
   * @param params 存档创建参数
   * @returns 存档 ID（与传入的 saveId 相同）
   */
  createSaveWithId(saveId: string, params: CreateSaveParams): string {
    const saves = this.getSaveSlots();
    const now = Date.now();

    // 检查是否已存在相同 ID 的存档
    if (saves.has(saveId)) {
      return saveId;
    }

    // 确定存档类型，默认为 'solo'
    const saveType: SaveType = params.type || "solo";

    // 创建存档对象（使用普通对象，Yjs 会自动转换）
    const saveData: Record<string, unknown> = {
      id: saveId, // 使用指定的 saveId
      name: params.name,
      createdAt: now,
      updatedAt: now,
      type: saveType,
      conversations: new Y.Map(),
      messages: new Y.Map(),
      gameState: new Y.Map(),
    };

    // 联机存档专用字段
    if (saveType === "multiplayer") {
      if (params.roomCode) {
        saveData.lastRoomCode = params.roomCode;
      }
      if (params.members) {
        saveData.members = params.members;
        saveData.memberCount = params.members.length;
      }
    }

    // 创建存档 Map 并设置数据
    const saveMap = new Y.Map();
    Object.entries(saveData).forEach(([key, value]) => {
      saveMap.set(key, value);
    });

    // 添加到 saves（使用指定的 saveId 作为 key）
    saves.set(saveId, saveMap);

    return saveId;
  }

  /**
   * 加载存档
   */
  loadSave(saveId: string): void {
    const saves = this.getSaveSlots();

    if (!saves.has(saveId)) {
      throw new Error(`[YjsManager] Save not found: ${saveId}`);
    }

    this.currentSaveId = saveId;
    this.persistCurrentSave();
  }

  /**
   * 获取当前存档
   */
  getCurrentSave(): Y.Map<unknown> | null {
    if (!this.currentSaveId) {
      return null;
    }

    const saves = this.getSaveSlots();
    return saves.get(this.currentSaveId) as Y.Map<unknown>;
  }

  /**
   * 获取当前存档 ID
   */
  getCurrentSaveId(): string | null {
    return this.currentSaveId;
  }

  /**
   * 获取存档类型
   */
  getSaveType(saveId: string): SaveType {
    const saves = this.getSaveSlots();
    const save = saves.get(saveId) as Y.Map<unknown> | undefined;
    if (!save) {
      return "solo"; // 默认返回单人类型
    }
    return (save.get("type") as SaveType) || "solo";
  }

  /**
   * 删除存档
   */
  deleteSave(saveId: string): void {
    const saves = this.getSaveSlots();

    if (!saves.has(saveId)) {
      throw new Error(`[YjsManager] Save not found: ${saveId}`);
    }

    saves.delete(saveId);

    // 如果删除的是当前存档，清空当前存档 ID
    if (this.currentSaveId === saveId) {
      this.currentSaveId = null;
      this.persistCurrentSave();
    }
  }

  /**
   * 更新存档的更新时间
   */
  touchSave(saveId?: string): void {
    const targetSaveId = saveId || this.currentSaveId;
    if (!targetSaveId) return;

    const saves = this.getSaveSlots();
    const save = saves.get(targetSaveId) as Y.Map<unknown>;

    if (save) {
      save.set("updatedAt", Date.now());
    }
  }

  /**
   * 重命名存档
   */
  renameSave(saveId: string, newName: string): void {
    const saves = this.getSaveSlots();
    const save = saves.get(saveId) as Y.Map<unknown>;

    if (!save) {
      throw new Error(`[YjsManager] Save not found: ${saveId}`);
    }

    save.set("name", newName);
    save.set("updatedAt", Date.now());
  }

  /**
   * 导入存档数据
   *
   * 将外部导入的存档数据写入 Yjs，生成新的 ID
   * @param data 导入的存档数据
   * @returns 新生成的存档 ID
   */
  importSave(data: ImportSaveData): string {
    const saves = this.getSaveSlots();
    const saveId = crypto.randomUUID();
    const now = Date.now();

    // 生成 ID 映射
    const conversationIdMap: Record<string, string> = {};
    const messageIdMap: Record<string, string> = {};

    for (const conv of data.conversations) {
      conversationIdMap[conv.id] = crypto.randomUUID();
    }

    for (const messages of Object.values(data.messages)) {
      for (const msg of messages) {
        messageIdMap[msg.id] = crypto.randomUUID();
      }
    }

    // 创建存档 Map
    const saveMap = new Y.Map();
    saveMap.set("id", saveId);
    saveMap.set("name", data.name);
    saveMap.set("createdAt", now);
    saveMap.set("updatedAt", now);

    // 创建会话 Map（值为普通对象，保持与 ChatRepository 结构一致）
    const conversationsMap = new Y.Map();
    for (const conv of data.conversations) {
      const newConvId = conversationIdMap[conv.id];
      const convData = {
        id: newConvId,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        ...(conv.metadata ? { metadata: conv.metadata } : {}),
      };
      conversationsMap.set(newConvId, convData);
    }
    saveMap.set("conversations", conversationsMap);

    // 创建消息 Map（值为普通对象，保持与 ChatRepository 结构一致）
    const messagesMap = new Y.Map();
    for (const [oldConvId, messages] of Object.entries(data.messages)) {
      const newConvId = conversationIdMap[oldConvId];
      if (!newConvId) continue;

      const msgArray = new Y.Array();
      for (const msg of messages) {
        const msgData = {
          id: messageIdMap[msg.id],
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          ...(msg.updatedAt ? { updatedAt: msg.updatedAt } : {}),
          ...(msg.metadata ? { metadata: msg.metadata } : {}),
        };
        msgArray.push([msgData]);
      }
      messagesMap.set(newConvId, msgArray);
    }
    saveMap.set("messages", messagesMap);

    // 创建游戏状态 Map
    const gameStateMap = new Y.Map();
    for (const [key, value] of Object.entries(data.gameState)) {
      gameStateMap.set(key, value);
    }
    saveMap.set("gameState", gameStateMap);

    // 创建角色 Map（Phase 2 → 统一为 Y.Map<Y.Map<unknown>>）
    if (data.characters && data.characters.length > 0) {
      const charactersMap = new Y.Map<Y.Map<unknown>>();
      for (const char of data.characters) {
        // 角色 ID 保持不变（不需要重新生成，因为角色与玩家身份绑定）
        // 将 ImportCharacterData 转为 Character 后编码为 Y.Map
        const character: Character = {
          id: char.id,
          name: char.name,
          controlType: char.controlType || "player",
          status: char.status,
          createdAt: char.createdAt,
          updatedAt: char.updatedAt,
          creatorUniqueTag: char.creatorUniqueTag,
          operatorUserId: char.operatorUserId,
          operatorUniqueTag: char.operatorUniqueTag,
          ...(char.attributes ? { attributes: char.attributes } : {}),
          ...(char.tags ? { tags: char.tags } : {}),
          ...(char.description ? { description: char.description } : {}),
          ...(char.personality ? { personality: char.personality } : {}),
          ...(char.appearance ? { appearance: char.appearance } : {}),
          ...(char.dimensionSelections
            ? { dimensionSelections: char.dimensionSelections }
            : {}),
          ...(char.talentIds ? { talentIds: char.talentIds } : {}),
        };
        const charMap = characterToYMap(character);
        charactersMap.set(char.id, charMap);
      }
      saveMap.set("characters", charactersMap);
    }

    // 添加到存档槽位
    saves.set(saveId, saveMap);

    return saveId;
  }

  /**
   * 导出存档数据
   *
   * 从 Yjs 提取存档数据，转换为普通 JSON 对象
   * @param saveId 存档 ID
   * @returns 导出的存档数据，如果存档不存在则返回 null
   */
  exportSave(saveId: string): ExportSaveData | null {
    const saves = this.getSaveSlots();
    const saveMap = saves.get(saveId) as Y.Map<unknown> | undefined;

    if (!saveMap) return null;

    // 提取基本信息
    const id = saveMap.get("id") as string;
    const name = (saveMap.get("name") as string) || "未命名存档";
    const createdAt = (saveMap.get("createdAt") as number) || Date.now();
    const updatedAt = (saveMap.get("updatedAt") as number) || Date.now();

    // 提取会话
    const conversationsMap = saveMap.get("conversations") as
      | Y.Map<unknown>
      | undefined;
    const conversations: ExportConversationData[] = [];

    if (conversationsMap) {
      conversationsMap.forEach((conv) => {
        const convObj = conv as Record<string, unknown>;
        conversations.push({
          id: convObj.id as string,
          title: (convObj.title as string) || "未命名会话",
          createdAt: (convObj.createdAt as number) || Date.now(),
          updatedAt: (convObj.updatedAt as number) || Date.now(),
          metadata: (convObj.metadata as Record<string, unknown>) || undefined,
        });
      });
    }

    // 提取消息
    const messagesMap = saveMap.get("messages") as
      | Y.Map<Y.Array<unknown>>
      | undefined;
    const messages: Record<string, ExportMessageData[]> = {};

    if (messagesMap) {
      messagesMap.forEach((msgArray, convId) => {
        if (msgArray instanceof Y.Array) {
          messages[convId] = msgArray.toArray().map((msg) => {
            const msgObj = msg as Record<string, unknown>;
            return {
              id: msgObj.id as string,
              role: msgObj.role as "user" | "assistant" | "system",
              content: (msgObj.content as string) || "",
              createdAt: (msgObj.createdAt as number) || Date.now(),
              updatedAt: msgObj.updatedAt as number | undefined,
              metadata:
                (msgObj.metadata as Record<string, unknown>) || undefined,
            };
          });
        }
      });
    }

    // 提取游戏状态
    const gameStateMap = saveMap.get("gameState") as Y.Map<unknown> | undefined;
    const gameState: Record<string, unknown> = {};

    if (gameStateMap) {
      gameStateMap.forEach((value, key) => {
        // 将 Yjs 类型转换为普通 JSON
        if (value instanceof Y.Map || value instanceof Y.Array) {
          gameState[key] = value.toJSON();
        } else {
          gameState[key] = value;
        }
      });
    }

    // 提取角色数据（Phase 2 → 统一从 Y.Map<Y.Map<unknown>> 读取）
    const charactersMap = saveMap.get("characters") as
      | Y.Map<Y.Map<unknown>>
      | undefined;
    const characters: Array<{
      id: string;
      name: string;
      creatorUniqueTag: string;
      operatorUserId: string;
      operatorUniqueTag: string;
      status: Character["status"];
      createdAt: number;
      updatedAt: number;
      attributes?: Record<string, unknown>;
      tags?: Record<string, unknown>;
      controlType?: "player" | "npc" | "companion";
      description?: string;
      personality?: string;
      appearance?: string;
      dimensionSelections?: Record<string, string>;
      talentIds?: string[];
    }> = [];

    if (charactersMap) {
      charactersMap.forEach((charMap) => {
        try {
          const character = yMapToCharacter(charMap);
          characters.push({
            id: character.id,
            name: character.name,
            creatorUniqueTag: character.creatorUniqueTag,
            operatorUserId: character.operatorUserId,
            operatorUniqueTag: character.operatorUniqueTag,
            status: character.status,
            createdAt: character.createdAt,
            updatedAt: character.updatedAt,
            attributes: character.attributes,
            tags: character.tags,
            controlType: character.controlType,
            description: character.description,
            personality: character.personality,
            appearance: character.appearance,
            dimensionSelections: character.dimensionSelections,
            talentIds: character.talentIds,
          });
        } catch {
          // 跳过无效角色数据
        }
      });
    }

    return {
      id,
      name,
      createdAt,
      updatedAt,
      conversations,
      messages,
      gameState,
      characters: characters.length > 0 ? characters : undefined,
    };
  }

  /**
   * 更新联机存档的成员信息
   *
   * @param saveId 存档 ID
   * @param members 成员列表
   * @param roomCode 房间码（可选）
   */
  updateSaveMembers(
    saveId: string,
    members: SaveMemberInfo[],
    roomCode?: string
  ): void {
    const saves = this.getSaveSlots();
    const save = saves.get(saveId) as Y.Map<unknown>;

    if (!save) {
      return;
    }

    const saveType = save.get("type") as SaveType;
    if (saveType !== "multiplayer") {
      return;
    }

    save.set("members", members);
    save.set("memberCount", members.length);
    if (roomCode) {
      save.set("lastRoomCode", roomCode);
    }
    save.set("updatedAt", Date.now());
  }

  /**
   * 更新联机存档的房间配置
   *
   * @param saveId 存档 ID
   * @param config 房间配置
   */
  updateSaveRoomConfig(
    saveId: string,
    config: {
      /** 上次使用的房间 ID（用于消息迁移判断） */
      lastRoomId?: string;
      roomCode?: string;
      maxPlayers?: number;
      turnDuration?: number;
    }
  ): void {
    const saves = this.getSaveSlots();
    const save = saves.get(saveId) as Y.Map<unknown>;

    if (!save) {
      return;
    }

    if (config.lastRoomId !== undefined) {
      save.set("lastRoomId", config.lastRoomId);
    }
    if (config.roomCode !== undefined) {
      save.set("lastRoomCode", config.roomCode);
    }
    if (config.maxPlayers !== undefined) {
      save.set("maxPlayers", config.maxPlayers);
    }
    if (config.turnDuration !== undefined) {
      save.set("turnDuration", config.turnDuration);
    }
    save.set("updatedAt", Date.now());
  }

  /**
   * 获取存档的房间配置
   *
   * @param saveId 存档 ID
   * @returns 房间配置，如果存档不存在则返回 null
   */
  getSaveRoomConfig(saveId: string): {
    maxPlayers?: number;
    turnDuration?: number;
  } | null {
    const saves = this.getSaveSlots();
    const save = saves.get(saveId) as Y.Map<unknown>;

    if (!save) {
      return null;
    }

    return {
      maxPlayers: save.get("maxPlayers") as number | undefined,
      turnDuration: save.get("turnDuration") as number | undefined,
    };
  }

  /**
   * 销毁 Yjs 文档和 Provider
   */
  destroy(): void {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }

    this.currentSaveId = null;
    this.initialized = false;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * 全局单例
 */
export const yjsManager = new YjsManager();
