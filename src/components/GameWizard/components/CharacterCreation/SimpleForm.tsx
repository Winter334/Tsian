/**
 * 简单版角色创建表单
 *
 * 在 WaitingLobby 中内嵌使用
 * 支持名称（必填）+ 描述/性格/外貌（可选）
 */

import { Button, Input, Textarea } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
import type { CharacterCreationData } from "@/domain/entities/character";
import { useCommand } from "@/hooks";
import {
  generateDefaultDisplayName,
  getCurrentIdentity,
  getOrCreateUserId,
  getUniqueTag,
} from "@/lib/user-identity";
import { cn } from "@/lib/utils";
import { borders, color, colorAlpha, glow } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SimpleFormProps {
  /** 房间 ID */
  roomId: string;
  /** 当前用户是否已有角色 */
  hasCharacter: boolean;
  /** 当前角色 ID（如果有） */
  currentCharacterId?: string;
  /** 当前角色名称（如果有） */
  currentCharacterName?: string;
  /** 角色创建/更新成功回调 */
  onSuccess?: (characterId: string) => void;
  /** 是否禁用（如游戏已开始） */
  disabled?: boolean;
}

const GENDER_OPTIONS = ["男", "女", "其他"] as const;

function parseOptionalAge(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export function SimpleForm({
  roomId,
  hasCharacter,
  currentCharacterId,
  currentCharacterName,
  onSuccess,
  disabled = false,
}: SimpleFormProps) {
  const dispatch = useCommand();
  const [characterName, setCharacterName] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");
  const [characterPersonality, setCharacterPersonality] = useState("");
  const [characterAppearance, setCharacterAppearance] = useState("");
  const [characterAgeInput, setCharacterAgeInput] = useState("");
  const [characterGender, setCharacterGender] = useState<string | undefined>(
    undefined,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 获取用户身份信息
  const identity = useMemo(() => getCurrentIdentity(), []);
  const userId = useMemo(() => getOrCreateUserId(), []);
  const uniqueTag = useMemo(() => getUniqueTag() || "", []);

  // 初始化角色名称
  useEffect(() => {
    if (hasCharacter && currentCharacterName) {
      setCharacterName(currentCharacterName);
    } else if (!characterName) {
      // 使用显示名称作为默认角色名
      setCharacterName(identity.displayName || generateDefaultDisplayName());
    }
  }, [hasCharacter, currentCharacterName, identity.displayName, characterName]);

  // 随机生成角色名
  const handleRandomName = useCallback(() => {
    const newName = generateDefaultDisplayName();
    setCharacterName(newName);
    setError(null);
  }, []);

  // 创建角色
  const handleCreate = useCallback(async () => {
    if (!characterName.trim()) {
      setError("请输入角色名称");
      return;
    }

    if (!uniqueTag) {
      setError("请先完成身份设置");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedAge = parseOptionalAge(characterAgeInput);
      const normalizedGender = characterGender || undefined;

      const result = await dispatch<
        {
          roomId: string;
          userId: string;
          uniqueTag: string;
          characterData: CharacterCreationData;
        },
        { characterId: string }
      >({
        type: RoomCommands.CREATE_CHARACTER,
        payload: {
          roomId,
          userId,
          uniqueTag,
          characterData: {
            name: characterName.trim(),
            description: characterDescription.trim() || undefined,
            personality: characterPersonality.trim() || undefined,
            appearance: characterAppearance.trim() || undefined,
            age: normalizedAge,
            gender: normalizedGender,
          },
        },
      });

      if (result.success && result.data) {
        onSuccess?.(result.data.characterId);
      } else {
        setError(result.error || "创建角色失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建角色失败");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    characterName,
    characterDescription,
    characterPersonality,
    characterAppearance,
    characterAgeInput,
    characterGender,
    roomId,
    userId,
    uniqueTag,
    dispatch,
    onSuccess,
  ]);

  // 更新角色（如果已有角色）
  const handleUpdate = useCallback(async () => {
    if (!characterName.trim()) {
      setError("请输入角色名称");
      return;
    }

    if (!currentCharacterId) {
      setError("角色 ID 缺失，无法更新");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedAge = parseOptionalAge(characterAgeInput);
      const normalizedGender = characterGender || undefined;

      const result = await dispatch({
        type: RoomCommands.UPDATE_CHARACTER,
        payload: {
          roomId,
          characterId: currentCharacterId,
          userId,
          uniqueTag,
          updates: {
            name: characterName.trim(),
            description: characterDescription.trim() || undefined,
            personality: characterPersonality.trim() || undefined,
            appearance: characterAppearance.trim() || undefined,
            age: normalizedAge,
            gender: normalizedGender,
          },
        },
      });

      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error || "更新角色失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新角色失败");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    characterName,
    characterDescription,
    characterPersonality,
    characterAppearance,
    characterAgeInput,
    characterGender,
    roomId,
    currentCharacterId,
    userId,
    uniqueTag,
    dispatch,
  ]);

  // 如果已有角色且不在编辑模式，显示角色信息
  if (hasCharacter && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg"
        style={{
          background: colorAlpha("success", 0.1),
          border: `1px solid ${colorAlpha("success", 0.3)}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: colorAlpha("success", 0.2),
              }}
            >
              <Check className="w-5 h-5" style={{ color: color("success") }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: color("textMuted") }}>
                你的角色
              </p>
              <p
                className="font-medium"
                style={{
                  color: color("success"),
                  textShadow: glow("success", "sm", 0.3),
                }}
              >
                {currentCharacterName}
              </p>
            </div>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-xs"
            >
              修改
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // 创建/编辑表单
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg space-y-4"
      style={{
        background: colorAlpha("primary", 0.05),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        borderRadius: borders.radius.md,
      }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4" style={{ color: color("primary") }} />
        <span
          className="text-sm font-medium"
          style={{ color: color("textPrimary") }}
        >
          {hasCharacter ? "修改角色" : "创建角色"}
        </span>
      </div>

      {/* 角色名称输入 */}
      <div className="space-y-2">
        <label
          className="text-xs flex items-center gap-1"
          style={{ color: color("textMuted") }}
        >
          <User className="w-3 h-3" />
          角色名称
        </label>
        <div className="flex gap-2">
          <Input
            value={characterName}
            onChange={(e) => {
              setCharacterName(e.target.value);
              setError(null);
            }}
            placeholder="输入角色名称..."
            maxLength={20}
            disabled={isSubmitting || disabled}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRandomName}
            disabled={isSubmitting || disabled}
            title="随机生成"
            className="shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label
            className="text-xs flex items-center gap-1"
            style={{ color: color("textMuted") }}
          >
            <Users className="w-3 h-3" />
            性别
            <span className="opacity-60">(可选)</span>
          </label>
          <div className="flex gap-2">
            {GENDER_OPTIONS.map((option) => {
              const isSelected = characterGender === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setCharacterGender((prev) =>
                      prev === option ? undefined : option,
                    )
                  }
                  disabled={isSubmitting || disabled}
                  className="flex-1 rounded-md border px-2 py-1.5 text-xs transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: isSelected
                      ? color("primary")
                      : colorAlpha("primary", 0.2),
                    background: isSelected
                      ? colorAlpha("primary", 0.14)
                      : colorAlpha("bgCard", 0.2),
                    color: isSelected
                      ? color("textPrimary")
                      : color("textMuted"),
                    boxShadow: isSelected ? glow("primary", "sm", 0.2) : "none",
                  }}
                  aria-pressed={isSelected}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="text-xs flex items-center gap-1"
            style={{ color: color("textMuted") }}
          >
            <Calendar className="w-3 h-3" />
            年龄
            <span className="opacity-60">(可选)</span>
          </label>
          <Input
            type="number"
            min={0}
            max={999}
            inputMode="numeric"
            value={characterAgeInput}
            onChange={(e) => setCharacterAgeInput(e.target.value)}
            placeholder="可选"
            disabled={isSubmitting || disabled}
          />
        </div>
      </div>

      {/* 角色描述 */}
      <div className="space-y-1">
        <label
          className="text-xs flex items-center gap-1"
          style={{ color: color("textMuted") }}
        >
          <BookOpen className="w-3 h-3" />
          角色描述
          <span className="opacity-60">(可选)</span>
        </label>
        <Textarea
          value={characterDescription}
          onChange={(e) => setCharacterDescription(e.target.value)}
          placeholder="描述角色的背景故事、经历、身份…"
          maxLength={200}
          rows={2}
          disabled={isSubmitting || disabled}
        />
      </div>

      {/* 性格特征 */}
      <div className="space-y-1">
        <label
          className="text-xs flex items-center gap-1"
          style={{ color: color("textMuted") }}
        >
          <Sparkles className="w-3 h-3" />
          性格特征
          <span className="opacity-60">(可选)</span>
        </label>
        <Textarea
          value={characterPersonality}
          onChange={(e) => setCharacterPersonality(e.target.value)}
          placeholder="勇敢、谨慎、幽默、冷静…"
          maxLength={200}
          rows={2}
          disabled={isSubmitting || disabled}
        />
      </div>

      {/* 外貌描述 */}
      <div className="space-y-1">
        <label
          className="text-xs flex items-center gap-1"
          style={{ color: color("textMuted") }}
        >
          <User className="w-3 h-3" />
          外貌描述
          <span className="opacity-60">(可选)</span>
        </label>
        <Textarea
          value={characterAppearance}
          onChange={(e) => setCharacterAppearance(e.target.value)}
          placeholder="描述角色的外貌、穿着、装备…"
          maxLength={200}
          rows={2}
          disabled={isSubmitting || disabled}
        />
      </div>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs"
            style={{ color: color("error") }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(false);
              setCharacterName(currentCharacterName || "");
              setCharacterAgeInput("");
              setCharacterGender(undefined);
              setError(null);
            }}
            disabled={isSubmitting}
          >
            取消
          </Button>
        )}
        <Button
          className={cn("flex-1", isSubmitting && "pointer-events-none")}
          size="sm"
          onClick={hasCharacter ? handleUpdate : handleCreate}
          disabled={!characterName.trim() || isSubmitting || disabled}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {hasCharacter ? "更新中..." : "创建中..."}
            </>
          ) : (
            <>{hasCharacter ? "确认修改" : "创建角色"}</>
          )}
        </Button>
      </div>

      {/* 提示信息 */}
      <p className="text-xs" style={{ color: color("textMuted") }}>
        角色名称可以随时修改
      </p>
    </motion.div>
  );
}
