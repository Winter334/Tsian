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
import { defaultParserPreset } from "../presets/default-parser";

describe("默认叙事预设（defaultPreset）", () => {
  it("版本号为 1.4.0", () => {
    expect(defaultPreset.metadata.version).toBe("1.4.0");
  });

  it("purpose 为 narrative", () => {
    expect(defaultPreset.purpose).toBe("narrative");
  });

  it("包含 8 个块", () => {
    expect(defaultPreset.blocks).toHaveLength(8);
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
      "narrative-thinking",
      "narrative-state",
      "resultFrame",
    ]);
  });
});

describe("默认解析预设（defaultParserPreset）", () => {
  it("版本号为 1.4.0", () => {
    expect(defaultParserPreset.metadata.version).toBe("1.4.0");
  });

  it("purpose 为 parser", () => {
    expect(defaultParserPreset.purpose).toBe("parser");
  });

  it("包含 6 个块", () => {
    expect(defaultParserPreset.blocks).toHaveLength(6);
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
      "character-sheet",
      "anti-repeat-output-rules",
      "memory-summary",
    ]);
  });
});
