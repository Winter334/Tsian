/**
 * 玩家身份管理设置页
 *
 * 功能：
 * - 显示当前身份信息（uniqueTag、displayName）
 * - 修改显示名称
 * - 恢复身份（跨设备）
 */

import { Button, Input } from "@/components/ui";
import { useToast } from "@/hooks";
import {
  getCurrentIdentity,
  hasInitializedIdentity,
  parseUniqueTag,
  recoverIdentity,
  updateDisplayName,
} from "@/lib/user-identity";
import { borders, color, colorAlpha, glow } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Edit2,
  Key,
  RefreshCw,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PlayerIdentityProps {
  onBack: () => void;
}

type ViewMode = "view" | "edit" | "recover";

export function PlayerIdentity({ onBack }: PlayerIdentityProps) {
  const { toast } = useToast();
  const [identity, setIdentity] = useState(getCurrentIdentity());
  const [viewMode, setViewMode] = useState<ViewMode>("view");

  // 编辑模式状态
  const [editName, setEditName] = useState("");

  // 恢复模式状态
  const [recoverTag, setRecoverTag] = useState("");
  const [recoverError, setRecoverError] = useState("");

  // 刷新身份信息
  const refreshIdentity = useCallback(() => {
    setIdentity(getCurrentIdentity());
  }, []);

  // 进入编辑模式
  const handleStartEdit = useCallback(() => {
    setEditName(identity.displayName);
    setViewMode("edit");
  }, [identity.displayName]);

  // 保存显示名称
  const handleSaveName = useCallback(() => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast("error", "名称不能为空");
      return;
    }

    updateDisplayName(trimmedName);
    refreshIdentity();
    setViewMode("view");
    toast("success", "显示名称已更新");
  }, [editName, refreshIdentity, toast]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setViewMode("view");
    setEditName("");
  }, []);

  // 进入恢复模式
  const handleStartRecover = useCallback(() => {
    setRecoverTag("");
    setRecoverError("");
    setViewMode("recover");
  }, []);

  // 验证恢复标识格式
  const validateRecoverTag = useCallback((tag: string): string | null => {
    if (!tag.trim()) {
      return "请输入身份标识";
    }
    const parsed = parseUniqueTag(tag.trim());
    if (!parsed) {
      return "格式无效，应为：名称#XXXX（4位十六进制）";
    }
    return null;
  }, []);

  // 执行恢复
  const handleRecover = useCallback(() => {
    const error = validateRecoverTag(recoverTag);
    if (error) {
      setRecoverError(error);
      return;
    }

    const success = recoverIdentity(recoverTag.trim());
    if (success) {
      refreshIdentity();
      setViewMode("view");
      toast("success", "身份已恢复", "你的角色数据将在下次进入游戏时自动匹配");
    } else {
      setRecoverError("恢复失败，请检查标识格式");
    }
  }, [recoverTag, validateRecoverTag, refreshIdentity, toast]);

  // 取消恢复
  const handleCancelRecover = useCallback(() => {
    setViewMode("view");
    setRecoverTag("");
    setRecoverError("");
  }, []);

  // 复制 uniqueTag
  const handleCopyTag = useCallback(async () => {
    if (!identity.uniqueTag) return;

    try {
      await navigator.clipboard.writeText(identity.uniqueTag);
      toast("success", "已复制到剪贴板");
    } catch {
      toast("error", "复制失败");
    }
  }, [identity.uniqueTag, toast]);

  // 监听恢复标识变化，清除错误
  useEffect(() => {
    if (recoverError && recoverTag) {
      setRecoverError("");
    }
  }, [recoverTag, recoverError]);

  // 检查是否已初始化身份
  const isInitialized = hasInitializedIdentity();

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      {/* 身份信息卡片 */}
      <div
        className="p-4 rounded-lg"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `2px solid ${colorAlpha("primary", 0.3)}`,
          borderRadius: borders.radius.lg,
        }}
      >
        {/* UniqueTag 显示 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" style={{ color: color("primary") }} />
            <span
              className="text-sm font-medium"
              style={{ color: color("textSecondary") }}
            >
              唯一标识
            </span>
          </div>
          {identity.uniqueTag && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTag}
              className="h-7 px-2"
            >
              <Copy className="w-3 h-3 mr-1" />
              复制
            </Button>
          )}
        </div>

        {isInitialized ? (
          <p
            className="text-xl font-bold font-mono text-center py-2"
            style={{
              color: color("primary"),
              textShadow: glow("primary", "sm", 0.5),
            }}
          >
            {identity.uniqueTag}
          </p>
        ) : (
          <p
            className="text-sm text-center py-2"
            style={{ color: color("textMuted") }}
          >
            尚未设置身份，请完成首次引导
          </p>
        )}

        <p
          className="text-xs text-center mt-2"
          style={{ color: color("textMuted") }}
        >
          此标识用于跨设备恢复身份，请妥善保存
        </p>
      </div>

      {/* 显示名称区域 */}
      <AnimatePresence mode="wait">
        {viewMode === "view" && (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* 当前显示名称 */}
            <div
              className="p-4 rounded-lg"
              style={{
                background: colorAlpha("bgElevated", 0.3),
                border: `1px solid ${colorAlpha("textMuted", 0.2)}`,
                borderRadius: borders.radius.md,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User
                    className="w-4 h-4"
                    style={{ color: color("textSecondary") }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: color("textSecondary") }}
                  >
                    显示名称
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-7 px-2"
                  disabled={!isInitialized}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  修改
                </Button>
              </div>
              <p
                className="text-lg font-medium mt-2"
                style={{ color: color("textPrimary") }}
              >
                {identity.displayName || "未设置"}
              </p>
            </div>

            {/* 恢复身份按钮 */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleStartRecover}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              恢复身份（跨设备）
            </Button>

            {/* 提示信息 */}
            <div
              className="text-xs space-y-1"
              style={{ color: color("textMuted") }}
            >
              <p>• 显示名称可以随时修改，不影响身份标识</p>
              <p>• 在新设备上使用"恢复身份"功能可以找回你的角色</p>
            </div>
          </motion.div>
        )}

        {viewMode === "edit" && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                className="text-sm font-medium flex items-center gap-2"
                style={{ color: color("textSecondary") }}
              >
                <User className="w-4 h-4" />
                新的显示名称
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入新名称..."
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelEdit}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveName}
                disabled={!editName.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </motion.div>
        )}

        {viewMode === "recover" && (
          <motion.div
            key="recover"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                className="text-sm font-medium flex items-center gap-2"
                style={{ color: color("textSecondary") }}
              >
                <Key className="w-4 h-4" />
                输入身份标识
              </label>
              <Input
                value={recoverTag}
                onChange={(e) => setRecoverTag(e.target.value)}
                placeholder="例如：勇者#A3F2"
                autoFocus
              />
              {recoverError && (
                <p className="text-xs" style={{ color: color("error") }}>
                  {recoverError}
                </p>
              )}
            </div>

            <div
              className="p-3 rounded-md text-xs"
              style={{
                background: colorAlpha("warning", 0.1),
                border: `1px solid ${colorAlpha("warning", 0.3)}`,
                color: color("warning"),
              }}
            >
              <p className="font-medium mb-1">⚠️ 注意</p>
              <p>恢复身份后，当前设备的身份标识将被替换。</p>
              <p>你在游戏中创建的角色将自动关联到恢复的身份。</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelRecover}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleRecover}
                disabled={!recoverTag.trim()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                恢复
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
