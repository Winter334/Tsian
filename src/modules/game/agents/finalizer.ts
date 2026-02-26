import type { AgentDescriptor } from "@/core/pipeline";
import type { EntityFinalState, PipelineBlackboard } from "@/domain/types";
import type { MapEntityAccessor } from "@/modules/game/services/entity-accessor";
import { filterTagsForPersistence } from "@/modules/game/services/pipeline-helpers";

export const finalizerAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "finalizer",
  name: "状态提交",
  requires: ["entityAccessor", "resultFrame", "narrativeText"],
  produces: ["finalEntityStates"],
  execute: async (bb) => {
    const entityAccessor = bb.entityAccessor as MapEntityAccessor | undefined;
    if (!entityAccessor) {
      throw new Error("Finalizer Agent 缺少 entityAccessor");
    }

    const finalEntityStates: EntityFinalState[] = [];

    for (const entityId of entityAccessor.getAllEntityIds()) {
      const fields = entityAccessor.getAllFields(entityId);
      const tags = entityAccessor.getTagsWithMetadata(entityId);

      if (fields) {
        finalEntityStates.push({
          id: entityId,
          fields,
          tags: filterTagsForPersistence(tags),
        });
      }
    }

    bb.finalEntityStates = finalEntityStates;
  },
};
