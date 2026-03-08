/**
 * RoomSyncBridge - 房间同步桥接器
 *
 * 统一管理 Yjs 状态到 Store 和 EventBus 的同步
 *
 * 核心职责：
 * 1. 状态快照构建：从 Yjs 生成 RoomSnapshot
 * 2. 派生事件：根据 prev 和 next 快照输出领域事件
 * 3. Store 同步：统一更新 Room Store 的可读状态
 * 4. Guest 回合切换：监听 currentTurnNumber 变化，自动切换到新回合
 *
 * 基于 room-sync-bridge-proposal.md 设计文档
 * 和 multiplexing-architecture-proposal.md Phase 3 设计
 *
 * ⚠️ 架构说明：
 * - SyncBridge 是 Yjs 状态到本地 Store 的**唯一桥接点**
 * - 作为同步基础设施，允许直接更新 Store（这是架构的特例）
 * - 普通业务逻辑仍需通过 CommandBus 修改状态
 * - EventMeta 写入只在 handlers.ts 中进行，SyncBridge 只负责消费（读取+清理）
 */

import { commandBus } from "@/core/command-bus";
import { eventBus } from "@/core/event-bus";
import {
  multiplayerProvider,
  subdocManager,
  turnDocProvider,
  yjsManager,
} from "@/core/yjs";
import type { Member, RoomStatus } from "@/core/yjs/room/types";
import { RoomCommands } from "@/domain/commands/room";
import type { Character } from "@/domain/entities/character";
import { RoomEvents } from "@/domain/events/room";
import { characterToYMap, yMapToCharacter } from "@/modules/game/repository";
import {
  itemInstanceToYMap,
  skillInstanceToYMap,
  yMapToItemInstance,
  yMapToSkillInstance,
} from "@/modules/inventory/repository";
import * as Y from "yjs";
import { useRoomStore } from "../store";
import type { EventMetaReader } from "./deriveRoomEvents";
import { deriveRoomEvents, hasSnapshotChanged } from "./deriveRoomEvents";
import type {
  HostTransferMeta,
  MemberActionMeta,
  RoomSnapshot,
  SnapshotMember,
  SyncBridgeConfig,
} from "./types";
import {
  createEmptySnapshot,
  DEFAULT_SYNC_BRIDGE_CONFIG,
  toSnapshotMember,
  toWorldArchiveSummary,
} from "./types";

/**
 * RoomSyncBridge 类
 *
 * 管理单个房间的 Yjs 状态同步
 *
 * 实现 EventMetaReader 接口以支持意图型事件派生。
 * EventMeta 的消费方法（consumeMemberActionMeta / consumeHostTransferMeta）
 * 采用 consume-once 语义：读取后自动清理过期数据。
 */
export class RoomSyncBridge implements EventMetaReader {
  public readonly roomId: string;
  private config: SyncBridgeConfig;

  /** 是否已完成首次同步 */
  private hasSynced: boolean = false;

  /** 上一次的快照 */
  private lastSnapshot: RoomSnapshot | null = null;

  /** 节流计时器 */
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  /** 是否有待处理的更新 */
  private pendingUpdate: boolean = false;

  /** 元数据清理计时器（userId -> timer） */
  private cleanupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Yjs 观察器清理函数 */
  private observerCleanups: Array<() => void> = [];

  /** HistoryDoc 消息 Map 引用（用于 Guest 镜像） */
  private historyMessagesMap: Y.Map<Y.Array<unknown>> | null = null;

  /** HistoryDoc worldArchive 根引用（用于变化检测 + SaveSlot 镜像） */
  private historyWorldArchiveRoot: Y.Map<unknown> | null = null;

  /** MainDoc characters Map 引用（用于角色同步） */
  private charactersMap: Y.Map<Y.Map<unknown>> | null = null;

  /** MainDoc inventory 根引用（用于 Inventory/Skill 同步） */
  private inventoryRoot: Y.Map<Y.Map<unknown>> | null = null;

  /** 是否已销毁 */
  private destroyed: boolean = false;

  /** 上一次处理的回合号（用于 Guest 回合切换检测） */
  private lastProcessedTurnNumber: number = 0;

  /** 是否正在切换回合（防止重复切换） */
  private isSwitchingTurn: boolean = false;

  /** 房间解散已处理标记，避免重复处理 */
  private disbandedHandled: boolean = false;

  constructor(roomId: string, config: Partial<SyncBridgeConfig> = {}) {
    this.roomId = roomId;
    this.config = { ...DEFAULT_SYNC_BRIDGE_CONFIG, ...config };
  }

  // ===== 生命周期 =====

  /**
   * 设置 Yjs 观察器
   *
   * 监听 MainDoc 中的核心状态变化
   */
  setup(): void {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      console.warn(
        `[RoomSyncBridge] Cannot setup: MainDoc not found for room ${this.roomId}`,
      );
      return;
    }

    // 获取需要监听的 Map
    const metadataMap = mainDoc.getMap("metadata");
    const configMap = mainDoc.getMap("config");
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;
    const charactersMap = mainDoc.getMap("characters") as Y.Map<Y.Map<unknown>>;
    const inventoryRoot = subdocManager.getRoomInventoryRoot(this.roomId);

    console.info("[RoomSyncDiag] SyncBridge.setup", {
      roomId: this.roomId,
      membersSize: membersMap.size,
      metadataKeys: Array.from(metadataMap.keys()),
      configKeys: Array.from(configMap.keys()),
      disbanded: (metadataMap.get("disbanded") as boolean | undefined) ?? false,
    });

    // 保存引用
    this.charactersMap = charactersMap;
    this.inventoryRoot = inventoryRoot;

    // 创建观察器回调
    const observer = () => this.scheduleUpdate();

    // 注册观察器
    metadataMap.observe(observer);
    configMap.observe(observer);
    membersMap.observe(observer);

    // 保存清理函数
    this.observerCleanups.push(
      () => metadataMap.unobserve(observer),
      () => configMap.unobserve(observer),
      () => membersMap.unobserve(observer),
    );

    // 设置 characters 同步（监听深层变化）
    this.setupCharactersSync(charactersMap);

    // 设置 inventory 同步（MainDoc.inventory -> SaveSlot.inventories/skills）
    if (inventoryRoot) {
      this.setupInventorySync(inventoryRoot);
    }

    // 新增：为 configMap 添加专门的回合号变化监听器
    // 用于 Guest 自动切换到新回合
    const turnNumberObserver = (event: Y.YMapEvent<unknown>) => {
      if (event.keysChanged.has("currentTurnNumber")) {
        this.handleTurnNumberChange();
      }
    };
    configMap.observe(turnNumberObserver);
    this.observerCleanups.push(() => configMap.unobserve(turnNumberObserver));

    // 初始化 lastProcessedTurnNumber
    this.lastProcessedTurnNumber =
      (configMap.get("currentTurnNumber") as number) || 0;

    // 设置 HistoryDoc 镜像（Guest 持久化历史）
    this.setupHistoryMirror();

    // 立即执行一次同步（首次同步）
    this.processUpdate();
  }

  /**
   * 销毁 SyncBridge
   *
   * 清理所有观察器和计时器
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // 清理节流计时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // 清理元数据清理计时器
    this.cleanupTimers.forEach((timer) => clearTimeout(timer));
    this.cleanupTimers.clear();

    // 清理 Yjs 观察器
    this.observerCleanups.forEach((cleanup) => cleanup());
    this.observerCleanups = [];

    // 重置状态
    this.hasSynced = false;
    this.lastSnapshot = null;
    this.pendingUpdate = false;
    this.lastProcessedTurnNumber = 0;
    this.isSwitchingTurn = false;
    this.disbandedHandled = false;
    this.savedMemberCount = 0;
    this.historyMessagesMap = null;
    this.historyWorldArchiveRoot = null;
    this.charactersMap = null;
    this.inventoryRoot = null;
  }

  /**
   * 重连时重置同步标记
   *
   * 下次同步将被视为首次同步，不派生事件
   */
  onReconnect(): void {
    this.hasSynced = false;
    this.isSwitchingTurn = false;
    this.disbandedHandled = false;
  }

  // ===== Guest 回合切换 =====

  /**
   * 处理回合号变化
   *
   * 当 MainDoc 中的 currentTurnNumber 变化时调用
   * 只有 Guest 需要自动切换到新回合
   */
  private handleTurnNumberChange(): void {
    if (this.destroyed || this.isSwitchingTurn) {
      return;
    }

    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return;
    }

    const configMap = mainDoc.getMap("config");
    const newTurnNumber = (configMap.get("currentTurnNumber") as number) || 0;

    // 检查是否是新回合（回合号增加且大于 0）
    if (newTurnNumber <= this.lastProcessedTurnNumber || newTurnNumber <= 0) {
      return;
    }

    const store = useRoomStore.getState();
    const currentRoom = store.currentRoom;

    // 只有 Guest 需要自动切换
    // Host 的回合切换由 advancePhaseHandler 处理
    if (!currentRoom || currentRoom.isHost) {
      this.lastProcessedTurnNumber = newTurnNumber;
      return;
    }

    // 异步执行回合切换
    this.switchToTurn(newTurnNumber);
  }

  /**
   * 切换到指定回合
   *
   * Guest 专用：断开旧回合连接，加入新回合
   *
   * @param turnNumber 目标回合号
   */
  private async switchToTurn(turnNumber: number): Promise<void> {
    if (this.isSwitchingTurn) {
      return;
    }

    this.isSwitchingTurn = true;
    const previousTurn = this.lastProcessedTurnNumber;

    try {
      // 断开旧回合连接（如果有）
      if (previousTurn > 0) {
        turnDocProvider.disconnect(this.roomId, previousTurn);
      }

      // 使用 joinTurnDoc 加入新回合（不初始化结构，等待服务器填充）
      const turnDoc = subdocManager.joinTurnDoc(this.roomId, turnNumber);

      // ⚠️ 关键修复：确保 TurnDocProvider 配置已设置且匹配当前房间
      // Guest 加入房间时如果游戏还没开始，配置可能没有设置
      // 或者用户切换了房间，配置可能是旧房间的
      const mpConfig = multiplayerProvider.getConfig();
      const currentTurnConfig = turnDocProvider.getConfig();

      if (mpConfig) {
        // 检查配置是否需要更新（未设置或 roomId 不匹配）
        if (!currentTurnConfig || currentTurnConfig.roomId !== this.roomId) {
          turnDocProvider.setConfig({
            roomId: mpConfig.roomId,
            token: mpConfig.token,
            wsUrl: mpConfig.wsUrl,
          });
        }
      }

      // 连接到新回合
      await turnDocProvider.connect(this.roomId, turnNumber, turnDoc);

      // 带重试的同步等待
      await this.waitForTurnSyncWithRetry(turnNumber, 3);

      // 更新已处理的回合号
      this.lastProcessedTurnNumber = turnNumber;
    } catch {
      // 触发错误事件，让 UI 层处理
      eventBus.emit(
        eventBus.createEvent(RoomEvents.TURN_TIMEOUT, {
          roomId: this.roomId,
          turnNumber,
          reason: "sync_failed",
        }),
      );
    } finally {
      this.isSwitchingTurn = false;
    }
  }

  /**
   * 带重试的 TurnDoc 同步等待
   *
   * @param turnNumber 回合号
   * @param maxRetries 最大重试次数
   * @param timeout 单次超时时间（毫秒）
   */
  private async waitForTurnSyncWithRetry(
    turnNumber: number,
    maxRetries: number,
    timeout: number = 5000,
  ): Promise<void> {
    let retries = maxRetries;

    while (retries > 0) {
      try {
        await turnDocProvider.waitForSync(this.roomId, turnNumber, timeout);
        return;
      } catch {
        retries--;
        if (retries === 0) {
          throw new Error(
            `Failed to sync turn ${turnNumber} after ${maxRetries} retries`,
          );
        }

        // 短暂等待后重试
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // ===== 快照构建 =====

  /**
   * 从 Yjs MainDoc 构建房间快照
   */
  buildSnapshot(): RoomSnapshot {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      console.warn(
        `[RoomSyncBridge] buildSnapshot: MainDoc not found, returning empty snapshot`,
      );
      return createEmptySnapshot(this.roomId);
    }

    const metadataMap = mainDoc.getMap("metadata");
    const configMap = mainDoc.getMap("config");
    const membersMap = mainDoc.getMap("members") as Y.Map<Member>;

    // 提取成员列表并排序
    const members: SnapshotMember[] = [];
    membersMap.forEach((member) => {
      members.push(toSnapshotMember(member));
    });
    // 按 userId 排序以保证一致性
    members.sort((a, b) => a.userId.localeCompare(b.userId));

    const worldArchiveSummary = this.buildWorldArchiveSummary();

    const snapshot: RoomSnapshot = {
      roomId: this.roomId,
      hostUserId: (metadataMap.get("hostUserId") as string) || "",
      status: (metadataMap.get("status") as RoomStatus) || "waiting",
      members,
      maxPlayers: (metadataMap.get("maxPlayers") as number) || 8,
      turnDuration:
        (metadataMap.get("turnDuration") as number) || 5 * 60 * 1000,
      currentTurnNumber: (configMap.get("currentTurnNumber") as number) || 0,
      currentPhaseId:
        (configMap.get("currentPhaseId") as string | null) || null,
      worldArchiveEntityCount: worldArchiveSummary.entityCount,
      worldArchiveVersion: worldArchiveSummary.version,
      worldArchiveUpdatedAt: worldArchiveSummary.updatedAt,
      updatedAt: Date.now(),
    };

    return snapshot;
  }

  /**
   * 获取上一次的快照
   */
  getLastSnapshot(): RoomSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * 检查是否已完成首次同步
   */
  isInitialized(): boolean {
    return this.hasSynced;
  }

  // ===== 节流更新 =====

  /**
   * 调度更新（带节流）
   *
   * 合并短时间内的多次更新
   */
  private scheduleUpdate(): void {
    if (this.destroyed) {
      return;
    }

    if (this.updateTimer) {
      // 已有计时器在运行，标记待处理
      this.pendingUpdate = true;
      return;
    }

    // 立即处理第一次更新
    this.processUpdate();

    // 设置节流计时器
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      if (this.pendingUpdate) {
        this.pendingUpdate = false;
        this.processUpdate();
      }
    }, this.config.throttleMs);
  }

  /**
   * 处理更新
   */
  private processUpdate(): void {
    if (this.destroyed) {
      return;
    }

    // 检测房间解散（从 legacy setupYjsMembersObserver 迁移）
    if (this.checkDisbanded()) {
      return; // 房间已解散，不再继续同步
    }

    const currentSnapshot = this.buildSnapshot();

    if (!this.hasSynced) {
      // 首次同步：只更新 Store，不派生事件
      this.applySnapshotToStore(currentSnapshot);
      this.lastSnapshot = currentSnapshot;
      this.hasSynced = true;
      return;
    }

    // 检查是否有实质性变化
    if (!hasSnapshotChanged(this.lastSnapshot!, currentSnapshot)) {
      return;
    }

    // 派生事件
    const { events, diff } = deriveRoomEvents(
      this.lastSnapshot!,
      currentSnapshot,
      this, // 传入 this 作为 EventMetaReader
    );

    // 发送事件
    for (const event of events) {
      eventBus.emit(event);
    }

    // 仅 Host 调度元数据清理（延迟清理）
    const store = useRoomStore.getState();
    if (store.currentRoom?.isHost) {
      // 清理离开成员的元数据
      for (const member of diff.membersLeft) {
        this.scheduleMetaCleanup(member.userId);
      }
      // 执行兜底清理
      this.cleanupStaleMetadata();
    }

    // 更新 Store
    this.applySnapshotToStore(currentSnapshot);
    this.lastSnapshot = currentSnapshot;
  }

  /**
   * 检测房间是否已被解散
   *
   * 从 legacy setupYjsMembersObserver 迁移的 disbanded 检测逻辑。
   * 当房主解散房间时，非房主成员检测到 disbanded 标记后：
   * 1. 发布 ROOM_DELETED 事件
   * 2. 通过 CommandBus 触发 LEAVE_ROOM
   *
   * @returns true 表示已检测到解散并处理，调用方应停止后续同步
   */
  private checkDisbanded(): boolean {
    if (this.disbandedHandled) {
      return false;
    }

    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return false;
    }

    const metadataMap = mainDoc.getMap("metadata");
    const disbanded = metadataMap.get("disbanded") as boolean | undefined;
    if (!disbanded) {
      return false;
    }

    this.disbandedHandled = true;

    const store = useRoomStore.getState();
    const localUser = store.localUser;
    const hostUserId = metadataMap.get("hostUserId") as string | undefined;

    // 只有非房主才需要处理解散通知
    if (localUser.userId && hostUserId !== localUser.userId) {
      // 发布房间解散事件
      eventBus.emit(
        eventBus.createEvent(RoomEvents.ROOM_DELETED, {
          roomId: this.roomId,
          deletedAt: Date.now(),
          reason: "disbanded",
        }),
      );

      // 自动离开房间（通过 CommandBus 触发）
      commandBus.dispatch({
        type: RoomCommands.LEAVE_ROOM,
        payload: { roomId: this.roomId, userId: localUser.userId },
      });

      return true;
    }

    return false;
  }

  // ===== Store 同步 =====

  /**
   * 将快照应用到 Room Store
   *
   * ⚠️ 架构特例：SyncBridge 作为 Yjs → Store 的唯一桥接点，
   * 允许直接更新 Store，确保本地状态与 Yjs 状态同步。
   * 这不等同于业务逻辑修改状态，业务逻辑仍需通过 CommandBus。
   */
  private applySnapshotToStore(snapshot: RoomSnapshot): void {
    const store = useRoomStore.getState();
    const currentRoom = store.currentRoom;

    // 更新成员列表（转换为完整 Member 格式）
    const members: Member[] = snapshot.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: m.joinedAt,
      lastActiveAt: Date.now(),
      status: m.status,
    }));
    store.setMembers(members);

    // 更新房间信息（如果已有房间）
    if (currentRoom) {
      // 从 Yjs 读取 name 和 code（从 legacy setupYjsMembersObserver 迁移）
      const mainDoc = subdocManager.getMainDoc(this.roomId);
      const metadataMap = mainDoc?.getMap("metadata");
      const name = (metadataMap?.get("name") as string) || currentRoom.name;
      const code = (metadataMap?.get("code") as string) || currentRoom.code;

      const needsUpdate =
        currentRoom.maxPlayers !== snapshot.maxPlayers ||
        currentRoom.turnDuration !== snapshot.turnDuration ||
        currentRoom.name !== name ||
        currentRoom.code !== code;

      if (needsUpdate) {
        store.setCurrentRoom({
          ...currentRoom,
          maxPlayers: snapshot.maxPlayers,
          turnDuration: snapshot.turnDuration,
          name,
          code,
        });
      }
    }

    // 更新存档的成员列表（Host/Guest 都需要写入本地存档，便于续玩展示成员）
    if (currentRoom) {
      this.updateSaveMembers(snapshot);
    }

    // Guest 镜像 HistoryDoc 消息到本地 SaveSlot
    if (!currentRoom?.isHost && this.historyMessagesMap) {
      this.mirrorHistoryMessages(this.historyMessagesMap);
    }
  }

  /** 记录存档中保存的最大成员数（用于防止成员离开时覆盖） */
  private savedMemberCount: number = 0;

  /**
   * 更新存档的成员列表
   *
   * 将当前房间的成员信息同步到存档中，以便下次续玩时显示
   *
   * 注意：只在成员数量增加或保持不变时更新，防止成员离开时覆盖
   */
  private updateSaveMembers(snapshot: RoomSnapshot): void {
    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId) return;

    // 获取 MainDoc 中的房间码
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) return;

    const metadataMap = mainDoc.getMap("metadata");
    const roomCode = metadataMap.get("code") as string | undefined;

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    const savedMembers = saveSlot?.get("members") as
      | Array<{ displayName: string; role: "host" | "guest" }>
      | undefined;
    const savedCount = savedMembers?.length ?? 0;

    // 检查成员数量：只在成员增加或保持不变时更新
    // 这样可以防止成员离开（尤其是房间解散或未到齐时）覆盖之前保存的完整成员列表
    const currentMemberCount = snapshot.members.length;
    if (
      currentMemberCount < this.savedMemberCount ||
      currentMemberCount < savedCount
    ) {
      return;
    }

    // 转换成员格式
    const saveMembers = snapshot.members.map((m) => ({
      displayName: m.displayName,
      role: m.role,
    }));

    // 更新存档
    yjsManager.updateSaveMembers(currentSaveId, saveMembers, roomCode);

    // 更新记录的成员数
    this.savedMemberCount = Math.max(
      this.savedMemberCount,
      savedCount,
      currentMemberCount,
    );

    // 同时更新房间配置
    yjsManager.updateSaveRoomConfig(currentSaveId, {
      maxPlayers: snapshot.maxPlayers,
      turnDuration: snapshot.turnDuration,
    });
  }

  // ===== Characters 同步 =====

  /**
   * 设置 characters 同步
   *
   * 监听 MainDoc.characters 的深层变化，同步到 SaveSlot
   */
  private setupCharactersSync(charactersMap: Y.Map<Y.Map<unknown>>): void {
    // 使用 observeDeep 监听嵌套 Y.Map 的变化
    const observer = () => this.syncCharactersToSave();

    charactersMap.observeDeep(observer);
    this.observerCleanups.push(() => charactersMap.unobserveDeep(observer));

    // 初次同步一次
    this.syncCharactersToSave();
  }

  /**
   * 将 MainDoc.characters 同步到 SaveSlot.characters
   *
   * 使用 Y.Map<Y.Map<unknown>> 格式，与 MainDoc 统一
   */
  private syncCharactersToSave(): void {
    if (this.destroyed) return;

    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId || !this.charactersMap) return;

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    if (!saveSlot) {
      return;
    }

    // 从 MainDoc.characters 提取角色数据
    const characters: Character[] = [];
    this.charactersMap.forEach((charMap) => {
      const character = yMapToCharacter(charMap);
      if (character.id) {
        characters.push(character);
      }
    });

    // 获取或创建 SaveSlot.characters
    let saveCharacters = saveSlot.get("characters") as
      | Y.Map<Y.Map<unknown>>
      | undefined;

    const existingCount = saveCharacters?.size || 0;

    // 保护逻辑：MainDoc 为空时保留 SaveSlot 中的角色
    if (characters.length === 0 && existingCount > 0) {
      return;
    }

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      if (!saveCharacters) {
        saveCharacters = new Y.Map<Y.Map<unknown>>();
        saveSlot.set("characters", saveCharacters);
      }

      // 更新/新增：直接 set 即可（Y.Map 会自动覆盖已有 key）
      for (const character of characters) {
        saveCharacters!.set(character.id, characterToYMap(character));
      }

      // ❌ 不删除 SaveSlot 中存在但 MainDoc 中不存在的角色
      // 原因：续玩场景下 MainDoc 初始为空，删除逻辑会错误清除 SaveSlot 中的角色
      // 角色删除应通过显式命令（如 DELETE_CHARACTER）处理，而非同步逻辑

      // 更新存档时间戳
      saveSlot.set("updatedAt", Date.now());
    });
  }

  // ===== Inventory / Skill 同步 =====

  /**
   * 克隆物品数组（Y.Array<Y.Map<unknown>>）
   *
   * 通过 codec 做 decode + encode，避免跨 Doc 复用 Yjs 实例。
   */
  private buildClonedItemArray(
    source: Y.Array<unknown>,
  ): Y.Array<Y.Map<unknown>> {
    const cloned = new Y.Array<Y.Map<unknown>>();
    const encoded: Y.Map<unknown>[] = [];

    for (let index = 0; index < source.length; index++) {
      const raw = source.get(index);
      if (!(raw instanceof Y.Map)) {
        continue;
      }

      try {
        const item = yMapToItemInstance(raw);
        encoded.push(itemInstanceToYMap(item));
      } catch {
        // 跳过无效数据
      }
    }

    if (encoded.length > 0) {
      cloned.insert(0, encoded);
    }

    return cloned;
  }

  /**
   * 克隆技能数组（Y.Array<Y.Map<unknown>>）
   *
   * 通过 codec 做 decode + encode，避免跨 Doc 复用 Yjs 实例。
   */
  private buildClonedSkillArray(
    source: Y.Array<unknown>,
  ): Y.Array<Y.Map<unknown>> {
    const cloned = new Y.Array<Y.Map<unknown>>();
    const encoded: Y.Map<unknown>[] = [];

    for (let index = 0; index < source.length; index++) {
      const raw = source.get(index);
      if (!(raw instanceof Y.Map)) {
        continue;
      }

      try {
        const skill = yMapToSkillInstance(raw);
        encoded.push(skillInstanceToYMap(skill));
      } catch {
        // 跳过无效数据
      }
    }

    if (encoded.length > 0) {
      cloned.insert(0, encoded);
    }

    return cloned;
  }

  /**
   * Host 启动房间同步时，将本地 SaveSlot.inventory 作为初始权威状态补写到 MainDoc.inventory。
   *
   * 仅在 MainDoc.inventory 为空时执行，避免覆盖已有联机权威数据。
   */
  private seedMainInventoryFromSave(
    inventoryRoot: Y.Map<Y.Map<unknown>>,
  ): void {
    if (inventoryRoot.size > 0) {
      return;
    }

    const store = useRoomStore.getState();
    if (!store.currentRoom?.isHost) {
      return;
    }

    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId) {
      return;
    }

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    if (!saveSlot) {
      return;
    }

    const saveInventories = saveSlot.get("inventories") as
      | Y.Map<Y.Array<unknown>>
      | undefined;
    const saveSkills = saveSlot.get("skills") as
      | Y.Map<Y.Array<unknown>>
      | undefined;

    if (
      (!saveInventories || saveInventories.size === 0) &&
      (!saveSkills || saveSkills.size === 0)
    ) {
      return;
    }

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      const characterIds = new Set<string>();

      saveInventories?.forEach((_value, characterId) => {
        characterIds.add(characterId);
      });
      saveSkills?.forEach((_value, characterId) => {
        characterIds.add(characterId);
      });

      characterIds.forEach((characterId) => {
        const characterInventoryMap = new Y.Map<unknown>();

        const sourceItems = saveInventories?.get(characterId);
        const sourceSkills = saveSkills?.get(characterId);

        characterInventoryMap.set(
          "items",
          sourceItems instanceof Y.Array
            ? this.buildClonedItemArray(sourceItems)
            : new Y.Array<Y.Map<unknown>>(),
        );
        characterInventoryMap.set(
          "skills",
          sourceSkills instanceof Y.Array
            ? this.buildClonedSkillArray(sourceSkills)
            : new Y.Array<Y.Map<unknown>>(),
        );

        inventoryRoot.set(characterId, characterInventoryMap);
      });
    });
  }

  /**
   * 设置 MainDoc.inventory -> SaveSlot 的同步。
   */
  private setupInventorySync(inventoryRoot: Y.Map<Y.Map<unknown>>): void {
    // Host 首次建房/续玩时，先把本地库存作为初始权威状态写入 MainDoc
    this.seedMainInventoryFromSave(inventoryRoot);

    const observer = () => this.syncInventoryToSave();

    inventoryRoot.observeDeep(observer);
    this.observerCleanups.push(() => inventoryRoot.unobserveDeep(observer));

    // 初次同步一次
    this.syncInventoryToSave();
  }

  /**
   * 将 MainDoc.inventory 同步到 SaveSlot.inventories / SaveSlot.skills。
   *
   * 仅做 MainDoc -> SaveSlot 的单向镜像，避免回环写入。
   */
  private syncInventoryToSave(): void {
    if (this.destroyed || !this.inventoryRoot) {
      return;
    }

    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId) {
      return;
    }

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    if (!saveSlot) {
      return;
    }

    let saveInventories = saveSlot.get("inventories") as
      | Y.Map<Y.Array<Y.Map<unknown>>>
      | undefined;
    let saveSkills = saveSlot.get("skills") as
      | Y.Map<Y.Array<Y.Map<unknown>>>
      | undefined;

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      if (!saveInventories) {
        saveInventories = new Y.Map<Y.Array<Y.Map<unknown>>>();
        saveSlot.set("inventories", saveInventories);
      }

      if (!saveSkills) {
        saveSkills = new Y.Map<Y.Array<Y.Map<unknown>>>();
        saveSlot.set("skills", saveSkills);
      }

      const characterIds = new Set<string>();

      this.inventoryRoot!.forEach((characterInventoryMap, characterId) => {
        if (!(characterInventoryMap instanceof Y.Map)) {
          return;
        }

        characterIds.add(characterId);

        const sourceItems = characterInventoryMap.get("items");
        const sourceSkills = characterInventoryMap.get("skills");

        saveInventories!.set(
          characterId,
          sourceItems instanceof Y.Array
            ? this.buildClonedItemArray(sourceItems)
            : new Y.Array<Y.Map<unknown>>(),
        );

        saveSkills!.set(
          characterId,
          sourceSkills instanceof Y.Array
            ? this.buildClonedSkillArray(sourceSkills)
            : new Y.Array<Y.Map<unknown>>(),
        );
      });

      for (const characterId of Array.from(saveInventories!.keys())) {
        if (!characterIds.has(characterId)) {
          saveInventories!.delete(characterId);
        }
      }

      for (const characterId of Array.from(saveSkills!.keys())) {
        if (!characterIds.has(characterId)) {
          saveSkills!.delete(characterId);
        }
      }

      saveSlot.set("updatedAt", Date.now());
    });
  }

  // ===== HistoryDoc 镜像（Guest） =====

  /**
   * 初始化 HistoryDoc → SaveSlot 镜像（Guest）
   */
  private setupHistoryMirror(): void {
    subdocManager
      .loadHistoryDoc(this.roomId)
      .then((historyDoc) => {
        if (this.destroyed) {
          return;
        }

        const messagesMap = historyDoc.getMap("messages") as Y.Map<
          Y.Array<unknown>
        >;
        const worldArchiveRoot = historyDoc.getMap("worldArchive");

        this.historyMessagesMap = messagesMap;
        this.historyWorldArchiveRoot = worldArchiveRoot;

        const observer = () => this.mirrorHistoryMessages(messagesMap);

        // 监听深层变更，捕获消息数组的 push/insert/delete
        messagesMap.observeDeep(observer);
        this.observerCleanups.push(() => messagesMap.unobserveDeep(observer));

        const worldArchiveObserver = () => {
          if (this.destroyed) {
            return;
          }
          this.scheduleUpdate();
          this.mirrorWorldArchiveToSave(worldArchiveRoot);
        };

        worldArchiveRoot.observeDeep(worldArchiveObserver);
        this.observerCleanups.push(() =>
          worldArchiveRoot.unobserveDeep(worldArchiveObserver),
        );

        // 初次镜像一次（如果当前是 Guest）
        this.mirrorHistoryMessages(messagesMap);
        this.mirrorWorldArchiveToSave(worldArchiveRoot);
      })
      .catch(() => {
        // HistoryDoc 镜像设置失败，静默处理
      });
  }

  /**
   * 将 HistoryDoc 消息镜像到本地 SaveSlot（Guest）
   *
   * Host 不执行，避免重复写入
   */
  private mirrorHistoryMessages(messagesMap: Y.Map<Y.Array<unknown>>): void {
    if (this.destroyed) return;

    const store = useRoomStore.getState();
    const currentRoom = store.currentRoom;

    // Host 不执行镜像，避免重复写入
    if (!currentRoom || currentRoom.isHost) return;

    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId) {
      return;
    }

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    if (!saveSlot) {
      return;
    }

    let saveMessagesMap = saveSlot.get("messages") as
      | Y.Map<Y.Array<unknown>>
      | undefined;
    if (!saveMessagesMap) {
      saveMessagesMap = new Y.Map<Y.Array<unknown>>();
      saveSlot.set("messages", saveMessagesMap);
    }

    let saveConversationsMap = saveSlot.get("conversations") as
      | Y.Map<unknown>
      | undefined;
    if (!saveConversationsMap) {
      saveConversationsMap = new Y.Map<unknown>();
      saveSlot.set("conversations", saveConversationsMap);
    }

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      messagesMap.forEach((historyArray, convId) => {
        if (!(historyArray instanceof Y.Array)) {
          return;
        }

        if (!saveConversationsMap.has(convId)) {
          const roomMainMatch = /^room:(.+):main$/.exec(convId);
          saveConversationsMap.set(convId, {
            id: convId,
            title: roomMainMatch ? "联机房间记录" : "未命名会话",
            characterIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...(roomMainMatch
              ? {
                  metadata: {
                    type: "multiplayer-room-main",
                    roomId: roomMainMatch[1],
                  },
                }
              : {}),
          });
        }

        let saveArray = saveMessagesMap.get(convId) as
          | Y.Array<unknown>
          | undefined;

        if (!saveArray) {
          saveArray = new Y.Array<unknown>();
          saveMessagesMap.set(convId, saveArray);
        }

        const existingIndexById = new Map<string, number>();
        const saveItems = saveArray.toArray() as Array<Record<string, unknown>>;

        for (let i = 0; i < saveItems.length; i++) {
          const id = saveItems[i]?.id;
          if (typeof id === "string") {
            existingIndexById.set(id, i);
          }
        }

        const historyItems = historyArray.toArray() as Array<
          Record<string, unknown>
        >;
        const newItems: Record<string, unknown>[] = [];
        const updateItems: Array<{
          index: number;
          message: Record<string, unknown>;
        }> = [];

        for (const msg of historyItems) {
          const id = msg?.id;
          if (typeof id !== "string") {
            continue;
          }

          const existingIndex = existingIndexById.get(id);
          if (existingIndex !== undefined) {
            updateItems.push({ index: existingIndex, message: msg });
            continue;
          }

          newItems.push(msg);
        }

        updateItems
          .sort((a, b) => b.index - a.index)
          .forEach(({ index, message }) => {
            saveArray.delete(index, 1);
            saveArray.insert(index, [message]);
          });

        if (newItems.length > 0) {
          saveArray.insert(saveArray.length, newItems);
        }
      });

      saveSlot.set("updatedAt", Date.now());
    });
  }

  /**
   * 从 HistoryDoc.worldArchive 读取实体快照摘要，用于 Room 快照 diff 检测。
   */
  private buildWorldArchiveSummary(): {
    entityCount: number;
    version: number;
    updatedAt: number;
  } {
    const root = this.historyWorldArchiveRoot;
    if (!(root instanceof Y.Map)) {
      return { entityCount: 0, version: 0, updatedAt: 0 };
    }

    const entitiesMap = root.get("entities");
    const metadataMap = root.get("metadata");

    const entityCount = entitiesMap instanceof Y.Map ? entitiesMap.size : 0;

    const versionRaw =
      metadataMap instanceof Y.Map ? metadataMap.get("version") : undefined;
    const version = typeof versionRaw === "number" ? versionRaw : 0;

    const updatedAtRaw =
      metadataMap instanceof Y.Map ? metadataMap.get("updatedAt") : undefined;
    const updatedAt = typeof updatedAtRaw === "number" ? updatedAtRaw : 0;

    return toWorldArchiveSummary({
      entityCount,
      version,
      updatedAt,
    });
  }

  /**
   * Guest 镜像 worldArchive 到本地 SaveSlot（用于续玩展示），Host 不执行。
   */
  /**
   * worldArchive 变化判定使用 metadata.version / metadata.updatedAt，避免高频全量序列化。
   * SaveSlot 镜像是单向 HistoryDoc -> SaveSlot，不会回写 HistoryDoc，因此无跨端回环。
   */
  private mirrorWorldArchiveToSave(worldArchiveRoot: Y.Map<unknown>): void {
    if (this.destroyed) {
      return;
    }

    const store = useRoomStore.getState();
    const currentRoom = store.currentRoom;

    // Host 不执行镜像，避免与权威写入链路重复。
    if (!currentRoom || currentRoom.isHost) {
      return;
    }

    const entitiesSource = worldArchiveRoot.get("entities");
    if (!(entitiesSource instanceof Y.Map)) {
      return;
    }

    const currentSaveId = yjsManager.getCurrentSaveId();
    if (!currentSaveId) {
      return;
    }

    const saveSlot = yjsManager.getSaveSlots().get(currentSaveId) as
      | Y.Map<unknown>
      | undefined;
    if (!saveSlot) {
      return;
    }

    const rootDoc = yjsManager.getDoc();

    rootDoc.transact(() => {
      let saveWorldArchive = saveSlot.get("worldArchive") as
        | Y.Map<unknown>
        | undefined;
      if (!(saveWorldArchive instanceof Y.Map)) {
        saveWorldArchive = new Y.Map<unknown>();
        saveSlot.set("worldArchive", saveWorldArchive);
      }

      let saveEntities = saveWorldArchive.get("entities") as
        | Y.Map<string>
        | undefined;
      if (!(saveEntities instanceof Y.Map)) {
        saveEntities = new Y.Map<string>();
        saveWorldArchive.set("entities", saveEntities);
      }

      const sourceIds = new Set<string>();
      entitiesSource.forEach((rawValue, entityId) => {
        if (typeof rawValue !== "string") {
          return;
        }

        sourceIds.add(entityId);
        saveEntities!.set(entityId, rawValue);
      });

      for (const entityId of Array.from(saveEntities.keys())) {
        if (!sourceIds.has(entityId)) {
          saveEntities.delete(entityId);
        }
      }

      saveSlot.set("updatedAt", Date.now());
    });
  }

  // ===== EventMeta 操作 =====

  /**
   * 消费成员事件元数据（consume-once 语义）
   *
   * 读取指定用户的成员事件元数据。如果数据已过期，会自动清理并返回 null。
   * 由 deriveRoomEvents 在事件派生时调用。
   *
   * @param userId 用户 ID
   * @returns 元数据，如果不存在或已过期则返回 null
   */
  consumeMemberActionMeta(userId: string): MemberActionMeta | null {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return null;
    }

    const eventMetaMap = mainDoc.getMap("eventMeta");
    const memberActionsMap = eventMetaMap.get("memberActions") as
      | Y.Map<MemberActionMeta>
      | undefined;

    if (!memberActionsMap) {
      return null;
    }

    const meta = memberActionsMap.get(userId);
    if (!meta) {
      return null;
    }

    // 检查是否已过期（兜底清理）
    if (Date.now() - meta.at > this.config.metaStaleTimeoutMs) {
      // 过期数据，清理并返回 null
      memberActionsMap.delete(userId);
      return null;
    }

    return meta;
  }

  /**
   * 消费 Host 转让元数据（consume-once 语义）
   *
   * 读取 Host 转让元数据。如果数据已过期，会自动清理并返回 null。
   * 由 deriveRoomEvents 在事件派生时调用。
   *
   * @returns 元数据，如果不存在或已过期则返回 null
   */
  consumeHostTransferMeta(): HostTransferMeta | null {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return null;
    }

    const eventMetaMap = mainDoc.getMap("eventMeta");
    const hostTransfer = eventMetaMap.get("hostTransfer") as
      | HostTransferMeta
      | undefined;

    if (!hostTransfer) {
      return null;
    }

    // 检查是否已过期
    if (Date.now() - hostTransfer.at > this.config.metaStaleTimeoutMs) {
      eventMetaMap.delete("hostTransfer");
      return null;
    }

    return hostTransfer;
  }

  /**
   * 调度元数据清理（延迟清理）
   *
   * @param userId 要清理的用户 ID
   */
  scheduleMetaCleanup(userId: string): void {
    // 如果已有计时器，不重复设置
    if (this.cleanupTimers.has(userId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.cleanupMemberActionMeta(userId);
      this.cleanupTimers.delete(userId);
    }, this.config.metaCleanupDelayMs);

    this.cleanupTimers.set(userId, timer);
  }

  /**
   * 清理成员事件元数据
   */
  private cleanupMemberActionMeta(userId: string): void {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return;
    }

    const eventMetaMap = mainDoc.getMap("eventMeta");
    const memberActionsMap = eventMetaMap.get("memberActions") as
      | Y.Map<MemberActionMeta>
      | undefined;

    if (memberActionsMap) {
      memberActionsMap.delete(userId);
    }
  }

  /**
   * 清理过期的元数据（兜底清理）
   */
  cleanupStaleMetadata(): void {
    const mainDoc = subdocManager.getMainDoc(this.roomId);
    if (!mainDoc) {
      return;
    }

    const now = Date.now();
    const eventMetaMap = mainDoc.getMap("eventMeta");
    const memberActionsMap = eventMetaMap.get("memberActions") as
      | Y.Map<MemberActionMeta>
      | undefined;

    if (!memberActionsMap) {
      return;
    }

    const staleKeys: string[] = [];
    memberActionsMap.forEach((meta, key) => {
      if (now - meta.at > this.config.metaStaleTimeoutMs) {
        staleKeys.push(key);
      }
    });

    if (staleKeys.length > 0) {
      mainDoc.transact(() => {
        staleKeys.forEach((key) => memberActionsMap.delete(key));
      });
    }
  }
}
