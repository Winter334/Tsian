import type { AgentDescriptor } from "@/core/pipeline";
import {
  WARNING_CODES,
  type WarningRecord,
} from "@/domain/constants/warning-codes";
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
import { computeArchiveData } from "@/modules/world-archive";

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

    const pushWarning = (warning: WarningRecord): void => {
      bb.warnings ??= [];
      bb.warnings.push(warning);
    };

    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      pushWarning({
        code: WARNING_CODES.PARSER_MISSING_ACCESSOR,
        message: "Parser Agent 缺少 entityAccessor",
        stage: "parser",
        timestamp: Date.now(),
      });
      throw new Error("Parser Agent 缺少 entityAccessor");
    }

    const parserExecutor = createAiExecutor(bb.aiConfig);

    const inventoryData = buildInventoryData(entityAccessor, bb.aliasMap);
    const archiveData: VariableContext["archiveData"] = bb.archiveSnapshot
      ? {
          active: bb.archiveSnapshot.active,
          nearby: bb.archiveSnapshot.nearby,
        }
      : computeArchiveData();

    const plotDirectives =
      bb.envelope?.directives?.plotDirectives ?? bb.plotDirectives;

    const parserContext: VariableContext = {
      ...bb.baseVariableContext,
      worldConfig: bb.worldConfig,
      archiveData,
      gameState:
        bb.baseVariableContext.gameState ??
        buildGameStateSnapshot(entityAccessor, bb.aliasMap),
      entityEffects: buildEntityEffects(entityAccessor, bb.aliasMap),
      operationDefinitions: generateOperationDefinitions({
        worldConfig: bb.worldConfig,
        entities: bb.entities?.map(toEntityInfo),
      }),
      inventoryData,
      plotDirectives,
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
      const message = `解析 AI 调用失败: ${parserResult.error?.message ?? "未知错误"}`;
      pushWarning({
        code: WARNING_CODES.PARSER_AI_CALL_FAILED,
        message,
        stage: "parser",
        details: {
          error: parserResult.error?.message ?? "未知错误",
        },
        timestamp: Date.now(),
      });
      throw new Error(message);
    }

    const parserRawContent = parserResult.content ?? parserResponse;
    bb._agentRawOutputs ??= {};
    bb._agentRawOutputs.parser = parserRawContent;
    console.info("[IRNR Pipeline] Parser AI 返回内容:", parserRawContent);

    const parsed = parseRuleScriptFromResponse(parserRawContent);
    if (!parsed) {
      const message =
        "解析 AI 未返回有效的 RuleScript（JSON 解析失败或格式不符）";
      pushWarning({
        code: WARNING_CODES.PARSER_SCRIPT_INVALID,
        message,
        stage: "parser",
        details: {
          rawContentLength: parserRawContent.length,
        },
        timestamp: Date.now(),
      });
      throw new Error(message);
    }

    bb.ruleScript = parsed;
  },
};
