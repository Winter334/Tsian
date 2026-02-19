/**
 * 联机连接管理器
 *
 * 封装 HocuspocusProvider，管理与服务器的 WebSocket 连接
 * 负责 Token 管理、连接状态、自动重连等
 *
 * ⚠️ 架构说明：
 * - 这是 core/ 层的基础设施，不应该直接依赖 config/
 * - WebSocket URL 通过 connect() 方法的配置参数传入
 * - Token 刷新通过回调函数实现，由调用方提供
 * - 使用 SharedWebSocketManager 实现 Multiplexing（多文档复用同一连接）
 */

import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { sharedWebSocket } from "./shared-websocket";

// ===== 类型定义 =====

/**
 * 连接状态
 */
export type ConnectionStatus =
  | "disconnected" // 未连接
  | "connecting" // 连接中
  | "connected" // 已连接（WebSocket 打开）
  | "synced" // 已同步（数据同步完成）
  | "reconnecting" // 重连中
  | "error"; // 错误

/**
 * 连接配置
 */
export interface ConnectionConfig {
  /** 房间 ID */
  roomId: string;
  /** 用户 ID */
  userId: string;
  /** 显示名称 */
  displayName: string;
  /** 角色 */
  role: "host" | "guest";
  /** JWT Token */
  token: string;
  /** Token 过期时间 */
  tokenExpiresAt: number;
  /** WebSocket URL */
  wsUrl: string;
  /** Token 刷新回调（由调用方提供） */
  onTokenRefresh?: () => Promise<{ token: string; expiresAt: number }>;
}

/**
 * 连接事件处理器
 */
export interface ConnectionEventHandlers {
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onAwarenessChange?: (states: Map<number, unknown>) => void;
}

/**
 * Awareness 用户状态
 */
export interface AwarenessUserState {
  id: string;
  name: string;
  status: "online" | "away" | "offline";
  lastActive: number;
}

// ===== MultiplayerProvider 类 =====

/**
 * 联机连接管理器
 *
 * 单例模式，管理与 Hocuspocus 服务器的连接
 */
export class MultiplayerProvider {
  private provider: HocuspocusProvider | null = null;
  private doc: Y.Doc | null = null;
  private config: ConnectionConfig | null = null;
  private status: ConnectionStatus = "disconnected";
  private eventHandlers: ConnectionEventHandlers = {};

  // Token 管理
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  // 重连配置
  private readonly maxReconnectAttempts = 10;
  private reconnectAttempts = 0;

  /**
   * 连接到房间
   *
   * @param config 连接配置
   * @param doc 要同步的 Yjs 文档
   */
  async connect(config: ConnectionConfig, doc: Y.Doc): Promise<void> {
    // 如果已连接，先断开
    if (this.provider) {
      this.disconnect();
    }

    this.config = config;
    this.doc = doc;
    this.reconnectAttempts = 0;

    this.setStatus("connecting");

    try {
      // 使用共享 WebSocket 连接（Multiplexing）
      const websocketProvider = sharedWebSocket.getOrCreate(config.wsUrl);

      this.provider = new HocuspocusProvider({
        websocketProvider, // 使用共享 WebSocket
        name: `room:${config.roomId}:main`,
        document: doc,
        token: config.token,

        // 连接事件
        onConnect: () => {
          this.reconnectAttempts = 0;
          this.setStatus("connected");
        },

        onSynced: ({ state }) => {
          if (state) {
            this.setStatus("synced");
            this.eventHandlers.onSynced?.();
          }
        },

        onDisconnect: ({ event }) => {
          const reason =
            event instanceof CloseEvent ? `Code: ${event.code}` : "Unknown";
          this.handleDisconnect(reason);
        },

        onClose: () => {
          // Connection closed
        },

        onStatus: ({ status }) => {
          if (status === "connecting") {
            this.setStatus("reconnecting");
          }
        },

        // Awareness 配置
        onAwarenessChange: ({ states }) => {
          // 转换为 Map 格式
          const statesMap = new Map<number, unknown>();
          for (const state of states) {
            statesMap.set(state.clientId, state);
          }
          this.eventHandlers.onAwarenessChange?.(statesMap);
        },
      });

      // ⚠️ 关键：当使用共享 WebSocket 时，需要手动调用 attach()
      // 因为 manageSocket 为 false，HocuspocusProvider 不会自动调用 attach()
      // attach() 负责将 Provider 注册到 WebSocket 的 providerMap 中
      this.provider.attach();

      // 设置本地 Awareness 状态
      this.setLocalAwarenessState({
        id: config.userId,
        name: config.displayName,
        status: "online",
        lastActive: Date.now(),
      });

      // 设置 Token 自动刷新
      this.scheduleTokenRefresh();
    } catch (error) {
      this.setStatus("error");
      this.eventHandlers.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 断开连接
   *
   * ⚠️ 注意：不会断开共享 WebSocket，由 sharedWebSocket.forceDisconnect() 负责
   */
  disconnect(): void {
    // 清除 Token 刷新定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // 断开 Provider（不断开共享 WebSocket）
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
      // 释放共享 WebSocket 引用
      sharedWebSocket.release();
    }

    this.doc = null;
    this.config = null;
    this.setStatus("disconnected");
  }

  /**
   * 等待 MainDoc 同步完成
   *
   * 用于替代硬编码的等待时间，确保数据同步后再进行后续操作
   *
   * @param timeout 超时时间（毫秒），默认 10 秒
   * @throws 超时或连接错误时抛出异常
   */
  async waitForSync(timeout = 10000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        // 已同步
        if (this.status === "synced") {
          resolve();
          return;
        }

        // 连接错误
        if (this.status === "error") {
          reject(new Error("[MultiplayerProvider] Connection error"));
          return;
        }

        // 超时
        if (Date.now() - startTime > timeout) {
          reject(new Error("[MultiplayerProvider] Sync timeout"));
          return;
        }

        // 继续检查
        setTimeout(check, 100);
      };

      check();
    });
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 获取当前配置
   */
  getConfig(): ConnectionConfig | null {
    return this.config;
  }

  /**
   * 获取 Awareness 实例
   */
  getAwareness(): Awareness | null {
    return this.provider?.awareness ?? null;
  }

  /**
   * 设置本地 Awareness 状态
   */
  setLocalAwarenessState(state: AwarenessUserState): void {
    const awareness = this.getAwareness();
    if (awareness) {
      awareness.setLocalStateField("user", state);
    }
  }

  /**
   * 更新本地用户状态
   */
  updateLocalStatus(status: "online" | "away" | "offline"): void {
    if (!this.config) return;

    this.setLocalAwarenessState({
      id: this.config.userId,
      name: this.config.displayName,
      status,
      lastActive: Date.now(),
    });
  }

  /**
   * 注册事件处理器
   */
  on<K extends keyof ConnectionEventHandlers>(
    event: K,
    handler: ConnectionEventHandlers[K]
  ): () => void {
    this.eventHandlers[event] = handler;

    // 返回取消注册函数
    return () => {
      delete this.eventHandlers[event];
    };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === "connected" || this.status === "synced";
  }

  /**
   * 检查是否已同步
   */
  isSynced(): boolean {
    return this.status === "synced";
  }

  // ===== 私有方法 =====

  /**
   * 设置状态并触发事件
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.eventHandlers.onStatusChange?.(status);
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(reason: string): void {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("error");
      this.eventHandlers.onError?.(new Error("Max reconnect attempts reached"));
    } else {
      this.setStatus("reconnecting");
    }

    this.eventHandlers.onDisconnect?.(reason);
  }

  /**
   * 设置 Token 自动刷新
   *
   * 在 Token 过期前 1 小时刷新
   */
  private scheduleTokenRefresh(): void {
    if (!this.config) return;

    // 清除之前的定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // 计算刷新时间（过期前 1 小时）
    const refreshTime =
      this.config.tokenExpiresAt - Date.now() - 60 * 60 * 1000;

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    } else {
      // Token 即将过期或已过期，立即刷新
      this.refreshToken();
    }
  }

  /**
   * 刷新 Token
   *
   * 通过配置中的回调函数刷新 Token，避免直接依赖 apiClient
   */
  private async refreshToken(): Promise<void> {
    if (!this.config || !this.config.onTokenRefresh) {
      return;
    }

    try {
      const response = await this.config.onTokenRefresh();

      // 更新配置
      this.config.token = response.token;
      this.config.tokenExpiresAt = response.expiresAt;

      // 更新 Provider 的 token
      if (this.provider) {
        // HocuspocusProvider 不直接支持更新 token
        // 需要重新连接

        // 保存当前文档引用
        const doc = this.doc;
        const config = { ...this.config };

        // 断开并重连
        this.disconnect();
        if (doc) {
          await this.connect(config, doc);
        }
      }

      // 设置下次刷新
      this.scheduleTokenRefresh();
    } catch (error) {
      this.eventHandlers.onError?.(
        error instanceof Error ? error : new Error("Token refresh failed")
      );
    }
  }
}

// 单例导出
export const multiplayerProvider = new MultiplayerProvider();
