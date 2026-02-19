/**
 * Marker 配置面板组件
 *
 * 根据不同的 Marker 类型显示对应的配置选项
 * - chatHistory: 最大消息数、是否包含系统消息
 * - 其他类型暂无额外配置
 */

import { Input, Toggle } from "@/components/ui";
import type { PromptBlock } from "@/lib/prompt";
import { cn } from "@/lib/utils";
import { DEFAULT_MEMORY_CONFIG } from "@/modules/memory/memory-injector";
import { borders, color, colorAlpha } from "@/styles/tokens";

// ===== 类型定义 =====

export interface MarkerConfigPanelProps {
  /** Marker 类型 */
  markerType: PromptBlock["markerType"];
  /** 当前配置 */
  config: PromptBlock["markerConfig"];
  /** 配置变更回调 */
  onConfigChange: (config: PromptBlock["markerConfig"]) => void;
}

// ===== 组件 =====

/**
 * Marker 配置面板
 */
export function MarkerConfigPanel({
  markerType,
  config,
  onConfigChange,
}: MarkerConfigPanelProps) {
  // 根据 Marker 类型渲染不同的配置选项
  switch (markerType) {
    case "chatHistory":
      return (
        <ChatHistoryConfig config={config} onConfigChange={onConfigChange} />
      );
    case "memorySummary":
      return (
        <MemorySummaryConfig config={config} onConfigChange={onConfigChange} />
      );
    case "characterSheet":
    case "characterDescription":
    case "narrativeState":
    case "worldInfo":
    case "scenario":
    case "turnInfo":
    case "resultFrame":
    case "operationDefs":
      // 这些类型暂无额外配置
      return <NoConfigHint markerType={markerType} />;
    default:
      return null;
  }
}

// ===== 配置组件 =====

/**
 * 对话历史配置
 */
function ChatHistoryConfig({
  config,
  onConfigChange,
}: {
  config: PromptBlock["markerConfig"];
  onConfigChange: (config: PromptBlock["markerConfig"]) => void;
}) {
  const maxMessages = config?.maxMessages ?? 50;
  const includeSystemMessages = config?.includeSystemMessages ?? false;

  const handleMaxMessagesChange = (value: number) => {
    onConfigChange({
      ...config,
      maxMessages: Math.max(1, Math.min(200, value)),
    });
  };

  const handleIncludeSystemMessagesChange = (checked: boolean) => {
    onConfigChange({
      ...config,
      includeSystemMessages: checked,
    });
  };

  return (
    <ConfigContainer title="Marker 配置">
      {/* 最大消息数 */}
      <ConfigField label="最大消息数">
        <Input
          type="number"
          min={1}
          max={200}
          value={maxMessages}
          onChange={(e) =>
            handleMaxMessagesChange(parseInt(e.target.value) || 50)
          }
          className="w-32"
        />
      </ConfigField>

      {/* 是否包含系统消息 */}
      <ConfigField label="包含系统消息">
        <Toggle
          checked={includeSystemMessages}
          onCheckedChange={handleIncludeSystemMessagesChange}
        />
      </ConfigField>
    </ConfigContainer>
  );
}

function normalizeInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * 分段记忆配置
 */
function MemorySummaryConfig({
  config,
  onConfigChange,
}: {
  config: PromptBlock["markerConfig"];
  onConfigChange: (config: PromptBlock["markerConfig"]) => void;
}) {
  const recentNarrativeCount = normalizeInteger(
    config?.recentNarrativeCount,
    0,
    50,
    DEFAULT_MEMORY_CONFIG.recentNarrativeCount,
  );
  const miniSummaryCount = normalizeInteger(
    config?.miniSummaryCount,
    0,
    50,
    DEFAULT_MEMORY_CONFIG.miniSummaryCount,
  );
  const megaSummaryMode: "all" | "recent" =
    config?.megaSummaryMode === "recent" ? "recent" : "all";
  const megaSummaryLimit = normalizeInteger(
    config?.megaSummaryLimit,
    1,
    20,
    DEFAULT_MEMORY_CONFIG.megaSummaryLimit,
  );
  const compressionThreshold = normalizeInteger(
    config?.compressionThreshold,
    2,
    30,
    DEFAULT_MEMORY_CONFIG.compressionThreshold,
  );

  const handleRecentNarrativeCountChange = (value: number) => {
    onConfigChange({
      ...config,
      recentNarrativeCount: Math.max(0, Math.min(50, value)),
    });
  };

  const handleMiniSummaryCountChange = (value: number) => {
    onConfigChange({
      ...config,
      miniSummaryCount: Math.max(0, Math.min(50, value)),
    });
  };

  const handleMegaModeChange = (mode: "all" | "recent") => {
    onConfigChange({
      ...config,
      megaSummaryMode: mode,
      megaSummaryLimit:
        mode === "recent"
          ? Math.max(1, Math.min(20, megaSummaryLimit))
          : megaSummaryLimit,
    });
  };

  const handleMegaLimitChange = (value: number) => {
    onConfigChange({
      ...config,
      megaSummaryLimit: Math.max(1, Math.min(20, value)),
    });
  };

  const handleCompressionThresholdChange = (value: number) => {
    onConfigChange({
      ...config,
      compressionThreshold: Math.max(2, Math.min(30, value)),
    });
  };

  return (
    <ConfigContainer title="分段记忆配置">
      <div className="flex flex-col gap-3">
        <div
          className="text-xs font-medium tracking-wide"
          style={{ color: color("textSecondary") }}
        >
          ── 三级记忆 ──
        </div>

        <div className="flex flex-col gap-1">
          <ConfigField label="完整正文回合数">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={50}
                value={recentNarrativeCount}
                onChange={(e) =>
                  handleRecentNarrativeCountChange(
                    parseNumberInput(
                      e.target.value,
                      DEFAULT_MEMORY_CONFIG.recentNarrativeCount,
                    ),
                  )
                }
                className="w-20"
              />
              <span className="text-sm" style={{ color: color("textMuted") }}>
                回合
              </span>
            </div>
          </ConfigField>
          <p className="text-xs" style={{ color: color("textMuted") }}>
            最近 N 回合发送完整 AI 正文
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <ConfigField label="小总结数量">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={50}
                value={miniSummaryCount}
                onChange={(e) =>
                  handleMiniSummaryCountChange(
                    parseNumberInput(
                      e.target.value,
                      DEFAULT_MEMORY_CONFIG.miniSummaryCount,
                    ),
                  )
                }
                className="w-20"
              />
              <span className="text-sm" style={{ color: color("textMuted") }}>
                条
              </span>
            </div>
          </ConfigField>
          <p className="text-xs" style={{ color: color("textMuted") }}>
            在完整正文之后的 X 回合发送小总结
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <label
              className="text-sm"
              style={{ color: color("textSecondary") }}
            >
              大总结
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="mega-mode"
                  checked={megaSummaryMode === "all"}
                  onChange={() => handleMegaModeChange("all")}
                  style={{ accentColor: color("primary") }}
                />
                <span
                  className="text-sm"
                  style={{ color: color("textPrimary") }}
                >
                  全部发送
                </span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="mega-mode"
                  checked={megaSummaryMode === "recent"}
                  onChange={() => handleMegaModeChange("recent")}
                  style={{ accentColor: color("primary") }}
                />
                <span
                  className="text-sm"
                  style={{ color: color("textPrimary") }}
                >
                  最近
                </span>
              </label>

              {megaSummaryMode === "recent" && (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={megaSummaryLimit}
                    onChange={(e) =>
                      handleMegaLimitChange(
                        parseNumberInput(
                          e.target.value,
                          DEFAULT_MEMORY_CONFIG.megaSummaryLimit,
                        ),
                      )
                    }
                    className="w-16"
                  />
                  <span
                    className="text-sm"
                    style={{ color: color("textMuted") }}
                  >
                    个
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="text-xs" style={{ color: color("textMuted") }}>
            更早的历史通过大总结覆盖
          </p>
        </div>

        <div
          className="my-1"
          style={{ borderTop: `1px solid ${colorAlpha("primary", 0.1)}` }}
        />

        <div
          className="text-xs font-medium tracking-wide"
          style={{ color: color("textSecondary") }}
        >
          ── 压缩设置 ──
        </div>

        <ConfigField label="压缩阈值">
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: color("textMuted") }}>
              每
            </span>
            <Input
              type="number"
              min={2}
              max={30}
              value={compressionThreshold}
              onChange={(e) =>
                handleCompressionThresholdChange(
                  parseNumberInput(
                    e.target.value,
                    DEFAULT_MEMORY_CONFIG.compressionThreshold,
                  ),
                )
              }
              className="w-20"
            />
            <span className="text-sm" style={{ color: color("textMuted") }}>
              条小总结触发一次压缩
            </span>
          </div>
        </ConfigField>
      </div>
    </ConfigContainer>
  );
}

/**
 * 无配置提示
 */
function NoConfigHint({
  markerType,
}: {
  markerType: PromptBlock["markerType"];
}) {
  const typeLabels: Record<string, string> = {
    characterSheet: "角色数据表",
    characterDescription: "角色描写",
    narrativeState: "叙事状态速览",
    worldInfo: "世界信息",
    scenario: "剧情梗概",
    turnInfo: "回合信息",
    resultFrame: "结算结果帧",
    operationDefs: "操作定义",
  };

  return (
    <ConfigContainer title="Marker 配置">
      <div className="text-sm py-2" style={{ color: color("textMuted") }}>
        「{typeLabels[markerType || ""] || markerType}」类型暂无额外配置选项
      </div>
    </ConfigContainer>
  );
}

// ===== 辅助组件 =====

/**
 * 配置容器
 */
function ConfigContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("p-3 rounded flex flex-col gap-3")}
      style={{
        background: colorAlpha("bgElevated", 0.3),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        borderRadius: borders.radius.md,
      }}
    >
      <div
        className="text-sm font-medium pb-2"
        style={{
          color: color("textSecondary"),
          borderBottom: `1px solid ${colorAlpha("primary", 0.1)}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * 配置字段
 */
function ConfigField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm" style={{ color: color("textSecondary") }}>
        {label}
      </label>
      {children}
    </div>
  );
}
