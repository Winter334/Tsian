/**
 * ActionInput - 联机模式行动输入组件
 *
 * 专用于联机模式的行动输入，支持：
 * - 提交行动
 * - 修改已提交的行动
 * - 撤回行动
 * - 显示行动状态
 * - 同步输入状态（正在输入...）
 *
 * 遵循架构规范：通过 CommandBus 修改状态
 *
 * ⚠️ 重要修复（2026-02-03）：
 * - 使用 useMyAction 从 TurnDoc 读取已提交状态
 * - 解决"第一次提交被重置"问题
 * - 确保提交状态与 TurnDoc 同步
 */

import { Check, Edit3, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HostControlButton } from "@/components/Multiplayer/HostControlButton";
import { TypingIndicator } from "@/components/Multiplayer/TypingIndicator";
import { BaseTextInput, type BaseTextInputRef } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks/use-command";
import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";

import {
  useActionAwareness,
  type ActionStatus,
} from "../hooks/useActionAwareness";
import { useMyAction } from "../hooks/useMyAction";
import { useTurnControl } from "../hooks/useTurnControl";
import { useRoomStore } from "../store";

// ===== 类型定义 =====

interface ActionInputProps {
  /** 房间 ID */
  roomId: string;
  /** 当前回合号 */
  turnNumber: number;
  /** 是否已锁定（超时或全员提交后） */
  isLocked?: boolean;
  /** 阶段配置 */
  config?: {
    /** 允许编辑已提交的行动 */
    allowEdit?: boolean;
    /** 允许撤回行动 */
    allowWithdraw?: boolean;
  };
  /** 自定义样式类 */
  className?: string;
}

// ===== 组件实现 =====

export function ActionInput({
  roomId,
  turnNumber,
  isLocked = false,
  config = { allowEdit: true, allowWithdraw: true },
  className,
}: ActionInputProps) {
  const dispatch = useCommand();
  const inputRef = useRef<BaseTextInputRef>(null);
  const localUser = useRoomStore((s) => s.localUser);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const connectionStatus = useRoomStore((s) => s.connectionStatus);
  const turnControl = useTurnControl(roomId);

  // ⚠️ 关键修复：从 TurnDoc 读取已提交状态
  // 这解决了"第一次提交被重置"的问题
  const myAction = useMyAction(roomId, turnNumber);

  // Awareness 状态管理（用于 typing indicator）
  const {
    localStatus,
    setLocalStatus,
    setTyping,
    setStatusAndTyping,
    playersStatus,
  } = useActionAwareness();

  // 本地内容状态（用于编辑）
  const [content, setContent] = useState("");
  // 使用 ref 跟踪是否正在编辑模式
  const [isEditing, setIsEditing] = useState(false);

  // 防抖定时器（用于 typing indicator）
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⚠️ 关键修复：实际状态优先从 TurnDoc 读取
  // 1. 如果已锁定（超时或全员提交），状态为 locked
  // 2. 如果 TurnDoc 中有已提交的行动，状态为 submitted
  // 3. 否则使用本地 Awareness 状态
  const effectiveStatus: ActionStatus = useMemo(() => {
    if (isLocked || myAction.isLocked) {
      return "locked";
    }
    if (myAction.isSubmitted && !isEditing) {
      return "submitted";
    }
    return localStatus;
  }, [
    isLocked,
    myAction.isLocked,
    myAction.isSubmitted,
    isEditing,
    localStatus,
  ]);

  // 已提交的内容（从 TurnDoc 读取）
  const submittedContent = myAction.content;

  // 是否可以编辑
  const canEdit = useMemo(() => {
    if (isLocked) return false;
    if (effectiveStatus === "locked") return false;
    if (effectiveStatus === "submitted" && !config.allowEdit) return false;
    return true;
  }, [isLocked, effectiveStatus, config.allowEdit]);

  // 是否可以撤回
  const canWithdraw = useMemo(() => {
    if (isLocked) return false;
    if (effectiveStatus !== "submitted") return false;
    if (!config.allowWithdraw) return false;
    return true;
  }, [isLocked, effectiveStatus, config.allowWithdraw]);

  // 根据状态获取占位文本
  const placeholder = useMemo(() => {
    switch (effectiveStatus) {
      case "locked":
        return "行动已锁定";
      case "submitted":
        return config.allowEdit ? "行动已提交，点击修改..." : "行动已提交";
      default:
        return "输入你的行动...";
    }
  }, [effectiveStatus, config.allowEdit]);

  // 内容变化处理（同步 typing indicator）
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // 更新状态
      if (effectiveStatus !== "submitted" && effectiveStatus !== "locked") {
        setLocalStatus(newContent.trim() ? "draft" : "empty");
      }

      // 设置 typing indicator（带防抖）
      setTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 2000);
    },
    [effectiveStatus, setLocalStatus, setTyping]
  );

  // 提交行动
  const handleSubmit = useCallback(
    (submittedText: string) => {
      if (!localUser.userId || !submittedText.trim()) return;

      // 清除 typing 防抖定时器
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      dispatch({
        type: RoomCommands.SUBMIT_ACTION,
        payload: {
          roomId,
          turnNumber,
          userId: localUser.userId,
          content: submittedText.trim(),
        },
      });

      // 退出编辑模式，同时设置状态和 typing（避免闭包问题）
      setIsEditing(false);
      setStatusAndTyping("submitted", false);
    },
    [dispatch, roomId, turnNumber, localUser.userId, setStatusAndTyping]
  );

  // 修改行动（进入编辑模式）
  const handleEdit = useCallback(() => {
    if (!canEdit || effectiveStatus !== "submitted") return;

    // 进入编辑模式
    setIsEditing(true);
    setContent(submittedContent);
    setLocalStatus("draft");
    inputRef.current?.focus();
  }, [canEdit, effectiveStatus, submittedContent, setLocalStatus]);

  // 撤回行动
  const handleWithdraw = useCallback(() => {
    if (!canWithdraw) return;

    // TODO: 实现撤回行动的 Command
    // 目前只是本地状态重置，需要添加 WITHDRAW_ACTION 命令
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setIsEditing(false);
    setContent("");
    setStatusAndTyping("empty", false);
    inputRef.current?.focus();
  }, [canWithdraw, setStatusAndTyping]);

  // Host 强制开始
  const handleForceStart = useCallback(async () => {
    const targetTurnNumber =
      turnNumber > 0 ? turnNumber : turnControl.turnNumber;
    if (!roomId || targetTurnNumber <= 0) return;

    await dispatch({
      type: RoomCommands.FORCE_START_TURN,
      payload: {
        roomId,
        turnNumber: targetTurnNumber,
      },
    });
  }, [dispatch, roomId, turnNumber, turnControl.turnNumber]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // ⚠️ 关键修复：当 TurnDoc 同步完成后，同步 Awareness 状态
  // 这确保 Awareness 状态与 TurnDoc 保持一致
  useEffect(() => {
    if (!myAction.loading && myAction.isSubmitted && !isEditing) {
      setLocalStatus("submitted");
    }
  }, [myAction.loading, myAction.isSubmitted, isEditing, setLocalStatus]);

  // 当回合号变化时，重置编辑状态和本地状态
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setIsEditing(false);
    setContent("");
    // 重置本地 Awareness 状态，确保新回合从空状态开始（同时清除 typing）
    setStatusAndTyping("empty", false);
  }, [turnNumber, setStatusAndTyping]);

  // typing 文案（仅显示他人，且仅在同步完成后展示）
  const typingNames = useMemo(() => {
    if (connectionStatus !== "synced") return [];
    if (isLocked || effectiveStatus === "locked") return [];

    return playersStatus
      .filter((player) => player.isTyping && player.userId !== localUser.userId)
      .map((player) => player.displayName)
      .filter((name) => name.trim().length > 0);
  }, [
    connectionStatus,
    isLocked,
    effectiveStatus,
    playersStatus,
    localUser.userId,
  ]);

  // Host 左侧控制按钮
  const canShowHostControl = useMemo(() => {
    const targetTurnNumber =
      turnNumber > 0 ? turnNumber : turnControl.turnNumber;

    return (
      !!currentRoom?.isHost && targetTurnNumber > 0 && !turnControl.isLocked
    );
  }, [
    currentRoom?.isHost,
    turnControl.isLocked,
    turnControl.turnNumber,
    turnNumber,
  ]);

  const unsubmittedPlayerNames = useMemo(() => {
    return turnControl.unsubmittedPlayers.map((player) => player.displayName);
  }, [turnControl.unsubmittedPlayers]);

  // 额外按钮（修改/撤回）
  const extraButtons = useMemo(() => {
    if (effectiveStatus !== "submitted") return null;

    return (
      <div className="flex gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={handleEdit}
            className={cn(
              "p-3",
              `transition-all duration-[${animation.duration.normal * 1000}ms]`,
              "hover:scale-105 active:scale-95"
            )}
            style={{
              background: colorAlpha("primary", 0.2),
              borderRadius: borders.radius.lg,
              color: color("primary"),
            }}
            title="修改行动"
          >
            <Edit3 className="w-5 h-5" />
          </button>
        )}
        {canWithdraw && (
          <button
            type="button"
            onClick={handleWithdraw}
            className={cn(
              "p-3",
              `transition-all duration-[${animation.duration.normal * 1000}ms]`,
              "hover:scale-105 active:scale-95"
            )}
            style={{
              background: colorAlpha("error", 0.2),
              borderRadius: borders.radius.lg,
              color: color("error"),
            }}
            title="撤回行动"
          >
            <Undo2 className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }, [effectiveStatus, canEdit, canWithdraw, handleEdit, handleWithdraw]);

  // 自定义提交按钮（已提交时显示勾选图标）
  const submitButton = useMemo(() => {
    if (effectiveStatus === "submitted" || effectiveStatus === "locked") {
      return (
        <div
          className="p-3.5 flex items-center justify-center"
          style={{
            background:
              effectiveStatus === "locked"
                ? colorAlpha("warning", 0.3)
                : colorAlpha("success", 0.3),
            borderRadius: borders.radius.lg,
          }}
        >
          <Check
            className="w-5 h-5"
            style={{
              color:
                effectiveStatus === "locked"
                  ? color("warning")
                  : color("success"),
            }}
          />
        </div>
      );
    }
    return undefined; // 使用默认的 Send 按钮
  }, [effectiveStatus]);

  return (
    <div className={cn("relative", className)}>
      {/* 正在输入提示 - 居中显示，与输入框对齐 */}
      <div className="mb-2 min-h-6 flex justify-center">
        <div className="w-full max-w-3xl px-4">
          <TypingIndicator names={typingNames} />
        </div>
      </div>

      <BaseTextInput
        className={cn("[&>div]:mx-auto")}
        ref={inputRef}
        onSubmit={handleSubmit}
        disabled={isLocked}
        readOnly={
          effectiveStatus === "submitted" || effectiveStatus === "locked"
        }
        placeholder={placeholder}
        value={effectiveStatus === "submitted" ? submittedContent : content}
        onValueChange={handleContentChange}
        leadingContent={
          canShowHostControl ? (
            <HostControlButton
              submittedCount={turnControl.submittedCount}
              totalPlayers={turnControl.totalPlayers}
              allSubmitted={turnControl.allSubmitted}
              unsubmittedPlayers={unsubmittedPlayerNames}
              disabled={turnControl.isLocked}
              onForceStart={handleForceStart}
              className="mb-0.5"
            />
          ) : undefined
        }
        extraButtons={extraButtons}
        submitButton={submitButton}
      />
    </div>
  );
}
