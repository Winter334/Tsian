import { CheckCircle2, Clock3, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { HostControlButton, MemberList } from "@/components/Multiplayer";
import { ConfirmDialog } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
import { useCommand } from "@/hooks/use-command";
import {
  useRoomInfo,
  useRoomMembers,
  useTurnActions,
  useTurnControl,
} from "@/modules/room/hooks";
import { useSessionStore } from "@/stores";
import { color, colorAlpha } from "@/styles/tokens";

const SUBMITTED_LABEL = "✅ 已提交";
const UNSUBMITTED_LABEL = "⏳ 未提交";

export function RightSidebarTeamTab() {
  const dispatch = useCommand();
  const localUserId = useSessionStore((s) => s.localUserId);
  const isHost = useSessionStore((s) => s.isHost);

  const { currentRoom } = useRoomInfo();
  const members = useRoomMembers();

  const turnControl = useTurnControl(currentRoom?.roomId ?? "");
  const turnActions = useTurnActions(
    currentRoom?.roomId ?? "",
    turnControl.turnNumber,
  );

  const [withdrawTarget, setWithdrawTarget] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);

  const actionMap = useMemo(() => {
    return new Map(
      turnActions.players.map((player) => [player.userId, player.isSubmitted]),
    );
  }, [turnActions.players]);

  const submittedCount =
    turnActions.totalPlayers > 0 ? turnActions.submittedCount : 0;
  const totalPlayers =
    turnActions.totalPlayers > 0 ? turnActions.totalPlayers : members.length;

  const unsubmittedPlayerNames = useMemo(() => {
    return members
      .filter((member) => !actionMap.get(member.userId))
      .map((member) => member.displayName);
  }, [members, actionMap]);

  const allSubmitted =
    totalPlayers > 0 &&
    submittedCount >= totalPlayers &&
    turnControl.turnNumber > 0;

  const handleForceStart = useCallback(async () => {
    const targetTurnNumber = turnControl.turnNumber;
    if (!currentRoom?.roomId || targetTurnNumber <= 0) {
      return;
    }

    await dispatch({
      type: RoomCommands.FORCE_START_TURN,
      payload: {
        roomId: currentRoom.roomId,
        turnNumber: targetTurnNumber,
      },
    });
  }, [currentRoom?.roomId, dispatch, turnControl.turnNumber]);

  const handleWithdrawDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setWithdrawTarget(null);
    }
  }, []);

  const handleOpenWithdrawConfirm = useCallback(
    (userId: string, displayName: string) => {
      setWithdrawTarget({ userId, displayName });
    },
    [],
  );

  const handleConfirmWithdraw = useCallback(async () => {
    if (
      !withdrawTarget ||
      !currentRoom?.roomId ||
      turnControl.turnNumber <= 0 ||
      turnControl.isLocked ||
      !localUserId
    ) {
      return;
    }

    await dispatch({
      type: RoomCommands.WITHDRAW_ACTION,
      payload: {
        roomId: currentRoom.roomId,
        turnNumber: turnControl.turnNumber,
        userId: withdrawTarget.userId,
        operatorId: localUserId,
      },
    });
  }, [
    currentRoom?.roomId,
    dispatch,
    localUserId,
    turnControl.isLocked,
    turnControl.turnNumber,
    withdrawTarget,
  ]);

  const canShowHostControl =
    isHost && turnControl.turnNumber > 0 && !turnControl.isLocked;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <h2
            className="text-sm font-bold tracking-wider uppercase"
            style={{ color: color("textPrimary") }}
          >
            队伍协作
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: colorAlpha("textSecondary", 0.8) }}
          >
            成员在线状态与当前回合提交进度
          </p>
        </section>

        <section
          className="rounded-lg p-3"
          style={{
            background: colorAlpha("bgElevated", 0.45),
            border: `1px solid ${colorAlpha("primary", 0.18)}`,
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-xs font-medium"
              style={{ color: colorAlpha("textSecondary", 0.86) }}
            >
              成员状态
            </p>
            <p
              className="text-xs font-mono tabular-nums"
              style={{
                color:
                  turnControl.turnNumber > 0
                    ? colorAlpha("textSecondary", 0.82)
                    : colorAlpha("textSecondary", 0.6),
              }}
            >
              {turnControl.turnNumber > 0
                ? `回合 ${turnControl.turnNumber} · ${submittedCount}/${totalPlayers}`
                : `等待回合 · ${members.length} 人`}
            </p>
          </div>

          <MemberList
            members={members}
            localUserId={localUserId}
            renderExtra={(member) => {
              const isSubmitted = !!actionMap.get(member.userId);
              if (turnControl.turnNumber <= 0) {
                return (
                  <span
                    className="text-xs"
                    style={{ color: colorAlpha("textSecondary", 0.55) }}
                  >
                    等待回合
                  </span>
                );
              }

              if (isSubmitted) {
                const canHostWithdrawOtherAction =
                  isHost && member.userId !== localUserId;

                return (
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: color("success") }}
                      title={SUBMITTED_LABEL}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已提交
                    </span>

                    {canHostWithdrawOtherAction ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenWithdrawConfirm(
                            member.userId,
                            member.displayName,
                          )
                        }
                        disabled={turnControl.isLocked}
                        className="inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          color: turnControl.isLocked
                            ? colorAlpha("textSecondary", 0.6)
                            : color("warning"),
                          background: turnControl.isLocked
                            ? colorAlpha("bgElevated", 0.5)
                            : colorAlpha("warning", 0.16),
                          border: `1px solid ${
                            turnControl.isLocked
                              ? colorAlpha("textSecondary", 0.25)
                              : colorAlpha("warning", 0.38)
                          }`,
                        }}
                        title={
                          turnControl.isLocked
                            ? "回合已锁定，无法撤回行动"
                            : `撤回 ${member.displayName} 的行动`
                        }
                        aria-label={`撤回 ${member.displayName} 的行动`}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: color("warning") }}
                  title={UNSUBMITTED_LABEL}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  未提交
                </span>
              );
            }}
          />
        </section>
      </div>

      {canShowHostControl ? (
        <section
          className="shrink-0 border-t p-4"
          style={{ borderColor: colorAlpha("primary", 0.16) }}
        >
          <p
            className="mb-2 text-xs font-medium"
            style={{ color: colorAlpha("textSecondary", 0.86) }}
          >
            Host 控制区
          </p>
          <HostControlButton
            submittedCount={submittedCount}
            totalPlayers={totalPlayers}
            allSubmitted={allSubmitted}
            unsubmittedPlayers={unsubmittedPlayerNames}
            disabled={turnControl.isLocked}
            onForceStart={handleForceStart}
            className="w-full"
          />
        </section>
      ) : null}

      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={handleWithdrawDialogOpenChange}
        title="确认撤回行动"
        description={
          withdrawTarget
            ? `确定要撤回 ${withdrawTarget.displayName} 的行动吗？撤回后该玩家需要重新提交。`
            : undefined
        }
        confirmText="确认撤回"
        cancelText="取消"
        variant="destructive"
        onConfirm={() => {
          void handleConfirmWithdraw();
        }}
      />
    </div>
  );
}
