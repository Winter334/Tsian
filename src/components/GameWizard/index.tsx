/**
 * 游戏开始向导
 *
 * 全屏沉浸式布局，支持：
 * - 单人模式（多步角色创建）
 * - 创建房间
 * - 加入房间
 *
 * 扩展性设计：添加新步骤只需修改 config.ts
 * 方向感知的步骤切换动画
 */

import { useMotionTokens } from "@/hooks";
import { usePresetStore } from "@/lib/prompt/store";
import { getLastDisplayName } from "@/lib/user-identity";
import { cn } from "@/lib/utils";
import { resolveWorldConfig } from "@/lib/world/resolve-config";
import { createStepVariants } from "@/styles/motion-variants";
import { colorAlpha } from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StarfieldBackground } from "../effects/StarfieldBackground";
import { WizardFooter, WizardProgressBar } from "./components";
import { generateWizardSteps, getVisibleSteps, INITIAL_STEP } from "./config";
import type { WizardContext, WizardResult } from "./types";
import { createInitialContext } from "./types";

interface GameWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (result: WizardResult) => void;
  /** 初始步骤 ID（可选，默认为 mode-selection） */
  initialStep?: string;
  /** 初始上下文（可选，用于从特定状态开始） */
  initialContext?: Partial<WizardContext>;
}

export function GameWizard({
  open,
  onClose,
  onComplete,
  initialStep,
  initialContext,
}: GameWizardProps) {
  // 当前步骤 ID
  const [currentStepId, setCurrentStepId] = useState(
    initialStep || INITIAL_STEP,
  );

  // 导航方向（用于方向感知的步骤切换动画）
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // 向导上下文（使用工厂函数创建初始状态，合并传入的初始上下文）
  const [context, setContext] = useState<WizardContext>(() => ({
    ...createInitialContext(getLastDisplayName()),
    ...initialContext,
  }));

  // 当前步骤是否允许前进（默认允许，维度步骤会动态更新）
  const [stepValid, setStepValid] = useState(true);

  // 当 initialStep 或 initialContext 变化时，重置状态
  // 这确保了从外部传入新的初始状态时，向导能正确更新
  useEffect(() => {
    if (open) {
      if (initialStep) {
        setCurrentStepId(initialStep);
      }
      if (initialContext) {
        setContext((prev) => ({ ...prev, ...initialContext }));
      }
    }
  }, [open, initialStep, initialContext]);

  // 从活动预设读取 WorldConfig
  const activePreset = usePresetStore((s) => s.activePreset);
  const worldConfig = useMemo(
    () => resolveWorldConfig(activePreset),
    [activePreset],
  );
  const requiredAttributePoints = worldConfig.pointBuyRules?.bonusPoints ?? 10;

  // 将 worldConfig 注入到 context 中（供步骤组件读取）
  useEffect(() => {
    setContext((prev) => {
      if (prev.worldConfig === worldConfig) return prev;
      return { ...prev, worldConfig };
    });
  }, [worldConfig]);

  // 根据 WorldConfig 动态生成步骤配置
  const wizardSteps = useMemo(
    () => generateWizardSteps(worldConfig),
    [worldConfig],
  );

  // 将 Record 转换为 Map（getVisibleSteps 需要 Map 类型）
  const stepsMap = useMemo(
    () => new Map(Object.entries(wizardSteps)),
    [wizardSteps],
  );

  // 获取当前步骤配置
  const currentStep = useMemo(() => {
    return wizardSteps[currentStepId];
  }, [wizardSteps, currentStepId]);

  // 获取当前步骤组件
  const StepComponent = currentStep?.component;

  // 动画 tokens
  const motionTokens = useMotionTokens();

  // 方向感知的步骤切换 variants
  const stepVariants = useMemo(
    () => createStepVariants(motionTokens, direction),
    [motionTokens, direction],
  );

  // 可见步骤列表（用于进度指示器）
  const visibleSteps = useMemo(
    () => getVisibleSteps(stepsMap, context),
    [stepsMap, context],
  );

  // 当前步骤在可见步骤中的索引
  const currentStepIndex = useMemo(
    () => visibleSteps.findIndex((s) => s.id === currentStepId),
    [visibleSteps, currentStepId],
  );

  // 在步骤切换/数据变化时，重新评估当前步骤有效性
  useEffect(() => {
    if (currentStepId.startsWith("solo-dim-")) {
      const dimensionId = currentStepId.replace("solo-dim-", "");
      setStepValid(Boolean(context.dimensionSelections?.[dimensionId]));
      return;
    }

    if (currentStepId === "solo-char-attributes") {
      const totalAllocated = Object.values(
        context.allocatedPoints ?? {},
      ).reduce((sum, value) => sum + value, 0);
      setStepValid(totalAllocated === requiredAttributePoints);
      return;
    }

    setStepValid(true);
  }, [
    currentStepId,
    context.dimensionSelections,
    context.allocatedPoints,
    requiredAttributePoints,
  ]);

  // 前进到下一步
  const handleNext = useCallback(
    (updates?: Partial<WizardContext>) => {
      const newContext = { ...context, ...updates };
      setContext(newContext);

      const nextStepId = currentStep.getNextStep(newContext);

      if (nextStepId) {
        // 有下一步，跳转
        setDirection("forward");
        setCurrentStepId(nextStepId);
      } else {
        // 没有下一步，完成向导
        const result: WizardResult = {
          mode: newContext.mode!,
          saveId: newContext.saveId,
          roomId: newContext.roomId,
          roomCode: newContext.roomCode,
          characterId: newContext.characterId,
          characterName: newContext.characterName,
          characterDescription: newContext.characterDescription,
          characterPersonality: newContext.characterPersonality,
          characterAppearance: newContext.characterAppearance,
          characterAge: newContext.characterAge,
          characterGender: newContext.characterGender,
          avatarUrl: newContext.avatarUrl,
          portraitFile: newContext.portraitFile,
          dimensionSelections: newContext.dimensionSelections,
          talentIds: newContext.talentIds,
          attributes: newContext.attributes,
        };
        onComplete(result);
      }
    },
    [context, currentStep, onComplete],
  );

  // 返回上一步
  const handleBack = useCallback(() => {
    const prevStepId = currentStep.getPrevStep(context);

    if (prevStepId) {
      setDirection("backward");

      // 回到模式选择页时清空 mode，避免进度条仍展开为已选模式的完整流程
      if (prevStepId === "mode-selection") {
        setContext((prev) => ({ ...prev, mode: undefined }));
      }

      setCurrentStepId(prevStepId);
    } else {
      // 没有上一步，关闭向导
      onClose();
    }
  }, [context, currentStep, onClose]);

  // 仅更新上下文数据，不触发步骤切换
  const handleUpdateContext = useCallback((updates: Partial<WizardContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  // 子步骤主动上报有效性（主要用于维度选择步骤）
  const handleValidationChange = useCallback((isValid: boolean) => {
    setStepValid(isValid);
  }, []);

  // 直接完成（用于单人模式等场景）
  const handleComplete = useCallback(
    (result: WizardContext) => {
      onComplete({
        mode: result.mode!,
        saveId: result.saveId,
        roomId: result.roomId,
        roomCode: result.roomCode,
        characterId: result.characterId,
        characterName: result.characterName,
        characterDescription: result.characterDescription,
        characterPersonality: result.characterPersonality,
        characterAppearance: result.characterAppearance,
        characterAge: result.characterAge,
        characterGender: result.characterGender,
        avatarUrl: result.avatarUrl,
        portraitFile: result.portraitFile,
        dimensionSelections: result.dimensionSelections,
        talentIds: result.talentIds,
        attributes: result.attributes,
      });
    },
    [onComplete],
  );

  if (!StepComponent) {
    return null;
  }

  // 导航状态计算
  const canGoBack = currentStep.getPrevStep(context) !== null;
  const isLastStep = currentStep.getNextStep(context) === null;
  const requiresStepValidation =
    currentStepId.startsWith("solo-dim-") ||
    currentStepId === "solo-char-attributes";
  const canGoNext = requiresStepValidation ? stepValid : true;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionTokens.duration.slow }}
        >
          {/* 背景层 */}
          <div className="absolute inset-0">
            {/* 深色背景 */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: colorAlpha("bgBase", 0.97),
              }}
            />
            {/* 星空效果 */}
            <StarfieldBackground transparentBackground useThemeColors />
          </div>

          <div className="relative z-10 flex h-full w-full flex-col md:flex-row">
            {/* 左侧竖版进度条 */}
            {visibleSteps.length > 0 && (
              <aside
                className={cn(
                  "shrink-0",
                  // 移动端：横向顶部
                  "flex items-center justify-center px-4 py-3",
                  "border-b border-white/5",
                  // 桌面端：纵向左侧
                  "md:w-38 md:self-stretch md:border-b-0 md:px-3 md:py-8",
                )}
              >
                <WizardProgressBar
                  steps={visibleSteps}
                  currentIndex={currentStepIndex}
                />
              </aside>
            )}

            {/* 右侧步骤内容 + 底部操作栏 */}
            <div className="flex min-w-0 min-h-0 flex-1 flex-col">
              <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="flex min-h-full items-start justify-center md:items-center">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentStepId}
                      className="w-full"
                      variants={stepVariants}
                      custom={direction}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <div className="w-full px-1 py-4 md:px-6 md:py-8 lg:px-8">
                        <StepComponent
                          context={context}
                          onNext={handleNext}
                          onBack={handleBack}
                          onComplete={handleComplete}
                          onUpdateContext={handleUpdateContext}
                          onValidationChange={handleValidationChange}
                          direction={direction}
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* 底部操作栏 - 根据 hideFooter 配置条件渲染 */}
              {!currentStep.hideFooter && (
                <div className="shrink-0">
                  <WizardFooter
                    onBack={handleBack}
                    onNext={() => handleNext()}
                    canGoBack={canGoBack}
                    canGoNext={canGoNext}
                    nextLabel={currentStep.nextLabel}
                    isLastStep={isLastStep}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 导出类型
export type { GameMode, WizardResult } from "./types";
