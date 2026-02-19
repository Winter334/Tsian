/**
 * 共享 WebSocket 连接管理器
 *
 * 使用 Hocuspocus Multiplexing 特性，
 * 允许多个 Provider（MainDoc、TurnDoc）复用同一个 WebSocket 连接
 *
 * ⚠️ 架构说明：
 * - 这是 core/ 层的基础设施，不应该直接依赖 config/ 或 modules/
 * - 由 MultiplayerProvider 首先调用 getOrCreate() 创建连接
 * - TurnDocProvider 通过 get() 获取已创建的连接
 * - 离开房间时由 handlers 调用 disconnect() 清理
 */

import { HocuspocusProviderWebsocket } from "@hocuspocus/provider";

/**
 * 共享 WebSocket 连接管理器
 *
 * 单例模式，管理与 Hocuspocus 服务器的 WebSocket 连接
 * 支持多个 Provider 复用同一连接（Multiplexing）
 */
export class SharedWebSocketManager {
  /** 当前 WebSocket 连接 */
  private socket: HocuspocusProviderWebsocket | null = null;

  /** 当前连接的 URL */
  private wsUrl: string | null = null;

  /** 连接引用计数（用于判断何时可以安全断开） */
  private refCount = 0;

  /**
   * 获取或创建共享 WebSocket 连接
   *
   * 如果已存在相同 URL 的连接，直接返回
   * 如果 URL 变化，先断开旧连接再创建新连接
   *
   * @param wsUrl WebSocket 服务器 URL
   * @returns HocuspocusProviderWebsocket 实例
   */
  getOrCreate(wsUrl: string): HocuspocusProviderWebsocket {
    // 如果已存在相同 URL 的连接，增加引用计数并返回
    if (this.socket && this.wsUrl === wsUrl) {
      this.refCount++;
      return this.socket;
    }

    // 保存旧连接引用，先尝试创建新连接
    const oldSocket = this.socket;
    const oldUrl = this.wsUrl;
    const oldRefCount = this.refCount;

    try {
      // 创建新连接（在销毁旧连接之前，确保新连接能成功创建）
      const newSocket = new HocuspocusProviderWebsocket({ url: wsUrl });

      // 新连接创建成功，销毁旧连接
      if (oldSocket) {
        oldSocket.destroy();
      }

      this.socket = newSocket;
      this.wsUrl = wsUrl;
      this.refCount = 1;

      return this.socket;
    } catch (error) {
      // 新连接创建失败，恢复到一致状态
      // 如果旧连接已经存在，保留它不变
      if (oldSocket) {
        this.socket = oldSocket;
        this.wsUrl = oldUrl;
        this.refCount = oldRefCount;
        console.warn("[SharedWebSocket] 创建新连接失败，保留旧连接", error);
      } else {
        // 没有旧连接，确保状态干净
        this.socket = null;
        this.wsUrl = null;
        this.refCount = 0;
        console.warn("[SharedWebSocket] 创建连接失败，状态已重置", error);
      }
      throw error;
    }
  }

  /**
   * 获取当前 WebSocket 连接并增加引用计数
   *
   * ⚠️ 如果连接不存在，返回 null（不会增加引用计数）
   * TurnDocProvider 应该在 MainDoc 连接后调用此方法
   *
   * **所有权语义**：调用方获取非 null 返回值后，拥有一个引用计数。
   * 必须在不再需要连接时配对调用 `release()` 释放引用，
   * 否则会导致引用计数泄漏，连接无法被自动回收。
   *
   * @returns 当前 WebSocket 连接，或 null
   */
  get(): HocuspocusProviderWebsocket | null {
    if (this.socket) {
      this.refCount++;
    }
    return this.socket;
  }

  /**
   * 释放连接引用
   *
   * 减少引用计数，当计数归零时自动断开连接
   * 这确保离开房间后不会残留无效的 WebSocket 连接
   */
  release(): void {
    this.refCount--;

    if (this.refCount < 0) {
      console.warn(
        `[SharedWebSocket] refCount 变为负数 (${this.refCount})，可能存在多余的 release() 调用，已归零`
      );
      this.refCount = 0;
      return;
    }

    // 当引用计数归零时，自动断开连接
    // 这修复了离开房间后重新创建房间时复用已断开连接的问题
    if (this.refCount === 0) {
      this.forceDisconnect();
    }
  }

  /**
   * 断开连接
   *
   * ⚠️ 只有当引用计数为 0 时才会真正断开
   * 注意：release() 方法现在会在引用计数归零时自动断开，
   * 所以这个方法主要用于显式清理场景
   */
  disconnect(): void {
    if (this.refCount > 0) {
      return;
    }

    this.forceDisconnect();
  }

  /**
   * 强制断开连接
   *
   * ⚠️ 无视引用计数，立即断开
   * 用于离开房间时的清理
   */
  forceDisconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.wsUrl = null;
      this.refCount = 0;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.socket !== null;
  }

  /**
   * 获取当前连接的 URL
   */
  getUrl(): string | null {
    return this.wsUrl;
  }

  /**
   * 获取当前引用计数
   */
  getRefCount(): number {
    return this.refCount;
  }
}

/**
 * 全局单例
 */
export const sharedWebSocket = new SharedWebSocketManager();
