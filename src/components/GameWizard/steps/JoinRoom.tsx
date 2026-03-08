/**
 * 步骤2b: 加入房间
 *
 * 输入房间码加入房间
 */

import { Button, Card, Input } from "@/components/ui";
import { getLastDisplayName, saveDisplayName } from "@/lib/user-identity";
import { useJoinRoom, useQueryRoom } from "@/modules/room/hooks";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { RoomCodeInput } from "../components/RoomCodeInput";
import type { StepProps } from "../types";

export function JoinRoom({ context, onNext, onBack }: StepProps) {
  const [playerName, setPlayerName] = useState(
    context.playerName || getLastDisplayName() || "",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { roomPreview, isQuerying, queryError, query, reset } = useQueryRoom();
  const { join, isJoining } = useJoinRoom();

  // 房间码输入处理
  const handleCodeChange = (value: string) => {
    setCode(value);
    setError(null);

    // 输入完成后自动查询
    if (value.length === 6) {
      query(value);
    } else {
      reset();
    }
  };

  // 加入房间
  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError("请输入你的名字");
      return;
    }

    if (!roomPreview) {
      setError("请先输入有效的房间码");
      return;
    }

    setError(null);
    saveDisplayName(playerName);

    const result = await join(code, playerName);

    if (result.success && result.data) {
      onNext({
        playerName,
        roomId: result.data.roomId,
        roomCode: code,
        worldConfig: result.data.worldConfig,
        stepData: {
          ...context.stepData,
          joinRoom: {
            roomId: result.data.roomId,
            roomCode: code,
          },
        },
      });
    } else {
      setError(result.error || "加入房间失败");
    }
  };

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* 玩家名称 */}
        <div>
          <label className="block text-sm font-medium mb-2">你的名字</label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="输入显示名称"
            maxLength={20}
          />
        </div>

        {/* 房间码输入 */}
        <div>
          <label className="block text-sm font-medium mb-2">房间码</label>
          <div className="flex justify-center">
            <RoomCodeInput
              value={code}
              onChange={handleCodeChange}
              disabled={isJoining}
            />
          </div>
        </div>

        {/* 查询状态 */}
        {isQuerying && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span>查询中...</span>
          </div>
        )}

        {/* 查询错误 */}
        {queryError && (
          <p className="text-sm text-destructive text-center">{queryError}</p>
        )}

        {/* 房间预览 - 使用 Card outlined 变体 */}
        {roomPreview && (
          <Card variant="outlined" hover={false} className="p-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{roomPreview.name}</p>
                  <p className="text-sm text-muted-foreground">
                    房主: {roomPreview.hostName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {roomPreview.memberCount}/{roomPreview.maxPlayers} 人
                  </p>
                  <p className="text-xs text-green-500">可加入</p>
                </div>
              </div>
            </motion.div>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          返回
        </Button>
        <Button
          onClick={handleJoin}
          disabled={!roomPreview || !playerName.trim() || isJoining}
        >
          {isJoining ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              加入中...
            </>
          ) : (
            <>
              加入房间
              <ArrowRight size={16} className="ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
