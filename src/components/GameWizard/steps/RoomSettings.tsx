/**
 * 步骤2a: 房间设置（创建房间）
 *
 * 设置房间名称、最大人数、回合时长等
 * 使用赛博朋克风格的 PlayerCountSelector 和 TimeSlider 组件
 */

import { Button, Card, Input, PlayerCountSelector } from "@/components/ui";
import {
  generateDefaultDisplayName,
  getLastDisplayName,
  saveDisplayName,
} from "@/lib/user-identity";
import { useCreateRoom } from "@/modules/room/hooks";
import { colorAlpha } from "@/styles/tokens";
import type { Easing } from "framer-motion";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Home, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { RoomPreview, TimeSlider } from "../components";
import type { RoomConfig, StepProps } from "../types";

// 表单项入场动画
const easeOut: Easing = [0.0, 0.0, 0.2, 1.0]; // cubic-bezier for easeOut

const formItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
      ease: easeOut,
    },
  }),
};

export function RoomSettings({ context, onNext, onBack }: StepProps) {
  // 自动获取玩家名称，如果没有则生成默认名
  const playerName = useMemo(() => {
    return (
      context.playerName || getLastDisplayName() || generateDefaultDisplayName()
    );
  }, [context.playerName]);

  const [config, setConfig] = useState<RoomConfig>({
    name: "新房间",
    maxPlayers: 4,
    turnDuration: 5,
  });
  const [error, setError] = useState<string | null>(null);

  const { create, isCreating } = useCreateRoom();

  const handleCreate = async () => {
    setError(null);

    // 保存显示名
    saveDisplayName(playerName);

    // 创建房间
    if (!context.worldId) {
      setError("当前未选择世界");
      return;
    }

    const result = await create({
      name: config.name,
      hostDisplayName: playerName,
      worldId: context.worldId,
      maxPlayers: config.maxPlayers,
      turnDuration: config.turnDuration,
    });

    if (result.success && result.data) {
      onNext({
        playerName,
        worldId: context.worldId,
        roomId: result.data.roomId,
        roomCode: result.data.code,
        stepData: {
          ...context.stepData,
          roomSettings: {
            roomId: result.data.roomId,
            roomCode: result.data.code,
            roomName: config.name,
            maxPlayers: config.maxPlayers,
            turnDuration: config.turnDuration,
          },
        },
      });
    } else {
      setError(result.error || "创建房间失败");
    }
  };

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* 房间名称 */}
        <motion.div
          custom={0}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <Card variant="outlined" hover={false} className="p-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Home size={16} style={{ color: colorAlpha("primary", 0.9) }} />
              房间名称
            </label>
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="给房间起个名字"
              maxLength={30}
            />
          </Card>
        </motion.div>

        {/* 最大人数 - 使用 PlayerCountSelector */}
        <motion.div
          custom={1}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <Card variant="outlined" hover={false} className="p-4">
            <PlayerCountSelector
              value={config.maxPlayers}
              onChange={(v) => setConfig({ ...config, maxPlayers: v })}
            />
          </Card>
        </motion.div>

        {/* 回合时长 - 使用 TimeSlider */}
        <motion.div
          custom={2}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <Card variant="outlined" hover={false} className="p-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Clock size={16} style={{ color: colorAlpha("primary", 0.9) }} />
              回合时长: {config.turnDuration} 分钟
            </label>
            <TimeSlider
              value={config.turnDuration}
              onChange={(v) => setConfig({ ...config, turnDuration: v })}
              min={1}
              max={30}
              step={1}
            />
          </Card>
        </motion.div>

        {/* 房间预览 */}
        <motion.div
          custom={3}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            📋 房间预览
          </label>
          <RoomPreview
            roomName={config.name}
            maxPlayers={config.maxPlayers}
            turnDuration={config.turnDuration}
          />
        </motion.div>

        {/* 错误提示 */}
        {error && (
          <motion.p
            className="text-sm text-destructive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* 操作按钮 */}
      <motion.div
        className="flex justify-between mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} className="mr-2" />
          返回
        </Button>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              创建中...
            </>
          ) : (
            <>
              创建房间
              <ArrowRight size={16} className="ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}
