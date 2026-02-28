import type { ArchiveEntityForContext } from "@/lib/prompt/types";
import { useWorldArchiveStore } from "./store";
import type { NarrativeEntity } from "./types";

/**
 * 将 NarrativeEntity 转换为轻量的 ArchiveEntityForContext
 */
function toContextEntity(entity: NarrativeEntity): ArchiveEntityForContext {
  return {
    id: entity.id,
    name: entity.name,
    archetype: entity.archetype,
    essence: entity.essence,
    currentState: entity.currentState,
    relationships: entity.relationships.map((relationship) => ({
      targetEntityId: relationship.targetEntityId,
      type: relationship.type,
      description: relationship.description,
    })),
    tags: [...entity.tags],
  };
}

/**
 * 计算世界档案注入数据
 * 按 Presence 分层，供 Marker 渲染使用
 */
export function computeArchiveData(): {
  active: ArchiveEntityForContext[];
  nearby: ArchiveEntityForContext[];
} {
  const store = useWorldArchiveStore.getState();
  const active = store.getEntitiesByPresence("active").map(toContextEntity);
  const nearby = store.getEntitiesByPresence("nearby").map(toContextEntity);

  return { active, nearby };
}
