import { NpcList } from "@/components/CharacterPanel/NpcList";
import { color, colorAlpha } from "@/styles/tokens";

export function RightSidebar() {
  return (
    <aside className="p-4 space-y-4">
      <section
        className="rounded-lg p-3"
        style={{
          background: colorAlpha("bgElevated", 0.45),
          border: `1px solid ${colorAlpha("primary", 0.18)}`,
        }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: color("textPrimary") }}
        >
          场景角色
        </h2>
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textSecondary", 0.8) }}
        >
          当前场景中的 NPC 与状态
        </p>
      </section>

      <section
        className="rounded-lg p-3"
        style={{
          background: colorAlpha("bgElevated", 0.42),
          border: `1px solid ${colorAlpha("primary", 0.16)}`,
        }}
      >
        <NpcList />
      </section>
    </aside>
  );
}
