/**
 * 首次引导流程
 *
 * 步骤：
 * 1. 玩家身份设置（如果未初始化）
 * 2. AI 服务配置
 *
 * UI 增强：
 * - 使用 Panel 包裹内容卡片，添加星空背景
 * - 统一的视觉风格
 * - 使用统一入场动画
 */

import { Button, Input, Panel, ToggleCard } from "@/components/ui";
import { PROVIDER_PRESETS, aiManager, type ProviderType } from "@/lib/ai";
import { hasInitializedIdentity } from "@/lib/user-identity";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import {
  animation,
  borders,
  color,
  colorAlpha,
  createMultiLayerGridBackground,
  fadeVariants,
  glow,
  gradientText,
  gradients,
  overlayVariants,
  stepForwardVariants,
} from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PlayerIdentityStep } from "./PlayerIdentityStep";

/**
 * 引导步骤枚举
 */
type OnboardingStep = "identity" | "ai-config";

interface OnboardingProps {
  onComplete: () => void;
}

function getProfileAutoName(provider: ProviderType, model: string): string {
  const providerNames: Record<ProviderType, string> = {
    openai: "OpenAI",
    deepseek: "DeepSeek",
    gemini: "Gemini",
  };

  return `${providerNames[provider]} - ${model}`;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { setOnboardingComplete } = useSettingsStore();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(() => {
    // 如果已经有 uniqueTag，跳过身份设置步骤
    return hasInitializedIdentity() ? "ai-config" : "identity";
  });

  // 表单状态
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // 获取当前提供商预设
  const preset = PROVIDER_PRESETS.find((p) => p.id === provider);

  // 身份设置完成后进入 AI 配置步骤
  const handleIdentityComplete = useCallback(() => {
    setCurrentStep("ai-config");
  }, []);

  // 测试并继续
  const handleTestAndContinue = useCallback(async () => {
    if (!apiKey.trim()) return;

    setTesting(true);
    setTestResult(null);
    setTestError(null);

    const baseUrl = useProxy && proxyUrl ? proxyUrl : preset?.baseUrl || "";
    const model = preset?.defaultModel || "";

    try {
      const config = {
        provider,
        baseUrl,
        apiKey,
        model,
        advanced: {
          stream: true,
          temperature: 0.7,
          maxTokens: 4096,
          contextLength: 128000,
          topP: 1.0,
          frequencyPenalty: 0,
          presencePenalty: 0,
        },
      };

      const result = await aiManager.testConnection(config);

      if (result) {
        setTestResult(true);
        // 保存配置到默认 Profile（profiles[0]）
        const store = useSettingsStore.getState();
        const fallbackProfile = store.getProfileOrFallback();
        store.updateProfile(fallbackProfile.id, {
          name:
            fallbackProfile.name === "默认配置"
              ? getProfileAutoName(provider, model)
              : fallbackProfile.name,
          provider,
          baseUrl,
          apiKey,
          model,
        });
        store.saveSettings();

        setOnboardingComplete(true);
        // 延迟完成，让用户看到成功状态
        setTimeout(onComplete, 1000);
      } else {
        setTestResult(false);
        setTestError("连接失败，请检查配置");
      }
    } catch (error) {
      setTestResult(false);
      setTestError(error instanceof Error ? error.message : "连接失败");
    } finally {
      setTesting(false);
    }
  }, [
    apiKey,
    provider,
    useProxy,
    proxyUrl,
    preset,
    setOnboardingComplete,
    onComplete,
  ]);

  // 跳过引导
  const handleSkip = useCallback(() => {
    setOnboardingComplete(true);
    onComplete();
  }, [setOnboardingComplete, onComplete]);

  // 使用 Token 系统计算样式
  const titleGradientStyles = useMemo(() => {
    return gradientText(gradients.text());
  }, []);

  // 计算总步骤数和当前步骤索引（用于进度指示）
  const totalSteps = hasInitializedIdentity() ? 1 : 2;
  const currentStepIndex = currentStep === "identity" ? 1 : totalSteps;

  return (
    <motion.div
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: color("bgBase") }}
    >
      {/* 背景装饰 - 使用多层网格背景 */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          ...createMultiLayerGridBackground(0.1, 60, 0.04, 20),
        }}
      />

      {/* 内容卡片 - 使用 Panel（带透明星空背景） */}
      <div className="relative z-10 w-full mx-4">
        <Panel
          background="starfield"
          borderGlow={true}
          className="mx-auto sm:max-w-md max-sm:max-w-full"
          enterAnimation={true}
        >
          <div className="p-6">
            {/* 步骤指示器（多步骤时显示，使用统一淡入动画） */}
            {totalSteps > 1 && (
              <motion.div
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                className="flex justify-center gap-2 mb-6"
              >
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      background:
                        i + 1 <= currentStepIndex
                          ? color("primary")
                          : colorAlpha("primary", 0.3),
                      boxShadow:
                        i + 1 === currentStepIndex
                          ? glow("primary", "sm", 0.5)
                          : "none",
                    }}
                  />
                ))}
              </motion.div>
            )}

            {/* 步骤内容（使用统一步骤切换动画） */}
            <AnimatePresence mode="wait">
              {currentStep === "identity" ? (
                <motion.div
                  key="identity"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <PlayerIdentityStep onComplete={handleIdentityComplete} />
                </motion.div>
              ) : (
                <motion.div
                  key="ai-config"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {/* 标题 */}
                  <div className="text-center mb-8">
                    <motion.h1
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-2xl font-bold"
                      style={titleGradientStyles}
                    >
                      配置 AI 服务
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-2"
                      style={{ color: color("textMuted") }}
                    >
                      连接 AI 服务以开始游戏
                    </motion.p>
                  </div>

                  {/* 提供商选择 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-2 mb-6"
                  >
                    {PROVIDER_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={cn(
                          "flex-1 py-3 px-4 text-sm font-medium",
                          "border-2",
                          `transition-all duration-[${
                            animation.duration.fast * 1000
                          }ms]`,
                        )}
                        style={{
                          borderRadius: borders.radius.md,
                          borderColor:
                            provider === p.id
                              ? color("primaryLight")
                              : colorAlpha("primary", 0.25),
                          background:
                            provider === p.id
                              ? colorAlpha("primary", 0.2)
                              : "transparent",
                          color:
                            provider === p.id
                              ? color("textSecondary")
                              : color("primary"),
                          boxShadow:
                            provider === p.id
                              ? glow("primary", "md", 0.4)
                              : "none",
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </motion.div>

                  {/* API Key */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-2 mb-4"
                  >
                    <label
                      className="text-sm font-medium"
                      style={{ color: color("textSecondary") }}
                    >
                      API Key
                    </label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider === "gemini" ? "AIza..." : "sk-..."}
                    />
                  </motion.div>

                  {/* 反向代理开关 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mb-4"
                  >
                    <ToggleCard
                      checked={useProxy}
                      onCheckedChange={setUseProxy}
                      icon={<ArrowLeftRight className="w-5 h-5" />}
                      title="使用反向代理"
                      description="通过代理服务器转发 API 请求"
                    />
                  </motion.div>

                  {/* 代理地址 */}
                  <AnimatePresence>
                    {useProxy && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 mb-4 overflow-hidden"
                      >
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          代理地址
                        </label>
                        <Input
                          value={proxyUrl}
                          onChange={(e) => setProxyUrl(e.target.value)}
                          placeholder="https://your-proxy.com"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 测试结果 */}
                  <AnimatePresence>
                    {testResult !== null && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3 py-2 text-sm mb-4 border-2"
                        style={{
                          borderRadius: borders.radius.md,
                          background: testResult
                            ? colorAlpha("success", 0.15)
                            : colorAlpha("error", 0.15),
                          color: testResult ? color("success") : color("error"),
                          borderColor: testResult
                            ? colorAlpha("success", 0.4)
                            : colorAlpha("error", 0.4),
                        }}
                      >
                        {testResult
                          ? "✓ 连接成功"
                          : `✗ ${testError || "连接失败"}`}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 按钮 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="space-y-3"
                  >
                    <Button
                      className="w-full"
                      onClick={handleTestAndContinue}
                      disabled={
                        !apiKey.trim() || testing || testResult === true
                      }
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          测试中...
                        </>
                      ) : testResult === true ? (
                        "✓ 配置完成"
                      ) : (
                        "测试并继续 →"
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div
                          className="w-full"
                          style={{
                            borderTop: `2px solid ${colorAlpha(
                              "primary",
                              0.2,
                            )}`,
                          }}
                        />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span
                          className="px-2"
                          style={{
                            background: color("bgElevated"),
                            color: color("textMuted"),
                          }}
                        >
                          或
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handleSkip}
                      style={{ color: color("primary") }}
                    >
                      跳过，稍后配置
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>
      </div>
    </motion.div>
  );
}
