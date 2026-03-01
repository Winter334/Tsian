import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Input, Select, Textarea } from "@/components/ui";
import type {
  EntityRelationship,
  EntityRelationshipInput,
  NarrativeEntity,
} from "@/modules";
import { color, colorAlpha } from "@/styles/tokens";

interface ArchiveRelationshipEditorProps {
  currentEntityId: string;
  relationships: EntityRelationship[];
  entities: NarrativeEntity[];
  onAdd: (relationship: EntityRelationshipInput) => void;
  onRemove: (relationshipId: string) => void;
  onUpdate: (
    relationshipId: string,
    updates: Partial<Omit<EntityRelationship, "id">>,
  ) => void;
}

export function ArchiveRelationshipEditor({
  currentEntityId,
  relationships,
  entities,
  onAdd,
  onRemove,
  onUpdate,
}: ArchiveRelationshipEditorProps) {
  const relationTargetOptions = useMemo(() => {
    return entities
      .filter((entity) => entity.id !== currentEntityId)
      .map((entity) => ({
        value: entity.id,
        label: entity.name,
      }));
  }, [currentEntityId, entities]);

  const usedTargetIds = useMemo(() => {
    return new Set(
      relationships.map((relationship) => relationship.targetEntityId),
    );
  }, [relationships]);

  const appendableTarget = relationTargetOptions.find((option) => {
    return !usedTargetIds.has(option.value);
  });

  const handleAdd = () => {
    if (!appendableTarget) {
      return;
    }

    onAdd({
      targetEntityId: appendableTarget.value,
      type: "acquaintance",
      description: "",
    });
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          关系
        </h4>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!appendableTarget}
        >
          <Plus className="h-4 w-4" />
          添加关系
        </Button>
      </div>

      {relationships.length === 0 ? (
        <div
          className="rounded-md border px-3 py-2 text-xs"
          style={{
            color: color("textMuted"),
            borderColor: colorAlpha("primary", 0.18),
            background: colorAlpha("bgElevated", 0.3),
          }}
        >
          暂无关系，点击“添加关系”开始维护。
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((relationship) => (
            <RelationshipItem
              key={relationship.id}
              relationship={relationship}
              relationTargetOptions={relationTargetOptions}
              onRemove={() => onRemove(relationship.id)}
              onUpdate={(updates) => onUpdate(relationship.id, updates)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface RelationshipItemProps {
  relationship: EntityRelationship;
  relationTargetOptions: Array<{ value: string; label: string }>;
  onRemove: () => void;
  onUpdate: (updates: Partial<Omit<EntityRelationship, "id">>) => void;
}

function RelationshipItem({
  relationship,
  relationTargetOptions,
  onRemove,
  onUpdate,
}: RelationshipItemProps) {
  const [typeDraft, setTypeDraft] = useState(relationship.type);
  const [descriptionDraft, setDescriptionDraft] = useState(
    relationship.description,
  );

  useEffect(() => {
    setTypeDraft(relationship.type);
  }, [relationship.id, relationship.type]);

  useEffect(() => {
    setDescriptionDraft(relationship.description);
  }, [relationship.id, relationship.description]);

  const commitType = () => {
    if (typeDraft === relationship.type) {
      return;
    }

    onUpdate({ type: typeDraft });
  };

  const commitDescription = () => {
    if (descriptionDraft === relationship.description) {
      return;
    }

    onUpdate({ description: descriptionDraft });
  };

  return (
    <div
      className="space-y-2 rounded-md border p-2.5"
      style={{
        borderColor: colorAlpha("primary", 0.16),
        background: colorAlpha("bgCard", 0.26),
      }}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Select
          value={relationship.targetEntityId}
          onValueChange={(value) => {
            if (value !== relationship.targetEntityId) {
              onUpdate({ targetEntityId: value });
            }
          }}
          options={relationTargetOptions}
          size="sm"
        />

        <Input
          value={typeDraft}
          onChange={(event) => setTypeDraft(event.target.value)}
          onBlur={commitType}
          placeholder="关系类型，如 ally / rival"
          className="h-9"
        />

        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Textarea
        value={descriptionDraft}
        onChange={(event) => setDescriptionDraft(event.target.value)}
        onBlur={commitDescription}
        placeholder="关系描述（可选）"
        className="min-h-18"
      />
    </div>
  );
}
