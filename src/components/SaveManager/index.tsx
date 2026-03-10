/**
 * SaveManagerDialog - 存档管理弹窗
 *
 * 管理存档槽位（Save Slots），而非会话（Conversations）
 * 每个存档槽位是一个独立的游戏档案，包含多个会话
 *
 * 数据来源：
 * - 存档列表：useSaveSlots hook (订阅 Yjs)
 * - 当前存档 ID：useCurrentSaveId hook
 *
 * UI 增强：
 * - 使用统一 Dialog 复合层（Overlay/ESC/滚动锁定）
 * - 使用 Card 实现存档卡片
 * - 使用统一入场动画
 */

import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
} from "@/components/ui";
import type { SaveSlotInfo } from "@/core/yjs/types";
import { DataCommands } from "@/domain/commands/data";
import { SaveCommands } from "@/domain/commands/save";
import { useCommand, useToast } from "@/hooks";
import { useCurrentSaveId, useSaveSlots } from "@/modules/save";
import {
  color,
  colorAlpha,
  glow,
  gradients,
  listItemVariants,
} from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Download,
  FolderOpen,
  Gamepad2,
  Play,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface SaveManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadSave?: (saveId: string) => void;
  /** 联机存档加载回调 - 弹出选择对话框 */
  onMultiplayerSave?: (save: SaveSlotInfo) => void;
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
 * 单个存档卡片
 */
interface SaveCardProps {
  save: SaveSlotInfo;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onExport: () => void;
  index: number;
}

function SaveCard({
  save,
  isActive,
  onLoad,
  onDelete,
  onExport,
  index,
}: SaveCardProps) {
  // 活跃指示器样式
  const indicatorStyles = useMemo(() => {
    return {
      background: gradients.primary(),
      boxShadow: glow("primary", "sm", 0.8),
    };
  }, []);

  return (
    <motion.div
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
    >
      <Card
        variant={isActive ? "elevated" : "default"}
        hover={true}
        glowOnHover={true}
        className="relative group p-4"
      >
        {/* 活跃指示器 */}
        {isActive && (
          <div
            className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full"
            style={indicatorStyles}
          />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <div className="flex items-center gap-2">
              {save.type === "multiplayer" ? (
                <Users
                  className="w-4 h-4 shrink-0"
                  style={{ color: color("primaryLight") }}
                />
              ) : (
                <Gamepad2
                  className="w-4 h-4 shrink-0"
                  style={{ color: color("primaryLight") }}
                />
              )}
              <h3
                className="font-medium truncate"
                style={{ color: color("textPrimary") }}
              >
                {save.name || "未命名存档"}
              </h3>
              {/* 类型标签 */}
              <span
                className="px-1.5 py-0.5 rounded text-xs shrink-0"
                style={{
                  background: colorAlpha(
                    save.type === "multiplayer" ? "primary" : "primary",
                    0.15,
                  ),
                  color: color("primaryLight"),
                }}
              >
                {save.type === "multiplayer" ? "👥 联机" : "🎮 单人"}
              </span>
            </div>

            {/* 元信息 */}
            <div
              className="flex items-center gap-3 mt-2 text-sm"
              style={{ color: colorAlpha("primary", 0.7) }}
            >
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatRelativeTime(save.updatedAt)}
              </span>
              {isActive && (
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    background: colorAlpha("primary", 0.2),
                    color: color("primaryLight"),
                  }}
                >
                  当前存档
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onLoad();
              }}
              disabled={isActive && save.type === "multiplayer"}
              style={{
                color: color("primaryLight"),
              }}
            >
              <Play className="w-4 h-4 mr-1" />
              {isActive ? "已加载" : "加载"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              style={{
                color: colorAlpha("primary", 0.7),
              }}
              title="导出存档"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              style={{
                color: colorAlpha("error", 0.6),
              }}
              title="删除存档"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * 空状态
 */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: gradients.subtle(),
          border: `2px solid ${colorAlpha("primary", 0.3)}`,
        }}
      >
        <FolderOpen
          className="w-8 h-8"
          style={{ color: colorAlpha("primary", 0.6) }}
        />
      </div>
      <h3
        className="font-medium mb-2"
        style={{ color: color("textSecondary") }}
      >
        暂无存档
      </h3>
      <p className="text-sm" style={{ color: color("textMuted") }}>
        请通过开始向导创建你的第一个存档
      </p>
    </motion.div>
  );
}

/**
 * SaveManagerDialog 主组件
 */
export function SaveManagerDialog({
  open,
  onOpenChange,
  onLoadSave,
  onMultiplayerSave,
}: SaveManagerDialogProps) {
  // 存档槽位数据（从 Yjs）
  const saves = useSaveSlots();

  // 当前存档 ID
  const currentSaveId = useCurrentSaveId();

  // 待删除目标（用于确认弹窗）
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);

  // 通过 CommandBus 发送命令（符合架构规范）
  const dispatch = useCommand();

  // 加载存档 - 通过 CommandBus
  const handleLoad = useCallback(
    async (save: SaveSlotInfo) => {
      // 联机存档：保持原有联机流程，弹出选择对话框
      if (save.type === "multiplayer" && onMultiplayerSave) {
        onOpenChange(false);
        onMultiplayerSave(save);
        return;
      }

      // 当前单人存档已在内存中，无需重复 LOAD_SAVE，直接进入 Hub
      if (save.id === currentSaveId) {
        onOpenChange(false);
        onLoadSave?.(save.id);
        return;
      }

      // 单人存档：直接加载
      const result = await dispatch({
        type: SaveCommands.LOAD_SAVE,
        payload: { saveId: save.id },
      });

      if (result.success) {
        onOpenChange(false);
        onLoadSave?.(save.id);
      }
    },
    [currentSaveId, dispatch, onOpenChange, onLoadSave, onMultiplayerSave],
  );

  // 确认删除存档 - 通过 CommandBus
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    await dispatch({
      type: SaveCommands.DELETE_SAVE,
      payload: { saveId: deleteTarget.id },
    });
    setDeleteTarget(null);
  }, [dispatch, deleteTarget]);

  // Toast 提示
  const { toast } = useToast();

  // 导出单个存档 - 通过 CommandBus
  const handleExport = useCallback(
    async (save: SaveSlotInfo) => {
      try {
        const result = await dispatch({
          type: DataCommands.EXPORT_SAVE,
          payload: { saveId: save.id },
        });

        if (result.success) {
          toast("success", "导出成功", `已导出存档「${save.name}」`);
        } else {
          toast("error", "导出失败", result.error || "无法读取存档数据");
        }
      } catch {
        toast("error", "导出失败", "请稍后重试");
      }
    },
    [dispatch, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="选择存档"
        description="选择一个存档继续冒险"
        width="md"
        background="starfield"
        borderGlow
        enterAnimation
      >
        <div className="space-y-3">
          {saves.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {saves.map((save, index) => (
                  <SaveCard
                    key={save.id}
                    save={save}
                    isActive={save.id === currentSaveId}
                    onLoad={() => handleLoad(save)}
                    onDelete={() => setDeleteTarget(save)}
                    onExport={() => handleExport(save)}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeleteTarget(null);
            }
          }}
          title="删除存档"
          description={`确定要删除存档「${
            deleteTarget?.name ?? ""
          }」吗？此操作不可撤销。`}
          confirmText="删除"
          cancelText="取消"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
