import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Input, Select, Textarea } from "@/components/ui";
import {
  UpdateWorldArchiveTagsPayload,
  WorldArchiveCommands,
  type AddWorldArchiveRelationshipPayload,
  type EntityPresence,
  type RemoveWorldArchiveRelationshipPayload,
  type UpdateWorldArchiveEntityEssencePayload,
  type UpdateWorldArchiveEntityNamePayload,
  type UpdateWorldArchiveEntityPresencePayload,
  type UpdateWorldArchiveEntityStatePayload,
  type UpdateWorldArchiveRelationshipPayload,
} from "@/domain/commands/world-archive";
import { useCommand } from "@/hooks";
import { type NarrativeEntity } from "@/modules";
import { color, colorAlpha } from "@/styles/tokens";
import { ArchiveRelationshipEditor } from "./ArchiveRelationshipEditor";
import { ArchiveTagEditor } from "./ArchiveTagEditor";

interface ArchiveEntityDetailProps {
  entity: NarrativeEntity | null;
  entities: NarrativeEntity[];
  onBack?: () => void;
}

const PRESENCE_OPTIONS: Array<{ value: EntityPresence; label: string }> = [
  { value: "active", label: "active（在场）" },
  { value: "nearby", label: "nearby（附近）" },
  { value: "dormant", label: "dormant（休眠）" },
  { value: "resolved", label: "resolved（已解决）" },
];

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  return new Date(timestamp).toLocaleString();
}

export function ArchiveEntityDetail({
  entity,
  entities,
  onBack,
}: ArchiveEntityDetailProps) {
  const dispatch = useCommand();

  const [nameDraft, setNameDraft] = useState("");
  const [essenceDraft, setEssenceDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");

  useEffect(() => {
    setNameDraft(entity?.name ?? "");
    setEssenceDraft(entity?.essence ?? "");
    setStateDraft(entity?.currentState ?? "");
  }, [entity?.id, entity?.name, entity?.essence, entity?.currentState]);

  if (!entity) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm" style={{ color: color("textMuted") }}>
            从左侧列表选择一个实体
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: colorAlpha("textMuted", 0.7) }}
          >
            可编辑 name / essence / currentState / presence / relationships /
            tags
          </p>
        </div>
      </div>
    );
  }

  const commitName = async () => {
    const nextName = nameDraft.trim();
    if (nextName.length === 0) {
      setNameDraft(entity.name);
      return;
    }

    if (nextName === entity.name) {
      return;
    }

    await dispatch<UpdateWorldArchiveEntityNamePayload, void>({
      type: WorldArchiveCommands.UPDATE_ENTITY_NAME,
      payload: {
        entityId: entity.id,
        name: nextName,
      },
    });
  };

  const commitEssence = async () => {
    if (essenceDraft === entity.essence) {
      return;
    }

    await dispatch<UpdateWorldArchiveEntityEssencePayload, void>({
      type: WorldArchiveCommands.UPDATE_ENTITY_ESSENCE,
      payload: {
        entityId: entity.id,
        essence: essenceDraft,
      },
    });
  };

  const commitState = async () => {
    if (stateDraft === entity.currentState) {
      return;
    }

    await dispatch<UpdateWorldArchiveEntityStatePayload, void>({
      type: WorldArchiveCommands.UPDATE_ENTITY_STATE,
      payload: {
        entityId: entity.id,
        currentState: stateDraft,
      },
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: colorAlpha("primary", 0.15) }}
      >
        <div className="flex items-center gap-2">
          {onBack && (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          )}
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            实体详情
          </h3>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <section className="space-y-2.5">
            <label className="text-xs" style={{ color: color("textMuted") }}>
              名称 name
            </label>
            <Input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => {
                void commitName();
              }}
            />
          </section>

          <section className="space-y-2.5">
            <label className="text-xs" style={{ color: color("textMuted") }}>
              存在状态 presence
            </label>
            <Select
              value={entity.presence}
              onValueChange={(value) => {
                const nextPresence = value as EntityPresence;
                void dispatch<UpdateWorldArchiveEntityPresencePayload, void>({
                  type: WorldArchiveCommands.UPDATE_ENTITY_PRESENCE,
                  payload: {
                    entityId: entity.id,
                    presence: nextPresence,
                  },
                });
              }}
              options={PRESENCE_OPTIONS}
              size="sm"
            />
          </section>

          <section className="space-y-2.5">
            <label className="text-xs" style={{ color: color("textMuted") }}>
              本质 essence
            </label>
            <Textarea
              value={essenceDraft}
              onChange={(event) => setEssenceDraft(event.target.value)}
              onBlur={() => {
                void commitEssence();
              }}
              className="min-h-28"
            />
          </section>

          <section className="space-y-2.5">
            <label className="text-xs" style={{ color: color("textMuted") }}>
              当前状态 currentState
            </label>
            <Textarea
              value={stateDraft}
              onChange={(event) => setStateDraft(event.target.value)}
              onBlur={() => {
                void commitState();
              }}
              className="min-h-28"
            />
          </section>

          <ArchiveRelationshipEditor
            currentEntityId={entity.id}
            relationships={entity.relationships}
            entities={entities}
            onAdd={(relationship) => {
              void dispatch<AddWorldArchiveRelationshipPayload, void>({
                type: WorldArchiveCommands.ADD_RELATIONSHIP,
                payload: {
                  entityId: entity.id,
                  relationship,
                },
              });
            }}
            onRemove={(relationshipId) => {
              void dispatch<RemoveWorldArchiveRelationshipPayload, void>({
                type: WorldArchiveCommands.REMOVE_RELATIONSHIP,
                payload: {
                  entityId: entity.id,
                  relationshipId,
                },
              });
            }}
            onUpdate={(relationshipId, updates) => {
              void dispatch<UpdateWorldArchiveRelationshipPayload, void>({
                type: WorldArchiveCommands.UPDATE_RELATIONSHIP,
                payload: {
                  entityId: entity.id,
                  relationshipId,
                  updates,
                },
              });
            }}
          />

          <ArchiveTagEditor
            tags={entity.tags}
            onChange={(nextTags) => {
              void dispatch<UpdateWorldArchiveTagsPayload, void>({
                type: WorldArchiveCommands.UPDATE_TAGS,
                payload: {
                  entityId: entity.id,
                  tags: nextTags,
                },
              });
            }}
          />

          <section
            className="space-y-1 rounded-md border p-3 text-xs"
            style={{
              borderColor: colorAlpha("primary", 0.16),
              background: colorAlpha("bgElevated", 0.24),
              color: colorAlpha("textSecondary", 0.85),
            }}
          >
            <div>archetype：{entity.archetype}</div>
            <div>introducedAtTurn：#{entity.introducedAtTurn}</div>
            <div>lastActiveTurn：#{entity.lastActiveTurn}</div>
            <div>gameEntityId：{entity.gameEntityId ?? "-"}</div>
            <div>createdAt：{formatTimestamp(entity.createdAt)}</div>
            <div>updatedAt：{formatTimestamp(entity.updatedAt)}</div>
          </section>
        </div>
      </div>
    </section>
  );
}
