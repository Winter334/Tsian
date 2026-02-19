/**
 * 角色肖像图片持久化存储
 *
 * 使用 OPFS (Origin Private File System) 按 saveId + characterId 维度隔离存储。
 * OPFS 文件路径：portraits/{saveId}/{characterId}/current
 * 元信息存储在 localStorage 中，key 格式：portrait-meta:{saveId}:{characterId}
 */

import { opfs, settings } from "@/core/storage";

// ============ 类型定义 ============

/** 肖像图片元信息 */
export interface PortraitMeta {
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

// ============ 常量 ============

/** 允许的图片 MIME 类型 */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 最大文件大小：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 存储在 OPFS 中的文件名 */
const PORTRAIT_FILENAME = "current";

/** localStorage 元信息 key 前缀 */
const META_KEY_PREFIX = "portrait-meta";

// ============ 内部工具函数 ============

/**
 * 构建 localStorage 元信息的 key
 */
function metaKey(saveId: string, characterId: string): string {
  return `${META_KEY_PREFIX}:${saveId}:${characterId}`;
}

/**
 * 从 OPFS 根目录逐级导航到嵌套目录，不存在则创建
 *
 * 因为 OPFS 的 `getFileHandle` / `getDirectoryHandle` 只接受单层文件名，
 * 需要手动逐层遍历路径段。
 */
async function getNestedDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * 从 OPFS 根目录逐级导航到嵌套目录（只读，不创建）
 *
 * @returns 目标目录句柄，若路径不存在则返回 null
 */
async function findNestedDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current = root;
  try {
    for (const segment of segments) {
      current = await current.getDirectoryHandle(segment);
    }
    return current;
  } catch {
    return null;
  }
}

/**
 * 获取肖像存储的目录路径段
 */
function portraitDirSegments(saveId: string, characterId: string): string[] {
  return ["portraits", saveId, characterId];
}

// ============ 导出函数 ============

/**
 * 检查 OPFS 图片存储是否可用
 *
 * @returns 当前环境是否支持 OPFS
 */
export function isPortraitStorageAvailable(): boolean {
  return opfs.isSupported();
}

/**
 * 校验肖像图片文件的格式和大小
 *
 * @param file - 待校验的文件
 * @returns 校验结果，若不合法则包含错误信息
 */
export function validatePortraitFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: `不支持的图片格式「${file.type || "未知"}」，仅支持 JPEG、PNG、WebP`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `图片大小 ${sizeMB}MB 超出限制，最大允许 10MB`,
    };
  }

  return { valid: true };
}

/**
 * 保存角色肖像图片
 *
 * 将图片写入 OPFS 并更新 localStorage 中的元信息。
 *
 * @param saveId - 存档 ID
 * @param characterId - 角色 ID
 * @param file - 图片文件
 * @returns 保存后的元信息
 * @throws 当 OPFS 不可用或写入失败时抛出错误
 */
export async function savePortrait(
  saveId: string,
  characterId: string,
  file: File,
): Promise<PortraitMeta> {
  const root = await opfs.getRoot();
  if (!root) {
    throw new Error("图片存储不可用，当前浏览器不支持 OPFS");
  }

  try {
    const dir = await getNestedDirectory(
      root,
      portraitDirSegments(saveId, characterId),
    );
    const fileHandle = await dir.getFileHandle(PORTRAIT_FILENAME, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`保存肖像图片失败：${message}`);
  }

  const meta: PortraitMeta = {
    mimeType: file.type,
    size: file.size,
    updatedAt: Date.now(),
  };

  settings.set(metaKey(saveId, characterId), meta);

  return meta;
}

/**
 * 加载角色肖像图片
 *
 * 从 OPFS 读取图片并创建 Object URL。
 *
 * **注意：调用方在不再需要 URL 时，必须调用 `URL.revokeObjectURL(url)` 释放内存。**
 *
 * @param saveId - 存档 ID
 * @param characterId - 角色 ID
 * @returns 包含 Object URL 和元信息的对象，若图片不存在则返回 null
 */
export async function loadPortrait(
  saveId: string,
  characterId: string,
): Promise<{ url: string; meta: PortraitMeta } | null> {
  const meta = settings.get<PortraitMeta | null>(
    metaKey(saveId, characterId),
    null,
  );
  if (!meta) {
    return null;
  }

  const root = await opfs.getRoot();
  if (!root) {
    return null;
  }

  const dir = await findNestedDirectory(
    root,
    portraitDirSegments(saveId, characterId),
  );
  if (!dir) {
    return null;
  }

  try {
    const fileHandle = await dir.getFileHandle(PORTRAIT_FILENAME);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    return { url, meta };
  } catch {
    // 文件不存在但元信息还在，清理孤立的元信息
    settings.remove(metaKey(saveId, characterId));
    return null;
  }
}

/**
 * 删除角色肖像图片
 *
 * 从 OPFS 删除文件并清除 localStorage 中的元信息。
 *
 * @param saveId - 存档 ID
 * @param characterId - 角色 ID
 */
export async function deletePortrait(
  saveId: string,
  characterId: string,
): Promise<void> {
  // 始终清除元信息
  settings.remove(metaKey(saveId, characterId));

  const root = await opfs.getRoot();
  if (!root) {
    return;
  }

  const dir = await findNestedDirectory(
    root,
    portraitDirSegments(saveId, characterId),
  );
  if (!dir) {
    return;
  }

  try {
    await dir.removeEntry(PORTRAIT_FILENAME);
  } catch {
    // 文件不存在，忽略
  }
}
