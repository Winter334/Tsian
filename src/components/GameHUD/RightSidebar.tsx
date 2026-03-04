import { Users, UsersRound, Wrench } from "lucide-react";

import { selectSessionMode, useSessionStore } from "@/stores";
import { color, colorAlpha } from "@/styles/tokens";

import { RightSidebarSceneTab } from "./RightSidebarSceneTab";
import { RightSidebarTeamTab } from "./RightSidebarTeamTab";
import { RightSidebarToolboxTab } from "./RightSidebarToolboxTab";

type RightSidebarTab = "scene" | "team" | "toolbox";

interface RightSidebarProps {
  activeTab: RightSidebarTab;
  onActiveTabChange: (tab: RightSidebarTab) => void;
  onOpenAiInsight: () => void;
  onOpenArchiveManager: () => void;
}

const SCENE_TAB_ID = "right-sidebar-tab-scene";
const TEAM_TAB_ID = "right-sidebar-tab-team";
const TOOLBOX_TAB_ID = "right-sidebar-tab-toolbox";
const SCENE_PANEL_ID = "right-sidebar-panel-scene";
const TEAM_PANEL_ID = "right-sidebar-panel-team";
const TOOLBOX_PANEL_ID = "right-sidebar-panel-toolbox";

export function RightSidebar({
  activeTab,
  onActiveTabChange,
  onOpenAiInsight,
  onOpenArchiveManager,
}: RightSidebarProps) {
  const sessionMode = useSessionStore(selectSessionMode);
  const isMultiplayer = sessionMode === "multiplayer";
  const effectiveActiveTab =
    isMultiplayer || activeTab !== "team" ? activeTab : "scene";

  const panelId =
    effectiveActiveTab === "scene"
      ? SCENE_PANEL_ID
      : effectiveActiveTab === "team"
        ? TEAM_PANEL_ID
        : TOOLBOX_PANEL_ID;

  const labelledBy =
    effectiveActiveTab === "scene"
      ? SCENE_TAB_ID
      : effectiveActiveTab === "team"
        ? TEAM_TAB_ID
        : TOOLBOX_TAB_ID;

  return (
    <aside className="flex h-full flex-col">
      <div
        id={panelId}
        className="flex-1 overflow-y-auto"
        role="tabpanel"
        aria-labelledby={labelledBy}
      >
        {effectiveActiveTab === "scene" ? (
          <RightSidebarSceneTab />
        ) : effectiveActiveTab === "team" ? (
          <RightSidebarTeamTab />
        ) : (
          <RightSidebarToolboxTab
            onOpenAiInsight={onOpenAiInsight}
            onOpenArchiveManager={onOpenArchiveManager}
          />
        )}
      </div>

      <nav
        className="shrink-0 flex"
        role="tablist"
        aria-label="右侧功能栏标签"
        style={{
          borderTop: `1px solid ${colorAlpha("primary", 0.15)}`,
          background: colorAlpha("bgElevated", 0.6),
        }}
      >
        <button
          id={SCENE_TAB_ID}
          type="button"
          role="tab"
          tabIndex={effectiveActiveTab === "scene" ? 0 : -1}
          aria-selected={effectiveActiveTab === "scene"}
          aria-controls={SCENE_PANEL_ID}
          onClick={() => onActiveTabChange("scene")}
          className="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 text-xs"
          style={{
            color:
              effectiveActiveTab === "scene"
                ? color("primary")
                : colorAlpha("textSecondary", 0.6),
            borderBottom:
              effectiveActiveTab === "scene"
                ? `2px solid ${color("primary")}`
                : "2px solid transparent",
          }}
          aria-label="切换到场景标签"
        >
          <Users size={16} />
          <span className="leading-none">场景</span>
        </button>

        {isMultiplayer ? (
          <button
            id={TEAM_TAB_ID}
            type="button"
            role="tab"
            tabIndex={effectiveActiveTab === "team" ? 0 : -1}
            aria-selected={effectiveActiveTab === "team"}
            aria-controls={TEAM_PANEL_ID}
            onClick={() => onActiveTabChange("team")}
            className="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 text-xs"
            style={{
              color:
                effectiveActiveTab === "team"
                  ? color("primary")
                  : colorAlpha("textSecondary", 0.6),
              borderBottom:
                effectiveActiveTab === "team"
                  ? `2px solid ${color("primary")}`
                  : "2px solid transparent",
            }}
            aria-label="切换到队伍标签"
          >
            <UsersRound size={16} />
            <span className="leading-none">队伍</span>
          </button>
        ) : null}

        <button
          id={TOOLBOX_TAB_ID}
          type="button"
          role="tab"
          tabIndex={effectiveActiveTab === "toolbox" ? 0 : -1}
          aria-selected={effectiveActiveTab === "toolbox"}
          aria-controls={TOOLBOX_PANEL_ID}
          onClick={() => onActiveTabChange("toolbox")}
          className="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 text-xs"
          style={{
            color:
              effectiveActiveTab === "toolbox"
                ? color("primary")
                : colorAlpha("textSecondary", 0.6),
            borderBottom:
              effectiveActiveTab === "toolbox"
                ? `2px solid ${color("primary")}`
                : "2px solid transparent",
          }}
          aria-label="切换到工具箱标签"
        >
          <Wrench size={16} />
          <span className="leading-none">工具箱</span>
        </button>
      </nav>
    </aside>
  );
}

export type { RightSidebarProps, RightSidebarTab };
