import { User } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui";
import { useRuntimeWorldConfig } from "@/hooks/useRuntimeWorldConfig";
import { color, colorAlpha } from "@/styles/tokens";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { useNpcCharacter } from "./useNpcCharacter";

interface NpcDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string | null;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <User
        className="w-12 h-12 mb-4"
        style={{ color: colorAlpha("textMuted", 0.4) }}
      />
      <p className="text-sm" style={{ color: color("textMuted") }}>
        未找到 NPC 数据
      </p>
      <p
        className="text-xs mt-1"
        style={{ color: colorAlpha("textMuted", 0.6) }}
      >
        请从列表中选择一个 NPC
      </p>
    </div>
  );
}

export function NpcDetailDialog({
  open,
  onOpenChange,
  characterId,
}: NpcDetailDialogProps) {
  const character = useNpcCharacter(characterId);
  const worldConfig = useRuntimeWorldConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="⬡ NPC 详情" width={900} animateLifecycle>
        {character ? (
          <div className="-m-4 h-[70vh]">
            <CharacterDetailPanel
              character={character}
              worldConfig={worldConfig}
              config={{ readonly: true }}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </DialogContent>
    </Dialog>
  );
}
