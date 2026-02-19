/**
 * 导入预览弹窗
 * 显示导入文件的预览信息，确认后执行导入
 */

import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DataCommands } from "@/domain/commands/data";
import { SaveCommands } from "@/domain/commands/save";
import { useCommand, useToast } from "@/hooks";
import type {
  ExportData,
  ImportPreview as ImportPreviewType,
} from "@/modules/data";
import { animation, color, colorAlpha } from "@/styles/tokens";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  FileJson,
  Gamepad2,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreviewType | null;
  data: ExportData | null;
  onImportComplete?: () => void;
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days === 1 ? "昨天" : `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return "刚刚";
}

/**
 * 格式化日期时间
 */
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 获取导出类型显示名称
 */
function getExportTypeName(type: string): string {
  switch (type) {
    case "single_save":
      return "单个存档";
    case "full_backup":
      return "全部数据备份";
    default:
      return "未知类型";
  }
}

export function ImportPreview({
  open,
  onOpenChange,
  preview,
  data,
  onImportComplete,
}: ImportPreviewProps) {
  const { toast } = useToast();
  const dispatch = useCommand();
  const [importing, setImporting] = useState(false);

  // 执行导入
  const handleImport = useCallback(async () => {
    if (!data) return;

    setImporting(true);
    try {
      const result = await dispatch({
        type: DataCommands.IMPORT_DATA,
        payload: { data },
      });

      if (result.success) {
        const saveCount = Object.keys(result.data || {}).length;
        toast("success", "导入成功", `已导入 ${saveCount} 个存档`);

        const saveIdMap = (result.data || {}) as Record<string, string>;
        let targetSaveId: string | null = null;

        if (data.type === "single_save") {
          targetSaveId = saveIdMap[data.save.id] || null;
        } else {
          const latestSave = [...data.saves].sort(
            (a, b) => b.updatedAt - a.updatedAt,
          )[0];
          if (latestSave) {
            targetSaveId = saveIdMap[latestSave.id] || null;
          }
        }

        if (targetSaveId) {
          const loadResult = await dispatch({
            type: SaveCommands.LOAD_SAVE,
            payload: { saveId: targetSaveId },
          });

          if (!loadResult.success) {
            toast("warning", "自动加载失败", "请在存档管理中手动加载");
          }
        }

        onOpenChange(false);
        onImportComplete?.();
      } else {
        toast("error", "导入失败", result.error || "请稍后重试");
      }
    } catch {
      toast("error", "导入失败", "请稍后重试");
    } finally {
      setImporting(false);
    }
  }, [data, dispatch, toast, onOpenChange, onImportComplete]);

  // 取消导入
  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="导入预览" width="sm" animateLifecycle>
        <div className="space-y-4">
          {/* 文件信息卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: animation.duration.fast, ease: "easeOut" }}
            className="rounded-lg p-4"
            style={{
              background: colorAlpha("bgElevated", 0.5),
              border: `1px solid ${colorAlpha("primary", 0.2)}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileJson
                className="w-5 h-5"
                style={{ color: color("primary") }}
              />
              <h3
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                文件信息
              </h3>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: color("textSecondary") }}>类型</span>
                <span style={{ color: color("textPrimary") }}>
                  {getExportTypeName(preview.type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: color("textSecondary") }}>导出时间</span>
                <span style={{ color: color("textPrimary") }}>
                  {formatDateTime(preview.exportedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: color("textSecondary") }}>存档数量</span>
                <span style={{ color: color("textPrimary") }}>
                  {preview.saveCount} 个
                </span>
              </div>
            </div>
          </motion.div>

          {/* 存档列表卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: animation.duration.fast,
              ease: "easeOut",
              delay: 0.04,
            }}
            className="rounded-lg p-4"
            style={{
              background: colorAlpha("bgElevated", 0.5),
              border: `1px solid ${colorAlpha("primary", 0.2)}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Gamepad2
                className="w-5 h-5"
                style={{ color: color("secondary") }}
              />
              <h3
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                存档列表
              </h3>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {preview.saves.map((save, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: animation.duration.fast,
                    ease: "easeOut",
                    delay: 0.12 + index * 0.04,
                  }}
                  className="rounded-md p-3"
                  style={{
                    background: colorAlpha("primary", 0.05),
                    border: `1px solid ${colorAlpha("primary", 0.1)}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Gamepad2
                      className="w-4 h-4"
                      style={{ color: color("primaryLight") }}
                    />
                    <span
                      className="font-medium text-sm truncate"
                      style={{ color: color("textPrimary") }}
                    >
                      {save.name || "未命名存档"}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: color("textMuted") }}
                  >
                    <span className="flex items-center gap-1">
                      <MessagesSquare className="w-3 h-3" />
                      {save.conversationCount} 个会话
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {save.messageCount} 条消息
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatRelativeTime(save.updatedAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* 导入说明卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: animation.duration.fast,
              ease: "easeOut",
              delay: 0.08,
            }}
            className="rounded-lg p-4"
            style={{
              background: colorAlpha("warning", 0.1),
              border: `1px solid ${colorAlpha("warning", 0.3)}`,
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: color("warning") }}
              />
              <div>
                <h3
                  className="text-sm font-semibold mb-1"
                  style={{ color: color("warning") }}
                >
                  导入说明
                </h3>
                <p
                  className="text-sm"
                  style={{ color: color("textSecondary") }}
                >
                  导入的存档将生成新 ID，不会覆盖现有数据
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: color("textSecondary") }}
                >
                  导入存档后，角色图片需要在角色详情页手动重新上传
                </p>
              </div>
            </div>
          </motion.div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleCancel} disabled={importing}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "导入中..." : "确认导入"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
