/**
 * 酒馆预设转换器
 *
 * 将 SillyTavern 预设格式转换为 Lyra 预设格式
 */

import type { ExportedAIProfile } from "@/lib/ai/types";
import type { MarkerType, Preset, PromptBlock } from "../types";

// ===== 酒馆预设类型定义 =====

/**
 * 酒馆预设中的 Prompt 块
 */
interface TavernPrompt {
  /** 标识符 */
  identifier: string;
  /** 名称 */
  name: string;
  /** 是否为系统提示 */
  system_prompt?: boolean;
  /** 是否为占位标记 */
  marker?: boolean;
  /** 角色 */
  role?: "system" | "user" | "assistant";
  /** 内容 */
  content?: string;
  /** 注入位置（0 = 相对深度, 1 = 绝对位置） */
  injection_position?: number;
  /** 注入深度 */
  injection_depth?: number;
  /** 同深度排序顺序 */
  injection_order?: number;
  /** 禁止覆盖 */
  forbid_overrides?: boolean;
}

/**
 * 酒馆预设中的顺序条目
 */
interface TavernOrderEntry {
  identifier: string;
  enabled: boolean;
}

/**
 * 酒馆预设中的 Prompt 顺序配置
 */
interface TavernPromptOrder {
  character_id: number;
  order: TavernOrderEntry[];
}

/**
 * 酒馆预设格式
 */
export interface TavernPreset {
  /** 提示词块列表 */
  prompts: TavernPrompt[];
  /** 提示词顺序（多个角色配置） */
  prompt_order: TavernPromptOrder[];
  /** 其他配置字段（忽略） */
  [key: string]: unknown;
}

// ===== 转换结果 =====

/**
 * 转换警告
 */
export interface ConversionWarning {
  /** 警告类型 */
  type:
    | "unsupported_variable"
    | "unsupported_marker"
    | "unsupported_feature"
    | "ignored_block";
  /** 块标识符 */
  blockIdentifier: string;
  /** 块名称 */
  blockName: string;
  /** 警告消息 */
  message: string;
}

/**
 * 转换结果
 */
export interface ConversionResult {
  /** 转换后的预设 */
  preset: Preset;
  /** 转换警告列表 */
  warnings: ConversionWarning[];
  /** 原始预设名称（如果能检测到） */
  detectedName?: string;
}

// ===== 常量定义 =====

/**
 * 酒馆 Marker 类型到 Lyra Marker 类型的映射
 */
const MARKER_TYPE_MAP: Record<string, MarkerType | null> = {
  chatHistory: "chatHistory",
  personaDescription: "characterDescription",
  worldInfoBefore: "worldInfo",
  worldInfoAfter: "worldInfo",
  scenario: "scenario",
  // IRNR Marker（若酒馆预设包含这些 identifier，可直接映射）
  gameState: "characterSheet",
  resultFrame: "resultFrame",
  operationDefs: "operationDefs",
  // 角色卡相关 Marker，Lyra 不支持，设为 null 表示忽略
  charDescription: null,
  charPersonality: null,
  dialogueExamples: null,
};

/**
 * 需要忽略的 Marker 标识符（角色卡相关）
 */
const IGNORED_MARKER_IDENTIFIERS = new Set([
  "charDescription",
  "charPersonality",
  "dialogueExamples",
]);

/**
 * 不支持的变量模式
 * 这些变量在 Lyra 中不可用，转换时会生成警告
 *
 * 已支持的宏（不再警告）：
 * - {{roll:dN}}, {{random:a,b,c}} - 随机宏
 * - {{getvar::name}}, {{setvar::name::value}} - 本地变量
 * - {{getglobalvar::name}}, {{setglobalvar::name::value}} - 全局变量
 * - {{addvar::name::value}}, {{incvar::name}}, {{decvar::name}} - 变量运算
 * - {{//...}} - 注释宏
 */
const UNSUPPORTED_VARIABLE_PATTERNS = [
  /\{\{personality\}\}/gi,
  /\{\{description\}\}/gi,
  /\{\{mes_example\}\}/gi,
  // 注意：{{char}}, {{scenario}} 现在已支持作为基础变量
];

// ===== 工具函数 =====

/**
 * 检测预设是否为酒馆格式
 */
export function isTavernPreset(data: unknown): data is TavernPreset {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // 检查必需字段
  if (!Array.isArray(obj.prompts) || !Array.isArray(obj.prompt_order)) {
    return false;
  }

  // 检查 prompts 数组结构
  if (obj.prompts.length > 0) {
    const firstPrompt = obj.prompts[0] as Record<string, unknown>;
    if (typeof firstPrompt.identifier !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * 检测预设是否为 Lyra 格式
 */
export function isLyraPreset(data: unknown): data is Preset {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // 检查必需字段
  if (
    typeof obj.id !== "string" ||
    typeof obj.name !== "string" ||
    !Array.isArray(obj.blocks) ||
    !Array.isArray(obj.blockOrder)
  ) {
    return false;
  }

  // 检查 metadata
  if (obj.metadata && typeof obj.metadata === "object") {
    const metadata = obj.metadata as Record<string, unknown>;
    if (metadata.source !== "lyra" && metadata.source !== "tavern") {
      return false;
    }
  }

  return true;
}

/**
 * 生成块 ID
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成预设 ID
 */
function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查内容中是否有不支持的变量
 */
function findUnsupportedVariables(content: string): string[] {
  const found: string[] = [];

  for (const pattern of UNSUPPORTED_VARIABLE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      found.push(...matches);
    }
  }

  return [...new Set(found)]; // 去重
}

// ===== 转换函数 =====

/**
 * 将酒馆预设转换为 Lyra 预设
 */
export function convertTavernToLyra(
  tavernPreset: TavernPreset,
  presetName?: string,
): ConversionResult {
  const warnings: ConversionWarning[] = [];
  const blocks: PromptBlock[] = [];

  // 创建 identifier -> prompt 的映射
  const promptMap = new Map<string, TavernPrompt>();
  for (const prompt of tavernPreset.prompts) {
    promptMap.set(prompt.identifier, prompt);
  }

  // 使用最新的 prompt_order（通常是 character_id: 100001）
  // 或者如果只有一个，就使用那个
  let orderConfig: TavernPromptOrder | undefined;
  if (tavernPreset.prompt_order.length > 0) {
    // 优先使用 character_id 为 100001 的配置（通常是最完整的）
    orderConfig = tavernPreset.prompt_order.find(
      (o) => o.character_id === 100001,
    );
    // 如果没有，使用最后一个
    if (!orderConfig) {
      orderConfig =
        tavernPreset.prompt_order[tavernPreset.prompt_order.length - 1];
    }
  }

  if (!orderConfig) {
    // 没有顺序配置，直接按 prompts 数组顺序转换
    for (let i = 0; i < tavernPreset.prompts.length; i++) {
      const prompt = tavernPreset.prompts[i];
      const result = convertPromptToBlock(prompt, i, true, warnings);
      if (result) {
        blocks.push(result);
      }
    }
  } else {
    // 按照 prompt_order 顺序转换
    for (let i = 0; i < orderConfig.order.length; i++) {
      const orderEntry = orderConfig.order[i];
      const prompt = promptMap.get(orderEntry.identifier);

      if (!prompt) {
        // prompt_order 中有但 prompts 中没有的条目，跳过
        continue;
      }

      const result = convertPromptToBlock(
        prompt,
        i,
        orderEntry.enabled,
        warnings,
      );
      if (result) {
        blocks.push(result);
      }
    }
  }

  // 创建 Lyra 预设
  const preset: Preset = {
    id: generatePresetId(),
    name: presetName || "导入的预设",
    description: "从 SillyTavern 导入",
    blocks,
    blockOrder: blocks.map((b) => b.id),
    purpose: "narrative",
    metadata: {
      version: "1.3.0",
      source: "tavern",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };

  return {
    preset,
    warnings,
  };
}

/**
 * 将单个酒馆 Prompt 转换为 Lyra PromptBlock
 */
function convertPromptToBlock(
  prompt: TavernPrompt,
  order: number,
  enabled: boolean,
  warnings: ConversionWarning[],
): PromptBlock | null {
  // 检查是否为需要忽略的 Marker
  if (prompt.marker && IGNORED_MARKER_IDENTIFIERS.has(prompt.identifier)) {
    warnings.push({
      type: "ignored_block",
      blockIdentifier: prompt.identifier,
      blockName: prompt.name,
      message: `块 "${prompt.name}" 是角色卡相关 Marker，Lyra 不支持角色卡概念，已忽略`,
    });
    return null;
  }

  // 确定角色
  let role: "system" | "user" | "assistant" = "system";
  if (prompt.role) {
    role = prompt.role;
  } else if (prompt.system_prompt !== false) {
    // 默认为 system
    role = "system";
  }

  // 处理 Marker 类型
  let markerType: MarkerType | undefined;

  if (prompt.marker) {
    const mappedType = MARKER_TYPE_MAP[prompt.identifier];
    if (mappedType === null) {
      // 不支持的 Marker 类型，已在上面处理
      return null;
    } else if (mappedType) {
      markerType = mappedType;
    } else {
      // 未知的 Marker 类型，生成警告但仍然转换为普通块
      warnings.push({
        type: "unsupported_marker",
        blockIdentifier: prompt.identifier,
        blockName: prompt.name,
        message: `块 "${prompt.name}" 使用了未知的 Marker 类型 "${prompt.identifier}"，将作为普通块处理`,
      });
    }
  }

  // 检查内容中的不支持变量
  const content = prompt.content || "";
  const unsupportedVars = findUnsupportedVariables(content);
  if (unsupportedVars.length > 0) {
    warnings.push({
      type: "unsupported_variable",
      blockIdentifier: prompt.identifier,
      blockName: prompt.name,
      message: `块 "${prompt.name}" 包含不支持的变量：${unsupportedVars.join(
        ", ",
      )}`,
    });
  }

  // 构建块
  const block: PromptBlock = {
    id: generateBlockId(),
    name: prompt.name,
    content: content,
    role,
    marker: Boolean(prompt.marker && markerType),
    markerType: markerType,
    markerConfig:
      markerType === "chatHistory"
        ? {
            maxMessages: 50,
            includeSystemMessages: false,
          }
        : undefined,
    injectionDepth: prompt.injection_depth ?? 0,
    order,
    enabled,
  };

  return block;
}

// ===== 导出格式定义 =====

/**
 * Lyra 预设导出格式
 */
export interface LyraExportFormat {
  /** 格式版本 */
  version: "1.0" | "1.1";
  /** 类型标识 */
  type: "lyra-preset";
  /** 导出时间 */
  exportedAt: string;
  /** 预设数据 */
  preset: Preset;
  /**
   * 嵌入的 AI Profile（v1.1 新增）
   * 导出时从 preset.aiProfileId 查找对应 Profile，剥离敏感字段后嵌入。
   */
  aiProfile?: ExportedAIProfile;
}

/**
 * 导出 Lyra 预设
 * @param preset - 预设数据
 * @param aiProfile - 关联的 AI Profile（已剥离敏感信息），可选
 */
export function exportLyraPreset(
  preset: Preset,
  aiProfile?: ExportedAIProfile,
): LyraExportFormat {
  return {
    version: "1.1",
    type: "lyra-preset",
    exportedAt: new Date().toISOString(),
    preset,
    ...(aiProfile ? { aiProfile } : {}),
  };
}

/**
 * 检测导出数据是否为 Lyra 导出格式
 */
export function isLyraExportFormat(data: unknown): data is LyraExportFormat {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    (obj.version === "1.0" || obj.version === "1.1") &&
    obj.type === "lyra-preset" &&
    typeof obj.exportedAt === "string" &&
    isLyraPreset(obj.preset)
  );
}

/** 导入结果 */
export interface LyraImportResult {
  /** 导入的预设 */
  preset: Preset;
  /** 嵌入的 AI Profile（如果有） */
  aiProfile?: ExportedAIProfile;
}

/**
 * 导入 Lyra 预设
 * 重新生成 ID 以避免冲突，并提取嵌入的 AI Profile。
 */
export function importLyraPreset(data: LyraExportFormat): LyraImportResult {
  // 重新生成 ID，避免冲突
  const preset = { ...data.preset };
  preset.id = generatePresetId();
  preset.metadata = {
    ...preset.metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    preset,
    aiProfile: data.aiProfile,
  };
}
