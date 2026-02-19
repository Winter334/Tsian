/**
 * Yjs 数据迁移框架
 *
 * 用于处理数据格式版本升级
 */

import type * as Y from "yjs";

/**
 * 当前数据格式版本
 * 每次修改数据结构时递增此值
 */
export const CURRENT_VERSION = 1;

/**
 * 迁移函数类型
 * @param root - Yjs 根 Map
 * @returns 迁移是否成功
 */
export type MigrationFn = (root: Y.Map<unknown>) => boolean | Promise<boolean>;

/**
 * 迁移定义
 */
export interface Migration {
  /** 目标版本（迁移后的版本） */
  toVersion: number;
  /** 迁移描述 */
  description: string;
  /** 迁移函数 */
  migrate: MigrationFn;
}

/**
 * 迁移注册表
 * key: 目标版本号
 * value: 迁移定义
 */
const migrations = new Map<number, Migration>();

/**
 * 注册迁移函数
 * @param migration - 迁移定义
 */
export function registerMigration(migration: Migration): void {
  migrations.set(migration.toVersion, migration);
}

/**
 * 获取所有已注册的迁移
 */
export function getMigrations(): Migration[] {
  return Array.from(migrations.values()).sort(
    (a, b) => a.toVersion - b.toVersion
  );
}

/**
 * 执行数据迁移
 * @param root - Yjs 根 Map
 * @param fromVersion - 当前版本
 * @param toVersion - 目标版本（默认为最新版本）
 * @returns 迁移结果
 */
export async function runMigrations(
  root: Y.Map<unknown>,
  fromVersion: number,
  toVersion: number = CURRENT_VERSION
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    fromVersion,
    toVersion: fromVersion,
    migrationsRun: [],
    errors: [],
  };

  if (fromVersion >= toVersion) {
    return result;
  }

  // 按版本顺序执行迁移
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = migrations.get(version);

    if (!migration) {
      // 没有找到迁移函数，跳过（可能是小版本更新）
      continue;
    }

    try {
      const success = await migration.migrate(root);

      if (success) {
        result.migrationsRun.push(version);
        result.toVersion = version;
      } else {
        result.success = false;
        result.errors.push({
          version,
          error: "Migration returned false",
        });
        break; // 停止后续迁移
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      break; // 停止后续迁移
    }
  }

  // 更新版本号
  if (result.success && result.toVersion > fromVersion) {
    root.set("version", result.toVersion);
  }

  return result;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 起始版本 */
  fromVersion: number;
  /** 最终版本 */
  toVersion: number;
  /** 已执行的迁移版本列表 */
  migrationsRun: number[];
  /** 错误列表 */
  errors: Array<{
    version: number;
    error: string;
  }>;
}

// ============================================================
// 迁移函数定义区域
// 每次数据结构变更时，在此添加新的迁移函数
// ============================================================

/**
 * 示例迁移：v1 → v2
 * 当需要升级到 v2 时，取消注释并修改
 */
// registerMigration({
//   toVersion: 2,
//   description: "添加 xxx 字段",
//   migrate: (root) => {
//     const saves = root.get("saves") as Y.Map<unknown>;
//
//     // 遍历所有存档，添加新字段
//     saves.forEach((save) => {
//       const saveMap = save as Y.Map<unknown>;
//       if (!saveMap.has("newField")) {
//         saveMap.set("newField", defaultValue);
//       }
//     });
//
//     return true;
//   },
// });

/**
 * 迁移模板
 *
 * 使用步骤：
 * 1. 复制此模板
 * 2. 修改 toVersion 为新版本号
 * 3. 修改 description 描述变更内容
 * 4. 实现 migrate 函数
 * 5. 更新 CURRENT_VERSION 常量
 *
 * 注意事项：
 * - 迁移函数必须是幂等的（多次执行结果相同）
 * - 迁移失败时返回 false 或抛出异常
 * - 迁移应该向后兼容，不要删除旧字段
 */
