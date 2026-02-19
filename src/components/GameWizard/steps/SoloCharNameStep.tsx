/**
 * 角色创建 - 步骤1：名称与描述
 *
 * 输入角色名称（必填）、外貌描述、性格特征、背景故事（均可选）
 * 可选字段收进可折叠面板，减少初始视觉负担
 *
 * 导航由 WizardFooter 统一处理，组件只负责数据传递
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Dices,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, Input, Textarea } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import {
  generateDefaultDisplayName,
  getLastDisplayName,
} from "@/lib/user-identity";
import { createStaggerVariants } from "@/styles/motion-variants";
import { borders, color, colorAlpha, glow } from "@/styles/tokens";
import type { StepProps } from "../types";

type DetailAccordionKey = "appearance" | "personality" | "story";

interface DetailAccordionItem {
  key: DetailAccordionKey;
  icon: LucideIcon;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * 角色创建步骤1：名称与描述
 */
export function SoloCharNameStep({
  context,
  onNext,
  onUpdateContext,
}: StepProps) {
  const motionConfig = useMotionTokens();

  // 交错入场 variants
  const itemVariants = createStaggerVariants(motionConfig, "y", 0.1);

  const defaultName =
    context.characterName ||
    getLastDisplayName() ||
    generateDefaultDisplayName();

  const [characterName, setCharacterName] = useState(defaultName);
  const [characterDescription, setCharacterDescription] = useState(
    context.characterDescription || "",
  );
  const [characterPersonality, setCharacterPersonality] = useState(
    context.characterPersonality || "",
  );
  const [characterAppearance, setCharacterAppearance] = useState(
    context.characterAppearance || "",
  );
  const [error, setError] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [expandedDetailField, setExpandedDetailField] =
    useState<DetailAccordionKey | null>(null);

  // 实时同步表单数据到 context，确保 WizardFooter 的"下一步"按钮能获取最新数据
  useEffect(() => {
    onUpdateContext({
      characterName: characterName.trim(),
      characterDescription: characterDescription.trim() || undefined,
      characterPersonality: characterPersonality.trim() || undefined,
      characterAppearance: characterAppearance.trim() || undefined,
    });
  }, [
    characterName,
    characterDescription,
    characterPersonality,
    characterAppearance,
    onUpdateContext,
  ]);

  useEffect(() => {
    if (!detailsExpanded) {
      setExpandedDetailField(null);
    }
  }, [detailsExpanded]);

  // 名称输入框是否有内容（用于装饰线）
  const hasNameInput = characterName.trim().length > 0;

  // 随机生成角色名
  const handleRandomName = useCallback(() => {
    const newName = generateDefaultDisplayName();
    setCharacterName(newName);
    setError(null);
  }, []);

  // 提交数据（Enter 键或 Footer 触发）
  const handleSubmit = useCallback(() => {
    const trimmedName = characterName.trim();

    if (!trimmedName) {
      setError("请输入角色名称");
      return;
    }

    if (trimmedName.length > 20) {
      setError("角色名称不能超过20个字符");
      return;
    }

    onNext({
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
    onNext,
  ]);

  // 处理回车键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && characterName.trim()) {
        handleSubmit();
      }
    },
    [characterName, handleSubmit],
  );

  const handleToggleDetailField = useCallback((field: DetailAccordionKey) => {
    setExpandedDetailField((prev) => (prev === field ? null : field));
  }, []);

  const getCollapsedPreview = useCallback((content: string) => {
    const normalized = content.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return "";
    }
    return normalized.length > 30 ? `${normalized.slice(0, 30)}…` : normalized;
  }, []);

  const detailAccordionItems: DetailAccordionItem[] = [
    {
      key: "appearance",
      icon: User,
      label: "👤 外貌描述",
      hint: "种族选择可能会提供默认值",
      placeholder: "描述角色的外貌、穿着、装备…",
      value: characterAppearance,
      onChange: (value) => setCharacterAppearance(value),
    },
    {
      key: "personality",
      icon: Sparkles,
      label: "✨ 性格特征",
      hint: "背景选择可能会提供默认值",
      placeholder: "勇敢、谨慎、幽默、冷静…",
      value: characterPersonality,
      onChange: (value) => setCharacterPersonality(value),
    },
    {
      key: "story",
      icon: BookOpen,
      label: "📖 背景故事",
      hint: "背景选择可能会提供默认值",
      placeholder: "描述角色的背景故事、经历、身份…",
      value: characterDescription,
      onChange: (value) => setCharacterDescription(value),
    },
  ];

  return (
    <div className="p-4 px-4 md:p-8 md:px-6 max-w-lg mx-auto">
      {/* 角色输入区域 */}
      <div
        className="p-6 rounded-lg space-y-4"
        style={{
          background: colorAlpha("primary", 0.05),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
          borderRadius: borders.radius.lg,
        }}
      >
        {/* 角色名称输入 - 始终可见 */}
        <motion.div
          className="space-y-2"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <label
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: color("textSecondary") }}
          >
            <User className="w-4 h-4" />
            角色名称
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={characterName}
                onChange={(e) => {
                  setCharacterName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="输入角色名称..."
                maxLength={20}
                className="w-full"
                autoFocus
              />
              {/* 输入时底部渐变装饰线 */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${colorAlpha(
                    "primary",
                    0.6,
                  )}, ${colorAlpha("secondary", 0.6)})`,
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: hasNameInput ? 1 : 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRandomName}
              title="随机生成"
              className="shrink-0"
            >
              <Dices className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs" style={{ color: color("textMuted") }}>
            角色名称将在游戏中代表你
          </p>
        </motion.div>

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

        {/* 可折叠面板 - 展开/收起详细描述 */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <button
            type="button"
            onClick={() => setDetailsExpanded((prev) => !prev)}
            className="flex items-center gap-2 w-full text-sm font-medium py-2 cursor-pointer transition-colors"
            style={{ color: color("textSecondary") }}
          >
            {detailsExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {detailsExpanded ? "收起详细描述" : "展开详细描述"}
            <span
              className="text-xs font-normal ml-1"
              style={{ color: color("textMuted") }}
            >
              (可选)
            </span>
          </button>

          <AnimatePresence initial={false}>
            {detailsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                  opacity: { duration: 0.2 },
                }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2">
                  {detailAccordionItems.map((item) => {
                    const isExpanded = expandedDetailField === item.key;
                    const preview = getCollapsedPreview(item.value);
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.key}
                        className="rounded-lg overflow-hidden"
                        style={{
                          background: colorAlpha(
                            "bgCard",
                            isExpanded ? 0.45 : 0.2,
                          ),
                          border: `1px solid ${colorAlpha(
                            "primary",
                            isExpanded ? 0.35 : 0.18,
                          )}`,
                          boxShadow: isExpanded
                            ? glow("primary", "sm", 0.2)
                            : "none",
                          transition:
                            "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleDetailField(item.key)}
                          className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left cursor-pointer"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon
                                className="w-4 h-4 shrink-0"
                                style={{ color: color("primary") }}
                              />
                              <span
                                className="text-sm font-medium"
                                style={{ color: color("textSecondary") }}
                              >
                                {item.label}
                              </span>
                            </div>
                            <p
                              className="text-xs mt-1 ml-6"
                              style={{ color: color("textMuted") }}
                            >
                              {item.hint}
                            </p>
                          </div>

                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="mt-0.5 shrink-0"
                            style={{ color: color("textMuted") }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.span>
                        </button>

                        {!isExpanded && preview && (
                          <p
                            className="px-3 pb-3 pl-9 text-xs truncate"
                            style={{ color: color("textMuted") }}
                            title={item.value.trim()}
                          >
                            {preview}
                          </p>
                        )}

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                height: {
                                  duration: 0.28,
                                  ease: [0.04, 0.62, 0.23, 0.98],
                                },
                                opacity: { duration: 0.2 },
                              }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3">
                                <Textarea
                                  value={item.value}
                                  onChange={(e) =>
                                    item.onChange(e.target.value)
                                  }
                                  placeholder={item.placeholder}
                                  maxLength={200}
                                  rows={3}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
