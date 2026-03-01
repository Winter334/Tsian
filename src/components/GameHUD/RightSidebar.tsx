import { Users, Wrench } from "lucide-react";

import { color, colorAlpha } from "@/styles/tokens";

import { RightSidebarSceneTab } from "./RightSidebarSceneTab";
import { RightSidebarToolboxTab } from "./RightSidebarToolboxTab";

type RightSidebarTab = "scene" | "toolbox";

interface RightSidebarProps {
  activeTab: RightSidebarTab;
  onActiveTabChange: (tab: RightSidebarTab) => void;
  onOpenAiInsight: () => void;
  onOpenArchiveManager: () => void;
}

const SCENE_TAB_ID = "right-sidebar-tab-scene";
const TOOLBOX_TAB_ID = "right-sidebar-tab-toolbox";
const SCENE_PANEL_ID = "right-sidebar-panel-scene";
const TOOLBOX_PANEL_ID = "right-sidebar-panel-toolbox";

export function RightSidebar({
  activeTab,
  onActiveTabChange,
  onOpenAiInsight,
  onOpenArchiveManager,
}: RightSidebarProps) {
  return (
    <aside className="flex flex-col h-full">
      <div
        id={activeTab === "scene" ? SCENE_PANEL_ID : TOOLBOX_PANEL_ID}
        className="flex-1 overflow-y-auto"
        role="tabpanel"
        aria-labelledby={activeTab === "scene" ? SCENE_TAB_ID : TOOLBOX_TAB_ID}
      >
        {activeTab === "scene" ? (
          <RightSidebarSceneTab />
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
          tabIndex={activeTab === "scene" ? 0 : -1}
          aria-selected={activeTab === "scene"}
          aria-controls={SCENE_PANEL_ID}
          onClick={() => onActiveTabChange("scene")}
          className="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 text-xs"
          style={{
            color:
              activeTab === "scene"
                ? color("primary")
                : colorAlpha("textSecondary", 0.6),
            borderBottom:
              activeTab === "scene"
                ? `2px solid ${color("primary")}`
                : "2px solid transparent",
          }}
          aria-label="切换到场景标签"
        >
          <Users size={16} />
          <span className="leading-none">场景</span>
        </button>

        <button
          id={TOOLBOX_TAB_ID}
          type="button"
          role="tab"
          tabIndex={activeTab === "toolbox" ? 0 : -1}
          aria-selected={activeTab === "toolbox"}
          aria-controls={TOOLBOX_PANEL_ID}
          onClick={() => onActiveTabChange("toolbox")}
          className="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 text-xs"
          style={{
            color:
              activeTab === "toolbox"
                ? color("primary")
                : colorAlpha("textSecondary", 0.6),
            borderBottom:
              activeTab === "toolbox"
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
