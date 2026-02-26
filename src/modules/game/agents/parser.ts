import type { AgentDescriptor } from "@/core/pipeline";
import type { PipelineBlackboard } from "@/domain/types";
import { createAiExecutor } from "@/lib/ai/executor";
import type { VariableContext } from "@/lib/prompt/types";
import { generateOperationDefinitions } from "@/lib/rules/schema";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import {
  buildEntityEffects,
  buildGameStateSnapshot,
  buildInventoryData,
  parseRuleScriptFromResponse,
  toEntityInfo,
} from "@/modules/game/services/pipeline-helpers";

export const parserAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "parser",
  name: "解析AI",
  requires: ["playerInput", "entityAccessor", "aliasMap"],
  produces: ["ruleScript"],
  execute: async (bb) => {
    if (!bb.presets.parser) {
      bb.ruleScript = { version: 2, actions: [] };
      return;
    }

    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      throw new Error("Parser Agent 缺少 entityAccessor");
    }

    const parserExecutor = createAiExecutor(bb.aiConfig);

    const inventoryData = buildInventoryData(entityAccessor, bb.aliasMap);
    const parserContext: VariableContext = {
      ...bb.baseVariableContext,
      worldConfig: bb.worldConfig,
      gameState:
        bb.baseVariableContext.gameState ??
        buildGameStateSnapshot(entityAccessor, bb.aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, bb.aliasMap),
      operationDefinitions: generateOperationDefinitions({
        worldConfig: bb.worldConfig,
        entities: bb.entities?.map(toEntityInfo),
      }),
      inventoryData,
    };

    let parserResponse = "";
    const parserResult = await parserExecutor.execute({
      preset: bb.presets.parser,
      variableContext: parserContext,
      onChunk: (chunk) => {
        parserResponse += chunk;
      },
      onComplete: (text) => {
        parserResponse = text;
      },
    });

    if (!parserResult.success) {
      throw new Error(
        `解析 AI 调用失败: ${parserResult.error?.message ?? "未知错误"}`,
      );
    }

    const parserRawContent = parserResult.content ?? parserResponse;
    console.info("[IRNR Pipeline] Parser AI 返回内容:", parserRawContent);

    const parsed = parseRuleScriptFromResponse(parserRawContent);
    if (!parsed) {
      throw new Error(
        "解析 AI 未返回有效的 RuleScript（JSON 解析失败或格式不符）",
      );
    }

    bb.ruleScript = parsed;
  },
};
