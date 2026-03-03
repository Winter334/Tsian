/**
 * TurnDoc 网络同步管理器
 *
 * 管理 TurnDoc 的 HocuspocusProvider 连接
 * 每个回合一个独立连接，与 MainDoc 的 Provider 共享同一 WebSocket
 *
 * ⚠️ 架构说明：
 * - 这是 core/ 层的基础设施，不应该直接依赖 config/ 或 modules/
 * - 配置通过 setConfig() 方法注入，由调用方（handlers）提供
 * - 只负责网络连接管理，不包含任何业务逻辑
 * - 使用 SharedWebSocketManager 实现 Multiplexing（与 MainDoc 复用同一连接）
 */

import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { ConnectionStatus } from "./multiplayer-provider";
import { sharedWebSocket } from "./shared-websocket";

// ===== 类型定义 =====

/**
 * TurnDoc 连接配置（由 handlers 在 MainDoc 连接后注入）
 */
export interface TurnDocConfig {
  /** 房间 ID */
  roomId: string;
  /** JWT Token（复用 MainDoc 的 Token） */
  token: string;
  /** WebSocket URL */
  wsUrl: string;
}

/**
 * TurnDoc 状态变化事件
 */
export interface TurnDocStatusEvent {
  roomId: string;
  turnNumber: number;
  status: ConnectionStatus;
}

/**
 * TurnDoc 事件监听器
 */
export type TurnDocStatusListener = (event: TurnDocStatusEvent) => void;

/**
 * 单个 TurnDoc 连接实例
 */
interface TurnDocConnection {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  status: ConnectionStatus;
  turnNumber: number;
}

// ===== TurnDocProvider 类 =====

/**
 * TurnDoc 网络同步管理器
 *
 * 单例模式，管理所有 TurnDoc 的 HocuspocusProvider 连接
 */
export class TurnDocProvider {
  /** 活跃的连接（key: `${roomId}:${turnNumber}`） */
  private connections: Map<string, TurnDocConnection> = new Map();

  /** 当前配置缓存（由 handlers 注入） */
  private currentConfig: TurnDocConfig | null = null;

  /** 状态变化监听器 */
  private listeners: Set<TurnDocStatusListener> = new Set();

  /**
   * 设置连接配置
   *
   * ⚠️ 由 handlers 在 MainDoc 连接成功后调用
   * 配置从 multiplayerProvider.getConfig() 获取
   */
  setConfig(config: TurnDocConfig): void {
    this.currentConfig = config;
  }

  /**
   * 清除配置
   */
  clearConfig(): void {
    this.currentConfig = null;
  }

  /**
   * 获取当前配置
   */
  getConfig(): TurnDocConfig | null {
    return this.currentConfig;
  }

  /**
   * 连接指定回合的 TurnDoc
   *
   * ⚠️ 由 handlers 调用（startGameHandler, joinRoomHandler 等）
   *
   * @param roomId 房间 ID
   * @param turnNumber 回合号
   * @param doc Yjs 文档实例（已由 subdocManager 创建）
   */
  async connect(roomId: string, turnNumber: number, doc: Y.Doc): Promise<void> {
    const key = this.getKey(roomId, turnNumber);

    // 检查是否已连接
    if (this.connections.has(key)) {
      return;
    }

    // 验证配置
    if (!this.currentConfig) {
      throw new Error(
        "[TurnDocProvider] Config not set. Call setConfig() first.",
      );
    }

    // 验证 roomId 匹配
    if (this.currentConfig.roomId !== roomId) {
      throw new Error(
        `[TurnDocProvider] Room ID mismatch: config has ${this.currentConfig.roomId}, but connecting to ${roomId}`,
      );
    }

    // 获取共享 WebSocket（应该已由 MultiplayerProvider 创建）
    const websocketProvider = sharedWebSocket.get();

    if (!websocketProvider) {
      throw new Error(
        "[TurnDocProvider] SharedWebSocket not connected. MainDoc should connect first.",
      );
    }

    const { token } = this.currentConfig;
    const documentName = `room:${roomId}:turn:${turnNumber}`;

    // 创建连接实例占位（用于状态跟踪）
    const connection: TurnDocConnection = {
      provider: null as unknown as HocuspocusProvider,
      doc,
      status: "connecting",
      turnNumber,
    };
    this.connections.set(key, connection);

    let provider: HocuspocusProvider | null = null;

    try {
      provider = new HocuspocusProvider({
        websocketProvider, // 使用共享 WebSocket（Multiplexing）
        name: documentName,
        document: doc,
        token,

        onConnect: () => {
          const conn = this.connections.get(key);
          if (conn) {
            conn.status = "connected";
            this.emitStatusChange(roomId, turnNumber, "connected");
          }
        },

        onSynced: ({ state }) => {
          if (state) {
            const conn = this.connections.get(key);
            if (conn) {
              conn.status = "synced";
              this.emitStatusChange(roomId, turnNumber, "synced");
            }
          }
        },

        onDisconnect: () => {
          const conn = this.connections.get(key);
          if (conn) {
            conn.status = "disconnected";
            this.emitStatusChange(roomId, turnNumber, "disconnected");
          }
        },

        onStatus: ({ status }) => {
          const conn = this.connections.get(key);
          if (conn && status === "connecting") {
            conn.status = "reconnecting";
            this.emitStatusChange(roomId, turnNumber, "reconnecting");
          }
        },
      });

      // ⚠️ 关键：当使用共享 WebSocket 时，需要手动调用 attach()
      // 因为 manageSocket 为 false，HocuspocusProvider 不会自动调用 attach()
      // attach() 负责将 Provider 注册到 WebSocket 的 providerMap 中
      provider.attach();

      // 更新连接实例
      connection.provider = provider;
    } catch (error) {
      // 连接失败，清理
      if (provider) {
        provider.destroy();
      }
      this.connections.delete(key);
      connection.status = "error";
      this.emitStatusChange(roomId, turnNumber, "error");
      // 对称释放 sharedWebSocket.get() 的引用，避免失败分支泄漏
      sharedWebSocket.release();
      throw error;
    }
  }

  /**
   * 断开指定回合的 TurnDoc
   *
   * ⚠️ 由 handlers 调用（completeTurnHandler, startTurnHandler 等）
   */
  disconnect(roomId: string, turnNumber: number): void {
    const key = this.getKey(roomId, turnNumber);
    const conn = this.connections.get(key);

    if (conn) {
      conn.provider.destroy();
      this.connections.delete(key);
      // 释放共享 WebSocket 引用
      sharedWebSocket.release();
    }
  }

  /**
   * 断开指定房间的所有 TurnDoc 连接
   */
  disconnectRoom(roomId: string): void {
    const prefix = `${roomId}:`;
    const keysToDelete: string[] = [];

    this.connections.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      const conn = this.connections.get(key);
      if (conn) {
        conn.provider.destroy();
        this.connections.delete(key);
        // 释放共享 WebSocket 引用
        sharedWebSocket.release();
      }
    });
  }

  /**
   * 断开所有 TurnDoc 连接
   *
   * ⚠️ 由 handlers 调用（leaveRoomHandler）
   */
  disconnectAll(): void {
    this.connections.forEach((conn) => {
      conn.provider.destroy();
      // 释放共享 WebSocket 引用
      sharedWebSocket.release();
    });

    this.connections.clear();
    this.currentConfig = null;
  }

  /**
   * 获取指定回合的连接状态
   */
  getStatus(roomId: string, turnNumber: number): ConnectionStatus {
    const key = this.getKey(roomId, turnNumber);
    return this.connections.get(key)?.status ?? "disconnected";
  }

  /**
   * 检查指定回合是否已同步
   */
  isSynced(roomId: string, turnNumber: number): boolean {
    return this.getStatus(roomId, turnNumber) === "synced";
  }

  /**
   * 检查指定回合是否已连接（包括同步中和已同步）
   */
  isConnected(roomId: string, turnNumber: number): boolean {
    const status = this.getStatus(roomId, turnNumber);
    return status === "connected" || status === "synced";
  }

  /**
   * 等待指定回合同步完成
   *
   * @param roomId 房间 ID
   * @param turnNumber 回合号
   * @param timeout 超时时间（毫秒），默认 10 秒
   */
  async waitForSync(
    roomId: string,
    turnNumber: number,
    timeout = 10000,
  ): Promise<void> {
    const key = this.getKey(roomId, turnNumber);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkSync = () => {
        const conn = this.connections.get(key);

        if (!conn) {
          reject(new Error(`[TurnDocProvider] Connection not found: ${key}`));
          return;
        }

        if (conn.status === "synced") {
          resolve();
          return;
        }

        if (conn.status === "error") {
          reject(new Error(`[TurnDocProvider] Connection error: ${key}`));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`[TurnDocProvider] Sync timeout: ${key}`));
          return;
        }

        setTimeout(checkSync, 100);
      };

      checkSync();
    });
  }

  /**
   * 获取指定房间所有活跃的 TurnDoc 连接数量
   */
  getActiveConnectionCount(roomId?: string): number {
    if (!roomId) {
      return this.connections.size;
    }

    const prefix = `${roomId}:`;
    let count = 0;
    this.connections.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        count++;
      }
    });
    return count;
  }

  /**
   * 获取指定房间所有活跃的回合号列表
   */
  getActiveTurnNumbers(roomId: string): number[] {
    const prefix = `${roomId}:`;
    const turnNumbers: number[] = [];

    this.connections.forEach((conn, key) => {
      if (key.startsWith(prefix)) {
        turnNumbers.push(conn.turnNumber);
      }
    });

    return turnNumbers.sort((a, b) => a - b);
  }

  // ===== 事件订阅 =====

  /**
   * 订阅 TurnDoc 状态变化
   *
   * @param listener 监听回调
   * @returns 取消订阅函数
   */
  subscribe(listener: TurnDocStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取快照字符串（用于 useSyncExternalStore）
   *
   * 返回所有连接状态的序列化字符串
   */
  getSnapshot(): string {
    const snapshot: Record<string, ConnectionStatus> = {};
    this.connections.forEach((conn, key) => {
      snapshot[key] = conn.status;
    });
    return JSON.stringify(snapshot);
  }

  // ===== 私有方法 =====

  /**
   * 生成连接键
   */
  private getKey(roomId: string, turnNumber: number): string {
    return `${roomId}:${turnNumber}`;
  }

  /**
   * 触发状态变化事件
   */
  private emitStatusChange(
    roomId: string,
    turnNumber: number,
    status: ConnectionStatus,
  ): void {
    const event: TurnDocStatusEvent = { roomId, turnNumber, status };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[TurnDocProvider] Listener error:", error);
      }
    });
  }
}

// 单例导出
export const turnDocProvider = new TurnDocProvider();
