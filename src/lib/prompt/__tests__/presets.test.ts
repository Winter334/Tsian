/**
 * presets 测试
 *
 * 覆盖：
 * - 默认叙事预设（default.ts）结构
 * - 默认解析预设（default-parser.ts）结构
 * - 版本号、块数量、blockOrder 完整性
 */

import { describe, expect, it } from "vitest";
import { defaultPreset } from "../presets/default";
import { defaultDirectorPreset } from "../presets/default-director";
import { defaultParserPreset } from "../presets/default-parser";

describe("默认叙事预设（defaultPreset）", () => {
  it("版本号为 1.4.0", () => {
    expect(defaultPreset.metadata.version).toBe("1.4.0");
  });

  it("purpose 为 narrative", () => {
    expect(defaultPreset.purpose).toBe("narrative");
  });

  it("包含 11 个块", () => {
    expect(defaultPreset.blocks).toHaveLength(11);
  });

  it("blockOrder 与 blocks 数量一致", () => {
    expect(defaultPreset.blockOrder).toHaveLength(defaultPreset.blocks.length);
  });

  it("所有 blockOrder 中的 id 都在 blocks 中存在", () => {
    const blockIds = new Set(defaultPreset.blocks.map((b) => b.id));
    for (const orderId of defaultPreset.blockOrder) {
      expect(blockIds.has(orderId)).toBe(true);
    }
  });

  it("包含 characterDescription marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "characterDescription",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(true);
  });

  it("包含 worldInfo marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "worldInfo",
    );
    expect(block).toBeDefined();
  });

  it("包含 narrativeState marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "narrativeState",
    );
    expect(block).toBeDefined();
    expect(block!.enabled).toBe(true);
  });

  it("包含 resultFrame marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "resultFrame",
    );
    expect(block).toBeDefined();
    expect(block!.enabled).toBe(true);
  });

  it("包含 memorySummary marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "memorySummary",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(true);
  });

  it("memorySummary 包含分段记忆配置字段", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "memorySummary",
    );
    expect(block).toBeDefined();
    expect(block!.markerConfig?.recentNarrativeCount).toBe(4);
    expect(block!.markerConfig?.miniSummaryCount).toBe(10);
    expect(block!.markerConfig?.megaSummaryMode).toBe("all");
    expect(block!.markerConfig?.megaSummaryLimit).toBe(5);
    expect(block!.markerConfig?.compressionThreshold).toBe(8);
  });

  it("包含本回合叙事意图 marker 块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.markerType === "turnNarrativeIntent",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(true);
    expect(block!.enabled).toBe(true);
  });

  it("包含叙事思维链普通块", () => {
    const block = defaultPreset.blocks.find(
      (b) => b.id === "narrative-thinking",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(false);
    expect(block!.enabled).toBe(true);
  });

  it("叙事预设块顺序符合设计", () => {
    expect(defaultPreset.blockOrder).toEqual([
      "system-role",
      "character-description",
      "world-info",
      "scenario",
      "memory-summary",
      "turn-narrative-intent",
      "narrative-hints",
      "narrative-thinking",
      "narrative-state",
      "resultFrame",
      "user-input",
    ]);
  });
});

describe("默认解析预设（defaultParserPreset）", () => {
  it("版本号为 2.0.0", () => {
    expect(defaultParserPreset.metadata.version).toBe("2.0.0");
  });

  it("purpose 为 parser", () => {
    expect(defaultParserPreset.purpose).toBe("parser");
  });

  it("包含 8 个块", () => {
    expect(defaultParserPreset.blocks).toHaveLength(8);
  });

  it("blockOrder 与 blocks 数量一致", () => {
    expect(defaultParserPreset.blockOrder).toHaveLength(
      defaultParserPreset.blocks.length,
    );
  });

  it("所有 blockOrder 中的 id 都在 blocks 中存在", () => {
    const blockIds = new Set(defaultParserPreset.blocks.map((b) => b.id));
    for (const orderId of defaultParserPreset.blockOrder) {
      expect(blockIds.has(orderId)).toBe(true);
    }
  });

  it("包含 characterSheet marker 块", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.markerType === "characterSheet",
    );
    expect(block).toBeDefined();
  });

  it("包含 operationDefs marker 块", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.markerType === "operationDefs",
    );
    expect(block).toBeDefined();
  });

  it("包含 DM 思维链普通块", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.id === "dm-thinking",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(false);
    expect(block!.enabled).toBe(true);
  });

  it("包含防重复与输出规范普通块", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.id === "anti-repeat-output-rules",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(false);
    expect(block!.enabled).toBe(true);
  });

  it("包含 memorySummary marker 块", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.markerType === "memorySummary",
    );
    expect(block).toBeDefined();
    expect(block!.marker).toBe(true);
  });

  it("parser memorySummary 配置符合预期", () => {
    const block = defaultParserPreset.blocks.find(
      (b) => b.markerType === "memorySummary",
    );
    expect(block).toBeDefined();
    expect(block!.markerConfig?.recentNarrativeCount).toBe(1);
    expect(block!.markerConfig?.miniSummaryCount).toBe(0);
    expect(block!.markerConfig?.megaSummaryMode).toBe("all");
    expect(block!.markerConfig?.megaSummaryLimit).toBe(0);
    expect(block!.markerConfig?.compressionThreshold).toBe(8);
  });

  it("第一个块是系统角色定义（非 marker）", () => {
    const firstId = defaultParserPreset.blockOrder[0];
    const block = defaultParserPreset.blocks.find((b) => b.id === firstId);
    expect(block).toBeDefined();
    expect(block!.marker).toBe(false);
    expect(block!.role).toBe("system");
  });

  it("解析预设块顺序符合设计", () => {
    expect(defaultParserPreset.blockOrder).toEqual([
      "parser-system-role",
      "operation-defs",
      "dm-thinking",
      "plot-directives",
      "character-sheet",
      "anti-repeat-output-rules",
      "memory-summary",
      "user-input",
    ]);
  });
});

describe("默认导演预设（defaultDirectorPreset）", () => {
  it("版本号为 1.0.0", () => {
    expect(defaultDirectorPreset.metadata.version).toBe("1.0.0");
  });

  it("purpose 为 director", () => {
    expect(defaultDirectorPreset.purpose).toBe("director");
  });

  it("包含 9 个块", () => {
    expect(defaultDirectorPreset.blocks).toHaveLength(9);
  });

  it("blockOrder 与 blocks 数量一致", () => {
    expect(defaultDirectorPreset.blockOrder).toHaveLength(
      defaultDirectorPreset.blocks.length,
    );
  });

  it("所有 blockOrder 中的 id 都在 blocks 中存在", () => {
    const blockIds = new Set(defaultDirectorPreset.blocks.map((b) => b.id));
    for (const orderId of defaultDirectorPreset.blockOrder) {
      expect(blockIds.has(orderId)).toBe(true);
    }
  });

  it("包含角色描写块", () => {
    const block = defaultDirectorPreset.blocks.find(
      (b) => b.id === "director-character-description",
    );
    expect(block).toBeDefined();
    expect(block!.role).toBe("system");
    expect(block!.content).toContain("{{characterDescription}}");
  });

  it("包含世界知识块", () => {
    const block = defaultDirectorPreset.blocks.find(
      (b) => b.id === "director-world-info",
    );
    expect(block).toBeDefined();
    expect(block!.role).toBe("system");
    expect(block!.content).toContain("{{worldInfo}}");
  });

  it("包含世界剧本块", () => {
    const block = defaultDirectorPreset.blocks.find(
      (b) => b.id === "director-scenario",
    );
    expect(block).toBeDefined();
    expect(block!.role).toBe("system");
    expect(block!.content).toContain("{{scenario}}");
  });

  it("导演系统提示词包含档案一致性守门规则", () => {
    const block = defaultDirectorPreset.blocks.find(
      (b) => b.id === "director-system",
    );
    expect(block).toBeDefined();
    expect(block!.content).toContain("避免为同一对象重复 create");
    expect(block!.content).toContain(
      "优先使用 update / essence / presence / relate",
    );
  });

  it("导演系统提示词明确区分本回合叙事意图与叙事提示", () => {
    const block = defaultDirectorPreset.blocks.find(
      (b) => b.id === "director-system",
    );
    expect(block).toBeDefined();
    expect(block!.content).toContain("<turn_narrative_intent>");
    expect(block!.content).toContain("这里回答“这回合正文必须写什么”");
    expect(block!.content).toContain("不要再写“本回合必须发生什么剧情”");
  });

  it("导演预设块顺序符合设计", () => {
    expect(defaultDirectorPreset.blockOrder).toEqual([
      "director-system",
      "director-character-description",
      "director-world-info",
      "director-scenario",
      "director-archive",
      "director-memory",
      "director-history",
      "director-context",
      "director-input",
    ]);
  });
});
