import { PipelineOrchestrator } from "@/core/pipeline";
import type { PipelineBlackboard } from "@/domain/types";

import { directorAgent } from "@/modules/director/director-agent";

import { engineAgent } from "./engine";
import { entityAccessorAgent } from "./entity-accessor";
import { finalizerAgent } from "./finalizer";
import { narratorAgent } from "./narrator";
import { parserAgent } from "./parser";
import { postProcessorAgent } from "./post-processor";

export { directorAgent } from "@/modules/director/director-agent";
export { engineAgent } from "./engine";
export { entityAccessorAgent } from "./entity-accessor";
export { finalizerAgent } from "./finalizer";
export { narratorAgent } from "./narrator";
export { parserAgent } from "./parser";
export { postProcessorAgent } from "./post-processor";

export function createGamePipeline(): PipelineOrchestrator<PipelineBlackboard> {
  const orchestrator = new PipelineOrchestrator<PipelineBlackboard>();

  orchestrator.register(entityAccessorAgent);
  orchestrator.register(directorAgent);
  orchestrator.register(parserAgent);
  orchestrator.register(engineAgent);
  orchestrator.register(narratorAgent);
  orchestrator.register(postProcessorAgent);
  orchestrator.register(finalizerAgent);

  return orchestrator;
}
