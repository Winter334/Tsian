/**
 * 预设工具函数
 *
 * ⚠️ 说明：
 * - `normalizePreset` 已废弃，不再在预设加载流程中自动调用。
 * - 现由用户通过“重置为默认”手动获取最新的内置默认预设内容。
 * - `getDefaultPresetForPurpose` 仍是“重置为默认”功能的核心工具函数。
 */

import { defaultPreset } from "./presets/default";
import { defaultParserPreset } from "./presets/default-parser";
import { defaultSummarizerPreset } from "./presets/default-summarizer";
import type { Preset, PresetPurpose } from "./types";

/**
 * 获取指定用途对应的默认预设
 */
export function getDefaultPresetForPurpose(
  purpose: PresetPurpose | string,
): Preset {
  if (purpose === "parser") return defaultParserPreset;
  if (purpose === "summarizer") return defaultSummarizerPreset;
  return defaultPreset;
}

/**
 * @deprecated 已废弃：不再用于预设加载流程的自动迁移。
 * 如需获取最新默认结构，请使用 `getDefaultPresetForPurpose` 并由用户手动触发重置。
 *
 * 规范化预设：确保关键 Marker 块存在
 *
 * 用于加载旧版本预设时自动补齐新功能所需的 Marker 块。
 *
 * 约束：
 * - 只补齐**缺失**的 Marker 块，不覆盖用户已有的配置
 * - **不强制启用**已被用户禁用的块（尊重用户自定义）
 * - 使用默认预设的块配置作为模板
 * - 纯函数，不修改原始对象
 */
export function normalizePreset(preset: Preset): Preset {
  const purpose = preset.purpose ?? "narrative";
  const reference = getDefaultPresetForPurpose(purpose);

  // 需要确保存在的 Marker 块（从默认预设中提取）
  const requiredMarkerTypes = reference.blocks
    .filter((b) => b.marker && b.markerType)
    .map((b) => b.markerType!);

  const blocks = [...preset.blocks];
  const blockOrder = [...preset.blockOrder];
  let modified = false;

  for (const markerType of requiredMarkerTypes) {
    const existingBlock = blocks.find((b) => b.markerType === markerType);

    if (!existingBlock) {
      // 块不存在，从默认预设中复制一个
      const defaultBlock = reference.blocks.find(
        (b) => b.markerType === markerType,
      );
      if (defaultBlock) {
        blocks.push({ ...defaultBlock });
        blockOrder.push(defaultBlock.id);
        modified = true;
      }
    }
    // 注意：不强制启用已禁用的块（用户可能有意禁用）
    // 但需要确保块至少存在，用户可以在 UI 中自行启用
  }

  if (!modified) return preset;

  console.info(
    `[normalizePreset] 预设 "${preset.name}" (${preset.id}) 已补齐缺失的 Marker 块`,
  );

  return {
    ...preset,
    blocks,
    blockOrder,
  };
}
