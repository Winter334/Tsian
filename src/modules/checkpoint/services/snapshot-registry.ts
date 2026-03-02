import type { SnapshotFieldConfig } from "./snapshot-config";

/**
 * 模块快照注册信息
 */
interface RegisteredSnapshotProvider {
  /** 模块 ID（用于追踪和调试） */
  moduleId: string;
  /** 该模块的快照字段声明 */
  fields: SnapshotFieldConfig[];
  /** 注册时间 */
  registeredAt: number;
}

/**
 * 快照注册表
 *
 * 管理各模块的快照字段声明。
 * 检查点系统通过此注册表动态获取所有需要快照/恢复的字段。
 */
class SnapshotRegistryImpl {
  private providers = new Map<string, RegisteredSnapshotProvider>();

  /**
   * 注册模块的快照字段
   *
   * @param moduleId 模块 ID（如 "lyra.chat"）
   * @param fields 该模块的快照字段配置
   */
  register(moduleId: string, fields: SnapshotFieldConfig[]): void {
    if (this.providers.has(moduleId)) {
      console.warn(
        `[SnapshotRegistry] Module ${moduleId} already registered, replacing...`,
      );
    }

    // 检查 key 冲突
    for (const field of fields) {
      const conflict = this.findKeyOwner(field.key);
      if (conflict && conflict !== moduleId) {
        throw new Error(
          `[SnapshotRegistry] Key "${field.key}" conflict: ` +
            `already registered by "${conflict}", ` +
            `now claimed by "${moduleId}"`,
        );
      }
    }

    this.providers.set(moduleId, {
      moduleId,
      fields,
      registeredAt: Date.now(),
    });
  }

  /**
   * 注销模块的快照字段
   */
  unregister(moduleId: string): boolean {
    return this.providers.delete(moduleId);
  }

  /**
   * 获取所有已注册的快照字段（合并所有模块）
   */
  getAllFields(): SnapshotFieldConfig[] {
    const fields: SnapshotFieldConfig[] = [];
    for (const provider of this.providers.values()) {
      fields.push(...provider.fields);
    }
    return fields;
  }

  /**
   * 获取指定模块的快照字段
   */
  getModuleFields(moduleId: string): SnapshotFieldConfig[] {
    return this.providers.get(moduleId)?.fields ?? [];
  }

  /**
   * 检查模块是否已注册快照字段
   */
  hasModule(moduleId: string): boolean {
    return this.providers.has(moduleId);
  }

  /**
   * 获取所有已注册模块 ID
   */
  getRegisteredModules(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 查找某个 key 由哪个模块注册
   */
  findKeyOwner(key: string): string | undefined {
    for (const [moduleId, provider] of this.providers) {
      if (provider.fields.some((f) => f.key === key)) {
        return moduleId;
      }
    }
    return undefined;
  }

  /**
   * 清空所有注册（测试用）
   */
  clear(): void {
    this.providers.clear();
  }
}

export const snapshotRegistry = new SnapshotRegistryImpl();
