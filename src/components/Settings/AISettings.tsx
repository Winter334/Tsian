/**
 * AI 设置页面
 * Profile 列表 + 编辑面板布局
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Input,
  Panel,
  ScrollArea,
  Select,
  Slider,
  Toggle,
} from "@/components/ui";
import {
  aiManager,
  DEFAULT_ADVANCED_SETTINGS,
  PROVIDER_PRESETS,
  type AIConfig,
  type AIProfile,
  type ModelInfo,
  type ProviderType,
} from "@/lib/ai";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";

interface AISettingsProps {
  onBack: () => void;
}

function createFallbackProfile(): AIProfile {
  const now = Date.now();
  return {
    id: "",
    name: "新配置",
    provider: "openai",
    baseUrl: "https://api.openai.com",
    apiKey: "",
    model: "gpt-4o-mini",
    advanced: { ...DEFAULT_ADVANCED_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

function cloneProfile(profile: AIProfile): AIProfile {
  return {
    ...profile,
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      ...profile.advanced,
    },
  };
}

function toAIConfig(profile: AIProfile): AIConfig {
  return {
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      ...profile.advanced,
    },
  };
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function AISettings({ onBack }: AISettingsProps) {
  const {
    profiles,
    getProfileById,
    createProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
    saveSettings,
  } = useSettingsStore();

  const initialProfile = profiles[0] ?? createFallbackProfile();

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [formData, setFormData] = useState<AIProfile>(() =>
    cloneProfile(initialProfile),
  );

  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const canDeleteProfile = profiles.length > 1;

  useEffect(() => {
    if (profiles.length === 0) return;

    const hasSelectedProfile = profiles.some(
      (profile) => profile.id === selectedProfileId,
    );
    if (hasSelectedProfile) return;

    const fallbackId = profiles[0].id;
    if (fallbackId) {
      setSelectedProfileId(fallbackId);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (!selectedProfile) return;

    setFormData(cloneProfile(selectedProfile));
    setModels([]);
    setTestResult(null);
    setShowApiKey(false);
  }, [selectedProfile]);

  const handleProviderChange = useCallback((provider: string) => {
    const preset = PROVIDER_PRESETS.find((item) => item.id === provider);
    if (!preset) return;

    setFormData((prev) => ({
      ...prev,
      provider: provider as ProviderType,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
    }));
    setModels([]);
    setTestResult(null);
  }, []);

  const fetchModels = useCallback(async () => {
    if (!formData.apiKey || !formData.baseUrl) return;

    setLoadingModels(true);
    try {
      const modelList = await aiManager.fetchModels(toAIConfig(formData));
      setModels(modelList);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [formData]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await aiManager.testConnection(toAIConfig(formData));
      setTestResult(result);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  }, [formData]);

  const handleSave = useCallback(() => {
    if (!selectedProfileId) return;

    updateProfile(selectedProfileId, {
      name: formData.name.trim() || "未命名配置",
      provider: formData.provider,
      baseUrl: formData.baseUrl.trim(),
      apiKey: formData.apiKey.trim(),
      model: formData.model.trim(),
      advanced: {
        ...DEFAULT_ADVANCED_SETTINGS,
        ...formData.advanced,
      },
    });
    saveSettings();
    setTestResult(null);
  }, [formData, saveSettings, selectedProfileId, updateProfile]);

  const handleCancel = useCallback(() => {
    if (!selectedProfile) return;
    setFormData(cloneProfile(selectedProfile));
    setModels([]);
    setTestResult(null);
  }, [selectedProfile]);

  const handleCreateProfile = useCallback(() => {
    const newProfileId = createProfile({
      name: "新配置",
      provider: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      model: "gpt-4o-mini",
      advanced: { ...DEFAULT_ADVANCED_SETTINGS },
    });
    setSelectedProfileId(newProfileId);
    setShowAdvanced(false);
  }, [createProfile]);

  const handleDuplicateProfile = useCallback(
    (profileId: string) => {
      const duplicatedId = duplicateProfile(profileId);
      if (duplicatedId) {
        setSelectedProfileId(duplicatedId);
      }
    },
    [duplicateProfile],
  );

  const handleDeleteProfile = useCallback(
    (profileId: string) => {
      if (!canDeleteProfile) return;

      const target = getProfileById(profileId);
      if (!target) return;

      const shouldDelete = window.confirm(
        `确定删除 Profile「${target.name}」吗？此操作不可撤销。`,
      );
      if (!shouldDelete) return;

      const fallbackId = profiles.find(
        (profile) => profile.id !== profileId,
      )?.id;
      const deleted = deleteProfile(profileId);

      if (deleted && selectedProfileId === profileId && fallbackId) {
        setSelectedProfileId(fallbackId);
      }
    },
    [
      canDeleteProfile,
      deleteProfile,
      getProfileById,
      profiles,
      selectedProfileId,
      setSelectedProfileId,
    ],
  );

  const providerOptions = useMemo(
    () =>
      PROVIDER_PRESETS.map((preset) => ({
        value: preset.id,
        label: preset.name,
      })),
    [],
  );

  const providerNameMap = useMemo(
    () => new Map(PROVIDER_PRESETS.map((preset) => [preset.id, preset.name])),
    [],
  );

  const modelOptions =
    models.length > 0
      ? models.map((model) => ({
          value: model.id,
          label: model.name || model.id,
        }))
      : formData.model
        ? [{ value: formData.model, label: formData.model }]
        : [];

  return (
    <div className="space-y-4">
      {/* 返回按钮 */}
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          `transition-colors duration-[${animation.duration.fast * 1000}ms]`,
        )}
        style={{ color: color("textSecondary") }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = color("primary");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = color("textSecondary");
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-[16rem_minmax(0,1fr)] gap-4">
        {/* 左侧：Profile 列表 */}
        <Panel
          variant="outlined"
          background="none"
          borderGlow={false}
          className="p-3 overflow-visible"
        >
          <div className="space-y-3">
            <div
              className="text-sm font-semibold"
              style={{ color: color("textPrimary") }}
            >
              Profile 列表
            </div>

            <ScrollArea maxHeight="58vh" className="space-y-2 pr-2 pb-1">
              {profiles.map((profile) => {
                const isSelected = profile.id === selectedProfileId;
                const isHovered = hoveredProfileId === profile.id;
                const itemBorderColor = isSelected
                  ? colorAlpha("primary", 0.75)
                  : isHovered
                    ? colorAlpha("primary", 0.45)
                    : colorAlpha("primary", 0.25);
                const itemBackground = isSelected
                  ? colorAlpha("primary", 0.16)
                  : isHovered
                    ? colorAlpha("primary", 0.08)
                    : colorAlpha("bgElevated", 0.4);
                const itemBoxShadow =
                  isSelected || isHovered
                    ? `0 0 0 1px ${colorAlpha("primary", isSelected ? 0.3 : 0.18)}`
                    : "none";

                return (
                  <div key={profile.id} className="mb-2 last:mb-0">
                    <button
                      type="button"
                      className="w-full p-3 text-left border-2 rounded-lg transition-[background-color,border-color,box-shadow]"
                      style={{
                        borderColor: itemBorderColor,
                        background: itemBackground,
                        boxShadow: itemBoxShadow,
                      }}
                      onMouseEnter={() => setHoveredProfileId(profile.id)}
                      onMouseLeave={() =>
                        setHoveredProfileId((current) =>
                          current === profile.id ? null : current,
                        )
                      }
                      onClick={() => {
                        setSelectedProfileId(profile.id);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className="text-sm font-medium truncate"
                          style={{ color: color("textPrimary") }}
                        >
                          <span className="truncate">{profile.name}</span>
                        </div>
                      </div>
                      <p
                        className="text-xs mt-1 truncate"
                        style={{ color: color("textMuted") }}
                      >
                        {providerNameMap.get(profile.provider) ??
                          profile.provider}
                      </p>
                    </button>
                  </div>
                );
              })}
            </ScrollArea>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleCreateProfile}
            >
              <Plus className="w-4 h-4 mr-2" />
              新建 Profile
            </Button>
          </div>
        </Panel>

        {/* 右侧：Profile 编辑区 */}
        <Panel
          variant="outlined"
          background="none"
          borderGlow={false}
          className="p-4 overflow-x-hidden"
        >
          {selectedProfile ? (
            <ScrollArea maxHeight="62vh" className="pr-2 overflow-x-hidden">
              <div className="space-y-4 px-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="text-base font-semibold"
                    style={{ color: color("textPrimary") }}
                  >
                    Profile 编辑
                  </h3>
                </div>

                {/* Profile 名称 */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    Profile 名称
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="例如：GPT-4o 创作"
                  />
                </div>

                {/* 提供商 */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    提供商
                  </label>
                  <Select
                    value={formData.provider}
                    onValueChange={handleProviderChange}
                    options={providerOptions}
                  />
                </div>

                {/* API 地址 */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    API 地址
                  </label>
                  <Input
                    value={formData.baseUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        baseUrl: e.target.value,
                      }))
                    }
                    placeholder="https://api.openai.com"
                  />
                  <p className="text-xs" style={{ color: color("textMuted") }}>
                    提示：可填写反向代理地址
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    API Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={formData.apiKey}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          apiKey: e.target.value,
                        }))
                      }
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: color("textMuted") }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = color("textPrimary");
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = color("textMuted");
                      }}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 模型 */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: color("textSecondary") }}
                  >
                    模型
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={formData.model}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, model: value }))
                        }
                        options={modelOptions}
                        loading={loadingModels}
                        placeholder={loadingModels ? "加载中..." : "选择模型"}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={fetchModels}
                      disabled={!formData.apiKey || loadingModels}
                      className="shrink-0"
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4",
                          loadingModels && "animate-spin",
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* 测试连接 */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={testConnection}
                  disabled={!formData.apiKey || testing}
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      测试中...
                    </>
                  ) : (
                    <>
                      <Plug className="w-4 h-4 mr-2" />
                      测试连接
                    </>
                  )}
                </Button>

                {/* 测试结果 */}
                <AnimatePresence>
                  {testResult !== null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-3 py-2 text-sm border"
                      style={{
                        borderRadius: borders.radius.md,
                        background: testResult
                          ? colorAlpha("success", 0.2)
                          : colorAlpha("error", 0.2),
                        color: testResult ? color("success") : color("error"),
                        borderColor: testResult
                          ? colorAlpha("success", 0.3)
                          : colorAlpha("error", 0.3),
                      }}
                    >
                      {testResult ? "✓ 连接成功" : "✗ 连接失败，请检查配置"}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 高级设置折叠 */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    "flex items-center justify-between w-full py-2",
                    "text-sm font-medium pt-4",
                    `transition-colors duration-[${animation.duration.fast * 1000}ms]`,
                  )}
                  style={{
                    color: color("textSecondary"),
                    borderTop: `2px solid ${colorAlpha("primary", 0.2)}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = color("textPrimary");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = color("textSecondary");
                  }}
                >
                  <span>▼ 高级设置</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      showAdvanced && "rotate-180",
                    )}
                    style={{ color: color("primaryLight") }}
                  />
                </button>

                {/* 高级设置面板 */}
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      {/* 流式输出 */}
                      <div
                        className="flex items-center justify-between px-4 py-3 border-2 rounded-lg"
                        style={{
                          borderColor: colorAlpha("primary", 0.3),
                          background: colorAlpha("bgElevated", 0.35),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight
                            className="w-4 h-4"
                            style={{ color: color("primary") }}
                          />
                          <div>
                            <div
                              className="text-sm font-medium"
                              style={{ color: color("textPrimary") }}
                            >
                              流式输出
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: color("textMuted") }}
                            >
                              实时显示 AI 回复
                            </div>
                          </div>
                        </div>
                        <Toggle
                          checked={formData.advanced.stream}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: { ...prev.advanced, stream: checked },
                            }))
                          }
                        />
                      </div>

                      {/* 温度 */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          温度 (Temperature)
                        </label>
                        <Slider
                          value={formData.advanced.temperature}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: {
                                ...prev.advanced,
                                temperature: value,
                              },
                            }))
                          }
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>

                      {/* 最大输出 Token */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          最大输出 Token
                        </label>
                        <Input
                          type="number"
                          value={formData.advanced.maxTokens}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: {
                                ...prev.advanced,
                                maxTokens: parsePositiveInteger(
                                  e.target.value,
                                  prev.advanced.maxTokens,
                                ),
                              },
                            }))
                          }
                          min={1}
                        />
                      </div>

                      {/* 上下文长度 */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          上下文长度
                        </label>
                        <Input
                          type="number"
                          value={formData.advanced.contextLength}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: {
                                ...prev.advanced,
                                contextLength: parsePositiveInteger(
                                  e.target.value,
                                  prev.advanced.contextLength,
                                ),
                              },
                            }))
                          }
                          min={1}
                        />
                      </div>

                      {/* Top P */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          Top P
                        </label>
                        <Slider
                          value={formData.advanced.topP}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: { ...prev.advanced, topP: value },
                            }))
                          }
                          min={0}
                          max={1}
                          step={0.05}
                        />
                      </div>

                      {/* 频率惩罚 */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          频率惩罚 (Frequency Penalty)
                        </label>
                        <Slider
                          value={formData.advanced.frequencyPenalty}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: {
                                ...prev.advanced,
                                frequencyPenalty: value,
                              },
                            }))
                          }
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>

                      {/* 存在惩罚 */}
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: color("textSecondary") }}
                        >
                          存在惩罚 (Presence Penalty)
                        </label>
                        <Slider
                          value={formData.advanced.presencePenalty}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              advanced: {
                                ...prev.advanced,
                                presencePenalty: value,
                              },
                            }))
                          }
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 底部按钮 */}
                <div
                  className="grid grid-cols-2 gap-2 pt-4"
                  style={{
                    borderTop: `2px solid ${colorAlpha("primary", 0.2)}`,
                  }}
                >
                  <Button
                    variant="outline"
                    onClick={() => handleDuplicateProfile(selectedProfileId)}
                    disabled={!selectedProfileId}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制 Profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteProfile(selectedProfileId)}
                    disabled={!selectedProfileId || !canDeleteProfile}
                    style={{
                      color: canDeleteProfile
                        ? color("error")
                        : color("textMuted"),
                      borderColor: canDeleteProfile
                        ? colorAlpha("error", 0.45)
                        : colorAlpha("primary", 0.5),
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除 Profile
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    取消
                  </Button>
                  <Button onClick={handleSave}>保存</Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div
              className="py-10 text-center text-sm"
              style={{ color: color("textMuted") }}
            >
              暂无可编辑的 Profile
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
