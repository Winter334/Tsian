import { services } from "@/core";
import type { AgentDescriptor } from "@/core/pipeline";
import { INVENTORY_QUERY_SERVICE_TOKEN } from "@/core/services/tokens";
import type { PipelineBlackboard } from "@/domain/types";
import {
  applyEquipmentEffectsToEntity,
  applyTalentsToEntity,
  buildDefaultEntityFromWorldConfig,
  MapEntityAccessor,
  type EntityData,
} from "@/modules/game/services/entity-accessor";
import { buildEntityAliasMap } from "@/modules/game/services/entity-alias";
import { buildTalentIdsByEntityId } from "@/modules/game/services/pipeline-helpers";

export const entityAccessorAgent: AgentDescriptor<PipelineBlackboard> = {
  id: "entity-accessor",
  name: "实体构建器",
  requires: ["worldConfig"],
  produces: ["entityAccessor", "aliasMap"],
  execute: async (bb) => {
    const entityAccessor = new MapEntityAccessor();

    if (bb.entities && bb.entities.length > 0) {
      for (const entity of bb.entities) {
        entityAccessor.setEntity(entity);
      }
    }

    const actorId = bb.actorId || "player";
    if (!entityAccessor.hasEntity(actorId)) {
      entityAccessor.setEntity(
        buildDefaultEntityFromWorldConfig(actorId, bb.worldConfig),
      );
    }

    const talentIdsByEntityId = buildTalentIdsByEntityId({
      actorId,
      roomId: bb.roomId,
      baseVariableContext: bb.baseVariableContext,
    });

    const inventoryQuery = services.getRequired(INVENTORY_QUERY_SERVICE_TOKEN);
    for (const entityId of entityAccessor.getAllEntityIds()) {
      const entity = entityAccessor.getEntityData(entityId);
      if (!entity || entity.type !== "character") continue;

      const talentIds = talentIdsByEntityId.get(entityId) ?? [];
      if (talentIds.length > 0) {
        applyTalentsToEntity(entity, talentIds, bb.worldConfig);
      }

      const equippedItems = inventoryQuery.getEquippedItems(entityId);
      if (equippedItems.length > 0) {
        applyEquipmentEffectsToEntity(entity, equippedItems);
      }
    }

    const allEntities: EntityData[] = [];
    for (const entityId of entityAccessor.getAllEntityIds()) {
      const fields = entityAccessor.getAllFields(entityId);
      const tags = entityAccessor.getTagsWithMetadata(entityId);
      if (!fields) continue;

      allEntities.push({
        id: entityId,
        type: entityAccessor.getEntityType(entityId) ?? "character",
        fields,
        tags,
      });
    }

    const aliasMap = buildEntityAliasMap(actorId, allEntities);

    bb.entityAccessor = entityAccessor;
    bb.aliasMap = aliasMap;
  },
};
