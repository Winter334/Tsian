import {
  commandBus,
  type CommandContext,
  type CommandHandler,
} from "../command-bus";
import { eventBus, type EventHandler } from "../event-bus";

/**
 * 模块生命周期钩子（Phase 3 启用）
 */
export interface ModuleLifecycle {
  /** 模块加载时调用 */
  onLoad?: () => Promise<void>;
  /** 依赖就绪后调用 */
  onInit?: (context: ModuleContext) => Promise<void>;
  /** 模块可以开始工作时调用 */
  onStart?: () => Promise<void>;
  /** 模块准备卸载时调用 */
  onStop?: () => Promise<void>;
  /** 模块卸载后清理资源 */
  onUnload?: () => Promise<void>;
}

/**
 * 模块上下文（传递给生命周期钩子）
 */
export interface ModuleContext {
  /** 模块 ID */
  moduleId: string;
  /** 获取其他模块（通过依赖） */
  getModule: (id: string) => ModuleManifest | undefined;
  /** 事件总线 */
  eventBus: typeof eventBus;
  /** 命令总线 */
  commandBus: typeof commandBus;
}

/**
 * 模块清单 - 每个模块必须声明
 */
export interface ModuleManifest extends Partial<ModuleLifecycle> {
  /** 模块唯一标识 e.g. "lyra.chat" */
  id: string;
  /** 模块版本 */
  version?: string;
  /** 依赖的其他模块 ID */
  dependencies?: string[];
  /** 命令处理器 */
  commands?: Record<string, CommandHandler<unknown, unknown>>;
  /** 事件处理器 */
  eventHandlers?: Record<string, EventHandler<unknown>>;
  /** AI 工具定义（Phase 4 启用） */
  aiTools?: AIToolDefinition[];
  /** 模块提供的能力声明 */
  provides?: ModuleCapabilities;
  /** 模块需要的能力声明 */
  requires?: ModuleRequirements;
}

/**
 * AI 工具定义
 */
export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: unknown, context: CommandContext) => Promise<unknown>;
}

/**
 * 模块提供的能力
 */
export interface ModuleCapabilities {
  commands?: string[];
  events?: string[];
  entities?: string[];
}

/**
 * 模块需要的能力
 */
export interface ModuleRequirements {
  events?: string[];
  entities?: string[];
}

/**
 * 模块状态
 */
export type ModuleStatus =
  | "pending"
  | "loading"
  | "loaded"
  | "started"
  | "stopped"
  | "error";

/**
 * 已注册模块的状态
 */
interface RegisteredModule {
  manifest: ModuleManifest;
  status: ModuleStatus;
  unsubscribers: Array<() => void>;
  loadedAt?: number;
  error?: string;
}

/**
 * 模块注册表
 *
 * Phase 1: 基础注册/注销
 * Phase 3: 生命周期管理、依赖解析
 * Phase 6: 沙箱隔离、权限控制
 */
class ModuleRegistryImpl {
  private modules = new Map<string, RegisteredModule>();
  private loadOrder: string[] = [];

  /**
   * 注册模块
   */
  async register(manifest: ModuleManifest): Promise<void> {
    if (this.modules.has(manifest.id)) {
      console.warn(
        `[Registry] Module ${manifest.id} already registered, replacing...`
      );
      await this.unregister(manifest.id);
    }

    const registeredModule: RegisteredModule = {
      manifest,
      status: "pending",
      unsubscribers: [],
    };

    this.modules.set(manifest.id, registeredModule);

    try {
      // Phase 1: 简化版，直接注册不做依赖检查
      // Phase 3 将添加: 依赖解析、拓扑排序

      registeredModule.status = "loading";

      // 调用 onLoad 钩子（如果有）
      if (manifest.onLoad) {
        await manifest.onLoad();
      }

      // 注册命令处理器
      if (manifest.commands) {
        for (const [type, handler] of Object.entries(manifest.commands)) {
          commandBus.register(type, handler);
          registeredModule.unsubscribers.push(() =>
            commandBus.unregister(type)
          );
        }
      }

      // 注册事件处理器
      if (manifest.eventHandlers) {
        for (const [type, handler] of Object.entries(manifest.eventHandlers)) {
          const unsubscribe = eventBus.on(type, handler);
          registeredModule.unsubscribers.push(unsubscribe);
        }
      }

      // 调用 onInit 钩子（如果有）
      if (manifest.onInit) {
        const context: ModuleContext = {
          moduleId: manifest.id,
          getModule: (id) => this.getModule(id),
          eventBus,
          commandBus,
        };
        await manifest.onInit(context);
      }

      registeredModule.status = "loaded";
      registeredModule.loadedAt = Date.now();
      this.loadOrder.push(manifest.id);

      // 调用 onStart 钩子（如果有）
      if (manifest.onStart) {
        await manifest.onStart();
        registeredModule.status = "started";
      }

      // Module registered successfully
    } catch (error) {
      registeredModule.status = "error";
      registeredModule.error =
        error instanceof Error ? error.message : "Unknown error";
      throw error;
    }
  }

  /**
   * 注销模块
   */
  async unregister(id: string): Promise<boolean> {
    const module = this.modules.get(id);
    if (!module) {
      return false;
    }

    // Phase 3 将添加: 依赖检查，被依赖时禁止卸载

    try {
      // 调用 onStop 钩子
      if (module.manifest.onStop) {
        await module.manifest.onStop();
      }

      // 清理所有订阅
      module.unsubscribers.forEach((unsub) => unsub());

      // 调用 onUnload 钩子
      if (module.manifest.onUnload) {
        await module.manifest.onUnload();
      }

      this.modules.delete(id);
      this.loadOrder = this.loadOrder.filter((m) => m !== id);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取模块
   */
  getModule(id: string): ModuleManifest | undefined {
    return this.modules.get(id)?.manifest;
  }

  /**
   * 获取模块状态
   */
  getModuleStatus(id: string): ModuleStatus | undefined {
    return this.modules.get(id)?.status;
  }

  /**
   * 获取所有已注册模块
   */
  getAllModules(): ModuleManifest[] {
    return Array.from(this.modules.values()).map((m) => m.manifest);
  }

  /**
   * 获取模块加载顺序
   */
  getLoadOrder(): string[] {
    return [...this.loadOrder];
  }

  /**
   * 检查模块是否已注册
   */
  hasModule(id: string): boolean {
    return this.modules.has(id);
  }

  /**
   * 检查模块是否已启动
   */
  isModuleStarted(id: string): boolean {
    return this.modules.get(id)?.status === "started";
  }

  /**
   * 获取依赖此模块的其他模块
   */
  getDependents(id: string): string[] {
    const dependents: string[] = [];
    for (const [moduleId, module] of this.modules) {
      if (module.manifest.dependencies?.includes(id)) {
        dependents.push(moduleId);
      }
    }
    return dependents;
  }

  /**
   * 清除所有模块（测试用）
   */
  async clear(): Promise<void> {
    // 按加载顺序逆序卸载
    const reversed = [...this.loadOrder].reverse();
    for (const id of reversed) {
      await this.unregister(id);
    }
  }
}

// 导出单例
export const registry = new ModuleRegistryImpl();
