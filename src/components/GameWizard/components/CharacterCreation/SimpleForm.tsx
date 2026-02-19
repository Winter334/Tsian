/**
 * 简单版角色创建表单
 *
 * 在 WaitingLobby 中内嵌使用
 * 支持名称（必填）+ 描述/性格/外貌（可选）
 */

import { Button, Input, Textarea } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
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
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  UserPlus,
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
      const result = await dispatch<
        {
          roomId: string;
          name: string;
          userId: string;
          uniqueTag: string;
          description?: string;
          personality?: string;
          appearance?: string;
        },
        { characterId: string }
      >({
        type: RoomCommands.CREATE_CHARACTER,
        payload: {
          roomId,
          name: characterName.trim(),
          userId,
          uniqueTag,
          description: characterDescription.trim() || undefined,
          personality: characterPersonality.trim() || undefined,
          appearance: characterAppearance.trim() || undefined,
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
