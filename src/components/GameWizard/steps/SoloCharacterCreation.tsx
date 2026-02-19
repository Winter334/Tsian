/**
 * 单机模式角色创建步骤
 *
 * 在开始单人游戏前创建游戏角色
 * 支持名称（必填）+ 描述/性格/外貌（可选）
 */

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, RefreshCw, Sparkles, User } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Input, Textarea } from "@/components/ui";
import {
  generateDefaultDisplayName,
  getLastDisplayName,
} from "@/lib/user-identity";
import { cn } from "@/lib/utils";
import {
  borders,
  color,
  colorAlpha,
  gradientText,
  gradients,
} from "@/styles/tokens";

import type { StepProps } from "../types";

/**
 * 单机模式角色创建步骤
 */
export function SoloCharacterCreation({
  context,
  onComplete,
  onBack,
}: StepProps) {
  // 使用显示名称作为默认值
  const defaultName = getLastDisplayName() || generateDefaultDisplayName();

  const [characterName, setCharacterName] = useState(defaultName);
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterPersonality, setCharacterPersonality] = useState("");
  const [characterAppearance, setCharacterAppearance] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 随机生成角色名
  const handleRandomName = useCallback(() => {
    const newName = generateDefaultDisplayName();
    setCharacterName(newName);
    setError(null);
  }, []);

  // 确认创建角色
  const handleConfirm = useCallback(() => {
    const trimmedName = characterName.trim();

    if (!trimmedName) {
      setError("请输入角色名称");
      return;
    }

    if (trimmedName.length > 20) {
      setError("角色名称不能超过20个字符");
      return;
    }

    // 完成向导，将角色数据传入 WizardContext
    onComplete({
      ...context,
      characterId: "solo-character", // 单机模式固定 ID
      characterName: trimmedName,
      characterDescription: characterDescription.trim() || undefined,
      characterPersonality: characterPersonality.trim() || undefined,
      characterAppearance: characterAppearance.trim() || undefined,
    });
  }, [
    characterName,
    characterDescription,
    characterPersonality,
    characterAppearance,
    context,
    onComplete,
  ]);

  // 处理回车键提交
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && characterName.trim()) {
        handleConfirm();
      }
    },
    [characterName, handleConfirm]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8 max-w-lg mx-auto"
    >
      {/* 标题 */}
      <h2
        className="text-2xl font-bold text-center mb-2"
        style={gradientText(gradients.text())}
      >
        创建你的角色
      </h2>
      <p
        className="text-center text-sm mb-8"
        style={{ color: color("textMuted") }}
      >
        塑造你的角色形象，踏入冒险世界
      </p>

      {/* 角色输入区域 */}
      <div
        className="p-6 rounded-lg space-y-4"
        style={{
          background: colorAlpha("primary", 0.05),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
          borderRadius: borders.radius.lg,
        }}
      >
        {/* 角色图标 */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: colorAlpha("primary", 0.1),
              border: `2px solid ${colorAlpha("primary", 0.3)}`,
            }}
          >
            <User className="w-8 h-8" style={{ color: color("primary") }} />
          </div>
        </div>

        {/* 角色名称输入 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: color("textSecondary") }}
          >
            <User className="w-4 h-4" />
            角色名称
          </label>
          <div className="flex gap-2">
            <Input
              value={characterName}
              onChange={(e) => {
                setCharacterName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="输入角色名称..."
              maxLength={20}
              className="flex-1"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRandomName}
              title="随机生成"
              className="shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs" style={{ color: color("textMuted") }}>
            角色名称将在游戏中代表你
          </p>
        </div>

        {/* 角色描述 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: color("textSecondary") }}
          >
            <BookOpen className="w-4 h-4" />
            角色描述
            <span
              className="text-xs font-normal"
              style={{ color: color("textMuted") }}
            >
              (可选)
            </span>
          </label>
          <Textarea
            value={characterDescription}
            onChange={(e) => setCharacterDescription(e.target.value)}
            placeholder="描述角色的背景故事、经历、身份…"
            maxLength={200}
            rows={2}
          />
        </div>

        {/* 性格特征 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: color("textSecondary") }}
          >
            <Sparkles className="w-4 h-4" />
            性格特征
            <span
              className="text-xs font-normal"
              style={{ color: color("textMuted") }}
            >
              (可选)
            </span>
          </label>
          <Textarea
            value={characterPersonality}
            onChange={(e) => setCharacterPersonality(e.target.value)}
            placeholder="勇敢、谨慎、幽默、冷静…"
            maxLength={200}
            rows={2}
          />
        </div>

        {/* 外貌描述 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: color("textSecondary") }}
          >
            <User className="w-4 h-4" />
            外貌描述
            <span
              className="text-xs font-normal"
              style={{ color: color("textMuted") }}
            >
              (可选)
            </span>
          </label>
          <Textarea
            value={characterAppearance}
            onChange={(e) => setCharacterAppearance(e.target.value)}
            placeholder="描述角色的外貌、穿着、装备…"
            maxLength={200}
            rows={2}
          />
        </div>

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm"
              style={{ color: color("error") }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 操作按钮 */}
      <div className={cn("flex gap-4 mt-8")}>
        <Button variant="ghost" onClick={onBack} className="flex-1">
          返回
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!characterName.trim()}
          className="flex-1"
        >
          开始冒险
        </Button>
      </div>
    </motion.div>
  );
}
