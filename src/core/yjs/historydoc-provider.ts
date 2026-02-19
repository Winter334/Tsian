/**
 * HistoryDoc 网络同步管理器
 *
 * 管理 HistoryDoc 的 HocuspocusProvider 连接
 * 与 MainDoc 的 Provider 共享同一 WebSocket（Multiplexing）
 *
 * ⚠️ 架构说明：
 * - 这是 core/ 层的基础设施，不应该直接依赖 config/ 或 modules/
 * - 配置通过 setConfig() 方法注入，由调用方（handlers）提供
 * - 只负责网络连接管理，不包含任何业务逻辑
 * - 使用 SharedWebSocketManager 实现连接复用
 */

import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { ConnectionStatus } from "./multiplayer-provider";
import { sharedWebSocket } from "./shared-websocket";

// ===== 类型定义 =====

/**
 * HistoryDoc 连接配置（由 handlers 在 MainDoc 连接后注入）
 */
export interface HistoryDocConfig {
  /** 房间 ID */
  roomId: string;
  /** JWT Token（复用 MainDoc 的 Token） */
  token: string;
  /** WebSocket URL */
  wsUrl: string;
}

/**
 * HistoryDoc 状态变化事件
 */
export interface HistoryDocStatusEvent {
  roomId: string;
  status: ConnectionStatus;
}

/**
 * HistoryDoc 事件监听器
 */
export type HistoryDocStatusListener = (event: HistoryDocStatusEvent) => void;

/**
 * 单个 HistoryDoc 连接实例
 */
interface HistoryDocConnection {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  status: ConnectionStatus;
}

// ===== HistoryDocProvider 类 =====

/**
 * HistoryDoc 网络同步管理器
 *
 * 单例模式，管理所有 HistoryDoc 的 HocuspocusProvider 连接
 */
export class HistoryDocProvider {
  /** 活跃的连接（key: roomId） */
  private connections: Map<string, HistoryDocConnection> = new Map();

  /** 当前配置缓存（由 handlers 注入） */
  private currentConfig: HistoryDocConfig | null = null;

  /** 状态变化监听器 */
  private listeners: Set<HistoryDocStatusListener> = new Set();

  /**
   * 设置连接配置
   *
   * ⚠️ 由 handlers 在 MainDoc 连接成功后调用
   * 配置从 multiplayerProvider.getConfig() 获取
   */
  setConfig(config: HistoryDocConfig): void {
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
  getConfig(): HistoryDocConfig | null {
    return this.currentConfig;
  }

  /**
   * 连接指定房间的 HistoryDoc
   *
   * ⚠️ 由 handlers 调用（createRoomHandler, joinRoomHandler 等）
   */
  async connect(roomId: string, doc: Y.Doc): Promise<void> {
    // 检查是否已连接
    if (this.connections.has(roomId)) {
      return;
    }

    // 验证配置
    if (!this.currentConfig) {
      throw new Error(
        "[HistoryDocProvider] Config not set. Call setConfig() first."
      );
    }

    // 验证 roomId 匹配
    if (this.currentConfig.roomId !== roomId) {
      throw new Error(
        `[HistoryDocProvider] Room ID mismatch: config has ${this.currentConfig.roomId}, but connecting to ${roomId}`
      );
    }

    // 获取共享 WebSocket（应该已由 MultiplayerProvider 创建）
    const websocketProvider = sharedWebSocket.get();

    if (!websocketProvider) {
      throw new Error(
        "[HistoryDocProvider] SharedWebSocket not connected. MainDoc should connect first."
      );
    }

    const { token } = this.currentConfig;
    const documentName = `room:${roomId}:history`;

    // 创建连接实例占位（用于状态跟踪）
    const connection: HistoryDocConnection = {
      provider: null as unknown as HocuspocusProvider,
      doc,
      status: "connecting",
    };
    this.connections.set(roomId, connection);

    try {
      const provider = new HocuspocusProvider({
        websocketProvider,
        name: documentName,
        document: doc,
        token,

        onConnect: () => {
          const conn = this.connections.get(roomId);
          if (conn) {
            conn.status = "connected";
            this.emitStatusChange(roomId, "connected");
          }
        },

        onSynced: ({ state }) => {
          if (state) {
            const conn = this.connections.get(roomId);
            if (conn) {
              conn.status = "synced";
              this.emitStatusChange(roomId, "synced");
            }
          }
        },

        onDisconnect: () => {
          const conn = this.connections.get(roomId);
          if (conn) {
            conn.status = "disconnected";
            this.emitStatusChange(roomId, "disconnected");
          }
        },

        onStatus: ({ status }) => {
          const conn = this.connections.get(roomId);
          if (conn && status === "connecting") {
            conn.status = "reconnecting";
            this.emitStatusChange(roomId, "reconnecting");
          }
        },
      });

      // ⚠️ 关键：当使用共享 WebSocket 时，需要手动调用 attach()
      provider.attach();

      // 更新连接实例
      connection.provider = provider;
    } catch (error) {
      // 连接失败，清理
      this.connections.delete(roomId);
      connection.status = "error";
      throw error;
    }
  }

  /**
   * 断开指定房间的 HistoryDoc
   */
  disconnect(roomId: string): void {
    const conn = this.connections.get(roomId);

    if (conn) {
      conn.provider.destroy();
      this.connections.delete(roomId);
      // 释放共享 WebSocket 引用
      sharedWebSocket.release();
    }

    if (this.currentConfig?.roomId === roomId) {
      this.currentConfig = null;
    }
  }

  /**
   * 断开所有 HistoryDoc 连接
   *
   * ⚠️ 由 handlers 调用（leaveRoomHandler）
   */
  disconnectAll(): void {
    this.connections.forEach((conn, roomId) => {
      conn.provider.destroy();
      this.connections.delete(roomId);
      sharedWebSocket.release();
    });

    this.currentConfig = null;
  }

  /**
   * 获取指定房间的连接状态
   */
  getStatus(roomId: string): ConnectionStatus {
    return this.connections.get(roomId)?.status ?? "disconnected";
  }

  /**
   * 检查指定房间是否已同步
   */
  isSynced(roomId: string): boolean {
    return this.getStatus(roomId) === "synced";
  }

  /**
   * 等待指定房间同步完成
   *
   * @param roomId 房间 ID
   * @param timeout 超时时间（毫秒），默认 10 秒
   */
  async waitForSync(roomId: string, timeout = 10000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkSync = () => {
        const conn = this.connections.get(roomId);

        if (!conn) {
          reject(
            new Error(`[HistoryDocProvider] Connection not found: ${roomId}`)
          );
          return;
        }

        if (conn.status === "synced") {
          resolve();
          return;
        }

        if (conn.status === "error") {
          reject(new Error(`[HistoryDocProvider] Connection error: ${roomId}`));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`[HistoryDocProvider] Sync timeout: ${roomId}`));
          return;
        }

        setTimeout(checkSync, 100);
      };

      checkSync();
    });
  }

  // ===== 事件订阅 =====

  /**
   * 订阅 HistoryDoc 状态变化
   *
   * @param listener 监听回调
   * @returns 取消订阅函数
   */
  subscribe(listener: HistoryDocStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ===== 私有方法 =====

  /**
   * 触发状态变化事件
   */
  private emitStatusChange(roomId: string, status: ConnectionStatus): void {
    const event: HistoryDocStatusEvent = { roomId, status };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[HistoryDocProvider] Listener error:", error);
      }
    });
  }
}

// 单例导出
export const historyDocProvider = new HistoryDocProvider();
