import { useEffect, useState, type ReactNode } from "react";

import { AiInsightDialog } from "@/components/AiInsight";
import { selectSessionMode, useSessionStore } from "@/stores";
import { colorAlpha } from "@/styles/tokens";

import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar, type RightSidebarTab } from "./RightSidebar";
import { SidebarDrawer } from "./SidebarDrawer";
import { TopBar } from "./TopBar";

interface GameHUDProps {
  onReturnToHub: () => void;
  onOpenCharacterPanel: () => void;
  onOpenArchiveManager: () => void;
  onOpenCheckpoint: () => void;
  onOpenMemory: () => void;
  onOpenRoomInfo: () => void;
  children: ReactNode;
}

export function GameHUD({
  onReturnToHub,
  onOpenCharacterPanel,
  onOpenArchiveManager,
  onOpenCheckpoint,
  onOpenMemory,
  onOpenRoomInfo,
  children,
}: GameHUDProps) {
  const sessionMode = useSessionStore(selectSessionMode);
  const isMultiplayer = sessionMode === "multiplayer";

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightSidebarActiveTab, setRightSidebarActiveTab] =
    useState<RightSidebarTab>(isMultiplayer ? "team" : "scene");
  const [aiInsightOpen, setAiInsightOpen] = useState(false);

  useEffect(() => {
    setRightSidebarActiveTab((current) => {
      if (!isMultiplayer && current === "team") {
        return "scene";
      }

      return current;
    });
  }, [isMultiplayer]);

  return (
    <div className="relative h-dvh flex">
      <aside
        className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
        style={{
          borderRight: `1px solid ${colorAlpha("primary", 0.15)}`,
          background: colorAlpha("bgElevated", 0.8),
        }}
      >
        <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
      </aside>

      <main className="flex-1 min-w-0 relative overflow-hidden flex flex-col">
        <TopBar
          onOpenLeftSidebar={() => setLeftOpen(true)}
          onOpenRightSidebar={() => setRightOpen(true)}
          onReturnToHub={onReturnToHub}
          onOpenRoomInfo={onOpenRoomInfo}
        />

        <div className="flex-1 min-h-0 overflow-auto">{children}</div>

        <SidebarDrawer
          side="left"
          open={leftOpen}
          onClose={() => setLeftOpen(false)}
        >
          <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
        </SidebarDrawer>

        <SidebarDrawer
          side="right"
          open={rightOpen}
          onClose={() => setRightOpen(false)}
        >
          <RightSidebar
            activeTab={rightSidebarActiveTab}
            onActiveTabChange={setRightSidebarActiveTab}
            onOpenAiInsight={() => setAiInsightOpen(true)}
            onOpenArchiveManager={onOpenArchiveManager}
            onOpenCheckpoint={onOpenCheckpoint}
            onOpenMemory={onOpenMemory}
          />
        </SidebarDrawer>
      </main>

      <aside
        className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
        style={{
          borderLeft: `1px solid ${colorAlpha("primary", 0.15)}`,
          background: colorAlpha("bgElevated", 0.8),
        }}
      >
        <RightSidebar
          activeTab={rightSidebarActiveTab}
          onActiveTabChange={setRightSidebarActiveTab}
          onOpenAiInsight={() => setAiInsightOpen(true)}
          onOpenArchiveManager={onOpenArchiveManager}
          onOpenCheckpoint={onOpenCheckpoint}
          onOpenMemory={onOpenMemory}
        />
      </aside>

      <AiInsightDialog open={aiInsightOpen} onOpenChange={setAiInsightOpen} />
    </div>
  );
}

export type { GameHUDProps };
