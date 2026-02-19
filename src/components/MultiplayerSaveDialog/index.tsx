/**
 * 联机存档选项对话框
 *
 * 当用户尝试加载联机存档时弹出，提供以下选项：
 * - 开启新聚会：创建新房间，使用该存档数据
 * - 返回：取消操作
 *
 * UI 增强：
 * - 使用统一 Dialog 复合层（Overlay/ESC/滚动锁定）
 * - 使用 Card 展示存档信息
 * - 使用统一入场动画
 */

import { Button, Card, Dialog, DialogContent } from "@/components/ui";
import type { SaveSlotInfo } from "@/core/yjs/types";
import {
  color,
  colorAlpha,
  glow,
  gradientText,
  gradients,
} from "@/styles/tokens";
import { ArrowLeft, Loader2, Users, X } from "lucide-react";
import { useState } from "react";

interface MultiplayerSaveDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 存档信息 */
  save: SaveSlotInfo | null;
  /** 开启新聚会回调 */
  onStartNewParty: (save: SaveSlotInfo) => Promise<void>;
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 今天
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return `今天 ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }

  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate()) {
    return `昨天 ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }

  // 更早
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function MultiplayerSaveDialog({
  open,
  onOpenChange,
  save,
  onStartNewParty,
}: MultiplayerSaveDialogProps) {
  const [isStarting, setIsStarting] = useState(false);

  if (!save) return null;

  const handleStartNewParty = async () => {
    setIsStarting(true);
    try {
      await onStartNewParty(save);
      onOpenChange(false);
    } catch {
      // Silently handle error
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    if (!isStarting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnEscape={!isStarting}>
      <DialogContent
        width="sm"
        background="starfield"
        borderGlow
        enterAnimation
        closeOnBackdropClick={!isStarting}
        showCloseButton={false}
        header={
          <div
            className="flex items-center justify-between p-6 pb-4"
            style={{
              borderBottom: `2px solid ${colorAlpha("primary", 0.25)}`,
            }}
          >
            <div>
              <h2
                className="text-xl font-bold"
                style={gradientText(gradients.text())}
              >
                联机存档
              </h2>
              <p className="text-sm mt-1" style={{ color: color("textMuted") }}>
                这是一个联机存档，需要创建新房间才能继续游戏
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isStarting}
              className="p-2 rounded-md transition-all disabled:opacity-50"
              style={{ color: color("primary") }}
              onMouseEnter={(e) => {
                if (!isStarting) {
                  e.currentTarget.style.color = color("primaryLight");
                  e.currentTarget.style.background = colorAlpha("primary", 0.1);
                  e.currentTarget.style.boxShadow = glow("primary", "sm", 0.3);
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = color("primary");
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
              aria-label="关闭联机存档对话框"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        }
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={isStarting}>
              <ArrowLeft size={16} className="mr-2" />
              返回
            </Button>
            <Button onClick={handleStartNewParty} disabled={isStarting}>
              {isStarting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Users size={16} className="mr-2" />
                  开启新聚会
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 存档信息卡片 - 使用 Card */}
          <Card variant="default" hover={false} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: colorAlpha("primary", 0.2),
                }}
              >
                <Users size={20} style={{ color: color("primaryLight") }} />
              </div>
              <div>
                <h3
                  className="font-medium"
                  style={{ color: color("textPrimary") }}
                >
                  {save.name}
                </h3>
                <p className="text-sm" style={{ color: color("textMuted") }}>
                  上次游戏：{formatTime(save.updatedAt)}
                </p>
              </div>
            </div>

            {/* 成员列表 */}
            {save.members && save.members.length > 0 && (
              <div
                className="mt-3 pt-3"
                style={{
                  borderTop: `1px solid ${colorAlpha("primary", 0.2)}`,
                }}
              >
                <p
                  className="text-sm mb-2"
                  style={{ color: color("textMuted") }}
                >
                  上次成员 ({save.members.length}人)
                </p>
                <div className="flex flex-wrap gap-2">
                  {save.members.map((member, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: colorAlpha("primary", 0.15),
                        color: color("primaryLight"),
                      }}
                    >
                      {member.displayName}
                      {member.role === "host" && " 👑"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 说明文字 */}
          <p className="text-sm" style={{ color: color("textMuted") }}>
            联机存档需要创建新房间才能继续。创建后，你可以将新的房间码分享给其他玩家。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
