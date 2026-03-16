import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";

import { Dialog, DialogContent } from "@/components/ui";
import { RoomCommands } from "@/domain/commands/room";
import type {
  CharacterCreationData,
  UpdateCharacterParams,
} from "@/domain/entities/character";
import { useCommand, useMotionTokens } from "@/hooks";
import { getOrCreateUserId, getUniqueTag } from "@/lib/user-identity";
import { getRuntimeWorldConfig } from "@/lib/world/resolve-config";
import type { CharacterDimension, WorldConfig } from "@/lib/world/types";

import { createStepVariants } from "@/styles/motion-variants";
import { colorAlpha } from "@/styles/tokens";
import {
  getCreationAttributeBudget,
  getManualTalentIds,
  getRemainingCreationAttributePoints,
} from "../../talent-point-budget";

import { WizardFooter, WizardProgressBar } from "../../components";
import {
  createDimensionStepComponent,
  SoloCharAttributesStep,
  SoloCharConfirmStep,
  SoloCharNameStep,
  SoloCharTalentsStep,
} from "../../steps";
import type { StepProps, WizardContext } from "../../types";

interface MultiplayerCharWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  existingCharacterId?: string;
  existingCharacterData?: Partial<WizardContext>;
}

interface WizardStepItem {
  id: string;
  label: string;
  component: ComponentType<StepProps>;
  requiresValidation?: boolean;
}

function mapContextToCharacterPayload(
  ctx: WizardContext,
): CharacterCreationData {
  return {
    name: ctx.characterName?.trim() || "",
    description: ctx.characterDescription?.trim() || undefined,
    personality: ctx.characterPersonality?.trim() || undefined,
    appearance: ctx.characterAppearance?.trim() || undefined,
    age: ctx.characterAge,
    gender: ctx.characterGender || undefined,
    dimensionSelections: ctx.dimensionSelections,
    talentIds: ctx.talentIds,
    attributes: ctx.attributes,
  };
}

function mapContextToCharacterUpdates(
  ctx: WizardContext,
): UpdateCharacterParams {
  return {
    name: ctx.characterName?.trim() || undefined,
    description: ctx.characterDescription?.trim() || undefined,
    personality: ctx.characterPersonality?.trim() || undefined,
    appearance: ctx.characterAppearance?.trim() || undefined,
    age: ctx.characterAge,
    gender: ctx.characterGender || undefined,
    dimensionSelections: ctx.dimensionSelections,
    talentIds: ctx.talentIds,
    attributes: ctx.attributes,
  };
}

function buildWizardSteps(worldConfig: WorldConfig): WizardStepItem[] {
  const steps: WizardStepItem[] = [
    {
      id: "solo-char-name",
      label: "角色信息",
      component: SoloCharNameStep,
      requiresValidation: true,
    },
  ];

  const dimensions: CharacterDimension[] = worldConfig.dimensions ?? [];
  for (const dimension of dimensions) {
    if (!dimension.options || dimension.options.length === 0) {
      continue;
    }

    steps.push({
      id: `solo-dim-${dimension.id}`,
      label: dimension.label,
      component: createDimensionStepComponent(dimension),
      requiresValidation: dimension.required !== false,
    });
  }

  if ((worldConfig.talents ?? []).length > 0) {
    steps.push({
      id: "solo-char-talents",
      label: "天赋选择",
      component: SoloCharTalentsStep,
      requiresValidation: true,
    });
  }

  const allocatableAttributes =
    worldConfig.pointBuyRules?.allocatableAttributes ?? [];
  if (allocatableAttributes.length > 0) {
    steps.push({
      id: "solo-char-attributes",
      label: "属性分配",
      component: SoloCharAttributesStep,
      requiresValidation: true,
    });
  }

  steps.push({
    id: "solo-char-confirm",
    label: "确认",
    component: SoloCharConfirmStep,
  });

  return steps;
}

function getDefaultStepValid(
  step: WizardStepItem | undefined,
  context: WizardContext,
): boolean {
  if (!step || !step.requiresValidation) {
    return true;
  }

  if (step.id === "solo-char-name") {
    return Boolean(context.characterName?.trim());
  }

  if (step.id.startsWith("solo-dim-")) {
    const dimensionId = step.id.replace("solo-dim-", "");
    return Boolean(context.dimensionSelections?.[dimensionId]);
  }

  if (step.id === "solo-char-attributes") {
    const worldConfig = context.worldConfig;
    if (!worldConfig) {
      return false;
    }

    const manualTalentIds = getManualTalentIds(
      worldConfig,
      context.dimensionSelections,
      context.talentIds,
    );

    return (
      getRemainingCreationAttributePoints(
        worldConfig,
        context.allocatedPoints,
        manualTalentIds.length,
      ) === 0 && getCreationAttributeBudget(worldConfig) > 0
    );
  }

  if (step.id === "solo-char-talents") {
    return Boolean(context.worldConfig);
  }

  return true;
}

export function MultiplayerCharWizardDialog({
  open,
  onOpenChange,
  roomId,
  existingCharacterId,
  existingCharacterData,
}: MultiplayerCharWizardDialogProps) {
  const dispatch = useCommand();
  const motionTokens = useMotionTokens();

  const [context, setContext] = useState<WizardContext>(() => ({
    stepData: {},
    worldConfig: getRuntimeWorldConfig(),
    ...existingCharacterData,
  }));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isStepValid, setIsStepValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const worldConfig = useMemo(
    () => context.worldConfig ?? getRuntimeWorldConfig(),
    [context.worldConfig],
  );

  const steps = useMemo(() => buildWizardSteps(worldConfig), [worldConfig]);

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep?.component;

  const stepVariants = useMemo(
    () => createStepVariants(motionTokens, direction),
    [motionTokens, direction],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const runtimeWorldConfig = getRuntimeWorldConfig();
    const nextContext: WizardContext = {
      stepData: {},
      worldConfig: runtimeWorldConfig,
      ...existingCharacterData,
    };

    setContext(nextContext);
    setCurrentStepIndex(0);
    setDirection("forward");
    setIsSubmitting(false);
    setIsStepValid(getDefaultStepValid(steps[0], nextContext));
  }, [open, existingCharacterData, steps]);

  useEffect(() => {
    const current = steps[currentStepIndex];
    setIsStepValid(() => {
      if (current?.requiresValidation) {
        return getDefaultStepValid(current, context);
      }
      return true;
    });
  }, [currentStepIndex, context, steps]);

  const updateContext = useCallback((updates: Partial<WizardContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateContext = useCallback(
    (updates: Partial<WizardContext>) => {
      updateContext(updates);
    },
    [updateContext],
  );

  const handleBack = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (currentStepIndex === 0) {
      onOpenChange(false);
      return;
    }

    setDirection("backward");
    setCurrentStepIndex((prev) => prev - 1);
  }, [currentStepIndex, isSubmitting, onOpenChange]);

  const submitCharacter = useCallback(async (): Promise<boolean> => {
    const userId = getOrCreateUserId();
    const uniqueTag = getUniqueTag() || "";
    if (!uniqueTag) {
      return false;
    }

    if (existingCharacterId) {
      const updates = mapContextToCharacterUpdates(context);
      const result = await dispatch({
        type: RoomCommands.UPDATE_CHARACTER,
        payload: {
          roomId,
          characterId: existingCharacterId,
          userId,
          uniqueTag,
          updates,
        },
      });
      return result.success;
    }

    const characterData = mapContextToCharacterPayload(context);
    const result = await dispatch({
      type: RoomCommands.CREATE_CHARACTER,
      payload: {
        roomId,
        userId,
        uniqueTag,
        characterData,
      },
    });
    return result.success;
  }, [context, dispatch, existingCharacterId, roomId]);

  const handleComplete = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const uniqueTag = getUniqueTag();
    if (!uniqueTag) {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await submitCharacter();
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onOpenChange, submitCharacter]);

  const handleNext = useCallback(
    async (updates?: Partial<WizardContext>) => {
      if (isSubmitting) {
        return;
      }

      if (updates) {
        updateContext(updates);
      }

      const isLast = currentStepIndex >= steps.length - 1;
      if (isLast) {
        await handleComplete();
        return;
      }

      setDirection("forward");
      setCurrentStepIndex((prev) => prev + 1);
    },
    [
      currentStepIndex,
      handleComplete,
      isSubmitting,
      steps.length,
      updateContext,
    ],
  );

  const handleValidationChange = useCallback((valid: boolean) => {
    setIsStepValid(valid);
  }, []);

  const canGoBack = currentStepIndex > 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const canGoNext = isSubmitting
    ? false
    : currentStep?.requiresValidation
      ? isStepValid
      : true;

  if (!StepComponent) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        unstyled
        className="fixed inset-0 z-50 px-0 translate-x-0 translate-y-0 left-0 top-0 max-w-none"
        style={{ width: "100vw", maxWidth: "100vw" }}
        animateLifecycle
        closeOnBackdropClick={!isSubmitting}
        showCloseButton={false}
      >
        <div
          className="relative z-10 flex h-dvh w-full"
          style={{ background: colorAlpha("bgBase", 0.96) }}
        >
          <div className="relative z-10 flex h-full w-full flex-col md:flex-row">
            {steps.length > 0 && (
              <aside className="shrink-0 flex items-center justify-center px-4 py-3 border-b border-white/5 md:w-38 md:self-stretch md:border-b-0 md:px-3 md:py-8">
                <WizardProgressBar
                  steps={steps}
                  currentIndex={currentStepIndex}
                />
              </aside>
            )}

            <div className="flex min-w-0 min-h-0 flex-1 flex-col">
              <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="flex min-h-full items-start justify-center md:items-center">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentStep.id}
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
                          onComplete={(_result) => {
                            void handleComplete();
                          }}
                          onUpdateContext={handleUpdateContext}
                          onValidationChange={handleValidationChange}
                          direction={direction}
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="shrink-0">
                <WizardFooter
                  onBack={handleBack}
                  onNext={() => {
                    void handleNext();
                  }}
                  canGoBack={canGoBack}
                  canGoNext={canGoNext}
                  nextLabel={
                    isLastStep
                      ? existingCharacterId
                        ? "保存角色"
                        : "创建角色"
                      : undefined
                  }
                  isLastStep={isLastStep}
                  backLabel={currentStepIndex === 0 ? "取消" : "上一步"}
                />
              </div>
            </div>
          </div>

          {isSubmitting && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: colorAlpha("bgBase", 0.35) }}
            >
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
