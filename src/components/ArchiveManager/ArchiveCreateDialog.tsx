import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { EntityArchetype, EntityPresence } from "@/modules";

interface ArchiveCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: {
    archetype: EntityArchetype;
    name: string;
    essence: string;
    currentState: string;
    presence: EntityPresence;
    tags: string[];
  }) => Promise<string | null>;
}

const ARCHETYPE_OPTIONS: Array<{ value: EntityArchetype; label: string }> = [
  { value: "character", label: "角色" },
  { value: "event", label: "事件" },
  { value: "faction", label: "势力" },
  { value: "location", label: "地点" },
  { value: "item_unique", label: "唯一道具" },
  { value: "quest", label: "任务" },
  { value: "mystery", label: "谜团" },
  { value: "custom", label: "自定义" },
];

const PRESENCE_OPTIONS: Array<{ value: EntityPresence; label: string }> = [
  { value: "active", label: "active（在场）" },
  { value: "nearby", label: "nearby（附近）" },
  { value: "dormant", label: "dormant（休眠）" },
  { value: "resolved", label: "resolved（已解决）" },
];

export function ArchiveCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: ArchiveCreateDialogProps) {
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<EntityArchetype>("character");
  const [presence, setPresence] = useState<EntityPresence>("active");
  const [essence, setEssence] = useState("");
  const [currentState, setCurrentState] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const canCreate = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);

  const resetDraft = () => {
    setName("");
    setArchetype("character");
    setPresence("active");
    setEssence("");
    setCurrentState("");
    setTagsInput("");
  };

  useEffect(() => {
    if (!open) {
      resetDraft();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!canCreate) {
      return;
    }

    const tags = tagsInput
      .split(/[，,]/u)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const createdEntityId = await onCreate({
      archetype,
      name: name.trim(),
      essence: essence.trim(),
      currentState: currentState.trim(),
      presence,
      tags,
    });

    if (createdEntityId) {
      resetDraft();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="新建世界档案实体" width="md" animateLifecycle>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="实体名称"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              value={archetype}
              onValueChange={(value) => setArchetype(value as EntityArchetype)}
              options={ARCHETYPE_OPTIONS}
              size="sm"
            />
            <Select
              value={presence}
              onValueChange={(value) => setPresence(value as EntityPresence)}
              options={PRESENCE_OPTIONS}
              size="sm"
            />
          </div>

          <Textarea
            value={essence}
            onChange={(event) => setEssence(event.target.value)}
            placeholder="本质 essence"
            className="min-h-24"
          />

          <Textarea
            value={currentState}
            onChange={(event) => setCurrentState(event.target.value)}
            placeholder="当前状态 currentState"
            className="min-h-24"
          />

          <Input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="标签（用逗号分隔）"
            className="h-9"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!canCreate}
            >
              创建
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
