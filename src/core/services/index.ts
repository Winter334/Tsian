/**
 * 服务注册器 - 模块间服务共享
 *
 * 用途：
 * - 模块可以注册服务供其他模块使用
 * - 避免模块间直接 import
 * - 支持服务的动态注册/注销
 */

/**
 * 服务令牌（用于类型安全的服务获取）
 */
export type ServiceToken<T> = symbol & { __type?: T };

/**
 * 创建服务令牌
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return Symbol(name) as ServiceToken<T>;
}

/**
 * 服务注册表配置
 */
interface ServiceRegistryConfig {
  /** 是否在开发模式下打印日志 */
  debug: boolean;
}

/**
 * 服务注册表实现
 */
class ServiceRegistryImpl {
  private services = new Map<symbol, unknown>();
  private config: ServiceRegistryConfig = {
    debug: import.meta.env.DEV,
  };

  /**
   * 配置服务注册表
   */
  configure(config: Partial<ServiceRegistryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 注册服务
   */
  register<T>(token: ServiceToken<T>, service: T): void {
    if (this.services.has(token)) {
      console.warn(
        `[Services] Overwriting service: ${String(token.description)}`
      );
    }

    this.services.set(token, service);

    if (this.config.debug) {
      console.debug(`[Services] Registered: ${String(token.description)}`);
    }
  }

  /**
   * 获取服务
   */
  get<T>(token: ServiceToken<T>): T | undefined {
    return this.services.get(token) as T | undefined;
  }

  /**
   * 获取服务（必须存在，否则抛错）
   */
  getRequired<T>(token: ServiceToken<T>): T {
    const service = this.get(token);
    if (service === undefined) {
      throw new Error(
        `[Services] Required service not found: ${String(token.description)}`
      );
    }
    return service;
  }

  /**
   * 检查服务是否存在
   */
  has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token);
  }

  /**
   * 注销服务
   */
  unregister<T>(token: ServiceToken<T>): boolean {
    const existed = this.services.delete(token);

    if (existed && this.config.debug) {
      console.debug(`[Services] Unregistered: ${String(token.description)}`);
    }

    return existed;
  }

  /**
   * 获取所有已注册的服务令牌
   */
  getRegisteredTokens(): symbol[] {
    return Array.from(this.services.keys());
  }

  /**
   * 清空所有服务（测试用）
   */
  clear(): void {
    this.services.clear();
  }
}

// 导出单例
export const services = new ServiceRegistryImpl();
