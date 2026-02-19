/**
 * 角色肖像图片模块
 *
 * 提供 OPFS 持久化存储和 React Hook。
 *
 * @example
 * ```tsx
 * import { usePortrait } from "@/lib/portrait";
 *
 * function Avatar({ saveId, characterId }: Props) {
 *   const { portraitUrl, isLoading, upload, remove } = usePortrait(saveId, characterId);
 *   return portraitUrl ? <img src={portraitUrl} /> : <Placeholder />;
 * }
 * ```
 */

// 重导出存储层的所有函数和类型
export {
  deletePortrait,
  isPortraitStorageAvailable,
  loadPortrait,
  savePortrait,
  validatePortraitFile,
} from "./storage";
export type { PortraitMeta } from "./storage";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deletePortrait,
  loadPortrait,
  savePortrait,
  validatePortraitFile,
} from "./storage";

/**
 * usePortrait - 管理角色肖像图片的加载、上传和删除
 *
 * 自动在 saveId/characterId 变化时加载图片，
 * 并在卸载或参数变化时释放旧的 Object URL。
 *
 * @param saveId - 存档 ID，为 null 时不执行任何操作
 * @param characterId - 角色 ID，为 null 时不执行任何操作
 *
 * @returns 肖像状态和操作方法
 *
 * @example
 * ```tsx
 * const { portraitUrl, isLoading, upload, remove } = usePortrait(saveId, characterId);
 *
 * const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0];
 *   if (!file) return;
 *   try {
 *     await upload(file);
 *   } catch (err) {
 *     toast.error((err as Error).message);
 *   }
 * };
 * ```
 */
export function usePortrait(
  saveId: string | null,
  characterId: string | null,
): {
  /** 当前图片的 Object URL，null 表示无图 */
  portraitUrl: string | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /**
   * 上传图片（校验 + 保存 + 刷新预览）
   *
   * 校验失败或保存失败时抛出 Error，调用方应自行处理（如 toast）。
   */
  upload: (file: File) => Promise<void>;
  /**
   * 删除图片（删除 + 清空预览）
   */
  remove: () => Promise<void>;
} {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 用 ref 追踪当前 URL 以便在清理时释放
  const urlRef = useRef<string | null>(null);

  /**
   * 释放旧的 Object URL
   */
  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  /**
   * 设置新的 Object URL（同时释放旧的）
   */
  const updateUrl = useCallback(
    (newUrl: string | null) => {
      revokeUrl();
      urlRef.current = newUrl;
      setPortraitUrl(newUrl);
    },
    [revokeUrl],
  );

  // saveId/characterId 变化时加载图片
  useEffect(() => {
    if (!saveId || !characterId) {
      updateUrl(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await loadPortrait(saveId, characterId);
        if (!cancelled) {
          updateUrl(result?.url ?? null);
        } else if (result?.url) {
          // 若已取消但创建了 URL，立即释放
          URL.revokeObjectURL(result.url);
        }
      } catch {
        if (!cancelled) {
          updateUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      revokeUrl();
    };
  }, [saveId, characterId, updateUrl, revokeUrl]);

  // 卸载时释放 URL
  useEffect(() => {
    return () => {
      revokeUrl();
    };
  }, [revokeUrl]);

  const upload = useCallback(
    async (file: File) => {
      if (!saveId || !characterId) {
        throw new Error("无法上传：存档或角色信息缺失");
      }

      const validation = validatePortraitFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      await savePortrait(saveId, characterId, file);

      // 保存成功后重新加载以刷新预览
      const result = await loadPortrait(saveId, characterId);
      updateUrl(result?.url ?? null);
    },
    [saveId, characterId, updateUrl],
  );

  const remove = useCallback(async () => {
    if (!saveId || !characterId) {
      return;
    }

    await deletePortrait(saveId, characterId);
    updateUrl(null);
  }, [saveId, characterId, updateUrl]);

  return { portraitUrl, isLoading, upload, remove };
}
