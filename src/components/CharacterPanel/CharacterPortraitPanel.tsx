/**
 * 角色肖像面板
 *
 * 紧凑缩略图 + 点击预览弹窗。
 * 使用 OPFS 持久化存储，通过 usePortrait hook 管理状态。
 */

import type { Easing } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Trash2, Upload, User } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Dialog, DialogContent, useToast } from "@/components/ui";
import { isPortraitStorageAvailable, usePortrait } from "@/lib/portrait";
import { color, colorAlpha, glow } from "@/styles/tokens";

// ── 常量 ──

const ACCEPTED_FORMATS = ".jpg,.jpeg,.png,.webp";
const THUMBNAIL_SIZE = 80;

// ── 类型 ──

interface CharacterPortraitPanelProps {
  saveId: string | null;
  characterId: string;
  /** 外部容器 className，传入时缩略图自适应容器尺寸（w-full h-full） */
  className?: string;
}

// ── 动画 ──

const easeOut: Easing = [0.0, 0.0, 0.2, 1.0];

const imageVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easeOut },
  },
};

// ── 子组件：缩略图 ──

interface ThumbnailProps {
  portraitUrl: string | null;
  isLoading: boolean;
  onClick: () => void;
  /** 自适应模式：宽高由外部容器决定 */
  adaptive?: boolean;
}

function PortraitThumbnail({
  portraitUrl,
  isLoading,
  onClick,
  adaptive,
}: ThumbnailProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${adaptive ? "w-full h-full" : ""}`}
      style={{
        ...(adaptive ? {} : { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        background: colorAlpha("bgCard", 0.4),
        boxShadow: glow("primary", "sm", 0.05),
      }}
      whileHover={{
        boxShadow: glow("primary", "md", 0.2),
        borderColor: color("primary"),
      }}
      whileTap={{ scale: 0.96 }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-5 h-5" style={{ color: color("primary") }} />
          </motion.div>
        </div>
      ) : portraitUrl ? (
        <img
          src={portraitUrl}
          alt="角色肖像"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <User
            className="w-8 h-8"
            style={{ color: colorAlpha("textMuted", 0.4) }}
          />
        </div>
      )}

      {/* 悬停提示层 */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
        style={{
          background: colorAlpha("bgBase", 0.6),
        }}
      >
        <ImagePlus className="w-5 h-5" style={{ color: color("primary") }} />
      </div>
    </motion.button>
  );
}

// ── 子组件：预览弹窗 ──

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portraitUrl: string | null;
  isLoading: boolean;
  onUpload: () => void;
  onRemove: () => void;
  storageAvailable: boolean;
}

function PortraitPreviewDialog({
  open,
  onOpenChange,
  portraitUrl,
  isLoading,
  onUpload,
  onRemove,
  storageAvailable,
}: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="角色肖像" width="lg" animateLifecycle>
        <div className="flex flex-col items-center gap-4">
          {/* 图片预览区 */}
          <div
            className="relative w-full rounded-lg flex items-center justify-center"
            style={{
              background: colorAlpha("bgCard", 0.3),
              border: `1px solid ${colorAlpha("primary", 0.15)}`,
              minHeight: 300,
            }}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2
                  className="w-10 h-10"
                  style={{ color: color("primary") }}
                />
              </motion.div>
            ) : portraitUrl ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={portraitUrl}
                  src={portraitUrl}
                  alt="角色肖像"
                  className="w-full object-contain rounded-lg"
                  style={{ maxHeight: "60vh" }}
                  variants={imageVariants}
                  initial="hidden"
                  animate="visible"
                />
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-square w-full max-w-75">
                <User
                  className="w-20 h-20 mb-3"
                  style={{ color: colorAlpha("textMuted", 0.3) }}
                />
                <span className="text-sm" style={{ color: color("textMuted") }}>
                  暂无肖像
                </span>
              </div>
            )}
          </div>

          {/* 操作按钮区 */}
          {storageAvailable ? (
            <div className="flex items-center gap-3 w-full">
              {/* 上传按钮 */}
              <motion.button
                type="button"
                onClick={onUpload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: colorAlpha("primary", 0.12),
                  color: color("primary"),
                  border: `1px solid ${colorAlpha("primary", 0.25)}`,
                }}
                whileHover={{
                  backgroundColor: colorAlpha("primary", 0.2),
                  boxShadow: glow("primary", "sm", 0.15),
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Upload className="w-4 h-4" />
                {portraitUrl ? "替换图片" : "上传图片"}
              </motion.button>

              {/* 删除按钮（仅有图片时显示） */}
              {portraitUrl && (
                <motion.button
                  type="button"
                  onClick={onRemove}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: colorAlpha("error", 0.12),
                    color: color("error"),
                    border: `1px solid ${colorAlpha("error", 0.25)}`,
                  }}
                  whileHover={{
                    backgroundColor: colorAlpha("error", 0.2),
                    boxShadow: glow("error", "sm", 0.15),
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </motion.button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs" style={{ color: color("textMuted") }}>
                当前浏览器不支持图片存储
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: colorAlpha("textMuted", 0.6) }}
              >
                请使用 Chrome / Edge / Firefox 最新版
              </p>
            </div>
          )}

          {/* 文件限制提示 */}
          <div className="text-center space-y-0.5">
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.6) }}
            >
              支持 JPG、PNG、WebP，最大 10MB
            </p>
            <p
              className="text-xs"
              style={{ color: colorAlpha("textMuted", 0.4) }}
            >
              图片为本地资源，不包含在存档导出中
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 主组件 ──

/**
 * 角色肖像面板
 *
 * - 显示紧凑的头像缩略图（80x80 圆角矩形）
 * - 点击缩略图打开预览弹窗
 * - 弹窗内可放大查看、上传、删除肖像
 */
export function CharacterPortraitPanel({
  saveId,
  characterId,
  className,
}: CharacterPortraitPanelProps) {
  const { portraitUrl, isLoading, upload, remove } = usePortrait(
    saveId,
    characterId,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: toastError } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);

  const storageAvailable = isPortraitStorageAvailable();
  const adaptive = !!className;

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 重置 input 以允许再次选择同一文件
      e.target.value = "";

      try {
        await upload(file);
        success("上传成功", "角色肖像已更新");
      } catch (err) {
        toastError("上传失败", (err as Error).message);
      }
    },
    [upload, success, toastError],
  );

  const handleRemove = useCallback(async () => {
    try {
      await remove();
      success("已删除", "角色肖像已移除");
    } catch (err) {
      toastError("删除失败", (err as Error).message);
    }
  }, [remove, success, toastError]);

  const handleThumbnailClick = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const thumbnail = (
    <PortraitThumbnail
      portraitUrl={portraitUrl}
      isLoading={isLoading}
      onClick={handleThumbnailClick}
      adaptive={adaptive}
    />
  );

  return (
    <>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 缩略图（自适应模式时包裹容器 div） */}
      {adaptive ? <div className={className}>{thumbnail}</div> : thumbnail}

      {/* 预览弹窗 */}
      <PortraitPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        portraitUrl={portraitUrl}
        isLoading={isLoading}
        onUpload={triggerFileSelect}
        onRemove={handleRemove}
        storageAvailable={storageAvailable}
      />
    </>
  );
}
