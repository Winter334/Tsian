/**
 * 步骤1: 模式选择
 *
 * 选择游戏模式：单人模式、创建房间、加入房间
 * 使用 Card variant="elevated" + 交错入场动画 + 装饰性分隔线
 */

import { Button, Card } from "@/components/ui";
import { useMotionTokens } from "@/hooks";
import { createStaggerVariants } from "@/styles/motion-variants";
import { colorAlpha, gradientText, gradients } from "@/styles/tokens";
import { motion } from "framer-motion";
import { ArrowLeft, Link, User, Users } from "lucide-react";
import { GradientDivider } from "../components";
import type { GameMode, StepProps } from "../types";
import { GAME_MODES } from "../types";

// 图标映射（移动端紧凑，桌面端保持大图标）
const ICONS: Record<string, React.ReactNode> = {
  User: <User className="h-9 w-9 md:h-12 md:w-12" />,
  Users: <Users className="h-9 w-9 md:h-12 md:w-12" />,
  Link: <Link className="h-9 w-9 md:h-12 md:w-12" />,
};

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

/**
 * 模式选择卡片
 * 使用 Card variant="elevated" 实现增强效果
 * 交互动画：悬停时图标微旋转+放大，文字变亮
 */
function ModeCard({ icon, title, description, onClick }: ModeCardProps) {
  const motionConfig = useMotionTokens();

  return (
    <Card
      variant="elevated"
      hover={true}
      glowOnHover={true}
      onClick={onClick}
      className="p-5 text-center md:p-8"
    >
      {/* 图标容器 - 带微光效果和悬停动画 */}
      <motion.div
        className="text-primary mb-3 flex justify-center md:mb-4"
        style={{
          filter: `drop-shadow(0 0 8px ${colorAlpha("primary", 0.4)})`,
        }}
        whileHover={{
          rotate: 5,
          scale: 1.1,
          transition: { duration: motionConfig.duration.normal },
        }}
      >
        {icon}
      </motion.div>

      {/* 装饰性渐变分隔线 */}
      <GradientDivider className="my-3 md:my-4" />

      {/* 标题 - 渐变文字效果 */}
      <h3
        className="mb-1.5 text-base font-semibold md:mb-2"
        style={gradientText(gradients.text())}
      >
        {title}
      </h3>
      <p className="text-xs text-muted-foreground md:text-sm">{description}</p>
    </Card>
  );
}

export function ModeSelection({ onNext, onBack }: StepProps) {
  const motionConfig = useMotionTokens();

  // 交错入场 variants：间隔 staggerBase * 2，从底部弹入
  const cardVariants = createStaggerVariants(
    { ...motionConfig, staggerBase: motionConfig.staggerBase * 2 },
    "y",
    0.1,
  );

  const handleSelect = (mode: GameMode) => {
    // 所有模式都进入下一步（由 config.ts 决定具体流程）
    onNext({ mode });
  };

  const modes = Object.entries(GAME_MODES) as [
    GameMode,
    (typeof GAME_MODES)[GameMode],
  ][];

  return (
    <div className="px-3 py-3 md:px-6 md:py-8">
      {/* 响应式布局：手机单列，桌面三列，移动端更紧凑 */}
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:gap-6">
        {modes.map(([mode, config], index) => (
          <motion.div
            key={mode}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            custom={index}
          >
            <ModeCard
              icon={
                ICONS[config.icon] || (
                  <User className="h-9 w-9 md:h-12 md:w-12" />
                )
              }
              title={config.label}
              description={config.description}
              onClick={() => handleSelect(mode)}
            />
          </motion.div>
        ))}
      </div>

      {/* 返回按钮 */}
      <div className="mt-5 flex justify-center md:mt-8">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} />
          返回标题
        </Button>
      </div>
    </div>
  );
}
