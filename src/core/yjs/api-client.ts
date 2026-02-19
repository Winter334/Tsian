/**
 * Hocuspocus Server API 客户端
 *
 * 封装与后端 HTTP API 的通信
 *
 * ⚠️ 架构说明：
 * - 这是 core/ 层的基础设施，不应该直接依赖 config/
 * - 配置通过 setBaseUrl() 方法注入，由应用初始化时调用
 */

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ===== 请求/响应类型 =====

/**
 * 房间注册请求
 */
export interface RegisterRoomRequest {
  roomId: string;
  code: string;
  hostUserId: string;
  hostDisplayName?: string;
  name?: string;
  maxPlayers?: number;
}

/**
 * 房间注册响应
 */
export interface RegisterRoomResponse {
  success: boolean;
  roomId: string;
  code: string;
}

/**
 * 加入房间响应
 */
export interface JoinRoomResponse {
  success: boolean;
  roomId: string;
  wsUrl: string;
}

/**
 * 查询房间响应（用于预览）
 */
export interface QueryRoomResponse {
  success: boolean;
  roomId: string;
  name?: string;
  hostDisplayName?: string;
  memberCount?: number;
  maxPlayers?: number;
}

/**
 * 添加成员请求
 */
export interface AddMemberRequest {
  roomId: string;
  userId: string;
  displayName?: string;
}

/**
 * 移除成员请求
 */
export interface RemoveMemberRequest {
  roomId: string;
  userId: string;
}

/**
 * Token 请求
 */
export interface GetTokenRequest {
  userId: string;
  roomId: string;
  role: "host" | "guest";
}

/**
 * Token 响应
 */
export interface TokenResponse {
  token: string;
  expiresAt: number;
}

/**
 * 房间信息
 */
export interface RoomInfo {
  roomId: string;
  hostUserId: string;
  memberCount: number;
  createdAt: number;
}

/**
 * API 客户端类
 */
export class ApiClient {
  private baseUrl: string = "";

  /**
   * 设置 API 基础 URL
   *
   * 应在应用初始化时调用，注入配置
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * 获取当前 baseUrl
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 发送请求的通用方法
   */
  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // 网络错误
      throw new ApiError(
        error instanceof Error ? error.message : "Network error",
        0,
        "NETWORK_ERROR"
      );
    }
  }

  /**
   * 注册房间
   *
   * 在服务器上注册新房间，建立房间码映射
   */
  async registerRoom(
    request: RegisterRoomRequest
  ): Promise<RegisterRoomResponse> {
    return this.request<RegisterRoomResponse>(
      "POST",
      "/room/register",
      request
    );
  }

  /**
   * 查询房间（通过房间码）
   *
   * 返回房间 ID 和 WebSocket URL
   */
  async queryRoom(code: string): Promise<JoinRoomResponse> {
    return this.request<JoinRoomResponse>(
      "GET",
      `/room/join?code=${encodeURIComponent(code)}`
    );
  }

  /**
   * 查询房间详情（用于加入前预览）
   *
   * 返回房间名称、房主、成员数等信息
   */
  async queryRoomDetails(code: string): Promise<QueryRoomResponse> {
    return this.request<QueryRoomResponse>(
      "GET",
      `/room/query?code=${encodeURIComponent(code)}`
    );
  }

  /**
   * 添加成员
   *
   * 将用户添加到房间成员列表
   */
  async addMember(request: AddMemberRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      "POST",
      "/room/add-member",
      request
    );
  }

  /**
   * 移除成员
   *
   * 将用户从房间成员列表移除
   */
  async removeMember(
    request: RemoveMemberRequest
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      "POST",
      "/room/remove-member",
      request
    );
  }

  /**
   * 获取 Token
   *
   * 获取用于 WebSocket 连接的 JWT Token
   */
  async getToken(request: GetTokenRequest): Promise<TokenResponse> {
    return this.request<TokenResponse>("POST", "/room/get-token", request);
  }

  /**
   * 获取房间信息
   */
  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    const response = await this.request<{ success: boolean; room: RoomInfo }>(
      "GET",
      `/room/${encodeURIComponent(roomId)}`
    );

    return response.room;
  }

  /**
   * 删除房间（仅房主可调用）
   *
   * 从服务器删除房间数据
   */
  async deleteRoom(
    roomId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      "DELETE",
      `/room/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(userId)}`
    );
  }

  /**
   * 健康检查
   *
   * 检查服务器是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl.replace("/api", "")}/health`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 单例导出
export const apiClient = new ApiClient();
