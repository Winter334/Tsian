/**
 * Action Schema Registry
 *
 * 管理所有已注册的 ActionSchema，支持按模块注册/注销，
 * 以及按类型、分类查询。
 *
 * 导出模块级单例 `actionSchemaRegistry`。
 */

import type { ActionCategory, ActionSchema } from "./types";

export class ActionSchemaRegistry {
  /** type → schema 映射 */
  private readonly schemas = new Map<string, ActionSchema>();
  /** moduleId → type[] 映射，用于按模块注销 */
  private readonly moduleIndex = new Map<string, string[]>();

  /**
   * 注册一组 ActionSchema（属于同一模块）
   *
   * @throws 如果 schema.type 已被其他模块注册，则抛出错误
   */
  registerActions(moduleId: string, schemas: ActionSchema[]): void {
    const types: string[] = [];

    for (const schema of schemas) {
      const existing = this.schemas.get(schema.type);
      if (existing) {
        // 查找已注册该 type 的模块
        const existingModule = this.findModuleByType(schema.type);
        throw new Error(
          `[ActionSchemaRegistry] Action type "${schema.type}" 已被模块 "${existingModule}" 注册，` +
            `模块 "${moduleId}" 不能重复注册`
        );
      }
      this.schemas.set(schema.type, schema);
      types.push(schema.type);
    }

    // 合并到模块索引（同一模块可多次调用 registerActions）
    const existing = this.moduleIndex.get(moduleId) ?? [];
    this.moduleIndex.set(moduleId, [...existing, ...types]);
  }

  /**
   * 注销指定模块注册的所有 ActionSchema
   */
  unregisterModule(moduleId: string): void {
    const types = this.moduleIndex.get(moduleId);
    if (!types) return;

    for (const type of types) {
      this.schemas.delete(type);
    }
    this.moduleIndex.delete(moduleId);
  }

  /**
   * 获取所有已注册的 ActionSchema
   */
  getAllSchemas(): ActionSchema[] {
    return [...this.schemas.values()];
  }

  /**
   * 按分类分组获取 ActionSchema
   */
  getSchemasByCategory(): Map<ActionCategory, ActionSchema[]> {
    const result = new Map<ActionCategory, ActionSchema[]>();

    for (const schema of this.schemas.values()) {
      const list = result.get(schema.category) ?? [];
      list.push(schema);
      result.set(schema.category, list);
    }

    return result;
  }

  /**
   * 获取单个 ActionSchema
   */
  getSchema(type: string): ActionSchema | undefined {
    return this.schemas.get(type);
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  private findModuleByType(type: string): string | undefined {
    for (const [moduleId, types] of this.moduleIndex.entries()) {
      if (types.includes(type)) return moduleId;
    }
    return undefined;
  }
}

/**
 * 模块级单例
 */
export const actionSchemaRegistry = new ActionSchemaRegistry();
