/**
 * 更新日志配置
 */

export interface ChangelogEntry {
  /** 版本号 */
  version: string;
  /** 发布日期 (YYYY-MM-DD) */
  date: string;
  /** 更新内容列表 */
  changes: string[];
}

/**
 * 更新日志数据
 * 按版本号倒序排列（最新版本在前）
 */
export const changelog: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026-02-01",
    changes: [
      "初始版本发布",
      "基础聊天功能",
      "AI 多提供商支持",
      "存档管理系统",
      "数据导出/导入",
    ],
  },
];

/**
 * 获取当前版本号
 */
export function getCurrentVersion(): string {
  return changelog[0]?.version ?? "0.0.0";
}

/**
 * 获取最新的更新日志
 */
export function getLatestChangelog(): ChangelogEntry | undefined {
  return changelog[0];
}
