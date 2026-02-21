import type {
  PostProcessAction,
  PostProcessPhase,
  PostProcessRule,
} from "./types";
import { validateRegexPattern } from "./validate";

/**
 * SillyTavern 正则脚本格式
 */
export interface TavernRegexScript {
  /** SillyTavern 内部 ID（导入时不复用） */
  id?: string;
  /** 脚本名称 */
  scriptName: string;
  /** 查找正则（通常为 /pattern/flags 格式） */
  findRegex: string;
  /** 替换文本 */
  replaceString: string;
  /** 额外 trim 字符串 */
  trimStrings?: string[];
  /** 生效位置枚举 */
  placement?: number[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否仅 markdown 显示使用 */
  markdownOnly?: boolean;
  /** 是否仅 prompt 使用（Lyra 不支持） */
  promptOnly?: boolean;
  /** 编辑时执行（Lyra 不支持） */
  runOnEdit?: boolean;
  /** 替换模式（Lyra 不支持） */
  substituteRegex?: number;
  /** 最小深度（Lyra 不支持） */
  minDepth?: number | null;
  /** 最大深度（Lyra 不支持） */
  maxDepth?: number | null;
}

/**
 * SillyTavern 正则导入结果
 */
export interface TavernRegexImportResult {
  /** 转换后的规则 */
  rules: PostProcessRule[];
  /** 导入警告 */
  warnings: string[];
}

interface ParsedTavernRegex {
  pattern: string;
  flags: string;
}

/**
 * 解析 SillyTavern 的 findRegex。
 *
 * 支持：
 * - /pattern/flags
 * - 纯 pattern（自动补默认 flags="g"）
 */
export function parseTavernRegex(findRegex: string): ParsedTavernRegex | null {
  const normalized = findRegex.trim();
  if (!normalized) {
    return null;
  }

  if (!normalized.startsWith("/")) {
    return {
      pattern: normalized,
      flags: "g",
    };
  }

  const closingSlashIndex = findClosingSlashIndex(normalized);
  if (closingSlashIndex <= 0) {
    return null;
  }

  const pattern = normalized.slice(1, closingSlashIndex);
  const rawFlags = normalized.slice(closingSlashIndex + 1);

  return {
    pattern,
    flags: rawFlags || "g",
  };
}

/**
 * 判断输入是否为 SillyTavern 正则脚本。
 */
export function isTavernRegexScript(data: unknown): data is TavernRegexScript {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (
    typeof obj.scriptName !== "string" ||
    typeof obj.findRegex !== "string" ||
    typeof obj.replaceString !== "string"
  ) {
    return false;
  }

  if (
    obj.trimStrings !== undefined &&
    (!Array.isArray(obj.trimStrings) ||
      obj.trimStrings.some((item) => typeof item !== "string"))
  ) {
    return false;
  }

  if (
    obj.placement !== undefined &&
    (!Array.isArray(obj.placement) ||
      obj.placement.some((item) => typeof item !== "number"))
  ) {
    return false;
  }

  return true;
}

/**
 * 将单条 SillyTavern 正则脚本转换为 Lyra 后处理规则。
 *
 * @param script SillyTavern 脚本
 * @param orderBase 基础排序值
 */
export function convertTavernRegex(
  script: TavernRegexScript,
  orderBase = 100,
): TavernRegexImportResult {
  const warnings: string[] = [];
  const rules: PostProcessRule[] = [];

  const parsed = parseTavernRegex(script.findRegex);
  if (!parsed) {
    warnings.push(`"${script.scriptName}" 的 findRegex 无法解析，已跳过`);
    return { rules, warnings };
  }

  const regexValidation = validateRegexPattern(parsed.pattern, parsed.flags);
  if (!regexValidation.valid) {
    warnings.push(
      `"${script.scriptName}" 的正则无效：${regexValidation.error ?? "未知错误"}，已导入为禁用规则`,
    );
  }

  const phases = determinePhasesFromPlacement(
    script.placement ?? [2],
    warnings,
    script.scriptName,
    script.markdownOnly ?? false,
  );

  const action = inferAction(script.replaceString);
  const baseEnabled = !(script.disabled ?? false) && regexValidation.valid;

  phases.forEach((phase, phaseIndex) => {
    const mainOrder = orderBase + phaseIndex * 10;
    const rule: PostProcessRule = {
      id: generateRuleId(),
      name: script.scriptName,
      description: "从 SillyTavern 导入",
      pattern: parsed.pattern,
      flags: parsed.flags,
      replacement: script.replaceString,
      action,
      phase,
      source: "user",
      enabled: baseEnabled,
      order: mainOrder,
    };

    rules.push(rule);

    rules.push(
      ...convertTrimStrings(
        script.trimStrings ?? [],
        script.scriptName,
        mainOrder,
        phase,
        baseEnabled,
      ),
    );
  });

  if (script.promptOnly) {
    warnings.push(
      `"${script.scriptName}" 的 promptOnly=true 已忽略（Lyra 不支持 prompt 层正则）`,
    );
  }

  if (
    typeof script.substituteRegex === "number" &&
    script.substituteRegex !== 0
  ) {
    warnings.push(
      `"${script.scriptName}" 的 substituteRegex=${script.substituteRegex} 已忽略`,
    );
  }

  if (script.minDepth != null || script.maxDepth != null) {
    warnings.push(`"${script.scriptName}" 的 minDepth/maxDepth 已忽略`);
  }

  return {
    rules,
    warnings,
  };
}

/**
 * 批量导入 SillyTavern 正则脚本（支持单个对象或数组）。
 */
export function importTavernRegexScripts(
  data: unknown,
): TavernRegexImportResult {
  const scripts = Array.isArray(data) ? data : [data];
  const allRules: PostProcessRule[] = [];
  const allWarnings: string[] = [];

  scripts.forEach((item, index) => {
    if (!isTavernRegexScript(item)) {
      allWarnings.push(
        `第 ${index + 1} 项不是有效的 SillyTavern 正则脚本，已跳过`,
      );
      return;
    }

    const result = convertTavernRegex(item, 100 + index * 20);
    allRules.push(...result.rules);
    allWarnings.push(...result.warnings);
  });

  allRules.sort((a, b) => a.order - b.order);

  return {
    rules: allRules,
    warnings: allWarnings,
  };
}

/**
 * 推断 Lyra 动作类型。
 *
 * SillyTavern 未区分 extract-and-remove，导入时仅推断 remove / replace。
 */
function inferAction(replaceString: string): PostProcessAction {
  return replaceString.length === 0 ? "remove" : "replace";
}

/**
 * 基于 placement 映射阶段。
 *
 * 映射规则：
 * - 0 (MD Display) -> render
 * - 2 (AI Output) -> persist
 * - 1,3,4 忽略并记录警告
 *
 * 若无可映射阶段：
 * - markdownOnly=true 时回退为 render
 * - 否则回退为 persist
 */
function determinePhasesFromPlacement(
  placement: number[],
  warnings: string[],
  scriptName: string,
  markdownOnly: boolean,
): PostProcessPhase[] {
  const phases = new Set<PostProcessPhase>();

  for (const value of placement) {
    switch (value) {
      case 0:
        phases.add("render");
        break;
      case 2:
        phases.add("persist");
        break;
      case 1:
      case 3:
      case 4:
        warnings.push(`"${scriptName}" 的 placement=${value} 不受支持，已忽略`);
        break;
      default:
        warnings.push(`"${scriptName}" 的 placement=${value} 未知，已忽略`);
        break;
    }
  }

  if (phases.size === 0) {
    if (markdownOnly) {
      phases.add("render");
      warnings.push(
        `"${scriptName}" 无可映射 placement，因 markdownOnly=true 回退到 render`,
      );
    } else {
      phases.add("persist");
      warnings.push(`"${scriptName}" 无可映射 placement，默认回退到 persist`);
    }
  }

  return [...phases];
}

/**
 * 将 trimStrings 转换为额外 remove 规则。
 */
function convertTrimStrings(
  trimStrings: string[],
  baseName: string,
  baseOrder: number,
  phase: PostProcessPhase,
  enabled: boolean,
): PostProcessRule[] {
  const rules: PostProcessRule[] = [];
  let orderOffset = 0;

  for (const trimString of trimStrings) {
    if (!trimString) {
      continue;
    }

    orderOffset += 1;
    rules.push({
      id: generateRuleId(),
      name: `${baseName} (trim ${orderOffset})`,
      description: "从 SillyTavern trimStrings 转换",
      pattern: escapeRegExp(trimString),
      flags: "g",
      replacement: "",
      action: "remove",
      phase,
      source: "user",
      enabled,
      order: baseOrder + orderOffset * 0.01,
    });
  }

  return rules;
}

/**
 * 转义字符串中的正则元字符。
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 生成规则 ID，格式：rule_xxx
 */
export function generateRuleId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    const compactUUID = cryptoObj.randomUUID().replace(/-/g, "");
    return `rule_${compactUUID}`;
  }

  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `rule_${time}${random}`;
}

/**
 * 找到 /pattern/flags 结构中的结尾 / 位置。
 * 结尾 / 需不是被转义的斜杠。
 */
function findClosingSlashIndex(input: string): number {
  for (let i = input.length - 1; i > 0; i -= 1) {
    if (input[i] !== "/") {
      continue;
    }

    let slashCount = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (input[j] !== "\\") {
        break;
      }
      slashCount += 1;
    }

    if (slashCount % 2 === 0) {
      return i;
    }
  }

  return -1;
}
