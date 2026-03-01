import { NpcList } from "@/components/CharacterPanel/NpcList";
import { color, colorAlpha } from "@/styles/tokens";

export function RightSidebarSceneTab() {
  return (
    <div className="p-4 space-y-4">
      <section>
        <h2
          className="text-sm font-bold tracking-wider uppercase"
          style={{ color: color("textPrimary") }}
        >
          场景角色
        </h2>
        <p
          className="text-xs mt-0.5"
          style={{ color: colorAlpha("textSecondary", 0.8) }}
        >
          当前场景中的 NPC
        </p>
      </section>

      <section
        className="rounded-lg p-3"
        style={{
          background: colorAlpha("bgElevated", 0.45),
          border: `1px solid ${colorAlpha("primary", 0.18)}`,
        }}
      >
        <NpcList />
      </section>
    </div>
  );
}
