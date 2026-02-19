/**
 * 玩家身份设置步骤
 *
 * 首次引导时让用户设置显示名称，生成 uniqueTag
 */

import { Button, Input } from "@/components/ui";
import {
  generateDefaultDisplayName,
  generateShortId,
  getOrCreateUserId,
  initializeUniqueTag,
} from "@/lib/user-identity";
import { cn } from "@/lib/utils";
import {
  borders,
  color,
  colorAlpha,
  glow,
  gradientText,
  gradients,
} from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PlayerIdentityStepProps {
  onComplete: () => void;
}

export function PlayerIdentityStep({ onComplete }: PlayerIdentityStepProps) {
  const [displayName, setDisplayName] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);

  // 预览的 shortId（从 userId 生成）
  const previewShortId = useMemo(() => {
    const userId = getOrCreateUserId();
    return generateShortId(userId);
  }, []);

  // 预览的 uniqueTag
  const previewUniqueTag = useMemo(() => {
    if (!displayName.trim()) return "";
    return `${displayName.trim()}#${previewShortId}`;
  }, [displayName, previewShortId]);

  // 初始化时生成默认名称
  useEffect(() => {
    const defaultName = generateDefaultDisplayName();
    setDisplayName(defaultName);
  }, []);

  // 随机生成新名称
  const handleRandomName = useCallback(() => {
    const newName = generateDefaultDisplayName();
    setDisplayName(newName);
    setIsConfirmed(false);
  }, []);

  // 确认并继续
  const handleConfirm = useCallback(() => {
    if (!displayName.trim()) return;

    // 初始化 uniqueTag（一旦设置永不改变）
    initializeUniqueTag(displayName.trim());
    setIsConfirmed(true);

    // 延迟完成，让用户看到确认状态
    setTimeout(onComplete, 800);
  }, [displayName, onComplete]);

  // 样式
  const titleGradientStyles = useMemo(() => {
    return gradientText(gradients.text());
  }, []);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold"
          style={titleGradientStyles}
        >
          设置你的身份
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-2"
          style={{ color: color("textMuted") }}
        >
          这将是你在游戏中的唯一标识
        </motion.p>
      </div>

      {/* 显示名称输入 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-2"
      >
        <label
          className="text-sm font-medium flex items-center gap-2"
          style={{ color: color("textSecondary") }}
        >
          <User className="w-4 h-4" />
          显示名称
        </label>
        <div className="flex gap-2">
          <Input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setIsConfirmed(false);
            }}
            placeholder="输入你的名称..."
            maxLength={20}
            disabled={isConfirmed}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRandomName}
            disabled={isConfirmed}
            title="随机生成"
            className="shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* UniqueTag 预览 */}
      <AnimatePresence>
        {previewUniqueTag && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="p-4 text-center"
              style={{
                background: colorAlpha("primary", 0.1),
                borderRadius: borders.radius.md,
                border: `2px solid ${colorAlpha("primary", 0.3)}`,
              }}
            >
              <p className="text-xs mb-2" style={{ color: color("textMuted") }}>
                你的唯一标识
              </p>
              <p
                className="text-xl font-bold font-mono"
                style={{
                  color: color("primary"),
                  textShadow: glow("primary", "sm", 0.5),
                }}
              >
                {previewUniqueTag}
              </p>
              <p className="text-xs mt-2" style={{ color: color("textMuted") }}>
                请记住这个标识，用于跨设备恢复身份
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 确认按钮 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          className={cn("w-full", isConfirmed && "pointer-events-none")}
          onClick={handleConfirm}
          disabled={!displayName.trim() || isConfirmed}
        >
          {isConfirmed ? "✓ 身份已确认" : "确认并继续 →"}
        </Button>
      </motion.div>

      {/* 提示信息 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-center"
        style={{ color: color("textMuted") }}
      >
        显示名称可以随时修改，但 #{previewShortId} 标识是永久的
      </motion.p>
    </div>
  );
}
